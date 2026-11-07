"use client";

import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { isValidElement, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactElement } from "react";
import "./branched-menu.css";

export interface BranchedMenuLink {
  value: string;
  label: string;
  icon?: IconSvgElement | ReactElement;
}

export interface BranchedMenuSection {
  label: string;
  children: BranchedMenuLink[];
}

interface BranchedMenuProps {
  items: BranchedMenuSection[];
  defaultOpen?: number | number[];
  defaultActive?: string;
  activeValue?: string;
  compact?: boolean;
  onSelect?: (value: string, item: BranchedMenuLink) => void;
  onToggle?: (index: number, open: boolean) => void;
  color?: string;
  accentColor?: string;
  lineColor?: string;
  width?: number;
  rowHeight?: number;
  indent?: number;
  trunk?: number;
  radius?: number;
  lineWidth?: number;
  fontSize?: number;
  drawDuration?: number;
  foldDuration?: number;
  className?: string;
}

const PAD = 6;
const MARK = 16;
const toSet = (open: number | number[]) => new Set(Array.isArray(open) ? open : open >= 0 ? [open] : []);
const renderIcon = (icon: IconSvgElement | ReactElement) =>
  isValidElement(icon) ? icon : <HugeiconsIcon icon={icon as IconSvgElement} size={18} strokeWidth={1.8} />;

/** Adaptado do BranchedMenu do React Bits fornecido no briefing. */
export default function BranchedMenu({
  items,
  defaultOpen = [0, 1, 2],
  defaultActive = "",
  activeValue,
  compact = false,
  onSelect,
  onToggle,
  color = "var(--ink)",
  accentColor = "var(--nav-accent)",
  lineColor = "var(--nav-line)",
  width = 224,
  rowHeight = 44,
  indent = 36,
  trunk = 12,
  radius = 10,
  lineWidth = 1.5,
  fontSize = 13.5,
  drawDuration = 400,
  foldDuration = 300,
  className = "",
}: BranchedMenuProps) {
  const id = useId();
  const [selection, setSelection] = useState(defaultActive);
  const active = activeValue ?? selection;
  const activeSection = items.findIndex((item) => item.children.some((kid) => kid.value === active));
  const [expansion, setExpansion] = useState(() => ({ active, open: toSet(defaultOpen) }));
  let open = expansion.open;
  // Uma mudança de rota reabre a seção de destino sem remontar o menu.
  if (expansion.active !== active) {
    open = new Set(open);
    if (activeSection >= 0) open.add(activeSection);
    setExpansion({ active, open });
  }
  const navRef = useRef<HTMLElement>(null);
  const heads = useRef<(HTMLButtonElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);
  const markerShown = !compact && activeSection >= 0 && open.has(activeSection);

  useLayoutEffect(() => {
    const place = (glide: boolean) => {
      const marker = markerRef.current;
      const head = heads.current[activeSection];
      if (!marker) return;
      const shown = markerShown && head;
      if (!glide) marker.style.transition = "none";
      if (shown) marker.style.top = `${head.offsetTop + (head.offsetHeight - MARK) / 2}px`;
      marker.toggleAttribute("data-on", Boolean(shown));
      if (!glide) {
        void marker.offsetHeight;
        marker.style.transition = "";
      }
    };
    place(true);
    const observer = new ResizeObserver(() => place(false));
    if (navRef.current) observer.observe(navRef.current);
    return () => observer.disconnect();
  }, [activeSection, markerShown, items, fontSize, rowHeight, compact]);

  const toggle = (index: number) => {
    const next = new Set(open);
    const isOpen = !next.has(index);
    if (isOpen) next.add(index);
    else next.delete(index);
    setExpansion({ active, open: next });
    onToggle?.(index, isOpen);
  };

  const moveFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[data-bm-focus]"))
      .filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
    const index = controls.indexOf(event.target as HTMLElement);
    if (index < 0 || !controls.length) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1
      : (index + (event.key === "ArrowDown" ? 1 : -1) + controls.length) % controls.length;
    controls[next].focus();
  };

  const r = Math.min(radius, rowHeight / 2 - 2);
  const endX = indent - 8;
  const rowY = (index: number) => PAD + index * rowHeight + rowHeight / 2;
  const branch = (index: number) => `M ${trunk} ${rowY(index) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(index)} H ${endX}`;
  const reach = (index: number) => `M ${trunk} 0 V ${rowY(index) - r} A ${r} ${r} 0 0 0 ${trunk + r} ${rowY(index)} H ${endX}`;
  const length = (index: number) => rowY(index) - r + (Math.PI * r) / 2 + endX - trunk - r;

  return (
    <nav
      ref={navRef}
      aria-label="Principal"
      className={`branched-menu ${className}`}
      data-compact={compact ? "" : undefined}
      onKeyDown={moveFocus}
      style={{
        "--bm-w": `${width}px`, "--bm-ink": color, "--bm-accent": accentColor, "--bm-line": lineColor,
        "--bm-font": `${fontSize}px`, "--bm-row": `${rowHeight}px`, "--bm-indent": `${indent}px`,
        "--bm-line-w": lineWidth, "--bm-draw": `${drawDuration}ms`, "--bm-fold": `${foldDuration}ms`,
      } as CSSProperties}
    >
      <span ref={markerRef} className="branched-menu__marker" aria-hidden="true" />
      {items.map((item, index) => {
        const kids = item.children;
        const isOpen = compact || open.has(index);
        const bodyH = PAD * 2 + kids.length * rowHeight;
        return (
          <div key={item.label} className="branched-menu__section" data-open={isOpen ? "" : undefined}>
            <button
              ref={(element) => { heads.current[index] = element; }}
              type="button"
              className="branched-menu__head"
              aria-expanded={isOpen}
              aria-controls={`${id}-${index}`}
              data-bm-focus
              tabIndex={compact ? -1 : 0}
              onClick={() => toggle(index)}
              onKeyDown={(event) => {
                if ((event.key === "ArrowRight" && !isOpen) || (event.key === "ArrowLeft" && isOpen)) {
                  event.preventDefault();
                  toggle(index);
                }
              }}
            >
              {item.label}
              <ChevronDown className="branched-menu__chevron" size={14} aria-hidden="true" />
            </button>
            <div id={`${id}-${index}`} className="branched-menu__body" aria-hidden={!isOpen}>
              <div className="branched-menu__fold">
                <div className="branched-menu__tree" style={{ height: bodyH }}>
                  <svg className="branched-menu__lines" width={indent} height={bodyH} aria-hidden="true">
                    <path className="branched-menu__base" d={`M ${trunk} 0 V ${rowY(kids.length - 1) - r}`} />
                    {kids.map((kid, k) => <path key={kid.value} className="branched-menu__base" d={branch(k)} />)}
                    {kids.map((kid, k) => (
                      <path key={kid.value} className="branched-menu__reach" d={reach(k)}
                        style={{ strokeDasharray: length(k), strokeDashoffset: kid.value === active ? 0 : length(k) }} />
                    ))}
                  </svg>
                  {kids.map((kid) => (
                    <Link
                      key={kid.value}
                      href={kid.value}
                      className="branched-menu__item"
                      aria-current={kid.value === active ? "page" : undefined}
                      aria-label={compact ? kid.label : undefined}
                      title={compact ? kid.label : undefined}
                      data-active={kid.value === active ? "" : undefined}
                      data-bm-focus
                      tabIndex={isOpen ? 0 : -1}
                      onClick={(event) => {
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                        if (activeValue === undefined) setSelection(kid.value);
                        onSelect?.(kid.value, kid);
                      }}
                    >
                      {kid.icon && <span className="branched-menu__icon" aria-hidden="true">{renderIcon(kid.icon)}</span>}
                      <span className="branched-menu__label">{kid.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
