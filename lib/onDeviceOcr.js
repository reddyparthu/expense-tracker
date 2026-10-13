// Client-side helper around the OCR web worker.
// recognizeImage(file) -> { lines: [{ text, x, y, width, height, confidence }] }

let worker = null;
let seq = 0;
const pending = new Map();

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./ocr.worker.js", import.meta.url), { type: "module" });
  worker.onmessage = (e) => {
    const { id, ...rest } = e.data || {};
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (rest.ok) p.resolve(rest);
    else p.reject(new Error(rest.error || "OCR failed"));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || "OCR worker crashed"));
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function call(message, transfer = [], timeoutMs = 90000) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("OCR timed out"));
    }, timeoutMs);
    pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    });
    getWorker().postMessage({ id, ...message }, transfer);
  });
}

// Start downloading/initialising the models early (e.g. when the Scan tab opens)
export function warmupOcr() {
  if (typeof Worker === "undefined") return Promise.resolve();
  return call({ type: "warmup" }).catch(() => {});
}

// Merge the words of each OCR line into one line with a combined box
function mergeLine(words) {
  const x = Math.min(...words.map((w) => w.box.x));
  const y = Math.min(...words.map((w) => w.box.y));
  const right = Math.max(...words.map((w) => w.box.x + w.box.width));
  const bottom = Math.max(...words.map((w) => w.box.y + w.box.height));
  return {
    text: words.map((w) => w.text).join(" ").replace(/\s{2,}/g, " ").trim(),
    words: words.map((w) => ({ text: w.text, x: w.box.x, width: w.box.width })),
    x,
    y,
    width: right - x,
    height: bottom - y,
    confidence: words.reduce((s, w) => s + w.confidence, 0) / words.length,
  };
}

export async function recognizeImage(file) {
  const buffer = await file.arrayBuffer();
  const result = await call({ type: "recognize", image: buffer }, [buffer]);
  const lines = result.lines.filter((l) => l.length).map(mergeLine).filter((l) => l.text);
  return { lines, confidence: result.confidence };
}
