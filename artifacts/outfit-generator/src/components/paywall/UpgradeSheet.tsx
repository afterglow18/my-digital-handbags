/**
 * UpgradeSheet — full-screen paywall, one page, no scroll.
 * Pink/rose palette to match app brand.
 */
import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { useEntitlements, type PurchaseResult } from "@/hooks/useEntitlements";
import type { PurchaseProduct } from "@/types/local";

export type UpgradeReason = "items" | "outfits" | "mannequin";

interface Props {
  reason:  UpgradeReason;
  onClose: () => void;
}

// ── Brand colours — Spin It button palette ───────────────────────────────────
const ROSE       = "#7D1528";   // icon burgundy (button top)
const ROSE_DARK  = "#5C0F1E";   // icon burgundy dark (button bottom)
const ROSE_LIGHT = "#fdf0f2";   // very light blush tint for selected card bg
const ROSE_MID   = "#d4af37";   // gold border / badge colour

// ── Data ─────────────────────────────────────────────────────────────────────
const FEATURES = [
  "Unlimited handbags",
  "Unlimited saved looks",
  "Save your entire handbag collection",
  "One-time payment options",
] as const;

type Plan = {
  id:     PurchaseProduct;
  label:  string;
  price:  string;
  per:    string;
  badge?: string;
  perks:  string[];
};

const PLANS: Plan[] = [
  {
    id:    "monthly",
    label: "MONTHLY",
    price: "$1.99",
    per:   "/month",
    perks: ["Cancel anytime", "Billed monthly"],
  },
  {
    id:    "yearly",
    label: "YEARLY",
    price: "$19.99",
    per:   "/year",
    perks: ["Save 17%", "Billed yearly"],
  },
  {
    id:    "lifetime",
    label: "LIFETIME",
    price: "$9.99",
    per:   "one-time",
    badge: "BEST VALUE",
    perks: ["Pay once", "Yours forever"],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function UpgradeSheet({ onClose }: Props) {
  const { purchase } = useEntitlements();
  const [selected, setSelected] = useState<PurchaseProduct>("lifetime");
  const [status, setStatus]     = useState<"idle" | "pending">("idle");

  const selectedPlan = PLANS.find(p => p.id === selected)!;

  const handlePurchase = useCallback(async () => {
    if (status === "pending") return;
    setStatus("pending");
    const result: PurchaseResult = await purchase(selected);
    if (result === "success") {
      onClose();
    } else {
      setStatus("idle");
    }
  }, [status, purchase, selected, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 240 }}
      className="fixed inset-0 z-[80] flex flex-col max-w-md mx-auto overflow-hidden"
      style={{ background: "#FDF5F9" }}
    >

      {/* ── Hero strip ─────────────────────────────────────────────────── */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{
          paddingTop: "env(safe-area-inset-top)",
          minHeight: 64,
          backgroundColor: "#5C0F1E",
          backgroundImage: [
            // horizontal stripes — matching app icon plaid pattern
            "repeating-linear-gradient(0deg, transparent 0px, transparent 20px, rgba(40,0,12,0.38) 20px, rgba(40,0,12,0.38) 30px, rgba(255,255,255,0.45) 30px, rgba(255,255,255,0.45) 32px, rgba(40,0,12,0.38) 32px, rgba(40,0,12,0.38) 42px, transparent 42px, transparent 62px)",
            // vertical stripes
            "repeating-linear-gradient(90deg, transparent 0px, transparent 20px, rgba(40,0,12,0.38) 20px, rgba(40,0,12,0.38) 30px, rgba(255,255,255,0.45) 30px, rgba(255,255,255,0.45) 32px, rgba(40,0,12,0.38) 32px, rgba(40,0,12,0.38) 42px, transparent 42px, transparent 62px)",
          ].join(", "),
        }}
      >
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 3px 12px rgba(0,0,0,0.5), 0 0 0 2px rgba(212,175,55,0.5)",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
        }}>
          <img src="/app-icon.jpg" alt="My Digital Handbags"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
        <button
          onClick={onClose}
          style={{ top: "calc(env(safe-area-inset-top) + 10px)" }}
          className="absolute right-3 w-8 h-8 rounded-full bg-white/90
                     flex items-center justify-center border border-black/10
                     active:scale-95 transition-transform"
        >
          <X className="w-4 h-4 text-black/60" />
        </button>
      </div>

      {/* ── Title ──────────────────────────────────────────────────────── */}
      <div className="px-5 pt-4 pb-3 flex-shrink-0">
        <h1
          className="font-black uppercase leading-none tracking-tight"
          style={{ fontSize: 34, letterSpacing: "-0.02em" }}
        >
          UNLOCK YOUR<br />
          <span style={{ color: ROSE }}>HANDBAGS</span>
        </h1>
        <p className="text-xs font-semibold text-black/45 mt-1.5 tracking-wide">
          A premium feature — unlock it once.
        </p>
      </div>

      {/* ── Features card ──────────────────────────────────────────────── */}
      <div
        className="mx-5 mb-4 rounded-2xl flex-shrink-0"
        style={{ background: "#111" }}
      >
        <p
          className="px-4 pt-3 pb-1.5 font-bold text-[10px] uppercase tracking-widest"
          style={{ color: ROSE_MID }}
        >
          Upgrade &amp; get:
        </p>
        <ul className="px-4 pb-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2">
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: ROSE }}
              >
                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
              </span>
              <span className="text-white text-[11px] font-medium leading-tight">{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Plan picker ────────────────────────────────────────────────── */}
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-black/35 mb-2.5 flex-shrink-0">
        Choose your plan
      </p>
      <div className="px-5 flex gap-2 mb-4 flex-shrink-0">
        {PLANS.map(plan => {
          const active = selected === plan.id;
          return (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className="flex-1 flex flex-col items-start p-3 rounded-xl text-left transition-all"
              style={{
                position:  "relative",
                background: active ? ROSE_LIGHT : "white",
                border:     active ? `2px solid ${ROSE_MID}` : "2px solid #c8b8d8",
                boxShadow:  active ? `3px 3px 0 ${ROSE}` : "none",
              }}
            >
              {/* Best value badge */}
              {plan.badge && (
                <span
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap
                             text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: ROSE, color: "#fff" }}
                >
                  {plan.badge}
                </span>
              )}

              <span className="text-[9px] font-black uppercase tracking-widest text-black/45 mb-0.5">
                {plan.label}
              </span>
              <span className="font-black text-xl leading-none">
                {plan.price}
              </span>
              <span className="text-[10px] text-black/35 font-medium mb-2">
                {plan.per}
              </span>

              {plan.perks.map(perk => (
                <span key={perk} className="flex items-center gap-1 text-[9px] font-semibold text-black/55">
                  <Check
                    className="w-2.5 h-2.5 flex-shrink-0"
                    strokeWidth={3}
                    style={{ color: active ? ROSE : "#aaa" }}
                  />
                  {perk}
                </span>
              ))}
            </button>
          );
        })}
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <div
        className="px-5 flex flex-col gap-2.5 flex-shrink-0 mt-auto"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handlePurchase}
          disabled={status === "pending"}
          className="w-full py-4 rounded-xl font-black text-base uppercase tracking-wide
                     text-black transition-all active:translate-y-0.5 active:shadow-none
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            background: status === "pending" ? ROSE_DARK : `linear-gradient(to bottom, ${ROSE}, ${ROSE_DARK})`,
            border:     `2.5px solid ${ROSE_MID}`,
            boxShadow:  status === "pending" ? "none" : "3px 3px 0 rgba(0,0,0,0.85)",
            letterSpacing: "0.04em",
          }}
        >
          {status === "pending"
            ? "Opening checkout…"
            : selected === "monthly"
              ? `UNLOCK MONTHLY – ${selectedPlan.price} ›`
              : selected === "yearly"
                ? `UNLOCK YEARLY – ${selectedPlan.price} ›`
                : `UNLOCK FOREVER – ${selectedPlan.price} ›`}
        </button>

        <button
          onClick={onClose}
          className="text-sm font-bold text-black/35 text-center
                     underline underline-offset-2 hover:text-black/55 transition-colors"
        >
          Maybe Later
        </button>
      </div>
    </motion.div>
  );
}
