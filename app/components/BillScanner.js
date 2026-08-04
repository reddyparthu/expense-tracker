"use client";
import { useState, useRef } from "react";
import { processReceiptText } from "@/lib/ocrUtils";
import { compressImage } from "@/lib/compressImage";

const categories = [
  "Food & Groceries",
  "Rent & Housing",
  "Transport",
  "Utilities",
  "Entertainment",
  "Health",
  "Shopping",
  "Other",
];

// Parse pasted text from ChatGPT or similar
function parsePastedList(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  const items = [];

  for (const line of lines) {
    let cleaned = line.replace(/^[\d]+[.):\-]\s*/, "");
    cleaned = cleaned.replace(/^[-•*·→►]\s*/, "").trim();
    if (!cleaned) continue;

    const skipWords = [
      "total", "subtotal", "grand total", "tax", "vat",
      "item", "description", "price", "amount", "quantity",
      "here is", "here are", "list of", "expenses:",
      "---", "===",
    ];
    if (skipWords.some((w) => cleaned.toLowerCase().includes(w) && cleaned.length < 40)) continue;

    const pricePatterns = [
      /[€$£]\s*(\d{1,5}[.,]\d{1,2})/,
      /(\d{1,5}[.,]\d{1,2})\s*[€$£]?\s*(?:EUR|USD|GBP|eur)?/i,
      /\((?:[€$£])?\s*(\d{1,5}[.,]\d{1,2})\s*(?:[€$£])?\)/,
    ];

    let price = null;
    let matchStr = "";

    for (const pattern of pricePatterns) {
      const m = cleaned.match(pattern);
      if (m) {
        const p = parseFloat(m[1].replace(",", "."));
        if (p > 0 && p < 99999) {
          price = p;
          matchStr = m[0];
          break;
        }
      }
    }

    if (price === null) continue;

    let itemName = cleaned.replace(matchStr, "");
    itemName = itemName.replace(/[-–—:|>→►\.]{2,}\s*$/, "");
    itemName = itemName.replace(/^\s*[-–—:|>→►\.]{2,}/, "");
    itemName = itemName.replace(/[-–—:|>→►]\s*$/, "");
    itemName = itemName.replace(/^\s*[-–—:|>→►]/, "");
    itemName = itemName.replace(/\(\s*\)/, "");
    itemName = itemName.replace(/\s{2,}/g, " ").trim();

    if (itemName.length < 1) continue;

    const displayName = itemName
      .split(" ")
      .map((w) => {
        if (w.length <= 2) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(" ");

    items.push({
      item: displayName,
      amount: Math.round(price * 100) / 100,
      rawName: itemName,
    });
  }
  return items;
}

function categorizePastedItems(items) {
  const keywordMap = {
    "Food & Groceries": [
      "milk", "bread", "rice", "egg", "chicken", "meat", "fish", "butter",
      "cheese", "yogurt", "apple", "banana", "orange", "tomato", "potato",
      "onion", "garlic", "carrot", "pasta", "noodle", "cereal", "flour",
      "sugar", "salt", "oil", "coffee", "tea", "juice", "water", "soda",
      "beer", "wine", "chips", "cookie", "chocolate", "frozen", "soup",
      "sauce", "sausage", "bacon", "ham", "shrimp", "tofu", "mushroom",
      "avocado", "lemon", "grape", "mango", "corn", "peas", "beans",
      "nuts", "almond", "cream", "honey", "jam", "ketchup", "mustard",
      "fruit", "vegetable", "snack", "drink", "grocery", "food", "pizza",
      "sandwich", "salad", "dairy", "bakery", "salmon", "beef", "pork",
    ],
    "Shopping": [
      "soap", "shampoo", "toothpaste", "deodorant", "detergent",
      "tissue", "toilet paper", "battery", "cloth", "shirt", "shoe",
      "bag", "cosmetic", "beauty", "cleaner",
    ],
    "Transport": [
      "petrol", "gasoline", "diesel", "fuel", "bus", "train", "metro",
      "taxi", "uber", "parking", "toll", "fare",
    ],
    "Utilities": [
      "electricity", "water bill", "internet", "wifi", "phone bill",
      "mobile", "recharge", "broadband",
    ],
    "Entertainment": [
      "netflix", "spotify", "cinema", "movie", "concert", "game",
      "playstation", "xbox", "disney", "youtube", "subscription",
    ],
    "Health": [
      "medicine", "pharmacy", "doctor", "dentist", "hospital",
      "vitamin", "gym", "health", "clinic",
    ],
    "Rent & Housing": [
      "rent", "mortgage", "repair", "maintenance", "furniture",
    ],
  };

  return items.map((item) => {
    const lower = (item.item + " " + item.rawName).toLowerCase();
    let category = "Other";
    for (const [cat, keywords] of Object.entries(keywordMap)) {
      if (keywords.some((kw) => lower.includes(kw))) {
        category = cat;
        break;
      }
    }
    return { ...item, category, confidence: category !== "Other" ? 80 : 0 };
  });
}

export default function BillScanner({ onExpenseAdded }) {
  const [mode, setMode] = useState("choose");
  const [step, setStep] = useState("upload");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [items, setItems] = useState([]);
  const [rawText, setRawText] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [compressionInfo, setCompressionInfo] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMode("scan");
    setStep("compressing");
    setProgressText("Preparing image...");

    try {
      const originalSize = (file.size / 1024 / 1024).toFixed(1);

      // Compress if needed
      const compressed = await compressImage(file);
      const newSize = (compressed.size / 1024 / 1024).toFixed(1);

      if (file.size !== compressed.size) {
        setCompressionInfo(`Compressed: ${originalSize}MB → ${newSize}MB`);
      } else {
        setCompressionInfo(`Size: ${originalSize}MB`);
      }

      setImageFile(compressed);

      // Create preview from original for display
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setStep("ready");
    } catch (err) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
      setStep("ready");
    }
  };

  const handleScan = async () => {
    if (!imageFile) return;
    setStep("scanning");
    setProgress(10);
    setProgressText("Uploading to OCR engine...");

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      setProgress(30);
      setProgressText("Reading text from bill...");

      const res = await fetch("/api/scan", {
        method: "POST",
        body: formData,
      });

      setProgress(70);
      setProgressText("Processing results...");

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "OCR failed");
      }

      const fullText = data.text;
      setRawText(fullText);

      setProgress(90);
      setProgressText("Extracting items...");

      const extracted = processReceiptText(fullText);
      finishExtraction(extracted);
    } catch (err) {
      console.error("Scan error:", err);
      setMessage("Failed to scan: " + err.message + ". Try a clearer photo or paste the list.");
      setStep("ready");
    }
  };

  const handlePasteSubmit = () => {
    if (!pasteText.trim()) {
      setMessage("Paste your expense list first.");
      return;
    }
    setMessage("");
    const rawItems = parsePastedList(pasteText);
    const categorized = categorizePastedItems(rawItems);
    setRawText(pasteText);
    finishExtraction(categorized);
  };

  const finishExtraction = (extracted) => {
    if (extracted.length === 0) {
      setItems([]);
      setStep("review");
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const withMeta = extracted.map((item, i) => ({
      ...item,
      id: Date.now() + i,
      date: today,
      selected: true,
    }));
    setItems(withMeta);
    setStep("review");
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const toggleItem = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addManualItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        item: "",
        amount: 0,
        category: "Other",
        date: new Date().toISOString().split("T")[0],
        confidence: 100,
        selected: true,
        rawName: "",
      },
    ]);
  };

  const saveAll = async () => {
    const selected = items.filter((item) => item.selected && item.item && item.amount > 0);
    if (selected.length === 0) {
      setMessage("No items to save.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      for (const item of selected) {
        await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item: item.item,
            amount: item.amount,
            category: item.category,
            date: item.date,
          }),
        });
      }
      setMessage(`${selected.length} expenses saved!`);
      setStep("done");
      if (onExpenseAdded) onExpenseAdded();
    } catch (err) {
      setMessage("Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setMode("choose");
    setStep("upload");
    setImagePreview(null);
    setImageFile(null);
    setItems([]);
    setRawText("");
    setPasteText("");
    setMessage("");
    setProgress(0);
    setProgressText("");
    setCompressionInfo("");
  };

  const selectedTotal = items
    .filter((i) => i.selected)
    .reduce((sum, i) => sum + (parseFloat(i.amount) || 0), 0);

  return (
    <div className="scanner-card">
      <h2>
        <span className="section-icon">📷</span>
        Scan Bill
      </h2>

      {message && (
        <div className={`form-message ${message.includes("saved") ? "success" : "error"}`}>
          {message}
        </div>
      )}

      {/* MODE CHOOSER */}
      {mode === "choose" && step === "upload" && (
        <div className="upload-area">
          <div className="upload-options three-col">
            <div className="dropzone" onClick={() => fileRef.current?.click()}>
              <div className="dropzone-icon">🖼️</div>
              <p className="dropzone-title">Gallery</p>
              <p className="dropzone-subtitle">Pick a photo of your bill</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
            </div>
            <div className="dropzone" onClick={() => cameraRef.current?.click()}>
              <div className="dropzone-icon">📸</div>
              <p className="dropzone-title">Camera</p>
              <p className="dropzone-subtitle">Snap the bill</p>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
            </div>
            <div className="dropzone" onClick={() => { setMode("paste"); setStep("paste"); }}>
              <div className="dropzone-icon">📋</div>
              <p className="dropzone-title">Paste List</p>
              <p className="dropzone-subtitle">Paste from ChatGPT etc.</p>
            </div>
          </div>
          <div className="scan-tips">
            <p className="tips-title">Tips:</p>
            <ul className="tips-list">
              <li>Use good lighting for photos — avoid shadows</li>
              <li>Printed receipts work better than handwritten</li>
              <li>Large images are auto-compressed for you</li>
              <li>For paste: any format works — &quot;Milk - €2.50&quot; or &quot;Milk 2.50&quot;</li>
            </ul>
          </div>
        </div>
      )}

      {/* COMPRESSING */}
      {step === "compressing" && (
        <div className="scanning-area">
          <div className="scan-animation">
            <div className="scan-icon">⚙️</div>
            <p className="scan-status">{progressText}</p>
          </div>
        </div>
      )}

      {/* PASTE MODE */}
      {step === "paste" && (
        <div className="paste-area">
          <p className="paste-instructions">
            Paste your expense list below. Any format works:
          </p>
          <div className="paste-examples">
            <code>Milk - €2.50</code>
            <code>Bread: 1.20</code>
            <code>1. Rice €3.99</code>
            <code>Eggs 2.50 EUR</code>
          </div>
          <textarea
            className="paste-textarea"
            rows={10}
            placeholder={"Paste your list here...\n\nExample:\nMilk - €2.50\nBread - €1.20\nRice 2kg - €3.99\nEggs - €2.80"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            autoFocus
          />
          <div className="paste-actions">
            <button className="btn btn-primary" onClick={handlePasteSubmit}>
              Detect Items
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* SCAN MODE - Image ready */}
      {mode === "scan" && step === "ready" && (
        <div className="upload-area">
          <div className="image-preview-container">
            <img src={imagePreview} alt="Bill preview" className="image-preview" />
            {compressionInfo && (
              <p className="compression-info">{compressionInfo}</p>
            )}
            <div className="preview-actions">
              <button className="btn btn-primary" onClick={handleScan}>
                Scan This Bill
              </button>
              <button className="btn btn-ghost" onClick={reset}>
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCANNING */}
      {step === "scanning" && (
        <div className="scanning-area">
          <div className="scan-animation">
            <div className="scan-icon">🔍</div>
            <p className="scan-status">{progressText}</p>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="progress-text">{progress}% complete</p>
        </div>
      )}

      {/* REVIEW */}
      {step === "review" && (
        <div className="review-area">
          {items.length === 0 ? (
            <div className="no-items-found">
              <p className="no-items-title">No items detected</p>
              <p className="no-items-subtitle">
                {mode === "paste"
                  ? "Could not find items with prices. Make sure each line has a name and a number."
                  : "The image might be blurry. Try a clearer photo or paste a list instead."}
              </p>
              {rawText && (
                <details className="raw-text-section" style={{ marginBottom: "16px" }}>
                  <summary>View detected text</summary>
                  <pre className="raw-text-content">{rawText}</pre>
                </details>
              )}
              <div className="no-items-actions">
                <button className="btn btn-primary" onClick={addManualItem}>
                  Add Manually
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Start Over
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="review-header">
                <div className="review-info">
                  <span className="review-count">{items.length} items found</span>
                  <span className="review-total">
                    Selected total: €{selectedTotal.toFixed(2)}
                  </span>
                </div>
                <button className="btn btn-small btn-ghost" onClick={addManualItem}>
                  + Add Item
                </button>
              </div>

              <div className="review-list">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`review-item ${!item.selected ? "deselected" : ""}`}
                  >
                    <div className="review-item-check">
                      <input
                        type="checkbox"
                        checked={item.selected}
                        onChange={() => toggleItem(item.id)}
                      />
                    </div>
                    <div className="review-item-fields">
                      <div className="review-row">
                        <input
                          type="text"
                          className="review-input name-input"
                          value={item.item}
                          onChange={(e) => updateItem(item.id, "item", e.target.value)}
                          placeholder="Item name"
                        />
                        <input
                          type="number"
                          className="review-input price-input"
                          value={item.amount}
                          step="0.01"
                          min="0"
                          onChange={(e) =>
                            updateItem(item.id, "amount", parseFloat(e.target.value) || 0)
                          }
                        />
                      </div>
                      <div className="review-row-bottom">
                        <select
                          className="review-select"
                          value={item.category}
                          onChange={(e) => updateItem(item.id, "category", e.target.value)}
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <input
                          type="date"
                          className="review-input date-input"
                          value={item.date}
                          onChange={(e) => updateItem(item.id, "date", e.target.value)}
                        />
                        {item.confidence > 0 && (
                          <span
                            className={`confidence-badge ${
                              item.confidence >= 70 ? "high" : item.confidence >= 40 ? "mid" : "low"
                            }`}
                          >
                            {item.confidence}% match
                          </span>
                        )}
                        <button
                          className="remove-item-btn"
                          onClick={() => removeItem(item.id)}
                        >
                          ✕
                        </button>
                      </div>
                      {item.rawName && item.rawName !== item.item && (
                        <span className="raw-text-hint">
                          Original: &quot;{item.rawName}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="review-actions">
                <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
                  {saving ? "Saving..." : `Save ${items.filter((i) => i.selected).length} Items`}
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Start Over
                </button>
              </div>
            </>
          )}

          {rawText && items.length > 0 && (
            <details className="raw-text-section">
              <summary>View raw OCR text</summary>
              <pre className="raw-text-content">{rawText}</pre>
            </details>
          )}
        </div>
      )}

      {/* DONE */}
      {step === "done" && (
        <div className="done-area">
          <div className="done-icon">✅</div>
          <p className="done-title">All expenses saved!</p>
          <button className="btn btn-primary" onClick={reset}>
            Add More
          </button>
        </div>
      )}
    </div>
  );
}