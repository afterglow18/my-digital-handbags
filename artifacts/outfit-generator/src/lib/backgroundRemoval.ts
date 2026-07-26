import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — onnxruntime-web types.d.ts exists but isn't exposed via package "exports"
import * as ort from "onnxruntime-web";

let ortConfigured = false;

/**
 * Configure ONNX Runtime once, before any inference runs.
 *
 * proxy = true  → WASM execution moves to a dedicated sub-worker so the
 *                 main JS thread stays free to handle button taps, React
 *                 renders, etc. while the model is running.
 *
 * numThreads = 1 → iOS Safari / WKWebView lacks SharedArrayBuffer support
 *                  needed for WASM multi-threading; 1 thread avoids the
 *                  crash/silent failure.
 */
function configureOrt() {
  if (ortConfigured) return;
  ortConfigured = true;

  // imgly internally runs: ort.env.wasm.proxy = false  (when WebGPU is off)
  // That line clobbers a simple assignment, so we lock the property with a
  // getter/setter that always returns true and silently drops any write of false.
  // This keeps WASM execution in a sub-worker so the main thread stays free
  // to dispatch touch events while inference runs.
  try {
    Object.defineProperty((ort as any).env.wasm, "proxy", {
      get: () => true,
      set: () => { /* locked — always proxy */ },
      configurable: true,
    });
  } catch {
    // If the property is already non-configurable, fall back to a plain write.
    (ort as any).env.wasm.proxy = true;
  }

  // iOS Safari / WKWebView has no SharedArrayBuffer → WASM multithreading
  // is unavailable; force single-threaded to prevent a silent crash.
  try { (ort as any).env.wasm.numThreads = 1; } catch { /* ignore */ }
}

/**
 * Remove the background from a JPEG/PNG base64 data-URL.
 * Returns a PNG data-URL with transparent background.
 * On first ever call downloads ~15 MB ONNX model from imgly CDN (cached after that).
 * Throws on network error or unreadable image — callers should catch and fall back.
 */
export async function removeBackground(dataUrl: string): Promise<string> {
  configureOrt();
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
