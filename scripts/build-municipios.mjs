// Gera src/lib/prospecting/municipios.json: todos os municípios do Brasil por UF,
// com nome oficial (IBGE) e coordenadas da sede (kelvins/municipios-brasileiros, MIT).
//
// Uso (baixe os dois arquivos antes):
//   curl -o ibge.json "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado"
//   curl -o municipios.csv https://raw.githubusercontent.com/kelvins/municipios-brasileiros/main/csv/municipios.csv
//   node scripts/build-municipios.mjs ibge.json municipios.csv
import { readFileSync, writeFileSync } from "node:fs";

const [ibgePath, csvPath] = process.argv.slice(2);
if (!ibgePath || !csvPath) {
  console.error("Uso: node scripts/build-municipios.mjs <ibge.json> <municipios.csv>");
  process.exit(1);
}

const ibge = JSON.parse(readFileSync(ibgePath, "utf8"));
const coords = new Map();
for (const line of readFileSync(csvPath, "utf8").split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const [code, , lat, lon] = line.split(",");
  coords.set(Number(code), [Number(lat), Number(lon)]);
}

const byUf = {};
const missing = [];
for (const m of ibge) {
  const c = coords.get(m["municipio-id"]);
  const [lat, lon] = c ?? [];
  // Caixa aproximada do território brasileiro: descarta coordenada inválida.
  if (!c || !(lat > -34 && lat < 6 && lon > -74.5 && lon < -28.5)) {
    missing.push(`${m["municipio-nome"]}/${m["UF-sigla"]}`);
    continue;
  }
  (byUf[m["UF-sigla"]] ??= []).push([m["municipio-nome"], lat, lon]);
}

const sorted = Object.fromEntries(
  Object.keys(byUf)
    .sort()
    .map((uf) => [uf, byUf[uf].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))]),
);
const out = new URL("../src/lib/prospecting/municipios.json", import.meta.url);
writeFileSync(out, JSON.stringify(sorted));
const total = Object.values(sorted).reduce((n, l) => n + l.length, 0);
console.log(`${total} municípios em ${Object.keys(sorted).length} UFs gravados.`);
if (missing.length) console.log(`Sem coordenada válida (fora da lista): ${missing.join(", ")}`);
