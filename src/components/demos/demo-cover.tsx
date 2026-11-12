/* eslint-disable @next/next/no-img-element -- miniaturas locais, sem iframe por cartão */
import type { CSSProperties } from "react";
import { demoDesigns } from "@/lib/demos/designs";
import { demoVariant, monogram } from "@/lib/demos/kinds";
import type { LeadDemo } from "@/lib/demos/model";
import styles from "./demo-cover.module.css";

export function DemoCover({ demo }: { demo: LeadDemo }) {
  if (demo.version === 3) return <CoverV3 demo={demo} />;
  const d = demoDesigns[demo.business.segment];
  return <div aria-hidden className={`${styles.cover} ${styles[demo.business.segment]}`} style={{ "--cover-paper": d.paper, "--cover-ink": d.ink, "--cover-accent": d.accent } as CSSProperties}>
    <div className={styles.chrome}><i /><i /><i /><span>{demo.business.name}</span></div>
    {demo.version === 1 ? <div className={styles.legacy}><span>{demo.business.name}</span><small>Conceito original · atualizar visual disponível</small></div> : <div className={styles.page}>
      <div className={styles.miniHeader}>{demo.business.name}<span>Conheça &nbsp; Contato</span></div>
      <div className={styles.hero}><div className={styles.copy}><small>{demo.business.city}</small><strong>{d.headline}</strong><em>Informações e contato</em></div><img src={`/demos/${d.photo}.jpg`} alt="" width={300} height={250} loading="lazy" /></div>
      <div className={styles.miniFooter}><span>{d.storyTitle}</span><i /></div>
    </div>}
  </div>;
}

/** Miniatura fiel à demo v3: mesma paleta, título, layout e tipografia. */
function CoverV3({ demo }: { demo: LeadDemo }) {
  const v = demoVariant(demo.business);
  const photo = v.layout !== "type" && v.spec.photo;
  return <div aria-hidden className={`${styles.cover} ${styles.v3} ${styles[`l_${v.layout}`]} ${styles[`t_${v.spec.type}`]}`} style={{ "--cover-paper": v.palette.paper, "--cover-ink": v.palette.ink, "--cover-accent": v.palette.accent } as CSSProperties}>
    <div className={styles.chrome}><i /><i /><i /><span>{demo.business.name}</span></div>
    <div className={styles.page}>
      <div className={styles.miniHeader}>{demo.business.name}<span>Conheça &nbsp; Contato</span></div>
      <div className={styles.hero}>
        {v.layout === "type" && <div className={styles.mono}><b>{monogram(demo.business.name)}</b><small>{v.spec.label}</small></div>}
        <div className={styles.copy}><small>{v.spec.label} · {demo.business.city}</small><strong>{v.headline}</strong><em>Informações e contato</em></div>
        {photo && <img src={`/demos/${photo}.jpg`} alt="" width={300} height={250} loading="lazy" />}
      </div>
    </div>
  </div>;
}
