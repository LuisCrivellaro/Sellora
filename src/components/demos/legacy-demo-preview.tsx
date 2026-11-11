"use client";

import { ArrowDown, ArrowUpRight, MapPin, Phone } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { parseDemoFragment, type DemoBusiness } from "@/lib/demos/model";
import type { Segment } from "@/lib/types";
import styles from "./demo-preview.module.css";
import { handleDemoAnchor } from "./demo-anchor";

const templates: Record<Segment, { label: string; headline: string; description: string; accent: string; paper: string; sections: string[] }> = {
  restaurantes: { label: "À mesa, na sua cidade", headline: "O próximo encontro começa aqui.", description: "Um convite para conhecer o sabor e a identidade do seu negócio.", accent: "#a84b2b", paper: "#f3eee4", sections: ["Cardápio", "Nossa história", "Onde encontrar"] },
  beleza: { label: "Beleza com identidade", headline: "Um momento só seu.", description: "Uma presença digital que abre espaço para cuidado, estilo e expressão.", accent: "#785345", paper: "#f3eae5", sections: ["Procedimentos e serviços", "O espaço", "Agendamentos"] },
  saude: { label: "Cuidado perto de você", headline: "O cuidado começa no primeiro contato.", description: "Informação clara e acolhimento para aproximar pessoas e profissionais.", accent: "#245f58", paper: "#ecf2ee", sections: ["Áreas de atendimento", "Profissionais", "Como agendar"] },
  servicos: { label: "Presença local. Conexões reais.", headline: "O que você precisa, mais perto.", description: "Um espaço para apresentar seu trabalho e facilitar a próxima conversa.", accent: "#365e80", paper: "#edf0f4", sections: ["Serviços", "Nosso trabalho", "Solicite informações"] },
  comercio: { label: "Descubra na sua cidade", headline: "Boas descobertas começam por aqui.", description: "Uma vitrine digital para aproximar sua loja de quem está procurando.", accent: "#64542e", paper: "#f3f0e6", sections: ["Produtos e coleções", "A loja", "Visite-nos"] },
  outros: { label: "Conecte-se ao seu bairro", headline: "Um novo jeito de conhecer seu negócio.", description: "Sua identidade, sua história e um caminho mais simples para o contato.", accent: "#4d586b", paper: "#f0f0ed", sections: ["O que fazemos", "Quem somos", "Fale conosco"] },
};

export function LegacyDemoPreview() {
  const [state, setState] = useState<{ loaded: boolean; business: DemoBusiness | null }>({ loaded: false, business: null });
  useEffect(() => {
    const read = () => setState({ loaded: true, business: parseDemoFragment(window.location.hash) });
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  if (!state.loaded) return <p role="status" className="p-8 text-center text-ink-soft">Preparando a demonstração…</p>;
  const b = state.business;
  if (!b) return <div className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold text-ink">Prévia indisponível</h1><p className="mt-3 text-ink-soft">O link está incompleto ou é inválido. Abra novamente pela ficha do lead no Sellora.</p></div>;
  const t = templates[b.segment];
  const initials = b.name.split(/\s+/).slice(0, 2).map((s) => s[0]).join("");
  return (
    <article onClick={handleDemoAnchor} className={styles.preview} style={{ "--demo-accent": t.accent, "--demo-paper": t.paper } as CSSProperties}>
      <div className={styles.disclaimer}>Demonstração não oficial <span>·</span> Conceito visual criado pela Sellora. Conteúdo sujeito à aprovação do estabelecimento.</div>
      <header className={styles.header} id="inicio"><a href="#inicio" className={styles.brand}>{b.name}</a><nav aria-label="Seções da demonstração"><a href="#conceito">Conheça o conceito</a><a href="#contato">Contato <ArrowUpRight size={15} aria-hidden /></a></nav></header>
      <section className={styles.hero}>
        <div><p className={styles.eyebrow}>{t.label}</p><h1>{t.headline}</h1><p className={styles.intro}>{t.description}</p><a href="#contato" className={styles.cta}>Conheça {b.name} <ArrowUpRight size={20} aria-hidden /></a><p className={styles.location}><MapPin size={15} aria-hidden /> {b.city}, {b.uf}</p></div>
        <div className={styles.art} aria-label={`Composição tipográfica ilustrativa de ${b.name}`}><span className={styles.artLabel}>UM CONCEITO PARA</span><span className={styles.monogram} aria-hidden>{initials}</span><p>{b.name}<span>{b.city} / {b.uf}</span></p><span className={styles.artFoot}>IDENTIDADE LOCAL · PRESENÇA DIGITAL</span></div>
      </section>
      <section className={styles.concept} id="conceito"><div className={styles.sectionHeading}><p className={styles.eyebrow}>Pensado para o seu negócio</p><h2>Uma identidade que aproxima.</h2><p>Esta é uma proposta inicial de estrutura. Serviços, imagens e textos finais serão definidos com o estabelecimento.</p></div><div className={styles.sections}>{t.sections.map((s, i) => <div key={s}><span className={styles.number}>0{i + 1}</span><h3>{s}</h3><p>Espaço reservado para conteúdo aprovado pelo negócio.</p><ArrowDown size={18} aria-hidden /></div>)}</div></section>
      <section id="contato" className={styles.contact}><div><p className={styles.eyebrow}>Vamos nos encontrar</p><h2>{b.name}</h2><p><MapPin size={17} aria-hidden />{b.city} / {b.uf}</p>{b.phone ? <p><Phone size={17} aria-hidden />{b.phone}</p> : <p>Canal de contato a confirmar com o estabelecimento.</p>}</div><div className={styles.contactNote}><p>Gostou do que imaginou?</p><span>Este conceito mostra um ponto de partida para o site. Nenhum agendamento, pedido ou mensagem é realizado nesta demonstração.</span><a href="#inicio">Voltar ao início <ArrowUpRight size={18} aria-hidden /></a></div></section>
      <footer className={styles.footer}><span>{b.name} · {b.city}</span><span>Demonstração não oficial por Sellora</span></footer>
    </article>
  );
}
