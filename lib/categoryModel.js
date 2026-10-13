// Learns which words belong to which category from the user's own saved
// expenses (a small multinomial Naive Bayes classifier, trained in the browser
// in milliseconds), and combines it with the user's remembered corrections,
// the built-in product dictionary and the store's usual category.
import Fuse from "fuse.js";
import itemDictionary from "./itemDictionary";

// ---------- text → tokens ----------
const STOP = new Set(["de", "het", "een", "en", "van", "der", "die", "das", "the", "and", "of", "x", "st", "stk", "kg", "gr", "ml", "ltr", "pcs"]);

export function normalizeKey(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function tokens(text) {
  const words = normalizeKey(text)
    .toLowerCase()
    .split(" ")
    .filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !STOP.has(w));
  const out = [];
  for (const w of words) {
    out.push(w);
    // Prefixes make abbreviations match ("halfv" ~ "halfvolle", "choc" ~ "chocolade")
    if (w.length > 4) out.push(`p:${w.slice(0, 4)}`);
  }
  return out;
}

// ---------- Naive Bayes ----------
const ALPHA = 0.2; // light smoothing: one sighting of a word should already count

export function trainModel(examples) {
  const classCount = {};
  const tokenCount = {}; // category -> token -> n
  const totalTokens = {};
  const vocab = new Set();
  let docs = 0;

  // Collapse repeats ("Lidl groceries" saved 40×) so they don't drown out rarer words
  const merged = new Map();
  for (const ex of examples) {
    if (!ex.text || !ex.category) continue;
    const k = `${normalizeKey(ex.text)}|${ex.category}`;
    const prev = merged.get(k);
    merged.set(k, { ...ex, weight: (prev?.weight || 0) + (ex.weight || 1) });
  }

  for (const ex of merged.values()) {
    const { text, category } = ex;
    const weight = Math.min(ex.weight, 3);
    if (!text || !category) continue;
    const toks = tokens(text);
    if (!toks.length) continue;
    docs += weight;
    classCount[category] = (classCount[category] || 0) + weight;
    tokenCount[category] = tokenCount[category] || {};
    for (const t of toks) {
      tokenCount[category][t] = (tokenCount[category][t] || 0) + weight;
      totalTokens[category] = (totalTokens[category] || 0) + weight;
      vocab.add(t);
    }
  }
  return { classCount, tokenCount, totalTokens, vocab, docs };
}

// Returns { category, probability } or null when the model has never seen these words
export function predictModel(model, text) {
  if (!model || !model.docs) return null;
  const toks = tokens(text).filter((t) => model.vocab.has(t));
  if (!toks.length) return null;
  const V = model.vocab.size;
  const scores = {};
  for (const c of Object.keys(model.classCount)) {
    let s = Math.log(model.classCount[c] / model.docs);
    for (const t of toks) {
      s += Math.log(((model.tokenCount[c][t] || 0) + ALPHA) / (model.totalTokens[c] + ALPHA * V));
    }
    scores[c] = s;
  }
  const max = Math.max(...Object.values(scores));
  const exp = Object.fromEntries(Object.entries(scores).map(([c, s]) => [c, Math.exp(s - max)]));
  const z = Object.values(exp).reduce((a, b) => a + b, 0);
  const [category, e] = Object.entries(exp).sort((a, b) => b[1] - a[1])[0];
  return { category, probability: e / z };
}

// ---------- fallbacks ----------
const dictionaryFuse = new Fuse(itemDictionary, { keys: ["name"], threshold: 0.25, includeScore: true });

const KEYWORDS = {
  "Food & Groceries": ["melk", "milk", "milch", "brood", "bread", "brot", "kaas", "cheese", "kase", "boter", "butter", "ei", "eier", "eggs", "egg", "appel", "apfel", "apple", "banaan", "banan", "tomaat", "tomat", "aardappel", "kartoffel", "potato", "kip", "chicken", "huhn", "vlees", "fleisch", "meat", "vis", "fisch", "fish", "rijst", "reis", "rice", "pasta", "koffie", "kaffee", "coffee", "thee", "tee", "tea", "sap", "saft", "juice", "water", "wasser", "cola", "bier", "beer", "wijn", "wein", "wine", "yoghurt", "joghurt", "kwark", "quark", "chips", "koek", "keks", "cookie", "chocola", "schoko", "groente", "gemuse", "fruit", "obst", "salade", "salat", "pizza", "soep", "suppe", "saus", "sosse", "worst", "wurst", "ham", "brezel", "croissant", "broodje", "sandwich", "latte", "cappuccino", "espresso", "flat white", "bio", "vers", "frisch"],
  Shopping: ["shampoo", "zeep", "seife", "soap", "tandpasta", "zahnpasta", "toothpaste", "deo", "wasmiddel", "waschmittel", "detergent", "toiletpapier", "toilettenpapier", "batterij", "batterie", "battery", "shirt", "broek", "hose", "schoen", "schuh", "shoe", "tas", "tasche", "bag", "card", "kaart", "karte", "cadeau", "gift", "geschenk"],
  Transport: ["benzine", "benzin", "diesel", "euro95", "e10", "fuel", "petrol", "parkeren", "parken", "parking", "ov", "bus", "trein", "zug", "train", "tram", "metro", "taxi", "uber", "tol", "maut"],
  Utilities: ["stroom", "strom", "electricity", "gas", "internet", "wifi", "telefoon", "handy", "mobile", "simkaart", "prepaid", "opwaarderen"],
  Entertainment: ["netflix", "spotify", "bioscoop", "kino", "cinema", "movie", "film", "concert", "ticket", "game", "spel", "spiel", "disney"],
  Health: ["paracetamol", "ibuprofen", "medicijn", "medikament", "medicine", "vitamine", "vitamin", "pleister", "pflaster", "apotheek", "apotheke", "pharmacy", "tandarts", "dentist", "zahnarzt", "huisarts", "doctor", "arzt", "gym", "sportschool", "fitness"],
  "Rent & Housing": ["huur", "miete", "rent", "hypotheek", "mortgage", "meubel", "mobel", "furniture", "verf", "farbe", "paint", "schroef", "schraube", "lamp"],
};

function keywordCategory(text) {
  const toks = tokens(text).filter((t) => !t.startsWith("p:"));
  const low = normalizeKey(text).toLowerCase();
  // Whole word, or a word that starts with the keyword ("bananen" ← "banan", "tomaten" ← "tomat")
  const hit = (w) =>
    w.includes(" ") ? low.includes(w) : toks.some((t) => t === w || (w.length >= 4 && t.startsWith(w)));
  for (const [cat, words] of Object.entries(KEYWORDS)) {
    if (words.some(hit)) return cat;
  }
  return null;
}

// ---------- corrections ----------
export function buildCorrectionIndex(corrections) {
  const byKey = new Map(corrections.map((c) => [c.key, c]));
  const fuse = new Fuse(corrections, { keys: ["key"], threshold: 0.3, includeScore: true });
  return {
    size: corrections.length,
    // Exact match, or a near match that tolerates an OCR misread letter or two
    find(raw) {
      const key = normalizeKey(raw);
      if (!key) return null;
      if (byKey.has(key)) return byKey.get(key);
      if (key.length < 6 || !corrections.length) return null;
      const hit = fuse.search(key)[0];
      if (!hit) return null;
      const lenOk = Math.abs(hit.item.key.length - key.length) <= 2;
      const limit = key.length >= 10 ? 0.3 : 0.2;
      return lenOk && hit.score < limit ? hit.item : null;
    },
  };
}

// ---------- public API ----------
// Training examples from saved expenses: the expense name, and every item stored inside a receipt
export function examplesFromExpenses(expenses, corrections = []) {
  const out = [];
  for (const e of expenses) {
    if (e.item && e.category) out.push({ text: e.item, category: e.category });
    for (const it of e.items || []) {
      if (it.name && it.category) out.push({ text: it.name, category: it.category });
    }
  }
  // Explicit corrections count extra
  for (const c of corrections) {
    if (c.category && c.name) out.push({ text: c.name, category: c.category, weight: 3 });
    if (c.category && c.raw) out.push({ text: c.raw, category: c.category, weight: 3 });
  }
  return out;
}

export function createCategorizer({ expenses = [], corrections = [] } = {}) {
  const model = trainModel(examplesFromExpenses(expenses, corrections));
  const memory = buildCorrectionIndex(corrections);

  return {
    trainedOn: model.docs,
    memory,
    // → { name, category, confidence (0-100), source, remembered }
    categorize(rawName, { merchantCategory = null } = {}) {
      const remembered = memory.find(rawName);
      if (remembered) {
        return {
          name: remembered.name || null,
          category: remembered.category || "Other",
          confidence: 99,
          source: "memory",
          remembered: true,
        };
      }

      const learned = predictModel(model, rawName);
      if (learned && learned.probability >= 0.6) {
        return { name: null, category: learned.category, confidence: Math.round(learned.probability * 100), source: "history" };
      }

      const kw = keywordCategory(rawName);
      if (kw) return { name: null, category: kw, confidence: 70, source: "keywords" };

      const dict = normalizeKey(rawName).length >= 4 ? dictionaryFuse.search(rawName)[0] : null;
      if (dict && dict.score < 0.25) {
        return { name: null, category: dict.item.category, confidence: Math.round((1 - dict.score) * 80), source: "dictionary" };
      }

      if (learned && learned.probability >= 0.4) {
        return { name: null, category: learned.category, confidence: Math.round(learned.probability * 100), source: "history" };
      }
      if (merchantCategory) return { name: null, category: merchantCategory, confidence: 55, source: "store" };
      return { name: null, category: "Other", confidence: 0, source: "none" };
    },
    // Category for a whole receipt when it's saved as a single expense
    categorizeStore(merchantName, merchantCategory) {
      if (merchantName) {
        const learned = predictModel(model, merchantName);
        if (learned && learned.probability >= 0.6) return learned.category;
      }
      return merchantCategory || null;
    },
  };
}
