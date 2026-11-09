/**
 * O COMPORTAMENTO DA LANDING NOVA (/organizar, 28/10 — desligada; ver o cabeçalho do /landing.html). Vanilla, sem
 * React: a página inteira já veio pintada no HTML; isto só liga os toques, a demo, a medição e o Pix.
 *
 *   topo      "Por onde você quer começar?" → marca a área, rola até a demo e abre a demo no módulo da área
 *   demo      iframe /organizar/demo?m=… (o app de verdade, mesma origem) — começa a baixar DEPOIS da 1ª pintura
 *             (load + ocioso; ou já no 1º toque numa área). Até a demo avisar "landing:pronta", a imagem leve do
 *             módulo ocupa a MESMA caixa (sem CLS). Pílulas e a grade dos 16 trocam o módulo por postMessage.
 *   oferta    braço "ano" (+ caixinha desmarcada "pra sempre") ou "sempre" (decidido no <head>); o Pix sai NA PÁGINA:
 *             "Gerando o seu Pix…" → QR + código JÁ COPIADO → "esta tela confirma sozinha" → pago → e-mail → conta →
 *             "Abrir meu CORE" + selos das lojas. Nenhum upsell.
 *   fixo      o botão do rodapé só aparece depois que a pessoa passou pela demo (e some com a oferta/fim na tela).
 *
 * PIX_REAL = false (protótipo): as ofertas LN_* ainda não existem nas funções no ar. Fora do domínio de produção o Pix
 * é SIMULADO (mesmas telas; "Já paguei" confirma; e-mail com "+existe" simula conta existente, código 12345678). No
 * domínio de produção com PIX_REAL false, o botão avisa que o pagamento desta página ainda não está ligado.
 *
 * Eventos (analytics_events, mesmo endpoint/chave anon do /missao; SÓ no domínio de produção; no dev ficam em
 * window.__eventosLanding). Todos levam landing_session_id, braco_titulo, braco_oferta, utm_*, ad ids, plataforma.
 *   landing_html {tela1_ms, ttfb_ms, forcados, divisao}   · landing_bloco {bloco}  (1x por bloco visto)
 *   landing_area {area, modulo}                           · landing_demo_aberta {modulo, via}
 *   landing_demo_pronta {modulo, ms_desde_html}           · landing_demo_modulo {modulo, via: pilula|grade|dentro|area}
 *   landing_demo_mexeu {modulo}                           · landing_demo_saida {destino}
 *   landing_oferta_vista {}                               · landing_caixinha {marcada}
 *   landing_cta {onde}                                    · landing_pix_gerado {oferta, valor, order_id, simulado}
 *   landing_pix_copiado {ok, via}                         · landing_pix_pago {oferta, valor, order_id}
 *   landing_email_pix {ok, via}                           · landing_email {via}   · landing_abrir_core {}
 *   landing_loja {loja, onde}                             · landing_erro {onde, msg}
 *   (29/10) landing_duvida_aberta {pergunta}              · landing_voltou {fase, ausente_s, com_pix}  (aba visível de novo, ≥5 s fora)
 *   (29/10) landing_ja_tem {via: marcador|servidor|email_pix} · landing_ja_tem_nao_fui_eu {}
 *   (29/10) todo evento leva landing_device_id (id aleatório estável do aparelho, cookie + localStorage — ./marcador.ts)
 *   (29/10) todo evento leva braco_checkout ("livre" | "email" — AB_CHECKOUT no <head>). No braço "email":
 *           landing_email_antes_visto {} (1x, junto da oferta) · landing_email_antes_ok {via: nova|mesma_conta|codigo}
 *           landing_email_antes_erro {motivo: vazio|invalido|sessao|outra_conta|falhou|tem_conta|codigo_errado|codigo_nao_enviado}
 *           landing_email_antes_sugestao {} (tocou no "Você quis dizer …?")
 *   (29/10) landing_lembrete_volta {toque: t12|t20h, order_id, restaurado: aba|link|nao} — chegou pelo e-mail de lembrete do Pix
 *   (30/10) todo evento leva braco_lp ("atual" | "v2" — AB_LP no <head>). landing_cta {onde:"topo"} = o botão da vitrine (v2);
 *           landing_demo_aberta {via: fundo|perto|botao|area|pilula|grade}; landing_erro {onde:"chunk_pagamento", tentativa}
 *   (30/10, crítica r1 do v3, só v2) landing_cta leva {fase}; landing_lojas_topo {} (toque em "App Store · Google Play · Computador"
 *           da 1ª tela → rola até "Sim, é um app de verdade"); landing_pix_venceu {order_id, via: relogio|recarga} (o relógio do QR
 *           chegou a zero / a pessoa voltou com o código já vencido — r3: 1× por pedido);
 *           landing_fita só com ≥ 60% por ≥ 500 ms (a rolagem suave do botão do topo não conta)
 * (30/10) NOS DOIS BRAÇOS, sem mudança visual: o pixel da Meta entra no 1º quadro + ocioso (≤ ~1,5 s; reserva 2,5 s) em vez de
 *   load + 800 ms (o PageView saía em 4–8 s num Android lento e a Meta contava "27% dos cliques não carregam"); o iframe da
 *   demo (4–5 MB) só começa DEPOIS do pixel (ou quando a demo entra ≥ 25% na tela, ou no 1º toque) — no braço v2, SÓ no toque
 *   ("Testar o app", pílula ou grade); o chunk do Pix tem 2ª chance + recarga (./carregar.ts).
 * BRAÇO v2 (30/10, html[data-lp="v2"]) = v3 "produto em uso" (SINTESE.md em novidades-guardadas/2026-10-30/lp-v3): 1ª tela com UM
 *   celular real (a Home do dia) + preço + botão "Quero organizar minha vida"; "Por dentro" com 3 painéis (os 16 no celular, Finanças
 *   com o card R$ 146, Rotina); a ordem dos blocos por CSS; o botão fixo aparece quando o botão do topo sai da tela; a tela do Pix
 *   com 3 passos + QR e código lado a lado + "Pagou? Volte aqui"; pós-compra com os selos das lojas primeiro, e-mail em caixa e o
 *   1º passo. O braço "atual" é a página de hoje, byte a byte (teste landing-v2.test.ts).
 * E-mail ANTES do Pix (29/10, braço "email"): o campo fica acima do botão (no HTML, escondido pelo CSS no braço "livre" —
 * a página do "livre" é IGUAL à de hoje). Ao tocar em pagar: e-mail → sessão anônima (updateUser) → Pix. E-mail que já
 * tem conta → código do e-mail → entra na conta → Pix nela (conta com vitalício → "Você já tem o CORE"). Na tela do QR,
 * no lugar do e-mail opcional: "Pagou e a página fechou? O acesso chega em <e-mail>".
 * "Já comprou" (29/10, ./marcador.ts): ao confirmar o pagamento grava um marcador (cookie de 400 dias no domínio + localStorage);
 * com ele a página abre com "Você já tem o CORE" + Abrir meu CORE + lojas no lugar da oferta. O servidor também recusa o
 * Pix (`ja_tem`) de quem já tem o CORE pra sempre. Quem nunca comprou vê a página IGUAL (nada muda no HTML nem no 1º render).
 * Pixel: PageView (no HTML) · ViewContent 1x na oferta · InitiateCheckout no Pix gerado · Purchase pelo pagamento.ts
 * (firePixPurchaseOnce, mesmo id da CAPI do servidor).
 * (31/10) "SEU 2027 ORGANIZADO" R$ 19,90 no pós-pago, NOS DOIS BRAÇOS (chave UPSELL_2027 no <head>, padrão "off" → html[data-u2027]
 *   só existe ligada; QA ?u2027=on|off, ?u2027=auto desfaz): quando a conta final fica pronta, o cartão mostra a oferta NO LUGAR de
 *   "Sua conta está pronta" (nunca no "Você já tem o CORE"); "Agora não"/Continuar → a conta pronta de sempre, com as lojas. O módulo
 *   (./upsell-2027.ts) só baixa com a chave ligada ou pelo link do e-mail de compra confirmada (?r=u2027, que reabre o MESMO Pix).
 *   Com a chave desligada e sem ?r=u2027, nada aqui roda (o braço atual fica igual). Sem pixel no upsell.
 * (06/11) A/B DA PÁGINA DA /oferta (AB_OFERTA_LP no <head> → html[data-lpo="atual"|"nova"]): todo evento da /oferta leva braco_lp_oferta +
 * lpo_forcado. "nova" = <template id="lpo-nova"> + ./oferta-nova.ts: blocos com os mesmos data-bloco, todo botão abre o checkout direto
 * (landing_cta {onde:"stripe", de:"topo"|"oferta"|"fim"|"fixo"}), sem demo. O checkout e o pós-compra são os mesmos.
 *
 * (02/11) A/B DA TELA DO PIX (AB_PIX no <head> → html[data-pix="atual"|"b"]; todo evento leva braco_pix). Braço "b" = "Recibo da
 *   marca" (htmlPixB; só a fase `qr`): marca + nº do pedido, preço, passo acima do botão, pílula de status, recibo (No banco aparece /
 *   Garantia / Acesso), QR dobrado, estado "voltou do banco" (landing_pix_volta_vista {order_id, via}; chips landing_pix_motivo
 *   {order_id, motivo} só com PIX_MOTIVO) e "Conferindo com o banco…" (2,5 min). O braço "atual" é a tela de hoje, byte a byte.
 *   MEDIÇÃO nos DOIS braços: landing_pix_saiu {s_na_tela, vez, order_id} (aba escondeu com QR sem pagar) · landing_voltou ganha
 *   {order_id, via: aba|recarga} (a volta por recarga era invisível) · landing_pix_ja_paguei {order_id, resultado: pago|nao} ·
 *   landing_pix_copiar_manual {order_id, ok} (o toque, separado do auto) · landing_pix_rolou {order_id} (1× por pedido, ≥ 40 px) ·
 *   landing_pix_abandono {s_total, saidas, order_id} (pagehide com QR sem pagar) · landing_pix_qr_aberto {order_id} (só b).
 */
import {

  EMAIL_OK, MODULO_DA_AREA, NOME_DO_MODULO, ROTULO_OFERTA, VALOR_OFERTA, URL_APP_STORE,
  bracoCheckoutDoHtml, bracoLpDoHtml, bracoLpOfertaDoHtml, bracoPixDoHtml, motivoPixDoHtml, NOME_NO_BANCO, CNPJ_NO_BANCO, checarEmailAntes, sugestaoDeEmail, voltaDoLembrete, upsell2027DoHtml, voltaDoEmailU2027, upsellPosDoHtml, ehPraSempreOferta,
  ESTADO_VAZIO, bracoOfertaDoHtml, bracoTituloDoHtml, ehArea, ehModuloLanding, estadoQueVolta, mmss, ofertaEscolhida, reais, urlPlay, venceEm,
  type Area, type EstadoLanding, type MensagemDaDemo, type ModuloLanding, type OfertaLanding, type PixLanding, type PixU2027,
} from "./regras";
import { ligarOfertaNova, preaquecerStripe, sairDaOfertaNova } from "./oferta-nova";
import { lerEstadoU2027, lerU2027Guardado } from "./u2027-estado";
import { lerEstadoPresenteLp } from "./presente-estado";
import { esquecerCompra, esquecerPixVivo, fixarAparelho, gravarCookie, gravarPixVivo, idDoAparelho, lerCompra, lerCookie, lerPixVivo, marcarCompra, temSessaoNoStorage, type MarcaCompra } from "./marcador";
import { carregarComRetry, criarCarregadorCompartilhado } from "./carregar";
import { capturarAtribuicao, linkPlayAtribuido, linkAppleAtribuido, ondeLinkLoja } from "./atribuicao";
import { REF_OK, checkoutExtDoHtml, paginaDoHtml, pkStripeValida, reaisDeCentavos, urlCheckoutHotmart, urlHotmartValida } from "./hotmart";

// o Pix de verdade carrega sob demanda — declarado antes do observador dos blocos, que pode pré-aquecê-lo (com PIX_REAL).
// 30/10: com 2ª chance; o pré-aquecimento (recarregar=false) nunca recarrega a página — só o toque em pagar.
const pg = criarCarregadorCompartilhado(() => import("./pagamento"), {
  aoFalhar: (tentativa, erro) => evento("landing_erro", { onde: "chunk_pagamento", tentativa, msg: String(erro).slice(0, 120) }),
});

/** O Pix de verdade (asaas-pix com as ofertas LN_*). Só ligar DEPOIS do deploy das funções (RELATORIO). */
export const PIX_REAL = true; // 28/10 16h06: funções no ar com as ofertas LN_* (pix-reconcile v45, asaas-webhook v44, asaas-pix v46, pix-vincular v10)

const PRODUCAO = /(^|\.)coreaplicativo\.com\.br$/.test(location.hostname);
// fora do domínio de produção (dev, preview, testes) o Pix é SEMPRE simulado; no domínio, de verdade se PIX_REAL
const SIMULADO = !PRODUCAO;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const agora = () => Math.round(performance.now());
type Janela = Window & {
  __landingCliqueLoja?: (e: MouseEvent) => void;
  __landingSimularJaTem?: boolean;
  __landing?: { lpo_forcado?: boolean; lpo_link?: boolean; ab_lp_oferta?: string; lpo_stripe_cedo?: string; pagina?: string; checkout_ext?: string; hotmart_url?: string; hotmart_preco_centavos?: number; hotmart_parcelas?: string; hotmart_forcado?: boolean; vida_forcado?: boolean; stripe_pk?: string; stripe_preco_centavos?: number; stripe_parcelas?: string; stripe_parcelas_max?: number; stripe_pede_cpf?: boolean; t?: string; oferta?: string; t_forcado?: boolean; oferta_forcada?: boolean; checkout_forcado?: boolean; lp_forcado?: boolean; pix_forcado?: boolean; divisao?: string | null };
  __eventosLanding?: Record<string, unknown>[];
  /** 02/11 (dev/testes): voltou() = "voltei do banco" (≥ 5 s fora) sem trocar de aba; vencer() = o QR vence em 1,5 s */
  __landingSimular?: { pagar: () => void; pagarU2027?: () => void; voltou?: () => void; vencer?: () => void };
  /** 02/11 (dev/testes): o "Já paguei" simulado NÃO confirma (o caminho do Asaas atrasado / de quem não pagou) */
  __landingSimularPixNaoCaiu?: boolean;
  /** 31/10 (dev/testes): o Pix simulado do 2027 falha / sai pra outra conta / sem sessão (o link do e-mail noutro navegador) */
  __landingSimularU2027?: { falhar?: boolean; outraConta?: boolean; semSessao?: boolean };
  /** 30/10: diagnóstico de tempo (medição de desempenho; nada vai pro banco por aqui) */
  __landingDiag?: { terceirosEm: number | null; demoEm: number | null; demoVia: string | null };
  fbq?: (...a: unknown[]) => void;
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
};
const w = window as Janela;
const listaDeEventos = (w.__eventosLanding = w.__eventosLanding || []); // a lista desta página (o teste cria outra a cada página)
const diag = { terceirosEm: null as number | null, demoEm: null as number | null, demoVia: null as string | null };
w.__landingDiag = diag;

/* ───────────────────────── a URL do anúncio fica no heap (o Instagram zera o storage, a URL não) ───────────────────────── */
const URL_DE_CHEGADA = location.href;
const BUSCA = new URLSearchParams(location.search);
/** 31/10 (dono testando no iPhone: "testei e não apareceu" — o celular lembrava a compra simulada de um teste antes e pulava
 *  pra conta pronta): só no simulado, ?zerar=1 apaga a compra, o Pix vivo e o resto desta página no aparelho e recarrega
 *  sem o parâmetro. Em produção não existe. */
if (SIMULADO && BUSCA.get("zerar") === "1") {
  try { esquecerCompra(); esquecerPixVivo(); } catch { /* noop */ }
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  try { for (const c of document.cookie.split(";")) { const n = c.split("=")[0].trim(); if (n) document.cookie = `${n}=; max-age=0; path=/`; } } catch { /* noop */ }
  BUSCA.delete("zerar");
  location.replace(`${location.pathname}${BUSCA.toString() ? `?${BUSCA}` : ""}${location.hash}`);
}
/** 31/10 (crítica r1 técnico MEDIA 4): só no simulado — ?simconta=ms atrasa a "conta pronta" (o finalizarConta de verdade
 *  leva 1–3 s), pra testar o caminho de produção do 2027 antecipado no navegador. Em produção não existe. */
const SIM_CONTA_MS = SIMULADO ? Math.min(20_000, Math.max(0, Number(BUSCA.get("simconta")) || 0)) : 0;
const brTitulo = bracoTituloDoHtml();
const brOferta = bracoOfertaDoHtml();
const brCheckout = bracoCheckoutDoHtml(); // 29/10: "livre" (o de hoje) | "email" (e-mail antes do Pix)
const brLp = bracoLpDoHtml(); // 30/10: "atual" (a página de hoje) | "v2" (vitrine)
const V2 = brLp === "v2";
const brPix = bracoPixDoHtml(); // 02/11: "atual" (a tela do Pix de hoje) | "b" ("Recibo da marca" — AB_PIX no <head>)
const PIXB = brPix === "b";
/* 04/11: /vida (a v3 num link próprio — ./hotmart.ts). PAGINA só existe na /vida; HOTMART = o botão vai pro checkout Hotmart
 * (chave CHECKOUT_HOTMART "on" e URL de verdade). No /organizar os dois ficam null/false e nada abaixo muda. */
const PAGINA = paginaDoHtml();
const EXT = PAGINA ? checkoutExtDoHtml() : null;
const HM_URL = String(w.__landing?.hotmart_url ?? "");
const HOTMART = PAGINA === "vida" && EXT === "hotmart" && urlHotmartValida(HM_URL);
const HM_PRECO = Number(w.__landing?.hotmart_preco_centavos) > 0 ? Number(w.__landing?.hotmart_preco_centavos) : 9790;
const HM_PARCELAS = typeof w.__landing?.hotmart_parcelas === "string" ? w.__landing.hotmart_parcelas : "";
/* 04/11: /oferta (Stripe, ./stripe-checkout.ts): a página atual a R$ 67,90 com o checkout em tela cheia. STRIPE só com a chave e a
 * pk de verdade (o <head> já mandou pro /organizar se não). EXTERNO = checkout de fora (Hotmart ou Stripe): some o Pix da página. */
const ST_PK = String(w.__landing?.stripe_pk ?? "");
const STRIPE = PAGINA === "oferta" && EXT === "stripe" && pkStripeValida(ST_PK);
const ST_PRECO = Number(w.__landing?.stripe_preco_centavos) > 0 ? Number(w.__landing?.stripe_preco_centavos) : 6790;
const ST_PARCELAS = typeof w.__landing?.stripe_parcelas === "string" ? w.__landing.stripe_parcelas : "";
const EXTERNO = HOTMART || STRIPE;
const PRECO_EXT = STRIPE ? ST_PRECO : HM_PRECO;
const PARCELAS_EXT = STRIPE ? ST_PARCELAS : HM_PARCELAS;
/** 04/11: o braço da /vida (AB_VIDA no <head>): "v3" (a LP v3) | "atual" (a página do /organizar com a Hotmart). Só na /vida. */
const BRACO_VIDA = PAGINA === "vida" ? (document.documentElement.getAttribute("data-vida") === "atual" ? "atual" : "v3") : null;
/** o botão da Hotmart do braço na tela (v2: "Quero organizar minha vida"; atual: "Quero organizar tudo") */
const ID_BOTAO_HM = V2 ? "lp-hotmart" : "lp-hotmart-atual";
const ROTULO_BOTAO_HM = V2 ? "Quero organizar minha vida" : "Quero organizar tudo";
/** 06/11: o braço da PÁGINA da /oferta (AB_OFERTA_LP no <head>). LPO_ATIVO = o teste está valendo (chave on ou ?lpo=): só aí o braço vai
 *  pra metadata do PI e pro Purchase do navegador. Com a chave off, a /oferta só ganha os 2 campos nos eventos landing_*. */
const BRACO_LP_OFERTA = PAGINA === "oferta" ? bracoLpOfertaDoHtml() : null;
const LPO_NOVA = STRIPE && BRACO_LP_OFERTA === "nova";
const LPO_FORCADO = !!w.__landing?.lpo_forcado;
/** 07/11: o /vitalicio é a página nova num link próprio (sempre "nova"): conta como teste ativo pra o braço ir pro PI e pro Purchase. */
const LPO_LINK = !!w.__landing?.lpo_link;
const LPO_ATIVO = STRIPE && (w.__landing?.ab_lp_oferta === "on" || LPO_FORCADO || LPO_LINK);
const PIX_MOTIVO = motivoPixDoHtml(); // 02/11: chips "O que te travou?" no estado "voltou" do b (PIX_MOTIVO, padrão off)
const U2027 = upsell2027DoHtml(); // 31/10: o "Seu 2027" no pós-pago (chave UPSELL_2027 / ?u2027=on)
const VOLTA_U2027 = voltaDoEmailU2027(BUSCA); // 31/10: chegou pelo bloco do 2027 no e-mail de compra confirmada
type ModU2027 = typeof import("./upsell-2027");
let modU2027: ModU2027 | null = null;
let carregandoU2027: Promise<ModU2027> | null = null;
let u27Falhou = false;
let u27: import("./upsell-2027").Upsell2027 | null = null;
let u27Compra: string | null = null;
/** veio pelo link do e-mail (?r=u2027): o 2027 toma o cartão mesmo fora da "conta" (até Continuar) */
let u27Volta = false;
/** o cartão está mostrando o 2027 agora */
let u27Tela = false;
/** crítica r2 (dinheiro 1): o 2027 guardado no cookie (QR vivo / "Pronto") quando o estado do vitalício sumiu desta aba */
let u27Retomada: import("./regras").EstadoU2027 | null = null;
/**
 * 01/11: QUAL oferta o pós-pago mostra — chave UPSELL_POS no <head> (html[data-upsell-pos]): "2027" (padrão: tudo acima, igual)
 * | "presente" ("Leve alguém junto" R$ 14,90, ./upsell-presente.ts, no MESMO lugar e na mesma página própria). Uma oferta só:
 * com "presente" o módulo do 2027 nem baixa (salvo o link do e-mail de compra ?r=u2027 e a retomada de um QR do 2027 já aberto,
 * que são do 2027 por natureza). O instância fica em `u27` (a mesma interface), pra o resto da landing não mudar.
 */
const POS_PRESENTE = U2027 && upsellPosDoHtml() === "presente";
type ModPresente = typeof import("./upsell-presente");
let modPresente: ModPresente | null = null;
let carregandoPresente: Promise<ModPresente> | null = null;

/* ───────────────────────── sessão + eventos ───────────────────────── */
const novoId = () => { try { return crypto.randomUUID(); } catch { return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`; } };
const ss = (k: string, v?: string): string | null => {
  try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch { /* noop */ }
  return v ?? null;
};
const sessao = ss("landing-sessao-v1") || ss("landing-sessao-v1", novoId())!;
const coreSid = ss("core_session_id") || ss("core_session_id", novoId())!;
const aparelho = idDoAparelho(); // 29/10: estável entre visitas (o landing_session_id morre com a aba)
const URL_EV = "https://itoylenzvahbscgjgtqf.supabase.co/rest/v1/analytics_events";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";
const ua = navigator.userAgent || "";
const plataforma = /iPhone|iPad|iPod/i.test(ua) ? "ios" : /Android/i.test(ua) ? "android" : "web";
const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram/i.test(ua);
const pixForcado = !!w.__landing?.pix_forcado; // 02/11 r1: ?pix=b do dono/QA fica no aparelho — todo evento diz, não só o landing_html (a análise exclui)
const medicaoForçada = SIMULADO || ["lp_forcado", "pix_forcado", "oferta_forcada", "checkout_forcado", "t_forcado", "lpo_forcado"].some(k => (w.__landing as Record<string, unknown> | undefined)?.[k] === true);
const storageAtrib = (() => { try { return localStorage; } catch { return null; } })();
const atrib = capturarAtribuicao(location.search, storageAtrib, Date.now(), medicaoForçada);
const contextoAtribuicao = () => ({ landing_session_id: sessao, landing_device_id: aparelho, braco_lp: brLp, braco_pix: brPix, forçado: medicaoForçada, atrib });

export function evento(nome: string, dados: Record<string, unknown> = {}): void {
  // O listener delegado registra uma vez também os links criados pelo checkout/upsells.
  if (nome === "landing_loja" && !dados.link_click_id) return;
  const corpo = { landing_medicao_v: 2, medicao_forcada: medicaoForçada, ...dados, ...(PAGINA ? { pagina: PAGINA, braco_checkout_ext: EXT, braco_vida: BRACO_VIDA } : {}), ...(BRACO_LP_OFERTA ? { braco_lp_oferta: BRACO_LP_OFERTA, lpo_forcado: LPO_FORCADO } : {}), landing_session_id: sessao, landing_device_id: aparelho, braco_titulo: brTitulo, braco_oferta: brOferta, braco_checkout: brCheckout, braco_lp: brLp, braco_pix: brPix, pix_forcado: pixForcado, plataforma, in_app: inApp, t_ms: agora(), ...atrib };
  listaDeEventos.push({ nome, ...corpo });
  if (!PRODUCAO) return;
  try {
    fetch(URL_EV, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: null, session_id: coreSid, event_name: nome, event_data: { ...corpo, path: location.pathname } }),
    }).catch(() => {});
  } catch { /* nunca derruba a página */ }
}
const pixel = (ev: string, params: Record<string, unknown> = {}, eventID?: string) => {
  try { if (typeof w.fbq === "function") { if (eventID) w.fbq("track", ev, params, { eventID }); else w.fbq("track", ev, params); } } catch { /* noop */ }
};

/* 1ª tela: o HTML já pintou; o 1º frame depois deste script confirma */
requestAnimationFrame(() => {
  let ttfb: number | null = null;
  try { const n = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined; if (n) ttfb = Math.round(n.responseStart); } catch { /* noop */ }
  const m = w.__landing ?? {};
  evento("landing_html", { tela1_ms: agora(), ttfb_ms: ttfb, t_forcado: !!m.t_forcado, oferta_forcada: !!m.oferta_forcada, checkout_forcado: !!m.checkout_forcado, lp_forcado: !!m.lp_forcado, pix_forcado: !!m.pix_forcado, divisao: m.divisao ?? null, ...(PAGINA ? { hotmart_forcado: !!m.hotmart_forcado, vida_forcado: !!m.vida_forcado } : {}) });
});

/*
 * scripts de terceiros (pixel e Google): 30/10 — no 1º QUADRO + ocioso (teto ~1,5 s), com reserva aos 2,5 s. Antes era
 * load + 800 ms (reserva 6 s) e disputava a rede com a demo: num Android lento o PageView saía em 4–8 s e a Meta via
 * "27% dos cliques sem página" (lp-web/funil §2b). A 1ª tela já pintou antes deste módulo rodar; ~100 KB de JS do pixel
 * não a atrasam. Igual nos DOIS braços.
 */
const ocioso = (f: () => void, timeout: number) => { if (w.requestIdleCallback) w.requestIdleCallback(f, { timeout }); else window.setTimeout(f, 200); };
const carregarScript = (src: string, aoCarregar?: () => void) => {
  const s = document.createElement("script"); s.async = true; s.src = src;
  if (aoCarregar) { s.onload = aoCarregar; s.onerror = aoCarregar; }
  document.head.appendChild(s);
};
let terceiros = false;
/** quem quer começar DEPOIS do pixel (a demo do braço atual): corre quando o fbevents chegou, ou 2,5 s depois do pedido */
let pixelPronto = false;
const esperandoPixel: Array<() => void> = [];
const avisarPixel = () => { if (pixelPronto) return; pixelPronto = true; esperandoPixel.splice(0).forEach((f) => { try { f(); } catch { /* noop */ } }); };
const depoisDoPixel = (f: () => void) => { if (pixelPronto) f(); else esperandoPixel.push(f); };
const carregarTerceiros = () => {
  if (terceiros) return;
  terceiros = true;
  diag.terceirosEm = agora();
  if (!PRODUCAO) { avisarPixel(); return; }
  carregarScript("https://connect.facebook.net/en_US/fbevents.js", avisarPixel);
  carregarScript("https://www.googletagmanager.com/gtag/js?id=AW-18254888989");
  window.setTimeout(avisarPixel, 2500);
};
requestAnimationFrame(() => ocioso(carregarTerceiros, 1500));
window.setTimeout(carregarTerceiros, 2500);

/* ───────────────────────── rolar ───────────────────────── */
/** suave = false: no arranque com Pix vivo/pago (crítica r1 pix 4: a pessoa via a 1ª tela e a página descendo por ~1 s) */
const rolarAte = (el: Element | null, bloco: ScrollLogicalPosition = "start", suave = true) => {
  if (!el) return;
  try { el.scrollIntoView({ behavior: suave ? "smooth" : "auto", block: bloco }); } catch { try { el.scrollIntoView(); } catch { /* sem rolagem (teste) */ } }
};

/* ───────────────────────── 2. a demo ───────────────────────── */
const celular = $("lp-celular");
const frame = $<HTMLIFrameElement>("lp-demo-frame");
const img = $<HTMLImageElement>("lp-demo-img");
const kicker = $("lp-demo-kicker");
const IMAGENS: Partial<Record<ModuloLanding, string>> = { financas: "/landing/demo-financas.webp", rotina: "/landing/demo-rotina.webp", treino: "/landing/demo-treino.webp" };
let moduloAtual: ModuloLanding = "financas";
let demoIniciada = false;
let demoPronta = false;
const tInicioDemo = { t: 0 };

/** v2 (30/10 noite): a demo aberta pela landing v2 leva &lp=v2 — Finanças com o "quanto posso gastar hoje" nos R$ 146 da página em
 *  qualquer dia do mês (lib/preview-seeds-financas-landing). O atual pede a URL de sempre. */
const urlDemo = (m: ModuloLanding) => (V2 ? `/organizar/demo?m=${m}&lp=v2` : `/organizar/demo?m=${m}`);
/** v2: trocar a demo de módulo antes de ela ficar pronta SEM criar uma entrada no histórico (o "voltar" do celular é o fechar da tela cheia) */
const trocarSrc = (m: ModuloLanding) => {
  if (V2) { try { if (frame.contentWindow) { frame.contentWindow.location.replace(urlDemo(m)); return; } } catch { /* cai no src */ } }
  frame.src = urlDemo(m);
};
const cheiaModulo = document.getElementById("lp2-cheia-modulo");

function marcarModulo(m: ModuloLanding) {
  moduloAtual = m;
  celular.dataset.modulo = m;
  kicker.textContent = `Seu CORE · ${NOME_DO_MODULO[m]}`;
  if (cheiaModulo) cheiaModulo.textContent = NOME_DO_MODULO[m];
  if (!V2) document.querySelectorAll<HTMLButtonElement>(".lp-pilula[data-m]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
}

function iniciarDemo(via: string) {
  if (demoIniciada) return;
  demoIniciada = true;
  tInicioDemo.t = agora();
  diag.demoEm = tInicioDemo.t; diag.demoVia = via;
  celular.setAttribute("data-abrindo", ""); // v2: aparece o "Abrindo o app…" na tela cheia (no atual o CSS não muda nada)
  frame.src = urlDemo(moduloAtual);
  if (!V2) evento("landing_demo_aberta", { modulo: moduloAtual, via }); // v2: o landing_demo_aberta {via: "tela_cheia"} sai a cada abertura (abrirCheia)
}

function abrirModulo(m: ModuloLanding, via: "area" | "pilula" | "grade") {
  const mudou = m !== moduloAtual;
  marcarModulo(m);
  if (!demoPronta) {
    // a demo ainda não chegou: a imagem certa (se houver) e a demo nasce no módulo novo
    if (IMAGENS[m]) img.src = IMAGENS[m]!;
    if (demoIniciada && mudou) trocarSrc(m);
    iniciarDemo(via);
  } else if (mudou) {
    try { frame.contentWindow?.postMessage({ tipo: "landing:modulo", m }, location.origin); } catch { /* noop */ }
  }
  if (mudou || via !== "area") evento("landing_demo_modulo", { modulo: m, via });
}

window.addEventListener("message", (e: MessageEvent) => {
  if (e.origin !== location.origin || e.source !== frame.contentWindow) return;
  const d = e.data as MensagemDaDemo | null;
  if (!d || typeof d !== "object") return;
  if (d.tipo === "landing:pronta") {
    if (!demoPronta) {
      demoPronta = true;
      celular.setAttribute("data-pronta", "");
      frame.removeAttribute("tabindex");
      evento("landing_demo_pronta", { modulo: d.modulo, ms_desde_html: agora(), ms_desde_inicio: agora() - tInicioDemo.t });
    }
  } else if (d.tipo === "landing:modulo-trocado" && ehModuloLanding(d.modulo)) {
    marcarModulo(d.modulo);
    evento("landing_demo_modulo", { modulo: d.modulo, via: "dentro" });
  } else if (d.tipo === "landing:oferta") {
    evento("landing_demo_saida", { destino: String(d.destino).slice(0, 80), modulo: moduloAtual });
    // v2: a seta ← do próprio módulo fecha a tela cheia (volta pra onde a pessoa estava); o resto (algo que só existe com conta) fecha
    // e leva ao cartão. A seta manda 2 avisos ("seta" e o destino dela): o 1º manda, o 2º cai no "já fechando".
    if (V2 && cheiaAberta) { if (d.destino === "seta") pedirFechar("seta_app"); else pedirFechar("oferta_app", () => rolarAte($("oferta"), "start", false)); }
    else rolarAte($("oferta"));
  } else if (d.tipo === "landing:mexeu" && ehModuloLanding(d.modulo)) {
    evento("landing_demo_mexeu", { modulo: d.modulo });
  }
});

/*
 * 30/10: quando a demo (o app inteiro, 4–5 MB) começa a baixar.
 *   atual: o mais cedo entre (a) o pixel carregou (ou 2,5 s depois do pedido) + ocioso — antes era load + ocioso, e a
 *          demo disputava a rede com o PageView; (b) a demo entrou ≥ 25% na tela; (c) o 1º toque (área/pílula/grade).
 *          Visualmente igual: a imagem leve do módulo ocupa a MESMA caixa até o iframe chegar, como hoje.
 *   v2:    SÓ no toque ("Testar o app", pílula ou grade). 61% nunca chegavam à demo e baixavam tudo mesmo assim.
 */
// (a) depois do pixel E do load: o iframe antes do `load` segurava o evento load da página em ~5 s na medição (a barra de
// progresso do navegador do Instagram ficaria girando) — no main de hoje a demo também só entra depois do load
const depoisDoLoad = (f: () => void) => { if (document.readyState === "complete") f(); else window.addEventListener("load", f, { once: true }); };
/* crítica r2 do upsell 2027 (técnico MEDIA 1, só com o 2027 ligado): quem já está no Pix/pago não precisa da demo de 4–5 MB — e,
 * no WebKit, o iframe navegando depois do pushState da página do 2027 comia o 1º Voltar. Com a chave off, igual a antes. */
const demoDeFundoServe = () => !(U2027 && estado.fase !== "oferta");
if (!V2 && !LPO_NOVA) { // 06/11: a página nova da /oferta não tem demo
  depoisDoPixel(() => depoisDoLoad(() => ocioso(() => { if (demoDeFundoServe()) iniciarDemo("fundo"); }, 1500)));
  if ("IntersectionObserver" in window) {
    const perto = new IntersectionObserver((ens) => { if (ens.some((e) => e.isIntersecting) && demoDeFundoServe()) { iniciarDemo("perto"); perto.disconnect(); } }, { threshold: 0.25 });
    perto.observe($("demo"));
  }
}
document.getElementById("lp-demo-abrir")?.addEventListener("click", () => {
  evento("landing_cta", { onde: "testar_app" });
  if (V2) abrirCheia("financas", "botao"); else iniciarDemo("botao"); // o botão diz "Testar Finanças": abre Finanças mesmo depois de uma pílula
});

/*
 * ───────── v2 · A DEMO EM TELA CHEIA (30/10 noite, dono no iPhone: "a proporção do app ficou estranha") ─────────
 * Na página fica um cartão (celular em proporção real + "Testar Finanças aqui" + pílulas Rotina/Treino). O toque abre o app de verdade POR CIMA da
 * página: o próprio .lp-celular vira uma camada fixa de 100dvh (o iframe nunca muda de lugar no DOM — mover um iframe o recarrega),
 * com "← Voltar" + o módulo em cima e "R$ 27,90 · Vitalício · Pix | Quero organizar minha vida" embaixo.
 *   · abrir = history.pushState (mesma URL) + trava a página por baixo (body fixed em −y: sem pulo no WebKit, sem rolar por trás);
 *   · o voltar do celular/gesto (popstate) fecha; a seta e a barra de baixo fecham por history.back() (uma entrada só, nunca 2);
 *   · fechar devolve a página EXATAMENTE no y de antes (a barra de baixo leva ao cartão da oferta);
 *   · recarregar com a tela cheia aberta (o Instagram recarrega a aba) reabre no mesmo módulo e no mesmo y — menos com Pix vivo, pago
 *     ou "já tem": aí o cartão manda (y 0) e a marca sai do histórico;
 *   · o iframe só ganha src no 1º toque (como antes); depois de aberto continua vivo escondido — reabrir é instantâneo, no mesmo lugar.
 * Eventos: landing_demo_aberta {modulo, via: "tela_cheia", origem: botao|pilula|cartao|recarga|avancar, vez}
 *          landing_demo_fechada {ms, via: seta|voltar|comprar|seta_app|oferta_app|fase, modulo} · landing_cta {onde: "demo_tela_cheia", fase}
 */
const MARCA_CHEIA = "lpDemoCheia";
/** r2 (persona MÉDIA 1): enquanto a demo carrega, a tela cheia mostra SÓ o que não muda — o cabeçalho do módulo (nome + abas),
 *  recortado da própria demo &lp=v2 (sem a seta ←, sem o mês) — e esqueletos cinza no lugar dos cards. O print inteiro de antes
 *  (v3-financas) era de outro dia: saldo, despesas, "17 dias" e a ordem dos cards trocavam na frente da pessoa.
 *  ~10 KB cada; baixam quando o cartão da demo chega perto da tela (nunca o iframe). Módulo sem recorte = só os esqueletos. */
const CABECALHO_V2: Partial<Record<ModuloLanding, string>> = { financas: "/landing/v3-cheia-financas.webp", rotina: "/landing/v3-cheia-rotina.webp", treino: "/landing/v3-cheia-treino.webp" };
const cabecalhoImg = document.querySelector<HTMLImageElement>("#lp-celular .lp2-cheia-cab");
const pilulas = document.querySelector<HTMLElement>("#demo .lp-pilulas");
if (V2) {
  // r1 (técnico 4): no v2 as pílulas abrem a tela cheia (não são abas): grupo de botões, sem "escolhida"
  pilulas?.setAttribute("role", "group");
  pilulas?.querySelectorAll(".lp-pilula").forEach((b) => b.removeAttribute("aria-pressed"));
  // r1 (técnico 1): fechada, a camada (e o iframe vivo dentro dela) fica fora do teclado e do leitor de tela
  celular.setAttribute("inert", "");
  // r1 (persona 6): o apelido da avaliação é texto da página ("camvbs ·"), vindo do data-nome; vazio = some.
  // r2 (persona BAIXA 3): sem o espaço do fim — o gap do figcaption já separa (antes: espaço duplo entre "·" e a loja)
  document.querySelectorAll<HTMLElement>("#avaliacoes-v2 .lp2-aval-nome").forEach((el) => {
    const n = (el.getAttribute("data-nome") ?? "").trim();
    el.textContent = n ? `${n} ·` : "";
  });
  // r2: os recortes do cabeçalho baixam quando o cartão da demo chega perto (≤ 800 px) — no toque já estão no cache
  const cartaoDemo = document.getElementById("lp2-demo-cartao");
  const baixarCabecalhos = () => { for (const u of Object.values(CABECALHO_V2)) { try { const i = new Image(); i.decoding = "async"; i.src = u!; } catch { /* noop */ } } };
  if (cartaoDemo && "IntersectionObserver" in window) {
    const perto = new IntersectionObserver((ens) => { if (ens.some((e) => e.isIntersecting)) { perto.disconnect(); baixarCabecalhos(); } }, { rootMargin: "800px 0px" });
    perto.observe(cartaoDemo);
  }
}
/** a altura das 2 barras da tela cheia (safe-area e fonte do sistema mudam): o print encosta embaixo da de cima, o "Abrindo…" acima da de baixo */
const medirBarras = () => {
  const topo = celular.querySelector<HTMLElement>(".lp2-cheia-topo");
  const baixo = celular.querySelector<HTMLElement>(".lp2-cheia-baixo");
  if (topo?.offsetHeight) celular.style.setProperty("--lp2-topo-h", `${topo.offsetHeight}px`);
  if (baixo?.offsetHeight) celular.style.setProperty("--lp2-baixo-h", `${baixo.offsetHeight}px`);
};
if (V2) window.addEventListener("resize", () => { if (cheiaAberta) medirBarras(); }, { passive: true });
function mostrarPrint(m: ModuloLanding) {
  if (demoPronta || !cabecalhoImg) return;
  const p = CABECALHO_V2[m];
  if (!p) { celular.removeAttribute("data-tem-print"); cabecalhoImg.removeAttribute("src"); return; }
  if (cabecalhoImg.getAttribute("src") !== p) cabecalhoImg.src = p;
  celular.setAttribute("data-tem-print", "");
}
/* r2 (técnico BAIXA 1): aberta, a camada é a ÚNICA coisa da página no teclado — no WebKit o aria-modal não segura o Tab e o foco
 * ia pros <summary> das dúvidas por baixo. Os irmãos de cada ancestral da camada (até o body) ganham inert; ao fechar, só os que
 * NÓS marcamos perdem (quem já era inert continua). */
let inertesDaCheia: Element[] = [];
function isolarCamada() {
  soltarCamada();
  for (let el: Element | null = celular; el && el !== document.body && el.parentElement; el = el.parentElement) {
    for (const irmao of Array.from(el.parentElement.children)) {
      if (irmao === el || irmao.hasAttribute("inert") || irmao.tagName === "SCRIPT" || irmao.tagName === "STYLE") continue;
      irmao.setAttribute("inert", ""); inertesDaCheia.push(irmao);
    }
  }
}
function soltarCamada() { for (const el of inertesDaCheia) el.removeAttribute("inert"); inertesDaCheia = []; }
type EstadoHist = { [MARCA_CHEIA]?: 1; y?: number; m?: string } & Record<string, unknown>;
const estadoHist = (): EstadoHist | null => { try { const e = history.state; return e && typeof e === "object" ? (e as EstadoHist) : null; } catch { return null; } };
let cheiaAberta = false;
let cheiaDesde = 0;
let cheiaVezes = 0;
let yDaPagina = 0;
let fechandoVia: string | null = null;
let depoisDeFechar: (() => void) | null = null;
let reservaDoFechar: number | null = null;
let restauracaoAntes: ScrollRestoration | null = null;
/** r1 (técnico 3): um history.back() nosso ainda sem o popstate — a restauração de rolagem só volta ao do navegador DEPOIS dele */
let esperandoPop = false;
let timerRestauracao: number | null = null;
let quemAbriu: HTMLElement | null = null;
const cheiaVoltar = document.getElementById("lp2-cheia-voltar");
const cheiaComprar = document.getElementById("lp2-cheia-comprar");

function travarPagina(y: number) {
  const b = document.body.style;
  b.position = "fixed"; b.top = `-${y}px`; b.left = "0"; b.right = "0"; b.width = "100%"; b.overflow = "hidden";
}
function soltarPagina(y: number) {
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = ""; b.overflow = "";
  try { window.scrollTo(0, y); } catch { /* jsdom */ }
}

function abrirCheia(m: ModuloLanding, origem: "botao" | "pilula" | "cartao" | "recarga" | "avancar", y?: number) {
  if (!V2 || cheiaAberta) return;
  const mudou = m !== moduloAtual;
  marcarModulo(m);
  mostrarPrint(m);
  if (!demoIniciada) iniciarDemo(origem);
  else if (mudou) {
    if (demoPronta) { try { frame.contentWindow?.postMessage({ tipo: "landing:modulo", m }, location.origin); } catch { /* noop */ } }
    else trocarSrc(m);
  }
  yDaPagina = y ?? Math.round(window.scrollY || window.pageYOffset || 0);
  // a rolagem é nossa enquanto a camada existe (o navegador restaurando o y da entrada de baixo brigava com o "levar ao cartão")
  try { if (restauracaoAntes === null) restauracaoAntes = origem === "avancar" ? "auto" : history.scrollRestoration; history.scrollRestoration = "manual"; } /* "avancar": a entrada marcada já vem em "manual" — devolver "auto" pra recarga voltar no mesmo y */ catch { /* noop */ }
  // r2 (técnico MÉDIA): no "avançar" do navegador a entrada com a marca JÁ existe (é ela que voltou) — empilhar outra duplicava o
  // histórico (a seta voltava pra uma entrada ainda marcada: recarregar reabria a demo sozinha e sair pedia 2 "voltar"). Lá só
  // atualiza o y na própria entrada. Na recarga a entrada também já existe.
  const novoEstado = { ...(estadoHist() ?? {}), [MARCA_CHEIA]: 1, y: yDaPagina, m };
  if (origem === "avancar") { try { history.replaceState(novoEstado, ""); } catch { /* noop */ } }
  else if (origem !== "recarga") { try { history.pushState(novoEstado, ""); } catch { /* sem histórico: fecha só pelos botões */ } }
  travarPagina(yDaPagina);
  celular.removeAttribute("inert");
  isolarCamada();
  document.documentElement.setAttribute("data-demo-cheia", "");
  medirBarras();
  celular.setAttribute("role", "dialog"); celular.setAttribute("aria-modal", "true"); celular.setAttribute("aria-label", "Demonstração do CORE");
  cheiaAberta = true; cheiaDesde = agora(); cheiaVezes += 1;
  quemAbriu = origem === "recarga" || origem === "avancar" ? null : (document.activeElement as HTMLElement | null);
  atualizarRotulos();
  evento("landing_demo_aberta", { modulo: m, via: "tela_cheia", origem, vez: cheiaVezes });
  try { cheiaVoltar?.focus({ preventScroll: true }); } catch { /* noop */ }
}

/** Fecha JÁ (o histórico já voltou, ou não dá pra usar o histórico). */
function fecharCheia(via: string) {
  if (!cheiaAberta) return;
  cheiaAberta = false;
  fechandoVia = null;
  if (reservaDoFechar !== null) { window.clearTimeout(reservaDoFechar); reservaDoFechar = null; }
  document.documentElement.removeAttribute("data-demo-cheia");
  celular.removeAttribute("aria-modal");
  // r1 (técnico 1): o foco não fica no iframe escondido (no WebKit o toque não foca o botão: quemAbriu era o body)
  const focoDentro = !!document.activeElement && document.activeElement !== document.body && celular.contains(document.activeElement);
  celular.setAttribute("inert", "");
  soltarCamada();
  soltarPagina(yDaPagina);
  evento("landing_demo_fechada", { ms: agora() - cheiaDesde, via, modulo: moduloAtual });
  const depois = depoisDeFechar; depoisDeFechar = null;
  if (depois) depois();
  else if (quemAbriu && quemAbriu !== document.body && document.contains(quemAbriu)) { try { quemAbriu.focus({ preventScroll: true }); } catch { /* noop */ } }
  if (focoDentro || (document.activeElement && celular.contains(document.activeElement))) {
    const abrir = document.getElementById("lp-demo-abrir");
    try { if (!depois && abrir) abrir.focus({ preventScroll: true }); else (document.activeElement as HTMLElement | null)?.blur?.(); } catch { /* noop */ }
  }
  quemAbriu = null;
  devolverRestauracao();
}

/** Devolve a restauração de rolagem do navegador 400 ms depois que a volta do histórico terminou (o popstate do nosso back()
 *  chegou) — nunca antes: com "auto" ativo na chegada atrasada, o navegador restauraria o y antigo por cima do "levar ao cartão". */
function devolverRestauracao() {
  if (timerRestauracao !== null) { window.clearTimeout(timerRestauracao); timerRestauracao = null; }
  if (esperandoPop) return; // o popstate chama de novo
  timerRestauracao = window.setTimeout(() => {
    timerRestauracao = null;
    if (!cheiaAberta && !esperandoPop && restauracaoAntes !== null) { try { history.scrollRestoration = restauracaoAntes; } catch { /* noop */ } restauracaoAntes = null; }
  }, 400);
}
/** o back() nosso: espera o popstate (com teto de 3 s — um navegador que nunca o devolve não deixa a rolagem "manual" pra sempre) */
let tetoDoPop: number | null = null;
function voltarHistorico() {
  esperandoPop = true;
  if (tetoDoPop !== null) window.clearTimeout(tetoDoPop);
  tetoDoPop = window.setTimeout(() => { tetoDoPop = null; if (esperandoPop) { esperandoPop = false; if (!cheiaAberta) devolverRestauracao(); } }, 3000);
  try { history.back(); } catch (e) { esperandoPop = false; throw e; }
}

/** Fechar pela seta / barra de baixo / app: volta 1 entrada no histórico (a que o abrir criou) e o popstate fecha. */
function pedirFechar(via: string, depois?: () => void) {
  if (!cheiaAberta || fechandoVia) return;
  fechandoVia = via;
  depoisDeFechar = depois ?? null;
  if (estadoHist()?.[MARCA_CHEIA]) {
    try { voltarHistorico(); } catch { fecharCheia(via); return; }
    // reserva: um navegador que não devolve o popstate (ou demora) não prende ninguém na tela cheia
    reservaDoFechar = window.setTimeout(() => { reservaDoFechar = null; if (cheiaAberta) fecharCheia(via); }, 700);
  } else fecharCheia(via);
}

/** O Pix mudou de tela com a tela cheia aberta (pagou no banco e voltou com a demo aberta): fecha na hora, sem esperar o histórico. */
let pularProximoPop = false;
function fecharCheiaJa(via: string) {
  if (!cheiaAberta) return;
  if (estadoHist()?.[MARCA_CHEIA]) { pularProximoPop = true; try { voltarHistorico(); } catch { pularProximoPop = false; } }
  fecharCheia(via);
}

window.addEventListener("popstate", (e: PopStateEvent) => {
  if (!V2 || !document.contains(celular)) return; // !contains: uma página anterior deste mesmo documento (testes) não mexe na atual
  const marca = !!(e.state && typeof e.state === "object" && (e.state as EstadoHist)[MARCA_CHEIA]);
  if (esperandoPop) {
    esperandoPop = false;
    if (tetoDoPop !== null) { window.clearTimeout(tetoDoPop); tetoDoPop = null; }
    if (!cheiaAberta) devolverRestauracao(); // a reserva de 700 ms já fechou: agora sim
  }
  if (pularProximoPop) { pularProximoPop = false; if (!marca) return; }
  if (cheiaAberta && !marca) fecharCheia(fechandoVia ?? "voltar");
  else if (!cheiaAberta && marca && ehModuloLanding((e.state as EstadoHist).m)) abrirCheia((e.state as EstadoHist).m as ModuloLanding, "avancar", Math.round(window.scrollY || 0));
});
document.addEventListener("keydown", (e) => { if (cheiaAberta && e.key === "Escape" && document.contains(celular)) pedirFechar("seta"); });
cheiaVoltar?.addEventListener("click", () => pedirFechar("seta"));
cheiaComprar?.addEventListener("click", () => {
  evento("landing_cta", { onde: "demo_tela_cheia", fase: estado.fase });
  pedirFechar("comprar", () => rolarAte($("oferta"), "start", false));
});
document.getElementById("lp2-demo-cartao")?.addEventListener("click", () => { evento("landing_cta", { onde: "testar_app_cartao" }); abrirCheia("financas", "cartao"); });

/* ───────────────────────── 1. topo: a área ───────────────────────── */
document.querySelectorAll<HTMLButtonElement>(".lp-area").forEach((b) => {
  b.addEventListener("click", () => {
    const area = b.dataset.a as Area;
    if (!ehArea(area)) return;
    document.querySelectorAll<HTMLButtonElement>(".lp-area").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    const m = MODULO_DA_AREA[area];
    evento("landing_area", { area, modulo: m });
    abrirModulo(m, "area");
    window.setTimeout(() => rolarAte($("demo")), 120);
  });
});
document.querySelectorAll<HTMLButtonElement>(".lp-pilula[data-m]").forEach((b) => b.addEventListener("click", () => {
  if (!ehModuloLanding(b.dataset.m)) return;
  if (V2) { evento("landing_demo_modulo", { modulo: b.dataset.m, via: "pilula" }); abrirCheia(b.dataset.m, "pilula"); return; } // v2: a pílula abre a tela cheia já no módulo
  abrirModulo(b.dataset.m, "pilula");
}));
document.querySelectorAll<HTMLButtonElement>(".lp-mod[data-m]").forEach((b) => b.addEventListener("click", () => {
  if (!ehModuloLanding(b.dataset.m)) return;
  abrirModulo(b.dataset.m, "grade");
  rolarAte($("demo"));
}));
document.querySelectorAll<HTMLElement>("[data-ir]").forEach((b) => b.addEventListener("click", () => {
  const alvo = b.dataset.ir!;
  if (alvo === "oferta") evento("landing_cta", { onde: b.closest("#lp-fixo") ? "fixo" : b.closest("#fim") ? "fim" : b.closest("#topo-v2") ? "topo" : "outro", fase: estado.fase });
  if (alvo === "dentro-v2") evento("landing_lojas_topo", {}); // r1: "App Store · Google Play · Computador" da 1ª tela → rola até "Sim, é um app de verdade"
  rolarAte($(alvo));
}));
// Captura antes dos listeners locais e da navegação; cobre links inseridos depois.
const cliqueLoja = (e: MouseEvent) => {
  if (e.type === "auxclick" && e.button !== 1) return;
  const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[data-loja]") : null;
  if (!a || !["android", "ios"].includes(a.dataset.loja || "")) return;
  try {
    const clickId = novoId(), onde = jaTem && a.closest("#lp-pix") ? "ja_tem" : ondeLinkLoja(a);
    const original = a.href;
    const contexto = { clickId, lp: brLp, pix: brPix, onde, path: location.pathname, forçado: medicaoForçada };
    a.href = a.dataset.loja === "android" ? linkPlayAtribuido(original, contexto) : linkAppleAtribuido(original, contexto);
    evento("landing_loja", { loja: a.dataset.loja, onde, link_click_id: clickId, referrer_medido: a.dataset.loja === "android" && a.href !== original, apple_campaign: a.dataset.loja === "ios" ? new URL(a.href).searchParams.get("ct") : undefined });
  } catch { /* medição nunca bloqueia a loja */ }
};
if (w.__landingCliqueLoja) {
  document.removeEventListener("click", w.__landingCliqueLoja, true);
  document.removeEventListener("auxclick", w.__landingCliqueLoja, true);
}
w.__landingCliqueLoja = cliqueLoja;
document.addEventListener("click", cliqueLoja, true);
document.addEventListener("auxclick", cliqueLoja, true);

/* ───────────────────────── o estado da compra (guardado: o banco fecha/recarrega a aba) ───────────────────────── */
const CHAVE_ESTADO = "landing-estado-v1";
const ehOferta = (o: string): o is OfertaLanding => Object.prototype.hasOwnProperty.call(VALOR_OFERTA, o);
let estadoHeap: EstadoLanding | null = null; // o Instagram zera o storage com a página viva
/* crítica r1 (pix 3, v2): o código vencido não some em silêncio — o cartão avisa e o pedido vencido segue sendo conferido por uns
 * minutos (quem pagou no minuto 29 e voltou no 31 não pode ver a oferta de novo e pagar 2×). Também na recarga: um Pix que
 * venceu há < 10 min deixa o aviso. */
let vencido: PixLanding | null = null;
let avisoOferta: string | null = null;
/* r3 (oferta M2 / pix 3): no braço livre o e-mail do QR é opcional — sem e-mail conhecido, o acesso NÃO chega em e-mail nenhum:
 * é esta tela que vira "pago" e pede o e-mail. A frase só promete o e-mail quando ele existe. */
const avisoVenceu = (emailConhecido: boolean) => emailConhecido
  ? "Esse código venceu. Se você já pagou, o acesso chega no seu e-mail em instantes. Se não, é só gerar outro."
  : "Esse código venceu. Se você já pagou, esta tela confirma sozinha em instantes. Se não, é só gerar outro.";
const JANELA_VENCIDO_MS = 10 * 60_000;
/** 02/11 r2: o Pix desta abertura veio do cookie (storage zerado) — a medição vê quantas vezes isso acontece e se a sessão sobreviveu */
let pixDoCookie: { semSessao: boolean; comEmail: boolean } | null = null;
const lerEstado = (): EstadoLanding => {
  let bruto: unknown = estadoHeap;
  if (!bruto) { try { bruto = JSON.parse(localStorage.getItem(CHAVE_ESTADO) || "null"); } catch { bruto = null; } }
  // r3 (pix 2): o localStorage sumiu (Instagram) mas o cookie do Pix vivo ficou → o mesmo QR reabre, sem um 2º Pix.
  // 02/11 r1 (técnico, AB_PIX): nos DOIS braços da tela do Pix (era só no v2) — a volta do banco por recarga com o storage zerado
  // caía na oferta e deixava gerar (e pagar) um 2º Pix; o visual do atual não muda.
  if (!bruto) {
    const c = lerPixVivo();
    if (c && ehOferta(c.oferta)) {
      // 02/11 r2 (técnico ALTA 1 / persona M2): o storage zerado levou a SESSÃO junto — sem ela o `check` nem é chamado (pagamento.ts)
      // e "confirma sozinha" era promessa vazia. Sem sessão o Pix reabre no modo do lembrete (doEmail: "o acesso chega no seu e-mail",
      // o webhook do servidor manda o acesso), com o e-mail que o cookie guardou (a linha "Acesso" continua mostrando ele).
      const semSessao = !temSessaoNoStorage();
      const pix: PixLanding = { orderId: c.orderId, qrCode: c.qrCode, qrCodeBase64: null, expiresAt: c.expiresAt, criadoEm: Date.now(), oferta: c.oferta, ...(semSessao ? { doEmail: true } : {}) };
      bruto = { ...ESTADO_VAZIO, fase: "qr", pix, salvoEm: Date.now(), ...(c.email ? { emailPix: c.email } : {}) } as EstadoLanding;
      pixDoCookie = { semSessao, comEmail: !!c.email };
    }
  }
  if (V2) {
    const e = bruto as Partial<EstadoLanding> | null;
    if (e && e.v === 1 && e.pix && !e.pago && typeof e.salvoEm === "number") {
      const fora = Date.now() - venceEm(e.pix);
      if (fora > 0 && fora < JANELA_VENCIDO_MS) {
        vencido = e.pix; avisoOferta = avisoVenceu(!!(e.emailPix || lerCompra()?.email));
        // r3 (oferta B3): quem volta com o código já morto também conta (1× por pedido nesta aba) — a régua vê quantos voltaram a um Pix vencido
        const chave = `landing-venceu-${e.pix.orderId}`;
        if (!ss(chave)) { ss(chave, "1"); evento("landing_pix_venceu", { order_id: e.pix.orderId, via: "recarga" }); }
      }
    }
  }
  return estadoQueVolta(bruto);
};
// 04/11: no braço Hotmart da /vida não existe Pix nesta página — um Pix do /organizar guardado no aparelho não aparece aqui
let estado: EstadoLanding = EXTERNO ? estadoQueVolta(null) : lerEstado();
/* 29/10: "Você já tem o CORE" no lugar da oferta (marcador do aparelho, ou o servidor disse `ja_tem`) */
let jaTem: MarcaCompra | null = null;
/** o "já tem" veio da saída do 2027 pelo link do e-mail (o "Não fui eu que comprei" não aparece: ela abriu o e-mail da compra) */
let jaTemDoLink = false;
// comprou antes do marcador existir (o estado do Pix ainda guarda a compra): marca agora
if (estado.pago) { try { if (!lerCompra()) marcarCompra({ oferta: estado.pago.oferta, email: estado.email ?? estado.emailPix }); } catch { /* noop */ } }

/* ───────────────────────── blocos vistos + botão fixo ───────────────────────── */
const fixo = $("lp-fixo");
let passouDaDemo = false;
/** v2: o botão do topo saiu da tela POR CIMA? (crítica r1: a trava "passou uma vez" deixava a barra ligada em cima da 1ª tela ao voltar) */
let topoSaiuPorCima = false;
const naTela = new Set<string>();
/* ── v2 (crítica r1, oferta M2 / pix M1): depois do Pix gerado ou pago a página não pode continuar "vendendo" — o botão do topo, o
 * fixo e o fim mudam de rótulo conforme a fase; com conta pronta (ou "já tem") o fixo some. ── */
/** a página está mostrando a conta (ou o 2027 de quem já pagou, inclusive pelo link do e-mail): nada de "vender" o vitalício */
const contaNaTela = (): boolean => !!jaTem || estado.fase === "conta" || ((u27Volta || !!u27Retomada) && u27Tela);
const rotuloCta = (): string => contaNaTela() ? "Ver minha conta" : estado.fase === "pago" ? "Liberar meu acesso" : estado.fase === "qr" ? "Voltar pro meu Pix" : "Quero organizar minha vida";
const porRotulo = (b: Element | null, t: string) => {
  if (!b) return;
  const n = b.firstChild;
  if (n && n.nodeType === Node.TEXT_NODE) n.textContent = b.querySelector("svg") ? `${t} ` : t; else b.prepend(`${t} `);
};
/** v2: a barra de baixo da tela cheia repete a barra fixa (preço/"Pix gerado · vale por" + o mesmo rótulo do botão) */
const barrasDePreco = (): HTMLElement[] => (V2 ? [fixo, document.querySelector<HTMLElement>(".lp2-cheia-baixo")].filter((x): x is HTMLElement => !!x) : []);
let rotulosDe = "";
function atualizarRotulos() {
  if (!V2) return;
  const t = rotuloCta();
  const chave = `${t}|${estado.fase === "qr" ? estado.pix?.orderId : ""}`;
  if (chave === rotulosDe) return; // o observador chama a cada bloco que entra/sai: só mexe no DOM quando a fase mudou
  rotulosDe = chave;
  porRotulo($("lp-cta-topo"), t);
  porRotulo(fixo.querySelector('button[data-so-lp="v2"]'), t);
  porRotulo(document.getElementById("lp2-cheia-comprar"), t);
  porRotulo(document.querySelector('#fim button[data-so-lp="v2"]'), t);
  const fim = $("fim");
  fim.dataset.fase = contaNaTela() ? "conta" : estado.fase;
  const fimP = fim.querySelector<HTMLElement>(HOTMART ? 'p[data-so-lp="v2"][data-so-ext="hotmart"]' : 'p[data-so-lp="v2"]');
  if (fimP) fimP.textContent = contaNaTela() ? "Sua conta está pronta." : estado.fase === "pago" ? "Pagamento confirmado. Falta só o seu e-mail." : estado.fase === "qr" ? "Seu Pix está logo acima." : HOTMART ? `Vitalício por ${reaisDeCentavos(HM_PRECO)} · Pix ou cartão` : "Vitalício por R$ 27,90 · Pix na hora";
  for (const barra of barrasDePreco()) {
    const fixoB = barra.querySelector<HTMLElement>(".lp2-fixo-p b"); const fixoS = barra.querySelector<HTMLElement>(".lp2-fixo-p span");
    if (!fixoB || !fixoS) continue;
    if (estado.fase === "qr" && estado.pix) { fixoB.textContent = "Pix gerado"; fixoS.textContent = `vale por ${mmss(Math.max(0, venceEm(estado.pix) - Date.now()))}`; }
    else if (HOTMART) { fixoB.textContent = reaisDeCentavos(HM_PRECO); fixoS.innerHTML = "Vitalício<i> · Pix ou cartão</i>"; }
    else { fixoB.textContent = "R$ 27,90"; fixoS.innerHTML = "Vitalício<i> · Pix</i>"; }
  }
}
const atualizarFixo = () => {
  const vendendo = estado.fase !== "conta" && !jaTem && !u27Tela;
  const mostrar = (V2 ? topoSaiuPorCima && vendendo && estado.fase !== "pago" : passouDaDemo && vendendo) && !naTela.has("oferta") && !naTela.has("fim");
  // 30/10: 2 botões (um por braço; o CSS esconde o do outro) — o tabIndex vai nos dois
  if (mostrar) { fixo.setAttribute("data-on", ""); fixo.removeAttribute("aria-hidden"); fixo.querySelectorAll("button").forEach((b) => { b.tabIndex = 0; }); }
  else { fixo.removeAttribute("data-on"); fixo.setAttribute("aria-hidden", "true"); fixo.querySelectorAll("button").forEach((b) => { b.tabIndex = -1; }); }
  atualizarRotulos();
};
const vistos = new Set<string>();
let ofertaVista = false;
let aoVerOferta: (() => void) | null = null; // 06/11: a /oferta baixa o Stripe.js aqui (o bloco da Stripe fica lá embaixo)
/** "viu a oferta" (1x): o evento da régua + ViewContent + pré-aquecimento do Pix. Atual: 15% do bloco #oferta na tela (como hoje).
 *  v2 (crítica r1 8.1): o BOTÃO DE PAGAR ≥ 50% visível — no v2 a oferta começa em y 684 e, em telas de 844+, 15% do bloco
 *  aparecia sem rolar (a régua inflava e a Meta recebia ViewContent de quem só abriu). */
const viuAOferta = () => {
  if (ofertaVista) return;
  ofertaVista = true;
  evento("landing_oferta_vista", { via: V2 ? "botao_50" : "bloco_15" });
  if (brCheckout === "email" && !EXTERNO) evento("landing_email_antes_visto", {}); // 05/11: o braço Hotmart da /vida (e a /oferta) não tem a caixa de e-mail
  pixel("ViewContent", { content_name: STRIPE ? "oferta_stripe" : HOTMART ? "vida_oferta" : "landing_oferta", value: EXTERNO ? PRECO_EXT / 100 : 27.9, currency: "BRL" });
  if (PIX_REAL && !SIMULADO && !EXTERNO) void pg(false).catch(() => null); // pré-aquece o Pix de verdade (sem recarregar a página se falhar)
  aoVerOferta?.();
};
if ("IntersectionObserver" in window) {
  if (V2) {
    const botaoPagar = EXTERNO ? $(ID_BOTAO_HM) : $("lp-pagar");
    new IntersectionObserver((ens) => { if (ens.some((e) => e.isIntersecting)) viuAOferta(); }, { threshold: 0.5 }).observe(botaoPagar);
    // crítica r2 2.5: o landing_bloco "oferta" do v2 também só com metade do bloco na tela (em 844+ os 15% apareciam sem rolar)
    new IntersectionObserver((ens, o) => { if (ens.some((e) => e.isIntersecting) && !vistos.has("oferta")) { vistos.add("oferta"); evento("landing_bloco", { bloco: "oferta", via: "50" }); o.disconnect(); } }, { threshold: 0.5 }).observe($("oferta"));
    // crítica r1 8.2 / v3: os painéis do "Por dentro" — qual foi visto (1x por painel, ≥ 60% na tela). O nome do evento continua
    // landing_fita (os painéis eram uma fita na v2; o painel do dashboard lê esse nome); a legenda é o título do painel.
    // crítica r1 (técnico 7.2): ≥ 60% por ≥ 500 ms — a rolagem suave do botão do topo cruzava os 3 painéis e contava "viu" sem olhar
    const telas = [...document.querySelectorAll<HTMLElement>("#dentro-v2 .lp2-foto")];
    const vistas = new Set<number>();
    const esperando = new Map<number, number>();
    const fita = new IntersectionObserver((ens) => {
      for (const en of ens) {
        const i = telas.indexOf(en.target as HTMLElement);
        if (i < 0 || vistas.has(i)) continue;
        if (en.isIntersecting) {
          if (!esperando.has(i)) esperando.set(i, window.setTimeout(() => {
            esperando.delete(i); vistas.add(i);
            // r3 (prova-e-meio 1.3): o painel 1 tem 2 títulos (um por braço do AB_TITULO; o CSS esconde o outro) — a legenda é o visível
            const h3 = en.target.querySelector(brTitulo === "b" ? "h3.lp2-h3-b, h3:not(.lp2-h3-a)" : "h3:not(.lp2-h3-b)");
            evento("landing_fita", { indice: i, legenda: [...(h3?.childNodes ?? [])].map((n) => n.textContent).join(" ").replace(/\s+/g, " ").trim().slice(0, 40) });
            if (vistas.size === telas.length) fita.disconnect();
          }, 500));
        } else { const t = esperando.get(i); if (t !== undefined) { window.clearTimeout(t); esperando.delete(i); } }
      }
    }, { threshold: 0.6 });
    telas.forEach((t) => fita.observe(t));
  }
  const obs = new IntersectionObserver((entradas) => {
    for (const en of entradas) {
      const bloco = (en.target as HTMLElement).dataset.bloco!;
      if (en.isIntersecting) {
        naTela.add(bloco);
        if (!vistos.has(bloco) && !(V2 && bloco === "oferta")) { vistos.add(bloco); evento("landing_bloco", { bloco }); } // v2: a oferta conta com ≥ 50% (abaixo)
        if (bloco === "oferta" && !V2) viuAOferta(); // no v2 é o botão de pagar ≥ 50% visível (abaixo)
      } else naTela.delete(bloco);
      // passou da demo = o fim da demo já subiu acima do meio da tela
      if (bloco === "demo" && !en.isIntersecting && en.boundingClientRect.top < 0) passouDaDemo = true;
      if (bloco === "modulos" && en.isIntersecting) passouDaDemo = true;
    }
    atualizarFixo();
  }, { threshold: 0.15 });
  document.querySelectorAll("[data-bloco]").forEach((el) => obs.observe(el));
  // v2: o botão fixo entra ENQUANTO o botão do topo está fora da tela por cima — e sai quando ele volta (crítica r1: liga e desliga)
  const ctaTopo = V2 ? document.getElementById("lp-cta-topo") : null;
  if (ctaTopo) {
    // r3 (primeira-tela B3): a barra também liga enquanto o botão ainda está ABAIXO da dobra (fonte do sistema +30%: o botão nasce
    // em 720–774 numa tela de 690 — a 1ª tela ficava com preço e sem botão até rolar); desliga assim que ele entra na tela
    const foraDaTela = (r: { top: number; bottom?: number }, alturaRaiz: number) => r.top < 0 || r.top >= alturaRaiz;
    new IntersectionObserver((ens) => {
      for (const en of ens) topoSaiuPorCima = !en.isIntersecting && foraDaTela(en.boundingClientRect, en.rootBounds?.height || window.innerHeight);
      atualizarFixo();
    }, { threshold: 0 }).observe(ctaTopo);
    // r2 (medição a +30%): com a fonte grande o botão do topo nasce ABAIXO da dobra; um salto de rolagem que pula o botão inteiro
    // (fora → fora) não gera entrada no observador e a barra nunca ligava. A rolagem confere a geometria (1x por quadro).
    let conferindo = false;
    window.addEventListener("scroll", () => {
      if (conferindo) return;
      conferindo = true;
      window.requestAnimationFrame(() => {
        conferindo = false;
        const b = ctaTopo.getBoundingClientRect();
        if (!b.height) return; // sem layout (jsdom): manda o observador
        const saiu = b.bottom < 0 || b.top >= window.innerHeight;
        if (saiu !== topoSaiuPorCima) { topoSaiuPorCima = saiu; atualizarFixo(); }
      });
    }, { passive: true });
  }
}

/* ───────────────────────── 6. oferta: caixinha ───────────────────────── */
const caixinha = $<HTMLInputElement>("lp-caixinha");
const pagarTxt = $("lp-pagar-txt");
const ofertaAtual = (): OfertaLanding => ofertaEscolhida(brOferta, !!caixinha?.checked);
// r2 (oferta 5 / pix 1, v2): com o aviso "Esse código venceu…" ligado, o botão diz o que o aviso manda fazer
const atualizarBotao = () => { pagarTxt.textContent = V2 && avisoOferta ? `Gerar outro Pix · ${reais(VALOR_OFERTA[ofertaAtual()])}` : `Pagar ${reais(VALOR_OFERTA[ofertaAtual()])} no Pix`; };
caixinha?.addEventListener("change", () => { atualizarBotao(); evento("landing_caixinha", { marcada: caixinha.checked }); });
atualizarBotao();

/* ───────────────────────── 7–8. o Pix e o depois ───────────────────────── */
const salvar = (novo: Partial<EstadoLanding>) => {
  estado = { ...estado, ...novo, salvoEm: Date.now() };
  estadoHeap = estado;
  try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* fica no heap */ }
  // r3 (pix 2): o Pix vivo também no cookie (até vencer); pago/vencido/oferta tiram o cookie. 02/11 r1: nos 2 braços (era só no v2)
  if (estado.fase === "qr" && estado.pix) gravarPixVivo({ orderId: estado.pix.orderId, qrCode: estado.pix.qrCode, expiresAt: new Date(venceEm(estado.pix)).toISOString(), oferta: estado.pix.oferta, email: estado.emailPix ?? null });
  else if (estado.fase !== "gerando") esquecerPixVivo();
  render();
};
/* r3 (pix 2): o navegador do Instagram zera o localStorage com a página viva (~5 s depois da chegada). O heap segura a
 * página, mas uma recarga depois disso voltava pra oferta. A cada volta pra aba (e a cada render do v2) a chave é re-semeada. */
const reSemear = () => {
  if (LPO_ATIVO) fixarAparelho(aparelho); // 06/11: com o A/B da /oferta ativo, o id zerado voltaria sorteado de novo (a pessoa contaria 2× e poderia trocar de braço)
  if (!V2 || (estado.fase !== "qr" && estado.fase !== "pago")) return; // só onde há dinheiro em jogo (a conta pronta já vive no marcador)
  try { if (localStorage.getItem(CHAVE_ESTADO) === null) localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* sem storage */ }
};
document.addEventListener("visibilitychange", reSemear);
window.addEventListener("pageshow", reSemear);
window.addEventListener("pagehide", reSemear);

const card = $("lp-card");
const caixa = $("lp-pix");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const ICO_PIX = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="3.2" transform="rotate(45 12 12)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" transform="rotate(45 12 12)" fill="currentColor"/></svg>';
const ICO_SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';

let copiado: boolean | null = null;
let erroPix: string | null = null;
let erroEmail: string | null = null;
let aviso: string | null = null;
let faseConta: "email" | "salvando" | "codigo" | "entrando" = "email";
let emailDigitado = "";
let codigoPago = ""; // r2 (pix 3): o código digitado depois de pagar (sobrevive ao re-render do erro)

/* ───────────────────────── 02/11: a MEDIÇÃO da tela do Pix, NOS DOIS BRAÇOS (AB_PIX) ─────────────────────────
 * A perda está em quem gera o Pix, abre o banco e volta sem pagar (27% de quem gera, 29/10–02/11). Pra saber POR QUE um braço
 * ganha (e não só se ganhou), cada pedido conta: quantas vezes saiu pro banco e quanto tempo ficou na tela antes (landing_pix_saiu),
 * a volta (landing_voltou — também por recarga, que antes era invisível), o toque em "Já paguei" e se já estava pago
 * (landing_pix_ja_paguei), a cópia pelo botão separada da automática (landing_pix_copiar_manual), se rolou a tela procurando algo
 * (landing_pix_rolou), e a saída de vez com o QR na tela (landing_pix_abandono, no pagehide — o evento() já é keepalive).
 * Nada disso muda o visual do braço atual. Nenhum evento leva e-mail, uid ou token. */
const CHAVE_SAIU = "landing-pix-saiu-v1";
const COOKIE_SAIU = "core_ln_saiu"; // 02/11 r1 (técnico): o Instagram zera localStorage E sessionStorage na volta do banco — a marca também num cookie curto (30 min)
let qrDesde = 0; // desde quando o QR está na tela (ou desde a última volta)
let qrDesde0 = 0; // desde quando o QR deste pedido apareceu NESTA página (pro s_total do abandono)
let pedidoNaTela: string | null = null;
let saidas = 0; // quantas vezes este pedido já saiu da tela (aba escondida)
let idasBanco = 0; // 02/11 r2 (técnico M2): voltas de ≥ 5 s (= landing_voltou) — o "foi ao banco" limpo, sem o esconder rápido nem a saída final
let saiuRegistrado = false; // o hidden e o pagehide disparam juntos: 1 saída por vez
const rolouPedidos = new Set<string>();
let rolouBase: number | null = null;
/* 02/11 r2 (persona M3 / técnico B7): a "rolou" só conta depois de um toque/roda/tecla DE VERDADE — o fim de uma rolagem suave longa, a
 * barra do Instagram recolhendo e o teclado fechando também mexem no scrollY (o evento aparecia sem a pessoa rolar). */
let rolouInteragiu = false;
for (const ev of ["touchstart", "wheel", "pointerdown", "keydown"]) window.addEventListener(ev, () => { rolouInteragiu = true; }, { passive: true });
const qrAbertoPedidos = new Set<string>(); // o QR dobrado está aberto (b)
const qrAbertoAvisado = new Set<string>(); // landing_pix_qr_aberto já saiu pra este pedido (1×)
/** o QR deste pedido acabou de entrar na tela (gerado agora, ou a página abriu com ele vivo) */
function marcarQrNaTela(orderId: string) {
  const agoraMs = Date.now();
  if (pedidoNaTela !== orderId) { pedidoNaTela = orderId; saidas = 0; qrDesde0 = agoraMs; }
  qrDesde = agoraMs; saiuRegistrado = false;
  // a rolagem programada até o cartão ainda pode estar correndo: a linha de base da "rolou" só vale depois dela (e de um toque real)
  rolouBase = null; rolouInteragiu = false;
  window.setTimeout(() => { if (pedidoNaTela === orderId && estado.fase === "qr") rolouBase = window.scrollY; }, 800);
}
/** a aba escondeu (foi pro banco, pro Instagram…) com o QR na tela e sem pagar. `via:"pagehide"` = a página está indo embora sem ter
 *  escondido antes (recarga/navegação): manda o evento mas NÃO conta como ida ao banco (02/11 r2, técnico M2) */
function registrarSaida(via: "aba" | "pagehide") {
  if (estado.fase !== "qr" || !estado.pix || saiuRegistrado) return;
  if (pedidoNaTela !== estado.pix.orderId) marcarQrNaTela(estado.pix.orderId); // (zera saiuRegistrado — por isso a marca vem DEPOIS)
  saiuRegistrado = true; // crítico de completude 02/11: antes vinha antes do marcarQrNaTela e o pagehide da mesma saída mandava um 2º landing_pix_saiu
  if (via === "aba") saidas += 1;
  evento("landing_pix_saiu", { s_na_tela: Math.round((Date.now() - qrDesde) / 1000), vez: via === "aba" ? saidas : saidas + 1, via, order_id: estado.pix.orderId });
  // pra enxergar a volta por RECARGA (o Instagram recarrega a aba): a marca sobrevive no sessionStorage e no localStorage (+ cookie)
  // `cop`: o código já foi copiado (o b não volta a dizer "Copie o código" na recarga); `idas`: voltas de ≥ 5 s até aqui
  const marca = JSON.stringify({ order: estado.pix.orderId, em: Date.now(), saidas, idas: idasBanco, cop: copiado === true, desde: qrDesde0 });
  ss(CHAVE_SAIU, marca);
  try { localStorage.setItem(CHAVE_SAIU, marca); } catch { /* noop */ }
  gravarCookie(COOKIE_SAIU, marca, 30 * 60);
}
function lerSaida(): { order: string; em: number; saidas: number; idas?: number; cop?: boolean; desde?: number } | null {
  let bruto: string | null = ss(CHAVE_SAIU);
  if (!bruto) { try { bruto = localStorage.getItem(CHAVE_SAIU); } catch { bruto = null; } }
  if (!bruto) bruto = lerCookie(COOKIE_SAIU);
  try { const m = bruto ? JSON.parse(bruto) : null; return m && typeof m.order === "string" && typeof m.em === "number" ? m : null; } catch { return null; }
}
function esquecerSaida() { try { sessionStorage.removeItem(CHAVE_SAIU); } catch { /* noop */ } try { localStorage.removeItem(CHAVE_SAIU); } catch { /* noop */ } gravarCookie(COOKIE_SAIU, "", 0); }
window.addEventListener("scroll", () => {
  if (rolouBase === null || !rolouInteragiu || estado.fase !== "qr" || !estado.pix || rolouPedidos.has(estado.pix.orderId)) return;
  if (Math.abs(window.scrollY - rolouBase) < 40) return;
  rolouPedidos.add(estado.pix.orderId);
  evento("landing_pix_rolou", { order_id: estado.pix.orderId });
}, { passive: true });

/* ── 02/11: o estado do braço b (só visual; a conferência, o relógio e o "Já paguei" são os mesmos) ── */
/** a pessoa voltou do banco (≥ 5 s fora, ou por recarga) com este pedido ainda sem pagar: o cartão mostra o bloco "De volta?" */
let voltaVista: string | null = null;
/** 02/11 r2 (persona M2): como ela voltou — por recarga o título reconhece a volta ("De volta? Se já pagou…") */
let voltaVia: "aba" | "recarga" = "aba";
/** tocou "Já paguei" e o banco ainda não confirmou: "Conferindo com o banco…" por até 2,5 min, depois volta a "Esperando o Pix" com o aviso */
let conferindoDesde: number | null = null;
let conferindoTimer: number | null = null;
const CONFERINDO_MS = 150_000;
let motivoDado: string | null = null;


/* ── simulação (dev) ── */
const CODIGO_SIMULADO = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/SIMULACAO-SEM-COBRANCA-CORE52040000530398654052790" + "5802BR5904CORE6009SAO PAULO62070503***6304ABCD";
const espera = (ms: number) => new Promise((ok) => window.setTimeout(ok, ms));

/** Copiar NO TOQUE (o navegador só deixa copiar dentro do gesto): ClipboardItem com promessa (Safari/Chrome); senão, writeText depois. */
function copiarNoToque(codigo: Promise<string>): Promise<{ ok: boolean; via: string }> {
  try {
    const CI = (window as unknown as { ClipboardItem?: new (i: Record<string, Promise<Blob>>) => unknown }).ClipboardItem;
    if (CI && navigator.clipboard?.write) {
      const blob = codigo.then((t) => new Blob([t], { type: "text/plain" }));
      void blob.catch(() => null); // r2 (visitante-frio 3): quando não há Pix ("já tem conta"), a promessa rejeita — o ClipboardItem não conta como handler e o console acusava "Error: sem pix"
      const item = new CI({ "text/plain": blob });
      return navigator.clipboard.write([item as ClipboardItem]).then(() => ({ ok: true, via: "item" }), () => copiarTexto(codigo).then((ok) => ({ ok, via: "texto" })));
    }
  } catch { /* plano B */ }
  return copiarTexto(codigo).then((ok) => ({ ok, via: "texto" }));
}
async function copiarTexto(c: Promise<string> | string): Promise<boolean> {
  let t = "";
  try { t = await c; } catch { return false; }
  try { await navigator.clipboard.writeText(t); return true; } catch { /* plano C */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = t; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  } catch { return false; }
}

/* ── 29/10: o e-mail ANTES do Pix (braço "email") ── */
const campoAntes = document.getElementById("lp-email-antes") as HTMLInputElement | null;
const erroAntesEl = document.getElementById("lp-email-antes-erro");
const sugestaoEl = document.getElementById("lp-email-antes-sugestao") as HTMLButtonElement | null;
/** e-mail que já tem conta: a pessoa entra com o código ANTES do Pix (nada pago ainda) */
let antes: { fase: "codigo" | "entrando"; email: string; erro: string | null } | null = null;
let codigoAntes = "";

function mostrarErroAntes(msg: string | null) {
  if (!erroAntesEl || !campoAntes) return;
  erroAntesEl.textContent = msg ?? "";
  erroAntesEl.hidden = !msg;
  if (msg) campoAntes.setAttribute("aria-invalid", "true"); else campoAntes.removeAttribute("aria-invalid");
}
function atualizarSugestao() {
  if (!sugestaoEl || !campoAntes) return;
  const s = sugestaoDeEmail(campoAntes.value);
  sugestaoEl.hidden = !s;
  sugestaoEl.dataset.v = s ?? "";
  sugestaoEl.innerHTML = s ? `Você quis dizer <b>${esc(s)}</b>?` : "";
}

type FalhaEmail = { existe: true } | { erro: string; motivo: string };
type PassoEmail = { ok: true; via: string } | FalhaEmail;
type Gerado = PixLanding | { jaTem: true; via: string } | { erro: string; onde: string };

/** o e-mail do campo → a sessão que vai pagar (simulado: "+existe"/"+jatem" = e-mail com conta; "+falha" = erro) */
function passoDoEmail(email: string): Promise<PassoEmail> {
  if (SIMULADO) {
    return espera(450).then(() => (/\+(existe|jatem)@/.test(email) ? { existe: true as const }
      : /\+falha@/.test(email) ? { erro: "Não consegui salvar seu e-mail agora. Tenta de novo em alguns segundos.", motivo: "falhou" }
        : { ok: true as const, via: "nova" }));
  }
  return pg().then((m) => m.emailAntesDoPix(email)).catch(() => ({ erro: "Não consegui salvar seu e-mail agora. Tenta de novo em alguns segundos.", motivo: "falhou" }));
}
function passoDoCodigo(email: string, codigo: string): Promise<PassoEmail> {
  if (SIMULADO) return espera(500).then(() => (codigo.trim() === "12345678" ? { ok: true as const, via: "codigo" } : { erro: "Código errado ou vencido. Confere no seu e-mail.", motivo: "codigo_errado" }));
  return pg().then((m) => m.entrarAntesDoPix(email, codigo)).catch(() => ({ erro: "Não consegui entrar agora. Tenta de novo em alguns segundos.", motivo: "falhou" }));
}
function criarPix(oferta: OfertaLanding, emailConhecido: string | null): Promise<Gerado> {
  if (SIMULADO) {
    return espera(700).then(() => (w.__landingSimularJaTem || /\+jatem@/.test(emailConhecido ?? "")
      ? { jaTem: true as const, via: "servidor" }
      : { orderId: `simulado-${Date.now().toString(36)}`, qrCode: CODIGO_SIMULADO, qrCodeBase64: null, expiresAt: null, criadoEm: Date.now(), oferta }));
  }
  return pg().then((m) => m.gerarPix(oferta, URL_DE_CHEGADA, emailConhecido, contextoAtribuicao())).catch((e) => ({ erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(e).slice(0, 120) }));
}
async function mandarCodigo(email: string): Promise<boolean> {
  if (SIMULADO) { await espera(300); return true; }
  return pg().then((m) => m.pedirCodigo(email)).catch(() => false);
}

/**
 * O toque em pagar. Braço "livre": igual a sempre (Pix na hora). Braço "email": o e-mail do campo (ou o código, quando o
 * e-mail já tinha conta) vem antes, NA MESMA promessa — o código do Pix ainda vai pra área de transferência no toque.
 */
async function gerar(comCodigo: string | null = null): Promise<void> {
  if (estado.fase === "gerando" || antes?.fase === "entrando") return;
  const oferta = ofertaAtual();
  if (!SIMULADO && !PIX_REAL) {
    erroPix = "O pagamento por esta página ainda não está ligado.";
    evento("landing_erro", { onde: "pix_desligado" });
    render();
    return;
  }
  let emailAntes: string | null = null;
  if (brCheckout === "email") {
    if (antes && comCodigo !== null) emailAntes = antes.email;
    else {
      const ch = checarEmailAntes(campoAntes?.value ?? "");
      if ("motivo" in ch) {
        // r2 (oferta 4, v2): o rótulo do campo já diz "é por onde você entra no CORE" — o erro do vazio não repete a frase (1 linha)
        mostrarErroAntes(V2 && ch.motivo === "vazio" ? "Falta o seu e-mail pra gerar o Pix." : ch.msg);
        evento("landing_email_antes_erro", { motivo: ch.motivo });
        try { campoAntes?.focus(); } catch { /* noop */ }
        return;
      }
      emailAntes = ch.email;
      mostrarErroAntes(null);
    }
  }
  erroPix = null; copiado = null; avisoOferta = null;
  voltaVista = null; motivoDado = null; sairDoConferindo(); // 02/11 (b): um Pix novo começa limpo
  const anteriores = estado.pix && venceEm(estado.pix) > Date.now() ? [...estado.anteriores, estado.pix] : estado.anteriores;
  let t0 = Date.now();
  if (antes && comCodigo !== null) { antes = { ...antes, fase: "entrando", erro: null }; render(); }
  // Guarda o e-mail validado ANTES de importar o pagamento: uma recarga para
  // recuperar um chunk antigo volta à oferta preenchida, sem gerar outro Pix.
  else { salvar({ fase: "gerando", anteriores, ...(emailAntes ? { emailPix: emailAntes } : {}) }); rolarAte(card, "start"); }
  evento("landing_cta", { onde: comCodigo !== null ? "pagar_codigo" : "pagar", oferta });
  const emailConhecido = emailAntes ?? estado.email ?? estado.emailPix ?? lerCompra()?.email ?? null;
  const passo: Promise<PassoEmail> = emailAntes === null ? Promise.resolve({ ok: true as const, via: "livre" })
    : comCodigo !== null ? passoDoCodigo(emailAntes, comCodigo) : passoDoEmail(emailAntes);
  const pedido: Promise<Gerado | FalhaEmail> = passo.then<Gerado | FalhaEmail>((p) => {
    if (!("ok" in p)) return p;
    if (emailAntes !== null) evento("landing_email_antes_ok", { via: p.via });
    if (antes) { antes = null; salvar({ fase: "gerando", anteriores }); rolarAte(card, "start"); t0 = Date.now(); }
    return criarPix(oferta, emailConhecido);
  });
  // o código vai pra área de transferência AINDA no toque (a promessa resolve quando o QR chegar)
  const copia = copiarNoToque(pedido.then((p) => ("qrCode" in p ? p.qrCode : Promise.reject(new Error("sem pix")))));
  const r = await pedido;
  if ("existe" in r) {
    // 29/10: o e-mail já tem conta → código do e-mail ANTES do Pix (nada pago: entrar na conta dela é seguro)
    void copia.catch(() => null);
    if (!emailAntes) { salvar({ fase: "oferta" }); return; }
    const foi = await mandarCodigo(emailAntes);
    evento("landing_email_antes_erro", { motivo: foi ? "tem_conta" : "codigo_nao_enviado" });
    antes = { fase: "codigo", email: emailAntes, erro: foi ? null : "Não consegui mandar o código agora. Toque em “Mandar de novo”." };
    codigoAntes = "";
    salvar({ fase: "oferta" });
    rolarAte(card, "start");
    return;
  }
  if ("motivo" in r) {
    void copia.catch(() => null);
    evento("landing_email_antes_erro", { motivo: r.motivo });
    if (antes) { antes = { ...antes, fase: "codigo", erro: r.erro }; render(); return; }
    salvar({ fase: "oferta" });
    mostrarErroAntes(r.erro);
    return;
  }
  // a animação "Gerando o seu Pix…" dura pelo menos 1,2 s (dá tempo de ler; o Pix rápido não pisca)
  const falta = 1200 - (Date.now() - t0);
  if (falta > 0) await espera(falta);
  if ("jaTem" in r) {
    // 29/10: o servidor diz que esta pessoa JÁ tem o CORE pra sempre — nada de Pix novo
    void copia.catch(() => null);
    mostrarJaTem("servidor", emailAntes);
    return;
  }
  if ("erro" in r) {
    erroPix = r.erro;
    evento("landing_erro", { onde: "pix_create", msg: r.onde });
    salvar({ fase: "oferta" });
    return;
  }
  const c = await copia;
  copiado = c.ok;
  salvar({ fase: "qr", pix: r, ...(emailAntes ? { emailPix: emailAntes } : {}) });
  marcarQrNaTela(r.orderId); esquecerSaida();
  evento("landing_pix_gerado", { oferta, valor: VALOR_OFERTA[oferta], order_id: r.orderId, simulado: SIMULADO, email_antes: !!emailAntes });
  evento("landing_pix_copiado", { ok: c.ok, via: c.via, auto: true, order_id: r.orderId });
  pixel("InitiateCheckout", { value: VALOR_OFERTA[oferta], currency: "BRL", content_name: oferta }, `ic-${r.orderId}`);
  conferirEmLoop();
}

if (brCheckout === "email" && campoAntes) {
  if (estado.emailPix && !campoAntes.value) campoAntes.value = estado.emailPix;
  campoAntes.addEventListener("input", () => { mostrarErroAntes(null); if (sugestaoEl && !sugestaoEl.hidden) atualizarSugestao(); });
  campoAntes.addEventListener("blur", atualizarSugestao);
  campoAntes.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); void gerar(); } });
  sugestaoEl?.addEventListener("click", () => {
    const v = sugestaoEl.dataset.v;
    if (!v) return;
    campoAntes.value = v;
    atualizarSugestao();
    evento("landing_email_antes_sugestao", {});
  });
}

/* confirmação: a cada 3 s + na volta da aba (o banco) — reveza com os QRs anteriores ainda vivos */
let loop: number | null = null;
let vez = 0;
let conferindoPromessa: Promise<boolean> | null = null;
/** 02/11 r1 (técnico): com uma conferência em voo (o loop de 3 s), o "Já paguei" ESPERA a resposta dela em vez de receber `false` na hora
 * (a corrida mandava resultado:"nao" pra quem já estava pago e, no b, jogava a pessoa no "Conferindo com o banco…" sem precisar) */
function conferirUmaVez(): Promise<boolean> {
  if (!estado.pix || estado.fase !== "qr") return Promise.resolve(false);
  if (conferindoPromessa) return conferindoPromessa;
  if (SIMULADO) return Promise.resolve(false); // simulado: só o "Já paguei" (ou __landingSimular.pagar) confirma
  const alvoPix = estado.pix;
  conferindoPromessa = (async () => {
    try {
      const vivos = estado.anteriores.filter((a) => venceEm(a) > Date.now());
      const fila: PixLanding[] = vivos.length ? vivos.flatMap((v) => [alvoPix, v]) : [alvoPix];
      const alvo = fila[vez++ % fila.length];
      const m = await pg();
      if (await m.conferirPix(alvo, URL_DE_CHEGADA)) { pago(alvo); return true; }
    } catch { /* tenta de novo */ } finally { conferindoPromessa = null; }
    return false;
  })();
  return conferindoPromessa;
}
function conferirEmLoop() {
  if (loop) window.clearTimeout(loop);
  const passo = async () => {
    if (estado.fase !== "qr") return;
    await conferirUmaVez();
    if (estado.fase === "qr") loop = window.setTimeout(passo, 3000);
  };
  loop = window.setTimeout(passo, 3000);
}
const aoVoltar = () => { if (document.visibilityState === "visible" && estado.fase === "qr") void conferirUmaVez(); };
document.addEventListener("visibilitychange", aoVoltar);
window.addEventListener("pageshow", aoVoltar);

/* r1 (pix 3, v2): o Pix que acabou de vencer segue sendo conferido a cada 5 s por até 10 min (o banco pode confirmar depois do relógio) */
let loopVencido: number | null = null;
function conferirVencidoEmLoop() {
  if (!V2 || SIMULADO) return;
  if (loopVencido) window.clearTimeout(loopVencido);
  const passo = async () => {
    const p = vencido;
    if (!p || estado.fase === "pago" || estado.fase === "conta" || jaTem) return;
    if (Date.now() - venceEm(p) > JANELA_VENCIDO_MS) { vencido = null; return; }
    try {
      const m = await pg(false);
      if (await m.conferirPix(p, URL_DE_CHEGADA)) { vencido = null; avisoOferta = null; pago(p); return; }
    } catch { /* tenta de novo */ }
    if (vencido === p) loopVencido = window.setTimeout(passo, 5000);
  };
  loopVencido = window.setTimeout(passo, 2000);
}

function pago(p: PixLanding) {
  if (estado.fase === "pago" || estado.fase === "conta") return;
  if (loop) window.clearTimeout(loop);
  if (loopVencido) window.clearTimeout(loopVencido);
  vencido = null; avisoOferta = null;
  aviso = null; // 02/11 r1 (persona): "Ainda não chegou. Confere no app do banco…" sobrevivia até "Sua conta está pronta" (nos 2 braços)
  sairDoConferindo(); voltaVista = null; esquecerSaida(); // 02/11 (b)
  evento("landing_pix_pago", { oferta: p.oferta, valor: VALOR_OFERTA[p.oferta], order_id: p.orderId, simulado: SIMULADO });
  marcarCompra({ oferta: p.oferta, email: estado.emailPix }); // 29/10: sobrevive ao localStorage zerado (cookie)
  if (U2027) void carregarPos().catch(() => null); // 31/10: o módulo do 2027 (01/11: ou do presente) chega antes da conta pronta (sem tela em branco)
  u27Antes = U2027 && !!estado.emailPix; // 31/10 (o "glitch"): com o e-mail já dado, a oferta entra direto (sem o cartão "pago")
  salvar({ fase: "pago", pago: p, anteriores: [] });
  rolarAte(card, "start");
  // deu o e-mail na tela do QR (ou pagou logada): segue sozinho pra conta
  if (estado.emailPix) void prontoComEmail(estado.emailPix, "pix");
  else if (!SIMULADO) void pg().then((m) => m.emailDaSessaoAtual()).then((e) => { if (e) void prontoComEmail(e, "ja_logada"); }).catch(() => null);
}
w.__landingSimular = {
  pagar: () => { if (SIMULADO && estado.pix && estado.fase === "qr") pago(estado.pix); },
  pagarU2027: () => { if (SIMULADO) u27?.simularPago(); }, // 31/10: o Pix do 2027 simulado
};

/** 02/11 (b): sai do "Conferindo com o banco…" (pagou, venceu, Pix novo, ou os 2,5 min acabaram) */
function sairDoConferindo() {
  conferindoDesde = null;
  if (conferindoTimer) { window.clearTimeout(conferindoTimer); conferindoTimer = null; }
}
const avisoNaoChegou = () => (estado.pix?.doEmail
  ? "Se você já pagou, o acesso chega no seu e-mail em instantes."
  : "Ainda não chegou. Confere no app do banco — quando cair, esta tela muda sozinha.");
async function jaPaguei() {
  evento("landing_cta", { onde: "ja_paguei" });
  const pedido = estado.pix?.orderId ?? null;
  let ok: boolean;
  if (SIMULADO) { await espera(600); ok = !w.__landingSimularPixNaoCaiu; if (ok && estado.pix) pago(estado.pix); }
  else ok = await conferirUmaVez();
  // 02/11 (medição, nos 2 braços): quantos "Já paguei" estavam mesmo pagos (a página não sabia) × quantos não (landing_cta fica: os painéis dependem dele)
  evento("landing_pix_ja_paguei", { order_id: pedido, resultado: ok ? "pago" : "nao" });
  if (ok) return;
  if (PIXB && estado.fase === "qr") {
    // b: "Conferindo com o banco… pode fechar esta página" (10% das confirmações levam 10+ min); depois de 2,5 min sem pago, o aviso de hoje
    aviso = null;
    sairDoConferindo();
    conferindoDesde = Date.now();
    conferindoTimer = window.setTimeout(() => { if (conferindoDesde === null || estado.fase !== "qr") return; sairDoConferindo(); aviso = avisoNaoChegou(); render(); }, CONFERINDO_MS);
    render();
    return;
  }
  aviso = avisoNaoChegou();
  render();
}

async function salvarEmailPix(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo) || !estado.pix) return;
  let via: string | null = null;
  erroEmail = null;
  if (SIMULADO) {
    await espera(400);
    if (limpo.includes("+jatem")) { evento("landing_email_pix", { ok: false, via: "ja_tem" }); mostrarJaTem("email_pix", limpo); return; }
    via = limpo.includes("+existe") ? "destino" : "conta";
  } else {
    const r = await pg().then((m) => m.salvarEmailDoPix(estado.pix!, limpo)).catch(() => ({ erro: "Não consegui salvar agora." }));
    if ("jaTem" in r) { evento("landing_email_pix", { ok: false, via: "ja_tem" }); mostrarJaTem("email_pix", limpo); return; }
    if ("via" in r) via = r.via; else erroEmail = r.erro;
  }
  evento("landing_email_pix", { ok: !!via, via });
  if (via) salvar({ emailPix: limpo }); else render();
}

async function prontoComEmail(email: string, via: string) {
  const p = estado.pago;
  if (!p) return;
  if (SIMULADO && SIM_CONTA_MS) await espera(SIM_CONTA_MS);
  if (!SIMULADO) {
    try { await (await pg()).finalizarConta(p.orderId, { attr: atrib, braco_titulo: brTitulo, braco_oferta: brOferta, braco_checkout: brCheckout, braco_lp: brLp, oferta: p.oferta, ...contextoAtribuicao() }); } catch { /* o e-mail é extra */ }
  }
  // 31/10: a conta FINAL está pronta (a sessão já é a dela — código do e-mail + pix-vincular já passaram): o 2027 aparece no
  // render da "conta" e o Pix dele é pré-aquecido ali (./upsell-2027.ts) — depois do e-mail, nunca antes
  if (U2027) { try { await carregarPos(); } catch { /* sem o módulo: a conta pronta de sempre */ } }
  evento("landing_email", { via });
  marcarCompra({ oferta: p.oferta, email });
  salvar({ fase: "conta", email });
  avisarContaU27?.(); // 31/10: o Pix do 2027 (pré-aquecido na oferta antecipada) pode ser gerado agora
}

async function criarConta(email: string) {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo)) { erroEmail = "Esse e-mail parece errado. Confere e tenta de novo."; render(); return; }
  emailDigitado = limpo; erroEmail = null; faseConta = "salvando"; codigoPago = ""; render();
  if (SIMULADO) {
    await espera(700);
    if (limpo.includes("+existe")) { faseConta = "codigo"; render(); return; }
    faseConta = "email"; await prontoComEmail(limpo, "nova"); return;
  }
  const m = await pg();
  // pagou com o e-mail de destino (conta que já existia) → o servidor já levou a compra; aqui entra com o código
  const r = await m.criarConta(limpo);
  if (r.ok === true) { faseConta = "email"; await prontoComEmail(limpo, "nova"); return; }
  if ("existe" in r) {
    evento("landing_email", { via: "existe" });
    const foi = await m.pedirCodigo(limpo);
    faseConta = "codigo";
    if (!foi) erroEmail = "Não consegui mandar o código agora. Tenta de novo em alguns segundos.";
    render(); return;
  }
  faseConta = "email"; erroEmail = r.erro; render();
}

async function entrarComCodigo(codigo: string) {
  faseConta = "entrando"; erroEmail = null; render();
  if (SIMULADO) {
    await espera(600);
    if (codigo.trim() !== "12345678") { faseConta = "codigo"; erroEmail = "Código errado. Confere no seu e-mail."; render(); return; }
    faseConta = "email"; await prontoComEmail(emailDigitado, "codigo"); return;
  }
  const r = await (await pg()).entrarComCodigo(emailDigitado, codigo);
  if (!r.ok) { faseConta = "codigo"; erroEmail = "Código errado ou vencido. Confere no seu e-mail."; render(); return; }
  aviso = r.aviso ?? null;
  faseConta = "email"; await prontoComEmail(emailDigitado, "codigo");
}

/* ── o QR (a imagem da Asaas; no simulado/sem imagem, desenhado aqui — só baixa nesse caso) ── */
async function desenharQr(alvo: HTMLElement, p: Pick<PixLanding, "qrCode" | "qrCodeBase64">) {
  if (p.qrCodeBase64) { alvo.innerHTML = `<img alt="QR code do Pix" width="116" height="116" src="${esc(p.qrCodeBase64)}" />`; return; }
  try {
    const [{ createElement }, { createRoot }, { QRCodeSVG }] = await Promise.all([import("react"), import("react-dom/client"), import("qrcode.react")]);
    createRoot(alvo).render(createElement(QRCodeSVG, { value: p.qrCode, size: 116, level: "M" }));
  } catch { /* sem QR desenhado: o código copia-e-cola continua */ }
}

let relogio: number | null = null;
/* ── v3 (v2): o miolo da "conta pronta" — e-mail em caixa, selos das lojas primeiro (48 px), site secundário (no computador, principal),
 * como entrar (sem senha: código por e-mail — a pessoa nunca criou senha), 1º passo, contato. Usado na conta pronta E no "Você já tem o CORE"
 * (crítica r1 pix 9: quem voltava depois de comprar via o desenho antigo). ── */
function miolContaV2(email: string): string {
  // r2 (pix 6): sem target=_blank — dentro do navegador do Instagram (WKWebView) um _blank pode não abrir nada; a página já está em "conta" (nada a perder ao navegar na mesma aba)
  const selos = `<div class="lp2-selos lp-selos"><a href="${URL_APP_STORE}" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="144" height="48" /></a><a href="${esc(urlPlay("landing"))}" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="124" height="48" /></a></div>`;
  const site = `<div class="lp-form"><button type="button" class="${plataforma === "web" ? "lp-cta" : "lp2-btn2"}" id="lp-abrir">${plataforma === "web" ? `Abrir meu CORE ${ICO_SETA}` : "Ou abrir no site agora"}</button></div>`;
  return `
        ${email ? `<div class="lp2-email-caixa">${esc(email)}</div>` : ""}
        ${plataforma === "web" ? site + selos : selos + site}
        <p class="lp2-como-entrar">Pra entrar, toque em <b>Entrar sem senha</b>: o código chega ${email ? "neste e-mail" : "no seu e-mail"}. Os passos também vão por e-mail.</p>
        <div class="lp2-passo1"><b>1º passo:</b> anote o que entra e o que sai. O CORE mostra quanto você pode gastar hoje.</div>
        <p class="lp2-duvida-contato">Dúvida? contato@coreaplicativo.com.br</p>`;
}
/* 01/11 (dono: "o pessoal não lê… ela não clica em entrar"): o pós-compra dizia "entre com este e-mail" mas nunca QUAL
 * botão tocar no app — e o botão grande da 1ª tela do app é "Começar", que cria conta nova vazia. Das compradoras de
 * 25–31/10, 24% sumiram depois dos primeiros 15 min. Aqui o rodapé do app desenhado: errado apagado, certo circulado. */
function comoEntrarNoApp(email: string): string {
  return `<div class="lp-ce" data-testid="landing-como-entrar-app">
            <span class="lp-ce-tit">No app, toque aqui 👇</span>
            <div class="lp-ce-app" role="img" aria-label="No app, toque em Já tenho conta? Entrar, e não em Começar">
              <div class="lp-ce-comecar">Começar<span class="lp-ce-nao">✕ não é aqui</span></div>
              <div class="lp-ce-entrar">Já tenho conta? <span>Entrar</span></div>
              <div class="lp-ce-sim">✓ é aqui</div>
            </div>
            <p>Depois digite ${email ? `<strong>${esc(email)}</strong>` : "o e-mail da compra"} e o código de 8 números que chega nele. Sem senha, sem pagar de novo.</p>
          </div>`;
}
/** 29/10: o cartão "Você já tem o CORE" (a mesma cara da "Sua conta está pronta") no lugar da oferta. */
function renderJaTem(m: MarcaCompra) {
  card.dataset.fase = "conta";
  // crítica r1: quem saiu do 2027 pelo link do e-mail não lê "OFERTA ESPECIAL · HOJE" em cima do "Você já tem o CORE"
  if (jaTemDoLink) card.setAttribute("data-u27-link", ""); else card.removeAttribute("data-u27-link");
  const email = m.email ?? "";
  if (V2) {
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-ja-tem">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Você já tem o CORE</h3>
        <p>${email ? `Seu CORE já está liberado. ${plataforma === "web" ? "Entre com este e-mail, aqui ou no app:" : "Baixe o app e entre com este e-mail:"}` : "Seu CORE já está liberado. Entre com o e-mail que você usou na compra."}</p>
        ${miolContaV2(email)}
        ${jaTemDoLink ? "" : '<div class="lp-links"><button type="button" class="lp-link" id="lp-nao-fui-eu">Não fui eu que comprei</button></div>'}
      </div>`;
  } else caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-ja-tem">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Você já tem o CORE</h3>
        <p>${email ? `Seu CORE já está liberado. Entre com <b>${esc(email)}</b>.` : "Seu CORE já está liberado. Entre com o e-mail que você usou na compra."}</p>
        <div class="lp-form"><button type="button" class="lp-cta" id="lp-abrir">Abrir meu CORE ${ICO_SETA}</button></div>
        <div class="lp-loja-bloco">
          <b>Seu CORE também no celular</b>
          <p>Baixe na App Store ou Google Play e entre com ${email ? `este e-mail: <strong>${esc(email)}</strong>` : "o mesmo e-mail"}</p>
          <div class="lp-selos"><a href="${URL_APP_STORE}" target="_blank" rel="noopener" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="120" height="40" /></a><a href="${esc(urlPlay("landing"))}" target="_blank" rel="noopener" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="103" height="40" /></a></div>
          ${comoEntrarNoApp(email)}
        </div>
        ${jaTemDoLink ? "" : '<div class="lp-links"><button type="button" class="lp-link" id="lp-nao-fui-eu">Não fui eu que comprei</button></div>'}
      </div>`;
  $("lp-abrir").addEventListener("click", () => { evento("landing_abrir_core", { via: "ja_tem" }); location.href = "/home"; });
  caixa.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: "ja_tem" })));
  document.getElementById("lp-nao-fui-eu")?.addEventListener("click", () => { evento("landing_ja_tem_nao_fui_eu", {}); esquecerCompra(); jaTem = null; render(); });
  atualizarFixo();
}
/** r1 (pix 7, v2): o erro de gerar o Pix fica colado no botão de pagar (#lp-pagar-erro), não solto abaixo do CNPJ */
const erroNoBotao = (msg: string | null) => {
  const el = document.getElementById("lp-pagar-erro");
  if (!el) return false;
  el.textContent = msg ?? ""; el.hidden = !msg;
  return true;
};
/** r2 (oferta 5 / pix 1, v2): o aviso "Esse código venceu…" é a 1ª linha do cartão (antes de "Vitalício por"), não o rodapé depois do CNPJ —
 * quem volta do banco lê primeiro o que aconteceu. */
const avisoNoTopo = (msg: string | null) => {
  const corpo = card.querySelector(".lp-card-corpo");
  if (!corpo) return;
  let el = document.getElementById("lp2-aviso-topo");
  if (!msg) { el?.remove(); return; }
  if (!el) {
    el = document.createElement("p");
    el.id = "lp2-aviso-topo"; el.className = "lp-aviso lp2-aviso-topo"; el.setAttribute("role", "status"); el.dataset.testid = "landing-venceu";
    corpo.prepend(el);
  }
  el.textContent = msg;
};

function mostrarJaTem(via: "marcador" | "servidor" | "email_pix", email: string | null = null) {
  if (loop) window.clearTimeout(loop);
  if (via !== "marcador") marcarCompra({ email });
  jaTem = lerCompra() ?? { em: Date.now(), oferta: null, email };
  if (email && !jaTem.email) jaTem = { ...jaTem, email };
  evento("landing_ja_tem", { via });
  if (estado.fase !== "oferta") salvar({ fase: "oferta", pix: null, anteriores: [] }); else render();
}

/** 29/10 (braço "email"): o e-mail já tem conta → o código, ANTES do Pix. */
function renderCodigoAntes(a: NonNullable<typeof antes>) {
  card.dataset.fase = "codigo"; // o CSS esconde a oferta (qualquer fase ≠ "oferta")
  const entrando = a.fase === "entrando";
  caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-email-tem-conta">
        <h3>Esse e-mail já tem conta</h3>
        <p>Mandamos um código pra <b>${esc(a.email)}</b>. Digite aqui e o Pix sai na sua conta.</p>
        <div class="lp-form">
          <label for="lp-codigo-antes">Código de 8 números</label>
          <input class="lp-campo grande" id="lp-codigo-antes" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="00000000" value="${esc(codigoAntes)}" />
          <button type="button" class="lp-cta" id="lp-entrar-pagar" ${codigoAntes.trim().length >= 8 && !entrando ? "" : "disabled"}>${entrando ? '<i class="lp-gira"></i>Entrando…' : `Entrar e pagar ${reais(VALOR_OFERTA[ofertaAtual()])}`}</button>
          ${a.erro ? `<p class="lp-erro" role="alert">${esc(a.erro)}</p>` : ""}
        </div>
        <div class="lp-links"><button type="button" class="lp-link" id="lp-outro-email">Usar outro e-mail</button><button type="button" class="lp-link" id="lp-reenviar">Mandar de novo</button></div>
      </div>`;
  const c = $<HTMLInputElement>("lp-codigo-antes"); const b = $<HTMLButtonElement>("lp-entrar-pagar");
  c.addEventListener("input", () => { codigoAntes = c.value.replace(/\D/g, "").slice(0, 8); b.disabled = codigoAntes.length < 8 || antes?.fase === "entrando"; });
  c.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void gerar(codigoAntes); });
  b.addEventListener("click", () => { void gerar(codigoAntes); });
  $("lp-outro-email").addEventListener("click", () => {
    evento("landing_cta", { onde: "outro_email" });
    antes = null; codigoAntes = "";
    render();
    if (campoAntes) { campoAntes.value = ""; try { campoAntes.focus(); } catch { /* noop */ } }
  });
  $("lp-reenviar").addEventListener("click", async () => {
    if (!antes) return;
    evento("landing_cta", { onde: "reenviar_codigo" });
    const foi = await mandarCodigo(antes.email);
    if (antes) { antes = { ...antes, erro: foi ? null : "Não consegui mandar o código agora. Tenta de novo em alguns segundos." }; render(); }
  });
  atualizarFixo();
}

/*
 * CRÍTICA r1 4.1 (30/10, v2): a cada troca de "tela" do cartão (gerando → QR, erro, código do e-mail, pago, conta) a página
 * ROLA até o cartão. No v2 a ordem dos blocos é por CSS `order`, e o scroll anchoring do navegador (desligado no CSS,
 * overflow-anchor: none) empurrava a página ~580 px quando o QR aparecia — a pessoa via "Já paguei" sem QR. Com a âncora
 * desligada, a rolagem explícita garante o QR/passos/Copiar no topo da tela. No atual nada muda (o DOM já está na ordem visual).
 */
/* ───────────────────────── 02/11: a tela do Pix do braço b — "Recibo da marca" ─────────────────────────
 * Conceito 3 (novidades-guardadas/2026-11-02/pix-b/conceito-3) + os enxertos dos 4 juízes: o passo vira o título ACIMA do botão;
 * "confirma sozinha" na pílula (com a variante doEmail); rótulo "No banco aparece" com o nome + "É o nome da nossa empresa · CNPJ"
 * (o mesmo CNPJ que o Mercado Pago imprime); "cobra 1 vez só" junto do preço (o Inter mostra "Pagamento recorrente" em laranja);
 * sem explicar "Asaas"/"recorrente" (dono 02/11: "não precisa dessa mensagem"); "Acesso vitalício" no rótulo (dono 02/11); "De volta? Se ficou alguma dúvida:" (nunca "não pagou":
 * 10% das confirmações levam 10+ min); chips por chave própria; "Ver QR code" ↔ "Esconder QR"; "Conferindo com o banco…" com saída
 * em 2,5 min; magenta só no ponto da pílula. A fase `pago` é a de hoje nos 2 braços. Ids de hoje mantidos: #lp-copiar, #lp-ja-paguei,
 * #lp-validade, #lp-qr, [data-testid=landing-codigo], #lp-email-pix/#lp-email-pix-ok, #lp-mudar. */
const ICO_CHECK_B = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const pedidoCurto = (orderId: string) => orderId.replace(/[^A-Za-z0-9]/g, "").slice(-6).toUpperCase();
const estadoPixB = (p: PixLanding): "qr" | "voltou" | "conferindo" => (conferindoDesde !== null ? "conferindo" : voltaVista === p.orderId ? "voltou" : "qr");
function htmlPixB(p: PixLanding): string {
  const est = estadoPixB(p);
  const emailConhecido = estado.emailPix ?? null;
  const promete = brCheckout === "email" || !!p.doEmail; // hoje (checkout "email") todo mundo cai aqui
  const rotulo = p.oferta === "LN_ano279" ? ROTULO_OFERTA[p.oferta] : "Acesso vitalício · cobra 1 vez só";
  /* r2 (persona A1/M1/M2, visual A1/M2): os 3 estados mudam SÓ o passo, o botão e a pílula — o recibo (No banco aparece / Garantia /
   * Acesso) fica INTEIRO nos 3, porque é ele que responde a quem voltou do banco sem pagar (38% das voltas), o alvo deste braço.
   *   qr          "Código Pix copiado." + botão PRETO + "Esperando o Pix · vale por".
   *   voltou      1ª linha pra quem pagou ("Pagou? Confirma em instantes." — por recarga: "De volta? Se já pagou…"), 2ª pra quem não
   *               ("O código continua copiado, se precisar." — nunca "não pagou": 10% das confirmações levam 10+ min); botão de CONTORNO
   *               (quem acabou de voltar não recebe "copiar de novo" como ação principal); "Falar com a gente" na linha dos links; chips do PIX_MOTIVO logo abaixo da pílula.
   *   conferindo  passo "Conferindo com o banco…", SEM botão (quem precisar copiar abre o QR), pílula "Pode fechar esta página" + o e-mail
   *               (1× só), sem "vale por" (a validade não interessa a quem já pagou). */
  const passo = est === "voltou"
    ? `<div class="lp-pixb-passo" data-testid="landing-pixb-passo"><b>${voltaVia === "recarga" ? "De volta? Se já pagou, confirma em instantes." : "Pagou? Confirma em instantes."}</b><span>${copiado ? "O código continua copiado, se precisar." : "Se precisar, é só copiar o código."}</span></div>`
    : est === "conferindo"
    ? `<div class="lp-pixb-passo" data-testid="landing-pixb-passo"><b>Conferindo com o banco…</b><span>Às vezes leva alguns minutos.</span></div>`
    : `<div class="lp-pixb-passo" data-testid="landing-pixb-passo"><b>${copiado ? "Código Pix copiado." : "Copie o código Pix."}</b><span>Abra o banco → Pix → Copia e Cola.</span></div>`;
  const botao = est === "conferindo" ? ""
    : `<button type="button" class="lp-pixb-cta${est === "voltou" ? " contorno" : ""}" id="lp-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código Pix"}</span></button>`;
  // a pílula em 2 linhas de propósito (em 390 "Esperando o Pix · confirma sozinha · vale por 29:59" não cabe numa): status + validade em cima,
  // "confirma sozinha" embaixo — a frase que segura quem sai pro banco, com a variante doEmail (sem sessão: o acesso chega pelo e-mail)
  const chega = emailConhecido ? `O acesso chega em <b>${esc(emailConhecido)}</b>` : promete ? "O acesso chega no seu e-mail" : "Esta tela confirma sozinha";
  const statusTxt = est === "conferindo" ? "Pode fechar esta página" : "Esperando o Pix";
  const vale = est === "conferindo" ? "" : `<span class="vale" id="lp-validade">vale por ${mmss(venceEm(p) - Date.now())}</span>`;
  const statusSub = est === "conferindo"
    ? `<small data-testid="landing-pixb-conferindo">${chega} assim que o Pix cair.</small>`
    : `<small>${p.doEmail ? `Quando o Pix cair, o acesso chega no seu <span style="white-space:nowrap">e-mail.</span>` : "Confirma sozinha. Pode ir ao banco e voltar."}</small>`; // r1: "pode fechar" só no conferindo (o Instagram zera o storage ao fechar)
  const chips = est === "voltou" && PIX_MOTIVO ? (motivoDado
    ? `<p class="lp-pixb-chips" data-testid="landing-pixb-motivo-ok"><span>Anotado. Obrigada!</span></p>`
    : `<div class="lp-pixb-chips" data-testid="landing-pixb-chips"><span>O que te travou?</span><button type="button" data-motivo="nome">O nome no banco</button><button type="button" data-motivo="valor">O valor</button><button type="button" data-motivo="depois">Deixo pra depois</button><button type="button" data-motivo="outro">Outra coisa</button></div>`) : "";
  const acesso = emailConhecido
    ? `<dd data-testid="landing-email-garantido">${esc(emailConhecido)}</dd>`
    : promete
    ? `<dd data-testid="landing-email-garantido">no seu e-mail</dd>`
    : `<dd><label for="lp-email-pix" class="lp-pixb-rotulo-campo">Seu e-mail, se quiser · pra entrar no app depois</label><div class="lp-linha"><input class="lp-campo" id="lp-email-pix" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" /><button type="button" class="lp-mini" id="lp-email-pix-ok" disabled>Salvar</button></div>${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}</dd>`;
  return `
      <div class="lp-pixb" data-testid="landing-pixb" data-estado="${est}">
        <div class="lp-pixb-topo"><span class="lp-pixb-marca">CORE</span><span class="lp-pixb-pedido">Pedido ${esc(pedidoCurto(p.orderId))}</span></div>
        <div class="lp-pixb-valor"><b>${reais(VALOR_OFERTA[p.oferta])}</b><span>${esc(rotulo)}</span></div>
        ${passo}
        ${botao}
        <div class="lp-pixb-status${est === "conferindo" ? " conferindo" : ""}" data-testid="landing-pixb-status"><span class="lado"><i class="pt"></i><span>${statusTxt}</span></span>${vale}${statusSub}</div>
        ${chips}
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        <div class="lp-pixb-qr${qrAbertoPedidos.has(p.orderId) ? " aberto" : ""}" id="lp-qr-dobrado"><div class="lp-qr" id="lp-qr"></div><div class="lp-codigo" data-testid="landing-codigo">${esc(p.qrCode)}</div></div>
        <dl class="lp-pixb-linhas">
          <div class="lp-pixb-l" data-testid="landing-pixb-banco"><dt>No banco aparece</dt><dd>${esc(NOME_NO_BANCO)}<small><span>Nossa empresa · CNPJ ${CNPJ_NO_BANCO}</span></small></dd></div>
          <div class="lp-pixb-l"><dt>Garantia</dt><dd>7 dias · devolvemos 100% no Pix</dd></div>
          <div class="lp-pixb-l"><dt>Acesso</dt>${acesso}</div>
        </dl>
        <div class="lp-links"><button type="button" class="lp-link" id="lp-ver-qr">${qrAbertoPedidos.has(p.orderId) ? "Esconder QR" : "Ver QR code"}</button><button type="button" class="lp-link" id="lp-ja-paguei"${est === "conferindo" ? " disabled" : ""}>${est === "conferindo" ? "Conferindo…" : "Já paguei"}</button>${brOferta === "ano" ? `<button type="button" class="lp-link" id="lp-mudar">Mudar o plano</button>` : ""}${est === "voltou" ? `<a class="lp-link" href="mailto:contato@coreaplicativo.com.br" id="lp-pixb-falar">Falar com a gente</a>` : ""}</div>
      </div>`;
}

let telaRenderizada: string | null = null;
function render() {
  renderDoCartao();
  if (!V2) return;
  reSemear();
  const tela = `${estado.fase}|${antes ? "codigo" : ""}|${erroPix ? "erro" : ""}|${jaTem ? "jatem" : ""}|${avisoOferta ? "venceu" : ""}${u27Tela && u27 ? `|u27-${u27.etapa()}` : ""}`;
  if (tela === telaRenderizada) return;
  const primeira = telaRenderizada === null;
  telaRenderizada = tela;
  if (primeira && tela === "oferta||||") return; // a página abrindo na oferta: nada a rolar
  if (cheiaAberta) fecharCheiaJa("fase"); // a tela do cartão mudou (ex.: pagou no banco com a demo aberta) — a página precisa estar solta pra rolar
  rolarAte(card, "start", !primeira); // no arranque (Pix vivo / pago / conta): direto, sem a página "descendo" (r1 pix 4)
}
function renderDoCartao() {
  if (relogio) { window.clearInterval(relogio); relogio = null; }
  u27Tela = u2027Toma(); // 31/10: o "Seu 2027" toma o cartão (chave ligada + conta pronta, ou o link do e-mail)
  paginaDoU2027();
  if (u27Tela) { atualizarFixo(); return; }
  if (u27) card.removeAttribute("data-u27");
  if (jaTem && (estado.fase === "oferta" || estado.fase === "erro")) { renderJaTem(jaTem); return; }
  if (antes && estado.fase === "oferta") { renderCodigoAntes(antes); return; }
  card.dataset.fase = estado.fase === "erro" ? "oferta" : estado.fase;
  const f = estado.fase;
  if (V2) { erroNoBotao(f === "oferta" ? erroPix : null); avisoNoTopo(f === "oferta" ? avisoOferta : null); atualizarBotao(); }
  if (f === "oferta") {
    caixa.innerHTML = erroPix && !(V2 && document.getElementById("lp-pagar-erro")) ? `<p class="lp-erro" role="alert">${esc(erroPix)}</p>` : "";
  } else if (f === "gerando") {
    caixa.innerHTML = `<div class="lp-pix-gerando" data-testid="landing-gerando"><span class="lp-pix-logo">${ICO_PIX}</span><b>Gerando o seu Pix…</b><div class="lp-progresso"><i></i></div><span>${V2 ? "Sem CPF. Leva 2 segundos." : "Sem CPF, sem cadastro. Leva 2 segundos."}</span></div>`;
  } else if (f === "qr" && estado.pix) {
    const p = estado.pix;
    if (U2027 && presenteNaTela()) void carregarPresente().catch(() => null); // 01/11: o módulo do presente já chega com o QR na tela
    else if (U2027) void carregarU2027().then((m) => m.preaquecerFolhasU27(estado.emailPix ?? estado.email ?? null, p.orderId)).catch(() => null); // 31/10 (o "glitch"): o módulo do 2027 já chega com o QR na tela (r2: e as folhas da página)
    // 30/10 (v2): 3 passos curtos no lugar da caixa verde + "Pagou? Volte aqui" (quem volta do banco paga 81%; quem não
    // paga sai ~4 s depois do QR — lp-web/funil §3c) + a garantia perto do código. O braço atual segue IGUAL.
    const passosV2 = V2 ? `
      <ol class="lp2-passos" data-testid="landing-passos">
        <li${copiado ? ' class="feito"' : ""}><span>${copiado ? "<b>Código Pix copiado.</b> Se precisar, toque em Copiar de novo." : "<b>Copie o código Pix</b> (botão abaixo)."}</span></li>
        <li><span>Abra o app do seu <b>banco</b> e vá em Pix.</span></li>
        <li><span>Escolha <b>Pix Copia e Cola</b>, cole o código e confirme.</span></li>
      </ol>` : "";
    const esperando = V2
      ? `<div class="lp2-volte" data-testid="landing-volte"><i class="lp-ponto"></i><span><b>Pagou? Volte aqui.</b>${p.doEmail ? " Quando o pagamento cair, o acesso chega no seu e-mail." : " O acesso abre na hora: esta tela confirma sozinha."}<span class="lp2-vale" id="lp-validade">Este código vale por ${mmss(venceEm(p) - Date.now())}</span></span></div>
         <p class="lp2-garantia-mini">${ICO_CHECK}<span>7 dias de garantia · devolvemos 100%</span></p>`
      : `<div class="lp-esperando"><i class="lp-ponto"></i><span><b>Esperando o pagamento</b>${p.doEmail ? "Quando o pagamento cair, o acesso chega no seu e-mail." : "Esta tela confirma sozinha quando o pagamento entrar."}</span></div>`;
    // v3 (v2): QR e código lado a lado (a tela inteira — passos, QR, Copiar e "Volte aqui" — cabe em 390×690 com o cartão no topo)
    const qrECodigo = V2
      ? `<div class="lp2-qr-linha"><div class="lp-qr" id="lp-qr"></div><div class="lp2-qr-lado"><p class="lp2-qr-dica">Ou leia o QR code com a câmera do banco, em outro aparelho.</p><div class="lp-codigo lp2-codigo" data-testid="landing-codigo">${esc(p.qrCode)}</div><button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="lp-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código Pix"}</span></button></div></div>`
      : `<div class="lp-qr-linha"><div class="lp-qr" id="lp-qr"></div><div class="lp-qr-dica">${copiado ? "Ou leia o <b>QR code</b> com a câmera do banco." : "<b>Copie o código</b> e cole no banco em Pix Copia e Cola."}<span class="lp-qr-nome">No banco, o CORE aparece como <b>${esc(NOME_NO_BANCO)}</b>.</span></div></div>
      <div class="lp-codigo" data-testid="landing-codigo">${esc(p.qrCode)}</div>
      <button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="lp-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código Pix"}</span></button>`;
    caixa.innerHTML = PIXB ? htmlPixB(p) : `
      <div class="lp-pix-valor"><b>${reais(VALOR_OFERTA[p.oferta])}</b><span>${esc(V2 && p.oferta === "LN_sempre279" ? "Vitalício · pagamento único" : !V2 && ehPraSempreOferta(p.oferta) ? "Pra sempre · 7 dias de garantia" : ROTULO_OFERTA[p.oferta])}</span></div>
      ${copiado && !V2 ? `<div class="lp-copiado" data-testid="landing-copiado">${ICO_CHECK}<span><b>Código Pix copiado</b>Agora abra o app do seu banco: Pix → Copia e Cola.</span></div>` : ""}
      ${passosV2}
      ${qrECodigo}
      ${esperando}
      ${V2 ? "" : `<div class="lp-validade" id="lp-validade">Este código vale por ${mmss(venceEm(p) - Date.now())}</div>`}
      ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
      <div class="lp-email-opc">${brCheckout === "email" || p.doEmail
        ? (estado.emailPix
          ? `<div class="lp-ok-linha" data-testid="landing-email-garantido">${ICO_CHECK}<span>Pagou e a página fechou? O acesso chega em <b>${esc(estado.emailPix)}</b>.</span></div>`
          : `<div class="lp-ok-linha" data-testid="landing-email-garantido">${ICO_CHECK}<span>Pagou e a página fechou? O acesso chega no seu e-mail.</span></div>`)
        : estado.emailPix
        ? `<div class="lp-ok-linha">${ICO_CHECK}<span>O acesso também vai pra <b>${esc(estado.emailPix)}</b>.</span></div>`
        : `<label for="lp-email-pix">${V2 ? "Seu e-mail (se quiser) · pra entrar no app depois" : 'Seu e-mail pra garantir o acesso <span style="font-weight:500">(opcional)</span>'}</label>
           <div class="lp-linha"><input class="lp-campo" id="lp-email-pix" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" /><button type="button" class="lp-mini" id="lp-email-pix-ok" disabled>Salvar</button></div>
           ${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}`}</div>
      <div class="lp-links"><button type="button" class="lp-link" id="lp-ja-paguei">${V2 ? "Já paguei e não mudou?" : "Já paguei"}</button>${brOferta === "ano" ? `<button type="button" class="lp-link" id="lp-mudar">Mudar o plano</button>` : ""}</div>`;
    void desenharQr($("lp-qr"), p);
    document.getElementById("lp-copiar")?.addEventListener("click", async () => { // r2: no b em "conferindo" o botão não existe
      const ok = await copiarTexto(p.qrCode);
      const antesJa = copiado;
      copiado = ok || copiado;
      evento("landing_pix_copiado", { ok, via: "botao", auto: false, order_id: p.orderId });
      evento("landing_pix_copiar_manual", { ok, order_id: p.orderId }); // 02/11 (medição, nos 2 braços): o toque, separado do auto:true
      if (copiado !== antesJa || !(V2 || PIXB)) render();
      // r2 (visitante-frio 1, v2): quem toca em "Copiar de novo" é quem duvida que copiou — o botão responde "Copiado ✓" por 1,5 s (sem re-render)
      if ((V2 || PIXB) && ok) {
        const rot = document.querySelector<HTMLElement>("#lp-copiar span");
        if (rot) { const antes = rot.textContent; rot.textContent = "Copiado ✓"; window.setTimeout(() => { if (rot.isConnected && rot.textContent === "Copiado ✓") rot.textContent = antes; }, 1500); }
      }
    });
    $("lp-ja-paguei").addEventListener("click", (ev) => {
      // 31/10 (crítica r1 compradora BAIXA 5, só com o 2027 ligado): o toque responde na hora — o corte pra página é a resposta
      if (U2027) { const b = ev.currentTarget as HTMLButtonElement; b.textContent = "Conferindo…"; b.disabled = true; }
      void jaPaguei();
    });
    // 29/10 (dono): no vitalício só existe 1 plano — o "Mudar o plano" só tirava a pessoa do Pix gerado; fica só no braço "ano" (caixinha)
    document.getElementById("lp-mudar")?.addEventListener("click", () => { evento("landing_cta", { onde: "mudar_plano" }); aviso = null; salvar({ fase: "oferta" }); });
    if (PIXB) {
      // r2 (persona A1): o "Ficou alguma dúvida? Ver" saiu — o recibo fica inteiro no estado voltou; "Falar com a gente" na linha dos links
      document.getElementById("lp-pixb-falar")?.addEventListener("click", () => evento("landing_pix_falar", { order_id: p.orderId }));
      // b: o QR + código dobrados em "Ver QR code" (quem lê em outro aparelho acha); 1 evento por pedido na 1ª abertura — os ~9% que pagam sem voltar não podem cair
      document.getElementById("lp-ver-qr")?.addEventListener("click", (ev) => {
        const caixaQr = document.getElementById("lp-qr-dobrado"); const b = ev.currentTarget as HTMLButtonElement;
        if (!caixaQr) return;
        const abriu = caixaQr.classList.toggle("aberto");
        b.textContent = abriu ? "Esconder QR" : "Ver QR code";
        if (abriu) qrAbertoPedidos.add(p.orderId); else qrAbertoPedidos.delete(p.orderId);
        if (abriu && !qrAbertoAvisado.has(p.orderId)) { qrAbertoAvisado.add(p.orderId); evento("landing_pix_qr_aberto", { order_id: p.orderId }); }
      });
      document.querySelectorAll<HTMLButtonElement>(".lp-pixb-chips button[data-motivo]").forEach((b) => b.addEventListener("click", () => {
        motivoDado = b.dataset.motivo ?? "outro";
        evento("landing_pix_motivo", { order_id: p.orderId, motivo: motivoDado });
        render();
      }));
    }
    const campo = document.getElementById("lp-email-pix") as HTMLInputElement | null;
    if (campo) {
      const btn = $<HTMLButtonElement>("lp-email-pix-ok");
      campo.addEventListener("input", () => { btn.disabled = !EMAIL_OK.test(campo.value.trim()); });
      const salvarDoCampo = () => { btn.disabled = true; btn.textContent = "…"; void salvarEmailPix(campo.value); };
      btn.addEventListener("click", salvarDoCampo);
      // r2 (pix 2): o "ir" do teclado também salva (a pessoa toca Enter e acha que salvou)
      campo.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && EMAIL_OK.test(campo.value.trim())) { ev.preventDefault(); salvarDoCampo(); } });
    }
    relogio = window.setInterval(() => {
      if (!caixa.isConnected) { window.clearInterval(relogio!); return; } // a página foi trocada por baixo (só nos testes): o relógio velho cala
      const el = document.getElementById("lp-validade");
      const resta = venceEm(p) - Date.now();
      if (el) el.textContent = PIXB ? (resta > 0 ? `vale por ${mmss(resta)}` : "venceu") : resta > 0 ? `Este código vale por ${mmss(resta)}` : "Este código venceu.";
      if (resta > 0) for (const barra of barrasDePreco()) { const fv = barra.querySelector<HTMLElement>(".lp2-fixo-p span"); if (fv) fv.textContent = `vale por ${mmss(resta)}`; }
      if (resta <= 0) {
        window.clearInterval(relogio!);
        sairDoConferindo(); voltaVista = null; esquecerSaida(); // 02/11 (b)
        if (V2) { vencido = p; avisoOferta = avisoVenceu(!!(estado.emailPix || lerCompra()?.email)); try { ss(`landing-venceu-${p.orderId}`, "1"); } catch { /* noop */ } evento("landing_pix_venceu", { order_id: p.orderId, via: "relogio" }); }
        salvar({ fase: "oferta" });
        conferirVencidoEmLoop();
      }
    }, 1000);
  } else if (f === "pago" && u27Antes && estado.emailPix) {
    // 31/10: a oferta antecipada saiu ("Agora não") antes de a conta ficar pronta — o e-mail já foi dado: só espera a conta
    caixa.innerHTML = `<div class="lp-pago" data-testid="landing-preparando-conta"><div class="lp-pix-gerando"><b>Preparando sua conta…</b><div class="lp-progresso"><i></i></div></div></div>`;
  } else if (f === "pago") {
    const codigo = faseConta === "codigo" || faseConta === "entrando";
    // v3 (v2, braço livre): "Pronto! Falta o seu e-mail." — o e-mail é por onde a pessoa entra no app da loja (2 em 94 pagaram sem e-mail e não entraram)
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-pago">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>${V2 && !codigo ? "Pronto! Falta o seu e&#8209;mail." : "Pagamento confirmado!"}</h3>
        <p>${codigo ? `Esse e-mail já tem conta. Mandamos um código pra <b>${esc(emailDigitado)}</b>.` : V2 ? "Pagamento confirmado. O e-mail é por onde você entra no CORE, no celular e no computador." : "Agora só falta o seu e-mail pra criar sua conta."}</p>
        <div class="lp-form">
          ${codigo
            ? `<label for="lp-codigo">Código de 8 números</label><input class="lp-campo grande" id="lp-codigo" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="00000000" value="${esc(codigoPago)}" />
               <button type="button" class="lp-cta" id="lp-entrar" ${codigoPago.trim().length >= 8 && faseConta !== "entrando" ? "" : "disabled"}>${faseConta === "entrando" ? '<i class="lp-gira"></i>' : ""}Entrar e liberar meu CORE</button>`
            : `<label for="lp-email">Seu e-mail</label><input class="lp-campo grande" id="lp-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" placeholder="voce@email.com" value="${esc(emailDigitado)}" />
               <button type="button" class="lp-cta" id="lp-criar" ${EMAIL_OK.test(emailDigitado) && faseConta !== "salvando" ? "" : "disabled"}>${faseConta === "salvando" ? '<i class="lp-gira"></i>Criando sua conta…' : `${V2 ? "Liberar meu acesso" : "Criar minha conta"} ${ICO_SETA}`}</button>`}
          ${erroEmail ? `<p class="lp-erro" role="alert">${esc(erroEmail)}</p>` : ""}
        </div>
      </div>`;
    if (codigo) {
      const c = $<HTMLInputElement>("lp-codigo"); const b = $<HTMLButtonElement>("lp-entrar");
      // r2 (pix 3): o digitado sobrevive ao re-render do erro ("Código errado…"), como no código ANTES do Pix
      c.addEventListener("input", () => { codigoPago = c.value.replace(/\D/g, "").slice(0, 8); b.disabled = codigoPago.length < 8; });
      c.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void entrarComCodigo(c.value); });
      b.addEventListener("click", () => { void entrarComCodigo(c.value); });
    } else {
      const e = $<HTMLInputElement>("lp-email"); const b = $<HTMLButtonElement>("lp-criar");
      e.addEventListener("input", () => { emailDigitado = e.value; b.disabled = !EMAIL_OK.test(e.value.trim()); });
      e.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !b.disabled) void criarConta(e.value); });
      b.addEventListener("click", () => { void criarConta(e.value); });
    }
  } else if (f === "conta" && V2) {
    // v3: levar pro app da loja AGORA com o e-mail certo. Selos primeiro e grandes (quem abre o app da loja no dia 0 volta 43% no D1;
    // só no site, 15%), o site como secundário, o 1º passo em destaque (ação real no dia 0 → D1 49%). No computador, o site vem primeiro.
    const email = estado.email ?? "";
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-conta">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Sua conta está pronta.</h3>
        <p>${ehPraSempreTxt()} ${plataforma === "web" ? "Entre com este e-mail, aqui ou no app:" : "Baixe o app e entre com este e-mail:"}</p>
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        ${miolContaV2(email)}
      </div>`;
    $("lp-abrir").addEventListener("click", () => { evento("landing_abrir_core", {}); location.href = "/home"; });
    caixa.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: "pos_compra" })));
  } else if (f === "conta") {
    const email = estado.email ?? "";
    caixa.innerHTML = `
      <div class="lp-pago" data-testid="landing-conta">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Sua conta está pronta</h3>
        <p>${ehPraSempreTxt()} Entre com <b>${esc(email)}</b>.</p>
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        <div class="lp-form"><button type="button" class="lp-cta" id="lp-abrir">Abrir meu CORE ${ICO_SETA}</button></div>
        <div class="lp-loja-bloco">
          <b>Seu CORE também no celular</b>
          <p>Baixe na App Store ou Google Play e entre com este e-mail: <strong>${esc(email)}</strong></p>
          <div class="lp-selos"><a href="${URL_APP_STORE}" target="_blank" rel="noopener" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="120" height="40" /></a><a href="${esc(urlPlay("landing"))}" target="_blank" rel="noopener" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="103" height="40" /></a></div>
          ${comoEntrarNoApp(email)}
        </div>
      </div>`;
    $("lp-abrir").addEventListener("click", () => { evento("landing_abrir_core", {}); location.href = "/home"; });
    caixa.querySelectorAll<HTMLAnchorElement>("a[data-loja]").forEach((a) => a.addEventListener("click", () => evento("landing_loja", { loja: a.dataset.loja, onde: "pos_compra" })));
  }
  atualizarFixo();
}
const ehPraSempreTxt = () => (estado.pago && estado.pago.oferta !== "LN_ano279" ? (V2 ? "O CORE é seu pra sempre." : "Seu CORE é seu pra sempre.") : "Seu CORE está liberado por 1 ano.");

$("lp-pagar").addEventListener("click", () => { void gerar(); });

/* ───────────────────────── /vida: o checkout Hotmart (04/11, ./hotmart.ts) ───────────────────────── */
/* O preço do braço Hotmart sai de HOTMART_PRECO_CENTAVOS (o HTML já vem com o mesmo número escrito — sem piscar) e a linha das
 * parcelas de HOTMART_PARCELAS_TEXTO ("" = some, o <head> já escondeu antes de pintar). */
if (EXTERNO) {
  const r = reaisDeCentavos(PRECO_EXT);
  document.querySelectorAll<HTMLElement>("[data-hm-preco]").forEach((el) => {
    if (el.dataset.hmPreco === "partes") { const [int, cent] = r.split(","); el.innerHTML = `${esc(int)}<small>,${esc(cent)}</small>`; }
    else el.textContent = r;
  });
  document.querySelectorAll<HTMLElement>("[data-hm-parcelas]").forEach((el) => { if (PARCELAS_EXT) el.textContent = PARCELAS_EXT; else el.remove(); });
  atualizarRotulos();
}
const URL_HOTMART_INICIAR = "https://itoylenzvahbscgjgtqf.supabase.co/functions/v1/hotmart-iniciar";
/** o token da sessão do Supabase guardada neste navegador (a anônima da demo/compra, se houver) — sem baixar o supabase-js */
function tokenDaSessao(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
      const t = (JSON.parse(localStorage.getItem(k) || "null") as { access_token?: unknown } | null)?.access_token;
      if (typeof t === "string" && t.length > 20) return t;
    }
  } catch { /* sem storage */ }
  return null;
}
/** grava o pedido no servidor (hotmart-iniciar): a ref volta no sck do webhook e liga a compra à sessão, ao fbp/fbc e ao anúncio. */
function registrarPedidoHotmart(ref: string): Promise<boolean> {
  if (!PRODUCAO) return Promise.resolve(true); // fora do domínio: nada sai (o teste e o dev só veem o redirect)
  const token = tokenDaSessao();
  try {
    return fetch(URL_HOTMART_INICIAR, {
      method: "POST", keepalive: true,
      headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${token ?? KEY}` },
      body: JSON.stringify({
        ref, fbp: lerCookie("_fbp"), fbc: lerCookie("_fbc"), fbclid: BUSCA.get("fbclid"), url: URL_DE_CHEGADA.slice(0, 500),
        landing_session_id: sessao, landing_device_id: aparelho, atrib, preco_centavos: HM_PRECO, braco_vida: BRACO_VIDA,
      }),
    }).then((r) => r.ok, () => false);
  } catch { return Promise.resolve(false); }
}
let indoHotmart = false;
/** test/QA: em vez de sair da página, guarda a URL (o jsdom não navega) */
type JanelaHm = Window & { __landingIrPara?: (url: string) => void };
async function irHotmart() {
  if (indoHotmart) return;
  indoHotmart = true;
  const botao = $(ID_BOTAO_HM);
  botao.setAttribute("aria-busy", "true");
  porRotulo(botao, "Abrindo o pagamento…");
  const ref = novoId();
  const email = (estado.email || estado.emailPix || lerCompra()?.email || "").trim() || null;
  const src = atrib.utm_content || atrib.ad_id || null;
  const url = urlCheckoutHotmart(HM_URL, { ref: REF_OK.test(ref) ? ref : novoId(), src, email });
  evento("landing_hotmart_redirect", { ref, src, com_email: !!email, valor: HM_PRECO / 100 });
  pixel("InitiateCheckout", { value: HM_PRECO / 100, currency: "BRL", content_name: "vida_hotmart" }, `ic-${ref}`);
  // o registro tem até 1,5 s (keepalive: segue mesmo depois de a página sair); falhar não segura a venda — o webhook acha pelo e-mail
  const ok = await Promise.race([registrarPedidoHotmart(ref), espera(1500).then(() => null)]);
  if (ok === false) evento("landing_erro", { onde: "hotmart_iniciar", msg: "registro_falhou" });
  const ir = (w as JanelaHm).__landingIrPara;
  if (ir) ir(url); else location.href = url;
  // voltou pela seta do navegador: o botão volta a funcionar (reserva de 4 s; o Safari com bfcache volta pelo pageshow, abaixo)
  window.setTimeout(soltarBotaoHotmart, 4000);
}
function soltarBotaoHotmart() {
  indoHotmart = false;
  const botao = document.getElementById(ID_BOTAO_HM);
  if (!botao) return;
  botao.removeAttribute("aria-busy");
  porRotulo(botao, ROTULO_BOTAO_HM);
}
// J (revisão): o Safari devolve a página do bfcache congelada — com "Abrindo o pagamento…" e os timers parados
if (HOTMART) window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) soltarBotaoHotmart(); });
if (HOTMART) document.getElementById(ID_BOTAO_HM)?.addEventListener("click", () => { evento("landing_cta", { onde: "hotmart", fase: estado.fase }); void irHotmart(); });

/* ───────────────────────── /oferta: o checkout Stripe em tela cheia (04/11, ./stripe-checkout.ts) ───────────────────────── */
type ModStripe = typeof import("./stripe-checkout");
let modStripe: Promise<ModStripe> | null = null;
const carregarStripeCheckout = () => (modStripe ??= import("./stripe-checkout"));
/** 06/11: com o teste ativo, o braço da página vai no Purchase do navegador (mesmo eventID) e na metadata do PI (pelo atrib, sem mexer no checkout) */
const pixelStripe: typeof pixel = LPO_ATIVO ? (ev, p = {}, id) => pixel(ev, ev === "Purchase" ? { ...p, braco_lp_oferta: BRACO_LP_OFERTA } : p, id) : pixel;
/** o navegador devolve a rolagem salva depois do Voltar e da recarga: sem o "manual" e a 2ª passada, ela ficaria no topo, longe do cartão */
const levarAoJaTem = () => {
  try { history.scrollRestoration = "manual"; } catch { /* noop */ }
  rolarAte($("oferta"), "start", false);
  requestAnimationFrame(() => rolarAte($("oferta"), "start", false));
};
/** 06/11: com o teste ativo, quem pagou fica marcada nos 2 braços (o checkout não marca). O "Você já tem o CORE" entra atrás da camada, e o X leva até ele. */
/** o e-mail da compra: guardado ao tocar em Pagar, porque na hora do "pago" o campo já saiu da tela (Pix: fase do QR; 3DS: a página recarregou). A aba guarda pra volta do banco e pra recarga com o QR na tela. */
const CHAVE_EMAIL_PAGANDO = "oferta-email-pagando";
let emailPagando: string | null = null;
const guardarEmailPagando = () => {
  emailPagando = document.querySelector<HTMLInputElement>("#oc-email")?.value.trim().toLowerCase() || null;
  try { if (emailPagando) sessionStorage.setItem(CHAVE_EMAIL_PAGANDO, emailPagando); } catch { /* fica no heap */ }
};
const lerEmailPagando = () => { if (emailPagando) return emailPagando; try { return sessionStorage.getItem(CHAVE_EMAIL_PAGANDO); } catch { return null; } };
const aoPagarStripe = () => {
  marcarCompra({ oferta: "stripe", email: lerEmailPagando() });
  try { sessionStorage.removeItem(CHAVE_EMAIL_PAGANDO); } catch { /* noop */ }
  jaTem = lerCompra();
  render();
  sairDaOfertaNova();
  const oc = document.getElementById("oc");
  if (!oc) return;
  const obs = new MutationObserver(() => { if (oc.hidden) { obs.disconnect(); levarAoJaTem(); } });
  obs.observe(oc, { attributes: true, attributeFilter: ["hidden"] });
};
const eventoStripe: typeof evento = LPO_NOVA || LPO_ATIVO
  ? (nome, dados) => { evento(nome, dados); if (nome === "landing_stripe_pagar") guardarEmailPagando(); if (nome === "landing_stripe_pago") { try { aoPagarStripe(); } catch { /* o Purchase vem logo depois: nada aqui pode impedir */ } } }
  : evento;
const opcoesStripe = () => ({
  pk: ST_PK, precoCentavos: ST_PRECO, parcelasMax: Number(w.__landing?.stripe_parcelas_max) || 12, producao: PRODUCAO, pedeCpf: w.__landing?.stripe_pede_cpf === true,
  evento: eventoStripe, pixel: pixelStripe, atrib: LPO_ATIVO ? { ...atrib, braco_lp_oferta: String(BRACO_LP_OFERTA) } : atrib, sessao, aparelho, urlChegada: URL_DE_CHEGADA, fbclid: BUSCA.get("fbclid"),
});
if (STRIPE) {
  const abrirStripe = (de?: string) => {
    evento("landing_cta", { onde: "stripe", fase: estado.fase, ...(de ? { de } : {}) });
    void carregarStripeCheckout().then((m) => m.abrirCheckout(opcoesStripe()));
  };
  document.getElementById(ID_BOTAO_HM)?.addEventListener("click", () => abrirStripe());
  if (LPO_NOVA) {
    ligarOfertaNova({ abrir: abrirStripe });
    // 06/11 (só com LPO_STRIPE_CEDO "on"): só o download, nunca antes do load; a tag <script> continua sendo a do checkout, que não muda
    if (PRODUCAO && w.__landing?.lpo_stripe_cedo === "on") depoisDoPixel(() => depoisDoLoad(() => ocioso(preaquecerStripe, 1000)));
  }
  // voltou de um 3DS por redirecionamento (?payment_intent=…&redirect_status=…): reabre o checkout no estado certo
  if (BUSCA.get("payment_intent") && BUSCA.get("redirect_status")) {
    // 3 (revisão): lido o retorno do banco, a URL fica limpa (recarregar não reabre a "volta" de novo)
    try {
      const limpa = new URL(location.href);
      for (const k of ["payment_intent", "payment_intent_client_secret", "redirect_status"]) limpa.searchParams.delete(k);
      history.replaceState(history.state, "", `${limpa.pathname}${limpa.search}${limpa.hash}`);
    } catch { /* noop */ }
    const voltaDoBanco = { pi: String(BUSCA.get("payment_intent")), status: String(BUSCA.get("redirect_status")) };
    void carregarStripeCheckout().then((m) => m.abrirCheckout({ ...opcoesStripe(), voltaDoBanco }));
  }
  // pré-aquece o módulo quando a oferta aparece (o toque abre na hora)
  ocioso(() => { void carregarStripeCheckout(); }, 4000);
  // 06/11 (dono): o Stripe.js em segundo plano logo depois da 1ª tela, sem esperar a oferta (metade esperava mais de 3,8 s depois do toque)
  ocioso(() => { void carregarStripeCheckout().then((m) => m.preaquecerStripe(ST_PK, PRODUCAO)); }, 3000);
  aoVerOferta = () => ocioso(() => { void carregarStripeCheckout().then((m) => m.preaquecerStripe(ST_PK, PRODUCAO)); }, 2000);
  if (ofertaVista) aoVerOferta();
}

/* ───────────────────────── 31/10: "Seu 2027 organizado" no pós-pago (./upsell-2027.ts, só com a chave ou o link do e-mail) ───────────────────────── */
function carregarU2027(): Promise<ModU2027> {
  if (modU2027) return Promise.resolve(modU2027);
  if (!carregandoU2027) {
    carregandoU2027 = carregarComRetry(() => import("./upsell-2027"), { recarregar: false })
      .then((m) => { modU2027 = m; return m; })
      .catch((e) => { carregandoU2027 = null; u27Falhou = true; evento("landing_erro", { onde: "chunk_u2027", msg: String(e).slice(0, 120) }); throw e; });
  }
  return carregandoU2027;
}
/** 01/11: o presente toma o lugar do 2027 NESTA tela? (a chave; o link do e-mail do 2027 e a retomada de um QR do 2027 seguem no 2027) */
function presenteNaTela(): boolean {
  return POS_PRESENTE && !(u27Volta && VOLTA_U2027) && !u27Retomada;
}
function carregarPresente(): Promise<ModPresente> {
  if (modPresente) return Promise.resolve(modPresente);
  if (!carregandoPresente) {
    carregandoPresente = carregarComRetry(() => import("./upsell-presente"), { recarregar: false })
      .then((m) => { modPresente = m; return m; })
      .catch((e) => { carregandoPresente = null; u27Falhou = true; evento("landing_erro", { onde: "chunk_presente", msg: String(e).slice(0, 120) }); throw e; });
  }
  return carregandoPresente;
}
/** o módulo da oferta desta tela (com UPSELL_POS "2027", o carregarU2027 de sempre) */
const carregarPos = (): Promise<unknown> => (presenteNaTela() ? carregarPresente() : carregarU2027());
const CODIGO_SIMULADO_PRESENTE = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/SIMULACAO-SEM-COBRANCA-CORE-PRESENTE5204000053039865405" + "14.905802BR5904CORE6009SAO PAULO62070503***6304ABCD";
const apiPresente = (): import("./upsell-presente").ApiPresente => SIMULADO
  ? {
    simulado: true,
    gerar: (compra) => espera(600).then(() => (w.__landingSimularU2027?.falhar
      ? { erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: "simulado" }
      : { orderId: `simulado-pv-${compra.slice(-8)}`, qrCode: CODIGO_SIMULADO_PRESENTE, qrCodeBase64: null, expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString(), donoIgual: !w.__landingSimularU2027?.outraConta })),
    conferir: async () => ({ pago: false, codigo: null }),
    buscar: (pedido) => espera(500).then(() => ({ codigo: `SMPX${pedido.toUpperCase().replace(/[^A-HJKMNP-Z2-9]/g, "").slice(-4).padStart(4, "X")}`, de: null })),
    gravarNome: async () => true,
  }
  : {
    simulado: false,
    gerar: (compra) => pg(false).then((m) => m.gerarPixPresente(compra)),
    conferir: (pix: PixU2027) => pg(false).then((m) => m.conferirPixPresente(pix, u27Compra ?? "")),
    buscar: (pedido) => pg(false).then((m) => m.buscarPresenteLp(pedido)).catch(() => null),
    gravarNome: (pedido, nome) => pg(false).then((m) => m.nomePresenteLp(pedido, nome)).catch(() => false),
  };
/**
 * 01/11: o PRESENTE toma o cartão (no lugar do 2027). Nunca pra quem não comprou o CORE pra sempre (o LN_ano279 é de 1 ano) —
 * aí é a conta pronta de sempre, sem oferta nenhuma. O resto (carregando sem piscar, a página própria) é o mesmo do 2027.
 */
function presenteToma(compra: string): boolean {
  if (!estado.pago || estado.pago.orderId !== compra || !ehPraSempreOferta(estado.pago.oferta)) return false;
  if (!(u27 && u27Compra === compra) && lerEstadoPresenteLp(compra).etapa === "fim") return false;
  if (!modPresente) {
    const carregando = () => {
      card.dataset.fase = "conta";
      caixa.innerHTML = `<div class="lp-pago" data-testid="presente-carregando"><div class="lp-pix-gerando"><b>Pagamento confirmado</b><div class="lp-progresso"><i></i></div></div></div>`;
    };
    if (!(estado.fase === "pago" && u27Antes) || u27AntesDaRecarga) carregando();
    else window.setTimeout(() => { if (!modPresente && estado.fase === "pago" && u27Antes) carregando(); }, 400);
    void carregarPresente().then(() => render(), () => render());
    return true;
  }
  if (!u27 || u27Compra !== compra) {
    u27?.parar();
    u27Compra = compra;
    u27 = modPresente.criarUpsellPresente(compra, {
      caixa, card, api: apiPresente(), evento, copiarNoToque, copiarTexto: (c) => copiarTexto(c), desenharQr: (alvo, p) => desenharQr(alvo, p),
      email: () => estado.email ?? estado.emailPix ?? lerCompra()?.email ?? null,
      valorPago: () => (estado.pago ? VALOR_OFERTA[estado.pago.oferta] ?? null : null),
      aoTerminar: () => { render(); rolarAte(card, "start"); },
      aoMudar: () => { atualizarFixo(); rolarAte(card, "start"); },
      contaPronta: esperarContaU27,
      faixaConfirmada: () => "o CORE é seu pra sempre",
    });
  }
  if (!u27.ativo()) return false;
  return u27.render();
}
const CODIGO_SIMULADO_U27 = "00020101021226870014br.gov.bcb.pix2565qrcode.exemplo.com/pix/v2/SIMULACAO-SEM-COBRANCA-CORE-2027520400005303986540519.90" + "5802BR5904CORE6009SAO PAULO62070503***6304ABCD";
const apiU2027 = (): import("./upsell-2027").ApiU2027 => SIMULADO
  ? {
    simulado: true,
    gerar: (compra) => espera(600).then(() => (w.__landingSimularU2027?.semSessao
      ? { erro: "Esse código venceu.", onde: "sem_sessao" }
      : w.__landingSimularU2027?.falhar
      ? { erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: "simulado" }
      : { orderId: `simulado-u27-${compra.slice(-8)}`, qrCode: CODIGO_SIMULADO_U27, qrCodeBase64: null, expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString(), donoIgual: !w.__landingSimularU2027?.outraConta, comEmail: true })),
    conferir: async () => false,
  }
  : {
    simulado: false,
    gerar: (compra) => pg(false).then((m) => m.gerarPixU2027(compra)),
    conferir: (pix: PixU2027) => pg(false).then((m) => m.conferirPixU2027(pix)),
  };
/**
 * 31/10 (upsell-tela-cheia, o "glitch" que o dono viu no celular): pagou com o e-mail já dado (braço "email" do checkout, ou
 * o e-mail salvo na tela do QR) → a fase "pago" pintava o cartão "Pronto! Falta o seu e-mail / Pagamento confirmado" por um
 * instante (o finalizarConta + o módulo do 2027) e SÓ DEPOIS a oferta entrava: parecia que pulou. Agora, com o 2027 ligado
 * e o e-mail conhecido, a oferta toma o cartão JÁ no pago; o Pix do 2027 espera a conta final (contaPronta) por dentro.
 */
let u27Antes = false;
/** a oferta antecipada voltou por uma RECARGA (não há QR na tela pra ficar parado: o "Pagamento confirmado" entra já) */
let u27AntesDaRecarga = false;
let avisarContaU27: (() => void) | null = null;
const contaProntaU27 = new Promise<void>((ok) => { avisarContaU27 = ok; });
/** só a oferta ANTECIPADA (no pago, conta ainda sendo finalizada) espera; o link do e-mail, a retomada e a conta pronta, não */
const esperarContaU27 = (): Promise<void> => (u27Antes && estado.fase === "pago" ? contaProntaU27 : Promise.resolve());
/** A compra que o 2027 está oferecendo agora (null = nada do 2027 nesta tela). */
function u2027DaTela(): string | null {
  if (u27Volta && VOLTA_U2027) return VOLTA_U2027.compra;
  if (U2027 && (estado.fase === "conta" || (estado.fase === "pago" && u27Antes)) && estado.pago && !jaTem) return estado.pago.orderId;
  // crítica r2 (dinheiro 1): o Instagram zerou o localStorage com o QR do 2027 aberto — o estado do vitalício morreu (e o marcador
  // virou "já tem"), mas o cookie do 2027 diz qual compra é: o MESMO QR (ou o "Pronto") volta, nunca "Você já tem o CORE" sem ele
  if (U2027 && !estado.pago && u27Retomada) return u27Retomada.compra;
  return null;
}
/**
 * Crítica r2 (compradora 5): com o 2027 na tela, a caixa "7 dias pra testar tudo" (do vitalício) não fica embaixo dele — ela
 * lia como garantia do 2027. E pelo link do e-mail (ou na retomada) a página de venda do vitalício some inteira: só o cartão.
 * Só existe com o 2027 em jogo (a página sem a chave e sem ?r=u2027 nunca ganha o atributo nem o estilo).
 */
function paginaDoU2027(): void {
  const modo = u27Tela ? (((u27Volta && VOLTA_U2027) || u27Retomada) ? "link" : "pos") : (jaTemDoLink ? "link" : null);
  const html = document.documentElement;
  if (!modo) { html.removeAttribute("data-u27-pag"); return; }
  if (!document.getElementById("lp-u27-pag-css")) {
    const st = document.createElement("style");
    st.id = "lp-u27-pag-css";
    st.textContent = 'html[data-u27-pag] #oferta .lp-garantia{display:none}html[data-u27-pag="link"] main.lp>:not(.lp-barra):not(#oferta),html[data-u27-pag="link"] #fim{display:none!important}';
    document.head.appendChild(st);
  }
  html.setAttribute("data-u27-pag", modo);
}
function u2027Toma(): boolean {
  const compra = u2027DaTela();
  if (!compra || u27Falhou) return false;
  if (presenteNaTela()) return presenteToma(compra); // 01/11: UPSELL_POS = "presente" (com "2027", nada muda daqui pra baixo)
  // "Agora não" / Continuar desta compra (outra visita): direto a conta pronta, sem baixar nada
  if (!u27Volta && !(u27 && u27Compra === compra) && lerEstadoU2027(compra).etapa === "fim") return false;
  if (!modU2027) {
    // 31/10 (o "glitch"): no pago antecipado o cartão fica como está (o QR) até o módulo chegar — ele já vem baixando desde
    // que o QR apareceu; nada de "Pagamento confirmado" com barrinha piscando antes da oferta
    const carregando = () => {
      card.dataset.fase = "conta";
      caixa.innerHTML = `<div class="lp-pago" data-testid="u2027-carregando"><div class="lp-pix-gerando"><b>Pagamento confirmado</b><div class="lp-progresso"><i></i></div></div></div>`;
    };
    if (!(estado.fase === "pago" && u27Antes) || u27AntesDaRecarga) carregando();
    // rede lenta: o QR parado depois do "Já paguei" parece que nada aconteceu — passou de 1,2 s, mostra que confirmou
    // crítica r1 (técnico BAIXA 6): 400 ms (1,2 s parecia travado)
    else window.setTimeout(() => { if (!modU2027 && estado.fase === "pago" && u27Antes) carregando(); }, 400);
    void carregarU2027().then(() => render(), () => render());
    return true;
  }
  if (!u27 || u27Compra !== compra) {
    u27?.parar();
    u27Compra = compra;
    u27 = modU2027.criarUpsell2027(compra, {
      caixa, card, api: apiU2027(), evento, copiarNoToque, copiarTexto: (c) => copiarTexto(c), desenharQr: (alvo, p) => desenharQr(alvo, p),
      email: () => estado.email ?? estado.emailPix ?? lerCompra()?.email ?? null,
      // crítica r2: "O CORE é seu pra sempre." nos 2 braços (o atual dizia "Seu CORE é seu pra sempre."; a conta pronta do atual não muda)
      linhaConfirmada: () => (estado.pago ? `${estado.pago.oferta !== "LN_ano279" ? "O CORE é seu pra sempre." : "O CORE está liberado por 1 ano."} O acesso também vai pro seu e-mail.` : "Seu CORE já está pago. O acesso está no e-mail da compra."),
      valorPago: () => (estado.pago ? VALOR_OFERTA[estado.pago.oferta] ?? null : null),
      aoTerminar: () => { saidaDoLinkU2027(); u27Volta = false; render(); rolarAte(card, "start"); },
      aoMudar: () => { atualizarFixo(); rolarAte(card, "start"); },
      contaPronta: esperarContaU27,
      faixaConfirmada: () => (estado.pago ? (estado.pago.oferta !== "LN_ano279" ? "o CORE é seu pra sempre" : "o CORE é seu por 1 ano") : "o seu CORE já está pago"),
    });
    if (u27Volta && VOLTA_U2027) u27.voltaDoEmail(VOLTA_U2027.pix);
    else if (u27Retomada && u27Retomada.compra === compra) u27.retomar();
  }
  if (!u27.ativo()) { saidaDoLinkU2027(); u27Volta = false; return false; }
  return u27.render();
}
/**
 * Crítica r1 (ALTA): saiu do 2027 que chegou pelo LINK DO E-MAIL (Continuar / Agora não / Ver minha conta) num navegador sem a
 * compra (Mail → Safari) → "Você já tem o CORE" (lojas + "entre com o e-mail da compra"), NUNCA o cartão de venda do vitalício
 * ("Só hoje · R$ 27,90 · Pagar"). Grava o marcador de compra: a recarga e as próximas visitas também ficam na conta.
 */
function saidaDoLinkU2027(): void {
  const doLink = u27Volta && !!VOLTA_U2027;
  if ((!doLink && !u27Retomada) || estado.pago) return;
  u27Retomada = null; // crítica r2: a retomada (cookie) sai do mesmo jeito — "Você já tem o CORE", sem "Não fui eu que comprei"
  jaTemDoLink = true;
  if (jaTem) return;
  marcarCompra({});
  jaTem = lerCompra() ?? { em: Date.now(), oferta: null, email: null };
  jaTemDoLink = true;
  evento("landing_ja_tem", { via: doLink ? "link_u2027" : "retomada_u2027" });
}

/* r3 (oferta M1 / pix M1 / visitante-frio M1 — WebKit, 70% do tráfego): toda abertura que leva ao cartão (Pix vivo, pago, conta,
 * "já tem", código vencido com aviso) rolava até ele ANTES de os prints do "Por dentro" ganharem src; no WebKit um <img> sem src
 * não reserva altura e, quando o src chegava, +786 px entravam ACIMA do cartão (cartão em 204/786 px). O CSS agora reserva a
 * altura do celular (height, não max-height) e, por garantia, nos primeiros 6 s qualquer crescimento da página re-encosta o
 * cartão no topo — até a pessoa tocar/rolar por conta própria. */
const cartaoNoArranque = V2 && (estado.fase !== "oferta" || !!avisoOferta || !!lerCompra());
if (cartaoNoArranque) {
  // r1 (pix M2, v2): no Chromium a restauração de rolagem da recarga vencia o rolarAte e deixava o QR fora da tela. r3: também com
  // o aviso do vencido e com o "já tem" (antes só com fase ≠ oferta)
  try { history.scrollRestoration = "manual"; } catch { /* noop */ }
  if (typeof ResizeObserver !== "undefined") {
    let interagiu = false;
    const marcar = () => { interagiu = true; };
    for (const ev of ["touchstart", "wheel", "keydown", "pointerdown"]) window.addEventListener(ev, marcar, { passive: true, once: true });
    const fim = Date.now() + 6000;
    const ro = new ResizeObserver(() => {
      if (interagiu || Date.now() > fim || (estado.fase === "oferta" && !avisoOferta && !jaTem)) { ro.disconnect(); return; }
      if (Math.abs(card.getBoundingClientRect().top) > 1) rolarAte(card, "start", false);
    });
    ro.observe(document.body);
    window.setTimeout(() => ro.disconnect(), 6500);
  }
}

/* crítica r2 (dinheiro 1): o localStorage foi zerado (Instagram) com o QR do 2027 aberto ou já no "Pronto" — o cookie do 2027
 * traz a MESMA tela de volta (antes do "já tem", que pintaria "Você já tem o CORE" sem o código). */
if (U2027 && !VOLTA_U2027 && !estado.pago && (estado.fase === "oferta" || estado.fase === "erro")) {
  u27Retomada = lerU2027Guardado();
  if (u27Retomada) jaTemDoLink = true; // a saída dela é "Você já tem o CORE" sem "Não fui eu que comprei"
}

/* 29/10: o aparelho já comprou (cookie/localStorage) e a página voltou na oferta → "Você já tem o CORE" */
if (estado.fase === "oferta") { const m = lerCompra(); if (m) { jaTem = m; mostrarJaTem("marcador"); } }
/* 06/11: quem já comprou neste aparelho vê o "Você já tem o CORE" da página de hoje (o braço nos eventos continua o sorteado). Chave off e braço atual: igual ao ar */
if ((LPO_NOVA || LPO_ATIVO) && jaTem) { sairDaOfertaNova(); levarAoJaTem(); }
if (u27Retomada) {
  evento("landing_u2027_retomado", { etapa: u27Retomada.etapa, order_id: u27Retomada.compra });
  try { history.scrollRestoration = "manual"; } catch { /* noop */ }
  render();
  window.setTimeout(() => rolarAte(card, "start", false), 60);
}

/* 29/10: chegou pelo e-mail de lembrete do Pix (?r=t12|t20h): o Pix ainda vivo reabre (mesmo nesta aba nova) */
{
  const volta = voltaDoLembrete(BUSCA);
  if (volta) {
    let restaurado = "nao";
    if (estado.pix && volta.pedido && estado.pix.orderId === volta.pedido && estado.fase === "qr") restaurado = "aba";
    else if (volta.pix && estado.fase === "oferta" && !jaTem) {
      restaurado = "link";
      estado = { ...estado, fase: "qr", pix: volta.pix, salvoEm: Date.now() };
      estadoHeap = estado;
      try { localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado)); } catch { /* fica no heap */ }
    }
    evento("landing_lembrete_volta", { toque: volta.toque, order_id: volta.pedido, restaurado });
    if (restaurado === "nao" && estado.fase === "oferta") window.setTimeout(() => rolarAte($("oferta")), 300);
  }
}

/* 31/10: chegou pelo bloco do 2027 no e-mail de compra confirmada (?r=u2027): o MESMO Pix reabre no cartão */
if (VOLTA_U2027) {
  u27Volta = true;
  if (estado.fase === "oferta" || estado.fase === "erro") {
    try { history.scrollRestoration = "manual"; } catch { /* noop */ }
    render();
    window.setTimeout(() => rolarAte(card, "start", false), 60);
  }
} else if (U2027 && (estado.fase === "pago" || estado.fase === "conta")) void carregarPos().catch(() => null);

/* voltou com Pix aberto (o banco recarregou a aba) / já pago: a tela certa */
if (estado.fase === "qr") {
  copiado = null; conferirEmLoop(); if (estado.pix) marcarQrNaTela(estado.pix.orderId);
  // 02/11 r2 (medição, nos 2 braços): o QR veio do cookie (storage zerado) — quantas vezes acontece e se a sessão sobreviveu (sem ela: doEmail)
  if (pixDoCookie && estado.pix) evento("landing_pix_restaurado", { order_id: estado.pix.orderId, sem_sessao: pixDoCookie.semSessao, com_email: pixDoCookie.comEmail });
}
/* 31/10 (crítica r1 técnico BAIXA 5, só com o 2027 ligado): recarregou no meio da conta sendo finalizada, com o e-mail já
 * dado — a oferta antecipada volta e a conta termina sozinha (antes: o cartão pedia o e-mail de novo, campo vazio) */
if (U2027 && estado.fase === "pago" && estado.pago && estado.emailPix && !VOLTA_U2027) {
  u27Antes = true; u27AntesDaRecarga = true;
  void prontoComEmail(estado.emailPix, "recarga");
}
if (estado.fase !== "oferta") {
  // r1 (pix M2, v2): no Chromium a restauração de rolagem da recarga vencia o rolarAte e deixava o QR fora da tela
  if (V2) { try { history.scrollRestoration = "manual"; } catch { /* noop */ } }
  render();
  if (estado.fase === "pago" || estado.fase === "conta") window.setTimeout(() => rolarAte(card, "start", !V2), 50);
  if (V2) window.addEventListener("load", () => rolarAte(card, "start", false), { once: true });
}
if (V2 && avisoOferta && estado.fase === "oferta" && !jaTem) { render(); conferirVencidoEmLoop(); } // o Pix venceu há pouco: o aviso fica, e a conferência segue

/* v2 (30/10 noite): a aba recarregou com a demo em tela cheia aberta (o Instagram recarrega) → reabre no mesmo módulo, com a página
 * parada no mesmo y por baixo. Com Pix vivo, pago, aviso de vencido ou "já tem" o cartão manda (y 0): a marca sai do histórico. */
{
  const h = V2 ? estadoHist() : null;
  if (h?.[MARCA_CHEIA]) {
    if (estado.fase === "oferta" && !jaTem && !avisoOferta && ehModuloLanding(h.m)) abrirCheia(h.m, "recarga", typeof h.y === "number" ? h.y : 0);
    else { try { const resto: EstadoHist = { ...h }; delete resto[MARCA_CHEIA]; history.replaceState(resto, ""); } catch { /* noop */ } }
  }
}

/* ───────────────────────── medição invisível (29/10) ───────────────────────── */
/* qual dúvida abre: 1x por pergunta por visita */
const duvidasAbertas = new Set<string>();
document.querySelectorAll<HTMLDetailsElement>("details").forEach((d) => d.addEventListener("toggle", () => {
  if (!d.open) return;
  const pergunta = (d.querySelector("summary")?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!pergunta || duvidasAbertas.has(pergunta)) return;
  duvidasAbertas.add(pergunta);
  evento("landing_duvida_aberta", { pergunta });
}));

/* a volta pra aba (foi ao banco, ao Instagram…): ≥5 s fora */
let saiuEm: number | null = document.visibilityState === "hidden" ? Date.now() : null;
const faseAgora = () => (jaTem && estado.fase === "oferta" ? "ja_tem" : estado.fase);
/** 02/11 (b): a pessoa voltou do banco com este pedido ainda sem pagar → o cartão mostra "De volta? Se ficou alguma dúvida:" */
const voltaNoB = (via: "aba" | "recarga") => {
  if (!PIXB || estado.fase !== "qr" || !estado.pix || conferindoDesde !== null) return;
  if (voltaVista === estado.pix.orderId) return; // já está na tela (2ª volta): nada a repetir
  voltaVista = estado.pix.orderId; voltaVia = via;
  evento("landing_pix_volta_vista", { order_id: estado.pix.orderId, via });
  render();
};
const voltou = () => {
  if (saiuEm === null) return;
  const fora = Date.now() - saiuEm;
  saiuEm = null;
  if (fora < 5000) return;
  if (estado.fase === "qr" && estado.pix) idasBanco += 1; // r2 (técnico M2): "foi ao banco" = volta de ≥ 5 s, nunca o landing_pix_saiu cru
  evento("landing_voltou", { fase: faseAgora(), ausente_s: Math.round(fora / 1000), com_pix: estado.fase === "qr", order_id: estado.fase === "qr" ? estado.pix?.orderId ?? null : null, via: "aba" });
  voltaNoB("aba");
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") { saiuEm = Date.now(); registrarSaida("aba"); }
  else { voltou(); saiuRegistrado = false; qrDesde = Date.now(); if (estado.fase === "qr") esquecerSaida(); }
});
window.addEventListener("pagehide", () => {
  saiuEm = Date.now();
  const estaSaidaJaContou = saiuRegistrado; // o hidden desta MESMA saída já somou +1 em `saidas` — a saída final não é ida ao banco (r2, técnico M2)
  registrarSaida("pagehide");
  // 02/11 (medição, nos 2 braços): saiu de vez com o QR na tela e sem pagar — o evento() manda com keepalive. Lido cru conta a recarga
  // (a página nova manda landing_pix_abandono_cancelado) e, no iPhone, o Instagram nem sempre dispara o pagehide: na análise o abandono
  // é "último evento do pedido sem pago"; este evento só complementa com s_total / saidas / idas_banco.
  if (estado.fase === "qr" && estado.pix) evento("landing_pix_abandono", { s_total: Math.round((Date.now() - qrDesde0) / 1000), saidas: Math.max(0, saidas - (estaSaidaJaContou ? 1 : 0)), idas_banco: idasBanco, order_id: estado.pix.orderId });
});
window.addEventListener("pageshow", (e) => { if ((e as PageTransitionEvent).persisted) { voltou(); saiuRegistrado = false; qrDesde = Date.now(); } });
/* 02/11 (medição, nos 2 braços): a volta por RECARGA — o Instagram recarrega a aba na volta do banco e o visibilitychange não vê;
 * antes essa pessoa caía em "nunca voltou". A marca gravada na saída (sessionStorage + localStorage) diz que era o mesmo pedido. */
{
  const m = estado.fase === "qr" && estado.pix ? lerSaida() : null;
  if (m && estado.pix && m.order === estado.pix.orderId) {
    esquecerSaida();
    saidas = Math.max(saidas, Number(m.saidas) || 0);
    idasBanco = Math.max(idasBanco, Number(m.idas) || 0);
    if (typeof m.desde === "number" && m.desde > 0 && m.desde < qrDesde0) qrDesde0 = m.desde; // o s_total do abandono continua de onde parou
    // r2 (persona M2): o código já tinha sido copiado antes da recarga — só o b lê (o atual segue a tela de hoje: "Copiar código Pix" na recarga)
    const copiouAntes = PIXB && m.cop === true && copiado === null;
    if (copiouAntes) copiado = true;
    const fora = Date.now() - m.em;
    // r1 (técnico/visual): a página velha mandou landing_pix_abandono no pagehide da recarga — este evento o desmente (a análise também
    // pode ler "abandono = último evento do pedido, sem landing_voltou/landing_pix_pago/subscription depois")
    evento("landing_pix_abandono_cancelado", { order_id: estado.pix.orderId, ausente_s: Math.round(fora / 1000) });
    if (fora >= 5000) {
      idasBanco += 1;
      evento("landing_voltou", { fase: "qr", ausente_s: Math.round(fora / 1000), com_pix: true, order_id: estado.pix.orderId, via: "recarga" });
      voltaNoB("recarga");
    } else if (copiouAntes) render();
  }
}
if (SIMULADO && w.__landingSimular) {
  w.__landingSimular.voltou = () => { saiuEm = Date.now() - 8000; voltou(); };
  w.__landingSimular.vencer = () => { if (estado.pix && estado.fase === "qr") salvar({ pix: { ...estado.pix, expiresAt: new Date(Date.now() + 1500).toISOString() } }); };
}
