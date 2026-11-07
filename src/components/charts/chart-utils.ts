"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** Mede o elemento (ResizeObserver) para gráficos SVG responsivos. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export interface Pt {
  x: number;
  y: number;
}

/** Curva suave monotônica (Fritsch–Carlson): sem "ondas" acima dos dados. */
export function smoothPath(points: Pt[]): string {
  const n = points.length;
  if (n === 0) return "";
  if (n === 1) return `M${points[0].x},${points[0].y}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    m.push((points[i + 1].y - points[i].y) / (dx[i] || 1));
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) {
      const k = 3 / Math.sqrt(s);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${points[i].x + h},${points[i].y + t[i] * h} ${points[i + 1].x - h},${points[i + 1].y - t[i + 1] * h} ${points[i + 1].x},${points[i + 1].y}`;
  }
  return d;
}

/** Escala "bonita" do eixo Y: máximo arredondado e 4–5 marcas. */
export function niceScale(maxValue: number, ticks = 5) {
  if (maxValue <= 0) return { max: ticks - 1, step: 1, values: Array.from({ length: ticks }, (_, i) => i) };
  const raw = maxValue / (ticks - 1);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= raw) ?? 10 * pow;
  const max = step * (ticks - 1);
  return { max, step, values: Array.from({ length: ticks }, (_, i) => i * step) };
}

/** Rótulos do eixo X sem aglomeração: no máximo `maxLabels` visíveis. */
export function labelEvery(count: number, width: number, minGap = 64) {
  const fit = Math.max(2, Math.floor(width / minGap));
  return Math.max(1, Math.ceil(count / fit));
}
