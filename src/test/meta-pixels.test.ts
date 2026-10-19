import { describe, it, expect, vi } from "vitest";
import { fetchNosPixels, pixelsDaMeta } from "../../supabase/functions/_shared/meta-pixels";

const envDe = (o: Record<string, string>) => (k: string) => o[k];

describe("venda da web nos 2 pixels (19/10, conta iris)", () => {
  it("só o principal quando o 2º não está configurado", () => {
    expect(pixelsDaMeta(envDe({ META_PIXEL_ID: "A", META_CAPI_TOKEN: "ta" })).map((p) => p.id)).toEqual(["A"]);
  });
  it("os dois quando o 2º tem id + token; nunca o mesmo pixel 2x", () => {
    expect(pixelsDaMeta(envDe({ META_PIXEL_ID: "A", META_CAPI_TOKEN: "ta", META_PIXEL_ID_2: "B", META_CAPI_TOKEN_2: "tb" })).map((p) => p.id)).toEqual(["A", "B"]);
    expect(pixelsDaMeta(envDe({ META_PIXEL_ID: "A", META_CAPI_TOKEN: "ta", META_PIXEL_ID_2: "A", META_CAPI_TOKEN_2: "tb" })).map((p) => p.id)).toEqual(["A"]);
    expect(pixelsDaMeta(envDe({ META_PIXEL_ID: "A", META_CAPI_TOKEN: "ta", META_PIXEL_ID_2: "B" })).map((p) => p.id)).toEqual(["A"]);
  });
  it("manda o MESMO corpo pros dois e devolve a resposta do principal; 2º falhando não derruba", async () => {
    const f = vi.fn(async (url: string) => (url.includes("/B/") ? Promise.reject(new Error("rede")) : new Response("{}", { status: 200 })));
    const init = { method: "POST", body: JSON.stringify({ data: [{ event_name: "Purchase", event_id: "x" }] }) };
    const r = await fetchNosPixels(init, envDe({ META_PIXEL_ID: "A", META_CAPI_TOKEN: "ta", META_PIXEL_ID_2: "B", META_CAPI_TOKEN_2: "tb" }), f as unknown as typeof fetch);
    expect(r.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls.map((c) => (c as unknown[])[1])).toEqual([init, init]);
    expect(f.mock.calls.some((c) => String((c as unknown[])[0]).includes("/A/events?access_token=ta"))).toBe(true);
  });
});
