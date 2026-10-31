/**
 * "SEU 2027 ORGANIZADO" NO PÓS-PAGO DA /organizar (31/10, PLANO.md §A — novidades-guardadas/2026-10-31/upsell-2027-presente).
 * Só baixa com a chave ligada (html[data-u2027="on"]) ou pelo link do e-mail (?r=u2027). HTML puro dentro do cartão
 * (#lp-pix), no mesmo padrão das fases da landing, com o PRÓPRIO <style> (o 1º <style> do landing.html não muda: o
 * braço "atual" é comparado linha a linha com a página de 30/10).
 *
 *   oferta   "✓ Pagamento confirmado" + "O CORE é seu pra sempre…" (a linha da landing) · "Seu 2027 organizado" · R$ 14,90 ·
 *            uma vez, sem mensalidade · "Quero · copiar o Pix" · "Agora não · ver minha conta" (botão de 44 px nos 2 braços;
 *            → conta pronta, SEM o plano de 30 dias: 0 em 39). O Pix já está sendo gerado ao mostrar a oferta (pré-aquecido;
 *            o MESMO do e-mail, 24 h).
 *   qr       o toque copia o código (ClipboardItem com a promessa do Pix pré-aquecido) → QR + código + "Pagou? Volte aqui.
 *            Esta tela confirma sozinha." · confere a cada 3 s nos 10 primeiros minutos, depois a cada 30 s, só com a aba
 *            à vista, e para em 30 min (fica a volta da aba + "Já paguei"); sem laço quando o dono é outra conta ou veio
 *            do e-mail (crítica r1: a cota da Asaas é a mesma do checkout do vitalício). "Código copiado" fica guardado
 *            (a volta do banco recarrega a aba).
 *   venceu   o link do e-mail com o Pix vencido, num navegador que não consegue gerar outro (sem sessão / outra conta):
 *            "Esse código venceu" + "Ver minha conta" — nunca um "Quero" que só dá erro (crítica r1).
 *   pronto   "Pronto, seu 2027 tá no seu CORE" · os 4 ✓ · onde fica · Continuar → conta pronta (com as lojas).
 *   fim      a landing mostra a conta pronta de sempre (pelo link do e-mail sem compra neste navegador: "Você já tem o CORE").
 * Sem Purchase pra Meta em nenhum passo (recomendação do relatório, ainda a confirmar com o dono: _shared/pix-upsell.ts).
 * Onde fica (crítica r1): só no site e no app do iPhone — o Android da loja ainda não tem a aba Seu 2027.
 *
 * Eventos (todos com braco_lp/braco_checkout pelo `evento` da landing + order_id = a compra do vitalício):
 *   landing_u2027_view · _quero · _nao {de} · _pix_pronto {ms, ok, motivo?} · _copiado {ok, via} · _pago · _continuar ·
 *   _volta_email {restaurado} · _erro {onde}
 * Com a versão B (U27_PLANNER + PLANNER_2027 ligadas), TODO evento do 2027 leva também braco_planner ("codex" | "core") e
 * braco_planner_via ("email" | "reserva" | "forca" | "fixo" | "padrao") — o teste A/B dos 2 desenhos (31/10,
 * src/lib/planner-2027-braco.ts). Sem a versão B os eventos ficam iguais aos de antes.
 */
import { URL_APP_STORE, VALOR_U2027, reais, urlPlay, validadeU2027, type EstadoU2027, type PixU2027 } from "./regras";
import { gravarEstadoU2027, lerEstadoU2027 } from "./u2027-estado";
import {
  CTA_PRONTO_U2027_PLANNER, DESC_U2027_PLANNER, ITEM_PLANNER_U2027, LEGENDA_U2027_PLANNER, LINK_PLANEJAR_2027, NOTA_U2027_PLANNER, ZOOM_U2027_PLANNER, portaDoLink,
  bracoDoPlanner, camposDoBraco, folhaAnoDoPlanner, imagemDoPlanner, srcsetDoPlanner, u27PlannerLigado,
  u27PaginaLigada, imagemPreenchida, srcsetPreenchida, imagemPreenchidaGrande, PROMESSA_PLANNER, PROMESSA_PLANNER_DESC,
  ondeU27Pagina, ondeCurtoU27Pagina, SUB_U27_PAGINA, QUANDO_U27_PAGINA,
  type EstiloPlanner, type FolhaPreenchida,
} from "@/lib/planner-2027-chave";

export type GeradoU2027 = (PixU2027 & { comEmail?: boolean }) | { jaTem2027: true } | { erro: string; onde: string };
export type ApiU2027 = {
  gerar: (compra: string) => Promise<GeradoU2027>;
  conferir: (pix: PixU2027) => Promise<boolean>;
  /** simulado (dev/testes): a página não confere sozinha; "Já paguei" confirma */
  simulado: boolean;
};
export type CtxU2027 = {
  caixa: HTMLElement;
  card: HTMLElement;
  api: ApiU2027;
  evento: (nome: string, dados?: Record<string, unknown>) => void;
  copiarNoToque: (codigo: Promise<string>) => Promise<{ ok: boolean; via: string }>;
  copiarTexto: (c: string) => Promise<boolean>;
  desenharQr: (alvo: HTMLElement, p: { qrCode: string; qrCodeBase64: string | null }) => void | Promise<void>;
  /** a conta final já tem e-mail (o "Pronto" e o "foi pro seu e-mail" dependem disso) */
  email: () => string | null;
  /** a linha sob "Pagamento confirmado" (o que ela já tem: "O CORE é seu pra sempre…") */
  linhaConfirmada: () => string;
  /** quanto ela pagou no CORE (null = esta aba não sabe: o link do e-mail, a retomada pelo cookie) */
  valorPago?: () => number | null;
  /** terminou (Agora não / Continuar): a landing volta pra conta pronta */
  aoTerminar: () => void;
  /** a tela do cartão mudou (a landing rola até o cartão) */
  aoMudar: () => void;
  /**
   * 31/10 (upsell-tela-cheia, o "glitch"): a oferta já aparece no instante do pago (sem o cartão de confirmação piscando),
   * mas o Pix do 2027 só pode ser gerado com a conta FINAL pronta (a sessão dela). O Pix espera esta promessa. Sem ela = já.
   */
  contaPronta?: () => Promise<void>;
  /** a faixa fina da página: "o CORE é seu pra sempre" (sem "Pagamento confirmado", que a faixa já diz) */
  faixaConfirmada?: () => string;
};

const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** O que veio — SÓ o que o app faz de verdade (src/lib/pacote-2027.ts; os mesmos 4 do Fluxo2027). */
export const ITENS_U2027 = ["Planejar 2027 em 5 minutos", "12 revisões do mês", "Cofrinho das 52 semanas", "Planner 2027 pra imprimir"] as const;
/** Os textos que a crítica r1 mediu (honestidade: sem "já organizado", sem "orçamento do ano", sem "no app" pro Android). */
export const TITULO_U2027 = "Seu 2027 organizado";
export const DESC_U2027 = "3 metas, quanto gastar e guardar por mês, 12 revisões do mês e o cofrinho de 52 semanas.";
export const NOTA_U2027 = "É separado do CORE que você já pagou. Por enquanto fica no site e no app do iPhone.";
/** 31/10 (upsell-tela-cheia): o 4º item do "Pronto" na página (a promessa nova, honesta) */
export const ITEM_PLANNER_PAGINA = "Planner que se preenche com o que você anota";
const TOTAL_FOLHAS_TXT = "14 folhas";
export const ONDE_U2027 = "Fica no módulo <b>Desenvolvimento Pessoal</b>, aba <b>Seu 2027</b>. Por enquanto, no site e no app do iPhone.";
/** crítica r1 da página (compradora BAIXA 6): o "Pronto" da página diz o mesmo que a página disse antes de pagar */
const ONDE_U2027_PAGINA = () => { const o = ondeU27Pagina(); return `Fica no módulo <b>Desenvolvimento Pessoal</b>, aba <b>Seu 2027</b>.${o ? ` ${o}` : ""}`; };
/**
 * VERSÃO B (31/10, novidades-guardadas/2026-10-31/upsell-planner): a oferta mostra 2 FOLHAS REAIS do planner (capa + "Meu
 * ano", geradas pelo código do planner com dados de exemplo: scripts/planner-2027-miniaturas.ts) e diz que o planner sai
 * com os dados dela. Chave U27_PLANNER "off" (padrão) = a oferta da versão A, igual. QA: ?u27planner=on|off|auto. A direção
 * da miniatura segue a do app (PLANNER_ESTILO / ?planner-estilo=codex|core).
 */
export { U27_PLANNER, u27PlannerLigado, DESC_U2027_PLANNER, LEGENDA_U2027_PLANNER, imagemDoPlanner, type ModoU27Planner } from "@/lib/planner-2027-chave";

/** O laço de conferência (crítica r1): rápido nos 10 primeiros minutos, devagar até 30 min, depois só na volta / "Já paguei". */
export const LACO_U2027 = { rapidoMs: 3000, lentoMs: 30_000, viraLentoMs: 10 * 60e3, paraMs: 30 * 60e3 } as const;

/* o estilo próprio (1x por página). Escopado em .u27 — nada vaza pro resto da landing. */
const CSS = `
/* a faixa do cartão do vitalício ("OFERTA ESPECIAL · HOJE" no atual) não fica em cima do 2027: nada de "hoje" no upsell */
.lp-card[data-u27] .lp-card-faixa, .lp-card[data-u27-link] .lp-card-faixa { display: none; }
.u27 { text-align: left; animation: u27-surge .25s ease-out both; }
@keyframes u27-surge { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.u27-ok { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 750; color: #14532d; }
.u27-ok svg { width: 20px; height: 20px; padding: 4px; border-radius: 50%; background: var(--verde, #16a34a); color: #fff; flex-shrink: 0; }
.u27-sep { height: 1px; background: var(--borda, #ebe8ee); margin: 14px -18px 18px; }
.u27-kicker { font-size: 11.5px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: var(--magenta, #d6338a); }
.u27 h3 { margin: 6px 0 0; font-size: 24px; line-height: 1.15; font-weight: 850; letter-spacing: -.025em; text-wrap: balance; }
.u27-desc { margin: 8px 0 0; font-size: 15px; line-height: 1.45; color: var(--suave, #6b6670); text-wrap: pretty; }
.u27-lista { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 8px; }
.u27-lista li { display: flex; gap: 10px; align-items: center; font-size: 15px; font-weight: 650; }
.u27-lista li svg { width: 18px; height: 18px; color: var(--verde, #16a34a); flex-shrink: 0; }
.u27-preco { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 18px 0 14px; }
.u27-preco b { font-size: 30px; font-weight: 850; letter-spacing: -.03em; }
.u27-preco span { font-size: 14px; font-weight: 650; color: var(--suave, #6b6670); }
.u27 .lp-links { margin-top: 10px; }
.u27 button.lp-link { min-height: 44px; padding: 10px 8px; }
.u27-linha { margin: 6px 0 0 28px; font-size: 14px; line-height: 1.4; color: var(--suave, #6b6670); }
.u27-sair { display: block; width: 100%; min-height: 44px; margin-top: 10px; padding: 10px 14px; border: 1.5px solid var(--borda, #ebe8ee); border-radius: 999px; background: transparent; color: var(--tx, #1c1a1f); font-size: 15px; font-weight: 700; }
.u27-sair:active { background: var(--papel, #f7f5f8); }
.u27-nota { margin: 12px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--fraco, #9a95a0); text-align: center; }
.u27-copiado { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: var(--verde-suave, #ecfdf3); color: #14532d; font-size: 14px; line-height: 1.35; }
.u27-copiado svg { width: 22px; height: 22px; flex-shrink: 0; padding: 4px; border-radius: 50%; background: var(--verde, #16a34a); color: #fff; }
.u27-copiado b { display: block; font-size: 15.5px; }
.u27-copiado.falta { background: var(--papel, #f7f5f8); color: var(--tx, #1c1a1f); }
.u27-copiado.falta svg { background: var(--grafite, #262626); }
.u27-ok-qr { font-size: 12.5px; font-weight: 700; margin: 0 0 10px; line-height: 1.3; }
.u27-ok-qr svg { width: 16px; height: 16px; padding: 3px; }
.u27-qual { margin: -2px 0 10px; font-size: 13.5px; line-height: 1.35; color: var(--suave, #6b6670); }
.u27-qual b { color: var(--tx, #1c1a1f); }
.u27-valor { display: flex; justify-content: space-between; align-items: baseline; margin: 0 0 12px; }
.u27-valor b { font-size: 22px; font-weight: 850; letter-spacing: -.02em; }
.u27-valor span { font-size: 13px; font-weight: 650; color: var(--suave, #6b6670); }
.u27-qr { display: flex; gap: 14px; align-items: center; margin-top: 14px; }
.u27-qr .lp-qr { width: 116px; height: 116px; }
.u27-qr-lado { flex: 1; min-width: 0; }
/* 2 linhas do código; o "respiro" é borda (o overflow corta no padding — com padding a 3ª linha aparecia pela metade no WebKit) */
.u27-qr-lado .lp-codigo { margin-top: 0; max-height: none; padding: 0; border: 10px solid var(--papel, #f7f5f8); border-width: 10px 12px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.u27-qr-lado button.lp-copiar { min-height: 46px; font-size: 14.5px; }
.u27-volte { display: flex; gap: 10px; align-items: flex-start; margin-top: 14px; padding: 12px 14px; border-radius: 14px; border: 1px solid var(--borda, #ebe8ee); font-size: 13.5px; line-height: 1.4; color: var(--suave, #6b6670); }
.u27-volte b { color: var(--tx, #1c1a1f); display: block; font-size: 15px; }
.u27-vale { display: block; margin-top: 4px; font-size: 12.5px; }
.u27-gerando { display: flex; align-items: center; justify-content: center; gap: 10px; min-height: 120px; font-size: 15px; font-weight: 700; color: var(--suave, #6b6670); }
.u27-gerando i { width: 16px; height: 16px; border-radius: 50%; border: 2.4px solid var(--borda, #ebe8ee); border-top-color: var(--grafite, #262626); animation: lp-gira .8s linear infinite; }
.u27-pronto { text-align: center; }
.u27-pronto .u27-lista { text-align: left; max-width: 300px; margin: 16px auto 0; }
.u27-onde { margin: 16px 0 0; padding: 12px 14px; border-radius: 14px; background: var(--papel, #f7f5f8); font-size: 14px; line-height: 1.45; color: var(--suave, #6b6670); text-align: left; }
.u27-onde b { color: var(--tx, #1c1a1f); }
@media (max-width: 359px) { .u27 h3 { font-size: 22px; } .u27-qr .lp-qr { width: 100px; height: 100px; } }
`;
/* versão B: só entra com a chave U27_PLANNER ligada (desligada, o CSS da página é o da versão A, igual) */
const CSS_PLANNER = `
.u27-planner { margin: 12px 0 0; text-align: center; }
.u27-planner button { display: block; width: 100%; max-width: 300px; margin: 0 auto; padding: 0; border: 0; background: none; cursor: zoom-in; -webkit-tap-highlight-color: transparent; }
.u27-planner img { display: block; width: 100%; height: auto; aspect-ratio: 640 / 460; }
.u27-planner figcaption { margin-top: 2px; font-size: 12.5px; color: var(--fraco, #9a95a0); }
.u27-planner figcaption u { text-decoration: none; font-weight: 700; color: var(--tx, #1c1a1f); white-space: nowrap; }
.u27-planner + .u27-desc { margin-top: 10px; }
.u27-zoom { position: fixed; inset: 0; z-index: 2147483000; background: rgba(20, 18, 24, .94); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 56px 16px 24px; overflow: auto; overscroll-behavior: contain; }
.u27-zoom img { display: block; width: 100%; max-width: 560px; height: auto; border-radius: 10px; box-shadow: 0 18px 50px -12px rgba(0,0,0,.6); }
/* crítica r2 (compradora MEDIA 3 / honestidade BAIXA 4): a legenda do exemplo numa pílula sólida, 1 linha, caixa normal —
 * nada da página por trás atravessa a frase que marca o exemplo */
.u27-zoom small { flex: none; max-width: 100%; padding: 6px 12px; border-radius: 99px; background: #fff; color: #1c1a1f; font-size: 12.5px; font-weight: 600; line-height: 1.3; text-align: center; }
.u27-zoom small b { font-weight: 800; letter-spacing: .08em; }
.u27-zoom button { position: fixed; top: 10px; right: 10px; width: 44px; height: 44px; border-radius: 50%; border: 0; background: #fff; color: #1c1a1f; font-size: 24px; line-height: 44px; cursor: pointer; }
`;
/* 31/10 (upsell-tela-cheia): a PÁGINA PRÓPRIA da oferta B. Por cima da landing (position:fixed), em coluna: a faixa fina, o
 * miolo que rola e a barra fixa com o preço, o Quero e o Agora não (sempre à vista). As 2 direções do teste A/B: codex =
 * papel creme + serifa itálica + pastéis; core = branco + Inter + as cores dos módulos (as mesmas da grade da Home). */
const CSS_PAGINA = `
@font-face{font-family:'Instrument Serif';font-style:italic;font-weight:400;font-display:swap;src:url(/fonts/instrument-serif-italic-latin.woff2) format('woff2')}
.u27p{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:var(--u-papel);color:var(--u-tx);text-align:left;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;
  --u-papel:#fff;--u-tx:#1c1a1f;--u-suave:#6b6670;--u-fio:#ebe8ee;--u-acento:#d6338a;--u-ok:#16a34a;
  --u-metas:#faf5ff;--u-metas-t:#7e22ce;--u-din:#fffbeb;--u-din-t:#b45309;--u-rev:#ecfdf3;--u-rev-t:#15803d;--u-cof:#fffbeb;--u-cof-t:#d97706;--u-borda:1px solid var(--u-fio)}
.u27p[data-estilo="codex"]{--u-papel:#fbfaf6;--u-tx:#30362f;--u-suave:#656b5d;--u-fio:#e4e1d6;--u-acento:#55734c;--u-ok:#55734c;
  --u-metas:#ebe5f0;--u-metas-t:#706278;--u-din:#f6eccd;--u-din-t:#776844;--u-rev:#eaf3ed;--u-rev-t:#36563f;--u-cof:#f8e8ef;--u-cof-t:#92566f;--u-borda:0}
.u27p-faixa{flex:none;display:flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:7px 16px calc(7px);padding-top:max(7px,env(safe-area-inset-top));background:#ecfdf3;color:#14532d;font-size:13px;font-weight:650;line-height:1.25;text-align:center}
.u27p[data-estilo="codex"] .u27p-faixa{background:#e5efe2;color:#2f4a2c}
/* crítica r1 (honestidade BAIXA 9): o QR e o "Pronto" dentro da página codex usam os tons dela (não o verde forte / cinza do app) */
.u27p[data-estilo="codex"]{--verde:#55734c;--verde-suave:#e5efe2;--grafite:#30362f;--borda:#e4e1d6;--papel:#f1efe7;--tx:#30362f;--suave:#656b5d;--fraco:#8b907f;--magenta:#55734c}
.u27p[data-estilo="codex"] .u27 .lp-cta{background:#30362f}
.u27p-faixa svg{width:16px;height:16px;padding:2.5px;border-radius:50%;background:var(--u-ok);color:#fff;flex:none}
.u27p-faixa b{font-weight:800}
/* crítica r1 (honestidade MEDIA 5): fora da oferta a faixa não diz "Pagamento confirmado" em cima de um Pix a pagar */
.u27p-faixa[data-tipo="neutra"]{min-height:30px;padding-top:max(6px,env(safe-area-inset-top));padding-bottom:6px;background:var(--u-papel);color:var(--u-suave);font-size:12.5px;font-weight:600;border-bottom:1px solid var(--u-fio)}
.u27p[data-estilo="codex"] .u27p-faixa[data-tipo="neutra"]{background:var(--u-papel);color:var(--u-suave)}
.u27p-faixa[data-tipo="neutra"] svg{display:none}
.u27p-faixa[hidden]{display:none}
.u27p-rolo{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.u27p-miolo{max-width:520px;margin:0 auto;padding:22px 16px 28px;animation:u27-surge .25s ease-out both}
.u27p-kicker{margin:0;font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--u-acento)}
.u27p h1{margin:6px 0 0;font-size:31px;line-height:1.08;font-weight:850;letter-spacing:-.03em;text-wrap:balance}
.u27p h1 em{font-style:normal;color:var(--u-acento)}
.u27p[data-estilo="codex"] h1{font-weight:650;letter-spacing:-.02em}
.u27p[data-estilo="codex"] h1 em,.u27p[data-estilo="codex"] .u27p-h2 em{font-family:'Instrument Serif',Georgia,serif;font-style:italic;font-weight:400;font-size:1.18em;letter-spacing:-.01em;color:var(--u-tx)}
.u27p-sub{margin:8px 0 0;font-size:15px;line-height:1.45;color:var(--u-suave);text-wrap:pretty}
.u27p-app{position:relative;margin:14px 0 0;padding:12px 14px 10px;border-radius:20px;background:var(--u-papel);border:1px solid var(--u-fio);box-shadow:0 10px 30px -14px rgba(30,20,40,.25)}
.u27p-ex{position:absolute;top:-9px;right:14px;padding:2px 8px;border-radius:99px;background:var(--u-tx);color:var(--u-papel);font-size:10px;font-weight:800;letter-spacing:.1em}
/* crítica r1 da página (compradora/honestidade MEDIA): o bloco do 2027 compacto, em linhas — as folhas sobem pra 1ª tela */
.u27p-l{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:baseline;padding:6px 0;border-top:1px solid var(--u-fio);font-size:13.5px;line-height:1.35}
.u27p-l:first-of-type{border-top:0;padding-top:2px}
.u27p-l>small{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
.u27p-l>div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u27p-l>div{min-width:0;color:var(--u-tx)}
.u27p-l b{font-weight:800}
.u27p-l em{font-style:normal;color:var(--u-suave)}
.u27p-metas>small{color:var(--u-metas-t)}.u27p-din>small{color:var(--u-din-t)}.u27p-rev>small{color:var(--u-rev-t)}.u27p-cof>small{color:var(--u-cof-t)}
.u27p-metas ol{list-style:none;margin:0;padding:0;display:grid;gap:1px;font-weight:650}
.u27p-metas li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.u27p-fio{display:grid;gap:2px;margin-top:5px}
.u27p-fio i{height:6px;border-radius:2px;background:currentColor;opacity:.18}
.u27p-fio i.ok{opacity:1}
.u27p-rev .u27p-fio{grid-template-columns:repeat(12,1fr);color:var(--u-rev-t)}
.u27p-cof .u27p-fio{grid-template-columns:repeat(52,1fr);gap:1px;color:var(--u-cof-t)}
.u27p-cof .u27p-fio i{height:5px;border-radius:1px}
.u27p-h2{margin:18px 0 0;font-size:21px;line-height:1.15;font-weight:850;letter-spacing:-.025em}
.u27p-h2+.u27p-sub{margin-top:4px;font-size:14.5px}
.u27p[data-estilo="codex"] .u27p-h2{font-weight:650}
.u27p-folhas{margin:10px 0 0;display:grid;grid-template-columns:1fr 1fr;gap:12px}
.u27p-folhas button{position:relative;display:block;padding:0;border:0;background:none;cursor:zoom-in;text-align:left;-webkit-tap-highlight-color:transparent}
.u27p-folhas img{display:block;width:100%;height:auto;aspect-ratio:1240/1754;border-radius:8px;background:#fff;box-shadow:0 10px 26px -10px rgba(30,20,40,.4),0 0 0 1px rgba(30,20,40,.06)}
/* crítica r2 (honestidade BAIXA 9): o selo sai de cima do ícone/da flor do canto — fica no canto ESQUERDO, metade pra fora da
 * borda (como o do bloco do 2027); embaixo ele sumia atrás da barra na 1ª tela de 390×690 */
.u27p-fimg{display:block;position:relative;font-style:normal}
.u27p-folhas .u27p-ex{top:-8px;right:auto;left:8px}
.u27p-folhas span{display:block;margin-top:7px;font-size:13px;font-weight:700;color:var(--u-tx)}
.u27p-folhas span small{display:block;font-size:12px;font-weight:500;color:var(--u-suave)}
.u27p-toque{margin:8px 0 0;font-size:12px;color:var(--u-suave);text-align:center}
.u27p-mini{margin:12px 0 0;font-size:13px;line-height:1.4;color:var(--u-suave)}
.u27p-mini+.u27p-mini{margin-top:6px}
.u27p .u27-nota{margin-top:18px}
.u27p-barra{flex:none;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--u-papel);border-top:1px solid var(--u-fio);box-shadow:0 -10px 24px -18px rgba(30,20,40,.35)}
.u27p-barra>div{max-width:520px;margin:0 auto}
.u27p-preco{display:flex;align-items:baseline;justify-content:center;gap:8px;margin:0 0 8px}
.u27p-preco b{font-size:22px;font-weight:850;letter-spacing:-.02em}
.u27p-preco span{font-size:13px;font-weight:650;color:var(--u-suave)}
.u27p-onde{margin:-4px 0 8px;font-size:12px;font-weight:600;line-height:1.3;color:var(--u-suave);text-align:center}
.u27p-barra button.lp-cta{min-height:52px}
.u27p[data-estilo="codex"] .u27p-barra button.lp-cta{background:#30362f}
.u27p-nao{display:block;width:100%;min-height:44px;margin-top:4px;border:0;background:none;color:var(--u-suave);font-size:14.5px;font-weight:700}
.u27p .u27{animation:none}
/* crítica r2 (compradora BAIXA 6): no QR do 2027, "Já paguei" é botão (contorno) e "Agora não" fica menor embaixo */
.u27p .u27 .lp-links{display:flex;flex-direction:column;align-items:stretch;gap:2px}
.u27p #u27-ja-paguei{min-height:46px;border:1.5px solid var(--u-tx);border-radius:12px;background:none;color:var(--u-tx);font-size:15px;font-weight:750;text-decoration:none}
.u27p #u27-sair{min-height:40px;font-size:13.5px;color:var(--u-suave)}
/* crítica r2 (compradora MEDIA 2): o "Pronto" do 2027 também mostra as lojas (regra de 18/10: todo pós-compra da web) */
.u27-pronto-lojas{margin:14px 0 0;text-align:center}
.u27-pronto-lojas p{margin:0 0 8px;font-size:13px;color:var(--suave,#6b6670)}
.u27-pronto-lojas .lp-selos{display:flex;justify-content:center;gap:10px;margin:0}
.u27-pronto-lojas img{display:block;height:36px;width:auto}
.u27p-miolo-alvo>.u27{max-width:520px;margin:0 auto;padding:22px 16px 28px}
@media (max-height:700px){.u27p-onde{margin:-3px 0 6px}.u27p-miolo{padding-top:16px}.u27p h1{font-size:28px}.u27p-barra{padding-top:8px}.u27p-preco{margin-bottom:6px}.u27p-barra button.lp-cta{min-height:48px}.u27p-nao{min-height:40px;margin-top:2px}}
`;
/** o exemplo do 2027 como fica no app (a página mostra, marcado EXEMPLO; os mesmos dados do planner de exemplo) */
const EXEMPLO_2027 = {
  metas: ["Juntar R$ 5 mil de reserva", "Viajar pro Nordeste em julho", "Correr 5 km sem parar"],
  /** crítica r1 (compradora BAIXA 4): 3 semanas do cofrinho = o fim de janeiro (a revisão de janeiro está ✓) */
  gastar: 3200, guardar: 450, semanas: 3,
};
/** "R$ 3.200" / "R$ 45" (o reais() da landing é do preço: "R$ 14,90") */
const brlInteiro = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
/** o zoom das folhas preenchidas (a mesma janela do "Meu ano") */
function abrirZoomDaFolha(estilo: EstiloPlanner, folha: FolhaPreenchida, aoFechar: () => void): void {
  abrirZoom(imagemPreenchidaGrande(estilo, folha), folha === "mes" ? "Exemplo da folha Meu mês, preenchida com os dados do Finanças" : "Exemplo da folha Minha semana, preenchida com os dados da Rotina",
    folha === "mes" ? "<b>EXEMPLO</b> · o seu sai com o mês em que você baixar" : "<b>EXEMPLO</b> · o seu sai com a semana em que você baixar", aoFechar);
}

/** crítica r1 (compradora MEDIA 2): tocar na imagem abre a folha "Meu ano" grande (legível). Fecha no ×, no toque fora e no Esc. */
function abrirZoomDoPlanner(estilo: EstiloPlanner, aoFechar: () => void): void {
  abrirZoom(folhaAnoDoPlanner(estilo), "Exemplo de uma folha do planner: Meu ano", "<b>EXEMPLO</b> · o seu sai com o que você planejar", aoFechar,
    "A folha Meu ano do planner 2027, com metas, dinheiro, cofrinho, datas e hábitos de exemplo");
}
function abrirZoom(src: string, rotulo: string, aviso: string, aoFechar: () => void, alt = rotulo): void {
  if (document.getElementById("u27-zoom")) return;
  const z = document.createElement("div");
  z.id = "u27-zoom";
  z.className = "u27-zoom";
  z.setAttribute("role", "dialog");
  z.setAttribute("aria-modal", "true");
  z.setAttribute("aria-label", rotulo);
  z.innerHTML = `<button type="button" aria-label="Fechar">×</button><small>${aviso}</small><img src="${src}" width="1080" height="1528" alt="${esc(alt)}">`;
  const fechar = () => { z.remove(); document.removeEventListener("keydown", tecla); aoFechar(); };
  const tecla = (k: KeyboardEvent) => { if (k.key === "Escape") fechar(); };
  z.addEventListener("click", (ev) => { if (ev.target === z || (ev.target as HTMLElement).tagName === "BUTTON") fechar(); });
  document.addEventListener("keydown", tecla);
  document.body.appendChild(z);
  z.querySelector<HTMLButtonElement>("button")!.focus();
}
function garantirCssPlanner(): void {
  if (document.getElementById("lp-u27-planner-css")) return;
  const st = document.createElement("style");
  st.id = "lp-u27-planner-css";
  st.textContent = CSS_PLANNER;
  document.head.appendChild(st);
}
function garantirCssPagina(): void {
  if (document.getElementById("lp-u27-pagina-css")) return;
  const st = document.createElement("style");
  st.id = "lp-u27-pagina-css";
  st.textContent = CSS_PAGINA;
  document.head.appendChild(st);
}
/** Pinta só se mudou (31/10, o "glitch"): a landing re-renderiza o cartão quando a conta fica pronta — o mesmo HTML não
 *  repinta (a animação de entrada não toca 2× e nada pisca). Devolve true quando pintou (aí os botões ganham os ouvintes). */
const pintado = new WeakMap<HTMLElement, { html: string; el: Element | null }>();
function pintar(alvo: HTMLElement, html: string): boolean {
  const m = pintado.get(alvo);
  if (m && m.html === html && m.el && alvo.firstElementChild === m.el) return false;
  alvo.innerHTML = html;
  pintado.set(alvo, { html, el: alvo.firstElementChild });
  return true;
}
function garantirCss(): void {
  if (document.getElementById("lp-u27-css")) return;
  const st = document.createElement("style");
  st.id = "lp-u27-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}

export type Upsell2027 = {
  /** esta compra ainda tem tela do 2027 (etapa ≠ fim)? */
  ativo: () => boolean;
  /** pinta a etapa atual no cartão (true = pintou; false = nada a mostrar) */
  render: () => boolean;
  /** o Pix (o mesmo do e-mail) começa a ser gerado agora — idempotente */
  preaquecer: () => void;
  /** chegou pelo link do e-mail: reabre o MESMO QR (ou a oferta, se o código venceu) */
  voltaDoEmail: (pix: PixU2027 | null) => void;
  /** crítica r2: a aba perdeu o estado da compra (storage zerado) e o cookie trouxe o 2027 de volta — sem sessão pra conferir */
  retomar: () => void;
  /** dev/testes: confirma o Pix simulado */
  simularPago: () => void;
  etapa: () => EstadoU2027["etapa"];
  /** pra parar o relógio/conferência (outra página do mesmo documento — testes) */
  parar: () => void;
};

/** crítica r2 (técnico BAIXA 2): no QR do vitalício, as 2 folhas da página já começam a baixar (a página abre com elas). */
const folhasPreaquecidas = new Set<string>();
export function preaquecerFolhasU27(email: string | null, reserva: string): void {
  if (typeof Image === "undefined" || !u27PlannerLigado() || !u27PaginaLigada()) return;
  const { estilo } = bracoDoPlanner({ email, reserva });
  if (folhasPreaquecidas.has(estilo)) return;
  folhasPreaquecidas.add(estilo);
  for (const f of ["mes", "semana"] as FolhaPreenchida[]) { const pre = new Image(); pre.srcset = srcsetPreenchida(estilo, f); pre.src = imagemPreenchida(estilo, f); }
}

export function criarUpsell2027(compra: string, ctx: CtxU2027): Upsell2027 {
  garantirCss();
  let e: EstadoU2027 = lerEstadoU2027(compra);
  let promessa: Promise<GeradoU2027> | null = null;
  let tPre = 0;
  let copiado: boolean | null = null;
  let gerando = false;
  let erro: string | null = null;
  let aviso: string | null = null;
  let comEmail = e.comEmail === true; // crítica r2: a frase "também foi pro seu e-mail" volta com a recarga do banco
  let loop: number | null = null;
  let relogio: number | null = null;
  let vistaOferta = false;
  let conferindo = false;
  /** chegou pelo link do e-mail (voltaDoEmail) */
  let veioDoLink = false;
  /** o link do e-mail veio sem Pix vivo: a oferta espera a 1ª tentativa de gerar (pra não piscar um "Quero" que não gera) */
  let esperandoLink = false;
  /** este navegador não consegue gerar outro Pix (sem sessão / outra conta) e o do e-mail venceu */
  let venceu = false;
  /** quando o QR apareceu nesta aba (o laço rápido/lento conta daqui) */
  let qrDesde = 0;
  /** versão B: a oferta com as folhas do planner (lido 1x por compra: a recarga do banco não troca a oferta no meio) */
  const comPlanner = u27PlannerLigado();
  /**
   * 31/10 teste A/B dos desenhos: o braço sai do e-mail da compradora (o mesmo hash que o app faz com o e-mail da conta —
   * ela vê no app o desenho que viu aqui). Sem e-mail nesta aba (o link do e-mail noutro navegador): a compra (reserva).
   * Decidido 1x por compra (a recarga do banco não troca o desenho no meio).
   */
  const braco = comPlanner ? bracoDoPlanner({ email: ctx.email(), reserva: compra }) : null;
  /** 31/10 (upsell-tela-cheia): a versão B como PÁGINA PRÓPRIA em tela cheia (U27_PAGINA; lido 1x por compra) */
  const comPagina = !!braco && u27PaginaLigada();
  if (braco) {
    garantirCssPlanner();
    // crítica r1 (técnico BAIXA 7): a página usa as folhas Meu mês/Minha semana — a imagem do cartão B só no cartão B
    if (typeof Image !== "undefined") {
      if (comPagina) for (const f of ["mes", "semana"] as FolhaPreenchida[]) { const pre = new Image(); pre.srcset = srcsetPreenchida(braco.estilo, f); pre.src = imagemPreenchida(braco.estilo, f); }
      else { const pre = new Image(); pre.srcset = srcsetDoPlanner(braco.estilo); pre.src = imagemDoPlanner(braco.estilo); }
    }
  }
  /** crítica r2: voltou pelo cookie com o storage zerado (a sessão foi junto: esta aba não confere sozinha) */
  let retomada = false;
  const fora = () => e.pix?.donoIgual === false || !!e.pix?.doEmail || retomada;
  const semComoGerar = (r: GeradoU2027) => "erro" in r && (r.onde === "sem_sessao" || r.onde === "outra_conta");
  const base = () => ({ order_id: compra, pedido_u2027: e.pix?.orderId ?? null });
  const ev = (nome: string, d: Record<string, unknown> = {}) => ctx.evento(nome, { ...base(), ...(braco ? camposDoBraco(braco) : {}), ...d });

  const salvar = (novo: Partial<EstadoU2027>) => {
    const antes = e.etapa;
    e = { ...e, ...novo, salvoEm: Date.now() };
    gravarEstadoU2027(e);
    if (e.etapa === "fim") { parar(); fecharPagina(); ctx.card.removeAttribute("data-u27"); ctx.aoTerminar(); return; }
    render();
    if (antes !== e.etapa) ctx.aoMudar();
  };

  function preaquecer() {
    if (promessa || e.etapa === "fim" || e.etapa === "pronto") return;
    if (e.pix && Date.parse(e.pix.expiresAt) - Date.now() > 60_000) { promessa = Promise.resolve(e.pix); return; }
    tPre = Date.now();
    // 31/10 (o "glitch"): a oferta pode aparecer antes da conta final ficar pronta — o Pix espera a conta (a sessão dela)
    // crítica r2 (técnico BAIXA 4): a espera tem teto — se a conta travar na rede, segue pro gerar (a sessão já é dela) em 8 s
    const conta = ctx.contaPronta ? Promise.race([ctx.contaPronta(), new Promise<void>((ok) => { window.setTimeout(ok, 8000); })]) : Promise.resolve();
    const p = conta.then(() => { tPre = Date.now(); return ctx.api.gerar(compra); }).catch((x): GeradoU2027 => ({ erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(x).slice(0, 120) }));
    promessa = p;
    void p.then((r) => {
      const ok = "qrCode" in r;
      ev("landing_u2027_pix_pronto", { ms: Date.now() - tPre, ok, ...(ok ? {} : { motivo: "jaTem2027" in r ? "ja_tem" : r.onde }) });
      if ("qrCode" in r) {
        comEmail = !!r.comEmail;
        if (!e.pix || e.pix.orderId !== r.orderId) { e = { ...e, pix: { orderId: r.orderId, qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64, expiresAt: r.expiresAt, donoIgual: r.donoIgual }, copiado: false, comEmail }; gravarEstadoU2027(e); }
        else if (e.comEmail !== comEmail) { e = { ...e, comEmail }; gravarEstadoU2027(e); }
      }
      else if (veioDoLink && semComoGerar(r)) { venceu = true; ev("landing_u2027_venceu", { motivo: (r as { onde: string }).onde }); }
      else { promessa = null; } // falhou: o toque em "Quero" tenta de novo (lá mesmo)
      if (esperandoLink) { esperandoLink = false; if (e.etapa === "oferta") render(); }
      else if (venceu && e.etapa === "oferta") render();
    });
  }

  async function quero() {
    if (gerando) return;
    ev("landing_u2027_quero");
    erro = null;
    if (!promessa) preaquecer();
    const p = promessa!;
    // o código vai pra área de transferência AINDA no toque (resolve quando o Pix chegar — normalmente já chegou)
    const copia = ctx.copiarNoToque(p.then((r) => ("qrCode" in r ? r.qrCode : Promise.reject(new Error("sem pix")))));
    gerando = true; render();
    const r = await p;
    gerando = false;
    if ("jaTem2027" in r) { void copia.catch(() => null); salvar({ etapa: "pronto" }); return; }
    if (veioDoLink && semComoGerar(r)) { void copia.catch(() => null); venceu = true; render(); return; }
    if ("erro" in r) {
      void copia.catch(() => null);
      erro = r.erro; promessa = null;
      ev("landing_u2027_erro", { onde: "pix_create", msg: r.onde });
      render(); return;
    }
    const c = await copia;
    copiado = c.ok;
    ev("landing_u2027_copiado", { ok: c.ok, via: c.via, auto: true });
    qrDesde = Date.now();
    salvar({ etapa: "qr", pix: { orderId: r.orderId, qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64, expiresAt: r.expiresAt, donoIgual: r.donoIgual }, copiado: c.ok });
    conferirEmLoop();
  }

  function pago() {
    if (e.etapa === "pronto" || e.etapa === "fim") return;
    parar();
    ev("landing_u2027_pago", { valor: VALOR_U2027 });
    salvar({ etapa: "pronto" });
  }

  async function conferirUmaVez(): Promise<boolean> {
    if (e.etapa !== "qr" || !e.pix || conferindo || ctx.api.simulado) return false;
    conferindo = true;
    try { if (await ctx.api.conferir(e.pix)) { pago(); return true; } } catch { /* tenta de novo */ } finally { conferindo = false; }
    return false;
  }
  /** O laço (crítica r1): 3 s nos 10 primeiros minutos, 30 s até 30 min, só com a aba à vista; nada quando o dono é outra
   *  conta ou veio do e-mail (essa tela não confirma sozinha: o servidor diria MISMATCH). */
  function conferirEmLoop() {
    if (loop) { window.clearTimeout(loop); loop = null; }
    if (ctx.api.simulado || e.etapa !== "qr" || fora()) return;
    if (!qrDesde) qrDesde = Date.now();
    const proximo = () => {
      const passou = Date.now() - qrDesde;
      if (passou > LACO_U2027.paraMs || document.visibilityState === "hidden") return; // a volta da aba religa
      loop = window.setTimeout(passo, passou < LACO_U2027.viraLentoMs ? LACO_U2027.rapidoMs : LACO_U2027.lentoMs);
    };
    const passo = async () => {
      loop = null;
      if (e.etapa !== "qr" || document.visibilityState === "hidden" || Date.now() - qrDesde > LACO_U2027.paraMs) return;
      await conferirUmaVez();
      if (e.etapa === "qr") proximo();
    };
    proximo();
  }
  const aoVoltar = () => {
    if (document.visibilityState !== "visible" || e.etapa !== "qr" || fora()) return;
    void conferirUmaVez();
    if (!loop) conferirEmLoop();
  };
  document.addEventListener("visibilitychange", aoVoltar);
  window.addEventListener("pageshow", aoVoltar);

  function parar() {
    if (loop) { window.clearTimeout(loop); loop = null; }
    if (relogio) { window.clearInterval(relogio); relogio = null; }
  }

  async function jaPaguei() {
    ev("landing_u2027_ja_paguei");
    if (ctx.api.simulado) { pago(); return; }
    if (!(await conferirUmaVez())) {
      aviso = fora()
        ? "Quando o pagamento cair, o 2027 entra na sua conta e a gente avisa por e-mail."
        : "Ainda não chegou. Confere no app do banco: quando cair, esta tela muda sozinha.";
      render();
    }
  }

  /* ───────── as telas ───────── */
  /** 31/10 (upsell-tela-cheia): a página por cima da landing (só com a versão B + U27_PAGINA). null = fechada. */
  let pagina: HTMLElement | null = null;
  /**
   * crítica r1 (técnico MEDIA 1): a página é "própria" — o Voltar do celular fecha ELA (como o "Agora não"), não o site.
   * Abrir = 1 entrada no histórico com a marca desta compra (a recarga já tem a marca: não empilha de novo); o popstate
   * sem a marca fecha; fechar pelos botões volta essa entrada (history.back) e o popstate dela é ignorado.
   */
  const MARCA_U27 = "u27Pagina";
  const marcaNoHist = (): boolean => { try { const h = history.state as Record<string, unknown> | null; return !!h && typeof h === "object" && h[MARCA_U27] === compra; } catch { return false; } };
  let ignorarPop = false;
  /* crítica r2 (honestidade MEDIA 2): com a rolagem do navegador em "auto", o history.back() do fechar devolvia o y de
   * quando a página abriu (o QR, mais alto que a conta pronta) e a conta aparecia cortada, sem o título. Com a página
   * aberta a restauração fica "manual"; ao fechar, a conta pronta vai pro topo depois do popstate. */
  let restauracaoAntes: ScrollRestoration | null = null;
  let empilharNoLoad: (() => void) | null = null;
  const pousarNaConta = () => {
    const ir = () => { try { ctx.card.scrollIntoView({ block: "start", behavior: "auto" }); } catch { /* sem rolagem (teste) */ } };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(ir); else ir();
    if (restauracaoAntes) { try { history.scrollRestoration = restauracaoAntes; } catch { /* noop */ } restauracaoAntes = null; }
  };
  /* crítica r2 (técnico BAIXA 3): aberta, a landing por baixo sai do teclado/leitor (inert) e o Esc = "Agora não" */
  let inertes: Element[] = [];
  const teclaPagina = (k: KeyboardEvent) => {
    if (k.key !== "Escape" || !pagina || e.etapa !== "oferta" || document.getElementById("u27-zoom")) return;
    ev("landing_u2027_nao", { de: "esc" });
    salvar({ etapa: "fim" });
  };
  const fecharPagina = () => {
    if (!pagina) return;
    pagina.remove();
    pagina = null;
    inertes.forEach((el) => el.removeAttribute("inert")); inertes = [];
    document.removeEventListener("keydown", teclaPagina);
    if (empilharNoLoad) { window.removeEventListener("load", empilharNoLoad); empilharNoLoad = null; }
    try { document.documentElement.style.removeProperty("overflow"); } catch { /* noop */ }
    if (marcaNoHist()) { ignorarPop = true; try { history.back(); } catch { ignorarPop = false; pousarNaConta(); } }
    else pousarNaConta();
  };
  const aoPop = () => {
    if (ignorarPop) { ignorarPop = false; pousarNaConta(); return; }
    if (!pagina || marcaNoHist() || e.etapa === "fim") return;
    if (e.etapa === "pronto") ev("landing_u2027_continuar", { de: "voltar" });
    else ev("landing_u2027_nao", { de: "voltar", etapa: e.etapa });
    salvar({ etapa: "fim" });
  };
  window.addEventListener("popstate", aoPop);
  /** abre (1x) e devolve onde pintar o miolo e a barra */
  function abrirPagina(): { miolo: HTMLElement; barra: HTMLElement } {
    if (!pagina || !pagina.isConnected) {
      garantirCssPagina();
      pagina = document.createElement("div");
      pagina.id = "u27-pag";
      pagina.className = "u27p";
      pagina.dataset.estilo = braco!.estilo;
      pagina.dataset.testid = "u2027-pagina";
      pagina.setAttribute("role", "dialog");
      pagina.setAttribute("aria-modal", "true");
      pagina.setAttribute("aria-label", TITULO_U2027);
      pagina.innerHTML = `<div class="u27p-faixa" data-testid="u2027-faixa"></div><div class="u27p-rolo"><div class="u27p-miolo-alvo"></div></div><div class="u27p-barra" hidden><div></div></div>`;
      document.body.appendChild(pagina);
      inertes = Array.from(document.querySelectorAll("main.lp, #fim")).filter((el) => !el.hasAttribute("inert"));
      inertes.forEach((el) => el.setAttribute("inert", ""));
      document.addEventListener("keydown", teclaPagina);
      try { document.documentElement.style.overflow = "hidden"; } catch { /* noop */ }
      try { if (restauracaoAntes === null) { restauracaoAntes = history.scrollRestoration; history.scrollRestoration = "manual"; } } catch { /* noop */ }
      const empilhar = () => {
        empilharNoLoad = null;
        if (!pagina || marcaNoHist()) return;
        try {
          const h = history.state && typeof history.state === "object" ? { ...(history.state as Record<string, unknown>) } : {};
          delete h.lpDemoCheia; // a marca da demo em tela cheia da landing (landing.ts MARCA_CHEIA) não vem junto
          history.pushState({ ...h, [MARCA_U27]: compra }, "");
        } catch { /* sem histórico: fecha só pelos botões */ }
      };
      // crítica r2 (técnico MEDIA 1): no WebKit, uma navegação de iframe DEPOIS do pushState entra no histórico conjunto e
      // o 1º Voltar desfaz ela (a página não fecha). Aberta antes do load (a recarga na volta do banco), empilha no load.
      if (document.readyState === "complete") empilhar();
      else { empilharNoLoad = empilhar; window.addEventListener("load", empilhar, { once: true }); }
    }
    pintarFaixa();
    return { miolo: pagina.querySelector<HTMLElement>(".u27p-miolo-alvo")!, barra: pagina.querySelector<HTMLElement>(".u27p-barra")! };
  }

  /** a faixa fina do topo, por etapa (crítica r1, honestidade MEDIA 5): na oferta, "✓ Pagamento confirmado"; no QR do 2027,
   *  neutra ("Seu CORE está pago · este Pix é só do 2027"); no "Pronto" some (o ✓ grande já diz) */
  function pintarFaixa(): void {
    const f = pagina?.querySelector<HTMLElement>(".u27p-faixa");
    if (!f) return;
    const etapa = e.etapa;
    if (etapa === "pronto") { f.hidden = true; return; }
    f.hidden = false;
    if (etapa === "qr") {
      const v = ctx.valorPago?.() ?? null;
      f.dataset.tipo = "neutra";
      pintar(f, `<span data-testid="u2027-ja-pago">Seu CORE${v ? ` (${reais(v)})` : ""} está pago · este Pix é só do 2027</span>`);
      return;
    }
    delete f.dataset.tipo;
    pintar(f, `${ICO_CHECK}<span><b>Pagamento confirmado</b> · ${esc(ctx.faixaConfirmada?.() ?? "o CORE é seu pra sempre")}</span>`);
  }

  /** a oferta em página: o 2027 como fica no app (EXEMPLO) + o planner que se preenche sozinho (EXEMPLO) */
  function htmlDaPagina(estilo: EstiloPlanner): string {
    const folha = (f: FolhaPreenchida, nome: string, de: string) =>
      `<button type="button" data-folha="${f}" aria-label="Ver o exemplo da folha ${nome}"><i class="u27p-fimg"><img src="${imagemPreenchida(estilo, f)}" srcset="${srcsetPreenchida(estilo, f)}" width="620" height="877" alt="Exemplo da folha ${nome} preenchida" decoding="async"><b class="u27p-ex">EXEMPLO</b></i><span>${nome}<small>${de}</small></span></button>`;
    const fio = (n: number, ok: number) => `<span class="u27p-fio" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i${i < ok ? ' class="ok"' : ""}></i>`).join("")}</span>`;
    const onde = ondeU27Pagina();
    return `
      <div class="u27p-miolo" data-testid="u2027-oferta" data-pagina="1">
        <p class="u27p-kicker">Espera, tem mais uma coisa</p>
        <h1>Seu 2027 <em>organizado</em></h1>
        <p class="u27p-sub">${SUB_U27_PAGINA}</p>
        <div class="u27p-app" data-testid="u2027-app">
          <b class="u27p-ex">EXEMPLO</b>
          <div class="u27p-l u27p-metas"><small>3 metas</small><ol>${EXEMPLO_2027.metas.map((m) => `<li>${esc(m)}</li>`).join("")}</ol></div>
          <div class="u27p-l u27p-din"><small>Por mês</small><div>Gastar <b>${brlInteiro(EXEMPLO_2027.gastar)}</b> · guardar <b>${brlInteiro(EXEMPLO_2027.guardar)}</b></div></div>
          <div class="u27p-l u27p-rev"><small>Revisões</small><div>12 revisões <em>· todo dia 1, em 5 min</em>${fio(12, 1)}</div></div>
          <div class="u27p-l u27p-cof"><small>Cofrinho</small><div>52 semanas <em>· R$ 1 a mais por semana</em>${fio(52, EXEMPLO_2027.semanas)}</div></div>
        </div>
        <h2 class="u27p-h2">${estilo === "codex" ? `O planner se <em>preenche sozinho</em>` : PROMESSA_PLANNER}</h2>
        <p class="u27p-sub">${PROMESSA_PLANNER_DESC}</p>
        <div class="u27p-folhas" data-testid="u2027-folhas">${folha("mes", "Meu mês", "do Finanças, no mês em que você baixar")}${folha("semana", "Minha semana", "da Rotina, na semana em que você baixar")}</div>
        <p class="u27p-toque">Toque numa folha pra ver grande</p>
        <p class="u27p-mini">${TOTAL_FOLHAS_TXT} pra salvar no celular ou imprimir. ${QUANDO_U27_PAGINA}</p>
        ${onde ? `<p class="u27p-mini" data-testid="u2027-onde-pagina">${onde}</p>` : ""}
        <p class="u27-nota">É separado do CORE que você já pagou.</p>
      </div>`;
  }

  function render(): boolean {
    if (relogio) { window.clearInterval(relogio); relogio = null; }
    if (e.etapa === "fim") { fecharPagina(); ctx.card.removeAttribute("data-u27"); return false; }
    ctx.card.dataset.fase = "conta"; // o CSS esconde a oferta do vitalício (qualquer fase ≠ "oferta")
    ctx.card.setAttribute("data-u27", "");
    let c = ctx.caixa;
    let barra: HTMLElement | null = null;
    if (comPagina) {
      // o cartão por baixo fica quieto (a página cobre tudo); o miolo e a barra são da página
      pintar(ctx.caixa, '<div class="u27" data-testid="u2027-na-pagina"></div>');
      const p = abrirPagina();
      c = p.miolo; barra = p.barra;
      if (e.etapa !== "oferta" || venceu || esperandoLink) { barra.hidden = true; pintar(barra.firstElementChild as HTMLElement, ""); }
    }
    const topoPago = comPagina ? "" : `<div class="u27-ok">${ICO_CHECK}<span>Pagamento confirmado</span></div><p class="u27-linha" data-testid="u2027-linha">${esc(ctx.linhaConfirmada())}</p>`;
    const sep = comPagina ? "" : '<div class="u27-sep"></div>';
    if (e.etapa === "oferta" && venceu) {
      if (pintar(c, `
      <div class="u27" data-testid="u2027-venceu">
        ${topoPago}
        ${sep}
        <h3>Esse código venceu</h3>
        <p class="u27-desc">O Pix do Seu 2027 valia 24 horas. O CORE que você pagou continua seu, do mesmo jeito.</p>
        <div class="lp-form"><button type="button" class="lp-cta" id="u27-conta">Ver minha conta</button></div>
      </div>`)) c.querySelector<HTMLButtonElement>("#u27-conta")!.addEventListener("click", () => { ev("landing_u2027_nao", { de: "venceu" }); salvar({ etapa: "fim" }); });
      return true;
    }
    if (e.etapa === "oferta" && esperandoLink) {
      preaquecer();
      pintar(c, `<div class="u27" data-testid="u2027-conferindo">${topoPago}<div class="u27-gerando"><i></i>Abrindo o seu Pix…</div></div>`);
      return true;
    }
    if (e.etapa === "oferta") {
      if (!vistaOferta) { vistaOferta = true; ev("landing_u2027_view", braco ? { planner: braco.estilo, ...(comPagina ? { pagina: true } : {}) } : {}); }
      preaquecer();
      const botoes = `${gerando
          ? '<button type="button" class="lp-cta" id="u27-quero" disabled><i class="lp-gira"></i>Gerando o Pix…</button>'
          : '<button type="button" class="lp-cta" id="u27-quero">Quero · copiar o Pix</button>'}
        ${erro ? `<p class="lp-erro" role="alert">${esc(erro)}</p>` : ""}`;
      if (comPagina && barra) {
        if (pintar(c, htmlDaPagina(braco!.estilo))) {
          const h1 = c.querySelector<HTMLElement>("h1");
          if (h1) { h1.tabIndex = -1; try { h1.focus({ preventScroll: true }); } catch { /* noop */ } }
          c.querySelectorAll<HTMLButtonElement>(".u27p-folhas button").forEach((b) => b.addEventListener("click", () => {
            const f = b.dataset.folha as FolhaPreenchida;
            ev("landing_u2027_zoom", { folha: f });
            abrirZoomDaFolha(braco!.estilo, f, () => b.focus());
          }));
        }
        barra.hidden = false;
        if (pintar(barra.firstElementChild as HTMLElement, `<div data-testid="u2027-barra"><div class="u27p-preco"><b data-testid="u2027-preco">${reais(VALOR_U2027)}</b><span>uma vez, sem mensalidade</span></div>
        ${ondeCurtoU27Pagina() ? `<p class="u27p-onde" data-testid="u2027-onde-barra">${ondeCurtoU27Pagina()}</p>` : ""}
        ${botoes}
        <button type="button" class="u27p-nao" id="u27-nao">Agora não · ver minha conta</button></div>`)) {
          barra.querySelector<HTMLButtonElement>("#u27-quero")!.addEventListener("click", () => { void quero(); });
          barra.querySelector<HTMLButtonElement>("#u27-nao")!.addEventListener("click", () => { ev("landing_u2027_nao", { de: "oferta" }); salvar({ etapa: "fim" }); });
        }
        return true;
      }
      if (pintar(c, `
      <div class="u27" data-testid="u2027-oferta">
        ${topoPago}
        <div class="u27-sep"></div>
        <div class="u27-kicker">Quer ir além?</div>
        <h3>${TITULO_U2027}</h3>
        ${comPlanner
          ? `<figure class="u27-planner" data-testid="u2027-planner" data-estilo="${braco!.estilo}"><button type="button" id="u27-zoom-abrir" aria-label="${ZOOM_U2027_PLANNER}"><img src="${imagemDoPlanner(braco!.estilo)}" srcset="${srcsetDoPlanner(braco!.estilo)}" width="640" height="460" alt="Duas folhas do planner 2027: a capa e o ano numa página" decoding="async"></button><figcaption>${LEGENDA_U2027_PLANNER} <u>${ZOOM_U2027_PLANNER}</u></figcaption></figure>
        <p class="u27-desc">${DESC_U2027_PLANNER}</p>`
          : `<p class="u27-desc">${DESC_U2027}</p>`}
        <div class="u27-preco"><b data-testid="u2027-preco">${reais(VALOR_U2027)}</b><span>uma vez, sem mensalidade</span></div>
        ${botoes}
        <button type="button" class="u27-sair" id="u27-nao">Agora não · ver minha conta</button>
        <p class="u27-nota">${comPlanner ? NOTA_U2027_PLANNER : NOTA_U2027}</p>
      </div>`)) {
        c.querySelector<HTMLButtonElement>("#u27-quero")!.addEventListener("click", () => { void quero(); });
        c.querySelector<HTMLButtonElement>("#u27-nao")!.addEventListener("click", () => { ev("landing_u2027_nao", { de: "oferta" }); salvar({ etapa: "fim" }); });
        const zoom = c.querySelector<HTMLButtonElement>("#u27-zoom-abrir");
        zoom?.addEventListener("click", () => { ev("landing_u2027_zoom"); abrirZoomDoPlanner(braco!.estilo, () => zoom.focus()); });
      }
      return true;
    }
    if (e.etapa === "qr" && e.pix) {
      const p = e.pix;
      if (e.copiado && copiado === null) copiado = true; // a volta do banco: ela já copiou (e colou)
      const fora = p.donoIgual === false || !!p.doEmail || retomada;
      const resta = () => Date.parse(p.expiresAt) - Date.now();
      // crítica r2 (compradora 1): na volta do banco / pelo link, a tela diz que o CORE está pago e que ESTE Pix é só do 2027;
      // sem a tela da oferta antes (link do e-mail, retomada), diz também o que é o "Seu 2027"
      const v = ctx.valorPago?.() ?? null;
      const semOferta = veioDoLink || retomada;
      if (pintar(c, `
      <div class="u27" data-testid="u2027-qr">
        ${comPagina ? "" : `<div class="u27-ok u27-ok-qr" data-testid="u2027-ja-pago">${ICO_CHECK}<span>Seu CORE${v ? ` (${reais(v)})` : ""} está pago. Este Pix é só do 2027.</span></div>`}
        ${semOferta ? `<p class="u27-qual" data-testid="u2027-qual"><b>${TITULO_U2027}</b> · 3 metas, revisões do mês e cofrinho</p>` : ""}
        <div class="u27-valor"><b>${reais(VALOR_U2027)}</b><span>Seu 2027 · uma vez</span></div>
        <div class="u27-copiado${copiado ? "" : " falta"}" data-testid="u2027-copiado">${copiado ? ICO_CHECK : ICO_COPIAR}<span>${copiado
          ? "<b>Código copiado.</b>Cole no app do banco, em Pix Copia e Cola."
          : "<b>Copie o código</b>e cole no app do banco, em Pix Copia e Cola."}</span></div>
        <div class="u27-qr"><div class="lp-qr" id="u27-qr-img"></div><div class="u27-qr-lado"><div class="lp-codigo" data-testid="u2027-codigo">${esc(p.qrCode)}</div><button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="u27-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código"}</span></button></div></div>
        <div class="u27-volte" data-testid="u2027-volte"><i class="lp-ponto"></i><span>${fora
          ? "<b>Pagou?</b>Quando o pagamento cair, o 2027 entra na sua conta e a gente avisa por e-mail."
          : "<b>Pagou? Volte aqui.</b>Esta tela confirma sozinha."}<span class="u27-vale" id="u27-vale">${validadeU2027(resta())}${comEmail && ctx.email() ? " O código também foi pro seu e-mail." : ""}</span></span></div>
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        <div class="lp-links"><button type="button" class="lp-link" id="u27-ja-paguei">Já paguei</button><button type="button" class="lp-link" id="u27-sair">${fora ? "Continuar" : "Agora não"}</button></div>
      </div>`)) {
        void ctx.desenharQr(c.querySelector<HTMLElement>("#u27-qr-img")!, p);
        c.querySelector<HTMLButtonElement>("#u27-copiar")!.addEventListener("click", async () => {
          const ok = await ctx.copiarTexto(p.qrCode);
          ev("landing_u2027_copiado", { ok, via: "botao", auto: false });
          if (ok && !copiado) { copiado = true; e = { ...e, copiado: true }; gravarEstadoU2027(e); render(); return; }
          const rot = c.querySelector<HTMLElement>("#u27-copiar span");
          if (ok && rot) { rot.textContent = "Copiado ✓"; window.setTimeout(() => { if (rot.isConnected) rot.textContent = "Copiar de novo"; }, 1500); }
        });
        c.querySelector<HTMLButtonElement>("#u27-ja-paguei")!.addEventListener("click", () => { void jaPaguei(); });
        c.querySelector<HTMLButtonElement>("#u27-sair")!.addEventListener("click", () => { ev("landing_u2027_nao", { de: "qr" }); salvar({ etapa: "fim" }); });
      }
      relogio = window.setInterval(() => {
        const el = document.getElementById("u27-vale");
        const r = resta();
        if (el && r <= 0) el.textContent = validadeU2027(r);
        if (r <= 0) { window.clearInterval(relogio!); relogio = null; promessa = null; salvar({ etapa: "oferta", pix: null }); }
      }, 30_000);
      if (!loop) conferirEmLoop();
      return true;
    }
    if (e.etapa === "pronto") {
      const email = ctx.email();
      if (pintar(c, `
      <div class="lp-pago u27 u27-pronto" data-testid="u2027-pronto">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Pronto, seu 2027 tá no seu CORE</h3>
        <ul class="u27-lista">${(comPlanner ? [...ITENS_U2027.slice(0, 3), comPagina ? ITEM_PLANNER_PAGINA : ITEM_PLANNER_U2027] : ITENS_U2027).map((t) => `<li>${ICO_CHECK}<span>${t}</span></li>`).join("")}</ul>
        <div class="u27-onde" data-testid="u2027-onde">${comPagina ? ONDE_U2027_PAGINA() : ONDE_U2027}${email ? (comPlanner ? ` Entre com o código que vai pro <b>${esc(email)}</b>, sem senha.` : ` Entre com <b>${esc(email)}</b>.`) : ""}</div>
        ${comPlanner
          ? `<div class="lp-form"><button type="button" class="lp-cta" id="u27-planejar" data-testid="u2027-planejar" data-href="${esc(portaDoLink(LINK_PLANEJAR_2027, email))}">${CTA_PRONTO_U2027_PLANNER}</button></div>
        <div class="u27-pronto-lojas" data-testid="u2027-pronto-lojas"><p>Ou no app, com o mesmo e-mail:</p><div class="lp-selos"><a href="${URL_APP_STORE}" target="_blank" rel="noopener" data-loja="ios"><img src="/selos/app-store.svg" alt="Baixar na App Store" width="108" height="36"></a><a href="${esc(urlPlay("landing"))}" target="_blank" rel="noopener" data-loja="android"><img src="/selos/google-play.png" alt="Disponível no Google Play" width="93" height="36"></a></div></div>
        <div class="lp-links"><button type="button" class="lp-link" id="u27-continuar">Depois · ver minha conta</button></div>`
          : '<div class="lp-form"><button type="button" class="lp-cta" id="u27-continuar">Continuar</button></div>'}
      </div>`)) {
        c.querySelector<HTMLButtonElement>("#u27-continuar")!.addEventListener("click", () => { ev("landing_u2027_continuar"); salvar({ etapa: "fim" }); });
        // crítica r1 (compradora MEDIA 1): com a versão B, o "Pronto" leva direto ao Planejar (o planner sai com os dados dela)
        // crítica r2 (compradora ALTA 2): pela porta /entrar (com sessão vai direto; sem ela, "Entrar sem senha" com o e-mail
        // preenchido e volta pro Planejar) — nunca o /auth de senha
        c.querySelector<HTMLButtonElement>("#u27-planejar")?.addEventListener("click", () => { ev("landing_u2027_planejar"); location.href = portaDoLink(LINK_PLANEJAR_2027, email); });
      }
      return true;
    }
    // etapa qr sem Pix (não deveria): volta pra oferta
    e = { ...e, etapa: "oferta", pix: null };
    return render();
  }

  function retomar() {
    retomada = true;
    if (loop) { window.clearTimeout(loop); loop = null; } // sem sessão nesta aba: nada de laço (o "Já paguei" ainda confere)
    ev("landing_u2027_volta_email", { restaurado: `cookie_${e.etapa}` });
  }

  function voltaDoEmail(pix: PixU2027 | null) {
    veioDoLink = true;
    let restaurado = "oferta";
    // crítica r1: depois de "Continuar"/"Agora não" pelo link, a recarga fica na conta (não reabre o QR)
    if (e.etapa === "fim") restaurado = "fim";
    else if (e.etapa === "pronto") restaurado = "pronto";
    else if (e.pix && pix && e.pix.orderId === pix.orderId && e.etapa === "qr") restaurado = "aba";
    else if (pix) { restaurado = "link"; const mesmo = e.pix?.orderId === pix.orderId; e = { ...e, etapa: "qr", pix: { ...pix, donoIgual: mesmo ? e.pix!.donoIgual : false }, copiado: mesmo && e.copiado === true }; gravarEstadoU2027(e); copiado = null; }
    else { e = { ...e, etapa: "oferta", pix: null }; gravarEstadoU2027(e); esperandoLink = true; }
    ev("landing_u2027_volta_email", { restaurado });
  }

  if (e.etapa === "qr") conferirEmLoop();

  return {
    ativo: () => e.etapa !== "fim",
    render,
    preaquecer,
    voltaDoEmail,
    retomar,
    simularPago: () => { if (e.etapa === "qr") pago(); },
    etapa: () => e.etapa,
    parar: () => { parar(); fecharPagina(); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("pageshow", aoVoltar); window.removeEventListener("popstate", aoPop); },
  };
}
