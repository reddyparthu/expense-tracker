// Runs PaddleOCR (via ONNX Runtime Web) off the main thread so the UI stays smooth.
// Models (~6 MB) are fetched once and then served from the browser's HTTP cache.
import { PaddleOcrService } from "ppu-paddle-ocr/web";

let service = null;
let ready = null;

function init() {
  if (!ready) {
    service = new PaddleOcrService();
    ready = service.initialize();
  }
  return ready;
}

self.onmessage = async (event) => {
  const { id, type, image } = event.data || {};
  try {
    await init();
    if (type === "warmup") {
      self.postMessage({ id, ok: true });
      return;
    }
    const result = await service.recognize(image, { noCache: true });
    // Keep only plain data: one entry per line, words left-to-right with boxes
    const lines = (result.lines || []).map((words) =>
      words.map((w) => ({
        text: w.text,
        confidence: w.confidence,
        box: { x: w.box.x, y: w.box.y, width: w.box.width, height: w.box.height },
      }))
    );
    self.postMessage({ id, ok: true, lines, confidence: result.confidence });
  } catch (err) {
    ready = null; // allow a retry after a failed model download
    self.postMessage({ id, ok: false, error: String(err?.message || err) });
  }
};
