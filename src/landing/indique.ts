/**
 * INDIQUE E GANHE no pós-pago da /oferta (23/11; tela cheia 17/11) — chave INDIQUE_OFERTA no landing.html ("off" no código).
 *
 * No lugar do presente de R$ 24,90. Dono 17/11: "tela cheia msm design bonito estilo bitepal". Duas caras com o mesmo HTML
 * (src/lib/indique-estilo.ts: "bitepal" recomendada, "site" = a direção B de 16/11 em tela cheia).
 *
 * REGRA: a pessoa vê PRIMEIRO como acessar o app (o "Já tenho conta? Entrar" da tela de pago). Por isso nada abre por cima do pago
 * de cara. Dois momentos:
 *   A  (sempre) um CARTÃO no fim da tela de pago — "Indique 2 amigas e seu CORE sai de graça · Quero meu link" → tela cheia;
 *   B  (recomendado) a tela cheia abre SOZINHA quando ela VOLTA pra aba depois de tocar na App Store / Google Play / guia (1× por
 *      compra) — já passou pelo acesso. Na tela cheia, "Ainda não entrou no app? Ver como entrar" fecha e rola até o acesso.
 * Tela cheia: convite (cena + "Seu CORE sai de graça" + R$ 67,90 contando + "Quero meu link") → link pronto (Copiar, WhatsApp, story,
 * "Abrir meu painel"). Fechou: o cartão fica ("Ver meu link"), e o link fica na aba (sessionStorage) e no e-mail (INDIQUE_EMAIL).
 *
 * O link nasce SOB DEMANDA (função afiliados, action indique_link) com a prova da compra da aba ({ ref, pi }), sem senha.
 * Também aqui: a captura do ?ref= da /oferta (último clique, 30 dias), que vai pro pedido do stripe-criar.
 */
import type { EstiloIndique } from "@/lib/indique-estilo";
import { CAMINHO_NO_APP, COMISSAO_POR_AMIGA_CENTS, ENDERECO_RECUPERAR, FRASE_CAMINHO, PRECO_OFERTA_CENTS } from "../../supabase/functions/_shared/indique";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** o valor por amiga: a MESMA constante do servidor (preço da tabela de ofertas × 50%) — texto e Pix nunca discordam */
export const COMISSAO_CENTS = COMISSAO_POR_AMIGA_CENTS;
const PRECO_CENTS = PRECO_OFERTA_CENTS;
const reais = (c: number) => `R$\u00a0${(c / 100).toFixed(2).replace(".", ",")}`; // espaço que não quebra: "R$" nunca fica sozinho na linha

/* ───────── atribuição: ?ref= → memória + localStorage + cookie (o Instagram zera o storage; a memória e a URL seguram) ───────── */
const CHAVE_IND = "landing-indicador";
const COOKIE_IND = "landing_indicador";
const VALIDADE_IND_MS = 30 * 86400e3;
export const normalizarIndicador = (s: unknown): string | null => {
  const c = String(s ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return c.length >= 3 && c.length <= 64 ? c : null;
};
type Armazem = { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
type Biscoito = { ler(nome: string): string | null; gravar(nome: string, valor: string, maxAgeS: number): void };
let indicadorNaMemoria: string | null = null;
/**
 * Chegou por ANÚNCIO pago (críticas 17/11)? fbclid/gclid/ttclid ou utm_source de rede de anúncio. Último clique = o anúncio: o
 * ?ref= guardado de uma amiga é apagado (o CORE não paga o anúncio E a comissão; e colar o próprio link nos comentários dos
 * anúncios não rende nada a quem compra depois pelo anúncio).
 */
export function chegouPorAnuncio(busca: string): boolean {
  try {
    const q = new URLSearchParams(busca);
    if (["fbclid", "gclid", "ttclid", "gbraid", "wbraid"].some((k) => !!q.get(k))) return true;
    return /^(fb|facebook|ig|instagram|meta|an|msg|google|gads|tiktok|tt)(\b|_|-|\.|$)/i.test(q.get("utm_source") ?? "");
  } catch { return false; }
}
/** Último clique: um ?ref= novo SEMPRE substitui o guardado; um clique de ANÚNCIO apaga o guardado. Sem nenhum dos dois, vale 30 dias. */
export function capturarIndicador(busca: string, storage: Armazem, cookie: Biscoito, agora = Date.now()): string | null {
  let daUrl: string | null = null;
  try { daUrl = normalizarIndicador(new URLSearchParams(busca).get("ref")); } catch { /* sem URL */ }
  if (!daUrl && chegouPorAnuncio(busca)) {
    indicadorNaMemoria = null;
    try { storage?.setItem(CHAVE_IND, "null"); } catch { /* storage opcional */ }
    try { cookie.gravar(COOKIE_IND, "", 0); } catch { /* idem */ }
    return null;
  }
  if (daUrl) {
    indicadorNaMemoria = daUrl;
    const v = JSON.stringify({ c: daUrl, em: agora });
    try { storage?.setItem(CHAVE_IND, v); } catch { /* storage opcional */ }
    try { cookie.gravar(COOKIE_IND, `${daUrl}.${agora}`, Math.round(VALIDADE_IND_MS / 1000)); } catch { /* idem */ }
    return daUrl;
  }
  if (indicadorNaMemoria) return indicadorNaMemoria;
  try {
    const s = JSON.parse(storage?.getItem(CHAVE_IND) || "null") as { c?: string; em?: number } | null;
    const c = normalizarIndicador(s?.c);
    if (c && typeof s?.em === "number" && agora - s.em < VALIDADE_IND_MS) return (indicadorNaMemoria = c);
  } catch { /* JSON inválido */ }
  try {
    const [c0, em0] = String(cookie.ler(COOKIE_IND) ?? "").split(".");
    const c = normalizarIndicador(c0);
    if (c && Number(em0) > 0 && agora - Number(em0) < VALIDADE_IND_MS) return (indicadorNaMemoria = c);
  } catch { /* sem cookie */ }
  return null;
}
export const _zerarIndicador = () => { indicadorNaMemoria = null; };

/* ───────── a tela cheia ───────── */
export type CompraIndique = { ref: string; pi: string };
export type LinkIndique = { codigo: string; link: string; painel: string; emailEnviado?: boolean };
export type ApiIndique = { pedirLink: (c: CompraIndique) => Promise<LinkIndique | { erro: string }> };
export type DepsIndique = {
  api: ApiIndique;
  evento: (nome: string, dados?: Record<string, unknown>) => void;
  copiar: (texto: string) => Promise<boolean>;
  /** a cara da tela cheia (src/lib/indique-estilo.ts); padrão "bitepal" */
  estilo?: EstiloIndique;
};

export const mensagemWhatsapp = (link: string): string =>
  `Tô usando o CORE pra organizar minha vida (finanças, rotina, treino, tudo num app só). Comprei o vitalício e tá valendo muito. Se quiser, é por aqui: ${link}`;
export const linkWhatsapp = (link: string): string => `https://wa.me/?text=${encodeURIComponent(mensagemWhatsapp(link))}`;

/*
 * As 2 caras dividem o esqueleto (.igt …) e mudam só a pele: [data-estilo="bitepal"] e [data-estilo="site"].
 * Movimento: a tela sobe (.32s), a cena entra em mola, as moedas caem, o número-herói conta de R$ 0 a R$ 67,90 (~900 ms) e o confete
 * cai 1×. Com "reduzir movimento" nada se mexe (o número já vem no valor final).
 */
const CSS = `
.igt{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;overflow:hidden auto;overscroll-behavior:contain;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased;animation:igt-in .32s cubic-bezier(.2,.8,.2,1)}
@keyframes igt-in{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
.igt-in{position:relative;flex:1;display:flex;flex-direction:column;width:100%;max-width:480px;margin:0 auto;padding:max(14px,env(safe-area-inset-top)) 22px max(18px,env(safe-area-inset-bottom))}
.igt-topo{display:flex;justify-content:space-between;align-items:center;min-height:40px}
.igt-marca{font:900 15px Inter,sans-serif;letter-spacing:.14em}
.igt-entrar{border:1.5px solid currentColor;background:rgba(255,255,255,.7);border-radius:999px;font:750 13px Inter,sans-serif;padding:0 14px;min-height:40px;cursor:pointer}
.igt-regra{font-size:12.5px;line-height:1.4;margin:10px 0 0;font-weight:600}
.igt-x{border:0;background:none;font:650 14px Inter,sans-serif;padding:10px 4px 10px 14px;min-height:44px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.igt-cena{position:relative;height:250px;margin:6px -22px 0;flex:none}
.igt-kick{font:800 12px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;margin:6px 0 0}
.igt h1{font-weight:900;letter-spacing:-.045em;line-height:.98;margin:8px 0 0}
.igt-heroi{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:14px 0 0}
.igt-heroi b{font-weight:900;letter-spacing:-.04em;font-variant-numeric:tabular-nums;line-height:1}
.igt-heroi span{font-weight:750}
.igt p.s{font-size:16px;line-height:1.45;margin:12px 0 0}
.igt p.s b{font-weight:750}
.igt-pe{margin-top:auto;padding-top:20px}
.igt-cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:58px;border-radius:999px;border:0;font:800 17px Inter,sans-serif;letter-spacing:-.01em;cursor:pointer;text-decoration:none}
.igt-cta[aria-busy="true"]{opacity:.8}
.igt-cta svg{width:21px;height:21px;flex:none}
.igt-cta.zap{background:#1faa59;color:#fff;box-shadow:0 1px 0 rgba(0,0,0,.08),0 12px 26px -12px rgba(31,170,89,.8)}
.igt-cta.sec{background:transparent;margin-top:10px;min-height:52px;font-size:15.5px}
.igt-duas{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.igt-duas .igt-cta{min-height:52px;font-size:15px;margin:0;padding:0 10px;text-align:center}
.igt-nao{display:block;margin:6px auto 0;border:0;background:none;font:650 15px Inter,sans-serif;min-height:44px;padding:10px 18px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.igt-acesso{display:block;margin:2px auto 0;border:0;background:none;font:600 13px Inter,sans-serif;min-height:40px;padding:8px 12px;cursor:pointer}
.igt-mini{display:flex;justify-content:center;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;margin:12px 0 0}
.igt-erro{text-align:center;font-size:14px;color:#b42318;margin:10px 0 0}
.igt-link{display:flex;gap:8px;margin:18px 0 0}
.igt-link code{flex:1;min-width:0;border-radius:16px;padding:16px 14px;font:650 14px Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.igt-cod{font-size:12.5px;margin:6px 0 0 4px;opacity:.85}
.igt-link button{border:0;border-radius:16px;padding:0 18px;font:800 14.5px Inter,sans-serif;cursor:pointer;min-width:96px}
.igt-nota{font-size:13px;line-height:1.45;text-align:center;margin:12px 0 0}
.igt-caminho{margin:14px 0 0;padding:12px 12px 11px;border-radius:16px;background:rgba(255,255,255,.72);text-align:center}
.igt-caminho p{margin:0;font:650 12.5px/1.35 Inter,sans-serif;color:#4a4252}
.igt-trilha{display:flex;align-items:center;justify-content:center;gap:7px;margin:8px 0 0;flex-wrap:wrap}
.igt-passo{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:0 11px 0 5px;border-radius:999px;background:#fff;border:1px solid rgba(23,17,28,.12);font:750 12.5px Inter,sans-serif;color:#17111C;white-space:nowrap}
.igt-passo i{display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:rgba(23,17,28,.1);font:800 8.5px Inter,sans-serif;font-style:normal}
.igt-passo.dest{border-color:#E0337F;box-shadow:0 0 0 3px rgba(224,51,127,.14)}
.igt-passo.dest i{background:#fde6f1}
.igt-seta{font:800 14px Inter,sans-serif;color:#9a93a0}
.igt-caminho a{color:#C42A73;text-decoration:underline;text-underline-offset:2px}
.igt-caminho p.igt-comp{margin:8px 0 0;font-size:12px;color:#6b6670}
/* críticas 17/11 (altura do navegador do Instagram, 390x690): com o link pronto, a cena sai — link, Copiar e WhatsApp inteiros na 1ª tela */
.igt[data-etapa="link"] .igt-cena{display:none}
.igt[data-etapa="link"] .igt-kick{margin-top:14px}
.igt[data-etapa="link"][data-estilo] h1{font-size:36px}
.igt[data-etapa="link"] p.s{font-size:15px;margin-top:8px}
.igt[data-etapa="link"] .igt-link{margin-top:14px}
.igt[data-etapa="link"] .igt-pe{margin-top:0;padding-top:14px}
.igt-confete{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}
.igt-in{z-index:1}
.igt-confete i{position:absolute;top:-16px;width:7px;height:12px;border-radius:2px;opacity:0;animation:igt-cai 2.2s ease-in forwards}
@keyframes igt-cai{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:1}85%{opacity:1}100%{opacity:0;transform:translateY(78vh) rotate(260deg)}}
@keyframes igt-mola{0%{opacity:0;transform:var(--t0,translateY(26px) scale(.86))}60%{opacity:1;transform:var(--t1,none) scale(1.04)}100%{opacity:1;transform:var(--t1,none)}}
@keyframes igt-flutua{0%,100%{transform:var(--t1,none) translateY(0)}50%{transform:var(--t1,none) translateY(-6px)}}
.igt-mola{opacity:0;animation:igt-mola .62s cubic-bezier(.2,.8,.2,1) forwards,igt-flutua 3.4s ease-in-out .9s infinite}
@media (prefers-reduced-motion:reduce){.igt,.igt-mola{animation:none!important;opacity:1}.igt-confete{display:none}}

/* ───── pele BITEPAL ───── */
.igt[data-estilo="bitepal"]{background:#F3F2F7;color:#17111C}
.igt[data-estilo="bitepal"]::before{content:"";position:absolute;inset:0 0 auto;height:62%;background:linear-gradient(180deg,#FBC6DF 0%,#F8DDEA 45%,rgba(243,242,247,0) 100%);pointer-events:none}
.igt[data-estilo="bitepal"] .igt-marca{color:#17111C}
.igt[data-estilo="bitepal"] .igt-x,.igt[data-estilo="bitepal"] .igt-nao{color:#3d3545}
.igt[data-estilo="bitepal"] .igt-kick{color:#C42A73}
.igt[data-estilo="bitepal"] h1{font-size:46px}
.igt[data-estilo="bitepal"] h1 em{font-style:normal;color:#E0337F}
.igt[data-estilo="bitepal"] .igt-heroi b{font-size:46px;color:#17111C}
.igt[data-estilo="bitepal"] .igt-heroi span{font-size:20px;color:#3d3545}
.igt[data-estilo="bitepal"] p.s{color:#3d3545}
.igt[data-estilo="bitepal"] p.s b{color:#17111C}
.igt[data-estilo="bitepal"] .igt-cta.pri{background:#17111C;color:#fff;box-shadow:0 1px 0 rgba(0,0,0,.2),0 14px 28px -14px rgba(23,17,28,.75)}
.igt[data-estilo="bitepal"] .igt-cta.sec{border:2px solid #17111C;color:#17111C}
.igt[data-estilo="bitepal"] .igt-mini,.igt[data-estilo="bitepal"] .igt-nota,.igt[data-estilo="bitepal"] .igt-acesso,.igt[data-estilo="bitepal"] .igt-regra{color:#4a4252}
.igt[data-estilo="bitepal"] .igt-entrar{color:#17111C}
.igt[data-estilo="bitepal"] .igt-link code{background:#fff;color:#17111C;box-shadow:0 1px 0 rgba(23,17,28,.06),0 8px 20px -14px rgba(23,17,28,.4)}
.igt[data-estilo="bitepal"] .igt-link button{background:#17111C;color:#fff}
/* a cena: o CORE no celular (inclinado), 2 amigas em sticker, moedas */
.igt-fone{position:absolute;left:50%;top:6px;width:150px;height:235px;margin-left:-75px;border-radius:26px;background:#17111C;padding:6px;box-shadow:0 2px 0 rgba(0,0,0,.12),0 24px 40px -18px rgba(23,17,28,.55);--t0:rotate(-2deg) translateY(30px) scale(.86);--t1:rotate(-6deg)}
.igt-fone img{display:block;width:100%;height:100%;object-fit:contain;object-position:top;border-radius:21px;background:#fff}
.igt-sticker{position:absolute;display:grid;place-items:center;border-radius:50%;background:#fff;border:3.5px solid #17111C;box-shadow:0 4px 0 #17111C;font-size:34px;line-height:1}
.igt-sticker small{position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:#17111C;color:#fff;font:800 10.5px Inter,sans-serif;padding:4px 8px;border-radius:999px;white-space:nowrap}
.igt-a1{left:26px;top:58px;width:74px;height:74px;--t0:translateX(-30px) scale(.7);--t1:rotate(-8deg);animation-delay:.18s,1.1s!important}
.igt-a2{right:24px;top:42px;width:74px;height:74px;--t0:translateX(30px) scale(.7);--t1:rotate(7deg);animation-delay:.28s,1.3s!important}
.igt-moeda{position:absolute;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 34% 30%,#FFE79A,#F5B820 60%,#D9930B);border:3px solid #17111C;box-shadow:0 3px 0 #17111C;font:900 15px Inter,sans-serif;color:#7a4b00}
.igt-m1{left:70px;top:168px;width:48px;height:48px;--t0:translateY(-60px) scale(.6);--t1:rotate(-14deg);animation-delay:.42s,1.5s!important}
.igt-m2{right:74px;top:176px;width:40px;height:40px;--t0:translateY(-70px) scale(.6);--t1:rotate(12deg);animation-delay:.52s,1.7s!important}
.igt-m3{right:42px;top:128px;width:30px;height:30px;font-size:11px;--t0:translateY(-50px) scale(.6);--t1:rotate(-6deg);animation-delay:.6s,1.9s!important}
.igt-selo{position:absolute;left:50%;top:196px;transform:translateX(-50%);background:#E0337F;color:#fff;font:900 13px Inter,sans-serif;padding:7px 12px;border-radius:999px;border:3px solid #17111C;box-shadow:0 3px 0 #17111C;white-space:nowrap;--t0:translateX(-50%) scale(.6);--t1:translateX(-50%) rotate(-3deg);animation-delay:.7s,2s!important}
.igt[data-estilo="bitepal"] .igt-bolas{display:none}

/* ───── pele SITE (a direção B de 16/11, em tela cheia) ───── */
.igt[data-estilo="site"]{background:#fff;color:#262626}
.igt[data-estilo="site"]::before{content:"";position:absolute;inset:0 0 auto;height:58%;background:linear-gradient(180deg,#fde6f1 0%,#fff3f9 50%,#fff 100%);pointer-events:none}
.igt[data-estilo="site"] .igt-marca{color:#262626}
.igt[data-estilo="site"] .igt-x,.igt[data-estilo="site"] .igt-nao{color:#4a4550}
.igt[data-estilo="site"] .igt-kick{color:#d02c7d}
.igt[data-estilo="site"] h1{font-size:36px;text-align:center}
.igt[data-estilo="site"] h1 em{font-style:normal;color:#d02c7d}
.igt[data-estilo="site"] .igt-kick,.igt[data-estilo="site"] p.s{text-align:center}
.igt[data-estilo="site"] .igt-heroi{justify-content:center}
.igt[data-estilo="site"] .igt-heroi b{font-size:52px;color:#262626}
.igt[data-estilo="site"] .igt-heroi span{font-size:18px;color:#4a4550}
.igt[data-estilo="site"] p.s{color:#4a4550}
.igt[data-estilo="site"] p.s b{color:#262626}
.igt[data-estilo="site"] .igt-cta.pri{background:#d02c7d;color:#fff;box-shadow:0 10px 24px -10px rgba(208,44,125,.7)}
.igt[data-estilo="site"] .igt-cta.sec{border:1.5px solid #d9d6dc;color:#262626}
.igt[data-estilo="site"] .igt-mini,.igt[data-estilo="site"] .igt-nota,.igt[data-estilo="site"] .igt-acesso,.igt[data-estilo="site"] .igt-regra{color:#4a4550;text-align:center}
.igt[data-estilo="site"] .igt-entrar{color:#262626}
.igt[data-estilo="site"] .igt-pe{margin-top:28px}
.igt[data-estilo="site"] .igt-link code{background:#f4f2f5;color:#262626}
.igt[data-estilo="site"] .igt-link button{background:#333;color:#fff}
.igt[data-estilo="site"] .igt-cena{height:180px}
.igt[data-estilo="site"] .igt-fone,.igt[data-estilo="site"] .igt-sticker,.igt[data-estilo="site"] .igt-moeda,.igt[data-estilo="site"] .igt-selo{display:none}
.igt-bolas{position:absolute;inset:0;display:flex;justify-content:center;align-items:center;gap:8px}
.igt-bola{width:86px;height:86px;border-radius:50%;display:grid;place-items:center;text-align:center;border:2.5px dashed #d98ab3;background:#fff4f9;color:#9c1a5c;font:850 14px Inter,sans-serif;line-height:1.1;--t0:scale(.6);--t1:none}
.igt-bola small{display:block;font-size:10.5px;font-weight:700;color:#6b6670}
.igt-op{font:850 22px Inter,sans-serif;color:#c9c4cc}
.igt-alvo{width:112px;height:86px;border-radius:16px;background:#333;color:#fff;display:grid;place-items:center;text-align:center;font:850 18px Inter,sans-serif;line-height:1.1;padding:0 6px;--t0:scale(.6);--t1:none}
.igt-alvo small{display:block;font-size:10.5px;font-weight:650;opacity:.8}
.igt-b1{animation-delay:.15s,1.1s!important}.igt-b2{animation-delay:.3s,1.3s!important}.igt-b3{animation-delay:.45s,1.5s!important}
`;
const ICO_ZAP = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z"/></svg>';
/**
 * Onde achar o link depois (críticas da subida 17/11): 1º um ENDEREÇO que funciona sem login em qualquer aparelho (/indique: digita o
 * e-mail e recebe o painel); a trilha "Você → Indique e ganhe" vira a 2ª linha, só pro computador (no app da App Store ela não existe).
 */
const CAMINHO_HTML = `<div class="igt-caminho" data-testid="indique-caminho"><p data-testid="indique-recuperar-frase">Perdeu o link? Entre em <a href="/indique" target="_blank" rel="noopener"><b>${esc(ENDERECO_RECUPERAR)}</b></a> e digite seu e-mail.</p>` +
  `<p class="igt-comp">${esc(FRASE_CAMINHO.replace(`: ${CAMINHO_NO_APP}`, ""))}:</p>` +
  `<div class="igt-trilha" aria-label="${esc(CAMINHO_NO_APP)}"><span class="igt-passo"><i aria-hidden="true"><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6z"/></svg></i>Você</span><span class="igt-seta" aria-hidden="true">→</span>` +
  `<span class="igt-passo dest"><i aria-hidden="true">💗</i>Indique e ganhe</span></div></div>`;
const CORES_CONFETE = ["#E0337F", "#F5B820", "#3BA55C", "#4C6FFF", "#F2711C", "#8B5CF6"];

const CHAVE_LINK = "indique-link";
const guardarLink = (pi: string, l: LinkIndique) => { try { sessionStorage.setItem(CHAVE_LINK, JSON.stringify({ pi, ...l })); } catch { /* heap */ } };
const linkGuardado = (pi: string): LinkIndique | null => {
  try {
    const j = JSON.parse(sessionStorage.getItem(CHAVE_LINK) || "null") as (LinkIndique & { pi?: string }) | null;
    return j && j.pi === pi && typeof j.link === "string" && typeof j.painel === "string" ? { codigo: String(j.codigo), link: j.link, painel: j.painel, emailEnviado: j.emailEnviado === true } : null;
  } catch { return null; }
};

/** a tela cheia abriu sozinha nesta compra? (momento recomendado: na VOLTA da loja — 1× por compra) */
const CHAVE_AUTO = "indique-auto";
const jaAbriuSozinha = (pi: string) => { try { return sessionStorage.getItem(CHAVE_AUTO) === pi; } catch { return autoNoHeap === pi; } };
const marcarAbriuSozinha = (pi: string) => { autoNoHeap = pi; try { sessionStorage.setItem(CHAVE_AUTO, pi); } catch { /* heap */ } };
let autoNoHeap: string | null = null;

let raiz: HTMLElement | null = null;
let contador: number | null = null;
let estado: { compra: CompraIndique; link: LinkIndique | null; pedindo: boolean; erro: string | null; deps: DepsIndique; via: string } | null = null;
let foiNaLoja = false;
let ouvindoVolta = false;

function garantirCss() {
  if (document.getElementById("igt-css")) return;
  const s = document.createElement("style");
  s.id = "igt-css"; s.textContent = CSS;
  document.head.appendChild(s);
}
const reduzMovimento = () => { try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true; } catch { return false; } };

/** a cena das 2 caras (as duas vão no HTML; o CSS mostra uma) */
const cena = (semPreco: boolean) => `<div class="igt-cena" aria-hidden="true">
  <div class="igt-fone igt-mola"><img src="/landing/v3-home.webp" alt="" width="720" height="1070" decoding="async" /></div>
  <div class="igt-sticker igt-a1 igt-mola">👩🏻<small>amiga 1</small></div>
  <div class="igt-sticker igt-a2 igt-mola">👩🏽‍🦱<small>amiga 2</small></div>
  <div class="igt-selo igt-mola">${semPreco ? "sem limite de amigas" : `+ ${reais(COMISSAO_CENTS)} cada`}</div>
  ${semPreco ? "" : `<div class="igt-bolas"><div class="igt-bola igt-mola igt-b1">${reais(COMISSAO_CENTS)}<small>amiga 1</small></div><div class="igt-op">+</div><div class="igt-bola igt-mola igt-b2">${reais(COMISSAO_CENTS)}<small>amiga 2</small></div><div class="igt-op">=</div><div class="igt-alvo igt-mola igt-b3">${reais(PRECO_CENTS)}<small>de volta pra você</small></div></div>`}
</div>`;

function confete(alvo: HTMLElement) {
  if (reduzMovimento()) return;
  const c = document.createElement("div");
  c.className = "igt-confete"; c.setAttribute("aria-hidden", "true");
  // só nas laterais (revisão: confete por cima do texto atrapalhava a leitura)
  c.innerHTML = Array.from({ length: 16 }, (_, i) => `<i style="left:${i % 2 ? 96 + (i % 3) : (i % 3) * 0.8}%;background:${CORES_CONFETE[i % CORES_CONFETE.length]};animation-delay:${0.35 + (i % 7) * 0.06}s;${i % 3 === 0 ? "width:10px;height:7px;" : ""}"></i>`).join("");
  alvo.appendChild(c);
  window.setTimeout(() => c.remove(), 3200);
}

/** o número-herói conta de R$ 0 até R$ 67,90 (~900 ms); com "reduzir movimento", já vem no valor */
function contar(el: HTMLElement | null, alvoCents: number) {
  if (!el) return;
  if (contador !== null) { window.cancelAnimationFrame(contador); contador = null; }
  if (reduzMovimento() || typeof window.requestAnimationFrame !== "function") { el.textContent = reais(alvoCents); return; }
  const t0 = performance.now(), dur = 900;
  const passo = (t: number) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = reais(Math.round(alvoCents * (1 - Math.pow(1 - p, 3))));
    contador = p < 1 ? window.requestAnimationFrame(passo) : null;
  };
  el.textContent = reais(0);
  contador = window.requestAnimationFrame(passo);
}

const estiloDe = (d: DepsIndique): EstiloIndique => d.estilo ?? "c";
function desenhar() {
  if (!raiz || !estado) return;
  const e = estado;
  const semPreco = estiloDe(e.deps) === "c"; // versão C: nada lembra o preço que ela pagou
  const dentro = raiz.querySelector<HTMLElement>(".igt-in")!;
  raiz.setAttribute("data-etapa", e.link ? "link" : "convite");
  const topo = `<div class="igt-topo"><span class="igt-marca">CORE</span><button type="button" class="igt-entrar" data-testid="indique-ver-acesso">Como entrar no app</button></div>`;
  if (!e.link) {
    dentro.innerHTML = `${topo}${cena(semPreco)}
      <p class="igt-kick">Indique e ganhe</p>
${semPreco ? `
      <h1 id="igt-tit">Convide suas <em>amigas</em></h1>
      <div class="igt-heroi"><b data-testid="indique-heroi">${reais(COMISSAO_CENTS)}</b><span>por amiga</span></div>
      <p class="s">Você ganha 50% de cada compra feita pelo seu link, sem limite de amigas. Ela paga o mesmo preço, sem nada a mais.</p>
      <p class="igt-regra">Vale a compra pelo seu link, no site · Pix toda segunda</p>` : `
      <h1 id="igt-tit">Seu CORE sai <em>de graça</em></h1>
      <div class="igt-heroi"><b data-testid="indique-heroi">${reais(PRECO_CENTS)}</b><span>de volta</span></div>
      <p class="s">Indique 2 amigas. Cada uma que comprar pelo seu link = <b>${reais(COMISSAO_CENTS)} no seu Pix</b>. Ela paga o mesmo preço, sem nada a mais.</p>
      <p class="igt-regra">Vale a compra pelo seu link, no site · Pix toda segunda</p>`}
      <div class="igt-pe">
        <button type="button" class="igt-cta pri" data-testid="indique-quero" ${e.pedindo ? 'aria-busy="true" disabled' : ""}>${e.pedindo ? "Gerando seu link…" : e.erro ? "Tentar de novo" : "Quero meu link"}</button>
        ${e.erro ? `<p class="igt-erro" role="alert" data-testid="indique-erro">${esc(e.erro)}</p>` : ""}
        <button type="button" class="igt-nao" data-testid="indique-agora-nao">Agora não</button>
      </div>`;
    dentro.querySelector<HTMLButtonElement>("[data-testid='indique-quero']")!.addEventListener("click", () => void pedir());
    dentro.querySelector<HTMLButtonElement>("[data-testid='indique-agora-nao']")!.addEventListener("click", () => fechar("agora_nao"));
    dentro.querySelector<HTMLButtonElement>("[data-testid='indique-ver-acesso']")!.addEventListener("click", () => fechar("ver_acesso"));
    if (!e.pedindo && !e.erro) contar(dentro.querySelector("[data-testid='indique-heroi']"), semPreco ? COMISSAO_CENTS : PRECO_CENTS);
    return;
  }
  const l = e.link;
  dentro.innerHTML = `${topo}${cena(semPreco)}
    <p class="igt-kick">Seu link está pronto</p>
    <h1 id="igt-tit">Agora é só <em>mandar</em></h1>
    <p class="s">Mande pra amiga que vive dizendo que precisa se organizar. Ela paga o mesmo preço; cada compra = <b>${reais(COMISSAO_CENTS)}</b> pra você${semPreco ? ", sem limite de amigas" : ""}.</p>
    <div class="igt-link"><code data-testid="indique-link">${esc(l.link.replace(/^https:\/\/(www\.)?/, ""))}</code><button type="button" data-testid="indique-copiar">Copiar</button></div>
    <p class="igt-cod">Seu código: <b>${esc(l.codigo)}</b></p>
    <div class="igt-pe">
      <a class="igt-cta zap" data-testid="indique-whatsapp" href="${esc(linkWhatsapp(l.link))}" target="_blank" rel="noopener">${ICO_ZAP}Mandar no WhatsApp</a>
      <div class="igt-duas">
        <button type="button" class="igt-cta sec" data-testid="indique-story">Postar no story</button>
        <a class="igt-cta sec" data-testid="indique-painel" href="${esc(l.painel)}" target="_blank" rel="noopener">Minhas indicações</a>
      </div>
      <p class="igt-nota">Em "Minhas indicações" você acompanha as vendas e cadastra a chave Pix pra receber.${l.emailEnviado ? " Também mandamos esse endereço pro seu e-mail." : ""}</p>
      ${CAMINHO_HTML}
      <button type="button" class="igt-nao" data-testid="indique-fechar">Voltar pra minha compra</button>
    </div>`;
  const bc = dentro.querySelector<HTMLButtonElement>("[data-testid='indique-copiar']")!;
  bc.addEventListener("click", () => {
    void e.deps.copiar(l.link).then((ok) => { bc.textContent = ok ? "Copiado ✓" : "Copie acima"; e.deps.evento("landing_indique_copiou", { ok, pi: e.compra.pi }); });
  });
  dentro.querySelector("[data-testid='indique-whatsapp']")!.addEventListener("click", () => e.deps.evento("landing_indique_whatsapp", { pi: e.compra.pi }));
  dentro.querySelector("[data-testid='indique-painel']")!.addEventListener("click", () => e.deps.evento("landing_indique_painel", { pi: e.compra.pi }));
  dentro.querySelector<HTMLButtonElement>("[data-testid='indique-story']")!.addEventListener("click", () => {
    e.deps.evento("landing_indique_story", { pi: e.compra.pi });
    // críticas 17/11: no navegador do Instagram o compartilhar/baixar não respondia — agora a arte abre na página pra salvar com o dedo
    void import("@/lib/indique-story").then((m) => m.compartilharStory(l.link)).then((r) => e.deps.evento("landing_indique_story_resultado", { r, pi: e.compra.pi })).catch(() => null);
  });
  dentro.querySelector<HTMLButtonElement>("[data-testid='indique-fechar']")!.addEventListener("click", () => fechar("fechar"));
  dentro.querySelector<HTMLButtonElement>("[data-testid='indique-ver-acesso']")!.addEventListener("click", () => fechar("ver_acesso"));
}

async function pedir() {
  const e = estado;
  if (!e || e.pedindo) return;
  e.pedindo = true; e.erro = null; desenhar();
  e.deps.evento("landing_indique_quero", { pi: e.compra.pi, via: e.via });
  const r = await e.deps.api.pedirLink(e.compra).catch(() => ({ erro: "rede" }));
  if (estado !== e) return;
  e.pedindo = false;
  if ("erro" in r) {
    e.erro = r.erro === "estornada" ? "Esta compra foi estornada, então o link não está disponível." : "Não consegui gerar seu link agora. Sua compra está garantida. Tenta de novo em alguns segundos.";
    e.deps.evento("landing_indique_erro", { motivo: r.erro, pi: e.compra.pi });
  } else {
    e.link = r; guardarLink(e.compra.pi, r);
    e.deps.evento("landing_indique_pronto", { pi: e.compra.pi });
    cartaoNoPago();
    if (raiz) confete(raiz);
  }
  desenhar();
}

/** Pular / Agora não / Fechar / "Ver como entrar": a tela de pago de sempre volta (com o acesso no topo); o cartão do fim fica. */
function fechar(via: string) {
  const e = estado;
  if (contador !== null) { window.cancelAnimationFrame(contador); contador = null; }
  raiz?.remove(); raiz = null;
  document.documentElement.style.removeProperty("overflow");
  if (!e) return;
  e.deps.evento("landing_indique_fechou", { via, tem_link: !!e.link, pi: e.compra.pi });
  cartaoNoPago();
  if (via === "ver_acesso") {
    const alvo = document.querySelector<HTMLElement>("[data-testid='oferta-pago'] .oc-ce") ?? document.querySelector<HTMLElement>("[data-testid='oferta-pago']");
    try { alvo?.scrollIntoView({ block: "start", behavior: "smooth" }); } catch { /* jsdom */ }
  }
}

/** O cartão no fim da tela de pago (antes do "Dúvida?"): a entrada manual (e a volta depois do "Agora não"). Não cobre nada. */
function cartaoNoPago(): boolean {
  const e = estado;
  const pago = document.querySelector<HTMLElement>("[data-testid='oferta-pago']");
  if (!e || !pago) return false;
  document.getElementById("igf")?.remove(); // a tela de pago voltou: a faixa da recarga sai
  garantirCss();
  if (!document.getElementById("igc-css")) {
    const s = document.createElement("style"); s.id = "igc-css";
    s.textContent = ".igc{margin:18px 0 0;border:1px solid #ebe7ee;background:#fff;border-radius:16px;padding:14px;display:flex;align-items:center;gap:12px;text-align:left}.igc>div{min-width:0;flex:1}.igc b{display:block;font-size:14.5px;color:#262626}.igc span{display:block;font-size:12.5px;color:#4a4550;margin-top:2px}.igc button{margin-left:auto;flex:none;border:0;border-radius:999px;background:#17111C;color:#fff;font:750 13px Inter,sans-serif;padding:11px 14px;cursor:pointer}";
    document.head.appendChild(s);
  }
  pago.querySelector(".igc")?.remove();
  const c = document.createElement("div");
  c.className = "igc"; c.setAttribute("data-testid", "indique-cartao");
  c.innerHTML = `<div><b>Indique e ganhe ${reais(COMISSAO_CENTS)} por amiga</b><span>${e.link ? `Seu link está guardado aqui${e.link.emailEnviado ? " e no seu e-mail" : ""}.` : (estiloDe(e.deps) === "c" ? "Cada compra pelo seu link, sem limite de amigas." : "Duas amigas = seu CORE de graça.")}</span></div><button type="button" data-testid="indique-abrir">${e.link ? "Ver meu link" : "Quero meu link"}</button>`;
  c.querySelector("button")!.addEventListener("click", () => { e.deps.evento("landing_indique_abriu", { pi: e.compra.pi, ja_tinha_link: !!e.link, via: "cartao" }); montar("cartao"); });
  const contato = pago.querySelector(".oc-contato");
  if (contato) pago.insertBefore(c, contato); else pago.appendChild(c);
  return true;
}

function montar(via: string) {
  if (!estado) return;
  estado.via = via;
  garantirCss();
  raiz?.remove();
  raiz = document.createElement("div");
  raiz.className = "igt"; raiz.id = "igt"; raiz.setAttribute("data-estilo", estiloDe(estado.deps) === "site" ? "site" : "bitepal"); raiz.setAttribute("data-versao", estiloDe(estado.deps));
  raiz.setAttribute("role", "dialog"); raiz.setAttribute("aria-modal", "true"); raiz.setAttribute("aria-labelledby", "igt-tit");
  raiz.setAttribute("data-testid", "indique-tela");
  raiz.innerHTML = `<div class="igt-in"></div>`;
  document.body.appendChild(raiz);
  desenhar();
  estado.deps.evento("landing_indique_tela", { pi: estado.compra.pi, via, estilo: estiloDe(estado.deps), ja_tinha_link: !!estado.link });
}

/**
 * MOMENTO (recomendado, "B"): a tela cheia abre SOZINHA quando a pessoa VOLTA pra aba depois de tocar na App Store / Google Play
 * (ou no guia) — ela já viu e usou o "como entrar". 1× por compra. Quem não sai da página só vê o cartão no fim (entrada manual,
 * momento "A"). Nada abre por cima do pago antes disso.
 */
/** revisão 17/11 (compradora): abrir sozinha na volta da loja atrapalhava entrar no app → DESLIGADO; "true" religa o momento B */
export const ABRE_NA_VOLTA_DA_LOJA = false;
function ouvirVolta() {
  if (ouvindoVolta || !ABRE_NA_VOLTA_DA_LOJA) return;
  ouvindoVolta = true;
  document.addEventListener("click", (ev) => {
    const a = (ev.target as Element | null)?.closest?.("[data-testid='oferta-pago'] a[data-loja], [data-testid='oferta-pago'] a[data-guia]");
    if (a) foiNaLoja = true;
  }, true);
  const voltou = () => {
    const e = estado;
    if (!foiNaLoja || !e || raiz || document.visibilityState === "hidden" || jaAbriuSozinha(e.compra.pi)) return;
    if (!document.querySelector("[data-testid='oferta-pago']")) return;
    marcarAbriuSozinha(e.compra.pi);
    window.setTimeout(() => { if (estado === e && !raiz) montar("volta_da_loja"); }, 350);
  };
  document.addEventListener("visibilitychange", voltou);
  window.addEventListener("focus", voltou);
  window.addEventListener("pageshow", voltou);
}

/** Chamado pelo stripe-checkout no pago (só com INDIQUE_OFERTA ligada): o cartão no fim + o momento da volta. Nada aqui pode quebrar o pago. */
export function abrirIndique(c: CompraIndique, deps: DepsIndique): void {
  if (estado?.compra.pi !== c.pi) estado = { compra: c, link: linkGuardado(c.pi), pedindo: false, erro: null, deps, via: "cartao" };
  else estado.deps = deps;
  guardarCompraIndique(c);
  if (cartaoNoPago()) deps.evento("landing_indique_view", { pi: c.pi, ja_tinha_link: !!estado.link, estilo: estiloDe(deps) });
  ouvirVolta();
}

/*
 * Críticas da subida 17/11 (persona): recarregar a aba depois de pagar (comum no navegador do Instagram, na volta da App Store ou do
 * e-mail) apagava a tela de pago E o link — ela caía de novo na página de venda. Agora a compra fica na aba (3 h, como o presente) e a
 * /oferta abre com uma FAIXA no topo: "Você já comprou" · Como entrar no app (primeiro, o acesso) · Meu link de indicação.
 */
const CHAVE_COMPRA_IND = "oferta-indique-compra";
export const REABRE_INDIQUE_MS = 3 * 3600e3;
function guardarCompraIndique(c: CompraIndique) {
  try {
    const ja = JSON.parse(sessionStorage.getItem(CHAVE_COMPRA_IND) || "null") as { pi?: string; em?: number } | null;
    sessionStorage.setItem(CHAVE_COMPRA_IND, JSON.stringify({ ref: c.ref, pi: c.pi, em: ja?.pi === c.pi && typeof ja.em === "number" ? ja.em : Date.now() }));
  } catch { /* heap */ }
}
export function lerCompraIndique(agora = Date.now()): CompraIndique | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CHAVE_COMPRA_IND) || "null") as (CompraIndique & { em?: number }) | null;
    if (!c || typeof c.pi !== "string" || !/^pi_/.test(c.pi) || typeof c.ref !== "string") return null;
    if (typeof c.em !== "number" || agora - c.em > REABRE_INDIQUE_MS) return null;
    return { ref: c.ref, pi: c.pi };
  } catch { return null; }
}
/** a faixa do topo depois da recarga. `comoEntrar` = o endereço do passo a passo de acesso (o mesmo da tela de pago). */
export function faixaJaComprou(c: CompraIndique, deps: DepsIndique, comoEntrar: string): boolean {
  if (document.querySelector("[data-testid='oferta-pago']") || document.getElementById("igf")) return false;
  if (estado?.compra.pi !== c.pi) estado = { compra: c, link: linkGuardado(c.pi), pedindo: false, erro: null, deps, via: "faixa" };
  garantirCss();
  if (!document.getElementById("igf-css")) {
    const s = document.createElement("style"); s.id = "igf-css";
    s.textContent = ".igf{position:sticky;top:0;z-index:2147481000;background:#17111C;color:#fff;padding:10px 14px max(10px,env(safe-area-inset-top));font:600 13.5px/1.35 Inter,-apple-system,sans-serif}.igf-in{max-width:520px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}.igf b{flex:1 1 100%;font-weight:800}.igf a,.igf button{display:inline-flex;align-items:center;min-height:40px;border-radius:999px;padding:0 14px;font:800 13.5px Inter,sans-serif;text-decoration:none;cursor:pointer;border:0}.igf a{background:#fff;color:#17111C}.igf button{background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.55)}";
    document.head.appendChild(s);
  }
  const f = document.createElement("div");
  f.id = "igf"; f.className = "igf"; f.setAttribute("data-testid", "indique-faixa"); f.setAttribute("role", "region"); f.setAttribute("aria-label", "Sua compra");
  f.innerHTML = `<div class="igf-in"><b>Você já comprou o CORE ✓</b><a href="${esc(comoEntrar)}" data-testid="indique-faixa-entrar">Como entrar no app</a><button type="button" data-testid="indique-faixa-link">Seu link de indicação</button></div>`;
  f.querySelector("a")!.addEventListener("click", () => deps.evento("landing_indique_faixa", { acao: "entrar", pi: c.pi }));
  f.querySelector("button")!.addEventListener("click", () => { deps.evento("landing_indique_faixa", { acao: "link", pi: c.pi }); montar("faixa_recarga"); });
  document.body.insertBefore(f, document.body.firstChild);
  deps.evento("landing_indique_faixa_view", { pi: c.pi, ja_tinha_link: !!estado?.link });
  return true;
}

/** testes */
export function _zerarIndique() { document.getElementById("igf")?.remove(); raiz?.remove(); raiz = null; estado = null; foiNaLoja = false; autoNoHeap = null; if (contador !== null) { window.cancelAnimationFrame(contador); contador = null; } }
