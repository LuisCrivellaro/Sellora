import { beforeAll, describe, expect, it, vi } from "vitest";
import type { LeadInput, ProposalInput } from "../schemas";

/** Fluxo comercial ponta a ponta no repositório local: lead → proposta → venda → cliente → projeto → parcelas → recebimento → indicadores. */
beforeAll(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
      removeItem: (k: string) => void mem.delete(k),
    },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});

const leadInput = (over: Partial<LeadInput> = {}): LeadInput => ({
  name: "Padaria Fluxo Completo",
  segment: "restaurantes",
  city: "Campinas",
  uf: "SP",
  source: "manual",
  website: "",
  websiteSituation: "sem_site",
  stage: "novo",
  priority: "alta",
  phone: "(19) 98888-1234",
  email: "",
  instagram: "",
  potentialValue: 990,
  nextAction: "",
  nextActionAt: null,
  notes: "",
  ...over,
});

const proposalInput = (leadId: string, over: Partial<ProposalInput> = {}): ProposalInput => ({
  recipientName: "Padaria Fluxo Completo",
  leadId,
  clientId: null,
  title: "Site Padaria Fluxo Completo",
  packageId: "profissional",
  items: [
    { id: "i1", description: "Pacote Profissional", quantity: 1, unitPrice: 990 },
    { id: "i2", description: "Página extra", quantity: 1, unitPrice: 109.99 },
  ],
  scope: "Home, sobre, cardápio e contato.",
  discount: 0,
  deadlineDays: 15,
  revisions: 2,
  paymentTerms: "50% de entrada e 50% na entrega",
  exclusions: "",
  validUntil: new Date(Date.now() + 15 * 86_400_000).toISOString(),
  status: "rascunho",
  nextAction: "",
  notes: "",
  ...over,
});

describe("parcelas", () => {
  it("entrada + saldo somam exatamente o total, em centavos", async () => {
    const { buildInstallments } = await import("./repository");
    for (const [total, pct] of [[1099.99, 50], [590, 50], [1490, 30], [999.99, 33], [0.01, 50]] as const) {
      const plan = buildInstallments(total, pct, "2026-11-10T00:00:00.000Z", "2026-11-25T00:00:00.000Z", "Site X");
      expect(Math.round(plan.reduce((s, i) => s + i.amount, 0) * 100)).toBe(Math.round(total * 100));
      expect(plan.every((i) => i.amount > 0)).toBe(true);
    }
  });

  it("0% e 100% de entrada geram uma única parcela; total zero não gera nada", async () => {
    const { buildInstallments } = await import("./repository");
    expect(buildInstallments(590, 0, "a", "b", "x")).toHaveLength(1);
    expect(buildInstallments(590, 0, "a", "b", "x")[0].dueDate).toBe("b");
    expect(buildInstallments(590, 100, "a", "b", "x")).toHaveLength(1);
    expect(buildInstallments(590, 100, "a", "b", "x")[0].dueDate).toBe("a");
    expect(buildInstallments(0, 50, "a", "b", "x")).toHaveLength(0);
  });
});

describe("fluxo comercial completo", () => {
  it("lead → proposta → venda → cliente → projeto → parcelas → recebimento → indicadores", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const { financeSummary } = await import("../metrics/finance");
    const { homeIndicators } = await import("../metrics/home-overview");
    repo.startFromScratch();

    const lead = repo.createLead(leadInput());
    repo.moveLeadStage(lead.id, "qualificado");
    const proposal = repo.createProposal(proposalInput(lead.id));
    expect(proposal.sentAt).toBeNull();

    // "Pronta" ainda não conta como enviada; "Enviada" leva o lead a Proposta.
    repo.setProposalStatus(proposal.id, "pronta");
    expect(getDb().proposals[0].sentAt).toBeNull();
    expect(getDb().leads[0].stage).toBe("qualificado");
    repo.setProposalStatus(proposal.id, "enviada");
    expect(getDb().proposals[0].sentAt).not.toBeNull();
    expect(getDb().leads[0].stage).toBe("proposta");
    repo.setProposalStatus(proposal.id, "negociacao");
    expect(getDb().leads[0].stage).toBe("negociacao");

    const sale = repo.closeSale(proposal.id);
    let db = getDb();
    expect(sale.created).toBe(true);
    expect(db.leads[0].stage).toBe("ganho");
    expect(db.leads[0].clientId).toBe(sale.client.id);
    expect(db.clients).toHaveLength(1);
    expect(db.clients[0].leadId).toBe(lead.id);
    expect(db.proposals[0].status).toBe("aprovada");
    expect(db.proposals[0].clientId).toBe(sale.client.id);
    expect(db.projects).toHaveLength(1);
    expect(db.projects[0].proposalId).toBe(proposal.id);
    expect(db.projects[0].contractValue).toBe(1099.99);
    expect(db.projects[0].siteType).toBe("institucional");
    expect(db.transactions).toHaveLength(2);
    expect(db.transactions.every((t) => t.kind === "receita" && t.clientId === sale.client.id && t.projectId === sale.project.id && t.payments.length === 0)).toBe(true);
    expect(Math.round(db.transactions.reduce((s, t) => s + t.amount, 0) * 100)).toBe(109999);

    // Contratado não é caixa: nada recebido até registrar pagamento.
    let fin = financeSummary(db);
    expect(fin.contracted).toBe(1099.99);
    expect(fin.received).toBe(0);
    expect(fin.open).toBe(1099.99);

    // Fechar de novo não duplica nada.
    const again = repo.closeSale(proposal.id);
    expect(again.created).toBe(false);
    expect(again.project.id).toBe(sale.project.id);
    expect(getDb().projects).toHaveLength(1);
    expect(getDb().transactions).toHaveLength(2);
    expect(getDb().clients).toHaveLength(1);

    const entry = sale.transactions.find((t) => t.description.startsWith("Entrada"))!;
    repo.addPayment(entry.id, { amount: entry.amount, date: new Date().toISOString(), note: "Pix" });
    db = getDb();
    fin = financeSummary(db);
    expect(fin.received).toBe(entry.amount);
    expect(Math.round((fin.received + fin.open) * 100)).toBe(109999);

    const now = new Date();
    const ind = homeIndicators(db, now.getTime() - 86_400_000, now.getTime() + 86_400_000, now);
    expect(ind.totalLeads).toBe(1);
    expect(ind.qualified).toBe(1);
    expect(ind.contracted).toBe(1099.99);
    expect(ind.received).toBe(entry.amount);
    expect(Math.round(ind.receivable * 100)).toBe(109999 - Math.round(entry.amount * 100));
    expect(ind.activeProjects).toBe(1);
    // Histórico preservado na linha do tempo do lead.
    expect(db.activities.some((a) => a.leadId === lead.id && /→ Ganho/.test(a.description))).toBe(true);
    expect(db.activities.some((a) => a.projectId === sale.project.id && /Venda fechada/.test(a.description))).toBe(true);
  });

  it("mover para Ganho cria o cliente uma vez e reaproveita cliente já cadastrado", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    repo.startFromScratch();

    const a = repo.createLead(leadInput({ name: "Barbearia Ganho Direto", phone: "" }));
    repo.moveLeadStage(a.id, "ganho");
    repo.moveLeadStage(a.id, "negociacao");
    repo.moveLeadStage(a.id, "ganho");
    expect(getDb().clients).toHaveLength(1);
    expect(getDb().leads.find((l) => l.id === a.id)?.clientId).toBe(getDb().clients[0].id);

    // Cliente cadastrado à mão antes do lead: é vinculado, não duplicado.
    const existing = repo.createClient({ name: "Clínica Já Cliente", segment: "saude", city: "Campinas", uf: "SP", contactName: "", phone: "", email: "", status: "ativo", siteUrl: "", notes: "" });
    const b = repo.createLead(leadInput({ name: "clinica já cliente", segment: "saude", phone: "" }));
    repo.updateLead(b.id, leadInput({ name: "clinica já cliente", segment: "saude", phone: "", stage: "ganho" }));
    const db = getDb();
    expect(db.clients).toHaveLength(2);
    expect(db.leads.find((l) => l.id === b.id)?.clientId).toBe(existing.id);
    expect(db.clients.find((c) => c.id === existing.id)?.leadId).toBe(b.id);
  });

  it("recusa fechar venda de proposta recusada, sem valor ou sem vínculo", async () => {
    const repo = await import("./repository");
    repo.startFromScratch();
    const lead = repo.createLead(leadInput({ name: "Loja Sem Venda", phone: "" }));
    const refused = repo.createProposal(proposalInput(lead.id, { status: "recusada" }));
    expect(() => repo.closeSale(refused.id)).toThrow(/recusada/);
    const free = repo.createProposal(proposalInput(lead.id, { leadId: null }));
    expect(() => repo.closeSale(free.id)).toThrow(/Vincule/);
    const zero = repo.createProposal(proposalInput(lead.id, { discount: 1099.99 }));
    expect(() => repo.closeSale(zero.id)).toThrow(/maior que zero/);
  });

  it("propostas com validade vencida passam a Expirada", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    repo.startFromScratch();
    const lead = repo.createLead(leadInput({ name: "Loja Validade", phone: "" }));
    const old = repo.createProposal(proposalInput(lead.id, { status: "enviada", validUntil: new Date(Date.now() - 5 * 86_400_000).toISOString() }));
    repo.createProposal(proposalInput(lead.id, { status: "enviada" }));
    expect(repo.expireOverdueProposals()).toBe(1);
    expect(getDb().proposals.find((p) => p.id === old.id)?.status).toBe("expirada");
    expect(repo.expireOverdueProposals()).toBe(0);
  });
});

describe("importação de leads por CSV", () => {
  it("lê o modelo da skill de prospecção e não inventa campos ausentes", async () => {
    const { parseLeadCsv } = await import("./lead-csv");
    const csv = [
      "classificacao,score,confianca,nome,segmento,cidade,uf,distancia_km,presenca,website,instagram,outras_redes,telefone,problemas,justificativa,fontes,data_pesquisa",
      'HOT,90,baixa,"Pizzaria Bella, Massa",Restaurantes,Campinas,SP,2.1,Sem site,,@bellamassa,,(19) 3333-4444,,"Sem site na fonte",https://www.openstreetmap.org/node/1,2026-11-09',
      "WARM,60,alta,Clínica Sorriso,Saúde,Valinhos,SP,8,Site com problemas,http://sorriso.example.com,,,,sem meta viewport,Site sem mobile,https://www.openstreetmap.org/node/2,2026-11-09",
      ",,,,,,,,,,,,,,,,",
      "LOW,10,alta,X,Outros,Campinas,SP,,,,,,,,,,",
    ].join("\r\n");
    const out = parseLeadCsv(`﻿${csv}`);
    expect(out.ok).toBe(true);
    expect(out.rows).toHaveLength(2);
    expect(out.invalid).toHaveLength(1);
    const [hot, warm] = out.rows.map((r) => r.input);
    expect(hot).toMatchObject({ name: "Pizzaria Bella, Massa", segment: "restaurantes", city: "Campinas", uf: "SP", source: "prospeccao_ia", priority: "alta", websiteSituation: "sem_site", stage: "novo", email: "", potentialValue: 0 });
    expect(hot.notes).toContain("HOT");
    expect(hot.notes).toContain("openstreetmap.org/node/1");
    expect(warm).toMatchObject({ segment: "saude", priority: "media", websiteSituation: "sem_mobile", website: "http://sorriso.example.com", phone: "" });
  });

  it("aceita planilha simples com ponto e vírgula e recusa arquivo sem colunas obrigatórias", async () => {
    const { parseLeadCsv } = await import("./lead-csv");
    const out = parseLeadCsv("Nome;Cidade;Telefone;Origem\nSalão Bela;Sumaré/SP;19999990000;Indicação\n");
    expect(out.rows[0].input).toMatchObject({ name: "Salão Bela", city: "Sumaré", uf: "SP", source: "indicacao", phone: "19999990000", segment: "outros" });
    expect(parseLeadCsv("empresa;telefone\nA;1\n").ok).toBe(false);
  });

  it("importa sem duplicar contra o CRM nem dentro do lote", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const { parseLeadCsv } = await import("./lead-csv");
    repo.startFromScratch();
    repo.createLead(leadInput({ name: "Padaria Central", phone: "" }));
    const parsed = parseLeadCsv("nome,cidade,uf\nPadaria Central,Campinas,SP\nMercado Novo,Campinas,SP\nmercado novo,campinas,SP\n");
    const report = repo.importLeadInputs(parsed.rows.map((r) => r.input), "teste.csv");
    expect(report.created).toHaveLength(1);
    expect(report.duplicates).toHaveLength(2);
    expect(getDb().leads).toHaveLength(2);
    expect(getDb().activities.some((a) => a.leadId === report.created[0].id && a.description.includes("teste.csv"))).toBe(true);
  });
});
