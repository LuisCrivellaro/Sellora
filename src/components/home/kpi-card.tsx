"use client";

import { ArrowDownRight, ArrowUpRight, Info, Minus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useId } from "react";
import { Tooltip } from "@/components/ui/overlay";
import { AnimatedCounter } from "@/components/ui/states";
import { cardEntrance, useMotionEnabled } from "@/lib/motion";
import { cn, formatInt, formatPercent } from "@/lib/utils";

export function HomeKpi({ title, metric, icon: Icon, href, note, featured = false, info, index }: {
  title: string;
  metric: { value: number; previous: number; change: number | null };
  icon: LucideIcon;
  href: string;
  note: string;
  featured?: boolean;
  info?: string;
  index: number;
}) {
  const id = useId();
  const enabled = useMotionEnabled();
  const ChangeIcon = metric.change === null || metric.change === 0 ? Minus : metric.change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <motion.section {...cardEntrance(index, enabled)} className={cn("facade home-kpi", featured && "home-kpi--featured")} aria-labelledby={id}>
      <div className="home-kpi-top">
        <span className="home-kpi-icon"><Icon size={17} strokeWidth={1.8} aria-hidden /></span>
        <Tooltip content={`Abrir ${title.toLowerCase()} no módulo correspondente`}>
          <Link href={href} className="home-kpi-link" aria-label={`Ver ${title.toLowerCase()}`}><ArrowUpRight size={17} aria-hidden /></Link>
        </Tooltip>
      </div>
      <h2 id={id} className="home-kpi-title">
        {title}
        {info && <Tooltip content={info}><button type="button" className="home-kpi-info" aria-label={`Informação sobre ${title.toLowerCase()}`}><Info size={13} aria-hidden /></button></Tooltip>}
      </h2>
      <div className="home-kpi-number-row">
        <AnimatedCounter value={metric.value} format={formatInt} className="home-kpi-number" />
        {metric.change !== null && (
          <Tooltip content={`${formatInt(metric.previous)} no intervalo anterior equivalente`}>
            <span tabIndex={0} className={cn("home-kpi-change tnum", metric.change > 0 ? "home-kpi-change--up" : metric.change < 0 ? "home-kpi-change--down" : "home-kpi-change--flat")} aria-label={`${metric.change > 0 ? "Aumento" : metric.change < 0 ? "Redução" : "Sem variação"}: ${formatPercent(Math.abs(metric.change), metric.change === 0 ? 0 : 1)}`}>
              <ChangeIcon size={13} aria-hidden />{formatPercent(Math.abs(metric.change), metric.change === 0 ? 0 : 1)}
            </span>
          </Tooltip>
        )}
      </div>
      <p className="home-kpi-comparison">{metric.change === null ? "Sem base no período anterior" : "Em relação ao período anterior"}</p>
      <p className="home-kpi-note">{note}</p>
    </motion.section>
  );
}
