/**
 * HeroSplash — Phase 1 of the splash sequence.
 * Full-screen hero image with "Welcome to / My Digital Handbags" branding near
 * the bottom. Auto-advances after 2.5 s with no user interaction required.
 * Tap anywhere to skip ahead.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  onContinue: () => void;
}

const HOLD_MS = 2500;

export default function HeroSplash({ onContinue }: Props) {
  useEffect(() => {
    const t = setTimeout(onContinue, HOLD_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      onClick={onContinue}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        cursor: "pointer",
        background: "#1a0a10",
        overflow: "hidden",
      }}
    >
      {/* Full-screen hero image */}
      <img
        src="/hero-splash.jpg"
        alt="My Digital Handbags"
        draggable={false}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center top",
          userSelect: "none",
          pointerEvents: "none",
        }}
      />

      {/* Dark gradient over lower portion for text readability */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.5) 28%, transparent 58%)",
        pointerEvents: "none",
        zIndex: 1,
      }} />

      {/* Branding near the bottom */}
      <div style={{
        position: "absolute",
        bottom: "max(88px, calc(env(safe-area-inset-bottom) + 68px))",
        left: 0,
        right: 0,
        textAlign: "center",
        zIndex: 2,
        pointerEvents: "none",
        userSelect: "none",
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          color: "rgba(247,242,236,0.65)",
          marginBottom: 10,
        }}>
          Welcome to
        </div>
        <div style={{
          fontFamily: "'Great Vibes', cursive",
          fontWeight: 400,
          fontSize: "clamp(38px, 11vw, 56px)",
          color: "#ffffff",
          textShadow: "0 0 32px rgba(255,255,255,0.22), 0 2px 12px rgba(0,0,0,0.95)",
          lineHeight: 1.15,
        }}>
          My Digital<br />Handbags
        </div>
      </div>
    </motion.div>
  );
}
