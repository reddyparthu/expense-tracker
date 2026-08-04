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

// Parse pasted text from ChatGPT or similar
function parsePastedList(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  const items = [];

  for (const line of lines) {
    // Try many common formats:
    // "Milk - €2.50" or "Milk - 2.50"
    // "Milk: €2.50" or "Milk: 2.50"
    // "Milk €2.50" or "Milk 2.50"
    // "1. Milk - €2.50"
    // "- Milk €2.50"
    // "Milk | €2.50"
    // "Milk — 2.50"
    // "Milk -> 2.50"
    // "Milk .... 2.50"
    // "Milk (€2.50)"
    // "Milk  2.50 EUR"

    // Remove leading bullets, numbers, dashes
    let cleaned = line.replace(/^[\d]+[.):\-]\s*/, "");
    cleaned = cleaned.replace(/^[-•*·→►]\s*/, "");
    cleaned = cleaned.trim();

    if (!cleaned) continue;

    // Skip header-like lines
    const skipWords = [
      "total", "subtotal", "grand total", "tax", "vat",
      "item", "description", "price", "amount", "quantity",
      "here is", "here are", "list of", "expenses:",
      "---", "===",
    ];
    if (skipWords.some((w) => cleaned.toLowerCase().includes(w) && cleaned.length < 40)) continue;

    // Try to find a price in the line
    // Match: €2.50, $2.50, £2.50, 2.50€, 2,50, 2.50 EUR, (2.50), etc.
    const pricePatterns = [
      // €2.50 or $ 2.50 or £2,50
      /[€$£]\s*(\d{1,5}[.,]\d{1,2})/,
      // 2.50€ or 2,50 EUR
      /(\d{1,5}[.,]\d{1,2})\s*[€$£]?\s*(?:EUR|USD|GBP|eur)?/i,
      // (2.50) in parentheses
      /\((?:[€$£])?\s*(\d{1,5}[.,]\d{1,2})\s*(?:[€$£])?\)/,
    ];

    let price = null;
    let priceMatch = null;
    let matchStr = "";

    for (const pattern of pricePatterns) {
      const m = cleaned.match(pattern);
      if (m) {
        const p = parseFloat(m[1].replace(",", "."));
        if (p > 0 && p < 99999) {
          price = p;
          priceMatch = m;
          matchStr = m[0];
          break;
        }
      }
    }

    if (price === null) continue;

    // Get item name by removing the price part and separators
    let itemName = cleaned.replace(matchStr, "");
    // Remove common separators
    itemName = itemName.replace(/[-–—:|>→►\.]{2,}\s*$/, "");
    itemName = itemName.replace(/^\s*[-–—:|>→►\.]{2,}/, "");
    itemName = itemName.replace(/[-–—:|>→►]\s*$/, "");
    itemName = itemName.replace(/^\s*[-–—:|>→►]/, "");
    itemName = itemName.replace(/\(\s*\)/, "");
    itemName = itemName.replace(/\s{2,}/g, " ");
    itemName = itemName.trim();

    if (itemName.length < 1) continue;

    // Capitalize first letter of each word
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

// Categorize pasted items using keyword matching
function categorizePastedItems(items) {
  // Import fuse dynamically would be complex, so use simple keyword matching
  const keywordMap = {
    "Food & Groceries": [
      "milk", "bread", "rice", "egg", "chicken", "meat", "fish", "butter",
      "cheese", "yogurt", "apple", "banana", "orange", "tomato", "potato",
      "onion", "garlic", "carrot", "lettuce", "pasta", "noodle", "cereal",
      "flour", "sugar", "salt", "oil", "coffee", "tea", "juice", "water",
      "soda", "beer", "wine", "chips", "cookie", "chocolate", "ice cream",
      "frozen", "canned", "soup", "sauce", "sausage", "bacon", "ham",
      "shrimp", "tofu", "mushroom", "avocado", "lemon", "grape", "strawberry",
      "mango", "corn", "peas", "beans", "lentil", "nuts", "almond", "cream",
      "honey", "jam", "ketchup", "mustard", "mayo", "vinegar", "pepper",
      "spice", "herb", "fruit", "vegetable", "veggie", "snack", "drink",
      "grocery", "food", "biscuit", "cracker", "cake", "pie", "pizza",
      "sandwich", "wrap", "salad", "deli", "produce", "dairy", "bakery",
      "cucumber", "spinach", "broccoli", "oat", "peanut", "tuna", "salmon",
      "turkey", "beef", "pork", "lamb",
    ],
    "Shopping": [
      "soap", "shampoo", "conditioner", "toothpaste", "toothbrush",
      "deodorant", "detergent", "dish soap", "sponge", "trash bag",
      "bleach", "cleaner", "tissue", "toilet paper", "paper towel",
      "battery", "light bulb", "candle", "cloth", "shirt", "pant",
      "shoe", "bag", "cosmetic", "beauty",
    ],
    "Transport": [
      "petrol", "gasoline", "diesel", "fuel", "bus", "train", "metro",
      "taxi", "uber", "lyft", "parking", "toll", "fare", "transit",
    ],
    "Utilities": [
      "electricity", "water bill", "gas bill", "internet", "wifi",
      "phone bill", "mobile", "recharge", "broadband", "cable",
    ],
    "Entertainment": [
      "netflix", "spotify", "cinema", "movie", "concert", "game",
      "playstation", "xbox", "disney", "youtube", "subscription",
      "ticket", "stream",
    ],
    "Health": [
      "medicine", "pharmacy", "doctor", "dentist", "hospital",
      "vitamin", "paracetamol", "ibuprofen", "bandage", "prescription",
      "insurance", "gym", "health", "clinic",
    ],
    "Rent & Housing": [
      "rent", "mortgage", "property", "home insurance", "repair",
      "maintenance", "furniture", "plumber", "electrician",
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

    return {
      ...item,
      category,
      confidence: category !== "Other" ? 80 : 0,
    };
  });
}

// Fix rotation only
async function fixRotation(file) {
  return new Promise(async (resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    let orientation = 1;
    try {
      const exifr = (await import("exifr")).default;
      const exifData = await exifr.parse(file, { pick: ["Orientation"] });
      if (exifData?.Orientation) orientation = exifData.Orientation;
    } catch (e) {}

    if (orientation === 1) {
      resolve({ blob: file, previewUrl: url });
      return;
    }

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

      canvas.toBlob((blob) => {
        const previewUrl = canvas.toDataURL("image/png");
        URL.revokeObjectURL(url);
        resolve({ blob, previewUrl });
      }, "image/png", 1.0);
    };
    img.src = url;
  });
}

export default function BillScanner({ onExpenseAdded }) {
  const [mode, setMode] = useState("choose"); // choose, scan, paste
  const [step, setStep] = useState("upload");
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [items, setItems] = useState([]);
  const [rawText, setRawText] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const fileRef = useRef(null);
  const cameraRef = useRef(null);

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { blob, previewUrl } = await fixRotation(file);
      setImageBlob(blob);
      setImagePreview(previewUrl);
      setStep("ready");
    } catch (err) {
      const url = URL.createObjectURL(file);
      setImageBlob(file);
      setImagePreview(url);
      setStep("ready");
    }
  };

  const handleScan = async () => {
    if (!imageBlob) return;
    setStep("scanning");
    setProgress(0);
    setProgressText("Loading OCR engine...");

    try {
      const Tesseract = (await import("tesseract.js")).default;
      const result = await Tesseract.recognize(imageBlob, "eng", {
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
      finishExtraction(extracted);
    } catch (err) {
      setMessage("Failed to read the image. Try a clearer photo.");
      setStep("upload");
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
    setImageBlob(null);
    setItems([]);
    setRawText("");
    setPasteText("");
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
                onChange={(e) => { setMode("scan"); handleImageSelect(e); }}
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
                onChange={(e) => { setMode("scan"); handleImageSelect(e); }}
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
              <li>For paste: any format works — &quot;Milk - €2.50&quot; or &quot;Milk 2.50&quot;</li>
            </ul>
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
                  ? "Could not find items with prices. Make sure each line has an item name and a number."
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