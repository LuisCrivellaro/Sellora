import { describe, expect, it } from "vitest";
import { createEmptyDatabase, createSeed } from "../data/seed";
import { addDays, buildBuckets, countByBucket } from "../dates";
import { leadInputSchema, optionalUrl } from "../schemas";
import type { Project, Transaction } from "../types";
import { financeSummary, openAmount, transactionStatus } from "./finance";
import { commercialRadar, nextActions } from "./home";
import { funnel, leadScore, temperatureOf } from "./leads";
import { projectProgress, projectStatus } from "./projects";
import { approvalRate, proposalTotal } from "./proposals";

const NOW = new Date("2026-11-06T12:00:00");

describe("datas e janelas", () => {
  it("gera a quantidade certa de janelas por período", () => {
    expect(buildBuckets("7d", NOW)).toHaveLength(7);
    expect(buildBuckets("30d", NOW)).toHaveLength(30);
    expect(buildBuckets("90d", NOW)).toHaveLength(13);
    expect(buildBuckets("1a", NOW)).toHaveLength(12);
  });

  it("conta eventos na janela correta e ignora os de fora", () => {
    const b = buildBuckets("7d", NOW);
    const counts = countByBucket(b, [NOW.toISOString(), addDays(NOW, -1).toISOString(), addDays(NOW, -30).toISOString(), null]);
    expect(counts.at(-1)).toBe(1);
    expect(counts.at(-2)).toBe(1);
    expect(counts.reduce((a, c) => a + c, 0)).toBe(2);
  });
});

describe("leads", () => {
  it("deriva temperatura da etapa e exclui perdidos", () => {
    expect(temperatureOf("novo")).toBe("frio");
    expect(temperatureOf("respondeu")).toBe("morno");
    expect(temperatureOf("negociacao")).toBe("quente");
    expect(temperatureOf("ganho")).toBe("convertido");
    expect(temperatureOf("perdido")).toBeNull();
  });

  it("score soma componentes explicados", () => {
    const db = createSeed(NOW);
    const lead = { ...db.leads[0], websiteSituation: "sem_site" as const, priority: "alta" as const, stage: "proposta" as const };
    const { score, reasons } = leadScore(lead);
    expect(score).toBe(40 + 30 + 30);
    expect(reasons).toHaveLength(3);
  });

  it("funil é monotônico e conversão = vendas ÷ leads", () => {
    const db = createSeed(NOW);
    const f = funnel(db);
    expect(f.total).toBeGreaterThanOrEqual(f.contacted);
    expect(f.contacted).toBeGreaterThanOrEqual(f.proposals);
    expect(f.proposals).toBeGreaterThanOrEqual(f.won);
    expect(f.conversion).toBeCloseTo((f.won / f.total) * 100, 5);
  });

  it("valida entrada de lead no servidor (UF e URL)", () => {
    const base = {
      name: "Padaria Teste",
      segment: "restaurantes",
      city: "Campinas",
      uf: "sp",
      source: "manual",
      website: "www.exemplo.com.br",
      websiteSituation: "desatualizado",
      stage: "novo",
      priority: "media",
      phone: "",
      email: "",
      instagram: "",
      potentialValue: "990",
      nextAction: "",
      nextActionAt: null,
      notes: "",
    };
    const ok = leadInputSchema.parse(base);
    expect(ok.uf).toBe("SP");
    expect(ok.website).toBe("https://www.exemplo.com.br");
    expect(ok.potentialValue).toBe(990);
    expect(leadInputSchema.safeParse({ ...base, uf: "São Paulo" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...base, email: "invalido" }).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...base, potentialValue: "-1" }).success).toBe(false);
    expect(optionalUrl.parse("")).toBe("");
  });
});

describe("projetos", () => {
  const project = (done: number, total: number, stage: Project["stage"], deliveredAt: string | null = null): Project => ({
    id: "p",
    clientId: "c",
    proposalId: null,
    title: "Site",
    siteType: "landing",
    stage,
    startDate: NOW.toISOString(),
    dueDate: addDays(NOW, 10).toISOString(),
    contractValue: 590,
    tasks: Array.from({ length: total }, (_, i) => ({ id: String(i), title: "t", stage: "briefing" as const, done: i < done, doneAt: null })),
    previewUrl: "",
    publishedUrl: "",
    publishedAt: null,
    deliveredAt,
    notes: "",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });

  it("progresso = tarefas concluídas ÷ total", () => {
    expect(projectProgress(project(3, 12, "design"))).toBe(25);
    expect(projectProgress(project(0, 0, "briefing"))).toBe(0);
    expect(projectProgress(project(0, 0, "entrega"))).toBe(100);
  });

  it("status derivado da etapa", () => {
    expect(projectStatus(project(0, 5, "briefing"))).toBe("nao_iniciado");
    expect(projectStatus(project(1, 5, "briefing"))).toBe("em_desenvolvimento");
    expect(projectStatus(project(3, 5, "revisao"))).toBe("em_revisao");
    expect(projectStatus(project(5, 5, "entrega", NOW.toISOString()))).toBe("concluido");
  });
});

describe("financeiro", () => {
  const tx = (amount: number, paid: number[], dueOffset: number, cancelled = false): Transaction => ({
    id: "t",
    kind: "receita",
    clientId: null,
    projectId: null,
    description: "x",
    amount,
    dueDate: addDays(NOW, dueOffset).toISOString(),
    payments: paid.map((a, i) => ({ id: String(i), amount: a, date: NOW.toISOString(), note: "" })),
    cancelled,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  });

  it("status considera pagamentos parciais, vencimento e cancelamento", () => {
    expect(transactionStatus(tx(500, [500], -10), NOW)).toBe("pago");
    expect(transactionStatus(tx(500, [200], 5), NOW)).toBe("parcial");
    expect(transactionStatus(tx(500, [200], -5), NOW)).toBe("vencido");
    expect(transactionStatus(tx(500, [], 5), NOW)).toBe("a_receber");
    expect(transactionStatus(tx(500, [], -5, true), NOW)).toBe("cancelado");
    expect(openAmount(tx(500, [200], 5))).toBe(300);
    expect(openAmount(tx(500, [], 5, true))).toBe(0);
  });

  it("resumo separa contratado, faturado, recebido e custos e fecha a conta", () => {
    const db = createSeed(NOW);
    const s = financeSummary(db, NOW);
    expect(s.received + s.open).toBeCloseTo(s.invoiced, 2);
    expect(s.toReceive + s.overdue).toBeCloseTo(s.open, 2);
    expect(s.costs).toBeGreaterThan(0);
    expect(s.averageTicket).toBeCloseTo(s.contracted / s.sales, 2);
  });

  it("base vazia não gera divisão por zero", () => {
    const s = financeSummary(createEmptyDatabase(undefined, NOW), NOW);
    expect(s.averageTicket).toBeNull();
    expect(s.received).toBe(0);
  });
});

describe("propostas e home", () => {
  it("total = itens − desconto, nunca negativo", () => {
    expect(proposalTotal({ items: [{ id: "a", description: "x", quantity: 2, unitPrice: 300 }], discount: 100 })).toBe(500);
    expect(proposalTotal({ items: [{ id: "a", description: "x", quantity: 1, unitPrice: 100 }], discount: 500 })).toBe(0);
  });

  it("aprovação sem propostas decididas é null (sem base)", () => {
    expect(approvalRate([])).toBeNull();
  });

  it("radar sempre em 0–100 ou null, com fórmula", () => {
    const axes = commercialRadar(createSeed(NOW), NOW);
    expect(axes).toHaveLength(6);
    for (const a of axes) {
      if (a.value !== null) expect(a.value).toBeGreaterThanOrEqual(0);
      if (a.value !== null) expect(a.value).toBeLessThanOrEqual(100);
      expect(a.formula.length).toBeGreaterThan(10);
    }
    expect(commercialRadar(createEmptyDatabase(undefined, NOW), NOW).every((a) => a.value === null || a.value === 0)).toBe(true);
  });

  it("próximas ações retornam contagens não negativas com link", () => {
    for (const a of nextActions(createSeed(NOW), NOW)) {
      expect(a.count).toBeGreaterThanOrEqual(0);
      expect(a.href.startsWith("/")).toBe(true);
    }
  });
});

describe("integridade da semente demonstrativa", () => {
  const db = createSeed(NOW);
  it("é marcada como demonstração e tem IDs únicos", () => {
    expect(db.demo).toBe(true);
    const ids = [...db.leads, ...db.clients, ...db.projects, ...db.proposals, ...db.transactions, ...db.activities].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("relacionamentos apontam para registros existentes", () => {
    const clientIds = new Set(db.clients.map((c) => c.id));
    expect(db.projects.every((p) => clientIds.has(p.clientId))).toBe(true);
    expect(db.leads.filter((l) => l.stage === "ganho").every((l) => l.clientId && clientIds.has(l.clientId))).toBe(true);
    expect(db.transactions.every((t) => !t.clientId || clientIds.has(t.clientId))).toBe(true);
  });
  it("é determinística", () => {
    expect(createSeed(NOW).leads.map((l) => l.name)).toEqual(db.leads.map((l) => l.name));
  });
});

describe("fluxo de caixa do Financeiro", () => {
  it("entradas e saídas vêm só de pagamentos e o saldo fecha", async () => {
    const { cashFlow, cashMovements, receivablesAging, projectResults, variation } = await import("./finance");
    const db = createSeed(NOW);
    const flow = cashFlow(db, "1a", NOW);
    const moves = cashMovements(db);
    const inAll = moves.filter((m) => m.kind === "entrada").reduce((s, m) => s + m.amount, 0);
    const outAll = moves.filter((m) => m.kind === "saida").reduce((s, m) => s + m.amount, 0);
    expect(flow.cashBalance).toBeCloseTo(inAll - outAll, 2);
    // Último ponto do saldo acumulado = saldo de caixa registrado (todos os movimentos estão no último ano).
    expect(flow.balance.at(-1)).toBeCloseTo(flow.cashBalance, 2);
    // Contratos não entram no caixa.
    expect(flow.period.inflow).toBeLessThanOrEqual(financeSummary(db, NOW).received + 0.001);
    const aging = receivablesAging(db, NOW);
    expect(aging.buckets.reduce((s, b) => s + b.value, 0)).toBeCloseTo(aging.total, 2);
    expect(variation(100, 0)).toBeNull();
    expect(variation(150, 100)).toBe(50);
    for (const r of projectResults(db)) if (r.costs === 0) expect(r.result).toBeNull();
  });
});
