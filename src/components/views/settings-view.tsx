"use client";

import { Database as DbIcon, Download, Eraser, Mail, MapPin, MessageCircle, Camera, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { Field, TextInput } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/overlay";
import { IconTile, PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { LEAD_STAGES, leadStageMeta, packageOrder, tone } from "@/lib/constants";
import { exportDatabase, resetDemoData, startFromScratch, updateSettings } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { formatDate } from "@/lib/dates";
import { fieldErrors, packageSchema, profileSchema } from "@/lib/schemas";
import type { Database, Density, MotionPreference, PackageConfig } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

const SUPABASE_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const INTEGRATIONS = [
  { key: "maps", name: "Google Maps", icon: MapPin, purpose: "Pesquisa assistida de estabelecimentos", status: "Disponível futuramente" },
  { key: "instagram", name: "Instagram", icon: Camera, purpose: "Consulta de perfis comerciais públicos", status: "Disponível futuramente" },
  { key: "whatsapp", name: "WhatsApp", icon: MessageCircle, purpose: "Rascunhos de mensagem com envio aprovado por você", status: "Disponível futuramente" },
  { key: "email", name: "E-mail", icon: Mail, purpose: "Envio de propostas após aprovação humana", status: "Disponível futuramente" },
];

export function SettingsView() {
  const { db } = useStore();
  if (!db) return <PageSkeleton rows={[["col-span-12 lg:col-span-6 h-[320px]", "col-span-12 lg:col-span-6 h-[320px]"], ["col-span-12 h-[360px]"]]} />;
  // Remonta os formulários quando a base muda de origem (restaurar/limpar).
  return <SettingsPanel key={db.seededAt} db={db} />;
}

function readStorageKb() {
  try {
    return Math.round(((localStorage.getItem("sellora.db.v1")?.length ?? 0) * 2) / 1024);
  } catch {
    return null;
  }
}

function SettingsPanel({ db }: { db: Database }) {
  const { notify } = useToast();
  const [profile, setProfile] = useState(() => db.settings.profile);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [packages, setPackages] = useState(() =>
    packageOrder
      .map((id) => db.settings.packages.find((p) => p.id === id))
      .filter((p): p is PackageConfig => !!p)
      .map((p) => ({ ...p, price: String(p.price) })),
  );
  const [pkgErrors, setPkgErrors] = useState<Record<string, string>>({});
  const [commercial, setCommercial] = useState(() => ({
    validity: String(db.settings.defaultProposalValidityDays),
    followUp: String(db.settings.defaultFollowUpDays),
    target: String(db.settings.monthlyLeadTarget),
  }));
  const [confirm, setConfirm] = useState<"reset" | "scratch" | null>(null);
  const [storageKb] = useState(readStorageKb);

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const r = profileSchema.safeParse(profile);
    if (!r.success) return setProfileErrors(fieldErrors(r.error));
    setProfileErrors({});
    updateSettings({ profile: r.data });
    notify({ kind: "success", title: "Perfil salvo" });
  };

  const savePackages = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed: PackageConfig[] = [];
    const errs: Record<string, string> = {};
    packages.forEach((p, i) => {
      const r = packageSchema.safeParse({ ...p, price: p.price.replace(",", ".") });
      if (r.success) parsed.push(r.data);
      else Object.entries(fieldErrors(r.error)).forEach(([k, v]) => (errs[`${i}.${k}`] = v));
    });
    const validity = Number(commercial.validity);
    const followUp = Number(commercial.followUp);
    const target = Number(commercial.target);
    if (!Number.isInteger(validity) || validity < 1 || validity > 90) errs.validity = "Entre 1 e 90 dias.";
    if (!Number.isInteger(followUp) || followUp < 1 || followUp > 30) errs.followUp = "Entre 1 e 30 dias.";
    if (!Number.isInteger(target) || target < 1 || target > 1000) errs.target = "Entre 1 e 1000 leads.";
    setPkgErrors(errs);
    if (Object.keys(errs).length) return;
    updateSettings({ packages: parsed, defaultProposalValidityDays: validity, defaultFollowUpDays: followUp, monthlyLeadTarget: target });
    notify({ kind: "success", title: "Preferências comerciais salvas", description: "Novas propostas usarão esses valores." });
  };

  const download = () => {
    const blob = new Blob([exportDatabase()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellora-dados-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const counts = [
    ["Leads", db.leads.length],
    ["Clientes", db.clients.length],
    ["Projetos", db.projects.length],
    ["Propostas", db.proposals.length],
    ["Lançamentos", db.transactions.length],
    ["Atividades", db.activities.length],
  ] as const;

  return (
    <>
      <PageHeader title="Configurações" description="Perfil, aparência, preferências comerciais, integrações e dados do sistema." />
      <div className="grid grid-cols-12 gap-3.5">
        <DashboardCard index={0} className="col-span-12 lg:col-span-6" title="Perfil" description="Exibido no menu do usuário. Sem login neste modo.">
          <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={profile.name || "Sellora"} size={56} />
              <p className="text-[12.5px] text-ink-faint">Foto: monograma gerado pelo nome. Envio de foto ficará disponível com armazenamento em servidor.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome" error={profileErrors.name}>
                {(p) => <TextInput {...p} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} autoComplete="name" />}
              </Field>
              <Field label="Função" optional>
                {(p) => <TextInput {...p} value={profile.role} onChange={(e) => setProfile({ ...profile, role: e.target.value })} />}
              </Field>
              <Field label="E-mail" optional error={profileErrors.email} className="sm:col-span-2">
                {(p) => <TextInput {...p} type="email" spellCheck={false} autoComplete="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />}
              </Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary">
                Salvar perfil
              </Button>
            </div>
          </form>
        </DashboardCard>

        <DashboardCard index={1} className="col-span-12 lg:col-span-6" title="Aparência" description="Aplicado imediatamente neste navegador.">
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">Tema</p>
              <Segmented
                label="Tema"
                size="md"
                value="escuro"
                onChange={() => undefined}
                options={[
                  { value: "escuro", label: "Escuro" },
                  { value: "claro", label: "Claro (em breve)", disabled: true },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">Animações</p>
              <Segmented<MotionPreference>
                label="Intensidade de animações"
                size="md"
                value={db.settings.appearance.motion}
                onChange={(motion) => {
                  updateSettings({ appearance: { ...db.settings.appearance, motion } });
                  notify({ kind: "info", title: motion === "reduced" ? "Movimento reduzido ativado" : motion === "full" ? "Animações completas" : "Seguindo o sistema" });
                }}
                options={[
                  { value: "system", label: "Seguir sistema" },
                  { value: "full", label: "Completas" },
                  { value: "reduced", label: "Reduzidas" },
                ]}
              />
              <p className="mt-1.5 text-[12px] text-ink-faint">“Seguir sistema” respeita a preferência de movimento reduzido do dispositivo.</p>
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">Densidade</p>
              <Segmented<Density>
                label="Densidade da interface"
                size="md"
                value={db.settings.appearance.density}
                onChange={(density) => updateSettings({ appearance: { ...db.settings.appearance, density } })}
                options={[
                  { value: "confortavel", label: "Confortável" },
                  { value: "compacta", label: "Compacta" },
                ]}
              />
              <p className="mt-1.5 text-[12px] text-ink-faint">Compacta reduz o espaçamento das tabelas e entre cards.</p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard index={2} className="col-span-12" title="Preferências comerciais" description="Pacotes e padrões usados nas propostas. Valores são referências editáveis.">
          <form onSubmit={savePackages} noValidate className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              {packages.map((p, i) => (
                <fieldset key={p.id} className="rounded-2xl border border-seam p-4">
                  <legend className="px-1 text-[12.5px] font-semibold text-lilac">Pacote {i + 1}</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome" error={pkgErrors[`${i}.name`]}>
                      {(f) => <TextInput {...f} value={p.name} onChange={(e) => setPackages(packages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />}
                    </Field>
                    <Field label={p.id === "personalizado" ? "A partir de (R$)" : "Preço (R$)"} error={pkgErrors[`${i}.price`]}>
                      {(f) => <TextInput {...f} inputMode="decimal" value={p.price} onChange={(e) => setPackages(packages.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />}
                    </Field>
                    <Field label="Descrição" optional className="col-span-2">
                      {(f) => <TextInput {...f} value={p.description} onChange={(e) => setPackages(packages.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />}
                    </Field>
                  </div>
                  <p className="tnum mt-2 text-[12px] text-ink-faint">Atual: {formatBRL(Number(p.price.replace(",", ".")) || 0)}</p>
                </fieldset>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <Field label="Validade padrão da proposta (dias)" error={pkgErrors.validity}>
                {(f) => <TextInput {...f} inputMode="numeric" value={commercial.validity} onChange={(e) => setCommercial({ ...commercial, validity: e.target.value })} />}
              </Field>
              <Field label="Intervalo padrão de follow-up (dias)" error={pkgErrors.followUp}>
                {(f) => <TextInput {...f} inputMode="numeric" value={commercial.followUp} onChange={(e) => setCommercial({ ...commercial, followUp: e.target.value })} />}
              </Field>
              <Field label="Meta mensal de leads" error={pkgErrors.target} hint="Base do eixo Prospecção no radar.">
                {(f) => <TextInput {...f} inputMode="numeric" value={commercial.target} onChange={(e) => setCommercial({ ...commercial, target: e.target.value })} />}
              </Field>
              <Field label="Moeda">
                {(f) => <TextInput {...f} value="Real brasileiro (R$)" readOnly aria-readonly className="text-ink-soft" />}
              </Field>
            </div>
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-soft">Etapas comerciais</p>
              <ol className="flex flex-wrap gap-1.5">
                {LEAD_STAGES.map((s) => (
                  <li key={s} className="flex items-center gap-1.5 rounded-full border border-seam px-2.5 py-1 text-[12px] text-ink-soft">
                    <span className="size-1.5 rounded-full" style={{ background: tone[leadStageMeta[s].tone] }} aria-hidden />
                    {leadStageMeta[s].label}
                  </li>
                ))}
              </ol>
              <p className="mt-1.5 text-[12px] text-ink-faint">Etapas fixas nesta versão; personalização prevista para quando houver banco de dados.</p>
            </div>
            <div className="flex justify-end">
              <Button type="submit" variant="primary">
                Salvar preferências comerciais
              </Button>
            </div>
          </form>
        </DashboardCard>

        <DashboardCard index={3} className="col-span-12 lg:col-span-7" title="Integrações" description="Nenhuma integração está conectada. Nada é simulado.">
          <ul className="flex flex-col divide-y divide-[var(--seam)]">
            <li className="flex items-center gap-3 py-3 first:pt-0">
              <IconTile>
                <DbIcon aria-hidden />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">Supabase (banco e login)</span>
                <span className="block text-[12px] text-ink-faint">Persistência real, autenticação e RLS. Hoje os dados ficam só neste navegador.</span>
              </span>
              <StatusBadge size="sm" tone={SUPABASE_CONFIGURED ? "warn" : "ghost"} label={SUPABASE_CONFIGURED ? "Variáveis encontradas, não integrado" : "Não conectado"} />
            </li>
            {INTEGRATIONS.map((i) => (
              <li key={i.key} className="flex items-center gap-3 py-3 last:pb-0">
                <IconTile>
                  <i.icon aria-hidden />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">{i.name}</span>
                  <span className="block text-[12px] text-ink-faint">{i.purpose}</span>
                </span>
                <StatusBadge size="sm" tone="ghost" label={i.status} />
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-ink-faint">Envios externos, preços finais, contratos, cobranças e publicações sempre exigirão aprovação humana explícita.</p>
        </DashboardCard>

        <DashboardCard index={4} className="col-span-12 lg:col-span-5" title="Sistema" description="Informações da aplicação e dos dados locais.">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
            <div>
              <dt className="text-[11.5px] text-ink-faint">Versão</dt>
              <dd className="text-ink">Sellora 0.1.0</dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-ink-faint">Modo</dt>
              <dd className="mt-0.5">
                <DemoBadge demo={db.demo} />
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-ink-faint">Armazenamento</dt>
              <dd className="text-ink">localStorage {storageKb !== null ? `· ~${storageKb} KB` : "indisponível"}</dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-ink-faint">Base criada em</dt>
              <dd className="text-ink">{formatDate(db.seededAt)}</dd>
            </div>
          </dl>
          <ul className="mt-4 grid grid-cols-3 gap-2">
            {counts.map(([k, v]) => (
              <li key={k} className="rounded-xl border border-seam px-3 py-2">
                <span className="block text-[11.5px] text-ink-faint">{k}</span>
                <span className="tnum text-[15px] font-bold text-ink">{v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={download}>
              <Download aria-hidden /> Exportar dados (JSON)
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setConfirm("reset")}>
              <RotateCcw aria-hidden /> Restaurar demonstração
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirm("scratch")}>
              <Eraser aria-hidden /> Começar do zero
            </Button>
          </div>
          <p className="mt-3 text-[12px] text-ink-faint">Os dados não saem deste navegador. Limpar o navegador apaga tudo; exporte antes se precisar de cópia.</p>
        </DashboardCard>
      </div>

      <ConfirmDialog
        open={confirm === "reset"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Restaurar dados de demonstração?"
        description="Todos os registros deste navegador serão substituídos pelos dados fictícios iniciais. Configurações são mantidas. Não pode ser desfeito."
        confirmLabel="Restaurar demonstração"
        onConfirm={() => {
          resetDemoData();
          notify({ kind: "success", title: "Demonstração restaurada" });
        }}
      />
      <ConfirmDialog
        open={confirm === "scratch"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Apagar todos os registros?"
        description="Leads, clientes, projetos, propostas, lançamentos e atividades serão apagados deste navegador, inclusive os fictícios. Configurações são mantidas. Exporte antes se precisar de cópia. Não pode ser desfeito."
        confirmLabel="Apagar e começar do zero"
        onConfirm={() => {
          startFromScratch();
          notify({ kind: "success", title: "Base limpa", description: "Agora só ficam os dados que você cadastrar." });
        }}
      />
    </>
  );
}
