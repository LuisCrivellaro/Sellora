import { beforeEach, expect, it, vi } from "vitest";
import { createEmptyDatabase } from "./seed";
import { getDb, replaceDatabase } from "./store";
import { applyGeneratedLeadDemo, approveLeadDemoAutomatically, createLead, saveDemoMessage } from "./repository";
import { demoRevision } from "../demos/model";
import { AUTOMATIC_DEMO_REVIEWER } from "../demos/send-preparation";
import { preparationLeadInput, preparationResult } from "../demos/send-preparation-fixtures";

beforeEach(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) } });
  replaceDatabase(createEmptyDatabase());
});

it("atribui a revisão à automação, preserva o contato e é idempotente", () => {
  const lead = createLead(preparationLeadInput);
  const demo = applyGeneratedLeadDemo(lead.id, preparationResult(), null);
  approveLeadDemoAutomatically(lead.id, demoRevision(demo)!);
  const saved = getDb().leads[0];
  expect(saved.demo?.approvedBy).toBe(AUTOMATIC_DEMO_REVIEWER);
  expect(saved.lastContactAt).toBeNull();
  expect(saved.stage).toBe("novo");
  expect(getDb().activities.map((a) => a.type)).toEqual(["nota"]);
  approveLeadDemoAutomatically(lead.id, demoRevision(saved.demo)!);
  expect(getDb().activities).toHaveLength(1);
});

it("não aprova sobre edição concorrente nem sobre QA incompleto", () => {
  const lead = createLead(preparationLeadInput);
  const result = preparationResult();
  result.site!.qa.browser = "unavailable";
  const demo = applyGeneratedLeadDemo(lead.id, result, null);
  expect(() => approveLeadDemoAutomatically(lead.id, demoRevision(demo)!)).toThrow(/verificação/);
  saveDemoMessage(lead.id, "Esta é a minha abordagem manual e deve ser preservada.");
  expect(() => approveLeadDemoAutomatically(lead.id, demoRevision(demo)!)).toThrow(/alterada/);
  expect(getDb().leads[0].demo?.status).toBe("pending");
  expect(getDb().activities).toHaveLength(0);
});
