import type { LeadDemo, DemoBusiness } from "./model";
import { approvedConcepts, normalizeCreativeText } from "./concepts";
import { demoDesigns } from "./designs";
import { creationSignature } from "./creation";

const photoOrigins: Record<string, string> = {
  care: "2d1ec86ffbf4b62f27caee36934726cf335c8c8d315f4d9ee61dd576c04e4e48",
  dining: "dac872e888e5a2f684c2e28cae750ef1c5caa9686aca3b34ce4f506ab7d33645",
  salon: "c70765e166f7ad80570537c11db2f358493ef8664a6038d41d6ececaaa829269",
  store: "83f6bd855a7dc0772b57250839b00a5b10da2b6fac1c4c36d6794dec544cb4e2",
  workshop: "41982182cc4b62b70e48e44911cc4efac2fd6f55b952e5e0f42f1038eb77c014",
  workspace: "4a384717006039c624b899e24c426551eeb4a7a7cbc66c3a1c66f07fc0373bd5",
};

export function demoCreativeContent(demo: LeadDemo) {
  if (demo.version === 5 && demo.creation) {
    const c = demo.creation;
    return { photoOrigin: c.image.sourceHash, photo: c.image.src, texts: [c.headline, c.intro, c.cta, ...c.sections.flatMap((section) => [section.title, section.body])], message: demo.message };
  }
  // A v1 é tipográfica. Sua composição continua sujeita à comparação visual manual.
  if (demo.version === 1) return { photoOrigin: null, photo: null, texts: [], message: demo.message };
  if (demo.version === 4 && demo.conceptId) {
    const c = approvedConcepts[demo.conceptId];
    return { photoOrigin: c.media.sourceHash, photo: c.media.src, texts: [[...c.headline, c.emphasis].filter(Boolean).join(" "), ...c.intro, c.story.title.join(" ") + " " + c.story.emphasis, ...c.story.paragraphs, c.heroCta], message: demo.message };
  }
  const d = demoDesigns[demo.business.segment];
  return { photoOrigin: photoOrigins[d.photo], photo: `/demos/${d.photo}.jpg`, texts: [demo.version === 3 ? demo.design?.headline ?? d.headline : d.headline, d.description, d.storyTitle, d.story], message: demo.message };
}

/** Retira os campos variáveis antes de comparar o conteúdo criativo. */
export function withoutBusinessFields(text: string, business: DemoBusiness): string {
  let normalized = ` ${normalizeCreativeText(text)} `;
  const fields = [business.name, business.city, business.uf, business.phone].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const field of fields) {
    normalized = normalized.split(` ${normalizeCreativeText(field)} `).join(" ");
  }
  return normalized.trim().replace(/\s+/g, " ");
}

export function demoCreativeIssues(demo: LeadDemo, history: LeadDemo[]): string[] {
  const content = demoCreativeContent(demo);
  const texts = new Set(content.texts.map((text) => withoutBusinessFields(text, demo.business)).filter((text) => text.length >= 20));
  const message = withoutBusinessFields(demo.message, demo.business);
  const businessKey = (business: DemoBusiness) => normalizeCreativeText(`${business.name} ${business.city} ${business.uf}`);
  const issues: string[] = [];
  for (const previous of history) {
    if (previous.id === demo.id || businessKey(previous.business) === businessKey(demo.business)) continue;
    const other = demoCreativeContent(previous);
    if (demo.creation && previous.creation && demo.business.segment === previous.business.segment && creationSignature(demo.creation) === creationSignature(previous.creation)) issues.push(`Composição repetida em ${previous.business.name}.`);
    if (content.photoOrigin && content.photoOrigin === other.photoOrigin) issues.push(`Imagem criativa repetida em ${previous.business.name}.`);
    if (other.texts.some((text) => texts.has(withoutBusinessFields(text, previous.business)))) issues.push(`Texto da página repetido em ${previous.business.name}.`);
    if (message.length >= 20 && message === withoutBusinessFields(previous.message, previous.business)) issues.push(`Mensagem com o mesmo molde de ${previous.business.name}.`);
  }
  return [...new Set(issues)].slice(0, 3);
}
