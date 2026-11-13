export function navigationKind(value, origin) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return "deny";
    if (url.origin === origin && url.protocol === "http:") return "internal";
    if (url.protocol === "https:") return "external";
  } catch { /* invalid URL */ }
  return "deny";
}

/**
 * Configuração local do usuário para o app empacotado (<userData>/sellora.env, linhas CHAVE=valor).
 * O pacote não leva .env; este arquivo fica no perfil do Windows, fora do Git e do instalador.
 * Só chaves conhecidas são aceitas: nada de PATH, NODE_OPTIONS ou outras variáveis que mudem o runtime.
 */
export const USER_CONFIG_KEYS = /^(COOLIFY_[A-Z_]+|SELLORA_DEMOS_[A-Z_]+|SELLORA_CLAW3D_DIR|SELLORA_CLAUDE_(PATH|MODEL)|SELLORA_CODEX_PATH)$/;

export function parseUserConfig(text) {
  const values = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match || !USER_CONFIG_KEYS.test(match[1])) continue;
    let value = match[2].trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (value) values[match[1]] = value;
  }
  return values;
}

export const USER_CONFIG_TEMPLATE = `# Configuração local da Sellora (só neste computador; nunca envie este arquivo a ninguém).
# Preencha e reabra o app. Guia: docs/COOLIFY_INTEGRATION.md no repositório.

# Publicação das demos (Coolify). Sem as obrigatórias, publicar fica desligado.
COOLIFY_API_URL=
COOLIFY_API_TOKEN=
COOLIFY_PROJECT_UUID=
COOLIFY_SERVER_UUID=
# COOLIFY_ENVIRONMENT_NAME=production
# COOLIFY_DESTINATION_UUID=
# Repositório privado: cadastre o GitHub App no Coolify (Sources) e informe o uuid dele.
COOLIFY_GITHUB_APP_UUID=
SELLORA_DEMOS_GITHUB_REPO=LuisCrivellaro/sellora-demos
SELLORA_DEMOS_GITHUB_TOKEN=
# SELLORA_DEMOS_GITHUB_BRANCH=main
# Domínio principal das demos (ex.: demos.seudominio.com.br), com DNS curinga para a VPS. Opcional.
SELLORA_DEMOS_BASE_DOMAIN=

# Cloud 3D: pasta do Claw3D já preparado (deixe vazio para usar a pasta padrão do app).
SELLORA_CLAW3D_DIR=
`;
