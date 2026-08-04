import Fuse from "fuse.js";
import itemDictionary from "./itemDictionary";

const fuse = new Fuse(itemDictionary, {
  keys: ["name"],
  threshold: 0.4,
  includeScore: true,
});

// Step 1: Fix common OCR character mistakes
export function fixOcrErrors(text) {
  let fixed = text;

  // Common OCR substitutions
  const replacements = [
    [/[|!]/g, "l"],       // | or ! → l
    [/\{/g, "("],
    [/\}/g, ")"],
    [/`/g, "'"],
    [/~/g, "-"],
    [/\u00a0/g, " "],     // non-breaking space → space
  ];

  replacements.forEach(([pattern, replacement]) => {
    fixed = fixed.replace(pattern, replacement);
  });

  // Fix prices: O or o next to numbers likely means 0
  fixed = fixed.replace(/(\d)[Oo](\d)/g, "$10$2");
  fixed = fixed.replace(/[Oo](\d{1,2}[.,]\d{2})/g, "0$1");

  // Fix S mistaken for $ at start of price
  fixed = fixed.replace(/S(\d{1,3}[.,]\d{2})/g, "€$1");

  return fixed;
}

// Step 2: Extract lines that look like "item + price"
export function extractItems(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  const items = [];

  for (const line of lines) {
    // Look for a price pattern at the end of the line
    // Matches: 4.99, 12.50, 0,99, 12,50, €4.99, EUR 4.99
    const priceMatch = line.match(
      /[€$£]?\s*(\d{1,4}[.,]\d{2})\s*[€$£]?\s*$/
    );

    if (priceMatch) {
      // Everything before the price is the item name
      const priceStr = priceMatch[1].replace(",", ".");
      const price = parseFloat(priceStr);

      // Get item name by removing the price part
      let itemName = line
        .substring(0, line.lastIndexOf(priceMatch[0]))
        .trim();

      // Clean up item name
      itemName = itemName
        .replace(/^[\d#*\-·•]+\s*/, "")  // remove leading numbers/bullets
        .replace(/[_=]+/g, "")             // remove underscores/equals
        .replace(/\s{2,}/g, " ")           // collapse multiple spaces
        .trim();

      // Skip if item name is too short or is just numbers
      if (itemName.length < 2 || /^\d+$/.test(itemName)) continue;

      // Skip likely non-item lines
      const skipWords = [
        "total", "subtotal", "sub-total", "tax", "vat",
        "change", "cash", "card", "visa", "mastercard",
        "thank", "receipt", "invoice", "date", "time",
        "balance", "payment", "discount", "savings",
        "member", "points", "reward",
      ];
      if (skipWords.some((w) => itemName.toLowerCase().includes(w))) continue;

      // Skip unreasonable prices
      if (price <= 0 || price > 9999) continue;

      items.push({
        rawName: itemName,
        amount: price,
      });
    }
  }

  return items;
}

// Step 3: Match items to dictionary and assign categories
export function categorizeItems(items) {
  return items.map((item) => {
    const result = fuse.search(item.rawName);

    if (result.length > 0 && result[0].score < 0.4) {
      // Good match found
      return {
        item: result[0].item.name,
        amount: item.amount,
        category: result[0].item.category,
        confidence: Math.round((1 - result[0].score) * 100),
        rawName: item.rawName,
      };
    } else {
      // No match — use raw name, try keyword-based category
      return {
        item: cleanItemName(item.rawName),
        amount: item.amount,
        category: guessCategoryByKeywords(item.rawName),
        confidence: 0,
        rawName: item.rawName,
      };
    }
  });
}

// Clean up an item name for display
function cleanItemName(name) {
  return name
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// Fallback keyword-based categorization
function guessCategoryByKeywords(name) {
  const lower = name.toLowerCase();

  const keywordMap = {
    "Food & Groceries": [
      "fruit", "veg", "meat", "dairy", "organic", "fresh", "frozen",
      "drink", "bake", "snack", "deli", "produce", "grain", "spice",
      "food", "eat", "cook",
    ],
    "Shopping": [
      "cloth", "shirt", "pant", "shoe", "bag", "clean", "wash",
      "tissue", "paper", "hygiene", "beauty", "cosmetic",
    ],
    "Transport": [
      "fuel", "gas", "petrol", "diesel", "park", "toll", "taxi",
      "uber", "lyft", "bus", "train", "metro", "transit",
    ],
    "Health": [
      "pharm", "med", "drug", "health", "doctor", "clinic",
      "hospital", "vitamin", "supplement",
    ],
    "Entertainment": [
      "movie", "cinema", "game", "stream", "music", "ticket",
      "play", "show", "concert", "sport",
    ],
    "Utilities": [
      "electric", "water", "gas", "internet", "wifi", "phone",
      "mobile", "cable", "bill",
    ],
    "Rent & Housing": [
      "rent", "mortgage", "lease", "repair", "plumb", "paint",
      "furniture", "appliance",
    ],
  };

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category;
    }
  }

  return "Other";
}

// Main function: process raw OCR text into categorized items
export function processReceiptText(rawText) {
  const fixedText = fixOcrErrors(rawText);
  const rawItems = extractItems(fixedText);
  const categorized = categorizeItems(rawItems);
  return categorized;
}