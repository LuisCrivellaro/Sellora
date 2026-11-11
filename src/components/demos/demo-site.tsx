/* Fotografias locais: licença e procedência em public/demos/ASSETS.md. */
/* eslint-disable @next/next/no-img-element -- imagens locais com dimensões, sem otimizador nas prévias */
import { ArrowRight, MapPin, Phone, MoveUpRight } from "lucide-react";
import type { CSSProperties } from "react";
import { demoDesigns } from "@/lib/demos/designs";
import type { DemoBusiness } from "@/lib/demos/model";
import styles from "./demo-site.module.css";
import { handleDemoAnchor } from "./demo-anchor";

export function DemoSite({ business: b }: { business: DemoBusiness }) {
  const d = demoDesigns[b.segment];
  const detailsTitle = { restaurantes: "Antes de escolher sua mesa.", beleza: "O próximo passo é seu.", saude: "O que você precisa saber.", servicos: "Vamos entender sua necessidade.", comercio: "Encontre o que faz sentido para você.", outros: "Informação por perto." }[b.segment];
  return (
    <article onClick={handleDemoAnchor} className={`${styles.site} ${styles[b.segment]}`} style={{ "--paper": d.paper, "--ink": d.ink, "--accent": d.accent } as CSSProperties}>
      <div className={styles.notice}>Demonstração não oficial por Sellora. Imagens ilustrativas; conteúdo a validar com o estabelecimento.</div>
      <header className={styles.header} id="inicio">
        <a className={styles.brand} href="#inicio">{b.name}</a>
        <nav aria-label="Navegação da demo"><a href="#sobre">Conheça</a><a href="#informacoes">Informações</a><a href="#contato" className={styles.navContact}>Contato <MoveUpRight size={14} aria-hidden /></a></nav>
      </header>
      <section className={styles.hero} aria-label="Apresentação">
        <div className={styles.heroCopy}>
          <p className={styles.place}><MapPin size={14} aria-hidden />{b.city}, {b.uf}</p>
          <h1>{d.headline}</h1>
          <p className={styles.intro}>{d.description} <strong>{b.name}</strong>, em {b.city}.</p>
          <a className={styles.cta} href="#contato">Informações e contato <ArrowRight size={18} aria-hidden /></a>
          <a href="#sobre" className={styles.discover}>Conheça a proposta</a>
        </div>
        <figure className={styles.heroPhoto}><img src={`/demos/${d.photo}.jpg`} width={1400} height={1000} alt={d.alt} fetchPriority="high" /><figcaption>Fotografia de referência, não representa o estabelecimento.</figcaption></figure>
      </section>
      <div className={styles.localLine}><span>{b.name}</span><span>{b.city} / {b.uf}</span><a href="#contato">Vamos conversar <MoveUpRight size={14} aria-hidden /></a></div>
      <section className={styles.story} id="sobre">
        <div><p className={styles.sectionLabel}>Uma ideia para {b.name}</p><h2>{d.storyTitle}</h2></div>
        <div className={styles.storyText}><p>{d.story}</p></div>
      </section>
      <section className={styles.details} id="informacoes" aria-labelledby="demo-info-title">
        <div className={styles.detailsIntro}><p className={styles.sectionLabel}>Para conhecer melhor</p><h2 id="demo-info-title">{detailsTitle}</h2><p>Converse com a equipe para confirmar as informações e planejar o próximo passo.</p></div>
        <div className={styles.topicList}>{d.topics.map((topic) => <a key={topic} href="#contato"><span>{topic}</span><MoveUpRight size={22} aria-hidden /></a>)}<p className={styles.editorNote}>Seções sugeridas. Disponibilidade e conteúdo a confirmar.</p></div>
      </section>
      <section className={styles.contact} id="contato">
        <div><p className={styles.sectionLabel}>Por perto, em {b.city}</p><h2>Vamos conversar?</h2><p>{b.name}</p></div>
        <dl className={styles.contactData}><div><dt><MapPin size={17} aria-hidden />Localização</dt><dd>{b.city} / {b.uf}<span>Endereço completo a confirmar</span></dd></div><div><dt><Phone size={17} aria-hidden />Contato</dt><dd>{b.phone || "Telefone a confirmar"}<span>Horários de atendimento a confirmar</span></dd></div></dl>
      </section>
      <footer className={styles.footer}><span>{b.name}</span><p>Demonstração não oficial. Esta página não realiza pedidos, agendamentos ou envios de mensagens.</p><a href="#inicio">Voltar ao início ↑</a></footer>
    </article>
  );
}
