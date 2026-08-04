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

async function preprocessImage(file) {
  return new Promise(async (resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    let orientation = 1;
    try {
      const exifr = (await import("exifr")).default;
      const exifData = await exifr.parse(file, { pick: ["Orientation"] });
      if (exifData?.Orientation) {
        orientation = exifData.Orientation;
      }
    } catch (e) {}

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      let width = img.width;
      let height = img.height;

      if (orientation >= 5 && orientation <= 8) {
        canvas.width = height;
        canvas.height = width;
      } else {
        canvas.width = width;
        canvas.height = height;
      }

      const maxDim = 2000;
      const scale = Math.min(1, maxDim / Math.max(canvas.width, canvas.height));
      if (scale < 1) {
        canvas.width = Math.round(canvas.width * scale);
        canvas.height = Math.round(canvas.height * scale);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      ctx.save();
      switch (orientation) {
        case 2: ctx.transform(-1, 0, 0, 1, canvas.width, 0); break;
        case 3: ctx.transform(-1, 0, 0, -1, canvas.width, canvas.height); break;
        case 4: ctx.transform(1, 0, 0, -1, 0, canvas.height); break;
        case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
        case 6: ctx.transform(0, 1, -1, 0, canvas.width, 0); break;
        case 7: ctx.transform(0, -1, -1, 0, canvas.width, canvas.height); break;
        case 8: ctx.transform(0, -1, 1, 0, 0, canvas.height); break;
        default: break;
      }
      ctx.drawImage(img, 0, 0, width, height);
      ctx.restore();

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      const contrast = 60;
      const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, factor * (data[i] - 128) + 128));
        data[i + 1] = Math.min(255, Math.max(0, factor * (data[i + 1] - 128) + 128));
        data[i + 2] = Math.min(255, Math.max(0, factor * (data[i + 2] - 128) + 128));
      }

      const threshold = 140;
      for (let i = 0; i < data.length; i += 4) {
        const val = data[i] > threshold ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob((blob) => {
        const processedUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url);
        resolve({ blob, processedUrl, originalUrl: url });
      }, "image/png", 1.0);
    };

    img.src = url;
  });
}

export default function BillScanner({ onExpenseAdded }) {
  const [step, setStep] = useState("upload");
  const [imagePreview, setImagePreview] = useState(null);
  const [processedPreview, setProcessedPreview] = useState(null);
  const [processedBlob, setProcessedBlob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [items, setItems] = useState([]);
  const [rawText, setRawText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const originalUrl = URL.createObjectURL(file);
    setImagePreview(originalUrl);
    setProgressText("Enhancing image for scanning...");
    setStep("processing");

    try {
      const { blob, processedUrl } = await preprocessImage(file);
      setProcessedBlob(blob);
      setProcessedPreview(processedUrl);
      setStep("ready");
    } catch (err) {
      const response = await fetch(originalUrl);
      const blob = await response.blob();
      setProcessedBlob(blob);
      setProcessedPreview(originalUrl);
      setStep("ready");
    }
  };

  const handleScan = async () => {
    if (!processedBlob) return;
    setStep("scanning");
    setProgress(0);
    setProgressText("Loading OCR engine...");

    try {
      const Tesseract = (await import("tesseract.js")).default;

      const result = await Tesseract.recognize(processedBlob, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
            if (m.progress < 0.3) setProgressText("Scanning lines...");
            else if (m.progress < 0.6) setProgressText("Detecting prices...");
            else if (m.progress < 0.9) setProgressText("Almost there...");
            else setProgressText("Finishing up...");
          } else if (m.status === "loading tesseract core") {
            setProgressText("Loading OCR engine...");
          } else if (m.status === "initializing tesseract") {
            setProgressText("Initializing...");
          } else if (m.status === "loading language traineddata") {
            setProgressText("Loading language data...");
          }
        },
      });

      const fullText = result.data.text;
      setRawText(fullText);
      const extracted = processReceiptText(fullText);

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
    } catch (err) {
      setMessage("Failed to read the image. Try a clearer photo with good lighting.");
      setStep("upload");
    }
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
    setImagePreview(null);
    setProcessedPreview(null);
    setProcessedBlob(null);
    setItems([]);
    setRawText("");
    setMessage("");
    setProgress(0);
    setProgressText("");
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

      {step === "upload" && (
        <div className="upload-area">
          <div className="upload-options">
            <div className="dropzone" onClick={() => fileRef.current?.click()}>
              <div className="dropzone-icon">🖼️</div>
              <p className="dropzone-title">Choose from Gallery</p>
              <p className="dropzone-subtitle">Pick a photo of your bill or receipt</p>
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
              <p className="dropzone-title">Take a Photo</p>
              <p className="dropzone-subtitle">Use your camera to snap the bill</p>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
            </div>
          </div>
          <div className="scan-tips">
            <p className="tips-title">Tips for best results:</p>
            <ul className="tips-list">
              <li>Use good lighting — avoid shadows on the bill</li>
              <li>Keep the bill flat and fully visible</li>
              <li>Avoid blurry or tilted photos</li>
              <li>Printed receipts work better than handwritten ones</li>
            </ul>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="scanning-area">
          <div className="scan-animation">
            <div className="scan-icon">⚙️</div>
            <p className="scan-status">{progressText}</p>
          </div>
        </div>
      )}

      {step === "ready" && (
        <div className="upload-area">
          <div className="image-preview-container">
            <div className="preview-compare">
              <div className="preview-box">
                <span className="preview-label">Original</span>
                <img src={imagePreview} alt="Original" className="image-preview" />
              </div>
              <div className="preview-box">
                <span className="preview-label">Enhanced for OCR</span>
                <img src={processedPreview} alt="Processed" className="image-preview" />
              </div>
            </div>
            <div className="preview-actions">
              <button className="btn btn-primary" onClick={handleScan}>
                Scan This Bill
              </button>
              <button className="btn btn-ghost" onClick={reset}>
                Choose Different Image
              </button>
            </div>
          </div>
        </div>
      )}

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

      {step === "review" && (
        <div className="review-area">
          {items.length === 0 ? (
            <div className="no-items-found">
              <p className="no-items-title">No items detected</p>
              <p className="no-items-subtitle">
                The image might be blurry or in an unsupported format.
                Try a clearer photo with better lighting, or add items manually.
              </p>
              {rawText && (
                <details className="raw-text-section" style={{ marginBottom: "16px" }}>
                  <summary>View what OCR detected</summary>
                  <pre className="raw-text-content">{rawText}</pre>
                </details>
              )}
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
                <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
                  {saving ? "Saving..." : `Save ${items.filter((i) => i.selected).length} Items`}
                </button>
                <button className="btn btn-ghost" onClick={reset}>
                  Scan Another
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