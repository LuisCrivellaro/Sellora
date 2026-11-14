"use strict";

/**
 * Perfis dos agentes da Sellora no Agent Editor do Claw3D (abas Identity, Soul, Agents, User, Tools, Memory, Heartbeat).
 *
 * O Claw3D lê e grava esses arquivos pelo gateway (`agents.files.get` / `agents.files.set`). Na Sellora o gateway é o
 * adaptador: não existe runtime OpenClaw por trás, e nenhum serviço da Sellora (gerador, prospecção, publicação) lê
 * estes arquivos. Eles são documentação do agente exibida no escritório, nunca instruções executadas.
 *
 * - Padrão versionado: `integrations/claw3d/agent-profiles/<agentId>/<ARQUIVO>.md` (copiado para o checkout do Claw3D).
 *   `USER.md` é um só para todos (`_shared/USER.md`): um contexto do administrador, sem perfis concorrentes.
 * - Edições feitas no Claw3D vão para o estado privado do Claw3D (`<estado>/claw3d/agent-profiles/`), fora do
 *   repositório, com cópia de segurança do conteúdo anterior antes de cada gravação.
 * - Nome de exibição: o `Name` do IDENTITY.md efetivo é a única fonte do nome mostrado no escritório. O Agent Editor
 *   o altera gravando o IDENTITY.md e chamando `agents.update` (ver `rename`). O id do agente nunca muda, e o nome do
 *   bridge só é usado se o perfil não existir. Um padrão versionado nunca sobrescreve uma edição local.
 * - Gravação recusada quando: agente desconhecido pelo bridge, arquivo fora da lista, conteúdo grande demais, conteúdo
 *   parecido com segredo (token, chave, senha) ou IDENTITY.md sem nome válido.
 */

const fs = require("node:fs");
const path = require("node:path");

const FILE_NAMES = ["IDENTITY.md", "SOUL.md", "AGENTS.md", "USER.md", "TOOLS.md", "MEMORY.md", "HEARTBEAT.md"];
const SHARED_FILES = new Set(["USER.md"]);
const SHARED_DIR = "_shared";
const MAX_BYTES = 64 * 1024;
const MAX_BACKUPS = 5;
const AGENT_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const MAX_NAME = 60;

/** Padrões de credenciais conhecidos. Perfis descrevem integrações; nunca carregam o valor de um segredo. */
const SECRET_PATTERNS = [
  /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bgithub_pat_[A-Za-z0-9_]{30,}/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\b\d+\|[A-Za-z0-9]{30,}\b/, // token de API do Coolify (Laravel Sanctum)
  /\b(?:api[_-]?key|token|secret|password|senha)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{16,}/i,
];

const profileError = (code, message) => Object.assign(new Error(message), { code });
// Quebras de linha LF e sem espaço no fim da linha (o Claw3D grava "- Avatar: " com espaço quando o campo está vazio).
const normalize = (content) => String(content).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
const virtualPath = (agentId, name) => `sellora://agents/${agentId}/${name}`;

/** Lê `- Campo: valor` antes da primeira seção (mesmo formato que o Claw3D grava no IDENTITY.md). */
function identityField(content, field) {
  for (const raw of normalize(content).split("\n")) {
    const line = raw.trim();
    if (/^##\s+/.test(line)) break;
    const match = /^[-*]\s*\**([^:*]+?)\**\s*:\s*(.*)$/.exec(line);
    if (match && match[1].trim().toLowerCase() === field) return match[2].replace(/^[*_]+|[*_]+$/g, "").trim();
  }
  return "";
}

/** Nome de exibição válido: 1 a 60 caracteres, uma linha, sem caracteres de controle. */
function validDisplayName(value) {
  const name = String(value ?? "").trim();
  return name.length > 0 && name.length <= MAX_NAME && !/[\u0000-\u001f\u007f]/.test(name) ? name : null;
}

function looksSecret(content) {
  return SECRET_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * @param {{ defaultsDir: string, overridesDir?: string | null, agentName?: (agentId: string) => string | null }} options
 * `agentName` devolve o nome registrado no bridge (ou null para agente desconhecido). Sem `overridesDir`, só leitura.
 */
function createProfileStore({ defaultsDir, overridesDir = null, agentName = () => null }) {
  const dirFor = (base, agentId, name) => path.join(base, SHARED_FILES.has(name) ? SHARED_DIR : agentId);
  const read = (file) => { try { return normalize(fs.readFileSync(file, "utf8")); } catch { return null; } };

  function check(agentId, name) {
    if (typeof agentId !== "string" || !AGENT_ID.test(agentId)) throw profileError("invalid_agent", "Agente inválido.");
    if (!FILE_NAMES.includes(name)) throw profileError("invalid_file", `Arquivo não editável: ${String(name)}.`);
  }

  function defaultContent(agentId, name) {
    return read(path.join(dirFor(defaultsDir, agentId, name), name));
  }

  function overrideFile(agentId, name) {
    return overridesDir ? path.join(dirFor(overridesDir, agentId, name), name) : null;
  }

  /** Conteúdo efetivo: edição local (se houver) ou o padrão versionado. */
  function get(agentId, name) {
    check(agentId, name);
    const file = overrideFile(agentId, name);
    const edited = file ? read(file) : null;
    const content = edited ?? defaultContent(agentId, name);
    if (content === null) return { missing: true, path: virtualPath(agentId, name) };
    return { missing: false, content, path: virtualPath(agentId, name), source: edited !== null ? "local" : "sellora" };
  }

  function backup(file) {
    if (!fs.existsSync(file)) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(file, `${file}.${stamp}.bak`);
    const prefix = `${path.basename(file)}.`;
    const old = fs.readdirSync(path.dirname(file)).filter((entry) => entry.startsWith(prefix) && entry.endsWith(".bak")).sort();
    for (const entry of old.slice(0, Math.max(0, old.length - MAX_BACKUPS))) fs.rmSync(path.join(path.dirname(file), entry), { force: true });
  }

  /** Grava uma edição feita no Claw3D. Retorna `{ changed, path }`; lança erro com `code` quando recusa. */
  function set(agentId, name, content) {
    check(agentId, name);
    const registered = agentName(agentId);
    if (!registered) throw profileError("unknown_agent", "Agente não registrado no Sellora Agent Bridge.");
    if (!overridesDir) throw profileError("read_only", "Perfis em modo somente leitura: estado do Claw3D indisponível.");
    if (typeof content !== "string") throw profileError("invalid_content", "Conteúdo inválido.");
    const next = normalize(content);
    if (Buffer.byteLength(next, "utf8") > MAX_BYTES) throw profileError("too_large", `${name} passa de ${MAX_BYTES / 1024} KB.`);
    if (looksSecret(next)) {
      throw profileError("secret_detected", `${name} parece conter uma credencial. Perfis não guardam tokens, chaves ou senhas; elas ficam só nas variáveis do servidor da Sellora.`);
    }
    if (name === "IDENTITY.md" && !validDisplayName(identityField(next, "name"))) {
      throw profileError("invalid_name", `O nome do agente é obrigatório (até ${MAX_NAME} caracteres, uma linha).`);
    }
    const current = get(agentId, name);
    if (!current.missing && current.content === next) return { changed: false, path: current.path };
    const file = overrideFile(agentId, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    backup(file);
    if (next === defaultContent(agentId, name)) {
      // Voltou ao padrão versionado: a edição local deixa de existir (a cópia de segurança fica).
      fs.rmSync(file, { force: true });
    } else {
      const temp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(temp, next, { encoding: "utf8", mode: 0o600 });
      fs.renameSync(temp, file);
    }
    return { changed: true, path: virtualPath(agentId, name) };
  }

  /**
   * Renomeia (só o nome de exibição): troca a linha `- Name:` do IDENTITY.md efetivo, preservando os demais campos.
   * Usado pelo `agents.update` que o Claw3D envia depois de salvar o Identity.
   */
  function rename(agentId, value) {
    check(agentId, "IDENTITY.md");
    const next = validDisplayName(value);
    if (!next) throw profileError("invalid_name", `O nome do agente é obrigatório (até ${MAX_NAME} caracteres, uma linha).`);
    const current = get(agentId, "IDENTITY.md");
    const content = current.missing ? "# IDENTITY.md - Who Am I?\n\n- Name:\n" : current.content;
    const lines = content.split("\n");
    const index = lines.findIndex((line) => /^[-*]\s*\**name\**\s*:/i.test(line.trim()));
    if (index >= 0) lines[index] = `- Name: ${next}`;
    else lines.splice(Math.min(2, lines.length), 0, `- Name: ${next}`);
    return { ...set(agentId, "IDENTITY.md", lines.join("\n")), name: next };
  }

  /** Nome de exibição do IDENTITY.md efetivo ("" sem perfil válido). */
  function nameOf(agentId) {
    try {
      const identity = get(agentId, "IDENTITY.md");
      return identity.missing ? "" : validDisplayName(identityField(identity.content, "name")) ?? "";
    } catch { return ""; }
  }

  /** Emoji declarado no IDENTITY.md efetivo (metadado do `agents.list`; o escritório não o desenha). */
  function emojiOf(agentId) {
    try {
      const identity = get(agentId, "IDENTITY.md");
      return identity.missing ? "" : identityField(identity.content, "emoji");
    } catch { return ""; }
  }

  return { get, set, rename, nameOf, emojiOf };
}

module.exports = { FILE_NAMES, SHARED_FILES, MAX_BYTES, MAX_NAME, createProfileStore, identityField, looksSecret, validDisplayName };
