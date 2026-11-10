import { DEFAULT_PROJECT_TASKS, LEAD_STAGES, PROJECT_STAGES } from "../constants";
import { addDays } from "../dates";
import type {
  Activity,
  ActivityType,
  Client,
  Database,
  Lead,
  LeadSource,
  LeadStage,
  Project,
  ProjectStage,
  Proposal,
  Segment,
  Settings,
  Transaction,
  WebsiteSituation,
} from "../types";

/**
 * Dados FICTÍCIOS para o modo demonstração. Nenhum estabelecimento, valor ou
 * contato aqui é real. Gerados de forma determinística e relativa à data de
 * criação, para que os gráficos tenham histórico coerente.
 */

export const DB_VERSION = 1;

export const defaultSettings: Settings = {
  profile: { name: "Fundador Sellora", email: "", role: "Administrador" },
  appearance: { motion: "system", density: "confortavel" },
  packages: [
    {
      id: "essencial",
      name: "Essencial",
      price: 590,
      description: "Landing page de uma página com CTA principal, mobile e SEO básico.",
    },
    {
      id: "profissional",
      name: "Profissional",
      price: 990,
      description: "Site institucional multipágina, SEO local e formulário de contato.",
    },
    {
      id: "personalizado",
      name: "Personalizado",
      price: 1490,
      description: "Escopo sob medida; valor a partir de R$ 1.490 conforme briefing.",
    },
  ],
  currency: "BRL",
  defaultProposalValidityDays: 15,
  defaultFollowUpDays: 3,
  defaultPaymentTerms: "50% de entrada na aprovação e 50% na entrega",
  entryPercent: 50,
  defaultRevisions: 2,
  monthlyLeadTarget: 30,
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LEADS: { name: string; segment: Segment; city: string; source: LeadSource; site: WebsiteSituation }[] = [
  { name: "Cantina Nonna Lúcia", segment: "restaurantes", city: "Campinas", source: "google_maps", site: "sem_site" },
  { name: "Clínica Sorriso Pleno", segment: "saude", city: "Valinhos", source: "google_maps", site: "desatualizado" },
  { name: "Studio Brisa Estética", segment: "beleza", city: "Campinas", source: "instagram", site: "sem_site" },
  { name: "Padaria Trigo Dourado", segment: "restaurantes", city: "Vinhedo", source: "google_maps", site: "sem_site" },
  { name: "Oficina Motor Certo", segment: "servicos", city: "Sumaré", source: "manual", site: "sem_site" },
  { name: "Pet Lar Feliz", segment: "servicos", city: "Campinas", source: "instagram", site: "sem_mobile" },
  { name: "Barbearia Navalha Fina", segment: "beleza", city: "Hortolândia", source: "instagram", site: "sem_site" },
  { name: "Empório Grão Mineiro", segment: "comercio", city: "Paulínia", source: "google_maps", site: "desatualizado" },
  { name: "Academia Ritmo Forte", segment: "saude", city: "Campinas", source: "indicacao", site: "sem_mobile" },
  { name: "Hamburgueria Brasa 22", segment: "restaurantes", city: "Indaiatuba", source: "instagram", site: "sem_site" },
  { name: "Doceria Açúcar Mascavo", segment: "restaurantes", city: "Valinhos", source: "instagram", site: "sem_site" },
  { name: "Ótica Visão Clara", segment: "comercio", city: "Americana", source: "google_maps", site: "desatualizado" },
  { name: "Floricultura Jardim Secreto", segment: "comercio", city: "Holambra", source: "manual", site: "sem_site" },
  { name: "Pizzaria Forno Antigo", segment: "restaurantes", city: "Campinas", source: "google_maps", site: "sem_mobile" },
  { name: "Espaço Pele de Seda", segment: "beleza", city: "Jundiaí", source: "indicacao", site: "sem_site" },
  { name: "Consultório Vida Leve Nutrição", segment: "saude", city: "Campinas", source: "manual", site: "sem_site" },
  { name: "Auto Center Pista Livre", segment: "servicos", city: "Sumaré", source: "google_maps", site: "desatualizado" },
  { name: "Café Grão da Serra", segment: "restaurantes", city: "Itatiba", source: "instagram", site: "sem_site" },
  { name: "Lavanderia Bolha Azul", segment: "servicos", city: "Campinas", source: "google_maps", site: "sem_site" },
  { name: "Ateliê Linha & Agulha", segment: "comercio", city: "Valinhos", source: "outros", site: "sem_site" },
  { name: "Clínica Vet Patas & Cia", segment: "saude", city: "Jundiaí", source: "google_maps", site: "sem_mobile" },
  { name: "Sushi Kaze", segment: "restaurantes", city: "Campinas", source: "google_maps", site: "desatualizado" },
  { name: "Escola de Idiomas Ponte", segment: "servicos", city: "Indaiatuba", source: "indicacao", site: "adequado" },
  { name: "Esmalteria Cor de Rosa", segment: "beleza", city: "Americana", source: "instagram", site: "sem_site" },
  { name: "Mercearia Dona Graça", segment: "comercio", city: "Vinhedo", source: "manual", site: "sem_site" },
  { name: "Fisioterapia Movimento", segment: "saude", city: "Campinas", source: "google_maps", site: "desatualizado" },
  { name: "Marmoraria Pedra Nobre", segment: "servicos", city: "Sumaré", source: "outros", site: "sem_site" },
  { name: "Restaurante Fogão a Lenha", segment: "restaurantes", city: "Itatiba", source: "google_maps", site: "sem_site" },
  { name: "Studio Pilates Equilíbrio", segment: "saude", city: "Valinhos", source: "instagram", site: "sem_mobile" },
  { name: "Chaveiro Rápido 24h", segment: "servicos", city: "Campinas", source: "google_maps", site: "sem_site" },
  { name: "Loja Bambolê Infantil", segment: "comercio", city: "Paulínia", source: "instagram", site: "desatualizado" },
  { name: "Salão Raízes Cachos", segment: "beleza", city: "Hortolândia", source: "indicacao", site: "sem_site" },
  { name: "Adega Vinhas do Sul", segment: "comercio", city: "Jundiaí", source: "manual", site: "sem_mobile" },
  { name: "Dedetizadora Lar Limpo", segment: "servicos", city: "Americana", source: "google_maps", site: "sem_site" },
  { name: "Tapiocaria Sabor Nordeste", segment: "restaurantes", city: "Campinas", source: "outros", site: "sem_site" },
  { name: "Psicologia Espaço Escuta", segment: "saude", city: "Indaiatuba", source: "indicacao", site: "sem_site" },
];

/** Distribuição de etapas, alinhada à ordem da lista acima. */
const STAGE_PLAN: LeadStage[] = [
  "ganho", "ganho", "negociacao", "ganho", "proposta", "ganho", "diagnostico", "proposta",
  "ganho", "respondeu", "contatado", "perdido", "qualificado", "ganho", "respondeu", "contatado",
  "novo", "qualificado", "novo", "contatado", "diagnostico", "perdido", "novo", "qualificado",
  "novo", "contatado", "novo", "respondeu", "proposta", "novo", "qualificado", "contatado",
  "novo", "novo", "qualificado", "novo",
];

const NEXT_ACTION_BY_STAGE: Record<LeadStage, string> = {
  novo: "Verificar presença digital e qualificar",
  qualificado: "Primeiro contato pelo canal comercial",
  contatado: "Follow-up da primeira mensagem",
  respondeu: "Agendar diagnóstico",
  diagnostico: "Enviar diagnóstico e proposta",
  proposta: "Follow-up da proposta",
  negociacao: "Ajustar escopo e fechar",
  ganho: "Iniciar briefing",
  perdido: "",
};

const PEOPLE = ["Marina", "Rafael", "Juliana", "Carlos", "Patrícia", "Eduardo", "Renata", "Thiago"];

function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Completa campos criados depois (dados antigos do navegador ou do banco) sem perder o que já existe. */
export function normalizeDatabase(db: Database): Database {
  const settings = { ...structuredClone(defaultSettings), ...db.settings };
  const needsScope = db.proposals.some((p) => typeof p.scope !== "string");
  const sameSettings = Object.keys(settings).every((k) => k in db.settings);
  if (sameSettings && !needsScope) return db;
  return { ...db, settings, proposals: needsScope ? db.proposals.map((p) => ({ ...p, scope: p.scope ?? "" })) : db.proposals };
}

export function createSeed(now: Date = new Date()): Database {
  const r = rng(20261106);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const between = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const at = (daysAgo: number, hour = between(9, 18)) => {
    const d = addDays(now, -daysAgo);
    d.setHours(hour, between(0, 59), 0, 0);
    return d.toISOString();
  };

  const leads: Lead[] = [];
  const activities: Activity[] = [];
  const clients: Client[] = [];
  const projects: Project[] = [];
  const proposals: Proposal[] = [];
  const transactions: Transaction[] = [];
  let seq = 0;
  const id = (p: string) => `${p}_demo${(++seq).toString(36).padStart(4, "0")}`;

  const act = (a: Omit<Activity, "id">) => activities.push({ id: id("act"), ...a });

  // Leads adicionais gerados por combinação (todos fictícios) para dar volume ao histórico.
  const extraPrefix: [string, Segment][] = [
    ["Padaria", "restaurantes"], ["Lanchonete", "restaurantes"], ["Clínica", "saude"], ["Salão", "beleza"],
    ["Oficina", "servicos"], ["Loja", "comercio"], ["Studio", "beleza"], ["Pet Shop", "servicos"],
    ["Açougue", "comercio"], ["Consultório", "saude"], ["Bistrô", "restaurantes"], ["Papelaria", "comercio"],
  ];
  const extraNames = ["Aurora", "Bom Gosto", "Central", "do Bairro", "Estrela", "Flor de Lis", "Girassol", "Horizonte", "Ipê", "Jabuticaba", "Lua Nova", "Maré", "Nativa", "Oásis", "Pérola", "Recanto", "Sabiá", "Tropical", "Vila Rica", "Zênite"];
  const extraCities = ["Campinas", "Valinhos", "Vinhedo", "Sumaré", "Indaiatuba", "Jundiaí", "Americana", "Paulínia", "Hortolândia", "Itatiba"];
  const weighted = <T,>(pairs: [T, number][]) => {
    let x = r();
    for (const [v, w] of pairs) {
      if ((x -= w) <= 0) return v;
    }
    return pairs[0][0];
  };
  const extras = Array.from({ length: 48 }, (_, k) => {
    const [prefix, segment] = extraPrefix[k % extraPrefix.length];
    const stage = weighted<LeadStage>([["novo", 0.24], ["qualificado", 0.2], ["contatado", 0.2], ["respondeu", 0.08], ["diagnostico", 0.04], ["perdido", 0.24]]);
    const ago = stage === "novo" ? between(0, 28) : Math.floor(r() ** 1.5 * 320) + 6;
    return {
      name: `${prefix} ${extraNames[(k * 7) % extraNames.length]}`,
      segment,
      city: extraCities[k % extraCities.length],
      source: weighted<LeadSource>([["google_maps", 0.4], ["instagram", 0.3], ["manual", 0.15], ["indicacao", 0.08], ["outros", 0.07]]),
      site: weighted<WebsiteSituation>([["sem_site", 0.5], ["desatualizado", 0.25], ["sem_mobile", 0.2], ["adequado", 0.05]]),
      stage,
      ago: ago as number | null,
    };
  });
  const specs = [...LEADS.map((s, i) => ({ ...s, stage: STAGE_PLAN[i], ago: null as number | null })), ...extras];

  specs.forEach((spec) => {
    const stage = spec.stage;
    const stageIdx = LEAD_STAGES.indexOf(stage);
    // Leads mais avançados foram captados há mais tempo.
    const createdAgo =
      spec.ago ?? (stage === "novo" ? between(0, 20) : stage === "ganho" ? between(70, 160) : between(14 + stageIdx * 6, 40 + stageIdx * 12));
    const leadId = id("lead");
    const createdAt = at(createdAgo);
    const priority = stage === "novo" || stage === "perdido" ? pick(["baixa", "media"] as const) : pick(["media", "alta", "alta"] as const);
    const base = spec.segment === "restaurantes" || spec.segment === "beleza" ? 590 : 990;
    const potentialValue = stageIdx >= 5 ? pick([590, 990, 990, 1490, 1890]) : base;

    // Linha do tempo de contatos coerente com a etapa.
    let lastContactAt: string | null = null;
    const contactSteps = stage === "perdido" ? 3 : Math.max(0, stageIdx - 1);
    let cursor = createdAgo;
    for (let s = 0; s < contactSteps; s++) {
      cursor = Math.max(0, cursor - between(2, 9));
      const type: ActivityType = s === 0 ? pick(["whatsapp", "ligacao", "visita"] as const) : pick(["whatsapp", "ligacao", "email", "reuniao"] as const);
      const when = at(cursor);
      act({
        leadId,
        clientId: null,
        projectId: null,
        type,
        description:
          s === 0
            ? "Primeiro contato: apresentação da Sellora e do diagnóstico gratuito"
            : s === 1
              ? "Conversa sobre a presença digital atual e objetivos"
              : s === 2
                ? "Diagnóstico apresentado com pontos de melhoria"
                : "Alinhamento de escopo e condições",
        dueAt: null,
        completedAt: when,
        createdAt: when,
      });
      lastContactAt = when;
    }

    // Follow-ups: alguns concluídos, alguns pendentes (inclusive vencidos).
    if (stageIdx >= 2 && stageIdx <= 6) {
      const due = addDays(now, between(-4, 5));
      due.setHours(10, 0, 0, 0);
      act({
        leadId,
        clientId: null,
        projectId: null,
        type: "follow_up",
        description: NEXT_ACTION_BY_STAGE[stage],
        dueAt: due.toISOString(),
        completedAt: null,
        createdAt: lastContactAt ?? createdAt,
      });
      if (r() > 0.4) {
        const done = at(Math.max(1, cursor + 2));
        act({
          leadId,
          clientId: null,
          projectId: null,
          type: "follow_up",
          description: "Follow-up de retorno",
          dueAt: done,
          completedAt: done,
          createdAt: done,
        });
      }
    }

    const nextActionAt = stage === "perdido" || stage === "ganho" ? null : addDays(now, between(-3, 6)).toISOString();

    leads.push({
      id: leadId,
      name: spec.name,
      segment: spec.segment,
      city: spec.city,
      uf: "SP",
      source: spec.source,
      website: spec.site === "sem_site" ? null : `https://www.${slug(spec.name)}.com.br`,
      websiteSituation: spec.site,
      stage,
      priority,
      phone: `(19) 9${between(1000, 9999)}-${between(1000, 9999)}`,
      email: r() > 0.5 ? `contato@${slug(spec.name)}.com.br` : "",
      instagram: spec.source === "instagram" || r() > 0.5 ? `@${slug(spec.name).slice(0, 18)}` : "",
      potentialValue,
      lastContactAt,
      nextAction: NEXT_ACTION_BY_STAGE[stage],
      nextActionAt,
      notes: "",
      clientId: null,
      lostReason: stage === "perdido" ? "Optou por manter apenas as redes sociais por enquanto." : "",
      createdAt,
      updatedAt: lastContactAt ?? createdAt,
    });
  });

  // Propostas para leads em proposta/negociação/ganho/perdido.
  const pkgPrice = { essencial: 590, profissional: 990, personalizado: 1490 } as const;
  for (const lead of leads) {
    if (!["proposta", "negociacao", "ganho", "perdido"].includes(lead.stage)) continue;
    // A maioria dos leads perdidos sai do funil antes de receber proposta.
    if (lead.stage === "perdido" && r() > 0.3) continue;
    const packageId = lead.potentialValue >= 1490 ? "personalizado" : lead.potentialValue >= 990 ? "profissional" : "essencial";
    const created = new Date(lead.lastContactAt ?? lead.createdAt);
    const sentAt = addDays(created, 1).toISOString();
    const status =
      lead.stage === "ganho" ? "aprovada" : lead.stage === "perdido" ? "recusada" : lead.stage === "negociacao" ? "negociacao" : "enviada";
    const items: { id: string; description: string; quantity: number; unitPrice: number }[] = [
      { id: id("item"), description: `Pacote ${packageId === "essencial" ? "Essencial" : packageId === "profissional" ? "Profissional" : "Personalizado"}`, quantity: 1, unitPrice: pkgPrice[packageId] },
    ];
    if (lead.potentialValue > pkgPrice[packageId]) {
      items.push({ id: id("item"), description: "Página extra de cardápio/serviços", quantity: 1, unitPrice: lead.potentialValue - pkgPrice[packageId] });
    }
    proposals.push({
      id: id("prop"),
      leadId: lead.id,
      clientId: null,
      recipientName: lead.name,
      title: `Site ${lead.name}`,
      packageId,
      items,
      discount: 0,
      deadlineDays: packageId === "essencial" ? 7 : packageId === "profissional" ? 15 : 25,
      revisions: 2,
      paymentTerms: "50% na aprovação, 50% na entrega",
      scope: "",
      exclusions: "Domínio, hospedagem, produção de fotos e manutenção mensal não inclusos.",
      validUntil: addDays(created, 15).toISOString(),
      status,
      sentAt,
      decidedAt: status === "aprovada" || status === "recusada" ? addDays(created, between(3, 8)).toISOString() : null,
      nextAction: status === "enviada" ? "Confirmar recebimento e tirar dúvidas" : status === "negociacao" ? "Responder ajuste de escopo" : "",
      notes: "",
      createdAt: created.toISOString(),
      updatedAt: sentAt,
    });
  }
  // Um rascunho ainda não enviado.
  const draftLead = leads.find((l) => l.stage === "diagnostico");
  if (draftLead) {
    proposals.push({
      id: id("prop"),
      leadId: draftLead.id,
      clientId: null,
      recipientName: draftLead.name,
      title: `Site ${draftLead.name}`,
      packageId: "profissional",
      items: [{ id: id("item"), description: "Pacote Profissional", quantity: 1, unitPrice: 990 }],
      discount: 0,
      deadlineDays: 15,
      revisions: 2,
      paymentTerms: "50% na aprovação, 50% na entrega",
      scope: "",
      exclusions: "Domínio, hospedagem e manutenção mensal não inclusos.",
      validUntil: addDays(now, 15).toISOString(),
      status: "rascunho",
      sentAt: null,
      decidedAt: null,
      nextAction: "Revisar escopo antes de enviar",
      notes: "",
      createdAt: at(1),
      updatedAt: at(1),
    });
  }

  // Leads ganhos → clientes → projetos → transações.
  const projectPlan: { stage: ProjectStage; delivered: boolean }[] = [
    { stage: "entrega", delivered: true },
    { stage: "entrega", delivered: true },
    { stage: "publicacao", delivered: false },
    { stage: "revisao", delivered: false },
    { stage: "desenvolvimento", delivered: false },
    { stage: "design", delivered: false },
    { stage: "briefing", delivered: false },
  ];
  const won = leads.filter((l) => l.stage === "ganho").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  won.forEach((lead, i) => {
    const proposal = proposals.find((p) => p.leadId === lead.id);
    const plan = projectPlan[i % projectPlan.length];
    const clientId = id("cli");
    const clientCreated = proposal?.decidedAt ?? lead.updatedAt;
    lead.clientId = clientId;
    if (proposal) proposal.clientId = clientId;
    clients.push({
      id: clientId,
      leadId: lead.id,
      name: lead.name,
      segment: lead.segment,
      city: lead.city,
      uf: lead.uf,
      contactName: PEOPLE[i % PEOPLE.length],
      phone: lead.phone,
      email: lead.email,
      status: plan.delivered ? "ativo" : i % 3 === 2 ? "aguardando_cliente" : "ativo",
      siteUrl: plan.delivered ? `https://www.${slug(lead.name)}.com.br` : "",
      notes: "",
      createdAt: clientCreated,
      updatedAt: clientCreated,
    });

    const start = new Date(clientCreated);
    const deadlineDays = proposal?.deadlineDays ?? 15;
    const due = addDays(start, deadlineDays + 5);
    const stageIdx = PROJECT_STAGES.indexOf(plan.stage);
    const tasks = DEFAULT_PROJECT_TASKS.map((t) => {
      const tIdx = PROJECT_STAGES.indexOf(t.stage);
      const done = plan.delivered || tIdx < stageIdx || (tIdx === stageIdx && r() > 0.5);
      const doneAt = done ? addDays(start, Math.min(deadlineDays, tIdx * 3 + between(0, 2))).toISOString() : null;
      return { id: id("task"), title: t.title, stage: t.stage, done, doneAt: doneAt && doneAt > now.toISOString() ? at(between(0, 3)) : doneAt };
    });
    const projectId = id("proj");
    const value = proposal ? proposal.items.reduce((s, it) => s + it.quantity * it.unitPrice, 0) - proposal.discount : lead.potentialValue;
    const deliveredAt = plan.delivered ? addDays(start, deadlineDays + between(-2, 3)).toISOString() : null;
    projects.push({
      id: projectId,
      clientId,
      proposalId: proposal?.id ?? null,
      title: `Site ${lead.name}`,
      siteType: proposal?.packageId === "essencial" ? "landing" : proposal?.packageId === "personalizado" ? "personalizado" : "institucional",
      stage: plan.stage,
      startDate: start.toISOString(),
      dueDate: (plan.delivered ? due : addDays(now, between(2, 18))).toISOString(),
      contractValue: value,
      tasks,
      previewUrl: stageIdx >= 3 ? `https://preview.sellora.local/${slug(lead.name)}` : "",
      publishedUrl: plan.delivered ? `https://www.${slug(lead.name)}.com.br` : "",
      publishedAt: deliveredAt,
      deliveredAt,
      notes: "",
      createdAt: start.toISOString(),
      updatedAt: start.toISOString(),
    });

    // Tarefas concluídas também alimentam o heatmap de produção.
    for (const t of tasks) {
      if (t.done && t.doneAt) {
        act({ leadId: null, clientId, projectId, type: "nota", description: `Tarefa concluída: ${t.title}`, dueAt: null, completedAt: t.doneAt, createdAt: t.doneAt });
      }
    }

    // Entrada 50% paga no início; saldo 50% na entrega.
    const half = Math.round(value / 2);
    transactions.push({
      id: id("tx"),
      kind: "receita",
      clientId,
      projectId,
      description: "Entrada 50% — criação do site",
      amount: half,
      dueDate: start.toISOString(),
      payments: [{ id: id("pay"), amount: half, date: addDays(start, between(0, 2)).toISOString(), note: "Pix" }],
      cancelled: false,
      createdAt: start.toISOString(),
      updatedAt: start.toISOString(),
    });
    const balanceDue = plan.delivered ? (deliveredAt as string) : stageIdx >= 4 ? addDays(now, -between(2, 6)).toISOString() : addDays(now, between(5, 20)).toISOString();
    const balancePaid = plan.delivered && i % 2 === 0;
    const partial = plan.delivered && i % 2 === 1;
    transactions.push({
      id: id("tx"),
      kind: "receita",
      clientId,
      projectId,
      description: "Saldo 50% — entrega do site",
      amount: value - half,
      dueDate: balanceDue,
      payments: balancePaid
        ? [{ id: id("pay"), amount: value - half, date: addDays(balanceDue, between(0, 3)).toISOString(), note: "Pix" }]
        : partial
          ? [{ id: id("pay"), amount: Math.round((value - half) / 2), date: addDays(balanceDue, 1).toISOString(), note: "Transferência" }]
          : [],
      cancelled: false,
      createdAt: start.toISOString(),
      updatedAt: start.toISOString(),
    });
    if (plan.delivered) {
      transactions.push({
        id: id("tx"),
        kind: "custo",
        clientId,
        projectId,
        description: "Registro de domínio (repasse ao cliente)",
        amount: 40,
        dueDate: deliveredAt as string,
        payments: [{ id: id("pay"), amount: 40, date: deliveredAt as string, note: "" }],
        cancelled: false,
        createdAt: deliveredAt as string,
        updatedAt: deliveredAt as string,
      });
    }
  });

  return {
    version: DB_VERSION,
    demo: true,
    seededAt: now.toISOString(),
    leads,
    activities,
    clients,
    projects,
    proposals,
    transactions,
    settings: structuredClone(defaultSettings),
  };
}

export function createEmptyDatabase(settings: Settings = defaultSettings, now: Date = new Date()): Database {
  return {
    version: DB_VERSION,
    demo: false,
    seededAt: now.toISOString(),
    leads: [],
    activities: [],
    clients: [],
    projects: [],
    proposals: [],
    transactions: [],
    settings: structuredClone(settings),
  };
}
