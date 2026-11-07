"use client";

import { useReducedMotion } from "motion/react";
import { useStore } from "./data/store";

/** Tokens de movimento (ver docs/DESIGN_SYSTEM.md › Motion). Segundos, para a lib motion. */
export const motionTokens = {
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
  easeIn: [0.55, 0, 1, 0.45] as [number, number, number, number],
  quick: 0.14,
  ui: 0.2,
  card: 0.32,
  stagger: 0.05,
  draw: 0.9,
  bars: 0.7,
  donut: 0.8,
  counter: 0.9,
};

/**
 * true quando animações decorativas podem rodar: respeita a preferência salva
 * em Configurações e, em "Sistema", o prefers-reduced-motion do dispositivo.
 */
export function useMotionEnabled(): boolean {
  const systemReduced = useReducedMotion();
  const { db } = useStore();
  const pref = db?.settings.appearance.motion ?? "system";
  if (pref === "full") return true;
  if (pref === "reduced") return false;
  return !systemReduced;
}

/** Variante de entrada para cards (stagger por índice). */
export function cardEntrance(index: number, enabled: boolean) {
  if (!enabled) return { initial: false as const };
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionTokens.card, ease: motionTokens.ease, delay: 0.04 + index * motionTokens.stagger },
  };
}
