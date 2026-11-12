/* Fotografias locais: licença e procedência em public/demos/ASSETS.md. */
/* eslint-disable @next/next/no-img-element -- imagens locais com dimensões, sem otimizador nas prévias */
import { ArrowRight, MapPin, Phone, MoveUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { demoVariant, monogram } from "@/lib/demos/kinds";
import type { DemoBusiness } from "@/lib/demos/model";
import styles from "./demo-site-v3.module.css";
import { handleDemoAnchor } from "./demo-anchor";

/** Demo v3: direção pelo tipo do negócio, paleta/título/layout pela variação do estabelecimento. */
export function DemoSiteV3({ business: b }: { business: DemoBusiness }) {
  const v = demoVariant(b);
  const { spec, palette } = v;
  const photo = v.layout !== "type" && spec.photo;
  return (
    <article
      onClick={handleDemoAnchor}
      className={`${styles.site} ${styles[v.layout]} ${styles[spec.type]}`}
      style={{ "--paper": palette.paper, "--ink": palette.ink, "--accent": palette.accent } as CSSProperties}
      data-kind={v.kind}
      data-layout={v.layout}
    >
      <div className={styles.notice}>Demonstração não oficial por Sellora. Imagens ilustrativas; conteúdo a validar com o estabelecimento.</div>
      <header className={styles.header} id="inicio">
        <a className={styles.brand} href="#inicio">{b.name}</a>
        <nav aria-label="Navegação da demo"><a href="#sobre">Conheça</a><a href="#informacoes">Informações</a><a href="#contato" className={styles.navContact}>Contato <MoveUpRight size={14} aria-hidden /></a></nav>
      </header>
      <section className={styles.hero} aria-label="Apresentação">
        <div className={styles.heroCopy}>
          <p className={styles.place}><MapPin size={14} aria-hidden />{spec.label} · {b.city}, {b.uf}</p>
          <h1>{v.headline}</h1>
          <p className={styles.intro}>{spec.intro} <strong>{b.name}</strong>, em {b.city}.</p>
          <a className={styles.cta} href="#contato">Informações e contato <ArrowRight size={18} aria-hidden /></a>
        </div>
        {photo && <figure className={styles.heroPhoto}><img src={`/demos/${photo}.jpg`} width={1400} height={1000} alt={spec.alt} fetchPriority="high" /><figcaption>Fotografia de referência, não representa o estabelecimento.</figcaption></figure>}
        {v.layout === "type" && <div className={styles.monogram} aria-hidden><span>{monogram(b.name)}</span><small>{spec.label}</small></div>}
      </section>
      <div className={styles.localLine}><span>{b.name}</span><span>{b.city} / {b.uf}</span><a href="#contato">Vamos conversar <MoveUpRight size={14} aria-hidden /></a></div>
      <section className={styles.story} id="sobre">
        <div><p className={styles.sectionLabel}>Uma ideia para {b.name}</p><h2>{v.storyTitle}</h2></div>
        <div className={styles.storyText}><p>{spec.story}</p></div>
      </section>
      <section className={styles.details} id="informacoes" aria-labelledby="demo-info-title">
        <div className={styles.detailsIntro}><p className={styles.sectionLabel}>Para conhecer melhor</p><h2 id="demo-info-title">{spec.detailsTitle}</h2><p>Converse com a equipe para confirmar as informações e planejar o próximo passo.</p></div>
        <div className={styles.topicList}>{spec.topics.map((topic, i) => <a key={topic} href="#contato"><span><small>0{i + 1}</small>{topic}</span><MoveUpRight size={22} aria-hidden /></a>)}<p className={styles.editorNote}>Seções sugeridas. Disponibilidade e conteúdo a confirmar.</p></div>
      </section>
      <section className={styles.contact} id="contato">
        <div><p className={styles.sectionLabel}>Por perto, em {b.city}</p><h2>Vamos conversar?</h2><p>{b.name}</p></div>
        <dl className={styles.contactData}><div><dt><MapPin size={17} aria-hidden />Localização</dt><dd>{b.city} / {b.uf}<span>Endereço completo a confirmar</span></dd></div><div><dt><Phone size={17} aria-hidden />Contato</dt><dd>{b.phone || "Telefone a confirmar"}<span>Horários de atendimento a confirmar</span></dd></div></dl>
      </section>
      <footer className={styles.footer}><span>{b.name}</span><p>Demonstração não oficial. Esta página não realiza pedidos, agendamentos ou envios de mensagens.</p><a href="#inicio">Voltar ao início ↑</a></footer>
    </article>
  );
}
