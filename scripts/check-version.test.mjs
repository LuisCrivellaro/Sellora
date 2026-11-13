import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { checkProjectVersions, validateVersionFiles } from "./check-version.mjs";

function files(major = 1, minor = 0) {
  const version = `${major}.${minor}.0`;
  return { version: { major, minor }, manifest: { version }, lockfile: { version, packages: { "": { version } } } };
}

test("metadados sincronizados e a versão do produto com dois componentes", () => {
  assert.equal(validateVersionFiles(files()), "1.0");
});

for (const version of [null, "1.0.1", { major: 1, minor: 10 }, { major: 1.1, minor: 0 }, { major: 1, minor: -1 }, { major: "1", minor: 0 }, { major: 1, minor: 0, patch: 1 }]) {
  test(`rejeita versão inválida ${JSON.stringify(version)}`, () => {
    assert.throws(() => validateVersionFiles({ ...files(), version }));
  });
}

test("rejeita patch independente e metadados divergentes", () => {
  for (const target of ["manifest", "lockfile", "lockRoot"]) {
    const input = files();
    if (target === "lockRoot") input.lockfile.packages[""].version = "1.0.1";
    else input[target].version = "1.0.1";
    assert.throws(() => validateVersionFiles(input), /divergentes/);
  }
});

test("aceita manutenção da versão e exatamente um incremento, incluindo 1.9 para 2.0", () => {
  assert.equal(validateVersionFiles({ ...files(1, 0), previousVersion: { major: 1, minor: 0 } }), "1.0");
  assert.equal(validateVersionFiles({ ...files(1, 1), previousVersion: { major: 1, minor: 0 } }), "1.1");
  assert.equal(validateVersionFiles({ ...files(2, 0), previousVersion: { major: 1, minor: 9 } }), "2.0");
});

test("rejeita saltos e regressões de versão", () => {
  assert.throws(() => validateVersionFiles({ ...files(1, 2), previousVersion: { major: 1, minor: 0 } }), /Sequência inválida/);
  assert.throws(() => validateVersionFiles({ ...files(1, 8), previousVersion: { major: 1, minor: 9 } }), /Sequência inválida/);
});

test("rejeita rótulos fixos na interface e aceita a fonte compartilhada", () => {
  assert.throws(() => validateVersionFiles({ ...files(), sources: [{ name: "src/example.tsx", contents: '<span>Sellora 1.10</span>' }] }), /Versão fixa/);
  assert.equal(validateVersionFiles({ ...files(), sources: [{ name: "src/example.tsx", contents: '<span>{APP_LABEL}</span>' }] }), "1.0");
});

test("a checagem local preserva os arquivos de versão e lock", async () => {
  const names = ["version.json", "package.json", "package-lock.json"];
  const before = await Promise.all(names.map((name) => readFile(new URL(`../${name}`, import.meta.url), "utf8")));
  await checkProjectVersions();
  assert.deepEqual(await Promise.all(names.map((name) => readFile(new URL(`../${name}`, import.meta.url), "utf8"))), before);
});
