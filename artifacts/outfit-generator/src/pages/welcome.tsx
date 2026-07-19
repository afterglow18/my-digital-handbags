/**
 * WelcomePage — Front door swings open to reveal the hero image.
 *
 * SPLASH   : Sage-green front door fills screen, "My Digital Handbags" above it.
 * OPENING  : Door swings open left on hinge (CSS 3D rotateY).
 * HOLD     : Hero image fully visible.
 * EXITING  : Whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "splash" | "opening" | "open" | "exiting";

const OPEN_MS  = 1000;
const HOLD_MS  = 600;
const EXIT_MS  = 600;

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [phase, setPhase] = useState<Phase>("splash");
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = () => {
    if (phase !== "splash") return;
    setPhase("opening");
    setTimeout(() => setPhase("open"),    OPEN_MS);
    setTimeout(() => setPhase("exiting"), OPEN_MS + HOLD_MS);
    setTimeout(finish,                    OPEN_MS + HOLD_MS + EXIT_MS);
  };

  return (
    <motion.div
      animate={{ opacity: phase === "exiting" ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={phase === "splash" ? handleTap : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        cursor: phase === "splash" ? "pointer" : "default",
        overflow: "hidden",
        background: "#2a3325",         /* deep sage — seen at edges of door */
      }}
    >
      {/* ── Hero image — always behind the door ── */}
      <motion.img
        src="/hero-home.jpg"
        alt="My Digital Handbags"
        draggable={false}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === "splash" ? 0 : 1 }}
        transition={{ duration: 0.25, ease: "easeIn" }}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "contain", objectPosition: "center center",
          pointerEvents: "none",
        }}
      />

      {/* ── 3-D door wrapper — perspective lives here ── */}
      <div style={{
        position: "absolute", inset: 0,
        perspective: "900px",
        perspectiveOrigin: "0% 50%",  /* hinge side = left */
      }}>
        <motion.div
          initial={{ rotateY: 0 }}
          animate={{ rotateY: phase === "opening" || phase === "open" || phase === "exiting" ? -108 : 0 }}
          transition={{ duration: OPEN_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: "absolute", inset: 0,
            transformOrigin: "left center",
            transformStyle: "preserve-3d",
            backfaceVisibility: "hidden",
          }}
        >
          {/* Door face */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(160deg, #5a6e45 0%, #4a5e38 40%, #3d5030 100%)",
            boxShadow: "inset -6px 0 24px rgba(0,0,0,0.35), inset 6px 0 8px rgba(255,255,255,0.06)",
          }}>
            {/* Door frame / surround */}
            <div style={{
              position: "absolute", inset: 0,
              border: "14px solid #2e3d22",
              borderRight: "10px solid #1e2a16",
              pointerEvents: "none",
            }} />

            {/* Top panel pair */}
            <DoorPanel top="12%" left="8%" width="38%" height="22%" />
            <DoorPanel top="12%" left="54%" width="38%" height="22%" />

            {/* Middle rail */}
            <div style={{
              position: "absolute", top: "37%", left: "8%", width: "84%", height: "3%",
              background: "rgba(0,0,0,0.18)", borderRadius: 2,
            }} />

            {/* Large lower panels */}
            <DoorPanel top="42%" left="8%" width="38%" height="34%" />
            <DoorPanel top="42%" left="54%" width="38%" height="34%" />

            {/* Bottom rail */}
            <div style={{
              position: "absolute", top: "79%", left: "8%", width: "84%", height: "2.5%",
              background: "rgba(0,0,0,0.18)", borderRadius: 2,
            }} />

            {/* Door knocker / handle */}
            <div style={{
              position: "absolute", top: "52%", right: "11%",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              {/* Knob */}
              <div style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "radial-gradient(circle at 35% 35%, #f0d060, #a07820)",
                boxShadow: "0 2px 6px rgba(0,0,0,0.6)",
              }} />
              {/* Escutcheon plate */}
              <div style={{
                width: 14, height: 36, borderRadius: 7,
                background: "linear-gradient(180deg, #e8c050, #8a6410)",
                boxShadow: "0 2px 4px rgba(0,0,0,0.5)",
              }} />
            </div>

            {/* Mail slot */}
            <div style={{
              position: "absolute", bottom: "17%", left: "50%", transform: "translateX(-50%)",
              width: "30%", height: 8, borderRadius: 3,
              background: "rgba(0,0,0,0.45)",
              border: "1.5px solid rgba(212,175,55,0.5)",
            }} />

            {/* Peephole */}
            <div style={{
              position: "absolute", top: "30%", left: "50%", transform: "translateX(-50%)",
              width: 10, height: 10, borderRadius: "50%",
              background: "#0a0e08",
              border: "1.5px solid rgba(212,175,55,0.6)",
              boxShadow: "0 0 6px rgba(0,0,0,0.8)",
            }} />

            {/* Subtle woodgrain lines */}
            {[18, 32, 46, 60, 74, 88].map(pct => (
              <div key={pct} style={{
                position: "absolute", top: 0, bottom: 0,
                left: `${pct}%`, width: 1,
                background: "rgba(0,0,0,0.07)",
                pointerEvents: "none",
              }} />
            ))}
          </div>

          {/* Door edge (right side, visible as door opens) */}
          <div style={{
            position: "absolute", top: 0, bottom: 0, right: -18, width: 18,
            background: "linear-gradient(90deg, #2e3d22, #1e2a16)",
            transform: "rotateY(90deg)",
            transformOrigin: "left center",
          }} />
        </motion.div>
      </div>

      {/* ── Branding above door — fades out as door opens ── */}
      <AnimatePresence>
        {phase === "splash" && (
          <motion.div
            key="branding"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              position: "absolute",
              top: "calc(env(safe-area-inset-top) + 16px)",
              left: 0, right: 0,
              display: "flex", flexDirection: "column", alignItems: "center",
              zIndex: 10, pointerEvents: "none",
            }}
          >
            <div style={{
              fontFamily: "'Great Vibes', cursive",
              fontSize: "clamp(38px, 11vw, 54px)",
              color: "#f0d080",
              textShadow: "0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.9)",
              lineHeight: 1.1, textAlign: "center",
            }}>
              My Digital<br />Handbags
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tap hint at bottom ── */}
      <AnimatePresence>
        {phase === "splash" && (
          <motion.div
            key="hint"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            style={{
              position: "absolute",
              bottom: "calc(env(safe-area-inset-bottom) + 52px)",
              left: 0, right: 0, textAlign: "center",
              zIndex: 10, pointerEvents: "none",
            }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              background: "rgba(107,122,82,0.88)",
              border: "1.5px solid rgba(255,255,255,0.3)",
              borderRadius: 30,
              padding: "13px 36px",
              color: "#fff",
              fontSize: 15, fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
              backdropFilter: "blur(4px)",
            }}>
              {/* door icon */}
              <svg width="18" height="20" viewBox="0 0 18 20" fill="none">
                <rect x="1" y="1" width="16" height="18" rx="2" stroke="white" strokeWidth="1.5"/>
                <circle cx="13.5" cy="10" r="1.5" fill="white"/>
                <line x1="9" y1="1" x2="9" y2="19" stroke="white" strokeWidth="0.8" strokeDasharray="2 2"/>
              </svg>
              Enter My Digital Handbags
            </div>
            <div style={{
              marginTop: 12, fontSize: 10, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.4)",
            }}>
              tap to open
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer links ── */}
      <div style={{
        position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
        pointerEvents: phase === "splash" ? "none" : "none",
      }}>
        <a href="https://classy-alpaca-441.notion.site/Privacy-Policy-39682db6065380b19dedcb108d4a0ef4"
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em", pointerEvents: "auto" }}>
          Privacy Policy
        </a>
        <a href="https://app.notion.com/p/My-Digital-Closet-Support-39782db60653802a9088dcbae84c0527?source=copy_link"
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.25)", textDecoration: "none", letterSpacing: "0.02em", pointerEvents: "auto" }}>
          Support
        </a>
      </div>
    </motion.div>
  );
}

function DoorPanel({ top, left, width, height }: { top: string; left: string; width: string; height: string }) {
  return (
    <div style={{
      position: "absolute", top, left, width, height,
      border: "2px solid rgba(0,0,0,0.25)",
      borderRadius: 4,
      background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.08) 100%)",
      boxShadow: "inset 2px 2px 4px rgba(255,255,255,0.08), inset -2px -2px 4px rgba(0,0,0,0.2)",
    }} />
  );
}
