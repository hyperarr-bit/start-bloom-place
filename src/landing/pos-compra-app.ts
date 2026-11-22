/**
 * /oferta (22/11, dono: "depois da compra, tira tudo que é oferta e leva DIRETO pro app, com um tutorial bonito e detalhado").
 * Chave POS_COMPRA_APP no <head> da landing ("on" = esta tela; "off" = o pós-pago de hoje, idêntico).
 *
 * A tela "Pronto! Seu CORE está liberado" + o passo a passo de entrar no app, fiel ao app de HOJE (1.0.29 / Android 142,
 * conferido nas telas reais em 22/11):
 *   1ª tela do app  → "Já tenho conta? Entrar" (no Android que veio do nosso link, o botão grande vira "Entrar na minha conta")
 *   /entrar          → "Seu e-mail" + "Receber código" (código primeiro desde a 1.0.25)
 *   código           → 8 números no e-mail (vale 1 hora; "Mandar outro código" depois de 60 s) → "Entrar" → Home
 * O risco que esta tela cobre: ~1,7% dos compradores da web abrem o app e COMPRAM DE NOVO no paywall (memória
 * compra_dupla_web_app_16_11). Por isso o aviso grande "você já pagou, não compre de novo" e a saída da tela de planos.
 *
 * Nada aqui fala de preço (o valor pago pode variar), nada oferece outra compra, e nenhum evento leva o e-mail.
 * Eventos: pos_compra_view {aparelho, tem_email, via}, pos_compra_aba {aba}, pos_compra_loja {loja}, pos_compra_copiar_email {ok},
 *          pos_compra_ajuda {}, pos_compra_navegador {}.
 * As lojas ficam em <a data-loja> dentro de [data-testid="oferta-pago"]: a atribuição de sempre (landing.ts → atribuicao.ts) vale.
 */
import { URL_APP_STORE, urlPlay } from "./regras";

export type EventoPos = (nome: string, dados?: Record<string, unknown>) => void;
export type Aparelho = "ios" | "android" | "computador";
export type CtxPosCompra = { email: string | null; pi: string | null; evento: EventoPos };

export const EMAIL_SUPORTE = "contato@coreaplicativo.com.br";
/** a porta do navegador (no site, o código aparece em "Entrar sem senha" depois de digitar o e-mail) */
export const URL_NAVEGADOR = "/entrar";
const IMG = "/como-entrar/v2";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** iPhone / Android / computador pelo aparelho (iPad com "Macintosh" e toque conta como iPhone: é a App Store) */
export function aparelhoPelaUa(ua: string, toques = 0): Aparelho {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && toques > 1)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "computador";
}
const aparelhoAqui = (): Aparelho => { try { return aparelhoPelaUa(navigator.userAgent || "", navigator.maxTouchPoints || 0); } catch { return "computador"; } };

/* ───────────────────────── a compra na aba (recarga / fechou a camada) ───────────────────────── */
const CHAVE = "oferta-pos-compra";
export const VALE_MS = 6 * 3600e3;
export function guardarCompraPos(c: { pi: string | null; email: string | null }, agora = Date.now()): void {
  try {
    const ja = JSON.parse(sessionStorage.getItem(CHAVE) || "null") as { pi?: string; em?: number } | null;
    sessionStorage.setItem(CHAVE, JSON.stringify({ pi: c.pi, email: c.email, em: ja && ja.pi === c.pi && typeof ja.em === "number" ? ja.em : agora }));
  } catch { /* sem storage: a tela de agora continua valendo */ }
}
export function lerCompraPos(agora = Date.now()): { pi: string | null; email: string | null } | null {
  try {
    const c = JSON.parse(sessionStorage.getItem(CHAVE) || "null") as { pi?: unknown; email?: unknown; em?: unknown } | null;
    if (!c || typeof c.em !== "number" || agora - c.em > VALE_MS) return null;
    return { pi: typeof c.pi === "string" ? c.pi : null, email: typeof c.email === "string" && c.email.includes("@") ? c.email : null };
  } catch { return null; }
}
/** só o teste de "tem compra na aba?" (o landing.ts usa antes de baixar este pedaço) */
export const CHAVE_COMPRA_POS = CHAVE;

/* ───────────────────────── o visual ───────────────────────── */
export const CSS_POS = `
.pc-raiz{--pc-bg:#fff;--pc-papel:#f7f5f8;--pc-card:#fff;--pc-borda:#ebe7ee;--pc-tx:#1c1a1f;--pc-suave:#6b6670;--pc-mag:#d6338a;--pc-mag-suave:#fdf2f8;--pc-mag-borda:#f3c1dc;--pc-grafite:#262626;--pc-grafite-tx:#fff;--pc-aviso-bg:#fff6e5;--pc-aviso-borda:#f3d28c;--pc-aviso-tx:#6b4200;--pc-ok:#16a34a;--pc-ok-suave:#e8f7ee;--pc-sombra:0 10px 28px -14px rgba(28,26,31,.28)}
@media (prefers-color-scheme:dark){.pc-raiz{--pc-bg:#0f1115;--pc-papel:#151820;--pc-card:#191c23;--pc-borda:#2a2e38;--pc-tx:#f2f0f4;--pc-suave:#a39eaa;--pc-mag:#e25aa2;--pc-mag-suave:#2a1522;--pc-mag-borda:#5a2a45;--pc-grafite:#f2f0f4;--pc-grafite-tx:#16121c;--pc-aviso-bg:#2a2110;--pc-aviso-borda:#5c4718;--pc-aviso-tx:#f5d58a;--pc-ok:#34c46a;--pc-ok-suave:#12301f;--pc-sombra:0 10px 28px -14px rgba(0,0,0,.7)}}
.oc.pc-raiz{background:var(--pc-bg);color:var(--pc-tx)}
.oc.pc-raiz .oc-barra{border-color:var(--pc-borda)}
.oc.pc-raiz .oc-barra span{color:var(--pc-suave)}
.oc.pc-raiz .oc-x{color:var(--pc-tx)}
.pc{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--pc-tx);text-align:left;-webkit-font-smoothing:antialiased}
.pc *{box-sizing:border-box}
.pc-topo{text-align:center;padding:4px 0 2px}
.pc-check{width:64px;height:64px;margin:4px auto 0;border-radius:50%;display:grid;place-items:center;background:var(--pc-ok);color:#fff;box-shadow:0 0 0 9px var(--pc-ok-suave)}
.pc-check svg{width:32px;height:32px}
.pc-topo h2{margin:18px 0 0;font-size:26px;line-height:1.12;font-weight:850;letter-spacing:-.025em;text-wrap:balance}
.pc-topo p{margin:8px auto 0;max-width:32ch;font-size:15.5px;line-height:1.45;color:var(--pc-suave)}
.pc-email{margin-top:18px;padding:14px 16px;border-radius:16px;background:var(--pc-mag-suave);border:1.5px solid var(--pc-mag-borda)}
.pc-email small{display:block;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--pc-mag)}
.pc-email-linha{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:4px}
.pc-email b{min-width:0;font-size:17px;font-weight:800;overflow-wrap:anywhere;line-height:1.3}
.pc-copiar{flex:none;min-height:40px;padding:0 14px;border-radius:999px;border:1.5px solid var(--pc-mag);background:transparent;color:var(--pc-mag);font:800 14px Inter,-apple-system,sans-serif;cursor:pointer}
.pc-copiar[data-ok]{background:var(--pc-mag);color:#fff}
.pc-email p{margin:6px 0 0;font-size:13px;line-height:1.4;color:var(--pc-suave)}
.pc-aviso{display:flex;gap:12px;margin-top:12px;padding:14px 16px;border-radius:16px;background:var(--pc-aviso-bg);border:1.5px solid var(--pc-aviso-borda);color:var(--pc-aviso-tx)}
.pc-aviso i{flex:none;font-style:normal;font-size:22px;line-height:1.1}
.pc-aviso>div>b{display:block;font-size:15.5px;line-height:1.3;font-weight:850}
.pc-aviso span{display:block;margin-top:3px;font-size:13.5px;line-height:1.45}
.pc-abas-t{margin:22px 0 8px;font-size:13px;font-weight:700;color:var(--pc-suave);text-align:center}
.pc-abas{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:4px;border-radius:14px;background:var(--pc-papel);border:1px solid var(--pc-borda)}
.pc-aba{min-height:42px;border:0;border-radius:10px;background:transparent;color:var(--pc-suave);font:700 14px Inter,-apple-system,sans-serif;cursor:pointer}
.pc-aba[aria-selected="true"]{background:var(--pc-card);color:var(--pc-tx);box-shadow:0 1px 3px rgba(0,0,0,.12);font-weight:800}
.pc-passos{list-style:none;margin:14px 0 0;padding:0;position:relative}
.pc-passos::before{content:"";position:absolute;left:15px;top:20px;bottom:24px;border-left:2px dashed var(--pc-mag-borda)}
.pc-passo{position:relative;display:grid;grid-template-columns:32px 1fr;gap:12px;padding:0 0 18px}
.pc-n{position:relative;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:var(--pc-mag);color:#fff;font-weight:900;font-size:15px;box-shadow:0 0 0 4px var(--pc-bg)}
.pc-passo[data-fim] .pc-n{background:var(--pc-ok)}
.pc-cartao{min-width:0;padding:13px 14px 14px;border-radius:16px;background:var(--pc-card);border:1px solid var(--pc-borda);box-shadow:var(--pc-sombra)}
.pc-cartao h3{margin:0;font-size:16.5px;line-height:1.3;font-weight:800;letter-spacing:-.01em}
.pc-cartao p{margin:6px 0 0;font-size:14px;line-height:1.5;color:var(--pc-suave)}
.pc-cartao p b,.pc-cartao li b{color:var(--pc-tx)}
.pc-cartao ul{margin:8px 0 0;padding:0 0 0 18px;font-size:14px;line-height:1.5;color:var(--pc-suave)}
.pc-cartao li+li{margin-top:3px}
.pc-nao{display:flex;gap:7px;margin-top:9px;padding:9px 11px;border-radius:12px;background:var(--pc-papel);font-size:13px;line-height:1.4;color:var(--pc-suave)}
.pc-nao::before{content:"✕";flex:none;font-weight:900;color:#d0364a}
.pc-selos{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:10px}
.pc-selos a{display:inline-block;border-radius:10px;line-height:0}
.pc-selos img{display:block;height:50px;width:auto}
.pc-selos a[data-principal] img{height:56px}
.pc-selos-outro{margin:8px 0 0;font-size:12.5px;color:var(--pc-suave)}
.pc-print{margin:12px 0 0;border-radius:14px;overflow:hidden;border:1px solid var(--pc-borda);background:#fff;line-height:0}
.pc-print img{display:block;width:100%;height:auto}
.pc-print figcaption{line-height:1.3;padding:7px 10px;font-size:11.5px;font-weight:700;color:#6b6670;background:#f7f5f8;border-top:1px solid #ebe7ee}
.pc-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;margin-top:8px;padding:8px 12px;border-radius:12px;background:var(--pc-papel);border:1px solid var(--pc-borda);font-size:14.5px;font-weight:800;color:var(--pc-tx);overflow-wrap:anywhere}
.pc-planos{margin-top:4px;padding:14px 16px;border-radius:16px;border:1.5px dashed var(--pc-aviso-borda);background:var(--pc-card)}
.pc-planos h3{margin:0;font-size:15.5px;font-weight:850}
.pc-planos p{margin:6px 0 0;font-size:14px;line-height:1.5;color:var(--pc-suave)}
.pc-planos p b{color:var(--pc-tx)}
.pc-btn{display:flex;align-items:center;justify-content:center;width:100%;min-height:52px;margin-top:18px;border-radius:14px;border:1.5px solid var(--pc-borda);background:var(--pc-card);color:var(--pc-tx);font:800 15.5px Inter,-apple-system,sans-serif;text-decoration:none}
.pc-btn-cheio{background:var(--pc-grafite);color:var(--pc-grafite-tx);border-color:var(--pc-grafite)}
.pc-btn small{display:block}
.pc-ajuda{margin:16px 0 0;padding:14px 16px;border-radius:16px;background:var(--pc-papel);font-size:14px;line-height:1.5;color:var(--pc-suave);text-align:center}
.pc-ajuda b{display:block;color:var(--pc-tx);font-size:15px}
.pc-ajuda a{color:var(--pc-mag);font-weight:800;overflow-wrap:anywhere}
.pc-faixa{position:sticky;top:0;z-index:2147481000;background:#17111c;color:#fff;padding:10px 14px max(10px,env(safe-area-inset-top));font:600 13.5px/1.35 Inter,-apple-system,sans-serif}
.pc-faixa-in{max-width:520px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 10px}
.pc-faixa b{font-weight:800}
.pc-faixa button{min-height:40px;border-radius:999px;padding:0 16px;border:0;background:#fff;color:#17111c;font:800 13.5px Inter,-apple-system,sans-serif;cursor:pointer}
.pc-cheia{position:fixed;inset:0;z-index:2147482000;display:flex;flex-direction:column;background:var(--pc-bg);color:var(--pc-tx);height:100vh;height:100dvh}
.pc-cheia-barra{flex:none;display:flex;align-items:center;justify-content:space-between;height:52px;padding:env(safe-area-inset-top) 8px 0 16px;border-bottom:1px solid var(--pc-borda)}
.pc-cheia-barra b{font:900 15px Inter,-apple-system,sans-serif;letter-spacing:.14em}
.pc-cheia-barra button{width:44px;height:44px;border:0;background:none;font-size:26px;color:var(--pc-tx);cursor:pointer}
.pc-cheia-corpo{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:18px 18px calc(28px + env(safe-area-inset-bottom))}
.pc-cheia-in{max-width:440px;margin:0 auto}
@media (max-width:350px){.pc-topo h2{font-size:23px}.pc-selos img{height:44px}.pc-selos a[data-principal] img{height:48px}.pc-aba{font-size:13px}.pc-passo{gap:9px}}
`;
function garantirCss() {
  if (document.getElementById("pc-estilo")) return;
  const s = document.createElement("style"); s.id = "pc-estilo"; s.textContent = CSS_POS; document.head.appendChild(s);
}

const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const seloApple = (principal: boolean) => `<a href="${URL_APP_STORE}" data-loja="ios" data-testid="pos-loja-ios"${principal ? " data-principal" : ""}><img src="/selos/app-store.svg" alt="Baixar na App Store" width="150" height="50" /></a>`;
let origemPlay = "oferta";
const seloPlay = (principal: boolean) => `<a href="${esc(urlPlay(origemPlay))}" data-loja="android" data-testid="pos-loja-android"${principal ? " data-principal" : ""}><img src="/selos/google-play.png" alt="Disponível no Google Play" width="129" height="50" /></a>`;
const print = (arq: string, alt: string, w: number, h: number) =>
  `<figure class="pc-print"><img src="${IMG}/${arq}.webp" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async" /><figcaption>Tela do app CORE</figcaption></figure>`;
/** os tamanhos reais das imagens (public/como-entrar/v2), pra a página não pular ao carregar */
const TAM: Record<string, [number, number]> = {
  "ios-1-abrir": [600, 846], "android-1-abrir": [600, 831], "ios-2-email": [600, 662], "android-2-email": [600, 662],
  "ios-3-codigo": [600, 600], "android-3-codigo": [600, 600], "ios-4-planos": [600, 646], "android-4-planos": [600, 615],
};
const img = (arq: string, alt: string) => print(arq, alt, TAM[arq][0], TAM[arq][1]);

const passo = (n: number | string, corpo: string, fim = false) =>
  `<li class="pc-passo"${fim ? " data-fim" : ""} data-testid="pos-passo-${n}"><span class="pc-n" aria-hidden="true">${fim ? "✓" : n}</span><div class="pc-cartao">${corpo}</div></li>`;

/** o passo a passo de um aparelho (texto puro + imagens reais) */
export function htmlPassos(ap: Aparelho, email: string | null, origem = "oferta"): string {
  origemPlay = origem; // o utm do Google Play (o /como-entrar mede como "como_entrar")
  const e = email ? `<b>${esc(email)}</b>` : "<b>o e-mail que você usou na compra</b>";
  const chip = email ? `<span class="pc-chip" data-testid="pos-email-chip">✉️ ${esc(email)}</span>` : "";
  const codigo = (p: "ios" | "android") => passo(4, `<h3>Pegue o código de 8 números no seu e-mail</h3>
    <p>Chega em até 1 minuto em ${e}. Digite o código no app e toque em <b>“Entrar”</b>.</p>
    ${img(`${p}-3-codigo`, "Tela do app com o campo do código de 8 números e o botão Entrar")}
    <ul><li>Não achou? Olhe em <b>Spam</b>, <b>Promoções</b> ou <b>Atualizações</b>.</li><li>Não chegou em 2 minutos? No app, toque em <b>“Mandar outro código”</b>.</li><li>O código vale por 1 hora. Não precisa de senha.</li></ul>`);
  const pronto = passo("fim", `<h3>Pronto! Seu CORE abre com tudo liberado</h3><p>Os 16 módulos, no celular e no computador, com a mesma conta. Seus dados ficam salvos nela.</p>`, true);
  if (ap === "computador") {
    return `<ol class="pc-passos" data-testid="pos-passos" data-aparelho="computador">
      ${passo(1, `<h3>Entre pelo navegador</h3><p>Abra <b>coreaplicativo.com.br/entrar</b> ou toque no botão abaixo.</p><a class="pc-btn pc-btn-cheio" href="${URL_NAVEGADOR}" data-testid="pos-navegador-pc" data-navegador>Entrar no navegador</a>`)}
      ${passo(2, `<h3>Digite seu e-mail e toque em “Entrar sem senha”</h3><p>Use ${e}. Você não tem senha: toque em <b>“Entrar sem senha — receber código por e-mail”</b>, que aparece logo depois do e-mail.</p>${chip}`)}
      ${passo(3, `<h3>Digite o código de 8 números do e-mail</h3><p>Chega em até 1 minuto. Não achou? Olhe em <b>Spam</b> ou <b>Promoções</b>.</p>`)}
      ${passo(4, `<h3>Quer no celular também?</h3><p>É o mesmo CORE, com a mesma conta. Baixe e entre com o mesmo e-mail:</p><div class="pc-selos">${seloApple(false)}${seloPlay(false)}</div>`)}
      ${pronto}
    </ol>`;
  }
  const ios = ap === "ios";
  const loja = ios ? "App Store" : "Google Play";
  return `<ol class="pc-passos" data-testid="pos-passos" data-aparelho="${ap}">
    ${passo(1, `<h3>Baixe o CORE na ${loja}</h3><p>Toque no selo e depois em <b>${ios ? "“Obter”" : "“Instalar”"}</b>.</p>
      <div class="pc-selos">${ios ? seloApple(true) : seloPlay(true)}</div>
      <p class="pc-selos-outro">${ios ? "Tem Android?" : "Tem iPhone?"} O CORE também está ${ios ? "no Google Play" : "na App Store"}:</p>
      <div class="pc-selos">${ios ? seloPlay(false) : seloApple(false)}</div>`)}
    ${ios
      ? passo(2, `<h3>Abra o app e toque em “Já tenho conta? Entrar”</h3><p>É a linha logo <b>embaixo</b> do botão preto.</p>${img("ios-1-abrir", "Primeira tela do app com “Já tenho conta? Entrar” destacado")}
        <p class="pc-nao">Não toque em “Começar”. Ele é pra quem ainda não comprou e leva pra tela de planos.</p>`)
      : passo(2, `<h3>Abra o app e toque em “Entrar na minha conta”</h3><p>Se o botão preto disser <b>“Começar”</b>, toque em <b>“Já tenho conta? Entrar”</b>, logo embaixo dele.</p>${img("android-1-abrir", "Primeira tela do app com “Entrar na minha conta” destacado")}
        <p class="pc-nao">Não toque em “Começar”. Ele é pra quem ainda não comprou e leva pra tela de planos.</p>`)}
    ${passo(3, `<h3>Digite seu e-mail e toque em “Receber código”</h3><p>Use ${e}, o mesmo da compra.</p>${chip}${img(`${ap}-2-email`, "Tela Entrar no seu CORE com o e-mail e o botão Receber código destacados")}`)}
    ${codigo(ap)}
    ${pronto}
  </ol>
  <div class="pc-planos" data-testid="pos-planos"><h3>Apareceu uma tela de planos ou de preço?</h3>
    <p><b>Não pague: você já pagou.</b> ${ios
      ? "Role até o fim dessa tela e toque em <b>“Já é cliente? Entre com seu e-mail”</b>. Aí é só seguir do passo 3."
      : "Toque no <b>X</b> lá em cima (ou no Voltar do celular) até voltar pra primeira tela, e toque em <b>“Já tenho conta? Entrar”</b>."}</p>
    ${img(`${ap}-4-planos`, ios ? "Fim da tela de planos com “Já é cliente? Entre com seu e-mail” destacado" : "Tela de planos com o X de fechar destacado")}
  </div>`;
}

/** a tela inteira (sem os eventos) */
export function htmlPosCompra(email: string | null, ap: Aparelho): string {
  const abas: Array<[Aparelho, string]> = [["ios", "iPhone"], ["android", "Android"], ["computador", "Computador"]];
  return `<div class="pc" data-testid="pos-compra">
    <div class="pc-topo"><div class="pc-check">${ICO_CHECK}</div>
      <h2 id="oc-tit">Pronto! Seu CORE está liberado</h2>
      <p>Pagamento confirmado. Agora é só entrar no app com o seu e-mail. Leva 2 minutos.</p></div>
    ${email
      ? `<div class="pc-email" data-testid="pos-email"><small>Seu e-mail de acesso</small><div class="pc-email-linha"><b>${esc(email)}</b><button type="button" class="pc-copiar" data-testid="pos-copiar">Copiar</button></div><p>É com ele que você entra. Não precisa de senha.</p></div>`
      : `<div class="pc-email" data-testid="pos-email"><small>Seu e-mail de acesso</small><p>Entre com <b>o mesmo e-mail que você digitou na compra</b>. Não precisa de senha.</p></div>`}
    <div class="pc-aviso" role="note" data-testid="pos-nao-compre"><i aria-hidden="true">⚠️</i><div><b>Você já pagou. Não compre de novo no app.</b><span>No app, toque em <b>Entrar</b> e use o seu e-mail. Viu uma tela de preço? Não pague: no fim desta página mostramos como sair dela.</span></div></div>
    <p class="pc-abas-t" id="pc-abas-t">Como entrar, passo a passo:</p>
    <div class="pc-abas" role="tablist" aria-labelledby="pc-abas-t">${abas.map(([k, r]) => `<button type="button" class="pc-aba" role="tab" data-aba="${k}" aria-selected="${k === ap}" data-testid="pos-aba-${k}">${r}</button>`).join("")}</div>
    <div id="pc-conteudo" role="tabpanel">${htmlPassos(ap, email)}</div>
    <a class="pc-btn" href="${URL_NAVEGADOR}" data-testid="pos-navegador" data-navegador>Prefere usar no navegador agora?</a>
    <div class="pc-ajuda" data-testid="pos-ajuda"><b>Travou em algum passo?</b>Fale com a gente: <a href="mailto:${EMAIL_SUPORTE}" data-ajuda>${EMAIL_SUPORTE}</a>. A gente libera pra você.</div>
  </div>`;
}

async function copiar(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* navegador do Instagram: cai no jeito antigo */ }
  try {
    const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.position = "fixed"; a.style.opacity = "0";
    document.body.appendChild(a); a.select(); const ok = document.execCommand("copy"); a.remove(); return ok;
  } catch { return false; }
}

/**
 * Desenha o pós-compra dentro de `alvo` (a camada do checkout ou a tela cheia da recarga). `pele` = o elemento que ganha os
 * tokens de cor (a camada .oc, pra o fundo e a barra virarem escuros junto). `via` vai no pos_compra_view.
 */
export function montarPosCompra(alvo: HTMLElement, ctx: CtxPosCompra, o: { pele?: HTMLElement | null; via?: string } = {}): void {
  garantirCss();
  (o.pele ?? alvo).classList.add("pc-raiz");
  const email = ctx.email && ctx.email.includes("@") ? ctx.email.trim().toLowerCase() : null;
  const ap = aparelhoAqui();
  alvo.innerHTML = `<div data-testid="oferta-pago">${htmlPosCompra(email, ap)}</div>`;
  guardarCompraPos({ pi: ctx.pi, email });
  ctx.evento("pos_compra_view", { aparelho: ap, tem_email: !!email, via: o.via ?? "pago" });
  const raiz = alvo.querySelector<HTMLElement>("[data-testid='pos-compra']")!;
  const ligarPassos = () => {
    raiz.querySelectorAll<HTMLAnchorElement>("#pc-conteudo a[data-loja]").forEach((a) => a.addEventListener("click", () => ctx.evento("pos_compra_loja", { loja: a.dataset.loja })));
    raiz.querySelectorAll<HTMLAnchorElement>("#pc-conteudo a[data-navegador]").forEach((a) => a.addEventListener("click", () => ctx.evento("pos_compra_navegador", { onde: "passo" })));
  };
  ligarPassos();
  raiz.querySelectorAll<HTMLButtonElement>("[data-aba]").forEach((b) => b.addEventListener("click", () => {
    const k = b.dataset.aba as Aparelho;
    if (b.getAttribute("aria-selected") === "true") return;
    raiz.querySelectorAll("[data-aba]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    raiz.querySelector("#pc-conteudo")!.innerHTML = htmlPassos(k, email);
    ligarPassos();
    ctx.evento("pos_compra_aba", { aba: k, aparelho: ap });
  }));
  const bc = raiz.querySelector<HTMLButtonElement>("[data-testid='pos-copiar']");
  bc?.addEventListener("click", () => { void copiar(email!).then((ok) => {
    ctx.evento("pos_compra_copiar_email", { ok });
    bc.textContent = ok ? "Copiado ✓" : "Copie acima"; if (ok) bc.setAttribute("data-ok", "");
    window.setTimeout(() => { bc.textContent = "Copiar"; bc.removeAttribute("data-ok"); }, 2500);
  }); });
  raiz.querySelector("[data-testid='pos-navegador']")?.addEventListener("click", () => ctx.evento("pos_compra_navegador", { onde: "rodape" }));
  raiz.querySelector("a[data-ajuda]")?.addEventListener("click", () => ctx.evento("pos_compra_ajuda", {}));
}

/* ───────────────────────── a recarga / fechou a camada: faixa + tela cheia ───────────────────────── */
let cheia: HTMLElement | null = null;
export function abrirPosCompraTelaCheia(ctx: CtxPosCompra, via: string): void {
  if (cheia) return;
  garantirCss();
  document.getElementById("pc-faixa")?.remove();
  cheia = document.createElement("div");
  cheia.className = "pc-cheia pc-raiz"; cheia.setAttribute("role", "dialog"); cheia.setAttribute("aria-modal", "true"); cheia.setAttribute("aria-labelledby", "oc-tit");
  cheia.setAttribute("data-testid", "pos-tela-cheia");
  cheia.innerHTML = `<div class="pc-cheia-barra"><b>CORE</b><button type="button" aria-label="Fechar">×</button></div><div class="pc-cheia-corpo"><div class="pc-cheia-in"></div></div>`;
  document.body.appendChild(cheia);
  const yAntes = window.scrollY || 0;
  document.documentElement.style.overflow = "hidden";
  montarPosCompra(cheia.querySelector<HTMLElement>(".pc-cheia-in")!, ctx, { pele: cheia, via });
  cheia.querySelector<HTMLButtonElement>(".pc-cheia-barra button")!.addEventListener("click", () => {
    cheia?.remove(); cheia = null; document.documentElement.style.overflow = "";
    try { window.scrollTo(0, yAntes); } catch { /* jsdom */ }
    faixaPosCompra(ctx);
  });
}
/** a faixa do topo ("Você já comprou o CORE ✓ · Ver como entrar no app") quando a página de venda está à mostra */
export function faixaPosCompra(ctx: CtxPosCompra): boolean {
  if (document.getElementById("pc-faixa") || cheia) return false;
  garantirCss();
  const f = document.createElement("div");
  f.id = "pc-faixa"; f.className = "pc-faixa"; f.setAttribute("role", "region"); f.setAttribute("aria-label", "Sua compra"); f.setAttribute("data-testid", "pos-faixa");
  f.innerHTML = `<div class="pc-faixa-in"><b>Você já comprou o CORE ✓</b><button type="button" data-testid="pos-faixa-abrir">Ver como entrar no app</button></div>`;
  f.querySelector("button")!.addEventListener("click", () => abrirPosCompraTelaCheia(ctx, "faixa"));
  document.body.insertBefore(f, document.body.firstChild);
  return true;
}

/** testes */
export function _zerarPosCompra() { cheia?.remove(); cheia = null; document.getElementById("pc-faixa")?.remove(); document.documentElement.style.overflow = ""; }
