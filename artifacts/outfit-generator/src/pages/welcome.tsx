/**
 * WelcomePage — Handbag hero image fades in, user taps to enter.
 *
 * SPLASH  : Hero handbag image fills screen with title overlay.
 * EXITING : Whole screen fades out → onEnter().
 */

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";

const EXIT_MS = 600;

interface Props { onEnter: () => void; }

export default function WelcomePage({ onEnter }: Props) {
  const [exiting, setExiting] = useState(false);
  const calledRef = useRef(false);

  const finish = useCallback(() => {
    if (calledRef.current) return;
    calledRef.current = true;
    onEnter();
  }, [onEnter]);

  const handleTap = () => {
    if (exiting) return;
    setExiting(true);
    setTimeout(finish, EXIT_MS);
  };

  return (
    <motion.div
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: EXIT_MS / 1000, ease: "easeIn" }}
      onClick={handleTap}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        cursor: "pointer",
        overflow: "hidden",
        background: "#3D0810",
      }}
    >
      {/* ── Hero handbag image ── */}
      <motion.img
        src="/handbag-hero.jpg"
        alt="My Digital Handbags"
        draggable={false}
        initial={{ opacity: 0, scale: 1.04 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", objectPosition: "center top",
          pointerEvents: "none",
        }}
      />

      {/* ── Dark gradient overlay at top and bottom ── */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "linear-gradient(180deg, rgba(30,4,10,0.72) 0%, rgba(30,4,10,0.0) 38%, rgba(30,4,10,0.0) 55%, rgba(30,4,10,0.75) 100%)",
      }} />

      {/* ── Title at top ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.5 }}
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top) + 24px)",
          left: 0, right: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          zIndex: 10, pointerEvents: "none",
        }}
      >
        <div style={{
          fontFamily: "'Great Vibes', cursive",
          fontSize: "clamp(40px, 12vw, 58px)",
          color: "#f0d080",
          textShadow: "0 2px 20px rgba(0,0,0,0.9), 0 1px 6px rgba(0,0,0,1)",
          lineHeight: 1.1, textAlign: "center",
        }}>
          My Digital<br />Handbags
        </div>
      </motion.div>

      {/* ── Tap button at bottom ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.9 }}
        style={{
          position: "absolute",
          bottom: "calc(env(safe-area-inset-bottom) + 52px)",
          left: 0, right: 0, textAlign: "center",
          zIndex: 10, pointerEvents: "none",
        }}
      >
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 10,
          background: "rgba(125,21,40,0.88)",
          border: "1.5px solid rgba(240,208,128,0.45)",
          borderRadius: 30,
          padding: "13px 36px",
          color: "#fff",
          fontSize: 15, fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}>
          {/* handbag icon */}
          <svg width="20" height="18" viewBox="0 0 20 18" fill="none">
            <path d="M6 5C6 3 7.5 1 10 1C12.5 1 14 3 14 5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            <rect x="2" y="5" width="16" height="12" rx="3" stroke="white" strokeWidth="1.5"/>
            <line x1="2" y1="10" x2="18" y2="10" stroke="white" strokeWidth="0.8" strokeOpacity="0.5"/>
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

      {/* ── Footer links ── */}
      <div style={{
        position: "fixed", bottom: "calc(env(safe-area-inset-bottom) + 10px)",
        left: 0, right: 0, display: "flex", flexDirection: "column",
        alignItems: "center", gap: 4, zIndex: 210,
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
