// Teste de RLS contra o projeto Supabase REAL, com dois usuários de teste.
//
// Uso (você roda; as senhas ficam só no seu .env.local, que não é versionado):
//   node --env-file=.env.local scripts/rls-check.mjs
//
// Variáveis em .env.local:
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
//   RLS_TEST_A_EMAIL, RLS_TEST_A_PASSWORD   (usuário A)
//   RLS_TEST_B_EMAIL, RLS_TEST_B_PASSWORD   (usuário B)
//
// O script cria 1 lead de teste com o usuário A, tenta lê-lo/alterá-lo/apagá-lo
// com o usuário B e sem login, e no fim apaga o lead de teste. Não toca em
// nenhum outro registro. Não usa service_role.

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const users = {
  A: [process.env.RLS_TEST_A_EMAIL, process.env.RLS_TEST_A_PASSWORD],
  B: [process.env.RLS_TEST_B_EMAIL, process.env.RLS_TEST_B_PASSWORD],
};

if (!url || !key || Object.values(users).some(([e, p]) => !e || !p)) {
  console.error("Faltam variáveis. Veja o cabeçalho de scripts/rls-check.mjs.");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok, detail });
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signIn(label) {
  const c = client();
  const [email, password] = users[label];
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login do usuário ${label} falhou: ${error.message}`);
  return c;
}

const now = new Date().toISOString();
const leadId = randomUUID();
const leadRow = {
  id: leadId,
  name: "RLS teste (apagar)",
  segment: "outros",
  city: "Teste",
  uf: "SP",
  source: "manual",
  website: null,
  website_situation: "sem_site",
  stage: "novo",
  priority: "baixa",
  phone: "",
  email: "",
  instagram: "",
  potential_value: 0,
  last_contact_at: null,
  next_action: "",
  next_action_at: null,
  notes: "Criado por scripts/rls-check.mjs",
  client_id: null,
  lost_reason: "",
  created_at: now,
  updated_at: now,
};

let a;
try {
  a = await signIn("A");
  const b = await signIn("B");
  const anon = client();

  const ins = await a.rpc("apply_changes", { payload: { upserts: { leads: [leadRow] }, deletes: {} } });
  check("A grava lead pela função apply_changes", !ins.error, ins.error?.message);
  const ownRead = await a.from("leads").select("id").eq("id", leadId);
  check("A lê o próprio lead", ownRead.data?.length === 1, ownRead.error?.message);

  const bRead = await b.from("leads").select("id").eq("id", leadId);
  check("B não lê o lead de A", !bRead.error && bRead.data?.length === 0, bRead.error?.message);

  const bUpd = await b.from("leads").update({ name: "invadido" }).eq("id", leadId).select("id");
  check("B não altera o lead de A", (bUpd.data?.length ?? 0) === 0, bUpd.error?.message);

  const bRpc = await b.rpc("apply_changes", { payload: { upserts: { leads: [{ ...leadRow, name: "invadido" }] }, deletes: {} } });
  check("B não sobrescreve via apply_changes", !!bRpc.error, "a chamada deveria falhar");

  const bDel = await b.rpc("apply_changes", { payload: { upserts: {}, deletes: { leads: [leadId] } } });
  const still = await a.from("leads").select("name").eq("id", leadId).single();
  check("B não apaga o lead de A", !bDel.error && still.data?.name === leadRow.name, still.error?.message);

  const anonRead = await anon.from("leads").select("id").limit(1);
  check("Sem login não lê tabelas", !!anonRead.error || anonRead.data?.length === 0, anonRead.error?.message);
  const anonRpc = await anon.rpc("apply_changes", { payload: { upserts: {}, deletes: {} } });
  check("Sem login não executa apply_changes", !!anonRpc.error);

  const bSettings = await b.from("settings").select("owner_id");
  const bOwnId = (await b.auth.getUser()).data.user?.id;
  check("B só vê as próprias preferências", !bSettings.error && (bSettings.data ?? []).every((r) => r.owner_id === bOwnId), bSettings.error?.message);
} catch (e) {
  check("execução", false, e.message);
} finally {
  if (a) {
    const del = await a.rpc("apply_changes", { payload: { upserts: {}, deletes: { leads: [leadId] } } });
    check("limpeza: lead de teste removido", !del.error, del.error?.message);
  }
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok || !r.detail ? "" : `  →  ${r.detail}`}`);
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} PASS`);
  process.exit(failed ? 1 : 0);
}
