/**
 * QuickAddSheet
 *
 * Upload flow (any number of photos):
 *   pick ──(files chosen)──► encoding ──► preview (Original | Cleaned ✨) ──► [next photo OR close]
 *
 * Multiple photos are processed sequentially — each one gets its own comparison
 * screen. "Save & Next" saves the current selection and moves to the next photo.
 * The final photo shows "✓ Save" and closes the sheet.
 *
 * Background removal runs on-device via @imgly/background-removal.
 * First call downloads ~15 MB ONNX model from imgly CDN (cached thereafter).
 *
 * IMPORTANT: Phase blocks use plain conditional divs — NOT AnimatePresence.
 * Any AnimatePresence wrapper creates exit-animation windows where no child
 * is mounted, causing a blank screen between every phase change.
 */
import React, { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import { useCreateClothingItem, getListClothingQueryKey } from "@/hooks/useLocalWardrobe";
import type { ClothingItem } from "@/types/local";
import { useQueryClient } from "@tanstack/react-query";
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Types ──────────────────────────────────────────────────────────────────────

type Category = "totes" | "shoulder-bags" | "crossbody-bags" | "clutches-wristlets";

const CATEGORY_LABELS: Record<Category, string> = {
  "totes":              "Totes",
  "shoulder-bags":      "Shoulder Bags",
  "crossbody-bags":     "Crossbody Bags",
  "clutches-wristlets": "Clutches + Wristlets",
};

type Phase = "pick" | "encoding" | "preview" | "uploading";

// ── encodeForUpload (outside component — no closure deps) ─────────────────────

async function encodeForUpload(input: File | Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(input);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const MAX = 2048;
      const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth  * scale);
      const h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (b) => (b && b.size > 1000 ? resolve(b) : reject(new Error("blank image"))),
        "image/jpeg",
        0.85,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };
    img.src = objectUrl;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onOpenChange:  (open: boolean) => void;
  category:      Category;
  existingCount: number;
  onCreated?:    (item: ClothingItem) => void;
}

const PHOTO_TIPS = [
  "Photograph a single handbag or a complete outfit.",
  "Lay everything flat on a plain background.",
  "Take the photo from directly above.",
  "Keep all items fully in frame.",
] as const;

export function QuickAddSheet({ open, onOpenChange, category, existingCount, onCreated }: Props) {
  // ── Per-photo comparison state ────────────────────────────────────────────────
  const [phase,        setPhase]        = useState<Phase>("pick");
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [originalBlob, setOriginalBlob] = useState<Blob | null>(null);
  const [originalUrl,  setOriginalUrl]  = useState<string | null>(null);
  const [cleanedBlob,  setCleanedBlob]  = useState<Blob | null>(null);
  const [cleanedUrl,   setCleanedUrl]   = useState<string | null>(null);
  const [bgProcessing, setBgProcessing] = useState(false);
  const [bgFailed,     setBgFailed]     = useState(false);
  const [selected,     setSelected]     = useState<"original" | "cleaned">("original");

  // ── Multi-photo queue ─────────────────────────────────────────────────────────
  // queue = photos still to process after the current one
  const [queue,      setQueue]      = useState<File[]>([]);
  const [queueTotal, setQueueTotal] = useState(0);
  // How many photos saved so far in this batch — used for auto-naming
  const savedCountRef = useRef(0);

  // Generation counter prevents a slow photo from clobbering a faster second pick
  const bgGenRef = useRef(0);

  // Refs mirror the blob/selected state so handleSave always reads the
  // latest value — avoids stale useCallback closure bugs.
  const originalBlobRef = useRef<Blob | null>(null);
  const cleanedBlobRef  = useRef<Blob | null>(null);
  const selectedRef     = useRef<"original" | "cleaned">("original");

  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const createItem  = useCreateClothingItem();
  const queryClient = useQueryClient();

  // ── handleClose ──────────────────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    bgGenRef.current += 1;   // cancels any in-flight removal
    setBgProcessing(false);  // MUST reset — close can happen mid-removal
    originalBlobRef.current = null;
    cleanedBlobRef.current  = null;
    selectedRef.current     = "original";
    setPhase("pick");
    setErrorMsg(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
    setQueue([]);
    setQueueTotal(0);
    savedCountRef.current = 0;
    onOpenChange(false);
  }, [onOpenChange]);

  // ── handleFile — one photo through the comparison flow ───────────────────────

  const handleFile = useCallback(async (file: File | Blob) => {
    setErrorMsg(null);
    const myGen = ++bgGenRef.current;
    originalBlobRef.current = null;
    cleanedBlobRef.current  = null;
    selectedRef.current     = "original";
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");

    // Switch to "encoding" BEFORE first await — spinner appears immediately
    setPhase("encoding");

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setErrorMsg(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("pick");
      return;
    }

    if (bgGenRef.current !== myGen) return;
    originalBlobRef.current = jpeg;
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhase("preview");

    setBgProcessing(true);
    try {
      const dataUrl = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
      cleanedBlobRef.current = resultBlob;
      selectedRef.current    = "cleaned";
      setCleanedBlob(resultBlob);
      setCleanedUrl(resultObjUrl);
      setSelected("cleaned");
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      console.warn("Background removal failed:", err);
      setBgFailed(true);
    } finally {
      if (bgGenRef.current === myGen) setBgProcessing(false);
    }
  }, []);

  // ── handleSave — save current photo, then advance queue or close ─────────────

  const handleSave = useCallback(async () => {
    // Read from refs — not closed-over state — so we always get the
    // current blob regardless of when this callback was last recreated.
    const blob = selectedRef.current === "cleaned" && cleanedBlobRef.current
      ? cleanedBlobRef.current
      : originalBlobRef.current;
    if (!blob) {
      setErrorMsg("No photo ready — please wait a moment and try again.");
      return;
    }
    // Cancel any in-flight BG removal so its async state updates
    // don't race with the save / phase transition.
    bgGenRef.current += 1;
    setBgProcessing(false);
    setPhase("uploading");
    try {
      const dataUrl  = await blobToDataUrl(blob);
      const label    = CATEGORY_LABELS[category];
      const n        = existingCount + savedCountRef.current + 1;
      const autoName = n === 1 ? label : `${label} ${n}`;

      await new Promise<void>((resolve, reject) => {
        createItem.mutate(
          { data: { name: autoName, category, imageObjectPath: dataUrl } },
          {
            onSuccess: (createdItem) => {
              queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
              if (onCreated) onCreated(createdItem);
              resolve();
            },
            onError: reject,
          },
        );
      });

      savedCountRef.current += 1;

      // Advance to next photo in queue, or close if done
      setQueue((prev) => {
        if (prev.length > 0) {
          const [next, ...rest] = prev;
          handleFile(next);
          return rest;
        }
        // Last photo saved — close
        handleClose();
        return [];
      });
    } catch (err) {
      setErrorMsg(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      setPhase("preview");
    }
  }, [category, existingCount, createItem, queryClient, onCreated, handleFile, handleClose]);

  // ── handleFiles — kick off queue with all selected photos ────────────────────

  const handleFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;
    savedCountRef.current = 0;
    setQueueTotal(files.length);
    setQueue(files.slice(1));   // rest go into queue
    handleFile(files[0]);       // start with first immediately
  }, [handleFile]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length) handleFiles(files);
    e.target.value = "";
  };

  if (!open) return null;

  const label         = CATEGORY_LABELS[category];
  const queueRemaining = queue.length;
  const isLastPhoto   = queueRemaining === 0;
  // "Photo 2 of 5" — only shown when batch > 1
  const currentPhotoNum = queueTotal > 1 ? queueTotal - queueRemaining : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[70] flex flex-col max-w-md mx-auto bg-[#f9f4ee]"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div>
          <h2 className="font-display font-bold text-xl uppercase tracking-tight">
            Add {label}
          </h2>
          {currentPhotoNum !== null && (
            <p className="text-[10px] font-bold uppercase tracking-widest text-black/40 mt-0.5">
              Photo {currentPhotoNum} of {queueTotal}
            </p>
          )}
        </div>
        {(phase === "pick" || phase === "preview") && (
          <button
            onClick={handleClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Body — plain conditional divs, NO AnimatePresence */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflowY: "auto" }}>

        {/* ── Pick ── */}
        {phase === "pick" && (
          <div className="flex flex-col p-5 gap-5">
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
                style={{ background: "linear-gradient(to bottom, #7D1528, #5C0F1E)" }}
              >
                <span className="text-4xl leading-none">📷</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight text-white">
                  Take<br />Photo
                </span>
              </button>

              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex-1 flex flex-col items-center justify-center gap-3 py-8
                           border-4 border-black rounded-2xl bg-white
                           shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <span className="text-4xl leading-none">🖼️</span>
                <span className="font-display font-bold text-base uppercase tracking-tight text-center leading-tight">
                  Upload<br />Photos
                </span>
              </button>
            </div>

            <div className="border-2 border-black rounded-2xl bg-white p-4
                            shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <p className="font-display font-bold text-sm uppercase tracking-tight mb-3 flex items-center gap-2">
                <span>📸</span> PHOTO TIPS
              </p>
              <ul className="flex flex-col gap-2">
                {PHOTO_TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2 text-sm text-black/70 leading-snug">
                    <span
                      className="mt-0.5 w-4 h-4 border-2 border-black rounded-sm
                                 flex items-center justify-center flex-shrink-0"
                      style={{ background: "#5C0F1E" }}
                    >
                      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ── Encoding ── */}
        {phase === "encoding" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
              <p className="text-sm text-black/50 mt-1">Getting your photo ready.</p>
            </div>
          </div>
        )}

        {/* ── Preview — side-by-side comparison ── */}
        {phase === "preview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: 20 }}>
            {errorMsg && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                {errorMsg}
              </p>
            )}

            <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                        textTransform: "uppercase", letterSpacing: 2, opacity: 0.4, margin: 0 }}>
              {bgProcessing ? "This will take a moment…" : bgFailed ? "Original" : "Tap to choose"}
            </p>

            <div style={{ display: "flex", gap: 12 }}>
              {/* Original card */}
              <button
                onClick={() => setSelected("original")}
                style={{
                  flex: 1,
                  opacity: selected === "original" ? 1 : 0.5,
                  border: selected === "original" ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0, cursor: "pointer",
                }}
              >
                <div style={{ background: "black", minHeight: 176, position: "relative" }}>
                  <img src={originalUrl!} alt="Original"
                       style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }} />
                  {selected === "original" && (
                    <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                  borderRadius: "50%", background: "black",
                                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Check size={12} color="white" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>Original</p>
              </button>

              {/* Cleaned card */}
              <button
                onClick={() => cleanedUrl && setSelected("cleaned")}
                disabled={!cleanedUrl}
                style={{
                  flex: 1,
                  opacity: selected === "cleaned" && cleanedUrl ? 1 : 0.5,
                  border: selected === "cleaned" && cleanedUrl ? "4px solid black" : "4px solid rgba(0,0,0,0.2)",
                  borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                  cursor: cleanedUrl ? "pointer" : "default",
                }}
              >
                <div style={{
                  background: "repeating-conic-gradient(#d1d5db 0% 25%, white 0% 50%) 0 0 / 12px 12px",
                  minHeight: 176, position: "relative",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {cleanedUrl ? (
                    <>
                      <img src={cleanedUrl} alt="Cleaned"
                           style={{ width: "100%", objectFit: "contain", maxHeight: 176, display: "block" }} />
                      {selected === "cleaned" && (
                        <div style={{ position: "absolute", top: 6, right: 6, width: 20, height: 20,
                                      borderRadius: "50%", background: "black",
                                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Check size={12} color="white" strokeWidth={3} />
                        </div>
                      )}
                    </>
                  ) : bgFailed ? (
                    <p style={{ fontSize: 12, fontWeight: "bold", textTransform: "uppercase",
                                opacity: 0.4, textAlign: "center", padding: "0 12px", margin: 0 }}>
                      Could not remove background
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                      <Loader2 size={32} style={{ opacity: 0.5 }} className="animate-spin" />
                      <p style={{ fontSize: 13, fontWeight: "bold", textTransform: "uppercase",
                                  opacity: 0.5, margin: 0 }}>Processing</p>
                    </div>
                  )}
                </div>
                <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                            textTransform: "uppercase", padding: "6px 0", margin: 0 }}>Cleaned ✨</p>
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setPhase("pick")}
                className="flex-1 py-3 border-2 border-black rounded-xl font-bold text-sm uppercase
                           tracking-wide bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                ↩ Retake
              </button>
              <button
                onClick={handleSave}
                disabled={selected === "cleaned" && !cleanedUrl}
                className="flex-1 py-3 border-2 border-black rounded-xl font-bold text-sm uppercase
                           tracking-wide text-white
                           shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: "linear-gradient(to bottom, #7D1528, #5C0F1E)" }}
              >
                {selected === "cleaned" && !cleanedUrl
                  ? "Processing…"
                  : isLastPhoto
                    ? "✓ Save"
                    : `Save & Next (${queueRemaining} left)`}
              </button>
            </div>
          </div>
        )}

        {/* ── Uploading ── */}
        {phase === "uploading" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
            <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                            flex items-center justify-center
                            shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <p className="font-display font-bold text-2xl uppercase tracking-tight">Saving…</p>
              <p className="text-sm text-black/50 mt-1">Adding to your collection.</p>
            </div>
          </div>
        )}

      </div>

      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </motion.div>
  );
}
