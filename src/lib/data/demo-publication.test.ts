import { beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createEmptyDatabase } from "./seed";
import { getDb, replaceDatabase } from "./store";
import { applyDemoPublication, applyGeneratedLeadDemo, approveLeadDemo, createLead, generateLeadDemo, removeDemoAdjustment, requestDemoChanges, setManualDemoPublication } from "./repository";
import { demoMessageForCopy, demoRevision, publishedDemoUrl } from "../demos/model";
import { leadFromRow, leadToRow } from "./mappers";

beforeAll(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) } });
});
beforeEach(() => replaceDatabase(createEmptyDatabase()));

it("pedido de ajuste preserva a demo, revoga aprovação e registra a revisão sem contatar o lead", () => {
  const lead = createLead(input);
  generateLeadDemo(lead.id);
  const before = getDb().leads[0];
  expect(() => requestDemoChanges(lead.id, " ")).toThrow();
  expect(getDb().activities).toHaveLength(0);
  requestDemoChanges(lead.id, "Aumentar o título no celular");
  const after = getDb().leads[0];
  expect(after.demo?.id).toBe(before.demo?.id);
  expect(after.demo?.status).toBe("pending");
  expect(after.demo?.approvedAt).toBeNull();
  expect(after.lastContactAt).toBe(before.lastContactAt);
  expect(getDb().activities[0].description).toContain("Aumentar o título no celular");
});

const input = { name: "Café São João", city: "Campinas", uf: "SP", segment: "restaurantes" as const, source: "manual" as const, website: "", websiteSituation: "sem_site" as const, stage: "novo" as const, priority: "alta" as const, phone: "(19) 99999-1234", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "" };
const site = (id: string) => ({
  id, generator: "v6" as const, title: "Café de esquina", createdAt: new Date().toISOString(),
  files: [{ path: "index.html" as const, size: 10, sha256: "a".repeat(64) }, { path: "styles.css" as const, size: 5, sha256: "b".repeat(64) }],
  images: [], preview: false, qa: { status: "passed" as const, browser: "executed" as const, rounds: 0, issues: [] },
  summary: { headline: `Café no centro ${id.slice(0, 4)}`, texts: [`Texto ${id}`], fonts: ["Fraunces"], palette: ["#f4efe6"], sections: ["inicio", "contato", "mapa"], hero: "foto", signature: `fraunces|${id}` },
});
const SITE_A = "8f7a3f0e-2c4b-4d1a-9a55-1c2b3d4e5f60";
const SITE_B = "9f7a3f0e-2c4b-4d1a-9a55-1c2b3d4e5f61";
const publication = (siteId: string, publishedSiteId: string | null, status: "published" | "deploying" = "published") => ({
  status, siteId, publishedSiteId, url: publishedSiteId ? "https://cafe-sao-joao.demos.exemplo.com.br/" : null, domain: "cafe-sao-joao.demos.exemplo.com.br",
  coolifyAppUuid: "app123", lastDeployAt: publishedSiteId ? "2026-11-13T12:00:00.000Z" : null, syncedAt: new Date().toISOString(),
});

it("guarda a publicação no lead sem mexer na revisão, e o link copiado usa o endereço confirmado", () => {
  const lead = createLead(input);
  const before = generateLeadDemo(lead.id);
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_A), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(before));
  approveLeadDemo(lead.id);
  const revision = demoRevision(getDb().leads[0].demo);
  expect(applyDemoPublication(lead.id, publication(SITE_A, SITE_A))).toBe(true);
  const demo = getDb().leads[0].demo!;
  expect(demo.status).toBe("approved");
  expect(demoRevision(demo)).toBe(revision);
  expect(publishedDemoUrl(demo)).toBe("https://cafe-sao-joao.demos.exemplo.com.br/");
  expect(demoMessageForCopy(demo, "http://127.0.0.1:3187")).toContain("https://cafe-sao-joao.demos.exemplo.com.br/");
  // Persistência (Supabase): o resumo passa pelo mapeamento e validação do servidor.
  expect(leadFromRow(leadToRow(getDb().leads[0])).demo?.publication).toEqual(demo.publication);
  // Mesmo estado de novo: nada muda (idempotente).
  expect(applyDemoPublication(lead.id, { ...publication(SITE_A, SITE_A), syncedAt: new Date(Date.now() + 1000).toISOString() })).toBe(false);
});

it("versão nova ainda não publicada não reaproveita o link da anterior", () => {
  const lead = createLead(input);
  const first = generateLeadDemo(lead.id);
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_A), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(first));
  applyDemoPublication(lead.id, publication(SITE_A, SITE_A));
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_B), message: "Olá! Preparei outra demonstração não oficial de site para o café. Posso enviar?" }, demoRevision(getDb().leads[0].demo));
  const demo = getDb().leads[0].demo!;
  expect(demo.publication?.publishedSiteId).toBe(SITE_A);
  expect(publishedDemoUrl(demo)).toBeNull();
  approveLeadDemo(lead.id);
  expect(demoMessageForCopy(getDb().leads[0].demo!, "http://127.0.0.1:3187")).toContain(`/sites/${SITE_B}/index.html`);
});

it("publicação manual: aceita só link público HTTPS da versão atual, preserva a aprovação e pode ser removida", () => {
  const lead = createLead(input);
  const before = generateLeadDemo(lead.id);
  expect(() => setManualDemoPublication(lead.id, "https://cafe.netlify.app")).toThrow(/V6/);
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_A), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(before));
  approveLeadDemo(lead.id);
  const revision = demoRevision(getDb().leads[0].demo);
  for (const local of ["http://127.0.0.1:3187/sites/x/index.html", "https://localhost:3000", "https://192.168.0.10/demo", "http://cafe.netlify.app", "https://user:pw@cafe.netlify.app", "intranet"]) {
    expect(() => setManualDemoPublication(lead.id, local)).toThrow();
  }
  expect(setManualDemoPublication(lead.id, " cafe-sao-joao.netlify.app ")?.url).toBe("https://cafe-sao-joao.netlify.app/");
  const demo = getDb().leads[0].demo!;
  expect(demo.status).toBe("approved");
  expect(demoRevision(demo)).toBe(revision);
  expect(publishedDemoUrl(demo)).toBe("https://cafe-sao-joao.netlify.app/");
  expect(demoMessageForCopy(demo, "http://127.0.0.1:3187")).toContain("https://cafe-sao-joao.netlify.app/");
  expect(leadFromRow(leadToRow(getDb().leads[0])).demo?.publication).toEqual(demo.publication);
  // Nova versão da demo: o link manual anterior deixa de valer para a mensagem.
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_B), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(getDb().leads[0].demo));
  expect(publishedDemoUrl(getDb().leads[0].demo!)).toBeNull();
  setManualDemoPublication(lead.id, null);
  expect(getDb().leads[0].demo?.publication).toBeUndefined();
});

it("publicação manual não substitui uma publicação do Coolify", () => {
  const lead = createLead(input);
  const before = generateLeadDemo(lead.id);
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_A), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(before));
  applyDemoPublication(lead.id, publication(SITE_A, SITE_A));
  expect(() => setManualDemoPublication(lead.id, "https://cafe.netlify.app")).toThrow(/Coolify/);
});

it("pedido de ajuste fica pendente na demo, é marcado como aplicado na nova versão e pode ser removido", () => {
  const lead = createLead(input);
  const before = generateLeadDemo(lead.id);
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_A), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(before));
  requestDemoChanges(lead.id, "Aumentar o título no celular");
  requestDemoChanges(lead.id, "Fundo mais claro");
  expect(getDb().leads[0].demo?.adjustments?.map((item) => [item.text, item.siteId])).toEqual([["Aumentar o título no celular", SITE_A], ["Fundo mais claro", SITE_A]]);
  removeDemoAdjustment(lead.id, getDb().leads[0].demo!.adjustments![1].id);
  expect(getDb().leads[0].demo?.adjustments?.map((item) => item.text)).toEqual(["Aumentar o título no celular"]);
  expect(getDb().activities.filter((item) => item.description.startsWith("Ajuste da demo:"))).toHaveLength(2);
  applyGeneratedLeadDemo(lead.id, { site: site(SITE_B), message: "Olá! Preparei uma demonstração não oficial de site para o café. Posso enviar o link?" }, demoRevision(getDb().leads[0].demo));
  const demo = getDb().leads[0].demo!;
  expect(demo.adjustments).toBeUndefined();
  expect(demo.appliedAdjustments?.map((item) => item.text)).toEqual(["Aumentar o título no celular"]);
  expect(leadFromRow(leadToRow(getDb().leads[0])).demo?.appliedAdjustments).toEqual(demo.appliedAdjustments);
});
