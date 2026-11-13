import { expect, it } from "vitest";
import { displayVersion, nextVersion, packageVersion, releaseIsCurrent } from "./release-version";

it.each([[1, 0, "1.1"], [1, 8, "1.9"], [1, 9, "2.0"], [2, 9, "3.0"], [99, 9, "100.0"]])("avança %i.%i para %s", (major, minor, expected) => {
  expect(displayVersion(nextVersion({ major, minor }))).toBe(expected);
});

it("repetir os mesmos arquivos validados mantém a versão", () => {
  expect(releaseIsCurrent({ lastRelease: { fingerprint: "mesmos-arquivos" } }, "mesmos-arquivos")).toBe(true);
  expect(releaseIsCurrent({ lastRelease: { fingerprint: "antes" } }, "depois")).toBe(false);
  expect(releaseIsCurrent({}, "primeira-atualização")).toBe(false);
});

it("rejeita componentes fracionários, minor 10 e major inválido", () => {
  for (const version of [{ major: 1, minor: 10 }, { major: 0, minor: 1 }, { major: 1.1, minor: 0 }, { major: 1, minor: -1 }]) expect(() => nextVersion(version)).toThrow();
  expect(packageVersion({ major: 1, minor: 1 })).toBe("1.1.0");
});
