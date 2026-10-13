"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Icon, { CatIcon } from "./Icon";
import { CATEGORIES } from "@/lib/categories";
import { localDateKey, euro } from "@/lib/period";
import { prepareImage } from "@/lib/compressImage";
import { recognizeImage, warmupOcr } from "@/lib/onDeviceOcr";
import { parseReceipt } from "@/lib/receiptParser";
import { createCategorizer, normalizeKey } from "@/lib/categoryModel";
import { splitReceipt } from "@/lib/receiptSplit";

const CATEGORY_NAMES = CATEGORIES.map((c) => c.name);
const round2 = (n) => Math.round(n * 100) / 100;
let nextId = 1;

const SOURCE_LABEL = {
  memory: "Remembered",
  history: "Learned",
  keywords: "Guessed",
  dictionary: "Guessed",
  store: "From store",
  none: "",
};

export default function BillScanner({ expenses = [], onExpenseAdded }) {
  const [step, setStep] = useState("choose"); // choose | reading | paste | review | done
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [corrections, setCorrections] = useState([]);
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  // Start downloading the reader as soon as the tab opens, and load remembered fixes
  useEffect(() => {
    warmupOcr();
    fetch("/api/corrections")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => Array.isArray(rows) && setCorrections(rows))
      .catch(() => {});
  }, []);

  const categorizer = useMemo(() => createCategorizer({ expenses, corrections }), [expenses, corrections]);

  // ---------- reading ----------
  const buildReceipt = (lines, source) => {
    const parsed = parseReceipt(lines, { guessStore: source !== "paste" });
    const merchantCategory = parsed.merchant.category;
    const items = parsed.items.map((it) => {
      const c = categorizer.categorize(it.raw || it.name, { merchantCategory });
      const name = c.name || it.name;
      return {
        ...it,
        id: nextId++,
        name,
        category: c.category,
        confidence: c.confidence,
        source: c.source,
        suggestedName: name,
        suggestedCategory: c.category,
        selected: true,
      };
    });
    const storeCategory =
      categorizer.categorizeStore(parsed.merchant.name, merchantCategory) ||
      mostCommon(items.map((i) => i.category)) ||
      "Other";
    setReceipt({
      merchant: parsed.merchant.name || "",
      date: parsed.date || localDateKey(),
      dateFound: Boolean(parsed.date),
      total: parsed.total ? String(parsed.total.toFixed(2)) : "",
      totalSource: parsed.totalSource,
      mode: items.length ? "split" : "single",
      category: storeCategory,
      items,
      lines: parsed.lines,
      source,
    });
    setStep("review");
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMessage("");
    setPreview(URL.createObjectURL(file));
    setStep("reading");
    setStatus("Preparing photo…");

    let image;
    try {
      image = await prepareImage(file);
    } catch (err) {
      setMessage(err.message);
      setStep("choose");
      return;
    }

    try {
      setStatus("Reading receipt on your device…");
      const { lines } = await recognizeImage(image);
      if (!lines.length) throw new Error("No text found");
      buildReceipt(lines, "device");
    } catch (deviceErr) {
      // Fall back to the online reader (OCR.space free tier)
      try {
        setStatus("Trying the online reader…");
        const form = new FormData();
        form.append("image", image);
        const res = await fetch("/api/scan", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Online reader failed");
        buildReceipt(data.text.split("\n"), "online");
      } catch (err) {
        console.error(deviceErr, err);
        setMessage("Couldn't read this photo. Try a sharper, well-lit picture, or paste the items instead.");
        setStep("choose");
      }
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) {
      setMessage("Paste your list first.");
      return;
    }
    setMessage("");
    buildReceipt(pasteText.split("\n"), "paste");
  };

  // ---------- editing ----------
  const setField = (field, value) => setReceipt((r) => ({ ...r, [field]: value }));
  const updateItem = (id, patch) =>
    setReceipt((r) => ({ ...r, items: r.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) }));
  const removeItem = (id) => setReceipt((r) => ({ ...r, items: r.items.filter((it) => it.id !== id) }));
  const addItem = () =>
    setReceipt((r) => ({
      ...r,
      mode: "split",
      items: [
        ...r.items,
        { id: nextId++, name: "", amount: 0, category: r.category || "Other", selected: true, source: "none" },
      ],
    }));

  const selectedItems = receipt ? receipt.items.filter((it) => it.selected && Number(it.amount) > 0) : [];
  const itemsTotal = round2(selectedItems.reduce((s, it) => s + Number(it.amount), 0));
  const total = receipt ? round2(parseFloat(String(receipt.total).replace(",", ".")) || itemsTotal) : 0;
  const difference = round2(total - itemsTotal);
  const groups = receipt
    ? splitReceipt({ total, items: selectedItems, mode: receipt.mode, category: receipt.category })
    : [];

  // ---------- saving ----------
  const save = async () => {
    if (!(total > 0)) {
      setMessage("Enter the receipt total first.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: receipt.merchant,
          date: receipt.date,
          total,
          mode: receipt.mode,
          category: receipt.category,
          source: receipt.source,
          lines: receipt.lines,
          items: selectedItems.map(({ name, amount, category, qty, unit, isWeight, discount, raw }) => ({
            name,
            amount: Number(amount),
            category,
            qty,
            unit,
            isWeight,
            discount,
            raw,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      // Remember what the user changed, so the next scan gets it right
      const fixes = receipt.items
        .filter((it) => it.selected && it.raw)
        .filter((it) => it.name !== it.suggestedName || it.category !== it.suggestedCategory)
        .map((it) => ({ raw: it.raw, name: it.name, category: it.category }));
      if (fixes.length) {
        fetch("/api/corrections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ corrections: fixes }),
        }).catch(() => {});
        setCorrections((prev) => [
          ...fixes.map((f) => ({ ...f, key: normalizeKey(f.raw) })),
          ...prev,
        ]);
      }

      setSaved({ merchant: receipt.merchant, total, count: data.expenses.length, learned: fixes.length });
      setStep("done");
      onExpenseAdded?.();
    } catch (err) {
      setMessage(`Couldn't save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setReceipt(null);
    setPasteText("");
    setMessage("");
    setSaved(null);
    setStep("choose");
  };

  // ---------- render ----------
  return (
    <div className="panel scanner-card">
      {message && <div className="form-message error">{message}</div>}

      {step === "choose" && (
        <div className="upload-area">
          <div className="upload-options three-col">
            <button className="dropzone" onClick={() => cameraRef.current?.click()}>
              <div className="dropzone-icon">
                <Icon name="camera" size={30} strokeWidth={1.6} />
              </div>
              <p className="dropzone-title">Camera</p>
              <p className="dropzone-subtitle">Snap the receipt</p>
            </button>
            <button className="dropzone" onClick={() => fileRef.current?.click()}>
              <div className="dropzone-icon">
                <Icon name="image" size={30} strokeWidth={1.6} />
              </div>
              <p className="dropzone-title">Gallery</p>
              <p className="dropzone-subtitle">Pick a photo</p>
            </button>
            <button className="dropzone" onClick={() => setStep("paste")}>
              <div className="dropzone-icon">
                <Icon name="clipboard" size={30} strokeWidth={1.6} />
              </div>
              <p className="dropzone-title">Paste list</p>
              <p className="dropzone-subtitle">Type or paste items</p>
            </button>
          </div>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} hidden />

          <div className="scan-tips">
            <p className="tips-title">How it works</p>
            <ul className="tips-list">
              <li>The receipt is read on your device — the photo never leaves your phone</li>
              <li>Store, date and total are found automatically; items are split by category</li>
              <li>Fix anything once and it&apos;s remembered for next time</li>
              <li>Flat, well-lit photos with the whole receipt in view work best</li>
            </ul>
            {categorizer.trainedOn > 0 && (
              <p className="tips-foot">
                Categories learned from {categorizer.trainedOn} of your expenses
                {corrections.length ? ` · ${corrections.length} remembered fixes` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {step === "reading" && (
        <div className="reading-area">
          {preview && (
            <div className="reading-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Receipt" />
              <span className="reading-scanline" />
            </div>
          )}
          <p className="scan-status">{status}</p>
          <div className="progress-bar-container indeterminate">
            <div className="progress-bar" />
          </div>
          <p className="progress-text">The first scan downloads the reader once (about 10–15 MB). After that it&apos;s quick and works offline.</p>
        </div>
      )}

      {step === "paste" && (
        <div className="paste-area">
          <p className="paste-instructions">One item per line, any format works:</p>
          <div className="paste-examples">
            <code>Milk - €2.50</code>
            <code>Bread: 1.20</code>
            <code>2 x Coffee 3,80</code>
          </div>
          <textarea
            className="paste-textarea"
            rows={9}
            placeholder={"Milk - 2.50\nBread - 1.20\nRice 2kg - 3.99"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            autoFocus
          />
          <div className="paste-actions">
            <button className="btn btn-primary" onClick={handlePaste}>
              Read items
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              Back
            </button>
          </div>
        </div>
      )}

      {step === "review" && receipt && (
        <div className="rx">
          {/* Receipt summary */}
          <div className="rx-head">
            <label className="rx-field rx-store">
              <span>Store</span>
              <input
                value={receipt.merchant}
                placeholder="Store name"
                onChange={(e) => setField("merchant", e.target.value)}
              />
            </label>
            <label className="rx-field">
              <span>Date {!receipt.dateFound && receipt.source !== "paste" && <em>not found · today</em>}</span>
              <input type="date" value={receipt.date} onChange={(e) => setField("date", e.target.value)} />
            </label>
            <label className="rx-field">
              <span>Total {receipt.totalSource === "items" && <em>from items</em>}</span>
              <input
                inputMode="decimal"
                value={receipt.total}
                placeholder={itemsTotal.toFixed(2)}
                onChange={(e) => setField("total", e.target.value)}
              />
            </label>
          </div>

          {receipt.items.length > 0 && (
            <div className={`rx-check ${Math.abs(difference) < 0.01 ? "ok" : "warn"}`}>
              <Icon name={Math.abs(difference) < 0.01 ? "check" : "search"} size={16} strokeWidth={2.2} />
              {Math.abs(difference) < 0.01 ? (
                <span>Items add up to the receipt total</span>
              ) : (
                <span>
                  Items add up to {euro(itemsTotal)} — {euro(Math.abs(difference))}{" "}
                  {difference > 0 ? "missing" : "too much"}.{" "}
                  {receipt.mode === "split" && groups[0] && <>It&apos;ll be balanced on {groups[0].category}.</>}
                </span>
              )}
            </div>
          )}

          {/* How it will be saved */}
          <div className="rx-save-as">
            <div className="seg" role="tablist">
              <button
                className={receipt.mode === "split" ? "active" : ""}
                onClick={() => setField("mode", "split")}
                disabled={!receipt.items.length}
              >
                Split by category
              </button>
              <button className={receipt.mode === "single" ? "active" : ""} onClick={() => setField("mode", "single")}>
                One expense
              </button>
            </div>
            {receipt.mode === "single" && (
              <select
                className="filter-select"
                value={receipt.category}
                onChange={(e) => setField("category", e.target.value)}
              >
                {CATEGORY_NAMES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}
          </div>

          <div className="rx-groups">
            {groups.map((g) => (
              <span key={g.category} className="rx-group">
                <CatIcon name={g.category} size={15} />
                {g.category}
                <strong>{euro(g.amount)}</strong>
              </span>
            ))}
          </div>

          {/* Items */}
          <div className="rx-items-head">
            <span>{receipt.items.length ? `${receipt.items.length} items` : "No items found — saved as one expense"}</span>
            <button className="btn btn-ghost btn-small" onClick={addItem}>
              + Add item
            </button>
          </div>

          <div className="rx-items">
            {receipt.items.map((it) => (
              <div key={it.id} className={`rx-item ${it.selected ? "" : "off"}`}>
                <input
                  type="checkbox"
                  className="rx-check-box"
                  checked={it.selected}
                  onChange={() => updateItem(it.id, { selected: !it.selected })}
                  aria-label="Include item"
                />
                <div className="rx-item-main">
                  <div className="rx-item-row">
                    <input
                      className="rx-name"
                      value={it.name}
                      placeholder="Item name"
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    />
                    <input
                      className="rx-amount"
                      inputMode="decimal"
                      value={it.amount}
                      onChange={(e) => updateItem(it.id, { amount: e.target.value.replace(",", ".") })}
                    />
                  </div>
                  <div className="rx-item-row small">
                    {receipt.mode === "split" && (
                      <select
                        className="rx-cat"
                        value={it.category}
                        onChange={(e) => updateItem(it.id, { category: e.target.value })}
                      >
                        {CATEGORY_NAMES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    )}
                    {it.qty ? (
                      <span className="rx-meta">
                        {it.isWeight ? `${it.qty} kg` : `${it.qty}×`} {it.unit ? `@ ${euro(Number(it.unit))}` : ""}
                      </span>
                    ) : null}
                    {it.discount ? <span className="rx-meta">−{euro(it.discount)} off</span> : null}
                    {it.source && SOURCE_LABEL[it.source] && it.category === it.suggestedCategory && (
                      <span className={`rx-badge ${it.source}`}>{SOURCE_LABEL[it.source]}</span>
                    )}
                  </div>
                  {it.raw && it.raw.toLowerCase() !== String(it.name).toLowerCase() && (
                    <span className="raw-text-hint">Receipt: {it.raw}</span>
                  )}
                </div>
                <button className="remove-item-btn" onClick={() => removeItem(it.id)} aria-label="Remove item">
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="review-actions">
            <button className="btn btn-primary" onClick={save} disabled={saving}>
              {saving
                ? "Saving…"
                : `Save ${groups.length > 1 ? `${groups.length} expenses` : "expense"} · ${euro(total)}`}
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              Start over
            </button>
          </div>

          {receipt.lines?.length > 0 && receipt.source !== "paste" && (
            <details className="raw-text-section">
              <summary>
                Text read from the receipt ({receipt.source === "device" ? "on device" : "online reader"})
              </summary>
              <pre className="raw-text-content">{receipt.lines.join("\n")}</pre>
            </details>
          )}
        </div>
      )}

      {step === "done" && saved && (
        <div className="done-area">
          <div className="done-icon">
            <Icon name="check" size={30} strokeWidth={2.4} />
          </div>
          <p className="done-title">
            Saved {saved.merchant || "receipt"} · {euro(saved.total)}
          </p>
          <p className="done-sub">
            {saved.count > 1 ? `Split into ${saved.count} expenses by category.` : "Saved as one expense."}
            {saved.learned ? ` Remembered ${saved.learned} fix${saved.learned > 1 ? "es" : ""} for next time.` : ""}
          </p>
          <button className="btn btn-primary" onClick={reset}>
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}

function mostCommon(list) {
  const counts = {};
  let best = null;
  for (const x of list) {
    counts[x] = (counts[x] || 0) + 1;
    if (!best || counts[x] > counts[best]) best = x;
  }
  return best;
}
