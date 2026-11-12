import data from "./municipios.json";
import { normalizeName } from "./classify";
import type { UFS } from "./catalog";

/**
 * Lista oficial de municípios (IBGE) com a coordenada da sede, embutida no app.
 * A pesquisa só aceita cidades desta lista e usa a coordenada daqui, então a
 * etapa "localizar a cidade" não depende de busca por nome e não falha.
 * Regerar: scripts/build-municipios.mjs.
 */

type Uf = (typeof UFS)[number];
export interface Municipio {
  name: string;
  uf: Uf;
  lat: number;
  lon: number;
}

const table = data as unknown as Record<Uf, [string, number, number][]>;

let index: Map<string, Municipio[]> | null = null;
function byName(): Map<string, Municipio[]> {
  if (index) return index;
  index = new Map();
  for (const [uf, list] of Object.entries(table) as [Uf, [string, number, number][]][]) {
    for (const [name, lat, lon] of list) {
      const key = normalizeName(name);
      const hits = index.get(key) ?? [];
      hits.push({ name, uf, lat, lon });
      index.set(key, hits);
    }
  }
  return index;
}

/** Nomes oficiais dos municípios da UF, em ordem alfabética. */
export function municipioNames(uf: string): string[] {
  return (table[uf as Uf] ?? []).map((m) => m[0]);
}

/** Município exato na UF, ignorando acentos, maiúsculas e pontuação. */
export function findMunicipio(city: string, uf: string): Municipio | null {
  return byName().get(normalizeName(city))?.find((m) => m.uf === uf) ?? null;
}

/** UFs onde existe um município com esse nome (para sugerir a UF certa). */
export function ufsOfCity(city: string): Uf[] {
  return (byName().get(normalizeName(city)) ?? []).map((m) => m.uf);
}

/** Mensagem de erro quando a cidade não está na UF; null se estiver. */
export function municipioError(city: string, uf: string): string | null {
  if (!city.trim() || findMunicipio(city, uf)) return null;
  const others = ufsOfCity(city);
  const name = others.length ? findMunicipio(city, others[0])!.name : city.trim();
  if (others.length) return `${name} não fica em ${uf}. Fica em ${others.join(", ")}.`;
  return `Município "${name}" não encontrado em ${uf}. Escolha um da lista.`;
}
