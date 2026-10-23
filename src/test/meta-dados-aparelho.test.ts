/**
 * Dados do aparelho pro CAPI do app (iOS 1.0.17) — regras puras do servidor
 * (supabase/functions/_shared/meta-dados-aparelho.ts). Arquivo IGUAL nos
 * ramos v1017-int (revenuecat-sync escreve) e meta-capi-dados
 * (meta-backfill-app lê).
 *
 * O que não pode escorregar: IP, user-agent, IDFA e advertiser_tracking_enabled=1
 * só com ATT "authorized" — na gravação E no envio.
 */
import { describe, expect, it } from "vitest";
import {
  dadosDaTransacao,
  dadosDoPedido,
  dadosInferidosDaFicha,
  dentroDaJanela,
  ipDoCabecalho,
  linhaDadosAparelho,
  precisaGravar,
  sinaisPrivacidade,
  versoesParaExtinfo,
  RETENCAO_DADOS_MS,
  type LinhaDadosAparelho,
} from "../../supabase/functions/_shared/meta-dados-aparelho";

const IDFA = "6D92078A-8246-4BA4-AE5B-76104861E7DC";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const CAB = { xff: "177.10.20.30, 10.0.0.1", cf: null, ua: UA };
const AGORA = Date.parse("2026-10-20T15:00:00Z");

describe("dadosDoPedido (revenuecat-sync)", () => {
  it("autorizado: IP do 1º salto do x-forwarded-for, UA do header e IDFA do corpo", () => {
    const d = dadosDoPedido({ plataforma: "ios", att: "authorized", idfa: IDFA, app_versao: "1.0.17", app_build: "44", os_versao: "18.6" }, CAB);
    expect(d).toEqual({
      plataforma: "ios", att: "authorized", att_origem: "app", app_versao: "1.0.17", app_build: "44", os_versao: "18.6",
      idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA,
    });
  });

  it.each(["denied", "restricted", "notDetermined", "unknown", "qualquer"])("%s: sem IP, sem UA, sem IDFA — mesmo que o corpo mande", (att) => {
    const d = dadosDoPedido({ plataforma: "ios", att, idfa: IDFA, client_ip: "1.2.3.4" }, CAB);
    expect(d?.idfa).toBeNull();
    expect(d?.client_ip).toBeNull();
    expect(d?.user_agent).toBeNull();
    expect(d?.att).toBe(att === "qualquer" ? "unknown" : att);
  });

  it("IP nunca vem do corpo", () => {
    const d = dadosDoPedido({ plataforma: "ios", att: "authorized", client_ip: "9.9.9.9" }, { xff: null, cf: null, ua: UA });
    expect(d?.client_ip).toBeNull();
    expect(d?.user_agent).toBeNull(); // sem IP não guarda UA sozinho (a Meta só usa em par)
  });

  it("cf-connecting-ip na falta do x-forwarded-for; IP inválido não entra", () => {
    expect(ipDoCabecalho(null, "2804:14c:1::1")).toBe("2804:14c:1::1");
    expect(ipDoCabecalho("127.0.0.1", null)).toBeNull();
    expect(ipDoCabecalho("lixo", null)).toBeNull();
  });

  it("Android, web, corpo ausente ou estranho: null (nada muda)", () => {
    expect(dadosDoPedido({ plataforma: "android", att: "authorized" }, CAB)).toBeNull();
    expect(dadosDoPedido(null, CAB)).toBeNull();
    expect(dadosDoPedido("ios", CAB)).toBeNull();
    expect(dadosDoPedido([], CAB)).toBeNull();
  });

  it("IDFA zerado/malformado e versão com lixo ficam de fora", () => {
    const d = dadosDoPedido({ plataforma: "ios", att: "authorized", idfa: "00000000-0000-0000-0000-000000000000", app_versao: "<script>" }, CAB);
    expect(d?.idfa).toBeNull();
    expect(d?.app_versao).toBeNull();
  });
});

describe("gravação: uma linha por mudança, só dentro da janela", () => {
  const aut = dadosDoPedido({ plataforma: "ios", att: "authorized", idfa: IDFA }, CAB)!;
  const neg = dadosDoPedido({ plataforma: "ios", att: "denied" }, CAB)!;

  it("primeira vez grava; mesmo status não regrava (o sync roda em toda abertura)", () => {
    expect(precisaGravar(null, aut)).toBe(true);
    expect(precisaGravar({ att: "authorized", idfa: IDFA, client_ip: "177.10.20.30" }, aut)).toBe(false);
    expect(precisaGravar({ att: "denied" }, neg)).toBe(false);
  });

  it("mudou o ATT (aceitou ou revogou) grava de novo", () => {
    expect(precisaGravar({ att: "denied" }, aut)).toBe(true);
    expect(precisaGravar({ att: "authorized", idfa: IDFA, client_ip: "1.1.1.1" }, neg)).toBe(true);
  });

  it("autorizado sem IP/IDFA na linha anterior completa quando chegar", () => {
    expect(precisaGravar({ att: "authorized", idfa: null, client_ip: null }, aut)).toBe(true);
  });

  it("a linha sem aceite nunca carrega IP/UA/IDFA; vence em 10 dias", () => {
    const l = linhaDadosAparelho("u1", "sub_1", { ...neg, idfa: IDFA, client_ip: "1.1.1.1", user_agent: UA }, AGORA);
    expect(l).toMatchObject({ user_id: "u1", tx: "sub_1", att: "denied", idfa: null, client_ip: null, user_agent: null });
    expect(Date.parse(String(l.expira_em))).toBe(AGORA + RETENCAO_DADOS_MS);
    expect(linhaDadosAparelho("u1", "sub_1", aut, AGORA)).toMatchObject({ idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA });
  });

  it("janela: assinatura de até 10 dias; antiga ou sem data não grava", () => {
    expect(dentroDaJanela(new Date(AGORA - 3 * 86_400_000).toISOString(), AGORA)).toBe(true);
    expect(dentroDaJanela(new Date(AGORA - 30 * 86_400_000).toISOString(), AGORA)).toBe(false);
    expect(dentroDaJanela(null, AGORA)).toBe(false);
  });
});

describe("dadosDaTransacao (meta-backfill-app)", () => {
  const linha = (o: Partial<LinhaDadosAparelho>): LinhaDadosAparelho => ({
    tx: "sub_1", att: "authorized", idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA,
    created_at: "2026-10-20T12:00:00Z", expira_em: "2026-10-30T12:00:00Z", ...o,
  });

  it("a mais recente vence (revogou depois do teste → denied)", () => {
    const d = dadosDaTransacao([
      linha({}),
      linha({ att: "denied", idfa: null, client_ip: null, user_agent: null, created_at: "2026-10-20T14:00:00Z" }),
    ], ["sub_1"], AGORA);
    expect(d?.att).toBe("denied");
  });

  it("casa por qualquer chave da transação; vencida ou de outra tx não serve", () => {
    expect(dadosDaTransacao([linha({ tx: "orig_9" })], ["sub_1", "orig_9"], AGORA)?.tx).toBe("orig_9");
    expect(dadosDaTransacao([linha({ expira_em: "2026-10-19T00:00:00Z" })], ["sub_1"], AGORA)).toBeNull();
    expect(dadosDaTransacao([linha({ tx: "sub_2" })], ["sub_1"], AGORA)).toBeNull();
    expect(dadosDaTransacao([linha({})], [], AGORA)).toBeNull();
  });
});

describe("sinaisPrivacidade — o que vai pra Meta", () => {
  const autorizada: LinhaDadosAparelho = { tx: "sub_1", att: "authorized", idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA };
  const negada: LinhaDadosAparelho = { tx: "sub_1", att: "denied", idfa: null, client_ip: null, user_agent: null };
  const parLegado = { client_ip_address: "8.8.8.8", client_user_agent: UA };

  it("iPhone autorizado: ate 1, madid = IDFA (minúsculo), IP+UA da linha", () => {
    expect(sinaisPrivacidade({ ios: true, dados: autorizada, madidAtual: null, parSinal: parLegado, vendorId: "v" })).toEqual({
      ate: 1,
      madid: IDFA.toLowerCase(),
      ipUa: { client_ip_address: "177.10.20.30", client_user_agent: UA },
      vendorId: "v",
      fonte: "ios_autorizado",
    });
  });

  it("iPhone sem aceite: ate 0 e NADA de madid/IP/UA/vendor_id — nem os que vierem da ficha, do RC ou do app_capi_sinais", () => {
    expect(sinaisPrivacidade({ ios: true, dados: negada, madidAtual: "idfa-velho", parSinal: parLegado, vendorId: "v" })).toEqual({
      ate: 0, madid: null, ipUa: null, vendorId: null, fonte: "ios_sem_aceite",
    });
  });

  it("iPhone: a ficha diz denied e não há linha → sem aceite", () => {
    expect(sinaisPrivacidade({ ios: true, dados: null, attFicha: "denied", madidAtual: "x", parSinal: parLegado }).fonte).toBe("ios_sem_aceite");
  });

  it("iPhone: a linha da transação vence a ficha", () => {
    expect(sinaisPrivacidade({ ios: true, dados: negada, attFicha: "authorized", madidAtual: "x" }).ate).toBe(0);
    expect(sinaisPrivacidade({ ios: true, dados: autorizada, attFicha: "denied", madidAtual: null }).ate).toBe(1);
  });

  it("iPhone autorizado só pela ficha (sem linha): madid da ficha, mas sem IP/UA", () => {
    const s = sinaisPrivacidade({ ios: true, dados: null, attFicha: "authorized", madidAtual: "AA-BB", parSinal: parLegado });
    expect(s).toMatchObject({ ate: 1, madid: "aa-bb", ipUa: null, fonte: "ios_autorizado" });
  });

  it("iPhone de build antiga (sem status nenhum): como hoje, sem IP/UA/vendor_id; ate segue o madid", () => {
    expect(sinaisPrivacidade({ ios: true, dados: null, madidAtual: null, parSinal: parLegado, vendorId: "v" })).toEqual({
      ate: 0, madid: null, ipUa: null, vendorId: null, fonte: "ios_sem_dados",
    });
    expect(sinaisPrivacidade({ ios: true, dados: null, madidAtual: "id", parSinal: parLegado }).ate).toBe(1);
  });

  it("autorizado com IP sem UA na linha: não manda o IP sozinho", () => {
    expect(sinaisPrivacidade({ ios: true, dados: { ...autorizada, user_agent: null }, madidAtual: null }).ipUa).toBeNull();
  });

  it("Android: igual a hoje (GAID e o par do app_capi_sinais)", () => {
    expect(sinaisPrivacidade({ ios: false, dados: null, madidAtual: "GAID-1", parSinal: parLegado, vendorId: null })).toEqual({
      ate: 1, madid: "gaid-1", ipUa: parLegado, vendorId: null, fonte: "android",
    });
    expect(sinaisPrivacidade({ ios: false, dados: null, madidAtual: null }).ate).toBe(0);
  });
});

describe("atalho da build antiga (≤ 1.0.16, corpo sem `aparelho`): ATT inferido pelo IDFA da ficha", () => {
  // Ficha app_device_info como a 1.0.16 grava: no iPhone o IDFA vai no campo `gaid`, só com ATT aceito.
  const ficha = (o: Record<string, unknown> = {}) => ({
    plataforma: "ios", pacote: "br.com.coreaplicativo.app", versao: "1.0.16", build: "41", os: "18.6", modelo: "iPhone", ...o,
  });

  it("ficha com IDFA → authorized inferido, gravado com IP (1º salto) + UA + IDFA", () => {
    const d = dadosInferidosDaFicha(ficha({ gaid: IDFA }), CAB);
    expect(d).toEqual({
      plataforma: "ios", att: "authorized", att_origem: "inferido_idfa", app_versao: "1.0.16", app_build: "41", os_versao: "18.6",
      idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA,
    });
    expect(linhaDadosAparelho("u1", "sub_1", d!, AGORA)).toMatchObject({
      att: "authorized", att_origem: "inferido_idfa", idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA,
    });
  });

  it("ficha sem IDFA → unknown, sem IP/UA/IDFA na linha", () => {
    const d = dadosInferidosDaFicha(ficha(), CAB)!;
    expect(d).toMatchObject({ att: "unknown", att_origem: "inferido_idfa", idfa: null, client_ip: null, user_agent: null });
    expect(linhaDadosAparelho("u1", "sub_1", d, AGORA)).toMatchObject({ att: "unknown", idfa: null, client_ip: null, user_agent: null });
  });

  it.each([
    ["zerado", "00000000-0000-0000-0000-000000000000"],
    ["vazio", ""],
    ["malformado", "nao-e-uuid"],
  ])("IDFA %s não conta como aceite", (_n, gaid) => {
    const d = dadosInferidosDaFicha(ficha({ gaid }), CAB)!;
    expect(d.att).toBe("unknown");
    expect(d.client_ip).toBeNull();
    expect(d.user_agent).toBeNull();
    expect(d.idfa).toBeNull();
  });

  it("ficha de Android (GAID), sem ficha ou ficha estranha → null (não grava, como antes)", () => {
    expect(dadosInferidosDaFicha({ plataforma: "android", gaid: IDFA }, CAB)).toBeNull();
    expect(dadosInferidosDaFicha(null, CAB)).toBeNull();
    expect(dadosInferidosDaFicha({ gaid: IDFA }, CAB)).toBeNull();
    expect(dadosInferidosDaFicha([], CAB)).toBeNull();
  });

  it("revogou o ATT depois: a linha unknown nova é gravada e desfaz o authorized inferido", () => {
    const antes = linhaDadosAparelho("u1", "sub_1", dadosInferidosDaFicha(ficha({ gaid: IDFA }), CAB)!, AGORA);
    const depois = dadosInferidosDaFicha(ficha(), CAB)!;
    expect(precisaGravar(antes, depois)).toBe(true);
    expect(precisaGravar(antes, dadosInferidosDaFicha(ficha({ gaid: IDFA }), CAB)!)).toBe(false);
  });

  it("1.0.17 (corpo com `aparelho`) segue igual: authorized/denied do app, origem app", () => {
    const aut = dadosDoPedido({ plataforma: "ios", att: "authorized", idfa: IDFA }, CAB)!;
    const neg = dadosDoPedido({ plataforma: "ios", att: "denied", idfa: IDFA }, CAB)!;
    expect(aut).toMatchObject({ att: "authorized", att_origem: "app", idfa: IDFA, client_ip: "177.10.20.30", user_agent: UA });
    expect(neg).toMatchObject({ att: "denied", att_origem: "app", idfa: null, client_ip: null, user_agent: null });
    expect(linhaDadosAparelho("u1", "sub_1", neg, AGORA)).toMatchObject({ att_origem: "app", client_ip: null });
  });

  it("meta-backfill-app: authorized inferido manda ate 1 + madid + IP/UA (a origem não muda nada)", () => {
    const linha = {
      ...linhaDadosAparelho("u1", "sub_1", dadosInferidosDaFicha(ficha({ gaid: IDFA }), CAB)!, AGORA),
      created_at: new Date(AGORA).toISOString(),
    } as LinhaDadosAparelho;
    const dados = dadosDaTransacao([linha], ["sub_1"], AGORA);
    expect(dados?.att_origem).toBe("inferido_idfa");
    expect(sinaisPrivacidade({ ios: true, dados, madidAtual: null, vendorId: "v" })).toEqual({
      ate: 1,
      madid: IDFA.toLowerCase(),
      ipUa: { client_ip_address: "177.10.20.30", client_user_agent: UA },
      vendorId: "v",
      fonte: "ios_autorizado",
    });
  });

  it("meta-backfill-app: unknown inferido = como build antiga sem dados (sem IP/UA)", () => {
    const linha = {
      ...linhaDadosAparelho("u1", "sub_1", dadosInferidosDaFicha(ficha(), CAB)!, AGORA),
      created_at: new Date(AGORA).toISOString(),
    } as LinhaDadosAparelho;
    const s = sinaisPrivacidade({ ios: true, dados: dadosDaTransacao([linha], ["sub_1"], AGORA), madidAtual: null, parSinal: { client_ip_address: "8.8.8.8", client_user_agent: UA } });
    expect(s).toMatchObject({ ate: 0, madid: null, ipUa: null, fonte: "ios_sem_dados" });
  });
});

describe("versoesParaExtinfo", () => {
  it("a ficha vence; a linha do sync preenche o que faltar", () => {
    expect(versoesParaExtinfo({ versao: "1.0.16", build: "", os: "" }, { app_versao: "1.0.17", app_build: "44", os_versao: "18.6" }))
      .toEqual({ versao: "1.0.16", build: "44", os: "18.6" });
    expect(versoesParaExtinfo({}, null)).toEqual({ versao: "", build: "", os: "" });
  });
});
