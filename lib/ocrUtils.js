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

// Words that should NEVER become food/shopping items
// Even if fuzzy matching thinks "total" → "potato"
const BLACKLISTED_WORDS = [
  "total", "subtotal", "totaal", "totale", "gesamt", "summe",
  "montant", "amount", "balance", "change", "payment", "paid",
  "cash", "card", "visa", "mastercard", "debit", "credit",
  "tax", "vat", "gst", "hst", "pst", "mwst", "iva", "tva",
  "discount", "saving", "coupon", "reward", "points", "loyalty",
  "receipt", "invoice", "transaction", "terminal", "register",
  "cashier", "server", "store", "branch", "date", "time",
  "thank", "welcome", "visit", "refund", "return", "exchange",
  "rounding", "tendered", "eftpos", "contactless", "paypass",
  "authorized", "approved", "declined",
  "subtot", "netto", "brutto", "rabatt", "menge", "preis",
  "price", "qty", "quantity", "description", "item", "article",
];

// Collapse spaced-out letters: "T O T A L" → "TOTAL", "S U B T O T A L" → "SUBTOTAL"
function collapseSpacedLetters(line) {
  // Match sequences of single characters separated by spaces
  // e.g., "T O T A L" or "S U B T O T A L"
  return line.replace(
    /\b([A-Za-z])\s+([A-Za-z])\s+([A-Za-z])(\s+[A-Za-z])*\b/g,
    (match) => {
      // Only collapse if most characters are single letters with spaces
      const letters = match.replace(/\s+/g, "");
      // Must be at least 3 characters and the original had spaces between them
      if (letters.length >= 3) {
        return letters;
      }
      return match;
    }
  );
}

// Pre-process line: collapse spaced letters, normalize whitespace
function preprocessLine(line) {
  let processed = line;

  // Collapse spaced-out letters first
  processed = collapseSpacedLetters(processed);

  // Normalize multiple spaces
  processed = processed.replace(/\s{2,}/g, " ").trim();

  return processed;
}

// Check if a word is blacklisted (should never be an item)
function isBlacklisted(name) {
  const lower = name.toLowerCase().replace(/\s+/g, "");
  return BLACKLISTED_WORDS.some((bw) => {
    const bwClean = bw.replace(/\s+/g, "");
    // Exact match or the name is basically just this word
    return lower === bwClean || lower.includes(bwClean);
  });
}

// All the patterns that indicate a line is NOT an item
const SKIP_PATTERNS = [
  // Totals — catches normal AND spaced versions after collapsing
  /\btotal\b/i, /\bsub\s*-?\s*total\b/i, /\bgrand\s*total\b/i,
  /\bnet\s*amount\b/i, /\bamount\s*due\b/i, /\bamount\s*paid\b/i,
  /\bbalance\s*due\b/i, /\bbalance\b/i,
  /\btot[a4]l\b/i, /\bttl\b/i,
  /\btotaal\b/i, /\bgesamt\b/i, /\bsumme\b/i,
  /\btotale\b/i, /\bmontant\b/i,
  /\bto\s*pay\b/i, /\byou\s*paid\b/i, /\bamount\b/i,
  /\bdue\b/i, /\bowed\b/i, /\bsubt\b/i,
  /\bitems?\s*\d+/i, /\b\d+\s*items?\b/i,
  /\bnr\s*of\s*items\b/i, /\bnum(ber)?\s*of\s*items\b/i,

  // Spaced-out total patterns BEFORE collapsing (backup)
  /t\s+o\s+t\s+a\s+l/i,
  /s\s+u\s+b\s+t\s+o\s+t\s+a\s+l/i,
  /g\s+r\s+a\s+n\s+d/i,
  /b\s+a\s+l\s+a\s+n\s+c\s+e/i,
  /c\s+h\s+a\s+n\s+g\s+e/i,
  /a\s+m\s+o\s+u\s+n\s+t/i,

  // Tax
  /\btax\b/i, /\bvat\b/i, /\bgst\b/i, /\bhst\b/i, /\bpst\b/i,
  /\btax\s*rate\b/i, /\btaxable\b/i, /\bsales\s*tax\b/i,
  /\bmwst\b/i, /\biva\b/i, /\btva\b/i,
  /\btax\s*incl/i, /\bincl\s*tax/i,
  /v\s+a\s+t/i, /t\s+a\s+x/i,

  // Payment
  /\bcash\b/i, /\bcard\b/i, /\bvisa\b/i, /\bmastercard\b/i,
  /\bdebit\b/i, /\bcredit\b/i, /\bpayment\b/i, /\btendered\b/i,
  /\bchange\s*due\b/i, /\bchange\b.*\d/i,
  /\beft\b/i, /\beftpos\b/i, /\bpaypass\b/i,
  /\bcontactless\b/i, /\bapple\s*pay\b/i, /\bgoogle\s*pay\b/i,
  /\bpin\s*verified\b/i, /\bauthori[sz]/i,
  /\bpaid\b/i,

  // Receipt metadata
  /\breceipt\b/i, /\binvoice\b/i, /\btransaction\b/i,
  /\bcashier\b/i, /\bregister\b/i, /\bterminal\b/i,
  /\bstore\b/i, /\bbranch\b/i, /\bserver\b/i,
  /\border\s*#/i, /\breceipt\s*#/i, /\btrans\s*#/i,
  /\bcheck\s*#/i, /\btable\s*#/i,
  /\bseq\b/i, /\bref\b/i, /\bauth\s*code\b/i,

  // Date/time
  /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/,
  /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i,

  // Contact
  /\btel\b/i, /\bphone\b/i, /\bfax\b/i, /\bwww\b/i, /\bhttp\b/i,
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/,

  // Thank you
  /\bthank\b/i, /\bwelcome\b/i, /\bvisit\s*again\b/i,

  // Rewards
  /\bmember\b/i, /\bpoints\b/i, /\breward\b/i, /\bloyalty\b/i,
  /\bsaving\b/i, /\bdiscount\b/i, /\bcoupon\b/i,

  // Headers
  /\bqty\b/i, /\bdescription\b/i, /\bprice\b/i, /\bunit\b/i,
  /\b(item|article)\s*#/i,

  // Decorative
  /^[-=*_+.#]{3,}$/, /^[*]{3,}$/, /^\s*$/,

  // Refund
  /\brefund\b/i, /\breturn\b/i, /\bexchange\b/i,
  /\brounding\b/i,
];

function shouldSkipLine(originalLine, processedLine) {
  // Check BOTH the original (catches "T O T A L") and processed (catches "TOTAL")
  for (const line of [originalLine, processedLine]) {
    const trimmed = line.trim();
    if (trimmed.length < 3) continue;

    for (const pattern of SKIP_PATTERNS) {
      if (pattern.test(trimmed)) return true;
    }
  }

  // Also check collapsed version without any spaces
  const noSpaces = originalLine.replace(/\s+/g, "").toLowerCase();
  const totalWords = ["total", "subtotal", "grandtotal", "balance", "amount",
    "payment", "change", "discount", "taxamt", "vatamt"];
  if (totalWords.some((w) => noSpaces.includes(w))) return true;

  // Check if the line has too few real letters
  const letters = (processedLine.match(/[a-zA-Z]/g) || []).length;
  if (letters < 2) return true;

  return false;
}

// Find a price anywhere in the line
function findPrice(line) {
  const pricePatterns = [
    /(\d{1,4})[.,](\d{2})\b/g,
    /(\d{1,4})[.,](\d{2})\s*(?:EUR|USD|GBP|eur|usd|gbp)/gi,
  ];

  const prices = [];

  for (const pattern of pricePatterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const whole = match[1];
      const decimal = match[2];
      const value = parseFloat(`${whole}.${decimal}`);

      if (value <= 0 || value > 9999) continue;

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
  return prices[prices.length - 1];
}

// Extract item name from a line after removing the price
function extractItemName(line, price) {
  let name;

  if (price) {
    name = line.substring(0, price.index) + line.substring(price.index + price.length);
  } else {
    name = line;
  }

  name = name
    .replace(/[€$£]/g, "")
    .replace(/^\s*[\d]+[\s).\-:]+/, "")
    .replace(/^\s*[-•*·×x]\s*/i, "")
    .replace(/\b\d+\s*[xX×]\s*/g, "")
    .replace(/\b[xX×]\s*\d+/g, "")
    .replace(/\b\d+\s*(kg|g|lb|oz|ml|l|pcs?|ea|ct)\b/gi, "")
    .replace(/@\s*[\d.,]+/g, "")
    .replace(/[_=+*#]+/g, "")
    .replace(/[-–—]{2,}/g, "")
    .replace(/\.{2,}/g, "")
    .replace(/[,.:;|]+$/, "")
    .replace(/^[,.:;|\-]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return name;
}

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

// Categorize — but BLOCK blacklisted words from getting matched
function categorize(itemName) {
  // FIRST: check if this name is blacklisted
  if (isBlacklisted(itemName)) {
    return { matchedName: null, category: "__SKIP__", confidence: 0 };
  }

  // Try fuzzy match on full name
  const result = fuse.search(itemName);
  let bestMatch = null;
  let bestScore = 1;

  if (result.length > 0 && result[0].score < 0.4) {
    // VERIFY the match isn't nonsensical
    // e.g., "TOTAL" matching "Potato" — check edit distance ratio
    const inputLower = itemName.toLowerCase().replace(/\s+/g, "");
    const matchLower = result[0].item.name.toLowerCase().replace(/\s+/g, "");

    // If input is a blacklisted word that somehow got here, skip
    if (!isBlacklisted(inputLower)) {
      bestMatch = result[0];
      bestScore = result[0].score;
    }
  }

  // Also try each word individually
  const words = itemName.split(/\s+/);
  for (const word of words) {
    if (word.length < 3) continue;
    if (isBlacklisted(word)) continue; // Don't match blacklisted words

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

  // Fallback: keyword categorization
  const lower = itemName.toLowerCase();

  const keywordMap = {
    "Food & Groceries": [
      "milk", "bread", "rice", "egg", "chicken", "meat", "fish", "butter",
      "cheese", "yogurt", "yoghurt", "apple", "banana", "orange", "tomato",
      "potato", "onion", "garlic", "carrot", "lettuce", "pasta", "noodle",
      "cereal", "flour", "sugar", "salt", "oil", "coffee", "tea", "juice",
      "water", "soda", "cola", "beer", "wine", "chips", "cookie", "biscuit",
      "chocolate", "frozen", "soup", "sauce", "sausage", "bacon", "ham",
      "shrimp", "prawn", "tofu", "mushroom", "avocado", "lemon", "grape",
      "strawberry", "mango", "corn", "peas", "beans", "lentil", "nuts",
      "almond", "cream", "honey", "jam", "ketchup", "mustard", "mayo",
      "vinegar", "pepper", "spice", "herb", "fruit", "vegetable", "snack",
      "drink", "grocery", "food", "pizza", "sandwich", "salad", "dairy",
      "bakery", "salmon", "tuna", "beef", "pork", "lamb", "turkey",
      "cucumber", "spinach", "broccoli", "oat", "peanut", "wrap", "roll",
      "bun", "cake", "pie", "pastry", "muesli", "spread", "crackers",
      "organic", "bio", "fresh", "deli", "produce", "grain", "mince",
      "fillet", "steak",
    ],
    "Shopping": [
      "soap", "shampoo", "toothpaste", "deodorant", "detergent",
      "tissue", "toilet paper", "battery", "cloth", "shirt", "shoe",
      "bag", "cosmetic", "beauty", "cleaner", "wipe", "softener",
    ],
    "Transport": [
      "petrol", "gasoline", "diesel", "fuel", "bus", "train", "metro",
      "taxi", "uber", "parking", "toll", "fare",
    ],
    "Utilities": [
      "electricity", "internet", "wifi", "phone bill", "mobile",
      "recharge", "broadband",
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

  for (const [category, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return { matchedName: null, category, confidence: 50 };
    }
  }

  return { matchedName: null, category: "Other", confidence: 0 };
}

// ============================================================
// MAIN PARSER
// ============================================================
export function processReceiptText(rawText) {
  if (!rawText || !rawText.trim()) return [];

  const rawLines = rawText.split("\n").map((l) => l.trim());
  const items = [];

  for (let i = 0; i < rawLines.length; i++) {
    const originalLine = rawLines[i];

    // Pre-process: collapse "T O T A L" → "TOTAL" etc.
    const line = preprocessLine(originalLine);

    // Skip check uses BOTH original and processed versions
    if (shouldSkipLine(originalLine, line)) continue;

    // Try to find a price on this line
    let price = findPrice(line);

    // If no price, check next line
    if (!price && i + 1 < rawLines.length) {
      const nextLine = rawLines[i + 1].trim();
      if (/^\s*[€$£]?\s*\d{1,4}[.,]\d{2}\s*[€$£]?\s*$/.test(nextLine)) {
        price = findPrice(nextLine);
        if (price) {
          const name = extractItemName(line, null);
          if (name.length >= 2 && !isBlacklisted(name)) {
            const cat = categorize(name);
            if (cat.category !== "__SKIP__") {
              items.push({
                item: cat.matchedName || formatName(name),
                amount: price.value,
                category: cat.category,
                confidence: cat.confidence,
                rawName: name,
              });
            }
          }
          i++;
          continue;
        }
      }
    }

    if (!price) continue;

    // Extract item name
    const name = extractItemName(line, price);
    if (name.length < 2) continue;

    // Check blacklist BEFORE categorizing
    if (isBlacklisted(name)) continue;

    // Categorize
    const cat = categorize(name);
    if (cat.category === "__SKIP__") continue;

    items.push({
      item: cat.matchedName || formatName(name),
      amount: price.value,
      category: cat.category,
      confidence: cat.confidence,
      rawName: name,
    });
  }

  // Deduplicate
  const unique = [];
  const seen = new Set();
  for (const item of items) {
    const key = `${item.item.toLowerCase()}-${item.amount}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }

  // Post-processing: remove items whose price equals sum of others (hidden totals)
  if (unique.length > 2) {
    const allAmounts = unique.map((item) => item.amount);
    const totalSum = allAmounts.reduce((sum, a) => sum + a, 0);

    const filtered = unique.filter((item) => {
      // This item's price equals sum of all others = it's a total
      const sumWithout = totalSum - item.amount;
      const diff = Math.abs(item.amount - sumWithout);
      if (diff < 0.05) return false;

      // Suspiciously large (>60% of total with 4+ items)
      if (unique.length >= 4 && item.amount > totalSum * 0.6) return false;

      return true;
    });

    if (filtered.length >= unique.length - 2 && filtered.length > 0) {
      return filtered;
    }
  }

  return unique;
}

// Backward compatibility
export function fixOcrErrors(text) { return text; }
export function extractItems(text) { return []; }
export function categorizeItems(items) { return items; }