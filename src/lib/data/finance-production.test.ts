import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { LeadInput, ProposalInput } from "../schemas";

/**
 * Cenários financeiros de produção, rodando no repositório real (modo local
 * em memória). Nada aqui é gravado em banco: registros temporários e isolados.
 */
beforeAll(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", {
    localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});

const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

const lead = (name: string): LeadInput => ({
  name, segment: "restaurantes", city: "Campinas", uf: "SP", source: "manual", website: "", websiteSituation: "sem_site",
  stage: "qualificado", priority: "alta", phone: "(19) 98888-1234", email: "", instagram: "", potentialValue: 990,
  nextAction: "", nextActionAt: null, notes: "",
});
const proposal = (leadId: string, value = 990): ProposalInput => ({
  recipientName: "Cliente Teste", leadId, clientId: null, title: "Site", packageId: "profissional",
  items: [{ id: "i1", description: "Pacote Profissional", quantity: 1, unitPrice: value }], scope: "", discount: 0,
  deadlineDays: 15, revisions: 2, paymentTerms: "", exclusions: "", validUntil: new Date(Date.now() + 15 * DAY).toISOString(),
  status: "enviada", nextAction: "", notes: "",
});

async function load() {
  const repo = await import("./repository");
  const { getDb } = await import("./store");
  const fin = await import("../metrics/finance");
  const { homeIndicators } = await import("../metrics/home-overview");
  return { repo, getDb, fin, homeIndicators };
}

beforeEach(async () => {
  const { repo } = await load();
  repo.startFromScratch();
});

describe("Financeiro vazio", () => {
  it("mostra zeros reais, sem saldo presumido nem comparação inventada", async () => {
    const { getDb, fin } = await load();
    const db = getDb();
    const s = fin.financeSummary(db);
    expect([s.contracted, s.received, s.open, s.overdue, s.costs]).toEqual([0, 0, 0, 0, 0]);
    expect(s.averageTicket).toBeNull();
    for (const range of ["7d", "30d", "90d", "1a"] as const) {
      const f = fin.cashFlow(db, range);
      expect(f.period).toEqual({ inflow: 0, outflow: 0, contracted: 0 });
      expect(f.hasMovement).toBe(false);
      expect(f.cashBalance).toBeNull(); // saldo inicial não informado ≠ saldo zero
      expect(f.balanceKind).toBe("liquido");
      expect(f.balance.every((v) => v === 0)).toBe(true); // sem curva fictícia
      expect(fin.variation(f.period.inflow, f.previous.inflow)).toBeNull();
    }
    const aging = fin.receivablesAging(db);
    expect([aging.total, aging.notDue, aging.overdue, aging.partial, aging.count]).toEqual([0, 0, 0, 0, 0]);
  });
});

describe("cenário R$ 990 em duas parcelas", () => {
  it("contrato → parcelas → primeiro recebimento → Dashboard", async () => {
    const { repo, getDb, fin, homeIndicators } = await load();
    const l = repo.createLead(lead("Padaria 990"));
    const p = repo.createProposal(proposal(l.id));
    // Proposta aberta não é receita contratada.
    expect(fin.financeSummary(getDb()).contracted).toBe(0);

    const sale = repo.closeSale(p.id);
    let db = getDb();
    expect(fin.financeSummary(db).contracted).toBe(990);
    expect(sale.transactions.map((t) => t.amount).sort()).toEqual([495, 495]);
    expect(fin.financeSummary(db).received).toBe(0);
    expect(fin.receivablesAging(db).total).toBe(990);

    // Repetir a operação não duplica contrato nem parcelas.
    expect(repo.closeSale(p.id).created).toBe(false);
    expect(getDb().projects).toHaveLength(1);
    expect(getDb().transactions).toHaveLength(2);

    const first = sale.transactions.find((t) => t.description.startsWith("Entrada"))!;
    repo.addPayment(first.id, { amount: 495, date: new Date().toISOString(), method: "pix", note: "" });
    db = getDb();
    const s = fin.financeSummary(db);
    expect(s.received).toBe(495);
    expect(s.open).toBe(495);
    expect(fin.cashFlow(db, "30d").period.inflow).toBe(495);
    expect(fin.transactionStatus(db.transactions.find((t) => t.id === first.id)!)).toBe("pago");
    expect(db.transactions.find((t) => t.id === first.id)!.payments[0].method).toBe("pix");

    const home = homeIndicators(db, Date.now() - 30 * DAY, Date.now() + DAY);
    expect(home.contracted).toBe(990);
    expect(home.received).toBe(495);
    expect(home.receivable).toBe(495);

    // Clique repetido no mesmo recebimento: bloqueado (parcela quitada).
    expect(() => repo.addPayment(first.id, { amount: 495, date: new Date().toISOString(), note: "" })).toThrow(/quitado/);
  });
});

describe("recebimentos", () => {
  it("parcial, pendente e vencido ficam separados", async () => {
    const { repo, getDb, fin } = await load();
    const aVencer = repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Parcela a vencer", amount: 300, dueDate: new Date(Date.now() + 10 * DAY).toISOString() });
    const vencida = repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Parcela vencida", amount: 200, dueDate: daysAgo(10) });
    repo.addPayment(aVencer.id, { amount: 120.5, date: new Date().toISOString(), note: "" });
    const db = getDb();
    const aging = fin.receivablesAging(db);
    expect(fin.transactionStatus(db.transactions.find((t) => t.id === aVencer.id)!)).toBe("parcial");
    expect(fin.transactionStatus(db.transactions.find((t) => t.id === vencida.id)!)).toBe("vencido");
    expect(aging.overdue).toBe(200);
    expect(aging.notDue).toBe(179.5);
    expect(aging.partialCount).toBe(1);
    expect(aging.partial).toBe(179.5);
    expect(aging.total).toBe(379.5);
  });

  it("recebimento acima do saldo e clique duplicado são recusados", async () => {
    const { repo, getDb } = await load();
    const tx = repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Parcela dupla", amount: 800, dueDate: new Date().toISOString() });
    expect(() => repo.addPayment(tx.id, { amount: 800.01, date: new Date().toISOString(), note: "" })).toThrow(/maior que o saldo/);
    repo.addPayment(tx.id, { amount: 100, date: new Date().toISOString(), note: "" });
    expect(() => repo.addPayment(tx.id, { amount: 100, date: new Date().toISOString(), note: "" })).toThrow(/acabou de ser registrado/);
    expect(getDb().transactions.find((t) => t.id === tx.id)!.payments).toHaveLength(1);
  });

  it("recebimento avulso já recebido entra no caixa numa única operação", async () => {
    const { repo, getDb, fin } = await load();
    repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Avulso", amount: 250, dueDate: new Date().toISOString() }, { date: new Date().toISOString(), method: "transferencia" });
    const f = fin.cashFlow(getDb(), "7d");
    expect(f.period.inflow).toBe(250);
    expect(fin.financeSummary(getDb()).open).toBe(0);
  });
});

describe("despesas", () => {
  it("primeira despesa paga vira saída; a pagar não mexe no caixa", async () => {
    const { repo, getDb, fin } = await load();
    repo.createTransaction({ kind: "custo", clientId: null, projectId: null, description: "Hospedagem", amount: 59.9, dueDate: new Date().toISOString(), category: "hospedagem" }, { date: new Date().toISOString(), method: "cartao" });
    repo.createTransaction({ kind: "custo", clientId: null, projectId: null, description: "Domínio a pagar", amount: 40, dueDate: new Date(Date.now() + 5 * DAY).toISOString(), category: "dominio" });
    const f = fin.cashFlow(getDb(), "30d");
    expect(f.period.outflow).toBe(59.9);
    expect(f.netMovement).toBe(-59.9);
    expect(getDb().transactions.find((t) => t.description === "Hospedagem")!.category).toBe("hospedagem");
  });
});

describe("períodos e comparação", () => {
  it("o filtro muda os dados consultados e a comparação só existe com base anterior", async () => {
    const { repo, getDb, fin } = await load();
    repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Antigo", amount: 1000, dueDate: daysAgo(40) }, { date: daysAgo(40) });
    const db = getDb();
    expect(fin.cashFlow(db, "30d").period.inflow).toBe(0);
    expect(fin.cashFlow(db, "90d").period.inflow).toBe(1000);
    expect(fin.cashFlow(db, "7d").buckets).toHaveLength(7);
    expect(fin.cashFlow(db, "30d").buckets).toHaveLength(30);
    // 30d: período anterior (30–60 dias) tem a entrada; o atual não tem.
    const f30 = fin.cashFlow(db, "30d");
    expect(f30.previous.inflow).toBe(1000);
    expect(fin.variation(f30.period.inflow, f30.previous.inflow)).toBe(-100);
    const f7 = fin.cashFlow(db, "7d");
    expect(fin.variation(f7.period.inflow, f7.previous.inflow)).toBeNull();
  });
});

describe("saldo de caixa", () => {
  it("com saldo inicial: saldo = informado + movimentos a partir da data; antes dela não conta em dobro", async () => {
    const { repo, getDb, fin } = await load();
    repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Antes do extrato", amount: 500, dueDate: daysAgo(20) }, { date: daysAgo(20) });
    repo.setOpeningBalance({ amount: 2000, date: daysAgo(10) });
    repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Depois do extrato", amount: 300, dueDate: daysAgo(5) }, { date: daysAgo(5) });
    repo.createTransaction({ kind: "custo", clientId: null, projectId: null, description: "Despesa depois", amount: 100, dueDate: daysAgo(2) }, { date: daysAgo(2) });
    const f = fin.cashFlow(getDb(), "30d");
    expect(f.balanceKind).toBe("saldo");
    expect(f.cashBalance).toBe(2200);
    expect(f.netMovement).toBe(700);
    expect(f.balance.at(-1)).toBe(2200);
    repo.setOpeningBalance(null);
    expect(fin.cashFlow(getDb(), "30d").cashBalance).toBeNull();
  });
});

describe("correções com rastreabilidade", () => {
  it("parcela atualizada registra antes/depois e não fica abaixo do pago", async () => {
    const { repo, getDb } = await load();
    const tx = repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Parcela editável", amount: 600, dueDate: new Date().toISOString() });
    repo.addPayment(tx.id, { amount: 250, date: new Date().toISOString(), note: "" });
    const base = { description: "Parcela editável", dueDate: new Date(Date.now() + 3 * DAY).toISOString(), category: "" as const, notes: "renegociada", clientId: null, projectId: null };
    expect(() => repo.updateTransaction(tx.id, { ...base, amount: 200 })).toThrow(/abaixo do já pago/);
    repo.updateTransaction(tx.id, { ...base, amount: 650 });
    const db = getDb();
    expect(db.transactions.find((t) => t.id === tx.id)!.amount).toBe(650);
    expect(db.activities[0].description).toMatch(/Financeiro: lançamento corrigido — valor .*600,00 → .*650,00/);
  });

  it("lançamento com pagamento não é cancelado; estorno exige motivo e fica no histórico", async () => {
    const { repo, getDb, fin } = await load();
    const tx = repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Recebido por engano", amount: 410, dueDate: new Date().toISOString() });
    repo.addPayment(tx.id, { amount: 410, date: new Date().toISOString(), note: "" });
    expect(() => repo.setTransactionCancelled(tx.id, true)).toThrow(/Estorne/);
    const payment = getDb().transactions.find((t) => t.id === tx.id)!.payments[0];
    expect(() => repo.reversePayment(tx.id, payment.id, "")).toThrow(/motivo/);
    repo.reversePayment(tx.id, payment.id, "lançado em duplicidade");
    expect(fin.financeSummary(getDb()).received).toBe(0);
    expect(getDb().activities[0].description).toMatch(/estorno de .*410,00.*Motivo: lançado em duplicidade/);
    repo.setTransactionCancelled(tx.id, true);
    expect(getDb().transactions.find((t) => t.id === tx.id)!.cancelled).toBe(true); // não apagado
    expect(fin.financeSummary(getDb()).open).toBe(0);
  });
});

describe("cancelamento de contrato", () => {
  it("tira da receita contratada, cancela o não pago e preserva o recebido", async () => {
    const { repo, getDb, fin, homeIndicators } = await load();
    const l = repo.createLead(lead("Studio Cancelado"));
    const sale = repo.closeSale(repo.createProposal(proposal(l.id, 1000)).id);
    const [entry, rest] = [...sale.transactions].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    repo.addPayment(entry.id, { amount: 200, date: new Date().toISOString(), note: "" }); // parcial
    expect(() => repo.cancelProjectContract(sale.project.id, "")).toThrow(/motivo/);
    repo.cancelProjectContract(sale.project.id, "cliente desistiu");
    const db = getDb();
    const s = fin.financeSummary(db);
    expect(s.contracted).toBe(0);
    expect(s.received).toBe(200);
    expect(s.open).toBe(0);
    expect(db.transactions.find((t) => t.id === rest.id)!.cancelled).toBe(true);
    expect(db.transactions.find((t) => t.id === entry.id)!.amount).toBe(200);
    expect(homeIndicators(db, Date.now() - 30 * DAY, Date.now() + DAY).contracted).toBe(0);
    expect(fin.cashFlow(db, "30d").period.inflow).toBe(200);
    expect(db.activities[0].description).toMatch(/contrato de .*1\.000,00 cancelado/);
    repo.reactivateProjectContract(sale.project.id);
    expect(fin.financeSummary(getDb()).contracted).toBe(1000);
  });
});

describe("validação no servidor", () => {
  it("aceita linhas antigas sem os campos novos e recusa valores fora do formato", async () => {
    const { changeSetSchema } = await import("./row-schemas");
    const id = "3f2b8c1e-8d4a-4f5e-9b6a-1c2d3e4f5a6b";
    const now = new Date().toISOString();
    const old = { id, kind: "receita", clientId: null, projectId: null, description: "Antiga", amount: 10, dueDate: now, cancelled: false, createdAt: now, updatedAt: now };
    const ok = changeSetSchema.safeParse({ upserts: { transactions: [old], payments: [{ id, transactionId: id, amount: 10, date: now, note: "", position: 0 }] }, deletes: {} });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.upserts.transactions![0].category).toBe("");
      expect(ok.data.upserts.payments![0].method).toBe("");
    }
    expect(changeSetSchema.safeParse({ upserts: { transactions: [{ ...old, category: "bitcoin" }] }, deletes: {} }).success).toBe(false);
    expect(changeSetSchema.safeParse({ upserts: { transactions: [{ ...old, amount: 10.005 }] }, deletes: {} }).success).toBe(false);
    expect(changeSetSchema.safeParse({ upserts: { payments: [{ id, transactionId: id, amount: 5, date: now, method: "cheque-sem-fundo", note: "", position: 0 }] }, deletes: {} }).success).toBe(false);
  });
});
