import { describe, expect, it } from "vitest";
import { UFS } from "./catalog";
import { findMunicipio, municipioError, municipioNames, ufsOfCity } from "./municipios";
import { prospectParamsSchema } from "./schema";

describe("municípios oficiais", () => {
  it("cobre as 27 UFs e todos os nomes passam na validação do formulário", () => {
    let total = 0;
    for (const uf of UFS) {
      const names = municipioNames(uf);
      expect(names.length, uf).toBeGreaterThan(0);
      for (const city of names) {
        const ok = prospectParamsSchema.safeParse({ city, uf, segment: "beleza", radiusKm: 10, maxResults: 20, opportunity: "todas" }).success;
        expect(ok, `${city}/${uf}`).toBe(true);
      }
      total += names.length;
    }
    expect(total).toBeGreaterThan(5500);
  });

  it("acha a cidade sem acento e devolve o nome oficial com coordenada", () => {
    const m = findMunicipio("rondonopolis", "MT");
    expect(m?.name).toBe("Rondonópolis");
    expect(m!.lat).toBeLessThan(-15);
    expect(m!.lon).toBeLessThan(-50);
    expect(findMunicipio("SAO PAULO", "SP")?.name).toBe("São Paulo");
  });

  it("recusa cidade na UF errada e aponta a UF certa", () => {
    expect(findMunicipio("rondonopolis", "SP")).toBeNull();
    expect(ufsOfCity("rondonopolis")).toEqual(["MT"]);
    expect(municipioError("rondonopolis", "SP")).toBe("Rondonópolis não fica em SP. Fica em MT.");
    expect(municipioError("Cidade Inventada", "SP")).toMatch(/não encontrado em SP/);
    expect(municipioError("Campinas", "SP")).toBeNull();
  });
});
