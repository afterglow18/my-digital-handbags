/**
 * ItemDetailsSheet — full-screen overlay showing a clothing item's details.
 * Every field is optional and editable. A "Save" button appears only when
 * the form is dirty. Delete is always available.
 *
 * Photo actions (below the photo area):
 *   • Replace Photo 📷  — opens file picker → comparison flow
 *   • Remove Background ✨ — feeds the current saved image into the same
 *     comparison flow without requiring a re-upload
 *
 * Phase blocks use plain conditional divs — NOT AnimatePresence — to avoid
 * blank-screen gaps between phase transitions.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, Trash2, Save, ChevronDown, Camera, Loader2, Check, Wand2, CalendarCheck, BookMarked } from "lucide-react";
import { AddToLookbookSheet } from "@/components/clothing/AddToLookbookSheet";
import type { ClothingItem, ClothingItemUpdateCategory } from "@/types/local";
import { useUpdateClothingItem, useDeleteClothingItem, getListClothingQueryKey } from "@/hooks/useLocalWardrobe";
import { getListOutfitsQueryKey } from "@/hooks/useLocalOutfits";
import { useQueryClient } from "@tanstack/react-query";
import { getImageUrl } from "@/lib/utils";
import {
  removeBackground,
  blobToDataUrl,
  dataUrlToBlob,
} from "@/lib/backgroundRemoval";

// ── Wear-tracking helpers ─────────────────────────────────────────────────────

/** Returns today's date as "YYYY-MM-DD" in local time. */
function todayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Formats a "YYYY-MM-DD" string as "M/D/YY". */
function formatLastWorn(dateStr: string): string {
  const [y, mo, day] = dateStr.split("-").map(Number);
  return `${mo}/${day}/${String(y).slice(-2)}`;
}

// ── encodeForUpload (outside component) ──────────────────────────────────────

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

// ── Field helpers ─────────────────────────────────────────────────────────────

const SEASON_OPTIONS   = ["", "Spring", "Summer", "Fall", "Winter", "All Season"];
const OCCASION_OPTIONS = ["", "Casual", "Work", "Formal", "Sport", "Special Event"];
const CATEGORY_OPTIONS = ["totes", "shoulder-bags", "crossbody-bags", "clutches-wristlets"];

function Field({
  label, value, onChange, placeholder, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                   bg-white focus:outline-none focus:ring-2 focus:ring-primary
                   placeholder:font-normal placeholder:text-black/25"
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none border-2 border-black rounded-lg px-3 py-2 pr-8
                     text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
          {options.map((o) => (
            <option key={o} value={o}>{o || `— ${label} —`}</option>
          ))}
        </select>
        <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-black/40" />
      </div>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ItemDetailsSheetProps {
  item: ClothingItem | null;
  onClose: () => void;
  onDeleted?: () => void;
  /** When true: show "Add to Lookbook" instead of "Clean Up Photo". */
  showAddToLookbook?: boolean;
}

interface FormState {
  name: string; brand: string; color: string; size: string;
  season: string; occasion: string; purchasePrice: string;
  purchaseDate: string; notes: string; isFavorite: boolean; category: string;
}

type PhotoPhase   = "idle" | "encoding" | "preview";
type PhotoTrigger = "replace" | "remove-bg";

function toForm(item: ClothingItem): FormState {
  return {
    name:          item.name          ?? "",
    brand:         item.brand         ?? "",
    color:         item.color         ?? "",
    size:          item.size          ?? "",
    season:        item.season        ?? "",
    occasion:      item.occasion      ?? "",
    purchasePrice: item.purchasePrice ?? "",
    purchaseDate:  item.purchaseDate  ?? "",
    notes:         item.notes         ?? "",
    isFavorite:    item.isFavorite    ?? false,
    category:      item.category      ?? "",
  };
}

function isDirty(form: FormState, item: ClothingItem): boolean {
  return (
    form.name          !== (item.name          ?? "") ||
    form.brand         !== (item.brand         ?? "") ||
    form.color         !== (item.color         ?? "") ||
    form.size          !== (item.size          ?? "") ||
    form.season        !== (item.season        ?? "") ||
    form.occasion      !== (item.occasion      ?? "") ||
    form.purchasePrice !== (item.purchasePrice ?? "") ||
    form.purchaseDate  !== (item.purchaseDate  ?? "") ||
    form.notes         !== (item.notes         ?? "") ||
    form.isFavorite    !== (item.isFavorite    ?? false) ||
    form.category      !== (item.category      ?? "")
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ItemDetailsSheet({ item, onClose, onDeleted, showAddToLookbook = false }: ItemDetailsSheetProps) {
  // ── Form state ───────────────────────────────────────────────────────────────
  const [form, setForm]                           = useState<FormState | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLookbookPicker, setShowLookbookPicker] = useState(false);

  // ── Wear tracking state ──────────────────────────────────────────────────────
  const [wornCount,      setWornCount]      = useState<number>(0);
  const [lastWornDate,   setLastWornDate]   = useState<string | null>(null);
  const [prevLastWornDate, setPrevLastWornDate] = useState<string | null>(null);

  // ── Photo replacement / bg-removal state ────────────────────────────────────
  // localImageUrl holds the just-chosen dataUrl for optimistic display.
  // It overrides item.imageObjectPath until the parent re-renders with the DB value.
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [photoPhase,    setPhotoPhase]    = useState<PhotoPhase>("idle");
  const [photoTrigger,  setPhotoTrigger]  = useState<PhotoTrigger>("replace");
  const [photoError,    setPhotoError]    = useState<string | null>(null);
  const [originalBlob,  setOriginalBlob]  = useState<Blob | null>(null);
  const [originalUrl,   setOriginalUrl]   = useState<string | null>(null);
  const [cleanedBlob,   setCleanedBlob]   = useState<Blob | null>(null);
  const [cleanedUrl,    setCleanedUrl]    = useState<string | null>(null);
  const [bgProcessing,  setBgProcessing]  = useState(false);
  const [bgFailed,      setBgFailed]      = useState(false);
  const [selected,      setSelected]      = useState<"original" | "cleaned">("original");
  // Generation counter prevents a slow first photo from clobbering a fast second one
  const bgGenRef    = useRef(0);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const updateItem  = useUpdateClothingItem();
  const deleteItem  = useDeleteClothingItem();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (item) {
      setForm(toForm(item));
      setWornCount(item.timesWorn ?? 0);
      setLastWornDate(item.lastWornDate ?? null);
      setPrevLastWornDate(null);
    }
    setShowDeleteConfirm(false);
    setLocalImageUrl(null); // reset optimistic url whenever a new item is opened
  }, [item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── All useCallback hooks MUST live above any early return (Rules of Hooks) ──

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getListClothingQueryKey() });
    queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
  }, [queryClient]);

  const resetPhotoState = useCallback(() => {
    bgGenRef.current += 1;   // cancels any in-flight removal
    setBgProcessing(false);  // MUST reset — close can happen mid-removal
    setPhotoPhase("idle");
    setPhotoError(null);
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setSelected("original");
  }, []);

  /**
   * Core comparison flow. Works for both "Replace Photo" (new file picked)
   * and "Remove Background" (existing stored image passed in as a Blob).
   */
  const handlePhotoFile = useCallback(async (file: File | Blob) => {
    setPhotoError(null);
    const myGen = ++bgGenRef.current;
    setOriginalBlob(null);
    setOriginalUrl(null);
    setCleanedBlob(null);
    setCleanedUrl(null);
    setBgFailed(false);
    setBgProcessing(false);
    setSelected("original");

    // Switch to encoding BEFORE first await so the spinner appears immediately
    setPhotoPhase("encoding");

    let jpeg: Blob;
    try {
      jpeg = await encodeForUpload(file);
    } catch (err) {
      if (bgGenRef.current !== myGen) return;
      setPhotoError(`Could not read the photo: ${err instanceof Error ? err.message : String(err)}`);
      setPhotoPhase("idle");
      return;
    }

    if (bgGenRef.current !== myGen) return;
    setOriginalBlob(jpeg);
    setOriginalUrl(URL.createObjectURL(jpeg));
    setPhotoPhase("preview");

    // Background removal runs in parallel while user sees the original
    setBgProcessing(true);
    try {
      const dataUrl = await blobToDataUrl(jpeg);
      if (bgGenRef.current !== myGen) return;
      const resultUrl = await removeBackground(dataUrl);
      if (bgGenRef.current !== myGen) return;
      const resultBlob   = await dataUrlToBlob(resultUrl);
      const resultObjUrl = URL.createObjectURL(resultBlob);
      if (bgGenRef.current !== myGen) { URL.revokeObjectURL(resultObjUrl); return; }
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

  /** Open file picker to pick a replacement photo. */
  const handleReplacePhoto = useCallback(() => {
    setPhotoTrigger("replace");
    photoInputRef.current?.click();
  }, []);

  /**
   * Feed the currently-saved image directly into the comparison flow.
   * No re-upload required — the stored dataUrl is converted to a Blob
   * and passed through encodeForUpload + removeBackground.
   */
  const handleRemoveBg = useCallback(async () => {
    if (!item?.imageObjectPath) return;
    setPhotoTrigger("remove-bg");
    try {
      const blob = await dataUrlToBlob(item.imageObjectPath);
      handlePhotoFile(blob);
    } catch (err) {
      setPhotoError(`Could not load the current photo: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [item?.imageObjectPath, handlePhotoFile]);

  const handlePhotoSave = useCallback(async () => {
    const blob = selected === "cleaned" && cleanedBlob ? cleanedBlob : originalBlob;
    if (!blob || !item) return;
    // Cancel any in-flight BG removal so its async state updates
    // don't race with the save / phase transition.
    bgGenRef.current += 1;
    setBgProcessing(false);
    // Convert the chosen blob to a dataUrl first (fast, in-memory)
    let dataUrl: string;
    try {
      dataUrl = await blobToDataUrl(blob);
    } catch (err) {
      setPhotoError(`Could not read photo: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    // Optimistic: update displayed photo immediately and close the overlay.
    // The DB write happens in the background — no flash back to the old image.
    setLocalImageUrl(dataUrl);
    resetPhotoState();
    updateItem.mutate(
      { id: item.id, data: { imageObjectPath: dataUrl } },
      {
        onSuccess: () => invalidate(),
        onError: (err) => {
          console.error("Photo save failed, reverting:", err);
          setLocalImageUrl(null); // revert optimistic update on failure
        },
      },
    );
  }, [selected, cleanedBlob, originalBlob, item, updateItem, invalidate, resetPhotoState]);

  // ── Wear tracking handlers ────────────────────────────────────────────────────

  const handleWearToday = useCallback(() => {
    if (!item) return;
    const today = todayLocalDate();
    const newCount = wornCount + 1;
    setPrevLastWornDate(lastWornDate);
    setWornCount(newCount);
    setLastWornDate(today);
    updateItem.mutate(
      { id: item.id, data: { timesWorn: newCount, lastWornDate: today } },
      { onSuccess: () => invalidate() },
    );
  }, [item, wornCount, lastWornDate, updateItem, invalidate]);

  const handleUndoWear = useCallback(() => {
    if (!item) return;
    const newCount = Math.max(0, wornCount - 1);
    const restoredDate = prevLastWornDate;
    setWornCount(newCount);
    setLastWornDate(restoredDate);
    setPrevLastWornDate(null);
    updateItem.mutate(
      { id: item.id, data: { timesWorn: newCount, lastWornDate: restoredDate } },
      { onSuccess: () => invalidate() },
    );
  }, [item, wornCount, prevLastWornDate, updateItem, invalidate]);

  // ── Early return — must come AFTER all hooks ──────────────────────────────────
  if (!item || !form) return null;

  const dirty = isDirty(form, item);
  const patch = (key: keyof FormState) => (value: string | boolean) =>
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);

  // ── Form save ────────────────────────────────────────────────────────────────

  const handleSave = () => {
    updateItem.mutate(
      {
        id: item.id,
        data: {
          name:          form.name.trim() || item.name,
          brand:         form.brand.trim() || null,
          color:         form.color.trim() || null,
          size:          form.size.trim() || null,
          season:        form.season || null,
          occasion:      form.occasion || null,
          purchasePrice: form.purchasePrice.trim() || null,
          purchaseDate:  form.purchaseDate.trim() || null,
          notes:         form.notes.trim() || null,
          isFavorite:    form.isFavorite,
          category:      (form.category || item.category) as ClothingItemUpdateCategory,
        },
      },
      { onSuccess: () => { invalidate(); onClose(); } },
    );
  };

  const handleDelete = () => {
    deleteItem.mutate(
      { id: item.id },
      {
        onSuccess: () => {
          invalidate();
          onDeleted?.();
          onClose();
        },
      },
    );
  };

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoFile(file);
    e.target.value = "";
  };

  const overlayTitle =
    photoTrigger === "remove-bg" ? "Clean Up Photo ✨" : "Replace Photo";

  // Allow saving original at any time; only block if cleaned is selected but not ready yet
  const canSavePhoto   = selected === "original" ? !!originalBlob : !!cleanedUrl;
  const saveButtonLabel =
    !canSavePhoto
      ? "Processing…"
      : selected === "cleaned"
        ? "Save Cleaned Version"
        : "Save Original";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 240 }}
        className="fixed inset-0 z-[65] flex flex-col max-w-md mx-auto bg-[#f9f4ee] overflow-y-auto"
      >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 pb-3
                      bg-white border-b-2 border-black flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}>
        <h2 className="font-display font-bold text-xl uppercase tracking-tight">Item Details</h2>
        <div className="flex items-center gap-2">
          {/* Favourite toggle */}
          <button
            onClick={() => {
              const next = !form.isFavorite;
              patch("isFavorite")(next);
              updateItem.mutate(
                { id: item.id, data: { isFavorite: next } },
                { onSuccess: invalidate },
              );
            }}
            className={`w-9 h-9 border-2 border-black rounded-full flex items-center justify-center transition-all
                        ${form.isFavorite
                          ? "bg-red-500 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          : "bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"}`}
          >
            <Heart
              className="w-4 h-4"
              fill={form.isFavorite ? "white" : "none"}
              stroke={form.isFavorite ? "white" : "currentColor"}
            />
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                       bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                       active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Photo */}
      <div
        className="w-full h-52 flex-shrink-0 border-b-2 border-black relative"
        style={{
          backgroundImage: "repeating-conic-gradient(#e5e7eb 0% 25%, white 0% 50%)",
          backgroundSize: "16px 16px",
        }}
      >
        {(localImageUrl ?? item.imageObjectPath) ? (
          <img
            src={localImageUrl ?? getImageUrl(item.imageObjectPath)!}
            alt={item.name}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-black/30">
            <Camera className="w-8 h-8" />
            <span className="text-xs font-bold uppercase tracking-wide">No Photo Yet</span>
          </div>
        )}
      </div>

      {/* Photo action buttons + wear tracking */}
      {(() => {
        const today = todayLocalDate();
        const loggedToday = lastWornDate === today;
        return (
          <div className="px-4 py-3 border-b-2 border-black bg-white flex-shrink-0 flex flex-col gap-2">
            {/* Row 1: photo actions */}
            <div className="flex gap-2">
              <button
                onClick={handleReplacePhoto}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                           border-2 border-black rounded-xl text-xs font-bold uppercase tracking-wide
                           bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Camera className="w-3.5 h-3.5" />
                {item.imageObjectPath ? "Replace Photo" : "Add Photo"}
              </button>

              {showAddToLookbook ? (
                <button
                  onClick={() => setShowLookbookPicker(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                             border-2 rounded-xl text-xs font-bold uppercase tracking-wide
                             transition-all"
                  style={{ background: "linear-gradient(to bottom, #7D1528, #5C0F1E)",
                           borderColor: "black", color: "white",
                           boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
                >
                  <BookMarked className="w-3.5 h-3.5" />
                  Add to Lookbook
                </button>
              ) : item.imageObjectPath ? (
                <button
                  onClick={handleRemoveBg}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                             border-2 rounded-xl text-xs font-bold uppercase tracking-wide
                             transition-all"
                  style={{ background: "linear-gradient(to bottom, #7D1528, #5C0F1E)",
                           borderColor: "black", color: "white",
                           boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
                >
                  <Wand2 className="w-3.5 h-3.5" />
                  Clean Up Photo ✨
                </button>
              ) : null}
            </div>

            {/* Row 2: wear tracking */}
            {loggedToday ? (
              <button
                onClick={handleUndoWear}
                className="w-full flex items-center justify-center gap-2 py-2.5
                           border-2 border-black rounded-xl text-xs font-bold uppercase tracking-wide
                           bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                <Heart className="w-3.5 h-3.5 fill-[#7D1528] text-[#7D1528]" />
                <span>Logged ✓ · Undo</span>
              </button>
            ) : (
              <button
                onClick={handleWearToday}
                className="w-full flex items-center justify-center gap-2 py-2.5
                           border-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all"
                style={{ background: "linear-gradient(to bottom, #1a1a1a, #000)",
                         borderColor: "black", color: "white",
                         boxShadow: "2px 2px 0px 0px rgba(0,0,0,1)" }}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Wearing Today
              </button>
            )}
          </div>
        );
      })()}

      {/* Form */}
      <div className="flex-1 px-4 py-5 flex flex-col gap-4">
        <Field label="Item Name" value={form.name} onChange={patch("name") as (v: string) => void}
               placeholder="e.g. Charlotte Tilbury Flawless Filter" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand"  value={form.brand} onChange={patch("brand") as (v: string) => void} placeholder="e.g. NARS" />
          <Field label="Color"  value={form.color} onChange={patch("color") as (v: string) => void} placeholder="Rose Gold" />
        </div>
        <Field label="Size / Volume" value={form.size} onChange={patch("size") as (v: string) => void}
               placeholder="30ml, 50ml, Full Size…" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Season"   value={form.season}   onChange={patch("season") as (v: string) => void}   options={SEASON_OPTIONS} />
          <SelectField label="Occasion" value={form.occasion} onChange={patch("occasion") as (v: string) => void} options={OCCASION_OPTIONS} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Purchase Price" value={form.purchasePrice} onChange={patch("purchasePrice") as (v: string) => void} placeholder="$49.99" />
          <Field label="Purchase Date"  value={form.purchaseDate}  onChange={patch("purchaseDate") as (v: string) => void}  type="date" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => patch("notes")(e.target.value)}
            placeholder="Anything worth remembering…"
            rows={3}
            className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                       bg-white focus:outline-none focus:ring-2 focus:ring-primary resize-none
                       placeholder:font-normal placeholder:text-black/25"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Category" value={form.category}
                       onChange={patch("category") as (v: string) => void} options={CATEGORY_OPTIONS} />
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-black/40">Times Worn</span>
            <input
              type="number"
              min={0}
              value={wornCount}
              onChange={(e) => setWornCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
              onBlur={(e) => {
                const n = Math.max(0, parseInt(e.target.value, 10) || 0);
                setWornCount(n);
                updateItem.mutate(
                  { id: item.id, data: { timesWorn: n } },
                  { onSuccess: () => invalidate() },
                );
              }}
              className="w-full border-2 border-black rounded-lg px-3 py-2 text-sm font-medium
                         bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {lastWornDate && (
              <span className="text-[10px] text-black/40 font-medium mt-0.5">
                Last worn: {formatLastWorn(lastWornDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 px-4 py-4 bg-white border-t-2 border-black flex-shrink-0 flex flex-col gap-2">
        <AnimatePresence>
          {dirty && (
            <motion.button
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              onClick={handleSave}
              disabled={updateItem.isPending}
              className="w-full btn-brutalist py-3 rounded-xl flex items-center justify-center gap-2 text-sm"
            >
              <Save className="w-4 h-4" />
              {updateItem.isPending ? "Saving…" : "Save Changes"}
            </motion.button>
          )}
        </AnimatePresence>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm
                       font-bold uppercase border-2 border-black/20 text-black/35
                       hover:border-red-500 hover:text-red-600 transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete from Collection Forever
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-black bg-white
                         shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              className="flex-1 py-3 rounded-xl text-sm font-bold uppercase border-2 border-red-600
                         bg-red-500 text-white shadow-[2px_2px_0px_0px_rgba(185,28,28,1)]
                         active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all
                         disabled:opacity-50"
            >
              {deleteItem.isPending ? "Deleting…" : "Yes, Delete Forever"}
            </button>
          </div>
        )}
      </div>

      {/* Hidden file input — no capture attr so iOS shows native Camera/Library picker */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoInputChange}
      />

      </motion.div>

      {/* ── Photo overlay — rendered via portal so it escapes the motion.div's
           CSS transform context and overflow-y-auto scroll container, both of
           which trap position:fixed children on iOS Safari and swallow taps. ── */}
      {photoPhase !== "idle" && createPortal(
        <div className="fixed inset-0 z-[75] flex flex-col max-w-md mx-auto bg-[#f9f4ee]">

          {/* Overlay header */}
          <div
            className="flex items-center justify-between px-4 pb-3 bg-white border-b-2 border-black flex-shrink-0"
            style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
          >
            <h2 className="font-display font-bold text-xl uppercase tracking-tight">{overlayTitle}</h2>
            {photoPhase === "preview" && (
              <button
                onClick={resetPhotoState}
                className="w-9 h-9 border-2 border-black rounded-full flex items-center justify-center
                           bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]
                           active:translate-y-0.5 active:translate-x-0.5 active:shadow-none transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* ── Encoding ── */}
          {photoPhase === "encoding" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column",
                          alignItems: "center", justifyContent: "center", gap: 20, padding: 24 }}>
              <div className="w-28 h-28 border-4 border-black rounded-3xl bg-white
                              flex items-center justify-center
                              shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <Loader2 className="w-12 h-12 animate-spin" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="font-display font-bold text-2xl uppercase tracking-tight">Processing…</p>
                <p className="text-sm text-black/50 mt-1">
                  {photoTrigger === "remove-bg"
                    ? "Loading your current photo."
                    : "Getting your photo ready."}
                </p>
              </div>
            </div>
          )}

          {/* ── Preview — side-by-side comparison ── */}
          {photoPhase === "preview" && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column",
                          gap: 16, padding: 20, overflowY: "auto" }}>
              {photoError && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-center">
                  {photoError}
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
                      <div style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22,
                                    borderRadius: "50%", background: "#7D1528",
                                    border: "2px solid white",
                                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Check size={12} color="white" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p style={{ textAlign: "center", fontWeight: "bold", fontSize: 11,
                              textTransform: "uppercase", padding: "6px 0", margin: 0,
                              color: selected === "original" ? "#7D1528" : undefined }}>Original</p>
                </button>

                {/* Cleaned card */}
                <button
                  onClick={() => cleanedUrl && setSelected("cleaned")}
                  disabled={!cleanedUrl}
                  style={{
                    flex: 1,
                    opacity: selected === "cleaned" && cleanedUrl ? 1 : 0.55,
                    border: selected === "cleaned" && cleanedUrl ? "4px solid #7D1528" : "4px solid rgba(0,0,0,0.15)",
                    boxShadow: selected === "cleaned" && cleanedUrl ? "0 0 0 2px #7D1528" : "none",
                    borderRadius: 16, overflow: "hidden", background: "none", padding: 0,
                    cursor: cleanedUrl ? "pointer" : "default",
                    transition: "border-color 0.15s, box-shadow 0.15s, opacity 0.15s",
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
                              textTransform: "uppercase", padding: "6px 0", margin: 0,
                              color: selected === "cleaned" && cleanedUrl ? "#7D1528" : undefined }}>Cleaned ✨</p>
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={resetPhotoState}
                  className="flex-1 py-3 border-2 border-black rounded-xl font-bold text-sm uppercase
                             tracking-wide bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                             active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
                >
                  ↩ Cancel
                </button>
                <button
                  onClick={handlePhotoSave}
                  disabled={!canSavePhoto}
                  className="flex-1 py-3 border-2 border-black rounded-xl font-bold text-sm uppercase
                             tracking-wide text-white
                             shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]
                             active:translate-x-0.5 active:translate-y-0.5 active:shadow-none
                             disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  style={{ background: "linear-gradient(to bottom, #7D1528, #5C0F1E)" }}
                >
                  {saveButtonLabel}
                </button>
              </div>
            </div>
          )}


        </div>,
        document.body
      )}
      {/* Add to Lookbook picker */}
      <AnimatePresence>
        {showLookbookPicker && item && (
          <AddToLookbookSheet item={item} onClose={() => setShowLookbookPicker(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
