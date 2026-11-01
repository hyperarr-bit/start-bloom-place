/**
 * "LEVE ALGUÉM JUNTO" NO PÓS-PAGO DA /organizar (01/11, novidades-guardadas/2026-11-01/upsell-presente) — o PRESENTE no lugar
 * do "Seu 2027" quando a chave UPSELL_POS do <head> do landing.html está em "presente" (html[data-upsell-pos="presente"];
 * padrão "2027" = nada daqui baixa). A MESMA página própria em tela cheia do 2027 (./upsell-2027.ts: faixa fina, miolo que
 * rola, barra fixa com o preço, o Quero e o Agora não), com o próprio <style> (o 1º <style> do landing.html não muda).
 *
 *   oferta   faixa "✓ Pagamento confirmado · o CORE é seu pra sempre" · "Leve alguém junto" · "Dê o CORE pra sempre pra quem
 *            você quer bem." · como funciona em 3 passos · barra: R$ 14,90 uma vez, sem mensalidade · "Quero · copiar o Pix" ·
 *            "Agora não · ver minha conta". O Pix (pv149, 24 h, 1 por compra) já é gerado quando a oferta aparece.
 *   qr       o toque copia o código (o Pix pré-aquecido) → QR + código + "Pagou? Volte aqui. Esta tela confirma sozinha." ·
 *            confere 3 s nos 10 primeiros minutos, 30 s até 30 min, só com a aba à vista; depois, a volta da aba e o "Já paguei".
 *   cartao   o MESMO cartão da /presente/dar (src/presente/FluxoPresente.tsx TelaCartao, mesmas classes de presente.css): o link
 *            /presente/<código>, o nome no cartão, "Enviar no WhatsApp", "Copiar link" e "Pronto · ver minha conta".
 *   fim      a landing mostra a conta pronta de sempre (com App Store e Google Play).
 * Nunca junto do 2027 (a landing escolhe UM módulo). Nunca pra quem não comprou o CORE pra sempre (a landing e o servidor
 * conferem). Sem Purchase pra Meta (upsell: só a UTMify, _shared/pix-upsell.ts).
 *
 * Eventos (todos com braco_lp/braco_checkout pelo `evento` da landing + order_id = a compra do vitalício + pedido_presente +
 * upsell_pos "presente"): landing_presente_view · _quero · _nao {de} · _pix_pronto {ms, ok, motivo?} · _copiado {ok, via} ·
 * _ja_paguei · _pago {valor} · _codigo {ok} · _whatsapp {com_nome} · _link_copiado {ok} · _continuar {de} · _erro {onde} ·
 * _sem_acesso {motivo}
 */
import { VALOR_PRESENTE_LP, reais, validadeU2027, type EstadoPresenteLp, type PixU2027 } from "./regras";
import { gravarEstadoPresenteLp, lerEstadoPresenteLp } from "./presente-estado";
import { linkDoPresente, mensagemDoPresente, nomeLimpo, urlWhatsApp } from "@/lib/presente-link";
import type { Upsell2027 } from "./upsell-2027";
import "@/presente/presente.css";

export type GeradoPresente =
  | (PixU2027 & { comEmail?: boolean })
  | { presentePago: true; pedido: string; codigo: string; de: string | null }
  | { erro: string; onde: string };
export type ApiPresente = {
  gerar: (compra: string) => Promise<GeradoPresente>;
  conferir: (pix: PixU2027) => Promise<{ pago: boolean; codigo: string | null }>;
  /** o código do pedido pago (a recarga do cartão) */
  buscar: (pedido: string) => Promise<{ codigo: string; de: string | null } | null>;
  gravarNome: (pedido: string, nome: string) => Promise<boolean>;
  /** simulado (dev/testes): a página não confere sozinha; "Já paguei" confirma */
  simulado: boolean;
};
export type CtxPresente = {
  caixa: HTMLElement;
  card: HTMLElement;
  api: ApiPresente;
  evento: (nome: string, dados?: Record<string, unknown>) => void;
  copiarNoToque: (codigo: Promise<string>) => Promise<{ ok: boolean; via: string }>;
  copiarTexto: (c: string) => Promise<boolean>;
  desenharQr: (alvo: HTMLElement, p: { qrCode: string; qrCodeBase64: string | null }) => void | Promise<void>;
  /** o e-mail da conta final ("o link também vai pro seu e-mail" só com ele) */
  email: () => string | null;
  /** quanto ela pagou no CORE (a faixa neutra do QR) */
  valorPago?: () => number | null;
  aoTerminar: () => void;
  aoMudar: () => void;
  /** o Pix só pode ser gerado com a conta FINAL pronta (a sessão dela) — a oferta aparece já no pago */
  contaPronta?: () => Promise<void>;
  /** a faixa da oferta: "o CORE é seu pra sempre" */
  faixaConfirmada?: () => string;
};

/* ───────── os textos (curtos, sem gênero, sem "só hoje", sem contagem, sem brinde) ───────── */
export const TITULO_PRESENTE_LP = "Leve alguém junto";
export const SUB_PRESENTE_LP = "Dê o CORE pra sempre pra quem você quer bem.";
export const PASSOS_PRESENTE_LP = ["Você paga o Pix", "Manda o link no WhatsApp", "A pessoa abre e cria a conta dela"] as const;
export const NOTA_PRESENTE_LP = "Vale pra 1 pessoa que ainda não tem o CORE. É separado do seu.";
export const PRECO_TXT_PRESENTE_LP = "uma vez, sem mensalidade";

/** O laço de conferência (o mesmo do 2027: LACO_U2027 — sem importar o módulo dele). */
export const LACO_PRESENTE_LP = { rapidoMs: 3000, lentoMs: 30_000, viraLentoMs: 10 * 60e3, paraMs: 30 * 60e3 } as const;
/** O código do presente pago que não chegou de primeira: 6 tentativas de 2 s (o mesmo do TelaCartao). */
export const BUSCA_CODIGO_LP = { tentativas: 6, cadaMs: 2000 } as const;

const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const ICO_ZAP = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2z"/></svg>';
/** O presente "sticker" do FluxoPresente (src/presente/IlustraPresente.tsx), em HTML puro (a landing não tem React). */
const ilustra = (size: number, id: string) => `<svg width="${size}" height="${size}" viewBox="0 0 160 160" aria-hidden="true" data-testid="presente-ilustra"><defs><linearGradient id="prc${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f45ba3"/><stop offset="1" stop-color="#d6338a"/></linearGradient><linearGradient id="prt${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff86bd"/><stop offset="1" stop-color="#e7449a"/></linearGradient><linearGradient id="prf${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffdf85"/><stop offset="1" stop-color="#ffc63d"/></linearGradient></defs><ellipse cx="80" cy="146" rx="46" ry="6" fill="rgba(22,18,28,.12)"/><rect x="30" y="70" width="100" height="70" rx="11" fill="url(#prc${id})" stroke="#16121c" stroke-width="4"/><rect x="70" y="72" width="20" height="66" fill="url(#prf${id})"/><path d="M70 72v66M90 72v66" stroke="#16121c" stroke-width="3.5"/><rect x="21" y="52" width="118" height="24" rx="9" fill="url(#prt${id})" stroke="#16121c" stroke-width="4"/><rect x="69" y="52" width="22" height="24" fill="url(#prf${id})" stroke="#16121c" stroke-width="3.5"/><path d="M80 52C66 26 40 30 48 46c4 8 20 8 32 6z" fill="url(#prf${id})" stroke="#16121c" stroke-width="4" stroke-linejoin="round"/><path d="M80 52c14-26 40-22 32-6-4 8-20 8-32 6z" fill="url(#prf${id})" stroke="#16121c" stroke-width="4" stroke-linejoin="round"/><circle cx="80" cy="51" r="8" fill="#ffc63d" stroke="#16121c" stroke-width="4"/><rect x="38" y="82" width="7" height="42" rx="3.5" fill="#fff" opacity=".38"/><rect x="29" y="57" width="26" height="5" rx="2.5" fill="#fff" opacity=".5"/><path d="M55 40c-2-5 3-8 6-4" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".7"/><path d="M116 100c0-6 7-8 9-3 2-5 9-3 9 3 0 7-9 12-9 12s-9-5-9-12z" fill="#fff" stroke="#16121c" stroke-width="3.5" stroke-linejoin="round"/><path d="M121 102c0-2 1-3 3-3" stroke="#d6338a" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M22 26l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd25e" stroke="#16121c" stroke-width="2.5" stroke-linejoin="round"/><path d="M140 20l2.2 5 5 2.2-5 2.2-2.2 5-2.2-5-5-2.2 5-2.2z" fill="#fff" stroke="#16121c" stroke-width="2.3" stroke-linejoin="round"/><circle cx="147" cy="62" r="3.5" fill="#d6338a"/><circle cx="13" cy="74" r="3" fill="#7fb7e8"/></svg>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/* a PÁGINA (o mesmo desenho da página do 2027, braço "core": branco + Inter). Escopo .prp — nada vaza pra landing. */
const CSS = `
.prp{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:#fff;color:#1c1a1f;text-align:left;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.prp-faixa{flex:none;display:flex;align-items:center;justify-content:center;gap:7px;min-height:36px;padding:7px 16px;padding-top:max(7px,env(safe-area-inset-top));background:#ecfdf3;color:#14532d;font-size:13px;font-weight:650;line-height:1.25;text-align:center}
.prp-faixa svg{width:16px;height:16px;padding:2.5px;border-radius:50%;background:#16a34a;color:#fff;flex:none}
.prp-faixa b{font-weight:800}
.prp-faixa[data-tipo="neutra"]{min-height:30px;padding-top:max(6px,env(safe-area-inset-top));padding-bottom:6px;background:#fff;color:#6b6670;font-size:12.5px;font-weight:600;border-bottom:1px solid #ebe8ee}
.prp-faixa[data-tipo="neutra"] svg{display:none}
.prp-faixa[hidden]{display:none}
.prp-rolo{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.prp-miolo{max-width:520px;margin:0 auto;padding:18px 16px 24px;animation:prp-surge .25s ease-out both}
@keyframes prp-surge{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.prp-cena{display:flex;justify-content:center;margin:0 0 2px}
.prp-cena svg{filter:drop-shadow(0 10px 16px rgba(214,51,138,.16))}
.prp h1{margin:4px 0 0;font-size:31px;line-height:1.08;font-weight:850;letter-spacing:-.03em;text-align:center;text-wrap:balance}
.prp h1 em{font-style:normal;color:#d6338a}
.prp-sub{margin:8px auto 0;max-width:32ch;font-size:15.5px;line-height:1.45;color:#6b6670;text-align:center;text-wrap:balance}
.prp-passos{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:0;border:1px solid #ebe8ee;border-radius:16px}
.prp-passos li{display:flex;align-items:center;gap:12px;padding:11px 14px;font-size:15px;font-weight:650;line-height:1.3}
.prp-passos li+li{border-top:1px solid #ebe8ee}
.prp-passos b{flex:none;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:#262626;color:#fff;font-size:12px;font-weight:850}
.prp-nota{margin:12px 0 0;font-size:13px;line-height:1.4;color:#6b6670;text-align:center}
.prp-barra{flex:none;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #ebe8ee;box-shadow:0 -10px 24px -18px rgba(30,20,40,.35)}
.prp-barra[hidden]{display:none}
.prp-barra>div{max-width:520px;margin:0 auto}
.prp-preco{display:flex;align-items:baseline;justify-content:center;gap:8px;margin:0 0 8px}
.prp-preco b{font-size:22px;font-weight:850;letter-spacing:-.02em}
.prp-preco span{font-size:13px;font-weight:650;color:#6b6670}
.prp-barra button.lp-cta{min-height:52px}
.prp-nao{display:block;width:100%;min-height:44px;margin-top:4px;border:0;background:none;color:#6b6670;font-size:14.5px;font-weight:700;font-family:inherit;cursor:pointer}
.prp .lp-erro{margin:8px 0 0;text-align:center}
/* o QR do presente (o mesmo desenho do QR do 2027) */
.prp-qrtela{max-width:520px;margin:0 auto;padding:18px 16px 24px}
.prp-valor{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 12px}
.prp-valor b{font-size:22px;font-weight:850;letter-spacing:-.02em}
.prp-valor span{font-size:13px;font-weight:650;color:#6b6670}
.prp-copiado{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:14px;background:#ecfdf3;color:#14532d;font-size:14px;line-height:1.35}
.prp-copiado svg{width:22px;height:22px;flex-shrink:0;padding:4px;border-radius:50%;background:#16a34a;color:#fff}
.prp-copiado b{display:block;font-size:15.5px}
.prp-copiado.falta{background:#f7f5f8;color:#1c1a1f}
.prp-copiado.falta svg{background:#262626}
.prp-qr{display:flex;gap:14px;align-items:center;margin-top:14px}
.prp-qr .lp-qr{width:116px;height:116px}
.prp-qr-lado{flex:1;min-width:0}
.prp-qr-lado .lp-codigo{margin-top:0;max-height:none;padding:0;border:10px solid #f7f5f8;border-width:10px 12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.prp-qr-lado button.lp-copiar{min-height:46px;font-size:14.5px}
.prp-volte{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:12px 14px;border-radius:14px;border:1px solid #ebe8ee;font-size:13.5px;line-height:1.4;color:#6b6670}
.prp-volte b{color:#1c1a1f;display:block;font-size:15px}
.prp-vale{display:block;margin-top:4px;font-size:12.5px}
.prp .lp-links{display:flex;flex-direction:column;align-items:stretch;gap:2px;margin-top:10px}
.prp #pr-ja-paguei{min-height:46px;border:1.5px solid #1c1a1f;border-radius:12px;background:none;color:#1c1a1f;font-size:15px;font-weight:750;text-decoration:none}
.prp #pr-sair{min-height:40px;font-size:13.5px;color:#6b6670}
.prp-gerando{display:flex;align-items:center;justify-content:center;gap:10px;min-height:120px;font-size:15px;font-weight:700;color:#6b6670}
.prp-gerando i{width:16px;height:16px;border-radius:50%;border:2.4px solid #ebe8ee;border-top-color:#262626;animation:lp-gira .8s linear infinite}
/* o cartão (classes do presente.css, as mesmas da /presente/dar) dentro da página */
.prp[data-etapa="cartao"]{background:linear-gradient(180deg,#ffe3ef 0%,#f6eef6 34%,#f3f2f7 62%)}
.prp[data-etapa="cartao"] .prp-barra{background:#f3f2f7;border-top:0;box-shadow:none}
.prp .pv{background:none}
.prp-cartao{position:relative;max-width:520px;margin:0 auto;padding:16px 18px 20px}
.prp-cartao .pv-titulo{margin-top:14px}
.prp-barra .pv-rodape-lp{display:flex;flex-direction:column;gap:6px}
.prp-barra a.pv-cta,.prp-barra button.pv-sec{min-height:52px}
.prp-cartao .pv-miuda{margin-top:10px}
@media (max-width:359px){.prp h1{font-size:28px}.prp-qr .lp-qr{width:100px;height:100px}}
@media (max-height:700px){.prp-miolo{padding-top:12px}.prp h1{font-size:28px}.prp-passos{margin-top:14px}.prp-passos li{padding:9px 14px}.prp-barra{padding-top:8px}.prp-preco{margin-bottom:6px}.prp-barra button.lp-cta{min-height:48px}.prp-nao{min-height:40px;margin-top:2px}}
@media (prefers-reduced-motion:reduce){.prp-miolo{animation:none}}
`;
function garantirCss(): void {
  if (document.getElementById("lp-presente-css")) return;
  const st = document.createElement("style");
  st.id = "lp-presente-css";
  st.textContent = CSS;
  document.head.appendChild(st);
}
/** Pinta só se mudou (o mesmo truque do 2027: a landing re-renderiza o cartão quando a conta fica pronta — nada pisca). */
const pintado = new WeakMap<HTMLElement, { html: string; el: Element | null }>();
function pintar(alvo: HTMLElement, html: string): boolean {
  const m = pintado.get(alvo);
  if (m && m.html === html && m.el && alvo.firstElementChild === m.el) return false;
  alvo.innerHTML = html;
  pintado.set(alvo, { html, el: alvo.firstElementChild });
  return true;
}

export function criarUpsellPresente(compra: string, ctx: CtxPresente): Upsell2027 {
  garantirCss();
  let e: EstadoPresenteLp = lerEstadoPresenteLp(compra);
  let promessa: Promise<GeradoPresente> | null = null;
  let tPre = 0;
  let copiado: boolean | null = null;
  let gerando = false;
  let erro: string | null = null;
  let aviso: string | null = null;
  let loop: number | null = null;
  let relogio: number | null = null;
  let vistaOferta = false;
  let conferindo = false;
  let qrDesde = 0;
  /** o cartão: o nome digitado, a cópia, o código que não chegou */
  let nome = e.de ?? "";
  let nomeSalvo = e.de ?? "";
  let tNome: number | null = null;
  let linkCopiado = false;
  let copiaFalhou = false;
  let semCodigo = false;
  let buscando = false;
  const fora = () => e.pix?.donoIgual === false;
  const base = () => ({ order_id: compra, pedido_presente: e.pedido ?? e.pix?.orderId ?? null, upsell_pos: "presente" });
  const ev = (n: string, d: Record<string, unknown> = {}) => ctx.evento(n, { ...base(), ...d });

  const salvar = (novo: Partial<EstadoPresenteLp>) => {
    const antes = e.etapa;
    e = { ...e, ...novo, salvoEm: Date.now() };
    gravarEstadoPresenteLp(e);
    if (e.etapa === "fim") { parar(); fecharPagina(); ctx.card.removeAttribute("data-u27"); ctx.aoTerminar(); return; }
    render();
    if (antes !== e.etapa) ctx.aoMudar();
  };
  /** saiu sem ver (a compra não é pra sempre / o servidor recusou): direto a conta, sem evento de "não" */
  const semAcesso = (motivo: string) => { ev("landing_presente_sem_acesso", { motivo }); salvar({ etapa: "fim" }); };

  /** pago: o cartão (com o código, se já veio; senão o cartão busca) */
  function pagoCom(pedido: string, codigo: string | null, de: string | null = null) {
    if (e.etapa === "cartao" || e.etapa === "fim") return;
    parar();
    ev("landing_presente_pago", { valor: VALOR_PRESENTE_LP, pedido_presente: pedido });
    if (de && !nome) { nome = de; nomeSalvo = de; }
    salvar({ etapa: "cartao", pedido, codigo: codigo ?? null, ...(de ? { de } : {}), pix: null });
  }

  function preaquecer() {
    if (promessa || e.etapa !== "oferta") return;
    if (e.pix && Date.parse(e.pix.expiresAt) - Date.now() > 60_000) { promessa = Promise.resolve(e.pix); return; }
    tPre = Date.now();
    const conta = ctx.contaPronta ? Promise.race([ctx.contaPronta(), new Promise<void>((ok) => { window.setTimeout(ok, 8000); })]) : Promise.resolve();
    const p = conta.then(() => { tPre = Date.now(); return ctx.api.gerar(compra); })
      .catch((x): GeradoPresente => ({ erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(x).slice(0, 120) }));
    promessa = p;
    void p.then((r) => {
      const ok = "qrCode" in r;
      ev("landing_presente_pix_pronto", { ms: Date.now() - tPre, ok, ...(ok ? {} : { motivo: "presentePago" in r ? "ja_pago" : r.onde }) });
      if ("qrCode" in r) {
        if (!e.pix || e.pix.orderId !== r.orderId) { e = { ...e, pix: { orderId: r.orderId, qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64, expiresAt: r.expiresAt, donoIgual: r.donoIgual }, copiado: false }; gravarEstadoPresenteLp(e); }
      } else if ("presentePago" in r) {
        // perdeu a aba depois de pagar e voltou na oferta: o cartão dela, nunca um 2º presente
        if (e.etapa === "oferta" && !gerando) pagoCom(r.pedido, r.codigo, r.de);
      } else if (r.onde === "sem_acesso") {
        if (e.etapa === "oferta" && !gerando) semAcesso(r.onde);
      } else { promessa = null; } // falhou: o toque em "Quero" tenta de novo
    });
  }

  async function quero() {
    if (gerando) return;
    ev("landing_presente_quero");
    erro = null;
    if (!promessa) preaquecer();
    const p = promessa!;
    const copia = ctx.copiarNoToque(p.then((r) => ("qrCode" in r ? r.qrCode : Promise.reject(new Error("sem pix")))));
    gerando = true; render();
    const r = await p;
    gerando = false;
    if ("presentePago" in r) { void copia.catch(() => null); pagoCom(r.pedido, r.codigo, r.de); return; }
    if ("erro" in r) {
      void copia.catch(() => null);
      if (r.onde === "sem_acesso") { semAcesso(r.onde); return; }
      erro = r.erro; promessa = null;
      ev("landing_presente_erro", { onde: "pix_create", msg: r.onde });
      render(); return;
    }
    const c = await copia;
    copiado = c.ok;
    ev("landing_presente_copiado", { ok: c.ok, via: c.via, auto: true });
    qrDesde = Date.now();
    salvar({ etapa: "qr", pix: { orderId: r.orderId, qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64, expiresAt: r.expiresAt, donoIgual: r.donoIgual }, copiado: c.ok });
    conferirEmLoop();
  }

  async function conferirUmaVez(): Promise<boolean> {
    if (e.etapa !== "qr" || !e.pix || conferindo || ctx.api.simulado) return false;
    conferindo = true;
    const pix = e.pix;
    try { const r = await ctx.api.conferir(pix); if (r.pago) { pagoCom(pix.orderId, r.codigo); return true; } } catch { /* tenta de novo */ } finally { conferindo = false; }
    return false;
  }
  function conferirEmLoop() {
    if (loop) { window.clearTimeout(loop); loop = null; }
    if (ctx.api.simulado || e.etapa !== "qr" || fora()) return;
    if (!qrDesde) qrDesde = Date.now();
    const proximo = () => {
      const passou = Date.now() - qrDesde;
      if (passou > LACO_PRESENTE_LP.paraMs || document.visibilityState === "hidden") return;
      loop = window.setTimeout(passo, passou < LACO_PRESENTE_LP.viraLentoMs ? LACO_PRESENTE_LP.rapidoMs : LACO_PRESENTE_LP.lentoMs);
    };
    const passo = async () => {
      loop = null;
      if (e.etapa !== "qr" || document.visibilityState === "hidden" || Date.now() - qrDesde > LACO_PRESENTE_LP.paraMs) return;
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
    ev("landing_presente_ja_paguei");
    if (ctx.api.simulado) { if (e.pix) pagoCom(e.pix.orderId, null); return; }
    if (!(await conferirUmaVez())) {
      aviso = fora()
        ? "Quando o pagamento cair, o link do presente vai pro seu e-mail."
        : "Ainda não chegou. Confere no app do banco: quando cair, esta tela muda sozinha.";
      render();
    }
  }

  /* ───────── o cartão: o código e o nome ───────── */
  function buscarCodigo() {
    if (e.etapa !== "cartao" || e.codigo || !e.pedido || buscando || semCodigo) return;
    buscando = true;
    const pedido = e.pedido;
    let tentativa = 0;
    const vez = async () => {
      const m = await ctx.api.buscar(pedido).catch(() => null);
      if (e.etapa !== "cartao" || e.pedido !== pedido) { buscando = false; return; }
      if (m) {
        buscando = false;
        ev("landing_presente_codigo", { ok: true, tentativas: tentativa + 1 });
        if (m.de && !nome) { nome = m.de; nomeSalvo = m.de; }
        salvar({ codigo: m.codigo, ...(m.de ? { de: m.de } : {}) });
        return;
      }
      if (++tentativa < BUSCA_CODIGO_LP.tentativas) { window.setTimeout(() => { void vez(); }, BUSCA_CODIGO_LP.cadaMs); return; }
      buscando = false; semCodigo = true;
      ev("landing_presente_codigo", { ok: false, tentativas: tentativa });
      render();
    };
    void vez();
  }
  const salvarNome = () => {
    if (tNome) { window.clearTimeout(tNome); tNome = null; }
    const limpo = nome.trim();
    if (!e.pedido || limpo === nomeSalvo) return;
    nomeSalvo = limpo;
    e = { ...e, de: limpo || null };
    gravarEstadoPresenteLp(e);
    void ctx.api.gravarNome(e.pedido, limpo).catch(() => false);
  };
  /** só o que muda com o nome (sem repintar o campo: o teclado não fecha) */
  function atualizarCartao(): void {
    const quem = nome.trim();
    const de = pagina?.querySelector<HTMLElement>("[data-testid='presente-cartao-de']");
    if (de) de.innerHTML = `${quem ? `<b>${esc(quem)}</b> te deu` : "Você ganhou"} o CORE pra sempre 💛`;
    const zap = pagina?.querySelector<HTMLAnchorElement>("#pr-zap");
    if (zap && e.codigo) zap.href = urlWhatsApp(mensagemDoPresente(e.codigo, quem || null));
  }

  /* ───────── a página própria (o mesmo desenho e o mesmo Voltar do 2027) ───────── */
  let pagina: HTMLElement | null = null;
  const MARCA = "presentePagina";
  const marcaNoHist = (): boolean => { try { const h = history.state as Record<string, unknown> | null; return !!h && typeof h === "object" && h[MARCA] === compra; } catch { return false; } };
  let ignorarPop = false;
  let restauracaoAntes: ScrollRestoration | null = null;
  let empilharNoLoad: (() => void) | null = null;
  const pousarNaConta = () => {
    const ir = () => { try { ctx.card.scrollIntoView({ block: "start", behavior: "auto" }); } catch { /* sem rolagem (teste) */ } };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(ir); else ir();
    if (restauracaoAntes) { try { history.scrollRestoration = restauracaoAntes; } catch { /* noop */ } restauracaoAntes = null; }
  };
  let inertes: Element[] = [];
  const teclaPagina = (k: KeyboardEvent) => {
    if (k.key !== "Escape" || !pagina || e.etapa !== "oferta") return;
    ev("landing_presente_nao", { de: "esc" });
    salvar({ etapa: "fim" });
  };
  const fecharPagina = () => {
    if (!pagina) return;
    if (e.etapa === "fim") salvarNome();
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
    if (e.etapa === "cartao") ev("landing_presente_continuar", { de: "voltar" });
    else ev("landing_presente_nao", { de: "voltar", etapa: e.etapa });
    salvar({ etapa: "fim" });
  };
  window.addEventListener("popstate", aoPop);
  function abrirPagina(): { miolo: HTMLElement; barra: HTMLElement } {
    if (!pagina || !pagina.isConnected) {
      pagina = document.createElement("div");
      pagina.id = "pr-pag";
      pagina.className = "prp";
      pagina.dataset.testid = "presente-pagina";
      pagina.setAttribute("role", "dialog");
      pagina.setAttribute("aria-modal", "true");
      pagina.setAttribute("aria-label", TITULO_PRESENTE_LP);
      pagina.innerHTML = `<div class="prp-faixa" data-testid="presente-faixa"></div><div class="prp-rolo"><div class="prp-alvo"></div></div><div class="prp-barra" hidden><div></div></div>`;
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
          delete h.lpDemoCheia;
          history.pushState({ ...h, [MARCA]: compra }, "");
        } catch { /* sem histórico: fecha só pelos botões */ }
      };
      if (document.readyState === "complete") empilhar();
      else { empilharNoLoad = empilhar; window.addEventListener("load", empilhar, { once: true }); }
    }
    pagina.dataset.etapa = e.etapa;
    pintarFaixa();
    return { miolo: pagina.querySelector<HTMLElement>(".prp-alvo")!, barra: pagina.querySelector<HTMLElement>(".prp-barra")! };
  }
  function pintarFaixa(): void {
    const f = pagina?.querySelector<HTMLElement>(".prp-faixa");
    if (!f) return;
    if (e.etapa === "cartao") { f.hidden = true; return; }
    f.hidden = false;
    if (e.etapa === "qr") {
      const v = ctx.valorPago?.() ?? null;
      f.dataset.tipo = "neutra";
      pintar(f, `<span data-testid="presente-ja-pago">Seu CORE${v ? ` (${reais(v)})` : ""} está pago · este Pix é só do presente</span>`);
      return;
    }
    delete f.dataset.tipo;
    pintar(f, `${ICO_CHECK}<span><b>Pagamento confirmado</b> · ${esc(ctx.faixaConfirmada?.() ?? "o CORE é seu pra sempre")}</span>`);
  }
  const barraVazia = (barra: HTMLElement) => { barra.hidden = true; pintar(barra.firstElementChild as HTMLElement, ""); };

  function render(): boolean {
    if (relogio) { window.clearInterval(relogio); relogio = null; }
    if (e.etapa === "fim") { fecharPagina(); ctx.card.removeAttribute("data-u27"); return false; }
    ctx.card.dataset.fase = "conta"; // o CSS esconde a oferta do vitalício (qualquer fase ≠ "oferta")
    ctx.card.setAttribute("data-u27", ""); // a faixa "OFERTA ESPECIAL · HOJE" do cartão do vitalício não fica por baixo
    pintar(ctx.caixa, '<div class="prp-por-baixo" data-testid="presente-na-pagina"></div>');
    const { miolo: c, barra } = abrirPagina();

    if (e.etapa === "oferta") {
      if (!vistaOferta) { vistaOferta = true; ev("landing_presente_view", { pagina: true }); }
      preaquecer();
      if (pintar(c, `
        <div class="prp-miolo" data-testid="presente-oferta">
          <div class="prp-cena">${ilustra(120, "o")}</div>
          <h1 tabindex="-1">Leve alguém <em>junto</em></h1>
          <p class="prp-sub">${SUB_PRESENTE_LP}</p>
          <ol class="prp-passos" data-testid="presente-passos">${PASSOS_PRESENTE_LP.map((t, i) => `<li><b>${i + 1}</b><span>${t}</span></li>`).join("")}</ol>
          <p class="prp-nota" data-testid="presente-nota-oferta">${NOTA_PRESENTE_LP}</p>
        </div>`)) {
        const h1 = c.querySelector<HTMLElement>("h1");
        try { h1?.focus({ preventScroll: true }); } catch { /* noop */ }
      }
      barra.hidden = false;
      if (pintar(barra.firstElementChild as HTMLElement, `<div data-testid="presente-barra"><div class="prp-preco"><b data-testid="presente-preco">${reais(VALOR_PRESENTE_LP)}</b><span>${PRECO_TXT_PRESENTE_LP}</span></div>
        ${gerando
          ? '<button type="button" class="lp-cta" id="pr-quero" disabled><i class="lp-gira"></i>Gerando o Pix…</button>'
          : '<button type="button" class="lp-cta" id="pr-quero" data-testid="presente-quero">Quero · copiar o Pix</button>'}
        ${erro ? `<p class="lp-erro" role="alert">${esc(erro)}</p>` : ""}
        <button type="button" class="prp-nao" id="pr-nao" data-testid="presente-agora-nao">Agora não · ver minha conta</button></div>`)) {
        barra.querySelector<HTMLButtonElement>("#pr-quero")!.addEventListener("click", () => { void quero(); });
        barra.querySelector<HTMLButtonElement>("#pr-nao")!.addEventListener("click", () => { ev("landing_presente_nao", { de: "oferta" }); salvar({ etapa: "fim" }); });
      }
      return true;
    }

    if (e.etapa === "qr" && e.pix) {
      const p = e.pix;
      barraVazia(barra);
      if (e.copiado && copiado === null) copiado = true;
      const resta = () => Date.parse(p.expiresAt) - Date.now();
      const comEmail = !!ctx.email();
      if (pintar(c, `
      <div class="prp-qrtela" data-testid="presente-qr">
        <div class="prp-valor"><b>${reais(VALOR_PRESENTE_LP)}</b><span>Presente · CORE pra sempre</span></div>
        <div class="prp-copiado${copiado ? "" : " falta"}" data-testid="presente-copiado">${copiado ? ICO_CHECK : ICO_COPIAR}<span>${copiado
          ? "<b>Código copiado.</b>Cole no app do banco, em Pix Copia e Cola."
          : "<b>Copie o código</b>e cole no app do banco, em Pix Copia e Cola."}</span></div>
        <div class="prp-qr"><div class="lp-qr" id="pr-qr-img"></div><div class="prp-qr-lado"><div class="lp-codigo" data-testid="presente-codigo-pix">${esc(p.qrCode)}</div><button type="button" class="lp-copiar${copiado ? "" : " cheio"}" id="pr-copiar">${ICO_COPIAR}<span>${copiado ? "Copiar de novo" : "Copiar código"}</span></button></div></div>
        <div class="prp-volte" data-testid="presente-volte"><i class="lp-ponto"></i><span>${fora()
          ? "<b>Pagou?</b>Quando o pagamento cair, o link do presente vai pro seu e-mail."
          : "<b>Pagou? Volte aqui.</b>Esta tela confirma sozinha e mostra o link pra mandar."}<span class="prp-vale" id="pr-vale">${validadeU2027(resta())}${comEmail && !fora() ? " O link também vai pro seu e-mail." : ""}</span></span></div>
        ${aviso ? `<p class="lp-aviso" role="status">${esc(aviso)}</p>` : ""}
        <div class="lp-links"><button type="button" class="lp-link" id="pr-ja-paguei" data-testid="presente-ja-paguei">Já paguei</button><button type="button" class="lp-link" id="pr-sair">${fora() ? "Continuar" : "Agora não"}</button></div>
      </div>`)) {
        void ctx.desenharQr(c.querySelector<HTMLElement>("#pr-qr-img")!, p);
        c.querySelector<HTMLButtonElement>("#pr-copiar")!.addEventListener("click", async () => {
          const ok = await ctx.copiarTexto(p.qrCode);
          ev("landing_presente_copiado", { ok, via: "botao", auto: false });
          if (ok && !copiado) { copiado = true; e = { ...e, copiado: true }; gravarEstadoPresenteLp(e); render(); return; }
          const rot = c.querySelector<HTMLElement>("#pr-copiar span");
          if (ok && rot) { rot.textContent = "Copiado ✓"; window.setTimeout(() => { if (rot.isConnected) rot.textContent = "Copiar de novo"; }, 1500); }
        });
        c.querySelector<HTMLButtonElement>("#pr-ja-paguei")!.addEventListener("click", () => { void jaPaguei(); });
        c.querySelector<HTMLButtonElement>("#pr-sair")!.addEventListener("click", () => { ev("landing_presente_nao", { de: "qr" }); salvar({ etapa: "fim" }); });
      }
      relogio = window.setInterval(() => {
        const el = document.getElementById("pr-vale");
        const r = resta();
        if (el && r <= 0) el.textContent = validadeU2027(r);
        if (r <= 0) { window.clearInterval(relogio!); relogio = null; promessa = null; salvar({ etapa: "oferta", pix: null }); }
      }, 30_000);
      if (!loop) conferirEmLoop();
      return true;
    }

    if (e.etapa === "cartao") {
      buscarCodigo();
      const codigo = e.codigo ?? null;
      const quem = nome.trim();
      const comEmail = !!ctx.email();
      const linkTxt = codigo ? `coreaplicativo.com.br/presente/<b>${esc(codigo)}</b>` : semCodigo ? "O link também chega no seu e-mail" : "Preparando o seu link…";
      const htmlCartao = `
      <div class="pv prp-cartao" data-testid="presente-cartao">
        <div class="pv-topo"><span class="pv-marca"><i></i>CORE</span><span class="pv-ok">${ICO_CHECK.replace("<svg ", '<svg width="14" height="14" ')}Presente pago · ${reais(VALOR_PRESENTE_LP)}</span></div>
        <h1 class="pv-titulo" tabindex="-1">Agora é só <em>mandar</em> 💌</h1>
        <p class="pv-sub">O link vale pra 1 pessoa: abre, cria a conta e pronto</p>
        <div class="pv-cartao">
          <span class="pv-fita"></span>
          <div class="pv-cartao-topo"><span class="pv-marca"><i></i>CORE</span><span class="pv-selo">PRA SEMPRE</span></div>
          <div class="pv-cartao-meio">${ilustra(78, "c")}<p class="pv-cartao-de" data-testid="presente-cartao-de">${quem ? `<b>${esc(quem)}</b> te deu` : "Você ganhou"} o CORE pra sempre 💛</p></div>
          <div class="pv-picote"></div>
          <div class="pv-cartao-link" data-testid="presente-link"${copiaFalhou ? ' style="user-select:all;-webkit-user-select:all"' : ""}>${linkTxt}</div>
        </div>
        ${copiaFalhou ? '<p class="pv-miuda" role="status" data-testid="presente-copia-falhou">Não deu pra copiar sozinho. Toque e segure o link do cartão pra copiar.</p>' : ""}
        ${comEmail && codigo ? '<p class="pv-miuda" data-testid="presente-nota">O link também vai pro seu e-mail.</p>' : ""}
        <div class="pv-campo">
          <label for="pr-nome">Seu nome no cartão</label>
          <input id="pr-nome" placeholder="Como você quer assinar" autocomplete="given-name" data-testid="presente-nome" maxlength="40">
        </div>
      </div>`;
      // o código chegando (ou "Link copiado") repinta o cartão: quem está digitando o nome não perde o teclado
      const digitando = document.activeElement instanceof HTMLInputElement && document.activeElement.id === "pr-nome";
      if (pintar(c, htmlCartao)) {
        const campo = c.querySelector<HTMLInputElement>("#pr-nome")!;
        campo.value = nome;
        if (digitando) { try { campo.focus({ preventScroll: true }); campo.setSelectionRange(nome.length, nome.length); } catch { /* noop */ } }
        campo.addEventListener("input", () => {
          const v = nomeLimpo(campo.value);
          if (v !== campo.value) campo.value = v;
          nome = v;
          atualizarCartao();
          if (tNome) window.clearTimeout(tNome);
          tNome = window.setTimeout(salvarNome, 900);
        });
        campo.addEventListener("blur", salvarNome);
      }
      barra.hidden = false;
      const msg = codigo ? mensagemDoPresente(codigo, quem || null) : "";
      if (pintar(barra.firstElementChild as HTMLElement, `<div class="pv pv-rodape-lp" data-testid="presente-barra-cartao">
        <a class="pv-cta" id="pr-zap" data-zap="" ${codigo ? `href="${esc(urlWhatsApp(msg))}"` : ""} target="_blank" rel="noopener noreferrer" aria-disabled="${codigo ? "false" : "true"}" data-testid="presente-whatsapp" style="background:#1faa59;opacity:${codigo ? 1 : 0.5}">${ICO_ZAP}Enviar no WhatsApp</a>
        <button type="button" class="pv-sec"${linkCopiado ? ' data-ok=""' : ""}${codigo ? "" : " disabled"} id="pr-copiar-link" data-testid="presente-copiar">${linkCopiado ? `${ICO_CHECK.replace("<svg ", '<svg width="18" height="18" ')}<span>Link copiado</span>` : `${ICO_COPIAR.replace("<svg ", '<svg width="18" height="18" ')}<span>Copiar link</span>`}</button>
        <button type="button" class="pv-nao" id="pr-continuar" data-testid="presente-continuar">Pronto · ver minha conta</button>
      </div>`)) {
        const zap = barra.querySelector<HTMLAnchorElement>("#pr-zap")!;
        zap.addEventListener("click", (k) => {
          if (!e.codigo) { k.preventDefault(); return; }
          zap.href = urlWhatsApp(mensagemDoPresente(e.codigo, nome.trim() || null)); // o nome digitado agora (sem repintar)
          salvarNome();
          ev("landing_presente_whatsapp", { com_nome: !!nome.trim() });
        });
        barra.querySelector<HTMLButtonElement>("#pr-copiar-link")!.addEventListener("click", async () => {
          if (!e.codigo) return;
          salvarNome();
          const ok = await ctx.copiarTexto(linkDoPresente(e.codigo));
          linkCopiado = ok; copiaFalhou = !ok;
          ev("landing_presente_link_copiado", { ok });
          render();
        });
        barra.querySelector<HTMLButtonElement>("#pr-continuar")!.addEventListener("click", () => { salvarNome(); ev("landing_presente_continuar", { de: "cartao", enviou: !!e.codigo }); salvar({ etapa: "fim" }); });
      }
      return true;
    }
    // etapa qr sem Pix (não deveria): volta pra oferta
    e = { ...e, etapa: "oferta", pix: null };
    return render();
  }

  if (e.etapa === "qr") conferirEmLoop();

  return {
    ativo: () => e.etapa !== "fim",
    render,
    preaquecer,
    voltaDoEmail: () => { /* o presente não tem link no e-mail de compra (o do dia 3 é a /presente/dar) */ },
    retomar: () => { /* sem retomada pelo cookie sem a compra (o cookie do presente vai junto da compra) */ },
    simularPago: () => { if (e.etapa === "qr" && e.pix) pagoCom(e.pix.orderId, null); },
    etapa: () => (e.etapa === "cartao" ? "pronto" : e.etapa),
    parar: () => { parar(); fecharPagina(); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("pageshow", aoVoltar); window.removeEventListener("popstate", aoPop); },
  };
}

