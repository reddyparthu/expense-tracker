import Fuse from "fuse.js";
import itemDictionary from "./itemDictionary";

const fuse = new Fuse(itemDictionary, {
  keys: ["name"],
  threshold: 0.4,
  includeScore: true,
});

// ============================================================
// INTELLIGENT RECEIPT PARSER
// ============================================================
// Strategy:
// 1. Split text into lines
// 2. Find ANY number that looks like a price on each line
// 3. Everything else on that line is the item name
// 4. If a line has no price, check if the NEXT line is just a price
// 5. Filter out non-item lines (totals, headers, footers)
// 6. Categorize using fuzzy matching + keywords
// ============================================================

// All the words that indicate a line is NOT an item
const SKIP_PATTERNS = [
  // Totals and subtotals
  /\btotal\b/i, /\bsub\s*total\b/i, /\bgrand\s*total\b/i,
  /\bnet\s*amount\b/i, /\bamount\s*due\b/i, /\bamount\s*paid\b/i,
  /\bbalance\s*due\b/i,

  // Tax
  /\btax\b/i, /\bvat\b/i, /\bgst\b/i, /\bhst\b/i, /\bpst\b/i,
  /\btax\s*rate\b/i, /\btaxable\b/i, /\bsales\s*tax\b/i,

  // Payment info
  /\bcash\b/i, /\bcard\b/i, /\bvisa\b/i, /\bmastercard\b/i,
  /\bdebit\b/i, /\bcredit\b/i, /\bpayment\b/i, /\btendered\b/i,
  /\bchange\s*due\b/i, /\bchange\b.*\d/i,

  // Receipt metadata
  /\breceipt\b/i, /\binvoice\b/i, /\btransaction\b/i,
  /\bcashier\b/i, /\bregister\b/i, /\bterminal\b/i,
  /\bstore\b/i, /\bbranch\b/i,

  // Date/time patterns
  /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/,
  /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i,

  // Contact info
  /\btel\b/i, /\bphone\b/i, /\bfax\b/i, /\bwww\b/i, /\bhttp\b/i,
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,

  // Thank you messages
  /\bthank\b/i, /\bwelcome\b/i, /\bvisit\s*again\b/i,

  // Rewards/loyalty
  /\bmember\b/i, /\bpoints\b/i, /\breward\b/i, /\bloyalty\b/i,
  /\bsaving\b/i, /\bdiscount\b/i, /\bcoupon\b/i,

  // Headers
  /\bqty\b/i, /\bdescription\b/i, /\bprice\b/i, /\bunit\b/i,
  /\b(item|article)\s*#/i,

  // Decorative lines
  /^[-=*_+.#]{3,}$/, /^[*]{3,}$/, /^\s*$/,

  // Refund/return
  /\brefund\b/i, /\breturn\b/i, /\bexchange\b/i,
  /\brounding\b/i,
];

function shouldSkipLine(line) {
  const trimmed = line.trim();

  // Too short
  if (trimmed.length < 3) return true;

  // Mostly non-letters (likely garbage)
  const letters = (trimmed.match(/[a-zA-Z]/g) || []).length;
  if (letters < 2) return true;

  // Check against skip patterns
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

// Find a price anywhere in the line — very flexible
function findPrice(line) {
  // Remove common currency symbols for easier matching
  const cleaned = line.replace(/[€$£]/g, " ").replace(/\s+/g, " ").trim();

  // Try to find prices — ordered from most specific to least
  const pricePatterns = [
    // Standard decimal prices: 12.99, 4.50, 0.99, 123.45
    /(\d{1,4})[.,](\d{2})\b/g,
    // Prices with currency after: 12.99EUR, 4,50 eur
    /(\d{1,4})[.,](\d{2})\s*(?:EUR|USD|GBP|eur|usd|gbp)/gi,
  ];

  const prices = [];

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const whole = match[1];
      const decimal = match[2];
      const value = parseFloat(`${whole}.${decimal}`);

      // Skip unreasonable prices
      if (value <= 0 || value > 9999) continue;

      // Skip things that look like dates (12.05.2024) or times (14:30)
      const charBefore = line[match.index - 1];
      const charAfter = line[match.index + match[0].length];
      if (charAfter === '.' || charAfter === '/' || charAfter === '-') continue;
      if (charBefore === '.' || charBefore === '/' || charBefore === ':') continue;

      prices.push({
        value,
        matchStr: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
  }

  if (prices.length === 0) return null;

  // Return the LAST price on the line (usually the item total, not quantity)
  return prices[prices.length - 1];
}

// Extract item name from a line after removing the price
function extractItemName(line, price) {
  let name;

  if (price) {
    // Remove the price from the line
    name = line.substring(0, price.index) + line.substring(price.index + price.length);
  } else {
    name = line;
  }

  // Clean up
  name = name
    .replace(/[€$£]/g, "")              // Remove currency symbols
    .replace(/^\s*[\d]+[\s).\-:]+/, "")  // Remove leading numbers (like "1." or "2)")
    .replace(/^\s*[-•*·×x]\s*/i, "")     // Remove bullets
    .replace(/\b\d+\s*[xX×]\s*/g, "")   // Remove quantity (2x, 3 X)
    .replace(/\b[xX×]\s*\d+/g, "")      // Remove quantity (x2, X3)
    .replace(/\b\d+\s*(kg|g|lb|oz|ml|l|pcs?|ea|ct)\b/gi, "") // Remove weight/quantity units
    .replace(/@\s*[\d.,]+/g, "")         // Remove unit prices (@2.99)
    .replace(/[_=+*#]+/g, "")            // Remove decorative chars
    .replace(/[-–—]{2,}/g, "")           // Remove long dashes
    .replace(/\.{2,}/g, "")              // Remove dot leaders (....)
    .replace(/[,.:;|]+$/, "")            // Remove trailing punctuation
    .replace(/^[,.:;|\-]+/, "")          // Remove leading punctuation
    .replace(/\s{2,}/g, " ")            // Collapse spaces
    .trim();

  return name;
}

// Capitalize properly
function formatName(name) {
  if (!name) return "";
  return name
    .split(" ")
    .map((word) => {
      if (word.length <= 2) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

// Categorize using fuzzy matching + keywords
function categorize(itemName) {
  // Try fuzzy match on full name
  const result = fuse.search(itemName);
  let bestMatch = null;
  let bestScore = 1;

  if (result.length > 0 && result[0].score < 0.4) {
    bestMatch = result[0];
    bestScore = result[0].score;
  }

  // Also try each word individually
  const words = itemName.split(/\s+/);
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
      matchedName: bestMatch.item.name,
      category: bestMatch.item.category,
      confidence: Math.round((1 - bestScore) * 100),
    };
  }

  // Fallback: keyword-based categorization
  const lower = itemName.toLowerCase();

  const keywordMap = {
    "Food & Groceries": [
      "milk", "bread", "rice", "egg", "chicken", "meat", "fish", "butter",
      "cheese", "yogurt", "yoghurt", "apple", "banana", "orange", "tomato",
      "potato", "onion", "garlic", "carrot", "lettuce", "pasta", "noodle",
      "cereal", "flour", "sugar", "salt", "oil", "coffee", "tea", "juice",
      "water", "soda", "cola", "beer", "wine", "chips", "cookie", "biscuit",
      "chocolate", "ice cream", "frozen", "soup", "sauce", "sausage", "bacon",
      "ham", "shrimp", "prawn", "tofu", "mushroom", "avocado", "lemon",
      "grape", "strawberry", "mango", "corn", "peas", "beans", "lentil",
      "nuts", "almond", "cream", "honey", "jam", "ketchup", "mustard",
      "mayo", "vinegar", "pepper", "spice", "herb", "fruit", "vegetable",
      "snack", "drink", "grocery", "food", "pizza", "sandwich", "salad",
      "dairy", "bakery", "salmon", "tuna", "beef", "pork", "lamb", "turkey",
      "cucumber", "spinach", "broccoli", "oat", "peanut", "wrap", "roll",
      "bun", "cake", "pie", "pastry", "muesli", "spread", "crackers",
      "crisp", "sweet", "candy", "fanta", "sprite", "pepsi", "organic",
      "bio", "fresh", "deli", "produce", "grain", "mince", "fillet",
      "steak", "chick", "pork", "lamb",
    ],
    "Shopping": [
      "soap", "shampoo", "conditioner", "toothpaste", "toothbrush",
      "deodorant", "detergent", "dish", "sponge", "trash bag",
      "bleach", "cleaner", "tissue", "toilet paper", "paper towel",
      "battery", "light bulb", "candle", "cloth", "shirt", "pant",
      "shoe", "bag", "cosmetic", "beauty", "wipe", "softener",
    ],
    "Transport": [
      "petrol", "gasoline", "diesel", "fuel", "bus", "train", "metro",
      "taxi", "uber", "lyft", "parking", "toll", "fare", "transit",
    ],
    "Utilities": [
      "electricity", "water bill", "internet", "wifi", "phone bill",
      "mobile", "recharge", "broadband", "cable",
    ],
    "Entertainment": [
      "netflix", "spotify", "cinema", "movie", "concert", "game",
      "playstation", "xbox", "disney", "youtube", "subscription", "ticket",
    ],
    "Health": [
      "medicine", "pharmacy", "doctor", "dentist", "hospital",
      "vitamin", "gym", "health", "clinic", "tablet", "capsule",
    ],
    "Rent & Housing": [
      "rent", "mortgage", "repair", "maintenance", "furniture",
      "plumber", "electrician",
    ],
  };

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return {
        matchedName: null,
        category,
        confidence: 50,
      };
    }
  }

  return { matchedName: null, category: "Other", confidence: 0 };
}

// ============================================================
// MAIN PARSER
// ============================================================
export function processReceiptText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText.split("\n").map((l) => l.trim());
  const items = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip empty or non-item lines
    if (shouldSkipLine(line)) continue;

    // Try to find a price on this line
    let price = findPrice(line);

    // If no price on this line, check if next line is just a price
    if (!price && i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim();
      // Next line is ONLY a price (no other text)
      if (/^\s*[€$£]?\s*\d{1,4}[.,]\d{2}\s*[€$£]?\s*$/.test(nextLine)) {
        price = findPrice(nextLine);
        if (price) {
          // Use current line as name, next line's price
          const name = extractItemName(line, null);
          if (name.length >= 2) {
            const cat = categorize(name);
            items.push({
              item: cat.matchedName || formatName(name),
              amount: price.value,
              category: cat.category,
              confidence: cat.confidence,
              rawName: name,
            });
          }
          i++; // Skip the next line since we used it
          continue;
        }
      }
    }

    if (!price) continue;

    // Extract item name
    const name = extractItemName(line, price);

    // Skip if name is too short or empty
    if (name.length < 2) continue;

    // Categorize
    const cat = categorize(name);

    items.push({
      item: cat.matchedName || formatName(name),
      amount: price.value,
      category: cat.category,
      confidence: cat.confidence,
      rawName: name,
    });
  }

  // Deduplicate — same item name and price
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.item.toLowerCase()}-${item.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  return unique;
}

// Keep backward compatibility
export function fixOcrErrors(text) { return text; }
export function extractItems(text) { return []; }
export function categorizeItems(items) { return items; }