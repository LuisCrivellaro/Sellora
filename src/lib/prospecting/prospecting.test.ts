import { beforeAll, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../data/seed";
import { segmentsFor } from "./catalog";
import { classify, instagramHandle, siteProblems, socialPlatform, type Candidate } from "./classify";
import { csvCell, toCsv } from "./export";
import { buildOverpassQuery, toCandidate } from "./osm";
import { prospectParamsSchema } from "./schema";
import { analyzeHtml, isPrivateAddress } from "./site-check";
import { findCrmDuplicate, prospectToLeadInput, suggestProduct } from "./to-lead";
import type { SiteCheck } from "./types";

const now = new Date("2026-11-09T12:00:00Z");

const cand = (over: Partial<Candidate> = {}): Candidate => ({
  id: "osm:node/1",
  name: "Barbearia Exemplo",
  category: "Cabeleireiro / barbearia",
  segment: "beleza",
  city: "Campinas",
  uf: "SP",
  address: "Rua A, 10 — Centro",
  addressComplete: true,
  distanceKm: 1.2,
  phone: "+55 19 3251-0000",
  email: "",
  website: "",
  instagram: "",
  otherSocials: [],
  openingHours: "Mo-Sa 09:00-19:00",
  brand: null,
  closed: false,
  sourceLabel: "OpenStreetMap",
  sourceUrl: "https://www.openstreetmap.org/node/1",
  ...over,
});

const check = (over: Partial<SiteCheck> = {}): SiteCheck => ({
  url: "https://exemplo.com.br",
  finalUrl: "https://exemplo.com.br/",
  reachable: true,
  httpStatus: 200,
  https: true,
  hasViewport: true,
  title: "Exemplo",
  copyrightYear: 2026,
  hasPhoneLink: true,
  freeHost: null,
  blocked: false,
  scriptRendered: false,
  error: null,
  checkedAt: now.toISOString(),
  ...over,
});

describe("classificação HOT/WARM/LOW/SKIP", () => {
  it("HOT sem site: score com critérios documentados e ausência marcada como não verificada", () => {
    const r = classify(cand(), null, { radiusKm: 10, now });
    expect(r.classification).toBe("HOT");
    expect(r.presence).toBe("sem_site");
    // 50 sem site + 15 telefone + 8 horário + 7 endereço + 10 proximidade
    expect(r.score).toBe(90);
    expect(r.scoreParts.reduce((s, p) => s + p.points, 0)).toBe(r.score);
    expect(r.confidence).toBe("baixa");
    expect(r.evidence.some((e) => e.status === "nao_verificado" && /busca do nome/.test(e.claim))).toBe(true);
    expect(r.justification).toMatch(/^HOT/);
  });

  it("HOT só redes quando o site informado é Instagram, extraindo o @", () => {
    const r = classify(cand({ website: "https://instagram.com/barbearia.ex" }), null, { radiusKm: 10, now });
    expect(r.classification).toBe("HOT");
    expect(r.presence).toBe("so_redes");
    expect(r.instagram).toBe("@barbearia.ex");
    expect(r.website).toBe("");
    expect(r.confidence).toBe("media");
  });

  it("WARM com problemas verificáveis; LOW com site adequado; nunca HOT com site próprio", () => {
    const bad = check({ https: false, hasViewport: false, copyrightYear: 2019, hasPhoneLink: false });
    const warm = classify(cand({ website: "http://exemplo.com.br" }), bad, { radiusKm: 10, now });
    expect(warm.classification).toBe("WARM");
    expect(warm.problems).toHaveLength(4);
    expect(warm.scoreParts[0].points).toBe(40);
    const low = classify(cand({ website: "https://exemplo.com.br" }), check(), { radiusKm: 10, now });
    expect(low.classification).toBe("LOW");
    expect(low.confidence).toBe("alta");
    expect(siteProblems(check(), now)).toEqual([]);
  });

  it("site que bloqueia a verificação não gera problema inventado", () => {
    const r = classify(cand({ website: "https://exemplo.com.br" }), check({ blocked: true, httpStatus: 403, title: null, hasViewport: null, hasPhoneLink: null }), { radiusKm: 10, now });
    expect(r.classification).toBe("LOW");
    expect(r.problems).toEqual([]);
    expect(r.confidence).toBe("baixa");
  });

  it("SKIP para franquia, duplicado, fechado e sem contato", () => {
    expect(classify(cand({ brand: "Rede X" }), null, { radiusKm: 10, now }).classification).toBe("SKIP");
    expect(classify(cand(), null, { radiusKm: 10, now, duplicateOf: "Outra" }).diagnosis).toMatch(/Duplicado/);
    expect(classify(cand({ closed: true }), null, { radiusKm: 10, now }).score).toBe(0);
    expect(classify(cand({ phone: "" }), null, { radiusKm: 10, now }).diagnosis).toMatch(/Dados insuficientes/);
  });

  it("reconhece plataformas sociais e handles", () => {
    expect(socialPlatform("https://www.facebook.com/x")).toBe("Facebook");
    expect(socialPlatform("linktr.ee/abc")).toBe("Linktree");
    expect(socialPlatform("https://padaria.com.br")).toBeNull();
    expect(instagramHandle("@loja_x")).toBe("@loja_x");
    expect(instagramHandle("https://www.instagram.com/p/abc")).toBe("");
  });
});

describe("conferência HTML e segurança", () => {
  it("extrai viewport, título, ano do rodapé e links de contato", () => {
    const html = `<html><head><meta name="viewport" content="width=device-width"><title>Pizzaria &amp; Cia</title></head><body>${"texto ".repeat(60)}<a href="tel:+551932510000">Ligar</a><footer>&copy; 2015-2020 Pizzaria</footer></body></html>`;
    const a = analyzeHtml(html, now);
    expect(a).toMatchObject({ hasViewport: true, title: "Pizzaria & Cia", copyrightYear: 2020, hasPhoneLink: true, scriptRendered: false });
    const spa = analyzeHtml(`<html><head><title>App</title></head><body><div id="root"></div><script src="/a.js"></script></body></html>`, now);
    expect(spa.scriptRendered).toBe(true);
    expect(spa.hasPhoneLink).toBeNull();
  });

  it("recusa endereços internos (SSRF)", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "192.168.0.10", "172.20.0.1", "169.254.169.254", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"]) expect(isPrivateAddress(ip)).toBe(true);
    for (const ip of ["8.8.8.8", "200.147.67.142", "2804:14c::1"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});

describe("OpenStreetMap", () => {
  it("monta a consulta Overpass com raio e filtros do segmento", () => {
    const q = buildOverpassQuery(segmentsFor("beleza"), { lat: -22.9, lon: -47.06, label: "" }, 5, 300);
    expect(q).toContain('nwr["shop"~"^(hairdresser|beauty|cosmetics|massage|tattoo|nails)$"]["name"](around:5000,-22.900000,-47.060000);');
    expect(q).toContain("out center tags 300;");
    expect(buildOverpassQuery(segmentsFor("todos"), { lat: 0, lon: 0, label: "" }, 10, 300).split("nwr").length - 1).toBeGreaterThan(6);
  });

  it("converte elemento em candidato com contatos comerciais e marca rede", () => {
    const c = toCandidate(
      { type: "node", id: 9, lat: -22.91, lon: -47.06, tags: { name: "Studio Y", shop: "beauty", phone: "+55 19 99999-0000;+55 19 3333-0000", "contact:instagram": "studioy", "addr:street": "Rua B", "addr:housenumber": "5", "brand:wikidata": "Q1", brand: "Rede Y" } },
      { city: "Campinas", uf: "SP" },
      { lat: -22.9, lon: -47.06, label: "" },
    )!;
    expect(c).toMatchObject({ id: "osm:node/9", segment: "beleza", category: "Estética", phone: "+55 19 99999-0000", instagram: "@studioy", addressComplete: true, brand: "Rede Y" });
    expect(c.distanceKm).toBeCloseTo(1.1, 1);
    expect(toCandidate({ type: "node", id: 2, lat: 0, lon: 0, tags: { shop: "beauty" } }, { city: "X", uf: "SP" }, { lat: 0, lon: 0, label: "" })).toBeNull();
  });
});

describe("parâmetros e exportação", () => {
  it("valida o formulário com os mesmos limites da rota", () => {
    expect(prospectParamsSchema.safeParse({ city: "Campinas", uf: "SP", segment: "beleza", radiusKm: 10, maxResults: 20, opportunity: "todas" }).success).toBe(true);
    expect(prospectParamsSchema.safeParse({ city: "Campinas", uf: "SP", segment: "beleza", radiusKm: 15, maxResults: 20, opportunity: "todas" }).success).toBe(false);
    expect(prospectParamsSchema.safeParse({ city: "Campinas", uf: "SP", segment: "beleza", radiusKm: 10, maxResults: 500, opportunity: "todas" }).success).toBe(false);
    expect(prospectParamsSchema.safeParse({ city: "<script>", uf: "SP", segment: "beleza", radiusKm: 10, maxResults: 20, opportunity: "todas" }).success).toBe(false);
  });

  it("CSV neutraliza fórmulas e escapa aspas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    const csv = toCsv([classify(cand(), null, { radiusKm: 10, now })]);
    expect(csv.split("\r\n")[0]).toMatch(/^﻿classificacao,score/);
    expect(csv).toContain("HOT,90,baixa,Barbearia Exemplo");
  });
});

describe("ponte para o CRM", () => {
  const hot = classify(cand(), null, { radiusKm: 10, now });

  it("detecta duplicidade por nome+cidade, telefone, site ou Instagram", () => {
    const base = { id: "l1", name: "Outro", city: "Valinhos", phone: "", website: null, instagram: "" };
    expect(findCrmDuplicate(hot, [{ ...base, name: "barbearia exemplo", city: "campinas" }])?.reason).toBe("mesmo nome e cidade");
    expect(findCrmDuplicate(hot, [{ ...base, phone: "(19) 3251-0000" }])?.reason).toBe("mesmo telefone");
    expect(findCrmDuplicate({ ...hot, website: "https://www.exemplo.com.br" }, [{ ...base, website: "http://exemplo.com.br/contato" }])?.reason).toBe("mesmo site");
    expect(findCrmDuplicate({ ...hot, instagram: "@Ex" }, [{ ...base, instagram: "@ex" }])?.reason).toBe("mesmo Instagram");
    expect(findCrmDuplicate(hot, [base])).toBeNull();
  });

  it("converte no formato do lead com origem Prospecção IA, sem inventar valores", () => {
    const { input, activity } = prospectToLeadInput(hot, defaultSettings.packages);
    expect(input).toMatchObject({ source: "prospeccao_ia", stage: "novo", priority: "alta", websiteSituation: "sem_site", segment: "beleza" });
    expect(input.potentialValue).toBe(suggestProduct(hot, defaultSettings.packages)!.price);
    expect(input.notes).toMatch(/HOT · score 90\/100/);
    expect(input.notes).toMatch(/Não verificado:/);
    expect(activity.length).toBeLessThanOrEqual(500);
    expect(suggestProduct({ classification: "LOW", presence: "site_adequado" }, defaultSettings.packages)).toBeNull();
  });
});

describe("importação no repositório (modo demo)", () => {
  beforeAll(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    });
  });

  it("cria leads novos, ignora duplicados (CRM e lote) e não sobrescreve", async () => {
    const repo = await import("../data/repository");
    const { getDb } = await import("../data/store");
    const existing = getDb().leads[0];
    const before = getDb().leads.length;
    const fresh = classify(cand({ id: "osm:node/77", name: "Ateliê Novo Teste", phone: "+55 11 4000-1234" }), null, { radiusKm: 10, now });
    const twin = { ...fresh, id: "osm:node/78" };
    const dupOfCrm = { ...fresh, id: "osm:node/79", name: existing.name, city: existing.city, phone: "" };
    const report = repo.importProspects([fresh, twin, dupOfCrm]);
    expect(report.created).toHaveLength(1);
    expect(report.duplicates.map((d) => d.resultId).sort()).toEqual(["osm:node/78", "osm:node/79"]);
    const db = getDb();
    expect(db.leads.length).toBe(before + 1);
    const lead = db.leads.find((l) => l.id === report.created[0].lead.id)!;
    expect(lead.source).toBe("prospeccao_ia");
    expect(db.activities.some((a) => a.leadId === lead.id && a.type === "nota" && /Prospecção IA/.test(a.description))).toBe(true);
    expect(db.leads.find((l) => l.id === existing.id)).toEqual(existing);
  });
});
