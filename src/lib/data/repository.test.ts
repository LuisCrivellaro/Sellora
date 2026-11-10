import { beforeAll, describe, expect, it, vi } from "vitest";

/** localStorage em memória para exercitar o repositório fora do navegador. */
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

describe("repositório local (modo demo)", () => {
  it("cria lead válido, rejeita inválido e registra mudança de etapa", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const before = getDb().leads.length;
    const lead = repo.createLead({
      name: "Teste Bistrô",
      segment: "restaurantes",
      city: "Campinas",
      uf: "SP",
      source: "manual",
      website: "",
      websiteSituation: "sem_site",
      stage: "novo",
      priority: "alta",
      phone: "",
      email: "",
      instagram: "",
      potentialValue: 590,
      nextAction: "",
      nextActionAt: null,
      notes: "",
    });
    expect(getDb().leads.length).toBe(before + 1);
    expect(() => repo.createLead({ ...lead, website: "", name: "x" })).toThrow();

    repo.moveLeadStage(lead.id, "contatado");
    expect(getDb().leads.find((l) => l.id === lead.id)?.stage).toBe("contatado");
    expect(getDb().activities.some((a) => a.leadId === lead.id && a.type === "etapa")).toBe(true);
  });

  it("contato concluído atualiza o último contato", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const lead = getDb().leads.find((l) => !l.lastContactAt)!;
    repo.addActivity({ leadId: lead.id }, { type: "whatsapp", description: "Primeiro contato", dueAt: null, completed: true });
    expect(getDb().leads.find((l) => l.id === lead.id)?.lastContactAt).not.toBeNull();
  });

  it("converter lead em cliente é idempotente (não duplica)", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const lead = getDb().leads.find((l) => l.stage === "negociacao")!;
    const before = getDb().clients.length;
    const c1 = repo.convertLeadToClient(lead.id);
    const c2 = repo.convertLeadToClient(lead.id);
    expect(c1.id).toBe(c2.id);
    expect(getDb().clients.length).toBe(before + 1);
    expect(getDb().leads.find((l) => l.id === lead.id)?.stage).toBe("ganho");
  });

  it("novo projeto recebe checklist padrão e tarefa altera progresso", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const { projectProgress } = await import("../metrics/projects");
    const client = getDb().clients[0];
    const p = repo.createProject({
      clientId: client.id,
      title: "Site teste",
      siteType: "landing",
      stage: "briefing",
      startDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 86400000 * 10).toISOString(),
      contractValue: 590,
      previewUrl: "",
      publishedUrl: "",
      notes: "",
    });
    expect(p.tasks.length).toBe(12);
    repo.toggleProjectTask(p.id, p.tasks[0].id);
    expect(projectProgress(getDb().projects.find((x) => x.id === p.id)!)).toBe(8);
  });

  it("pagamento parcial é aceito e excedente é recusado", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const { openAmount, transactionStatus } = await import("../metrics/finance");
    const tx = repo.createTransaction({ kind: "receita", clientId: null, projectId: null, description: "Saldo teste", amount: 500, dueDate: new Date(Date.now() + 86400000 * 5).toISOString() });
    repo.addPayment(tx.id, { amount: 200, date: new Date().toISOString(), note: "" });
    const saved = getDb().transactions.find((t) => t.id === tx.id)!;
    expect(openAmount(saved)).toBe(300);
    expect(transactionStatus(saved)).toBe("parcial");
    expect(() => repo.addPayment(tx.id, { amount: 400, date: new Date().toISOString(), note: "" })).toThrow();
  });

  it("duplicar proposta cria rascunho independente", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    const src = getDb().proposals.find((p) => p.status === "aprovada")!;
    const copy = repo.duplicateProposal(src.id);
    expect(copy.status).toBe("rascunho");
    expect(copy.sentAt).toBeNull();
    expect(copy.items[0].id).not.toBe(src.items[0].id);
  });

  it("começar do zero remove registros fictícios e mantém configurações", async () => {
    const repo = await import("./repository");
    const { getDb } = await import("./store");
    repo.updateSettings({ monthlyLeadTarget: 42 });
    repo.startFromScratch();
    const db = getDb();
    expect(db.demo).toBe(false);
    expect(db.leads).toHaveLength(0);
    expect(db.settings.monthlyLeadTarget).toBe(42);
  });
});
