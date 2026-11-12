/* eslint-disable @next/next/no-img-element -- miniaturas locais, sem iframe por cartão */
import type { CSSProperties } from "react";
import { demoDesigns } from "@/lib/demos/designs";
import type { LeadDemo } from "@/lib/demos/model";
import styles from "./demo-cover.module.css";
import { approvedConcepts } from "@/lib/demos/concepts";
import { GeneratedDemoSite } from "./generated-demo-site";

export function DemoCover({ demo }: { demo: LeadDemo }) {
  if (demo.version === 5 && demo.creation) return <div aria-hidden inert className={styles.generatedCover}><div className={styles.generatedScale}><GeneratedDemoSite business={demo.business} creation={demo.creation} cover /></div></div>;
  if (demo.version === 4 && demo.conceptId) return <div aria-hidden className={styles.cover}>
    <div className={styles.chrome}><i /><i /><i /><span>{demo.business.name}</span></div>
    <img className={styles.conceptCover} src={approvedConcepts[demo.conceptId].media.cover} alt="" width={1440} height={1000} loading="lazy" />
  </div>;
  const design = demo.version === 3 ? demo.design : undefined;
  const d = { ...demoDesigns[demo.business.segment], ...design };
  const visualClass = design ? `${styles.personalized} ${styles[design.layout]} ${styles[design.typography]}` : styles[demo.business.segment];
  return <div aria-hidden className={`${styles.cover} ${visualClass}`} style={{ "--cover-paper": d.paper, "--cover-ink": d.ink, "--cover-accent": d.accent, "--photo-position": design?.photoPosition ?? "center" } as CSSProperties}>
    <div className={styles.chrome}><i /><i /><i /><span>{demo.business.name}</span></div>
    {demo.version === 1 ? <div className={styles.legacy}><span>{demo.business.name}</span><small>Conceito original · atualizar visual disponível</small></div> : <div className={styles.page}>
      <div className={styles.miniHeader}>{demo.business.name}<span>Conheça &nbsp; Contato</span></div>
      <div className={styles.hero}><div className={styles.copy}><small>{demo.business.city}</small><strong>{d.headline}</strong><em>Informações e contato</em></div><img src={`/demos/${d.photo}.jpg`} alt="" width={300} height={250} loading="lazy" /></div>
      <div className={styles.miniFooter}><span>{d.storyTitle}</span><i /></div>
    </div>}
  </div>;
}
