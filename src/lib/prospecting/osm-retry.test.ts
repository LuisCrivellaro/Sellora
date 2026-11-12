import { afterEach, expect, it, vi } from "vitest";
import { fetchOverpass, OVERPASS_ENDPOINTS } from "./osm";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("troca de servidor quando o Overpass responde 502 temporário", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response("Bad Gateway", { status: 502 }))
    .mockResolvedValueOnce(Response.json({ elements: [{ type: "node", id: 123 }] }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = fetchOverpass("query", new AbortController().signal);
  const expectation = expect(pending).resolves.toEqual([{ type: "node", id: 123 }]);
  await vi.advanceTimersByTimeAsync(5100);
  await expectation;
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0]);
  expect(OVERPASS_ENDPOINTS.length).toBeGreaterThan(1);
});

it("continua depois de erro de rede e de sobrecarga informada no corpo", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn()
    .mockRejectedValueOnce(new TypeError("fetch failed"))
    .mockResolvedValueOnce(Response.json({ elements: [], remark: "runtime error: Query timed out" }))
    .mockResolvedValueOnce(Response.json({ elements: [{ type: "way", id: 9 }] }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = fetchOverpass("query", new AbortController().signal);
  const expectation = expect(pending).resolves.toEqual([{ type: "way", id: 9 }]);
  await vi.advanceTimersByTimeAsync(20_000);
  await expectation;
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

it("desiste com mensagem clara depois de esgotar as tentativas", async () => {
  vi.useFakeTimers();
  const fetchMock = vi.fn().mockImplementation(async () => new Response("busy", { status: 504 }));
  vi.stubGlobal("fetch", fetchMock);
  const pending = fetchOverpass("query", new AbortController().signal);
  const expectation = expect(pending).rejects.toThrow(/sobrecarregados/);
  await vi.advanceTimersByTimeAsync(120_000);
  await expectation;
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
