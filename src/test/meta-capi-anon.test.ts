/**
 * CAPI do app: teste anônimo, dedup (o ×36–96), varredura só-listar, IP+UA em par.
 * Não chama a Meta.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  chavesDaAssinatura,
  chavesPorUsuarioCore,
  classificarEventoApp,
  cronEnviaAnonimos,
  decidirReenvio,
  deveEnviarComoAnonimo,
  escolherSinal,
  ipDoCabecalho,
  jaEnviado,
  linhaNovaRevenueCat,
  linhaRevenueCat,
  listarFaltantes,
  normalizarEvento,
  patchEventoExistente,
  MARCADOR_COMPRA,
  MARCADOR_TRIAL,
  parIpUa,
  sinaisDeAtributos,
  varreduraPodeEnviar,
  type AssinaturaLoja,
  type EventoAppRC,
  type MarcadorCapi,
} from "../../supabase/functions/_shared/meta-capi-app";

const fonte = (f: string) => readFileSync(resolve(__dirname, "../../", f), "utf8");

const AGORA = Date.parse("2026-10-10T15:00:00.000Z");
const UID = "22222222-2222-2222-2222-222222222222";

const trialAnon = (extra: Partial<EventoAppRC> = {}): EventoAppRC => ({
  event_type: "INITIAL_PURCHASE",
  store: "APP_STORE",
  product_id: "core_anual_97",
  period_type: "TRIAL",
  price_in_purchased_currency: 0,
  currency: "BRL",
  transaction_id: "tx-trial",
  original_transaction_id: "otx-1",
  purchased_at: "2026-10-09T15:00:00.000Z",
  app_user_id: "$RCAnonymousID:abc",
  subscriber_attributes: {
    $fbAnonId: { value: "fb-anon-1" },
    $idfv: { value: "IDFV-1" },
    $idfa: { value: "IDFA-1" },
  },
  ...extra,
});

describe("StartTrial anônimo", () => {
  it("mapeia INITIAL_PURCHASE trial sem conta: event_id estável, anual 97, sinais do RC", () => {
    const c = classificarEventoApp(trialAnon());
    expect(c.tipo).toBe("trial");
    if (c.tipo === "ignorar") throw new Error(c.motivo);
    expect(c.anonimo).toBe(true);
    expect(c.userId).toBeNull();
    expect(c.eventId).toBe("otx-1");
    expect(c.chaves).toEqual(["otx-1", "tx-trial"]);
    expect(c.cents).toBe(9790);
    expect(c.billing).toBe("annual");
    expect(c.plataforma).toBe("ios");
    const sinais = sinaisDeAtributos(c.atributos);
    expect(sinais).toEqual({ anon_id: "fb-anon-1", madid: "IDFA-1", vendor_id: "IDFV-1" });
  });

  it("core_anual_69 continua 6990 / annual (compra_anual_69 no backfill)", () => {
    const c = classificarEventoApp(trialAnon({
      product_id: "core_anual_69",
      event_type: "RENEWAL",
      is_trial_conversion: true,
      period_type: "NORMAL",
      price_in_purchased_currency: 69.9,
      transaction_id: "tx-pago",
    }));
    expect(c.tipo).toBe("purchase");
    if (c.tipo === "ignorar") throw new Error(c.motivo);
    expect(c.cents).toBe(6990);
    expect(c.billing).toBe("annual");
    expect(c.eventId).toBe("otx-1");
  });

  it("alias com UUID deixa de ser anônimo — a linha de subscriptions é a dona", () => {
    const c = classificarEventoApp(trialAnon({ aliases: ["$RCAnonymousID:abc", UID] }));
    expect(c.tipo).toBe("trial");
    if (c.tipo === "ignorar") throw new Error(c.motivo);
    expect(c.anonimo).toBe(false);
    expect(c.userId).toBe(UID);
    expect(deveEnviarComoAnonimo(c, [], [], [])).toBe(false);
  });

  it("IDFA zerado não vira madid; GAID da ficha entra no lugar", () => {
    expect(sinaisDeAtributos(
      { $idfa: { value: "00000000-0000-0000-0000-000000000000" }, $idfv: { value: "V" } },
      { gaid: "gaid-1", anon_id: "ficha-anon" },
    )).toEqual({ anon_id: "ficha-anon", madid: "gaid-1", vendor_id: "V" });
  });

  it("$fbAnonId ganha da ficha", () => {
    expect(sinaisDeAtributos({ $fbAnonId: { value: "do-rc" } }, { anon_id: "da-ficha" }).anon_id).toBe("do-rc");
  });
});

describe("dedup no reenvio e no TRANSFER", () => {
  it("erro de leitura ou marcador existente não reenvia; forcar é o único bypass", () => {
    expect(decidirReenvio({ jaMarcado: false, erroLeitura: false })).toBe("enviar");
    expect(decidirReenvio({ jaMarcado: true, erroLeitura: false })).toBe("pular");
    expect(decidirReenvio({ jaMarcado: false, erroLeitura: true })).toBe("pular");
    expect(decidirReenvio({ jaMarcado: true, erroLeitura: true, forcar: true })).toBe("enviar");
  });

  it("o mesmo original_transaction_id não sai duas vezes, nem depois do TRANSFER com sub id novo", () => {
    const c = classificarEventoApp(trialAnon());
    if (c.tipo === "ignorar") throw new Error(c.motivo);
    const marcadores: MarcadorCapi[] = [];
    expect(jaEnviado(marcadores, MARCADOR_TRIAL, c.chaves)).toBe(false);
    expect(deveEnviarComoAnonimo(c, marcadores, [], [])).toBe(true);
    marcadores.push({ event_name: MARCADOR_TRIAL, tx: c.eventId, chaves: c.chaves });
    expect(deveEnviarComoAnonimo(c, marcadores, [], [])).toBe(false);
    expect(jaEnviado(marcadores, MARCADOR_TRIAL, ["sub_abc", c.eventId])).toBe(true);

    const transfer: EventoAppRC = {
      event_type: "TRANSFER",
      app_user_id: UID,
      transferred_from: ["$RCAnonymousID:abc"],
      transferred_to: [UID],
      store: "APP_STORE",
    };
    const mapa = chavesPorUsuarioCore([trialAnon(), transfer]);
    expect(mapa.get(UID)).toEqual(expect.arrayContaining(["otx-1", "tx-trial"]));
    const assinatura: AssinaturaLoja = {
      user_id: UID,
      revenuecat_subscription_id: "sub_abc",
      created_at: "2026-10-09T15:00:00.000Z",
      current_period_start: "2026-10-09T15:00:00.000Z",
      current_period_end: "2026-10-12T15:00:00.000Z",
      billing_period: "annual",
      amount_cents: 9790,
    };
    const faltantes = listarFaltantes({
      assinaturas: [assinatura],
      eventos: [trialAnon(), transfer],
      marcadores,
      agora: AGORA,
    });
    expect(faltantes.find((f) => f.tipo === "trial")).toBeUndefined();

    const soNoSub = listarFaltantes({
      assinaturas: [assinatura],
      eventos: [trialAnon(), transfer],
      marcadores: [{ event_name: MARCADOR_TRIAL, tx: "sub_abc" }],
      agora: AGORA,
    });
    expect(soNoSub.find((f) => f.tipo === "trial")).toBeUndefined();
  });

  it("outro produto do mesmo usuário não herda o marcador", () => {
    const outro = trialAnon({
      original_transaction_id: "otx-2",
      transaction_id: "tx-2",
      purchased_at: "2026-10-01T15:00:00.000Z",
      product_id: "core_anual_69",
    });
    const subOutro: AssinaturaLoja = {
      user_id: UID,
      revenuecat_subscription_id: "sub_outro",
      created_at: "2026-10-01T15:00:00.000Z",
      current_period_start: "2026-10-01T15:00:00.000Z",
      current_period_end: "2026-10-04T15:00:00.000Z",
      billing_period: "annual",
    };
    const transfer: EventoAppRC = {
      event_type: "TRANSFER",
      app_user_id: UID,
      transferred_from: ["$RCAnonymousID:abc"],
      transferred_to: [UID],
      store: "APP_STORE",
    };
    expect(chavesDaAssinatura([trialAnon(), outro, transfer], UID, "2026-10-09T15:00:00.000Z")).toEqual(["otx-1", "tx-trial"]);
    const lista = listarFaltantes({
      assinaturas: [subOutro],
      eventos: [trialAnon(), outro, transfer],
      marcadores: [{ event_name: MARCADOR_TRIAL, tx: "otx-2", chaves: ["otx-2", "tx-2"] }],
      agora: AGORA,
    });
    expect(lista.find((f) => f.tx === "otx-1")?.tipo).toBe("trial");
    expect(lista.find((f) => f.tx === "sub_outro")).toBeUndefined();
  });
});

describe("varredura enviado × venda, só listar", () => {
  const assinatura: AssinaturaLoja = {
    user_id: UID,
    customer_email: "pessoa@exemplo.com",
    revenuecat_subscription_id: "sub_1",
    created_at: "2026-10-08T12:00:00.000Z",
    current_period_start: "2026-10-08T12:00:00.000Z",
    current_period_end: "2026-10-11T12:00:00.000Z",
    billing_period: "annual",
    amount_cents: 9790,
  };

  it("lista o que não tem marcador e não lista de novo depois do marcador", () => {
    const sem = listarFaltantes({
      assinaturas: [assinatura],
      eventos: [trialAnon()],
      marcadores: [],
      agora: AGORA,
    });
    expect(sem.map((f) => `${f.fonte}:${f.tipo}:${f.tx}`).sort()).toEqual([
      "revenuecat_events:trial:otx-1",
      "subscriptions:trial:sub_1",
    ]);
    const com = listarFaltantes({
      assinaturas: [assinatura],
      eventos: [trialAnon()],
      marcadores: [
        { event_name: MARCADOR_TRIAL, tx: "sub_1" },
        { event_name: MARCADOR_TRIAL, tx: "otx-1", chaves: ["otx-1", "tx-trial"] },
      ],
      agora: AGORA,
    });
    expect(com).toEqual([]);
  });

  it("conta de teste fica de fora", () => {
    const lista = listarFaltantes({
      assinaturas: [{ ...assinatura, customer_email: "jv20101958@gmail.com" }],
      eventos: [trialAnon({ subscriber_attributes: { $email: { value: "a.teste@exemplo.com" } } })],
      marcadores: [],
      agora: AGORA,
    });
    expect(lista).toEqual([]);
  });

  it("modo padrão é listar; cron anônimo não liga com body", () => {
    expect(varreduraPodeEnviar({ cron: true, bodyEnviar: true, envEnviar: false })).toBe(false);
    expect(varreduraPodeEnviar({ cron: false, bodyEnviar: false, envEnviar: false })).toBe(false);
    expect(varreduraPodeEnviar({ cron: false, bodyEnviar: true, envEnviar: false })).toBe(true);
    expect(varreduraPodeEnviar({ cron: true, bodyEnviar: false, envEnviar: true })).toBe(true);
    expect(cronEnviaAnonimos(undefined)).toBe(false);
    expect(cronEnviaAnonimos("")).toBe(false);
    expect(cronEnviaAnonimos("1")).toBe(true);
  });
});

describe("IP e user-agent só em par", () => {
  it("os dois entram juntos; um sozinho ou IP inválido não entra", () => {
    expect(parIpUa("177.10.2.3", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toEqual({
      client_ip_address: "177.10.2.3",
      client_user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    });
    expect(parIpUa("177.10.2.3", null)).toBeNull();
    expect(parIpUa(null, "Mozilla/5.0 (iPhone)")).toBeNull();
    expect(parIpUa("", "")).toBeNull();
    expect(parIpUa("nao-e-ip", "Mozilla/5.0 (iPhone)")).toBeNull();
    expect(parIpUa("127.0.0.1", "Mozilla/5.0 (iPhone)")).toBeNull();
  });

  it("lê o primeiro salto de x-forwarded-for e, sem ele, cf-connecting-ip", () => {
    expect(ipDoCabecalho("177.10.2.3, 10.0.0.1", "1.1.1.1")).toBe("177.10.2.3");
    expect(ipDoCabecalho(null, "2001:db8::1")).toBe("2001:db8::1");
    expect(ipDoCabecalho("desconhecido", null)).toBeNull();
  });

  it("sinal expirado ou sem o par não é escolhido", () => {
    const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
    expect(escolherSinal([
      { client_ip: "177.10.2.3", user_agent: null, created_at: "2026-10-10T14:00:00.000Z", expira_em: "2026-10-20T14:00:00.000Z" },
      { client_ip: "177.10.2.9", user_agent: ua, created_at: "2026-10-01T14:00:00.000Z", expira_em: "2026-10-09T14:00:00.000Z" },
      { client_ip: "177.10.2.4", user_agent: ua, created_at: "2026-10-08T14:00:00.000Z", expira_em: "2026-10-18T14:00:00.000Z" },
    ], AGORA)).toEqual({ client_ip_address: "177.10.2.4", client_user_agent: ua });
  });
});

describe("o que este PR não desliga e o que o main ainda não tinha", () => {
  it("FacebookAutoLogAppEventsEnabled segue true, com o TODO do passo 4", () => {
    const plist = fonte("ios/App/App/Info.plist");
    expect(plist).toMatch(/<key>FacebookAutoLogAppEventsEnabled<\/key>\s*<true\/>/);
    expect(plist).toMatch(/TODO/);
  });

  it("o backfill de assinatura mantém compra_anual_69 e compra_anual_97", () => {
    const s = fonte("supabase/functions/meta-backfill-app/index.ts");
    expect(s).toMatch(/6990:\s*\{\s*evento:\s*"compra_anual_69"/);
    expect(s).toMatch(/9790:\s*\{\s*evento:\s*"compra_anual_97"/);
    expect(s).toMatch(/META_CAPI_ANON_ENVIAR/);
    expect(s).toMatch(/modo === "varredura"|modoPedido === "varredura"|varredura/);
    expect(s).toMatch(/received_at\.gte/);
    expect(s).toMatch(/event_at\.gte/);
    expect(s).not.toMatch(/rc_event_id/);
    expect(s).not.toMatch(/created_at\.gte\.\"\$\{desdeIso\}\"/);
  });

  it("grava no schema da Melhorias (id text, type, aliases text[], payload)", () => {
    const linha = linhaRevenueCat({
      id: "ev-1",
      type: "INITIAL_PURCHASE",
      app_user_id: "$RCAnonymousID:abc",
      aliases: ["$RCAnonymousID:abc"],
      product_id: "core_anual_97",
      store: "APP_STORE",
      period_type: "TRIAL",
      original_transaction_id: "otx-1",
      transaction_id: "tx-trial",
      price_in_purchased_currency: 0,
      currency: "BRL",
      purchased_at_ms: Date.parse("2026-10-09T15:00:00.000Z"),
      subscriber_attributes: { $idfv: { value: "IDFV-1" } },
    });
    expect(linha).toMatchObject({
      id: "ev-1",
      type: "INITIAL_PURCHASE",
      user_id: null,
      original_transaction_id: "otx-1",
      app_user_id: "$RCAnonymousID:abc",
      aliases: ["$RCAnonymousID:abc"],
      ids_anonimos: ["$RCAnonymousID:abc"],
      price_in_purchased_currency: 0,
    });
    expect(linha).not.toHaveProperty("rc_event_id");
    expect(linha).not.toHaveProperty("event_type");
    expect(linha).not.toHaveProperty("anonimo");
    expect(linha).not.toHaveProperty("price_cents");
    expect(linha).not.toHaveProperty("created_at");
    expect(linha).not.toHaveProperty("subscriber_attributes");
    expect((linha?.payload as { subscriber_attributes?: unknown }).subscriber_attributes).toEqual({ $idfv: { value: "IDFV-1" } });

    const nova = linhaNovaRevenueCat(linha as Record<string, unknown>, "2026-10-10T12:00:00.000Z");
    expect(nova.received_at).toBe("2026-10-10T12:00:00.000Z");
    expect(nova.origem).toBe("webhook");
    const patch = patchEventoExistente({ ...linha, user_id: null, received_at: "nao-mexer", ligado_em: "nao-mexer", origem: "app" });
    expect(patch).not.toHaveProperty("received_at");
    expect(patch).not.toHaveProperty("ligado_em");
    expect(patch).not.toHaveProperty("origem");
    expect(patch).not.toHaveProperty("user_id");

    const transfer = linhaRevenueCat({
      id: "ev-2",
      type: "TRANSFER",
      transferred_from: ["$RCAnonymousID:abc"],
      transferred_to: [UID],
      app_user_id: UID,
    });
    expect(transfer).toMatchObject({
      id: "ev-2",
      type: "TRANSFER",
      user_id: UID,
      ids_anonimos: ["$RCAnonymousID:abc"],
    });
    expect((transfer?.payload as { transferred_from?: string[] }).transferred_from).toEqual(["$RCAnonymousID:abc"]);
    expect(linhaRevenueCat({ type: "TEST" })).toBeNull();
    expect(linhaRevenueCat({ type: "INITIAL_PURCHASE" })).toBeNull();

    const hook = fonte("supabase/functions/revenuecat-webhook/index.ts");
    const grava = hook.indexOf("gravarEventoRevenueCat");
    const desiste = hook.indexOf('ignored: "anonimo"');
    expect(grava).toBeGreaterThan(0);
    expect(desiste).toBeGreaterThan(grava);
    expect(hook).toMatch(/patchEventoExistente/);
    expect(hook).not.toMatch(/rc_event_id/);
    const inicioGrava = hook.indexOf("async function gravarEventoRevenueCat");
    const gravaFn = hook.slice(inicioGrava, hook.indexOf("\nfunction json", inicioGrava));
    expect(gravaFn).toMatch(/\.eq\("id", id\)/);
    expect(gravaFn).not.toMatch(/onConflict/);
  });

  it("lê a linha que já está em produção (price numeric string, atributos no payload)", () => {
    const row = {
      id: "ev-1",
      type: "INITIAL_PURCHASE",
      user_id: null,
      app_user_id: "$RCAnonymousID:abc",
      original_app_user_id: "$RCAnonymousID:abc",
      aliases: ["$RCAnonymousID:abc"],
      ids_anonimos: ["$RCAnonymousID:abc"],
      environment: "PRODUCTION",
      store: "APP_STORE",
      product_id: "core_anual_97",
      period_type: "TRIAL",
      event_at: "2026-10-09T15:00:00.000Z",
      purchased_at: "2026-10-09T15:00:00.000Z",
      expiration_at: "2026-10-16T15:00:00.000Z",
      price: "0",
      price_in_purchased_currency: "0",
      currency: "BRL",
      transaction_id: "tx-trial",
      original_transaction_id: "otx-1",
      is_trial_conversion: false,
      payload: {
        subscriber_attributes: {
          $fbAnonId: { value: "fb-anon-1" },
          $idfv: { value: "IDFV-1" },
          $idfa: { value: "IDFA-1" },
        },
      },
      received_at: "2026-10-09T15:00:01.000Z",
    };
    const c = classificarEventoApp(row);
    expect(c.tipo).toBe("trial");
    if (c.tipo === "ignorar") throw new Error(c.motivo);
    expect(c.anonimo).toBe(true);
    expect(c.eventId).toBe("otx-1");
    expect(c.cents).toBe(9790);
    expect(sinaisDeAtributos(c.atributos)).toEqual({ anon_id: "fb-anon-1", madid: "IDFA-1", vendor_id: "IDFV-1" });

    const transfer = {
      id: "ev-2",
      type: "TRANSFER",
      app_user_id: UID,
      user_id: UID,
      aliases: [] as string[],
      ids_anonimos: ["$RCAnonymousID:abc"],
      store: "APP_STORE",
      payload: { transferred_from: ["$RCAnonymousID:abc"], transferred_to: [UID] },
      received_at: "2026-10-09T16:00:00.000Z",
    };
    const norm = normalizarEvento(transfer);
    expect(norm.transferred_from).toEqual(["$RCAnonymousID:abc"]);
    expect(norm.ids_anonimos).toEqual(["$RCAnonymousID:abc"]);
    const mapa = chavesPorUsuarioCore([normalizarEvento(row), norm]);
    expect(mapa.get(UID)).toEqual(expect.arrayContaining(["otx-1", "tx-trial"]));

    const assinatura: AssinaturaLoja = {
      user_id: UID,
      revenuecat_subscription_id: "sub_abc",
      created_at: "2026-10-09T15:00:00.000Z",
      current_period_start: "2026-10-09T15:00:00.000Z",
      current_period_end: "2026-10-12T15:00:00.000Z",
      billing_period: "annual",
    };
    const faltantes = listarFaltantes({
      assinaturas: [assinatura],
      eventos: [row, transfer],
      marcadores: [{ event_name: MARCADOR_TRIAL, tx: "sub_abc" }],
      agora: AGORA,
    });
    expect(faltantes.find((f) => f.tx === "otx-1" || f.tx === "sub_abc")).toBeUndefined();
  });

  it("a migration não abre schema paralelo em cima da tabela viva", () => {
    const sql = fonte("supabase/migrations/20261010140000_meta_capi_anon_sinais.sql");
    const eventos = sql.slice(0, sql.indexOf("app_capi_sinais"));
    expect(sql).not.toMatch(/rc_event_id/);
    expect(sql).not.toMatch(/event_type/);
    expect(sql).not.toMatch(/price_cents/);
    expect(eventos).not.toMatch(/^\s*id uuid/m);
    expect(eventos).not.toMatch(/ADD COLUMN/);
    expect(sql).toMatch(/to_regclass\('public\.revenuecat_events'\)/);
    expect(sql).toMatch(/id text PRIMARY KEY/);
    expect(sql).toMatch(/aliases text\[\]/);
    expect(sql).toMatch(/ids_anonimos text\[\]/);
    expect(sql).toMatch(/app_capi_sinais/);
    expect(sql).toMatch(/meta-varredura-enviado/);
    expect(sql).toMatch(/\{"modo":"varredura"\}/);
  });
});
