import { expect, it } from "vitest";
import { creationContrastIssues, creationSignature, generatedCreationSchema } from "./creation";
import { createLeadDemo, demoPreviewUrl, parseDemoDocument } from "./model";
import { demoCreativeIssues } from "./creative-review";
import { generatedFixture, demoLeadFixture } from "./generation-fixtures";

it("preserva a criação gerada no link público e exclui a mensagem e o prompt", () => {
  const demo = { ...createLeadDemo(demoLeadFixture), version: 5 as const, creation: generatedFixture, design: undefined };
  const url = demoPreviewUrl(demo, "http://localhost:3100");
  const doc = parseDemoDocument(new URL(url).hash);
  expect(doc?.creation).toEqual(generatedFixture);
  expect(JSON.stringify(doc)).not.toContain(demo.message);
  expect(doc?.version).toBe(5);
  expect(parseDemoDocument("#" + Buffer.from(JSON.stringify({ version: 5, business: demo.business })).toString("base64url"))).toBeNull();
});

it("rejeita HTML arbitrário, imagens externas, caminhos locais e cores injetadas", () => {
  for (const src of ["https://example.com/image.png", "file:///secret.png", "/api/demos/media/../secret"]) {
    expect(generatedCreationSchema.safeParse({ ...generatedFixture, image: { ...generatedFixture.image, src } }).success).toBe(false);
  }
  expect(generatedCreationSchema.safeParse({ ...generatedFixture, html: "<script>" }).success).toBe(false);
  expect(generatedCreationSchema.safeParse({ ...generatedFixture, paper: "red;background:url(x)" }).success).toBe(false);
});

it("detecta origem, copy e composição repetidas nas criações dinâmicas", () => {
  const first = { ...createLeadDemo(demoLeadFixture), version: 5 as const, creation: generatedFixture };
  const second = { ...first, id: "f672ed48-bbdb-48ea-8a8a-48b50c13c09d", business: { ...first.business, name: "Outro studio" } };
  expect(demoCreativeIssues(second, [first]).join(" ")).toMatch(/Imagem/);
  expect(demoCreativeIssues(second, [first]).join(" ")).toMatch(/Texto/);
});

it("mede contraste de texto e links antes de aceitar a criação", () => {
  expect(creationContrastIssues({ paper: "#ffffff", ink: "#111111", accent: "#333333" })).toEqual([]);
  expect(creationContrastIssues({ paper: "#ffffff", ink: "#eeeeee", accent: "#dddddd" })).not.toEqual([]);
});

it("não trata opções sem efeito na primeira dobra como uma nova composição", () => {
  const panorama = { ...generatedFixture, layout: "panorama" as const };
  expect(creationSignature({ ...panorama, photoSide: "left", sectionStyle: "stacked" })).toBe(creationSignature({ ...panorama, photoSide: "right", sectionStyle: "columns" }));
  expect(creationSignature({ ...generatedFixture, photoSide: "left" })).not.toBe(creationSignature({ ...generatedFixture, photoSide: "right" }));
});
