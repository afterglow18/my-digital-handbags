/**
 * GeneratePage — "Spin It" screen for My Digital Handbags.
 * Local-first: data comes from IndexedDB via useListClothing / useSaveOutfit.
 */

import React, {
  useCallback, useEffect, useRef, useState, RefObject,
} from "react";
import {
  useListClothing, getListClothingQueryKey,
} from "@/hooks/useLocalWardrobe";
import {
  useSaveOutfit, getListOutfitsQueryKey,
} from "@/hooks/useLocalOutfits";
import type { ClothingItem } from "@/types/local";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ClosetRow, ClosetRowHandle } from "@/components/ClosetRow";
import { useQueryClient } from "@tanstack/react-query";

// ── Layout constants (same as wardrobe.tsx) ───────────────────────────────────
const IMG_W = 1086;
const IMG_H = 1448;
const NAV_H = 90;
const PLUM       = "#7D1528";   // icon burgundy (light)
const PLUM_DARK  = "#5C0F1E";   // icon burgundy (dark)
const GOLD       = "#d4af37";
const GOLD_LIGHT = "#f0d080";

// Fraction of image height reserved at the top of every section for the heading.
const LABEL_FRAC = 0.042;

// Layout markers calibrated for handbag-bg.png (1086×1448).
// All four sections are ~16-18% tall so photos render at the same size.
const LM = {
  doorL: 0.06,
  doorR: 0.94,
  rows: [
    { sectionTop: 0.07, shelfY: 0.24 },
    { sectionTop: 0.27, shelfY: 0.45 },
    { sectionTop: 0.455, shelfY: 0.635 },
    { sectionTop: 0.63, shelfY: 0.81 },
  ],
  barY:   0.85,
  barBot: 1.00,
} as const;

interface ImgRect {
  top: number; left: number; width: number; height: number; containerH: number; containerW: number;
}

function useImageRect(ref: RefObject<HTMLDivElement>): ImgRect {
  const [rect, setRect] = useState<ImgRect>({ top: 0, left: 0, width: 0, height: 0, containerH: 0, containerW: 0 });
  useEffect(() => {
    const compute = () => {
      const c = ref.current;
      if (!c) return;
      const cW = c.clientWidth, cH = c.clientHeight;
      // Cover: scale to fill. rL may be negative — used only for UI positioning.
      // The image itself uses left:50%+translateX(-50%) so iOS clips both sides.
      const scale = Math.max(cW / IMG_W, cH / IMG_H);
      const rW = IMG_W * scale, rH = IMG_H * scale;
      const rL = (cW - rW) / 2, rT = (cH - rH) / 2;
      setRect({ top: rT, left: rL, width: rW, height: rH, containerH: cH, containerW: cW });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [ref]);
  return rect;
}

const pH = (ir: ImgRect, f: number) => ir.height * f;
const pW = (ir: ImgRect, f: number) => ir.width  * f;
const pX = (ir: ImgRect, f: number) => ir.left   + ir.width  * f;
const pY = (ir: ImgRect, f: number) => ir.top    + ir.height * f;

type RowKey = "totes" | "shoulder-bags" | "crossbody-bags" | "clutches-wristlets";
type Phase  = "idle" | "spinning" | "result";

const ROWS: { key: RowKey }[] = [
  { key: "totes"              },
  { key: "shoulder-bags"      },
  { key: "crossbody-bags"     },
  { key: "clutches-wristlets" },
];

const MIN_SPIN_MS = 1600;

export default function GeneratePage() {
  const containerRef = useRef<HTMLDivElement>(null!);
  const ir    = useImageRect(containerRef);
  const ready = ir.width > 0;

  const rowRefs: Record<RowKey, RefObject<ClosetRowHandle | null>> = {
    "totes":              useRef<ClosetRowHandle | null>(null),
    "shoulder-bags":      useRef<ClosetRowHandle | null>(null),
    "crossbody-bags":     useRef<ClosetRowHandle | null>(null),
    "clutches-wristlets": useRef<ClosetRowHandle | null>(null),
  };

  const [phase,      setPhase]      = useState<Phase>("idle");
  const [centred,    setCentred]    = useState<Partial<Record<RowKey, ClothingItem>>>({});
  const [isSaveOpen, setIsSaveOpen] = useState(false);
  const [saveName,   setSaveName]   = useState("");

  const rowDataRef = useRef<Record<RowKey, ClothingItem[]>>({
    "totes": [], "shoulder-bags": [], "crossbody-bags": [], "clutches-wristlets": [],
  });

  const { data: totes             = [] } = useListClothing({ category: "totes"              }, { query: { queryKey: getListClothingQueryKey({ category: "totes"              }) } });
  const { data: shoulderBags      = [] } = useListClothing({ category: "shoulder-bags"      }, { query: { queryKey: getListClothingQueryKey({ category: "shoulder-bags"      }) } });
  const { data: crossbodyBags     = [] } = useListClothing({ category: "crossbody-bags"     }, { query: { queryKey: getListClothingQueryKey({ category: "crossbody-bags"     }) } });
  const { data: clutchesWristlets = [] } = useListClothing({ category: "clutches-wristlets" }, { query: { queryKey: getListClothingQueryKey({ category: "clutches-wristlets" }) } });

  useEffect(() => { rowDataRef.current = { "totes": totes, "shoulder-bags": shoulderBags, "crossbody-bags": crossbodyBags, "clutches-wristlets": clutchesWristlets }; }, [totes, shoulderBags, crossbodyBags, clutchesWristlets]);

  const hasItems = totes.length > 0 || shoulderBags.length > 0 || crossbodyBags.length > 0 || clutchesWristlets.length > 0;

  const setCentredHandlers: Record<RowKey, (item: ClothingItem | null) => void> = {
    "totes":              useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "totes":              item ?? undefined })), []),
    "shoulder-bags":      useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "shoulder-bags":      item ?? undefined })), []),
    "crossbody-bags":     useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "crossbody-bags":     item ?? undefined })), []),
    "clutches-wristlets": useCallback((item: ClothingItem | null) => setCentred(p => ({ ...p, "clutches-wristlets": item ?? undefined })), []),
  };

  const saveOutfit  = useSaveOutfit();
  const queryClient = useQueryClient();

  const spinningRef = useRef(false);

  const startSpin = useCallback(() => {
    if (spinningRef.current) return;
    spinningRef.current = true;
    setPhase("spinning");
    setCentred({});
    setIsSaveOpen(false);
    setSaveName("");

    const spinStart = Date.now();
    const stop: Record<RowKey, boolean> = { "totes": false, "shoulder-bags": false, "crossbody-bags": false, "clutches-wristlets": false };

    ROWS.forEach(({ key }, ri) => {
      const INTERVAL = 65 + ri * 18;
      const cycle = () => {
        if (stop[key]) return;
        const items = rowDataRef.current[key];
        if (items.length > 1) {
          rowRefs[key].current?.scrollToIndex(Math.floor(Math.random() * items.length), false);
        }
        setTimeout(cycle, INTERVAL);
      };
      cycle();
    });

    const landMap: Partial<Record<RowKey, { item: ClothingItem; idx: number }>> = {};
    ROWS.forEach(({ key }) => {
      const arr = rowDataRef.current[key];
      if (arr.length > 0) {
        const idx = Math.floor(Math.random() * arr.length);
        landMap[key] = { item: arr[idx], idx };
      }
    });

    const elapsed   = Date.now() - spinStart;
    const extraWait = Math.max(0, MIN_SPIN_MS - elapsed);

    setTimeout(() => {
      ROWS.forEach(({ key }, ri) => {
        setTimeout(() => {
          stop[key] = true;
          const target = landMap[key];
          rowRefs[key].current?.scrollToIndex(target?.idx ?? 0, true);
        }, ri * 280);
      });

      const lastLandAt = (ROWS.length - 1) * 280 + 380;
      setTimeout(() => {
        const newCentred: Partial<Record<RowKey, ClothingItem>> = {};
        ROWS.forEach(({ key }) => {
          if (landMap[key]) newCentred[key] = landMap[key]!.item;
        });
        setCentred(newCentred);
        setPhase("result");
        spinningRef.current = false;
      }, lastLandAt);
    }, extraWait);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSpin   = useCallback(() => {
    if (!hasItems || phase === "spinning") return;
    startSpin();
  }, [hasItems, phase, startSpin]);

  const handleRespin = useCallback(() => startSpin(), [startSpin]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const itemIds = Object.values(centred)
      .filter((i): i is ClothingItem => i != null)
      .map(i => i.id);
    saveOutfit.mutate(
      { data: { name: saveName.trim(), itemIds } },
      { onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListOutfitsQueryKey() });
        setIsSaveOpen(false);
        setSaveName("");
      }},
    );
  };

  const canSave = Object.keys(centred).length > 0;

  // Consistent photo height = smallest section minus the heading strip.
  const labelH           = ready ? pH(ir, LABEL_FRAC) : 0;
  const minSecH          = ready ? Math.min(...LM.rows.map(lm => pH(ir, lm.shelfY - lm.sectionTop))) : 0;
  const consistentPhotoH = Math.max(0, minSecH - labelH);
  const INSET   = ready ? ir.containerW * 0.10 : 0;
  const carLeft = ready ? INSET : 0;
  const carW    = ready ? ir.containerW - INSET * 2 : 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: `calc(100dvh - ${NAV_H}px)`,
        overflow: "hidden",
        transform: "translateZ(0)", // force iOS WKWebView to honour overflow:hidden
        background: "#180508",
      }}
    >
      {/* Background image — centred via CSS transform; iOS clips transform overflow correctly */}
      <img
        src="/closet-bg.png"
        alt="My Digital Handbags"
        style={{
          position: "absolute",
          top:       ready ? ir.top   : 0,
          left:      "50%",
          transform: "translateX(-50%)",
          width:     ready ? ir.width  : "100%",
          height:    ready ? ir.height : "auto",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
        }}
      />
      {/* Subtle plum overlay — preserves handbag collection warmth */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none",
        background: "rgba(50, 5, 15, 0.12)",
      }} />

      {ready && (
        <div
          style={{
            position: "absolute",
            top: `calc(${ir.top + pH(ir, -0.015)}px + env(safe-area-inset-top))`,
            left: 0, right: 0,
            textAlign: "center",
            zIndex: 20,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          <span style={{
            fontFamily: "'Great Vibes', cursive",
            fontSize: Math.min(pH(ir, 0.038), pW(ir, 0.052)),
            color: "#0a0a0a",
            textShadow: "0 1px 4px rgba(255,255,255,0.3)",
            lineHeight: 1,
          }}>
            My Digital Handbags
          </span>
        </div>
      )}

      {ready && (() => {
        return (
          <>
            {/* Shelf carousels — heading at top of each section, photos below at consistent height */}
            {ROWS.map(({ key }, rowIdx) => {
              const lm    = LM.rows[rowIdx];
              const items = { "totes": totes, "shoulder-bags": shoulderBags, "crossbody-bags": crossbodyBags, "clutches-wristlets": clutchesWristlets }[key];
              const secTop = pY(ir, lm.sectionTop);
              const secH   = pH(ir, lm.shelfY - lm.sectionTop);

              return (
                <React.Fragment key={key}>
                  {/* Heading — anchored to top of section */}
                  <div style={{
                    position: "absolute", top: secTop, left: carLeft,
                    width: carW, height: labelH,
                    zIndex: 12, display: "flex", alignItems: "center", justifyContent: "center",
                    pointerEvents: "none",
                  }}>
                    <span style={{
                      fontSize: Math.max(9, labelH * 0.55),
                      fontWeight: 300, letterSpacing: "0.22em",
                      color: "#500d1a",
                      fontFamily: "var(--font-display)", textTransform: "uppercase",
                      textShadow: "0 1px 3px rgba(255,255,255,0.15)",
                    }}>{key.toUpperCase()}</span>
                  </div>

                  {/* Carousel or empty placeholder — same height every row */}
                  {items.length > 0 ? (
                    <div style={{
                      position: "absolute",
                      top: secTop + labelH, left: carLeft,
                      width: carW, height: consistentPhotoH,
                      zIndex: 10, overflow: "visible",
                    }}>
                      <ClosetRow
                        ref={rowRefs[key]}
                        items={items}
                        onCenteredItem={setCentredHandlers[key]}
                        maxPhotoH={consistentPhotoH}
                        disableSwipe
                      />
                    </div>
                  ) : (
                    <div style={{
                      position: "absolute",
                      top: secTop + labelH, left: carLeft,
                      width: carW, height: secH - labelH,
                      zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        letterSpacing: "0.09em", textTransform: "uppercase",
                        color: "rgba(240,208,128,0.35)",
                      }}>empty</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Spinning overlay */}
            <AnimatePresence>
              {phase === "spinning" && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    position: "absolute", top: "46%", left: "50%",
                    transform: "translate(-50%, -50%)", zIndex: 25, pointerEvents: "none",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  }}
                >
                  <motion.span
                    animate={{ scale: [1, 1.18, 1], rotate: [0, 12, -12, 0] }}
                    transition={{ repeat: Infinity, duration: 1.1, ease: "easeInOut" }}
                    style={{ fontSize: 26, lineHeight: 1, display: "block" }}
                  >✨</motion.span>
                  <span style={{
                    fontSize: 10, fontWeight: 800, letterSpacing: "0.13em",
                    textTransform: "uppercase", color: "#7a3040",
                    background: "rgba(255,235,240,0.90)", padding: "3px 11px",
                    borderRadius: 20, whiteSpace: "nowrap",
                  }}>Building your look…</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Empty vanity prompt */}
            {!hasItems && (
              <div style={{
                position: "absolute", top: "46%", left: "50%",
                transform: "translate(-50%, -50%)", zIndex: 30,
                textAlign: "center", padding: "14px 22px",
                borderRadius: 16, background: "rgba(255,240,245,0.92)",
                border: "1.5px solid rgba(220,150,160,0.40)",
                boxShadow: "0 4px 18px rgba(0,0,0,0.11)", maxWidth: pW(ir, 0.65),
              }}>
                <p style={{
                  fontWeight: 800, fontSize: 12, letterSpacing: "0.07em",
                  textTransform: "uppercase", color: "#7a3040",
                  fontFamily: "var(--font-display)", margin: 0,
                }}>Your shelves are empty</p>
                <p style={{ fontSize: 11, color: "#9a5060", marginTop: 5, lineHeight: 1.5 }}>
                  Add totes, shoulder bags, crossbody bags or clutches in the Handbags tab first.
                </p>
              </div>
            )}

            {/* Action bar background */}
            <div aria-hidden="true" style={{
              position: "absolute", top: pY(ir, LM.barY), left: 0, width: "100%",
              height: pH(ir, LM.barBot - LM.barY), zIndex: 18, pointerEvents: "none",
              background: "rgba(255,248,250,0.96)", borderTop: "1px solid rgba(220,150,160,0.25)",
            }} />

            {/* CTA buttons */}
            <div style={{
              position: "absolute",
              top: pY(ir, LM.barY), left: pX(ir, LM.doorL),
              width: pW(ir, LM.doorR - LM.doorL),
              height: pH(ir, LM.barBot - LM.barY),
              zIndex: 22, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AnimatePresence mode="wait">

                {/* IDLE: Spin It */}
                {phase === "idle" && !isSaveOpen && (
                  <motion.button
                    key="spin-btn"
                    initial={{ opacity: 0, scale: 0.88 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.88 }}
                    transition={{ type: "spring", stiffness: 360, damping: 26 }}
                    onClick={handleSpin} disabled={!hasItems}
                    style={{
                      width: "auto", minWidth: 160, maxWidth: 240,
                      paddingLeft: 32, paddingRight: 32,
                      height: 52, borderRadius: 28,
                      border: "2.5px solid #d4af37",
                      background: hasItems ? `linear-gradient(to bottom, ${PLUM}, ${PLUM_DARK})` : "rgba(140,20,50,0.25)",
                      color: hasItems ? "#ffffff" : "#9a6070",
                      fontWeight: 800, fontSize: 16, letterSpacing: "-0.01em",
                      textTransform: "uppercase", whiteSpace: "nowrap",
                      boxShadow: hasItems ? "3px 3px 0 rgba(0,0,0,0.85)" : "none",
                      cursor: hasItems ? "pointer" : "default",
                      fontFamily: "var(--font-display)",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    }}
                  >✨ Spin It!</motion.button>
                )}

                {/* SPINNING: dots */}
                {phase === "spinning" && (
                  <motion.div
                    key="dots" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{
                      display: "flex", gap: 6, padding: "0 24px", height: 44,
                      alignItems: "center", justifyContent: "center", borderRadius: 24,
                      background: "rgba(255,235,240,0.85)", border: "1.5px solid rgba(220,150,160,0.28)",
                    }}
                  >
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ repeat: Infinity, duration: 0.65, delay: i * 0.16, ease: "easeInOut" }}
                        style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD }}
                      />
                    ))}
                  </motion.div>
                )}

                {/* RESULT: Next + Save */}
                {phase === "result" && !isSaveOpen && (
                  <motion.div
                    key="result-btns"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    style={{ display: "flex", gap: 10, justifyContent: "center", width: "100%" }}
                  >
                    <button
                      onClick={handleRespin}
                      style={{
                        flexGrow: 0, flexShrink: 0, width: 130,
                        height: 44, borderRadius: 24, border: `2.5px solid ${GOLD}`,
                        background: `linear-gradient(to bottom, ${PLUM}, ${PLUM_DARK})`,
                        color: "#ffffff", fontFamily: "var(--font-display)",
                        fontWeight: 800, fontSize: 14, letterSpacing: "-0.01em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                        boxShadow: "2px 2px 0 rgba(0,0,0,0.85)", cursor: "pointer",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 2, padding: "0 12px",
                      }}
                    >
                      <span>Respin</span><span style={{ fontSize: 14, lineHeight: 1 }}>✨</span>
                    </button>
                    <button
                      onClick={() => setIsSaveOpen(true)} disabled={!canSave}
                      style={{
                        flexGrow: 0, flexShrink: 0, width: 130,
                        height: 44, borderRadius: 24, border: `2.5px solid ${GOLD}`,
                        background: canSave ? "#fff" : "rgba(240,240,240,0.80)",
                        color: "#4A3A3A", fontFamily: "var(--font-display)",
                        fontWeight: 800, fontSize: 14, letterSpacing: "-0.01em",
                        textTransform: "uppercase", whiteSpace: "nowrap",
                        boxShadow: canSave ? "2px 2px 0 rgba(0,0,0,0.85)" : "none",
                        cursor: canSave ? "pointer" : "default", opacity: canSave ? 1 : 0.5,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 2, padding: "0 12px",
                      }}
                    >
                      <span>Save It</span><span style={{ fontSize: 14, lineHeight: 1 }}>♡</span>
                    </button>
                  </motion.div>
                )}

                {/* SAVE INPUT */}
                {isSaveOpen && (
                  <motion.div
                    key="save-input"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                    style={{ display: "flex", gap: 6, width: "100%", padding: "0 8px" }}
                  >
                    <input
                      autoFocus type="text" placeholder="Name this look…"
                      value={saveName} onChange={e => setSaveName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSave()}
                      style={{
                        flex: 1, height: 38, borderRadius: 20, padding: "0 14px",
                        fontSize: 13, fontWeight: 600, color: "#5a2030",
                        background: "rgba(255,252,248,0.98)",
                        border: "1.5px solid rgba(220,150,160,0.50)",
                        boxShadow: "0 3px 12px rgba(0,0,0,0.13)", outline: "none",
                      }}
                    />
                    <button
                      onClick={() => { setIsSaveOpen(false); setSaveName(""); }}
                      style={{
                        width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                        background: "rgba(255,248,250,0.97)",
                        border: "1.5px solid rgba(220,150,160,0.36)",
                        display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
                      }}
                    ><X style={{ width: 14, height: 14, color: GOLD_LIGHT }} /></button>
                    <button
                      onClick={handleSave} disabled={!saveName.trim() || saveOutfit.isPending}
                      style={{
                        padding: "0 14px", height: 36, borderRadius: 20, flexShrink: 0,
                        background: `linear-gradient(to bottom, ${PLUM}, ${PLUM_DARK})`,
                        color: GOLD_LIGHT, fontWeight: 700, fontSize: 13, border: `1.5px solid ${GOLD}`,
                        boxShadow: "0 3px 10px rgba(220,100,130,0.30)",
                        opacity: (!saveName.trim() || saveOutfit.isPending) ? 0.42 : 1,
                        cursor: "pointer",
                      }}
                    >{saveOutfit.isPending ? "…" : "Save ♡"}</button>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </>
        );
      })()}
    </div>
  );
}
