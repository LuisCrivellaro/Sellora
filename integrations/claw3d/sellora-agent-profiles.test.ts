import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const profilesModule = require("./sellora-agent-profiles.cjs");
const core = require("./sellora-gateway-core.cjs");

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultsDir = path.join(here, "agent-profiles");
/** Nomes internos dos serviços (bridge) e nomes de exibição padrão do escritório (IDENTITY.md). */
const AGENTS = { "gerador-de-demos": "Gerador de Demos", prospeccao: "Prospecção", "coolify-deploy": "Coolify Deploy Agent" } as const;
const DISPLAY = { "gerador-de-demos": "Website Designer", prospeccao: "Lead Generation Specialist", "coolify-deploy": "Deployment Manager" } as const;
type Frame = { ok: boolean; payload?: Record<string, unknown>; error?: { code: string; message: string } };

const temps: string[] = [];
const tempDir = () => { const dir = mkdtempSync(path.join(os.tmpdir(), "sellora-profiles-")); temps.push(dir); return dir; };
afterEach(() => { for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true }); });
const store = (overridesDir: string | null = tempDir()) => profilesModule.createProfileStore({
  defaultsDir, overridesDir, agentName: (id: string) => (AGENTS as Record<string, string>)[id] ?? null,
});

describe("perfis versionados dos agentes", () => {
  it("cada agente tem as sete abas, com nome e emoji esperados e USER.md compartilhado", () => {
    const profiles = store(null);
    const emoji = { "gerador-de-demos": "🎨", prospeccao: "🎯", "coolify-deploy": "🚀" };
    for (const [id, name] of Object.entries(DISPLAY)) {
      for (const file of profilesModule.FILE_NAMES) {
        const read = profiles.get(id, file);
        expect(read.missing, `${id}/${file}`).toBe(false);
        expect(read.content.trim().length, `${id}/${file}`).toBeGreaterThan(80);
      }
      expect(profilesModule.identityField(profiles.get(id, "IDENTITY.md").content, "name")).toBe(name);
      expect(profiles.nameOf(id)).toBe(name);
      expect(profiles.emojiOf(id)).toBe(emoji[id as keyof typeof emoji]);
      expect(profiles.get(id, "USER.md").content).toBe(profiles.get("gerador-de-demos", "USER.md").content);
    }
  });

  it("nenhum perfil parece conter segredo e o heartbeat está desativado", () => {
    const profiles = store(null);
    for (const id of Object.keys(AGENTS)) {
      for (const file of profilesModule.FILE_NAMES) expect(profilesModule.looksSecret(profiles.get(id, file).content), `${id}/${file}`).toBe(false);
      expect(profiles.get(id, "HEARTBEAT.md").content).toMatch(/Estado: desativado/);
    }
  });

  it("as regras compartilhadas são idênticas nos três AGENTS.md", () => {
    const profiles = store(null);
    const section = (id: string) => profiles.get(id, "AGENTS.md").content.split("## Regras compartilhadas")[1];
    expect(section("gerador-de-demos")).toBeTruthy();
    expect(section("prospeccao")).toBe(section("gerador-de-demos"));
    expect(section("coolify-deploy")).toBe(section("gerador-de-demos"));
  });

  it("IDENTITY.md no formato do Claw3D volta igual depois de salvo pelo editor (sem criar edição local)", () => {
    const overrides = tempDir();
    const profiles = store(overrides);
    // Mesmo texto que o serializador do Claw3D produz: "- Avatar: " com espaço no fim e CRLF possíveis.
    const fromEditor = profiles.get("prospeccao", "IDENTITY.md").content.replace("- Avatar:", "- Avatar: ").replace(/\n/g, "\r\n");
    expect(profiles.set("prospeccao", "IDENTITY.md", fromEditor).changed).toBe(false);
    expect(readdirSync(overrides)).toEqual([]);
  });
});

describe("gravação pelo Agent Editor", () => {
  it("salvar, reabrir e voltar ao padrão, com cópia de segurança antes de cada gravação", () => {
    const overrides = tempDir();
    const profiles = store(overrides);
    const original = profiles.get("coolify-deploy", "MEMORY.md").content;
    expect(profiles.set("coolify-deploy", "MEMORY.md", `${original}\n- Nota local.\n`).changed).toBe(true);
    const reopened = store(overrides).get("coolify-deploy", "MEMORY.md");
    expect(reopened).toMatchObject({ missing: false, source: "local" });
    expect(reopened.content).toContain("- Nota local.");
    // Voltar ao texto versionado apaga a edição local, mas guarda a anterior.
    expect(profiles.set("coolify-deploy", "MEMORY.md", original).changed).toBe(true);
    expect(profiles.get("coolify-deploy", "MEMORY.md")).toMatchObject({ source: "sellora", content: original });
    const dir = path.join(overrides, "coolify-deploy");
    expect(existsSync(path.join(dir, "MEMORY.md"))).toBe(false);
    const backups = readdirSync(dir).filter((file) => file.endsWith(".bak"));
    expect(backups).toHaveLength(1);
    expect(readFileSync(path.join(dir, backups[0]), "utf8")).toContain("- Nota local.");
  });

  it("USER.md editado em um agente vale para os três (contexto único)", () => {
    const profiles = store();
    const base = profiles.get("prospeccao", "USER.md").content;
    profiles.set("prospeccao", "USER.md", `${base}- Preferência nova.\n`);
    for (const id of Object.keys(AGENTS)) expect(profiles.get(id, "USER.md").content).toContain("Preferência nova.");
  });

  it("recusa segredo, nome trocado, agente desconhecido, arquivo fora da lista e conteúdo grande", () => {
    const profiles = store();
    const tools = profiles.get("coolify-deploy", "TOOLS.md").content;
    const identity = profiles.get("gerador-de-demos", "IDENTITY.md").content;
    const code = (fn: () => unknown) => { try { fn(); return "ok"; } catch (error) { return (error as { code: string }).code; } };
    expect(code(() => profiles.set("coolify-deploy", "TOOLS.md", `${tools}\nCOOLIFY_API_TOKEN=12|abcdefghijklmnopqrstuvwxyz0123456789ABCD`))).toBe("secret_detected");
    expect(code(() => profiles.set("coolify-deploy", "TOOLS.md", `${tools}\n${"ghp_"}${"a".repeat(36)}`))).toBe("secret_detected");
    expect(code(() => profiles.set("gerador-de-demos", "IDENTITY.md", identity.replace("Name: Website Designer", "Name:")))).toBe("invalid_name");
    expect(code(() => profiles.rename("gerador-de-demos", "   "))).toBe("invalid_name");
    expect(code(() => profiles.rename("gerador-de-demos", "x".repeat(profilesModule.MAX_NAME + 1)))).toBe("invalid_name");
    expect(code(() => profiles.set("inventado", "SOUL.md", "x"))).toBe("unknown_agent");
    expect(code(() => profiles.set("prospeccao", "../../CLAUDE.md", "x"))).toBe("invalid_file");
    expect(code(() => profiles.set("../prospeccao", "SOUL.md", "x"))).toBe("invalid_agent");
    expect(code(() => profiles.set("prospeccao", "SOUL.md", "a".repeat(profilesModule.MAX_BYTES + 1)))).toBe("too_large");
    expect(code(() => store(null).set("prospeccao", "SOUL.md", "x"))).toBe("read_only");
  });

  it("mantém só as últimas cinco cópias de segurança", () => {
    const overrides = tempDir();
    const profiles = store(overrides);
    for (let index = 0; index < 8; index++) profiles.set("prospeccao", "SOUL.md", `# SOUL.md\n\nversão ${index}\n`);
    expect(readdirSync(path.join(overrides, "prospeccao")).filter((file) => file.endsWith(".bak")).length).toBeLessThanOrEqual(5);
  });
});

describe("gateway: abas do Agent Editor", () => {
  const presence = { agents: Object.entries(AGENTS).map(([id, name]) => ({ id, name, role: "", type: "worker", runtime: "x", status: "idle", recent: [] })) };

  it("agents.files.get devolve o perfil e agents.files.set grava sem gerar frames nem tocar execuções", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    const profiles = store();
    const seqBefore = state.seq;
    const read = core.handleMethod(state, "agents.files.get", { agentId: "prospeccao", name: "SOUL.md" }, "1", { profiles }) as Frame;
    expect(read.ok).toBe(true);
    const file = (read.payload as { file: { missing: boolean; content: string } }).file;
    expect(file.missing).toBe(false);
    const saved = core.handleMethod(state, "agents.files.set", { agentId: "prospeccao", name: "SOUL.md", content: `${file.content}\nExtra.\n` }, "2", { profiles }) as Frame;
    expect(saved.ok).toBe(true);
    const again = core.handleMethod(state, "agents.files.get", { agentId: "prospeccao", name: "SOUL.md" }, "3", { profiles }) as Frame;
    expect((again.payload as { file: { content: string } }).file.content).toContain("Extra.");
    expect(state.seq).toBe(seqBefore);
    expect(state.active.size).toBe(0);
  });

  it("sem store, mantém o comportamento anterior (arquivos ausentes, gravação recusada)", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    expect((core.handleMethod(state, "agents.files.get", { agentId: "prospeccao", name: "SOUL.md" }, "1") as Frame).payload).toEqual({ file: { missing: true } });
    expect((core.handleMethod(state, "agents.files.set", { agentId: "prospeccao", name: "SOUL.md", content: "x" }, "2") as Frame).error?.code).toBe("read_only");
  });

  it("agente que o bridge não declarou não tem perfil, e erros do store viram resposta de erro", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    const profiles = store();
    expect((core.handleMethod(state, "agents.files.get", { agentId: "inventado", name: "SOUL.md" }, "1", { profiles }) as Frame).payload).toEqual({ file: { missing: true } });
    const refused = core.handleMethod(state, "agents.files.set", { agentId: "inventado", name: "SOUL.md", content: "x" }, "2", { profiles }) as Frame;
    expect(refused).toMatchObject({ ok: false, error: { code: "unknown_agent" } });
  });

  it("agents.list leva o emoji do IDENTITY.md e o nome do bridge", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    const list = core.handleMethod(state, "agents.list", {}, "1", { profiles: store(null) }) as Frame;
    const agents = (list.payload as { agents: { id: string; name: string; identity: { emoji: string } }[] }).agents;
    expect(agents.map((agent) => [agent.id, agent.name, agent.identity.emoji])).toEqual([
      ["gerador-de-demos", "Website Designer", "🎨"], ["prospeccao", "Lead Generation Specialist", "🎯"], ["coolify-deploy", "Deployment Manager", "🚀"],
    ]);
  });

  it("os métodos de escrita que mudariam agentes ou execuções continuam recusados com store", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    for (const method of ["agents.create", "agents.delete", "config.set", "cron.add", "chat.send"]) {
      expect((core.handleMethod(state, method, { agentId: "prospeccao", name: "Outro" }, "x", { profiles: store() }) as Frame).error?.code).toBe("read_only");
    }
  });
});

it("arquivo de perfil temporário não sobra no diretório (gravação atômica)", () => {
  const overrides = tempDir();
  const profiles = store(overrides);
  profiles.set("gerador-de-demos", "TOOLS.md", "# TOOLS.md\n\nTeste.\n");
  expect(readdirSync(path.join(overrides, "gerador-de-demos")).some((file) => file.endsWith(".tmp"))).toBe(false);
  writeFileSync(path.join(overrides, "gerador-de-demos", "TOOLS.md"), "# TOOLS.md\r\n\r\nEditado fora.\r\n");
  expect(profiles.get("gerador-de-demos", "TOOLS.md").content).toBe("# TOOLS.md\n\nEditado fora.\n");
});

describe("renomear pelo Agent Editor (nome de exibição)", () => {
  const presence = { agents: Object.entries(AGENTS).map(([id, name]) => ({ id, name, role: "", type: "worker", runtime: "x", status: "idle", recent: [] })) };
  const names = (state: unknown, profiles: unknown) => ((core.handleMethod(state, "agents.list", {}, "l", { profiles }) as Frame).payload as { agents: { id: string; name: string }[] }).agents.map((a) => [a.id, a.name]);

  it("salvar Identity + agents.update troca o nome, preserva id e demais campos e persiste em outro processo", () => {
    const overrides = tempDir();
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    const profiles = store(overrides);
    const before = profiles.get("prospeccao", "IDENTITY.md").content;
    // Mesmo fluxo do Claw3D: grava o IDENTITY.md serializado pelo editor e depois chama agents.update.
    const edited = before.replace("- Name: Lead Generation Specialist", "- Name: Caçador de Leads").replace("- Avatar:", "- Avatar: ");
    expect((core.handleMethod(state, "agents.files.set", { agentId: "prospeccao", name: "IDENTITY.md", content: edited }, "1", { profiles }) as Frame).ok).toBe(true);
    const renamed = core.handleMethod(state, "agents.update", { agentId: "prospeccao", name: "  Caçador de Leads " }, "2", { profiles }) as Frame;
    expect(renamed).toMatchObject({ ok: true, payload: { agentId: "prospeccao", name: "Caçador de Leads" } });
    // Novo processo (reinício do app): o nome salvo vence o padrão versionado; ids e ordem iguais, sem duplicar.
    const restarted = core.createState();
    core.applyBridgeEvent(restarted, "presence", presence);
    expect(names(restarted, store(overrides))).toEqual([["gerador-de-demos", "Website Designer"], ["prospeccao", "Caçador de Leads"], ["coolify-deploy", "Deployment Manager"]]);
    const after = store(overrides).get("prospeccao", "IDENTITY.md").content;
    for (const field of ["creature", "vibe", "emoji"]) expect(profilesModule.identityField(after, field)).toBe(profilesModule.identityField(before, field));
    // O bridge (serviço) continua com o nome interno; nada de execução foi criado.
    expect(state.agents.get("prospeccao").name).toBe("Prospecção");
    expect(state.active.size).toBe(0);
  });

  it("agents.update só com o nome (sem perfil não troca), e recusa outros campos e agentes desconhecidos", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    const profiles = store();
    expect((core.handleMethod(state, "agents.update", { agentId: "prospeccao", name: "X" }, "1") as Frame).error?.code).toBe("read_only");
    expect((core.handleMethod(state, "agents.update", { agentId: "prospeccao", name: "X", model: "outro" }, "2", { profiles }) as Frame).error?.code).toBe("read_only");
    expect((core.handleMethod(state, "agents.update", { agentId: "prospeccao", workspace: "/tmp" }, "3", { profiles }) as Frame).error?.code).toBe("read_only");
    expect((core.handleMethod(state, "agents.update", { agentId: "inventado", name: "X" }, "4", { profiles }) as Frame).error?.code).toBe("unknown_agent");
    expect((core.handleMethod(state, "agents.update", { agentId: "prospeccao", name: "" }, "5", { profiles }) as Frame).error?.code).toBe("invalid_name");
    expect(names(state, profiles).map(([, name]) => name)).toEqual(["Website Designer", "Lead Generation Specialist", "Deployment Manager"]);
  });

  it("voltar ao nome padrão remove a edição local; sem perfil o nome do bridge é o fallback", () => {
    const overrides = tempDir();
    const profiles = store(overrides);
    profiles.rename("coolify-deploy", "Deploy Bot");
    expect(profiles.nameOf("coolify-deploy")).toBe("Deploy Bot");
    profiles.rename("coolify-deploy", "Deployment Manager");
    expect(profiles.get("coolify-deploy", "IDENTITY.md").source).toBe("sellora");
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", presence);
    const empty = profilesModule.createProfileStore({ defaultsDir: tempDir(), overridesDir: null, agentName: () => null });
    expect(names(state, empty).map(([, name]) => name)).toEqual(["Gerador de Demos", "Prospecção", "Coolify Deploy Agent"]);
    const hello = core.helloPayload(state, { profiles });
    expect(hello.snapshot.health.agents.map((a: { name: string }) => a.name)).toEqual(["Website Designer", "Lead Generation Specialist", "Deployment Manager"]);
  });
});
