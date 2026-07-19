/**
 * HeroSplash — full-screen hero image shown once on first launch.
 * Fades in, holds for 2.5 s, then fades out into the welcome screen.
 * Tap anywhere to skip ahead.
 */
import { useEffect } from "react";
import { motion } from "framer-motion";

interface Props {
  onContinue: () => void;
}

// 650 ms fade-in + 1000 ms fully visible before fade-out begins
const HOLD_MS = 1650;

export default function HeroSplash({ onContinue }: Props) {
  // Auto-advance after hold period — ref avoids resetting timer if parent re-renders
  useEffect(() => {
    const t = setTimeout(onContinue, HOLD_MS);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65 }}
      onClick={onContinue}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        cursor: "pointer",
        background: "#1a0a10",
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

    </motion.div>
  );
}
