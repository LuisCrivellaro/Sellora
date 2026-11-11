import { afterEach, expect, it, vi } from "vitest";
import { fetchOverpass } from "./osm";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it("repete uma única vez quando o Overpass responde 502 temporário", async () => {
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
});
