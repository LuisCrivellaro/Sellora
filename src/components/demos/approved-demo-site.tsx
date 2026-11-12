/* eslint-disable @next/next/no-img-element -- mídias locais autorizadas, com dimensões fixas */
import type { DemoBusiness } from "@/lib/demos/model";
import { approvedConcepts, type ApprovedConceptId } from "@/lib/demos/concepts";
import { handleDemoAnchor } from "./demo-anchor";
import s from "./approved-demo-site.module.css";

export function ApprovedDemoSite({ business: b, conceptId }: { business: DemoBusiness; conceptId: ApprovedConceptId }) {
  const c = approvedConcepts[conceptId];
  const organic = c.direction === "organic";
  const prefix = organic ? "cravo" : "headmasters";
  const storyId = organic ? "essencia" : "perspectiva";
  const visitId = organic ? "visita" : "antes-da-visita";
  const contact = <>
    {b.phone && <p className={s["business-phone"]}>{b.phone}</p>}
    <p>{b.phone ? "Confirme com o estabelecimento o canal de atendimento, endereço e horários antes da visita." : "Os canais de contato, endereço completo e horários serão incluídos após confirmação com o negócio."}</p>
  </>;
  const photo = <figure className={s[organic ? "cravo-portrait" : "headmasters-still"]}>
    <img src={c.media.src} width={c.media.width} height={c.media.height} alt={c.media.alt} fetchPriority="high" />
    <figcaption>{c.media.caption}</figcaption>
  </figure>;
  const story = <section className={s[organic ? "cravo-essence" : "headmasters-perspective"]} id={storyId} aria-labelledby="concept-story-title">
    {organic ? <div><p className={s.eyebrow}>{c.story.label}</p><h2 id="concept-story-title">{c.story.title[0]}<br />{c.story.title[1]} <em>{c.story.emphasis}</em></h2></div> : <>
      <p className={s.eyebrow}>{c.story.label}</p><h2 id="concept-story-title">{c.story.title[0]}<br />{c.story.title[1]} <em>{c.story.emphasis}</em></h2>
    </>}
    <div className={s[organic ? "cravo-essence-copy" : "headmasters-perspective-copy"]}>
      {c.story.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      {c.story.cta && <a className={s["cravo-text-link"]} href="#contato">{c.story.cta} <span aria-hidden>↗</span></a>}
    </div>
  </section>;
  const visit = organic ? <section className={s["cravo-visit"]} id={visitId} aria-labelledby="concept-visit-title">
    <div><p className={s.eyebrow}>{c.visit.label}</p><h2 id="concept-visit-title">{c.visit.title[0]}<br />{c.visit.title[1]} <em>{c.visit.emphasis}</em></h2></div>
    <div className={s["cravo-visit-details"]}><p className={s["visit-business"]}>{b.name}</p><p className={s["visit-city"]}>{b.city}, {b.uf}</p><p>{c.visit.text}</p><p className={s.pending}>Endereço e horários aguardam confirmação para esta prévia.</p></div>
  </section> : <section className={s["headmasters-before"]} id={visitId} aria-labelledby="concept-visit-title">
    <div className={s["headmasters-before-intro"]}><p className={s.eyebrow}>{c.visit.label}</p><h2 id="concept-visit-title">{c.visit.title[0]}<br />{c.visit.title[1]}</h2></div>
    <div className={s["headmasters-steps"]}>{c.visit.steps.map((step) => <article key={step.title}><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
  </section>;

  return <article onClick={handleDemoAnchor} className={`${s.site} ${s[prefix]}`} data-demo-concept={conceptId}>
    <div className={s["demo-notice"]}>Demonstração não oficial por Sellora · Imagem ilustrativa criada por IA · Conteúdo a validar com o negócio</div>
    <header className={s[`${prefix}-header`]} id="inicio">
      {organic ? <a className={s["cravo-brand"]} href="#inicio" aria-label={`${b.name}, início`}>cravo <span>&amp; canela</span></a> : <a className={s["headmasters-brand"]} href="#inicio">HEADMASTERS<span>Cabelo &amp; Estética</span></a>}
      <nav aria-label="Navegação da demo"><a href={`#${storyId}`}>{organic ? "A proposta" : "O conceito"}</a><a href={`#${visitId}`}>{organic ? "Sua visita" : "Antes da visita"}</a><a className={s[`${prefix}-nav-contact`]} href="#contato">{organic ? "Vamos conversar" : "Contato"} <span aria-hidden>↗</span></a></nav>
    </header>
    {organic ? <section className={s["cravo-hero"]} aria-labelledby="concept-title">
      <div className={s["cravo-hero-copy"]}>
        <p className={s.eyebrow}>{b.name} · Beleza em {b.city}</p>
        <h1 id="concept-title">{c.headline[0]}<br />{c.headline[1]} <em>{c.emphasis}</em></h1>
        <div className={s["cravo-hero-bottom"]}><p>{c.intro[0]}</p><a className={s["cravo-button"]} href={`#${storyId}`}>{c.heroCta} <span aria-hidden>↗</span></a></div>
      </div>{photo}
    </section> : <section className={s["headmasters-hero"]} aria-labelledby="concept-title">
      <div className={s["headmasters-kicker"]}><p>Cabelo. Estética. Expressão.</p><p>{b.city}, {b.uf}</p></div>
      <h1 id="concept-title">{c.headline[0]}<br /><span>{c.headline[1]}</span></h1>
      <div className={s["headmasters-hero-intro"]}><p>{c.intro[0]}<br />{c.intro[1]}</p><a className={s["headmasters-link"]} href={`#${storyId}`}>{c.heroCta} <span aria-hidden>↘</span></a></div>{photo}
    </section>}
    {organic ? <>{story}{visit}</> : <>{visit}{story}</>}
    <section className={s[`${prefix}-contact`]} id="contato" aria-labelledby="concept-contact-title">
      {organic ? <>
        <p className={s.eyebrow}>{c.contact.label}</p><h2 id="concept-contact-title">{c.contact.title[0]} <em>{c.contact.title[1]}</em></h2>
        {contact}<a className={s["cravo-text-link"]} href="#inicio">{c.contact.back} <span aria-hidden>↑</span></a>
      </> : <>
        <div><p className={s.eyebrow}>{b.name}</p><h2 id="concept-contact-title">{c.contact.title[0]}<br />{c.contact.title[1]}</h2></div>
        <div className={s["headmasters-contact-data"]}><p className={s["headmasters-city"]}>{b.city},<br />{b.uf}.</p>{contact}<a className={s["headmasters-link"]} href="#inicio">{c.contact.back} <span aria-hidden>↑</span></a></div>
      </>}
    </section>
    <footer className={s[`${prefix}-footer`]}><span>{b.name}</span><p>Conceito visual não oficial. Identidade, conteúdo e atendimentos sujeitos à validação do estabelecimento.</p>{organic && <span>{b.city}, {b.uf}</span>}</footer>
  </article>;
}
