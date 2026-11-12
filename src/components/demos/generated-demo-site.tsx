/* eslint-disable @next/next/no-img-element -- imagem original persistida pelo gerador local */
import type { CSSProperties } from "react";
import type { DemoBusiness } from "@/lib/demos/model";
import type { GeneratedCreation } from "@/lib/demos/creation";
import { handleDemoAnchor } from "./demo-anchor";
import s from "./generated-demo-site.module.css";

export function GeneratedDemoSite({ business, creation: c, cover = false }: { business: DemoBusiness; creation: GeneratedCreation; cover?: boolean }) {
  return <article className={`${s.site} ${s[c.typography]}`} style={{ "--paper": c.paper, "--ink": c.ink, "--accent": c.accent } as CSSProperties} data-demo-creation={c.id} onClick={cover ? undefined : handleDemoAnchor}>
    <div className={s.notice}>Demonstração não oficial por Sellora · Imagem ilustrativa criada por IA · Conteúdo a validar</div>
    <header className={s.header} id={cover ? undefined : "inicio"}>
      <a href="#inicio" className={s.brand}>{business.name}</a>
      <nav aria-label="Navegação da demonstração"><a href="#proposta">Conheça</a><a href="#contato">Contato ↗</a></nav>
    </header>
    <section className={`${s.hero} ${s[c.layout]} ${s[c.photoSide]} ${s[c.photoShape]}`} aria-labelledby={cover ? undefined : "generated-title"}>
      <div className={s.copy}><p className={s.location}>{business.city}, {business.uf}</p><h1 id={cover ? undefined : "generated-title"}>{c.headline}</h1><p className={s.intro}>{c.intro}</p><a className={s.cta} href="#contato">{c.cta} <span aria-hidden>↗</span></a></div>
      <figure className={s.photo}><img src={c.image.src} alt={c.image.alt} width={c.image.width} height={c.image.height} fetchPriority={cover ? "auto" : "high"} loading={cover ? "lazy" : "eager"} /><figcaption>Imagem conceitual gerada por IA. Representação ilustrativa.</figcaption></figure>
    </section>
    {!cover && <>
      <div className={`${s.sections} ${s[c.sectionStyle]}`} id="proposta">{c.sections.map((section) => <section key={section.title}><h2>{section.title}</h2><p>{section.body}</p></section>)}</div>
      <section className={s.contact} id="contato" aria-labelledby="generated-contact"><div><p className={s.location}>{business.name}</p><h2 id="generated-contact">Vamos conversar?</h2><p>{business.city}, {business.uf}</p></div><div>{business.phone && <p className={s.phone}>{business.phone}</p>}<p>Confirme com o estabelecimento os canais de atendimento, endereço, horários e serviços disponíveis.</p><a href="#inicio">Voltar ao início ↑</a></div></section>
      <footer className={s.footer}><span>{business.name}</span><p>Demonstração não oficial. Identidade e informações comerciais aguardam validação do negócio.</p></footer>
    </>}
  </article>;
}
