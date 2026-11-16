/**
 * Publicação manual (sem Coolify): o administrador sobe o ZIP da demo num host estático de sua escolha
 * e registra aqui o endereço. Só aceita endereço público HTTPS — um link local nunca chega ao lead.
 */
const LOCAL_HOST = /^(localhost|127(\.\d{1,3}){3}|0\.0\.0\.0|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}|169\.254(\.\d{1,3}){2}|\[?::1\]?)$/i;

export function parseManualDemoUrl(raw: string): { ok: true; url: string; domain: string } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Cole o endereço público da demo." };
  let url: URL;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`); }
  catch { return { ok: false, error: "Endereço inválido. Exemplo: https://nome-da-demo.netlify.app" }; }
  if (url.protocol !== "https:") return { ok: false, error: "Use um endereço com https://." };
  if (url.username || url.password) return { ok: false, error: "O endereço não pode conter usuário ou senha." };
  const host = url.hostname.toLowerCase();
  if (LOCAL_HOST.test(host) || host.endsWith(".local") || host.endsWith(".localhost") || !host.includes(".")) {
    return { ok: false, error: "Este endereço só abre no seu computador. Publique a demo e cole o link público." };
  }
  if (text.length > 2000) return { ok: false, error: "Endereço longo demais." };
  url.hash = "";
  return { ok: true, url: url.toString(), domain: host };
}
