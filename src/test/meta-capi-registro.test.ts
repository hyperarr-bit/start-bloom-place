/**
 * CompleteRegistration da Porta: o pixel da CAPI é o da página, o event_id
 * é o mesmo do fbq, e conta antiga / sinal inválido não entra no payload.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PIXEL_PORTA,
  codigoTesteMeta,
  contaEhNova,
  eventIdDeRegistro,
  ipDoCliente,
  montarCorpoCapi,
  sha256,
  sinalMeta,
  urlEventosMeta,
} from "../../supabase/functions/_shared/meta-capi-registro";

const AGORA = Date.parse("2026-10-11T02:00:00Z");

describe("pixel da Street Store", () => {
  it("é o fbq('init') do index.html, e a função posta nele", () => {
    const html = readFileSync(resolve(__dirname, "../../index.html"), "utf8");
    expect(html).toContain(`fbq('init', '${PIXEL_PORTA}')`);
    expect(PIXEL_PORTA).toBe("998037194527241");
    const fn = readFileSync(resolve(__dirname, "../../supabase/functions/porta-capi/index.ts"), "utf8");
    expect(fn).toContain("urlEventosMeta(PIXEL_PORTA)");
    expect(fn).toContain("META_CAPI_TOKEN");
    expect(fn).toContain('event_name: "porta_capi_registro"');
    expect(fn).not.toContain("998037194527240");
  });
});

describe("quem pode mandar o evento", () => {
  it("conta de agora sim; conta de ontem não; sem data não", () => {
    expect(contaEhNova("2026-10-11T01:58:00Z", AGORA)).toBe(true);
    expect(contaEhNova("2026-10-10T02:00:00Z", AGORA)).toBe(false);
    expect(contaEhNova(null, AGORA)).toBe(false);
    expect(contaEhNova("2026-10-11T02:02:00Z", AGORA)).toBe(true);
    expect(contaEhNova("2026-10-11T03:00:00Z", AGORA)).toBe(false);
  });

  it("event_id no formato da Porta; o resto é recusado", () => {
    expect(eventIdDeRegistro("porta_cr_abc12345")).toBe("porta_cr_abc12345");
    expect(eventIdDeRegistro("porta_cr_" + "a".repeat(36))).toBeTruthy();
    expect(eventIdDeRegistro("Purchase_1")).toBeNull();
    expect(eventIdDeRegistro("")).toBeNull();
  });
});

describe("payload", () => {
  it("CompleteRegistration com o event_id do pixel, e-mail só em hash, IP e UA juntos", async () => {
    const email = " Ana@Exemplo.com ";
    const hash = await sha256(email);
    expect(hash).toHaveLength(64);
    expect(hash).toBe(await sha256("ana@exemplo.com"));
    const corpo = montarCorpoCapi({
      eventId: "porta_cr_abc12345",
      eventTime: 1_760_000_000,
      emailHash: hash,
      externalIdHash: await sha256("user-1"),
      fbp: sinalMeta("fb.1.1700000000000.123456"),
      fbc: sinalMeta("fb.1.1700000000000.IwAR_abc"),
      ip: "203.0.113.8",
      ua: "Mozilla/5.0",
      sourceUrl: "https://coreaplicativo.com.br/comece?utm_campaign=porta",
      testEventCode: null,
    }) as { data: Array<Record<string, unknown>> };
    expect(corpo.data).toHaveLength(1);
    expect(corpo.data[0]).toMatchObject({
      event_name: "CompleteRegistration",
      event_id: "porta_cr_abc12345",
      event_time: 1_760_000_000,
      action_source: "website",
      custom_data: { content_name: "porta_iphone", status: true },
    });
    const userData = corpo.data[0].user_data as Record<string, unknown>;
    expect(userData.em).toEqual([hash]);
    expect(JSON.stringify(corpo)).not.toContain("ana@exemplo.com");
    expect(userData.client_ip_address).toBe("203.0.113.8");
    expect(userData.client_user_agent).toBe("Mozilla/5.0");
    expect(userData.fbp).toBe("fb.1.1700000000000.123456");
    expect(userData.fbc).toBe("fb.1.1700000000000.IwAR_abc");
    expect(urlEventosMeta(PIXEL_PORTA)).toBe("https://graph.facebook.com/v19.0/998037194527241/events");
  });

  it("sinal inválido e IP sem UA ficam de fora; o código de teste só entra se for TEST+dígitos", () => {
    expect(sinalMeta("nao-e-fbp")).toBeNull();
    expect(sinalMeta("")).toBeNull();
    expect(ipDoCliente(() => null)).toBeNull();
    expect(ipDoCliente((n) => n === "x-forwarded-for" ? "203.0.113.8, 10.0.0.1" : null)).toBe("203.0.113.8");
    const corpo = montarCorpoCapi({
      eventId: "porta_cr_abc12345",
      eventTime: 1,
      emailHash: null,
      externalIdHash: "abc",
      fbp: null,
      fbc: null,
      ip: "203.0.113.8",
      ua: "",
      sourceUrl: null,
      testEventCode: codigoTesteMeta("TEST12345"),
    }) as { data: Array<{ user_data: Record<string, unknown> }>; test_event_code?: string };
    expect(corpo.data[0].user_data.client_ip_address).toBeUndefined();
    expect(corpo.data[0].user_data.fbp).toBeUndefined();
    expect(corpo.test_event_code).toBe("TEST12345");
    expect(codigoTesteMeta("teste")).toBeNull();
    expect(codigoTesteMeta("TEST12")).toBeNull();
  });
});
