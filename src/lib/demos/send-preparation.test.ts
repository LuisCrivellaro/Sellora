import { expect, it } from "vitest";
import { automaticReviewIssues } from "./send-preparation";
import { preparationResult, preparationLeadInput } from "./send-preparation-fixtures";
import { leadDemoSchema } from "./model";

it("não libera automaticamente uma demo antiga nem relatório ausente", () => {
  expect(automaticReviewIssues({ status: "pending", version: 1 } as never)).toHaveLength(1);
  expect(automaticReviewIssues({ status: "rejected", version: 6 } as never)[0]).toContain("recusada");
});

it("libera só QA completo e interrompe para imagens substitutas, página ausente e mensagem editada", () => {
  const result = preparationResult();
  const at = new Date().toISOString();
  const demo = leadDemoSchema.parse({ id: crypto.randomUUID(), createdAt: at, updatedAt: at, approvedAt: null, approvedBy: null, version: 6, site: result.site, message: result.message, generatedMessage: result.message, status: "pending", business: preparationLeadInput });
  expect(automaticReviewIssues(demo)).toEqual([]);
  demo.site!.qa.status = "warnings";
  demo.site!.qa.issues = ["Cadastro sem categoria: o tipo do negócio foi inferido do nome e do segmento."];
  expect(automaticReviewIssues(demo)).toEqual([]);
  demo.site!.qa.pages = [];
  demo.site!.qa.imageFallback = true;
  demo.message = "Uma mensagem editada manualmente";
  expect(automaticReviewIssues(demo)).toEqual(expect.arrayContaining([expect.stringContaining("páginas"), expect.stringContaining("substitutas"), expect.stringContaining("editada")]));
});
