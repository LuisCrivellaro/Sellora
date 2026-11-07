import { describe, expect, it } from "vitest";
import { createEmptyDatabase, createSeed } from "../data/seed";
import { addDays } from "../dates";
import type { Activity, Lead, Proposal } from "../types";
import { commercialSeries } from "./home";
import { homePeriodOverview } from "./home-overview";

const now = new Date("2026-11-07T12:00:00");
const at = (days: number) => addDays(now, days).toISOString();
const template = createSeed(now);
const lead = (id: string, patch: Partial<Lead> = {}): Lead => ({ ...template.leads[0], id, stage: "novo", createdAt: at(-2), updatedAt: at(0), lastContactAt: null, ...patch });
const activity = (id: string, patch: Partial<Activity> = {}): Activity => ({ id, leadId: "one", clientId: null, projectId: null, type: "whatsapp", description: "Contato comercial", dueAt: null, completedAt: at(-1), createdAt: at(-1), ...patch });
const proposal = (id: string, patch: Partial<Proposal> = {}): Proposal => ({ ...template.proposals[0], id, leadId: "one", status: "enviada", sentAt: at(-1), decidedAt: null, ...patch });

describe("visão geral da Home", () => {
  it("usa as mesmas séries comerciais e compara janelas contíguas equivalentes", () => {
    const db = createEmptyDatabase();
    db.leads = [lead("one"), lead("previous", { createdAt: at(-10) })];
    db.activities = [activity("current"), activity("previous", { completedAt: at(-10) })];
    db.proposals = [proposal("current")];
    const data = homePeriodOverview(db, "7d", now);
    expect(data.series).toEqual(commercialSeries(db, "7d", now));
    expect(data.metrics.leads).toEqual({ value: 1, previous: 1, change: 0 });
    expect(data.metrics.contacts).toEqual({ value: 1, previous: 1, change: 0 });
    expect(data.metrics.proposals).toEqual({ value: 1, previous: 0, change: null });
    expect(data.start - data.previousStart).toBe(data.end - data.start);
    expect(data.sources.reduce((sum, source) => sum + source.count, 0)).toBe(1);
  });

  it("não inventa crescimento quando a base anterior é zero", () => {
    const db = createEmptyDatabase();
    db.leads = [lead("one")];
    expect(homePeriodOverview(db, "30d", now).metrics.leads.change).toBeNull();
  });

  it("conta cada lead ganho uma vez e prefere a data do histórico à aprovação", () => {
    const db = createEmptyDatabase();
    db.leads = [lead("one", { stage: "ganho" }), lead("undated", { stage: "ganho" }), lead("open")];
    db.activities = [activity("win", { type: "etapa", description: "Etapa: Negociação → Ganho", completedAt: at(-1) })];
    db.proposals = [proposal("first", { status: "aprovada", decidedAt: at(-50) }), proposal("second", { status: "aprovada", decidedAt: at(-2) }), proposal("open-approved", { leadId: "open", status: "aprovada", decidedAt: at(-1) })];
    const data = homePeriodOverview(db, "7d", now);
    expect(data.metrics.sales.value).toBe(1);
    expect(data.undatedWon).toBe(1);
    expect(data.conversion).toBeCloseTo(200 / 3);
  });

  it("usa a aprovação registrada quando não há histórico de ganho e evita duplicidade", () => {
    const db = createEmptyDatabase();
    db.leads = [lead("one", { stage: "ganho" })];
    db.proposals = [proposal("first", { status: "aprovada", decidedAt: at(-2) }), proposal("second", { status: "aprovada", decidedAt: at(-1) })];
    expect(homePeriodOverview(db, "7d", now).metrics.sales.value).toBe(1);
    db.proposals[0].decidedAt = at(-50);
    expect(homePeriodOverview(db, "7d", now).metrics.sales.value).toBe(0);
  });

  it("ordena atividades por estabelecimento e não considera uma nota como contato", () => {
    const db = createEmptyDatabase();
    db.leads = [lead("one", { createdAt: at(-20) }), lead("new", { createdAt: at(0) }), lead("old", { createdAt: at(-50) })];
    db.activities = [activity("contact", { completedAt: at(-3) }), activity("note", { type: "nota", completedAt: at(-1), description: "Revisar briefing" }), activity("old", { leadId: "old", completedAt: at(-40), createdAt: at(-40) })];
    const rows = homePeriodOverview(db, "7d", now).recent;
    expect(rows.map((row) => row.lead.id)).toEqual(["new", "one"]);
    expect(rows[1].lastContactAt).toBe(at(-3));
    expect(rows[1].activity).toContain("Revisar briefing");
  });

  it("mantém estados vazios e ignora eventos sem data válida ou futuros", () => {
    const empty = homePeriodOverview(createEmptyDatabase(), "90d", now);
    expect(Object.values(empty.metrics).every((metric) => metric.value === 0 && metric.change === null)).toBe(true);
    expect(empty.conversion).toBeNull();
    expect(empty.recent).toEqual([]);
    const db = createEmptyDatabase();
    db.leads = [lead("future", { createdAt: at(1) }), lead("invalid", { createdAt: "invalid" })];
    expect(homePeriodOverview(db, "1a", now).metrics.leads.value).toBe(0);
    expect(homePeriodOverview(db, "1a", now).recent).toEqual([]);
  });
});
