import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

let ortConfigured = false;

/**
 * Configure ONNX Runtime once, just before the first inference call.
 *
 * Dynamically imports onnxruntime-web to avoid triggering Vite's dep-
 * optimisation at module-parse time (which causes a mid-session reload and
 * corrupts React's dispatcher).
 *
 * Object.defineProperty locks proxy=true so imgly's internal line
 *   `ort.env.wasm.proxy = false`  (runs when WebGPU is unavailable)
 * cannot clobber it.  ONNX Runtime then moves WASM execution into a
 * sub-worker, keeping the main thread free to dispatch touch events.
 *
 * numThreads=1 prevents a silent crash on iOS Safari / WKWebView, which
 * has no SharedArrayBuffer and therefore cannot support WASM multithreading.
 */
async function configureOrt(): Promise<void> {
  if (ortConfigured) return;
  ortConfigured = true;

  try {
    // Dynamic import — never runs at module initialisation time.
    const ort = await import("onnxruntime-web");
    const wasmEnv = (ort as any).env?.wasm;
    if (!wasmEnv) return;

    // Lock proxy to true so imgly cannot set it back to false.
    try {
      Object.defineProperty(wasmEnv, "proxy", {
        get: () => true,
        set: () => { /* locked */ },
        configurable: true,
      });
    } catch {
      // Already non-configurable — write directly and hope for the best.
      wasmEnv.proxy = true;
    }

    try { wasmEnv.numThreads = 1; } catch { /* ignore */ }
  } catch {
    // onnxruntime-web unavailable — inference will run on main thread.
  }
}

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with transparent background.
 * On first ever call downloads ~15 MB ONNX model from imgly CDN (cached after that).
 * Throws on network error or unreadable image — callers should catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  await configureOrt();
  const sourceBlob = await dataUrlToBlob(dataUrl);
  const resultBlob = await imglyRemoveBackground(sourceBlob, {
    model: "isnet_fp16", // valid: "isnet" | "isnet_fp16" | "isnet_quint8" — NOT "small"/"medium"
    output: { format: "image/png", quality: 0.9 },
    // publicPath omitted → uses imgly CDN automatically
  });
  return blobToDataUrl(resultBlob);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
