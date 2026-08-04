"use client";
import { useState, useRef } from "react";
import { processReceiptText } from "@/lib/ocrUtils";

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

export default function BillScanner({ onExpenseAdded }) {
  const [step, setStep] = useState("upload"); // upload, scanning, review, done
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [items, setItems] = useState([]);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImage(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    if (!image) return;

    setStep("scanning");
    setProgress(0);

    try {
      // Dynamic import to keep bundle small
      const Tesseract = (await import("tesseract.js")).default;

      const result = await Tesseract.recognize(image, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      setRawText(result.data.text);
      const extracted = processReceiptText(result.data.text);

      if (extracted.length === 0) {
        setItems([]);
        setStep("review");
        return;
      }

      // Add date and unique IDs
      const today = new Date().toISOString().split("T")[0];
      const withMeta = extracted.map((item, i) => ({
        ...item,
        id: Date.now() + i,
        date: today,
        selected: true,
      }));

      setItems(withMeta);
      setStep("review");
    } catch (err) {
      console.error("OCR Error:", err);
      setMessage("Failed to read the image. Try a clearer photo.");
      setStep("upload");
    }
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const toggleItem = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
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
      setMessage("No items to save. Check your selections.");
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
      setMessage("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep("upload");
    setImage(null);
    setImagePreview(null);
    setItems([]);
    setRawText("");
    setMessage("");
    setProgress(0);
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

      {/* STEP 1: Upload */}
      {step === "upload" && (
        <div className="upload-area">
          {imagePreview ? (
            <div className="image-preview-container">
              <img src={imagePreview} alt="Bill preview" className="image-preview" />
              <div className="preview-actions">
                <button className="btn btn-primary" onClick={handleScan}>
                  Scan This Bill
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Choose Different Image
                </button>
              </div>
            </div>
          ) : (
            <div
              className="dropzone"
              onClick={() => fileRef.current?.click()}
            >
              <div className="dropzone-icon">📸</div>
              <p className="dropzone-title">Upload your bill or receipt</p>
              <p className="dropzone-subtitle">
                Click to choose a photo. Works best with clear, well-lit images.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Scanning */}
      {step === "scanning" && (
        <div className="scanning-area">
          <div className="scan-animation">
            <div className="scan-icon">🔍</div>
            <p className="scan-status">Reading your bill...</p>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="progress-text">{progress}% complete</p>
        </div>
      )}

      {/* STEP 3: Review */}
      {step === "review" && (
        <div className="review-area">
          {items.length === 0 ? (
            <div className="no-items-found">
              <p className="no-items-title">No items detected</p>
              <p className="no-items-subtitle">
                The image might be blurry or in an unsupported format.
                You can add items manually or try a different photo.
              </p>
              <div className="no-items-actions">
                <button className="btn btn-primary" onClick={addManualItem}>
                  Add Manually
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Try Again
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
                          onChange={(e) =>
                            updateItem(item.id, "item", e.target.value)
                          }
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
                          onChange={(e) =>
                            updateItem(item.id, "category", e.target.value)
                          }
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>

                        <input
                          type="date"
                          className="review-input date-input"
                          value={item.date}
                          onChange={(e) =>
                            updateItem(item.id, "date", e.target.value)
                          }
                        />

                        {item.confidence > 0 && (
                          <span
                            className={`confidence-badge ${
                              item.confidence >= 70
                                ? "high"
                                : item.confidence >= 40
                                ? "mid"
                                : "low"
                            }`}
                          >
                            {item.confidence}% match
                          </span>
                        )}

                        <button
                          className="remove-item-btn"
                          onClick={() => removeItem(item.id)}
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>

                      {item.rawName && item.rawName !== item.item && (
                        <span className="raw-text-hint">
                          OCR read: &quot;{item.rawName}&quot;
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="review-actions">
                <button
                  className="btn btn-primary"
                  onClick={saveAll}
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : `Save ${items.filter((i) => i.selected).length} Items`}
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Scan Another
                </button>
              </div>
            </>
          )}

          {/* Raw OCR text toggle */}
          {rawText && (
            <details className="raw-text-section">
              <summary>View raw OCR text</summary>
              <pre className="raw-text-content">{rawText}</pre>
            </details>
          )}
        </div>
      )}

      {/* STEP 4: Done */}
      {step === "done" && (
        <div className="done-area">
          <div className="done-icon">✅</div>
          <p className="done-title">All expenses saved!</p>
          <button className="btn btn-primary" onClick={reset}>
            Scan Another Bill
          </button>
        </div>
      )}
    </div>
  );
}