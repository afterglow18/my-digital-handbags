---
name: ONNX main-thread block on iOS
description: Why imgly background-removal freezes all JS events on iOS Safari/WKWebView, and the correct fix.
---

## The problem
`@imgly/background-removal` runs ONNX Runtime Web inference **on the main JavaScript thread** by default.  
While inference runs, the entire JS event loop is frozen — no React state updates, no touch/click events, no button handlers fire.  
This is why "Save" and "Cancel" appear unresponsive while the Processing spinner is showing.

## Root cause chain
1. imgly internally runs: `ort.env.wasm.proxy = proxyToWorker` where `proxyToWorker = useWebGPU && config.proxyToWorker`.
2. WebGPU is not available in WKWebView → `useWebGPU = false` → `proxyToWorker = false`.
3. So imgly always sets `ort.env.wasm.proxy = false`, keeping inference on the main thread.

## The fix (`src/lib/backgroundRemoval.ts`)
- **Dynamic import** `onnxruntime-web` — a static top-level import triggers Vite dep-optimisation mid-session, which causes a full page reload and corrupts React's `dispatcher`, throwing `"null is not an object (evaluating 'dispatcher.useEffect')"`.
- **`Object.defineProperty`** to lock `ort.env.wasm.proxy = true` with a no-op setter, so imgly's subsequent `ort.env.wasm.proxy = false` is silently ignored.
- **`numThreads = 1`** — iOS Safari has no SharedArrayBuffer, so WASM multithreading is unavailable; leaving numThreads > 1 causes a silent crash.

**Why:** Any future change to the background-removal call MUST keep these three settings, and must keep the onnxruntime-web import dynamic.
