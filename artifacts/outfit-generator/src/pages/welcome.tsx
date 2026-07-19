/**
 * WelcomePage — Burgundy handbag unzip animation.
 *
 * SPLASH    : side-view burgundy handbag with handles, gold zipper, branding.
 * UNZIPPING : zipper pull slides left→right (pixel-based); interior wipes open.
 * ZOOMING   : whole bag scales up — camera dives into the opening.
 * HERO      : hero image crossfades in at peak zoom.
 * EXITING   : whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence, useAnimation } from "framer-motion";

type Phase = "splash" | "unzipping" | "zooming" | "hero" | "exiting";

const UNZIP_MS = 1500;
const ZOOM_MS  = 950;
const HERO_MS  = 800;
const HOLD_MS  = 400;
const EXIT_MS  = 700;

const GOLD    = "#d4af37";
const GOLD_LT = "#f0d080";

// ── Handbag geometry (all in SVG px) ─────────────────────────────────────────
const W  = 300;   // SVG canvas width
const H  = 260;   // SVG canvas height
const BX = 18;    // body left
const BY = 78;    // body top  (handles sit above this)
const BW = 264;   // body width
const BH = 158;   // body height
const BR = 18;    // body corner radius

// Zipper track runs across the top of the body
const ZIP_Y     = BY + 6;
const ZIP_X1    = BX + 12;
const ZIP_X2    = BX + BW - 12;
const ZIP_SPAN  = ZIP_X2 - ZIP_X1;   // total travel in px

// Pull tab width (so it stops before the right end-stop)
const PULL_W    = 18;
const PULL_TRAVEL = ZIP_SPAN - PULL_W;   // exact px to animate

// Gap below zipper (the opening that reveals the interior)
const GAP_TOP = BY + 13;
const GAP_H   = 24;

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase,       setPhase]       = useState<Phase>("splash");
  const [heroVisible, setHeroVisible] = useState(false);
  const calledRef   = useRef(false);
  const zipControls = useAnimation();   // zipper pull — x in px
  const bagControls = useAnimation();   // whole-bag zoom

  // SVG motion.rect for gap reveal — animated via rectControls
  const rectControls = useAnimation();  // rect width 0 → ZIP_SPAN

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = async () => {
    if (phase !== "splash") return;
    setPhase("unzipping");

    // Zipper pull slides right (pixel value — reliable)
    zipControls.start({
      x: PULL_TRAVEL,
      transition: { duration: UNZIP_MS / 1000, ease: [0.3, 0, 0.7, 1] },
    });

    // Interior wipes left→right (SVG rect width 0 → ZIP_SPAN)
    rectControls.start({
      width: ZIP_SPAN,
      transition: { duration: UNZIP_MS / 1000, ease: [0.3, 0, 0.7, 1] },
    });

    // After unzip → zoom bag into screen
    setTimeout(async () => {
      setPhase("zooming");
      bagControls.start({
        scale: 18,
        y: -30,
        opacity: 0,
        transition: { duration: ZOOM_MS / 1000, ease: [0.4, 0, 1, 1] },
      });
    }, UNZIP_MS + 60);

    setTimeout(() => setHeroVisible(true),  UNZIP_MS + ZOOM_MS * 0.4);
    setTimeout(() => setPhase("hero"),      UNZIP_MS + ZOOM_MS * 0.65);
    setTimeout(() => setPhase("exiting"),   UNZIP_MS + ZOOM_MS + HOLD_MS);
    setTimeout(finish,                      UNZIP_MS + ZOOM_MS + HOLD_MS + EXIT_MS);
  };

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={phase === "splash" ? handleTap : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "#130306",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: phase === "splash" ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 70% 55% at 50% 48%, rgba(120,10,35,0.45) 0%, transparent 70%)",
      }} />

      {/* Hero image */}
      <motion.img
        src="/handbag-hero.jpg"
        alt="Handbag collection"
        draggable={false}
        animate={{ opacity: heroVisible ? 1 : 0 }}
        transition={{ duration: HERO_MS / 1000, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0, width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center", zIndex: 1,
        }}
      />

      {/* Bag + branding wrapper — zooms on cue */}
      <motion.div
        animate={bagControls}
        style={{
          position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column", alignItems: "center",
          transformOrigin: "50% 36%",   // aim zoom toward the zipper opening
        }}
      >
        {/* ── Handbag illustration ── */}
        <div style={{
          position: "relative", width: W, height: H,
          filter: "drop-shadow(0 20px 50px rgba(0,0,0,0.9)) drop-shadow(0 4px 16px rgba(120,10,35,0.55))",
        }}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none">

            {/* ── Handles ─────────────────────────────── */}
            {/* Left handle */}
            <path
              d={`M ${BX+62} ${BY} C ${BX+62} ${BY-46}, ${BX+96} ${BY-58}, ${BX+110} ${BY-58}
                  C ${BX+124} ${BY-58}, ${BX+158} ${BY-46}, ${BX+158} ${BY}`}
              stroke="#c4a035" strokeWidth="9" strokeLinecap="round" fill="none"
            />
            {/* Handle inner highlight */}
            <path
              d={`M ${BX+62} ${BY} C ${BX+62} ${BY-42}, ${BX+96} ${BY-53}, ${BX+110} ${BY-53}
                  C ${BX+124} ${BY-53}, ${BX+158} ${BY-42}, ${BX+158} ${BY}`}
              stroke="#e8c050" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.35"
            />

            {/* ── D-ring hardware at handle bases ── */}
            {[BX+54, BX+166].map((x, i) => (
              <g key={i}>
                <rect x={x} y={BY-6} width={16} height={12} rx={4}
                  fill="url(#hwGold)" stroke="#c4a035" strokeWidth="0.7" />
              </g>
            ))}

            {/* ── Bag body ── */}
            <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
              fill="url(#bagGrad)" />
            {/* Body border */}
            <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
              fill="none" stroke="#c4a03550" strokeWidth="1.2" />

            {/* Plaid texture */}
            <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
              fill="url(#plaidH)" opacity="0.065" />
            <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
              fill="url(#plaidV)" opacity="0.065" />

            {/* Leather sheen */}
            <rect x={BX} y={BY} width={BW} height={BH} rx={BR}
              fill="url(#sheen)" opacity="0.16" />

            {/* Stitching border */}
            <rect x={BX+9} y={BY+9} width={BW-18} height={BH-18} rx={BR-5}
              fill="none" stroke="#c4a03525" strokeWidth="1" strokeDasharray="5 4" />

            {/* ── Centre turnlock clasp ── */}
            <rect x={BX+BW/2-22} y={BY+BH/2-12} width={44} height={24} rx={7}
              fill="url(#hwGold)" opacity="0.8" />
            <rect x={BX+BW/2-22} y={BY+BH/2-12} width={44} height={24} rx={7}
              fill="none" stroke="#c4a035" strokeWidth="0.9" />
            <circle cx={BX+BW/2} cy={BY+BH/2} r={6}
              fill="url(#studGrad)" stroke="#c4a03560" strokeWidth="0.7" />

            {/* ── Bag feet (4 corners) ── */}
            {[BX+24, BX+BW-24].map((x, i) => (
              <ellipse key={i} cx={x} cy={BY+BH+3} rx={7} ry={4}
                fill="url(#hwGold)" stroke="#a07820" strokeWidth="0.7" />
            ))}

            {/* ── Dark interior backing (always visible at gap) ── */}
            <clipPath id="bagClip">
              <rect x={BX} y={BY} width={BW} height={BH} rx={BR} />
            </clipPath>
            <rect x={ZIP_X1} y={GAP_TOP} width={ZIP_SPAN} height={GAP_H}
              fill="#08020f" clipPath="url(#bagClip)" />

            {/* ── Interior wipe reveal (SVG motion rect, width 0 → ZIP_SPAN) ── */}
            <motion.rect
              animate={rectControls}
              initial={{ width: 0 }}
              x={ZIP_X1}
              y={GAP_TOP}
              height={GAP_H}
              fill="url(#interiorGrad)"
              clipPath="url(#bagClip)"
            />

            {/* ── Zipper track ── */}
            <line x1={ZIP_X1} y1={ZIP_Y} x2={ZIP_X2} y2={ZIP_Y}
              stroke={`${GOLD}cc`} strokeWidth="3" strokeLinecap="round" />
            {/* Teeth */}
            <line x1={ZIP_X1} y1={ZIP_Y} x2={ZIP_X2} y2={ZIP_Y}
              stroke="rgba(0,0,0,0.28)" strokeWidth="3"
              strokeDasharray="4 5" strokeLinecap="butt" />
            {/* End stops */}
            <circle cx={ZIP_X1} cy={ZIP_Y} r={4} fill={GOLD} />
            <circle cx={ZIP_X2} cy={ZIP_Y} r={4} fill={GOLD} />

            <defs>
              <linearGradient id="bagGrad" x1="0" y1="0" x2="0.2" y2="1">
                <stop offset="0%"   stopColor="#8c1e2e" />
                <stop offset="30%"  stopColor="#5C0F1E" />
                <stop offset="70%"  stopColor="#3d0f18" />
                <stop offset="100%" stopColor="#250a10" />
              </linearGradient>
              <pattern id="plaidH" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="20" height="1.5" y="9" fill="white" />
              </pattern>
              <pattern id="plaidV" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <rect width="1.5" height="20" x="9" fill="white" />
              </pattern>
              <linearGradient id="sheen" x1="0" y1="0" x2="0.7" y2="1">
                <stop offset="0%"   stopColor="white" stopOpacity="0.11" />
                <stop offset="45%"  stopColor="white" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="hwGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#f0d060" />
                <stop offset="50%"  stopColor="#a07820" />
                <stop offset="100%" stopColor="#d4af37" />
              </linearGradient>
              <radialGradient id="studGrad" cx="35%" cy="30%" r="65%">
                <stop offset="0%"   stopColor="#fff8c0" />
                <stop offset="100%" stopColor="#806010" />
              </radialGradient>
              <linearGradient id="interiorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#040010" />
                <stop offset="100%" stopColor="#180510" />
              </linearGradient>
            </defs>
          </svg>

          {/* ── Zipper pull tab (DOM, slides in pixels) ── */}
          <motion.div
            animate={zipControls}
            initial={{ x: 0 }}
            style={{
              position: "absolute",
              top: ZIP_Y - 16,
              left: ZIP_X1,
              display: "flex", flexDirection: "column", alignItems: "center",
              zIndex: 20, pointerEvents: "none",
            }}
          >
            {/* Loop connector */}
            <div style={{
              width: 10, height: 7, borderRadius: 2,
              background: `linear-gradient(180deg, ${GOLD_LT}, ${GOLD})`,
              border: "0.6px solid rgba(180,140,20,0.9)",
            }} />
            {/* Pull body */}
            <div style={{
              width: PULL_W, height: 22, borderRadius: 4, marginTop: 1,
              background: `linear-gradient(150deg, ${GOLD_LT} 0%, ${GOLD} 55%, #a07820 100%)`,
              border: "0.8px solid rgba(180,140,20,0.95)",
              boxShadow: "0 3px 8px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,240,160,0.45)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{ width: 8, height: 1.5, background: "rgba(0,0,0,0.35)", borderRadius: 1 }} />
            </div>
          </motion.div>
        </div>

        {/* ── Branding ── */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <div style={{
            fontFamily: "'Great Vibes', cursive",
            fontWeight: 400,
            fontSize: "clamp(38px, 11vw, 56px)",
            color: "#f0d080",
            textShadow: "0 0 32px rgba(212,175,55,0.5), 0 2px 10px rgba(0,0,0,0.9)",
            lineHeight: 1.15,
          }}>
            My Digital<br />Handbags
          </div>
          <div style={{
            fontSize: 10, fontWeight: 500,
            letterSpacing: "0.28em", textTransform: "uppercase",
            color: "rgba(247,242,236,0.5)", marginTop: 7,
          }}>
            your collection, curated
          </div>

          <AnimatePresence>
            {phase === "splash" && (
              <motion.div
                key="tap-hint"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                style={{
                  fontSize: 10, letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "rgba(247,242,236,0.55)", marginTop: 18,
                }}
              >
                tap to open
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Footer */}
      <div style={{
        position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
      }}>
        <a href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.02em" }}>
          Privacy Policy
        </a>
        <a href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.22)", textDecoration: "none", letterSpacing: "0.02em" }}>
          Support
        </a>
      </div>
    </motion.div>
  );
}
