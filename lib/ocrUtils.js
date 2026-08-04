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

  const replacements = [
    [/[|!]/g, "l"],
    [/\{/g, "("],
    [/\}/g, ")"],
    [/`/g, "'"],
    [/~/g, "-"],
    [/\u00a0/g, " "],
  ];

  replacements.forEach(([pattern, replacement]) => {
    fixed = fixed.replace(pattern, replacement);
  });

  // Fix prices: O or o next to numbers likely means 0
  fixed = fixed.replace(/(\d)[Oo](\d)/g, "$10$2");
  fixed = fixed.replace(/[Oo](\d{1,2}[.,]\d{2})/g, "0$1");

  // Fix S mistaken for $ or €
  fixed = fixed.replace(/S(\d{1,3}[.,]\d{2})/g, "€$1");

  // Fix common letter/number swaps
  fixed = fixed.replace(/(\d)l(\d)/g, "$11$2"); // l between digits → 1
  fixed = fixed.replace(/(\d)I(\d)/g, "$11$2"); // I between digits → 1
  fixed = fixed.replace(/(\d)B(\d)/g, "$18$2"); // B between digits → 8

  return fixed;
}

// Step 2: Extract lines that look like "item + price"
export function extractItems(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 1);
  const items = [];

  for (const line of lines) {
    // Try multiple price patterns

    // Pattern 1: Price at end of line (most common)
    // Matches: 4.99, 12.50, 0,99, 12,50, €4.99, $ 4.99, EUR 4.99
    let priceMatch = line.match(
      /[€$£]?\s*(\d{1,4}[.,]\d{1,2})\s*[€$£A-Z]?\s*$/
    );

    // Pattern 2: Price with spaces between (e.g., "Rice  4 . 99" or "Milk 2. 50")
    if (!priceMatch) {
      priceMatch = line.match(
        /[€$£]?\s*(\d{1,4})\s*[.,]\s*(\d{1,2})\s*$/
      );
      if (priceMatch && priceMatch[2]) {
        // Reconstruct the price
        priceMatch[1] = priceMatch[1] + "." + priceMatch[2];
      }
    }

    // Pattern 3: Price with currency after (e.g., "4.99 EUR" or "4,99€")
    if (!priceMatch) {
      priceMatch = line.match(
        /(\d{1,4}[.,]\d{1,2})\s*(?:EUR|€|\$|£|eur)\s*$/i
      );
    }

    // Pattern 4: Just a number at the end that could be a price (e.g., "Milk 250")
    // Only match if it looks like a reasonable price (has decimal or is small)
    if (!priceMatch) {
      priceMatch = line.match(
        /[€$£]\s*(\d{1,3})\s*$/
      );
    }

    if (priceMatch) {
      const priceStr = priceMatch[1].replace(",", ".");
      const price = parseFloat(priceStr);

      // Get item name by removing the price part
      let itemName = line
        .substring(0, line.lastIndexOf(priceMatch[0]))
        .trim();

      // Clean up item name
      itemName = itemName
        .replace(/^[\d#*\-·•x×]+\s*/i, "")   // remove leading numbers/bullets/quantity markers
        .replace(/[_=]+/g, "")                  // remove underscores/equals
        .replace(/\s{2,}/g, " ")                // collapse multiple spaces
        .replace(/^[,.\-:;]+/, "")              // remove leading punctuation
        .replace(/[,.\-:;]+$/, "")              // remove trailing punctuation
        .trim();

      // Skip if item name is too short or is just numbers
      if (itemName.length < 2 || /^\d+$/.test(itemName)) continue;

      // Skip likely non-item lines (expanded list)
      const skipWords = [
        "total", "subtotal", "sub-total", "sub total", "tax", "vat",
        "change", "cash", "card", "visa", "mastercard", "debit", "credit",
        "thank", "receipt", "invoice", "date", "time", "tel", "phone",
        "balance", "payment", "discount", "savings", "save",
        "member", "points", "reward", "loyalty",
        "store", "branch", "address", "www", "http",
        "cashier", "register", "terminal", "transaction",
        "refund", "return", "exchange",
        "subtot", "grand total", "amount due", "amount paid",
        "change due", "tendered", "rounding",
        "gst", "hst", "pst", "tax rate",
        "item", "qty", "price", "description",
        "-----", "=====", "*****",
      ];

      const lowerName = itemName.toLowerCase();
      if (skipWords.some((w) => lowerName.includes(w))) continue;

      // Skip lines that are mostly numbers or special characters
      const letterCount = (itemName.match(/[a-zA-Z]/g) || []).length;
      if (letterCount < 2) continue;

      // Skip unreasonable prices
      if (price <= 0 || price > 9999) continue;

      items.push({
        rawName: itemName,
        amount: Math.round(price * 100) / 100,
      });
    }
  }

  return items;
}

// Step 3: Match items to dictionary and assign categories
export function categorizeItems(items) {
  return items.map((item) => {
    // Try exact-ish match first with fuzzy search
    const result = fuse.search(item.rawName);

    // Also try individual words for multi-word items
    const words = item.rawName.split(/\s+/);
    let bestMatch = null;
    let bestScore = 1;

    if (result.length > 0 && result[0].score < 0.4) {
      bestMatch = result[0];
      bestScore = result[0].score;
    }

    // Try matching individual words too
    for (const word of words) {
      if (word.length < 3) continue;
      const wordResult = fuse.search(word);
      if (wordResult.length > 0 && wordResult[0].score < bestScore) {
        bestMatch = wordResult[0];
        bestScore = wordResult[0].score;
      }
    }

    if (bestMatch && bestScore < 0.4) {
      return {
        item: bestMatch.item.name,
        amount: item.amount,
        category: bestMatch.item.category,
        confidence: Math.round((1 - bestScore) * 100),
        rawName: item.rawName,
      };
    } else {
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

function cleanItemName(name) {
  return name
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function guessCategoryByKeywords(name) {
  const lower = name.toLowerCase();

  const keywordMap = {
    "Food & Groceries": [
      "fruit", "veg", "meat", "dairy", "organic", "fresh", "frozen",
      "drink", "bake", "snack", "deli", "produce", "grain", "spice",
      "food", "eat", "cook", "bio", "farm", "market", "grocer",
      "chick", "pork", "lamb", "steak", "fillet", "mince",
      "yoghurt", "cream", "spread", "cereal", "muesli",
      "biscuit", "cracker", "crisp", "sweet", "candy",
      "juice", "cola", "fanta", "sprite", "pepsi",
      "wrap", "roll", "bun", "cake", "pie", "pastry",
    ],
    "Shopping": [
      "cloth", "shirt", "pant", "shoe", "bag", "clean", "wash",
      "tissue", "paper", "hygiene", "beauty", "cosmetic",
      "detergent", "softener", "bleach", "wipe",
    ],
    "Transport": [
      "fuel", "gas", "petrol", "diesel", "park", "toll", "taxi",
      "uber", "lyft", "bus", "train", "metro", "transit", "fare",
    ],
    "Health": [
      "pharm", "med", "drug", "health", "doctor", "clinic",
      "hospital", "vitamin", "supplement", "tablet", "capsule",
    ],
    "Entertainment": [
      "movie", "cinema", "game", "stream", "music", "ticket",
      "play", "show", "concert", "sport", "gym",
    ],
    "Utilities": [
      "electric", "water", "gas bill", "internet", "wifi", "phone",
      "mobile", "cable", "bill", "broadband",
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