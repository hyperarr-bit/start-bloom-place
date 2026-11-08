/**
 * O CHECKOUT NOVO DO /organizar (08/11, chave CHECKOUT_ORG_V2 no <head> → html[data-cko="v2"]; novidades-guardadas/2026-11-07/checkout-organizar/SPEC.md).
 *
 * SÓ TELA. Uma camada em tela cheia com a cara do checkout v2 da /oferta (./stripe-checkout.ts, só o visual, COPIADO — importar puxaria a
 * Stripe pro /organizar e mexer lá arrisca a fixture da /oferta): banner grafite ("ACESSO VITALÍCIO · Um app pra vida inteira · R$ 27,90
 * uma vez só · App Store · Google Play" + o print do app), o e-mail ("é por onde você entra no CORE"), a caixa "Pix copia e cola", o botão
 * "Gerar Pix de R$ 27,90", "Depois, baixe o CORE e entre com este e-mail", garantia de 7 dias, Dúvidas e, no fim, o CNPJ e o contato.
 * Só Pix: sem os blocos de método, sem cartão, sem CPF, sem order bump. Nunca "Stripe" aqui.
 *
 * Este arquivo NÃO conhece Asaas, sessão nem o estado do Pix. O dinheiro inteiro continua no ./landing.ts: o botão chama o MESMO gerar()
 * de hoje (no mesmo toque — o código do Pix vai pra área de transferência dentro do gesto), e a landing diz o que a camada mostra:
 *   formulário → (código de 8 números, se o e-mail já tem conta: o MESMO HTML do cartão de hoje) → "Gerando o seu Pix…" (o MESMO HTML)
 *   → QR pronto: a landing FECHA a camada e a página já está no cartão, com o QR de hoje (AB_PIX "atual" ou "b"), a confirmação, o
 *     Purchase, a conta, o presente/2027 e o "Você já tem o CORE" de hoje — o mesmo código, não uma cópia.
 * Histórico: abrir empilha 1 entrada (mesma URL, marca `ckoOrg`); o "voltar" fecha; o X/Esc voltam essa entrada; fechar pela landing
 * (QR, "já tem", pago) tira a entrada sem sair do site. A rolagem do navegador fica "manual" enquanto a camada existe (o "voltar" não
 * pode jogar a página longe do cartão do QR).
 *
 * Eventos (pelo evento() da landing — já com braco_cko, braco_lp, braco_pix…; nenhum leva e-mail, código ou texto digitado):
 *   landing_cko_aberto {de, vez, email_pre, aviso_vencido, ms} · landing_cko_fechado {via: x|esc|voltar|pix|ja_tem|pago, fase, s_aberto, email_digitado}
 *   landing_cko_email_comecou {} (1× por página) · landing_cko_saiu {fase, s_aberto, email_digitado} (aba escondeu; 1× por abertura)
 *   landing_cko_duvidas {aberto} · landing_cko_duvida {qual} (1× por pergunta por abertura; as 2 que abrem sozinhas não contam)
 *   landing_cko_rodape_visto {s_aberto, rolou} (1× por abertura) · landing_cko_banner_imagem {estado: pronta_ao_abrir|pronta|falhou, ms} (1× por abertura)
 */

export type Evento = (nome: string, dados?: Record<string, unknown>) => void;
export type Tela = "form" | "codigo" | "gerando";
export type OpcoesCko = {
  /** de onde abriu: topo | fixo | fim | outro | cartao | demo_tela_cheia */
  de: string;
  /** quantas vezes a camada abriu nesta página (contada pela landing) */
  vez: number;
  /** do toque até a camada (o módulo pode ter baixado agora) */
  ms: number;
  /** "R$ 27,90" — sai do VALOR_OFERTA da landing; nada de preço escrito aqui */
  precoTxt: string;
  /** braço "email" do AB_CHECKOUT (hoje, todo mundo): a camada pede o e-mail. "livre": sem campo (o e-mail fica opcional na tela do QR) */
  pedeEmail: boolean;
  emailInicial: string;
  /** "Esse código venceu…" (Pix vencido há < 10 min, braço v2 do AB_LP) */
  aviso: string | null;
  nomeNoBanco: string;
  cnpj: string;
  evento: Evento;
  /** o toque em "Gerar Pix" (ou o "Ir" do teclado): a landing chama o gerar() de hoje, no MESMO gesto */
  aoGerar: () => void;
  /** o formulário foi (re)montado: a landing liga o campo (input/blur/Enter/sugestão) do mesmo jeito que liga o do cartão */
  aoMontarForm: (campo: HTMLInputElement | null, sugestao: HTMLButtonElement | null) => void;
  /** a camada fechou (qualquer via): a landing decide pra onde a página vai */
  aoFechar: (via: string, tela: Tela | null) => void;
};

/** "Pagamento processado pelo Asaas" em cima do CNPJ? Padrão: não (dono 02/11, sobre a tela "b" do Pix: "não precisa dessa mensagem"; no banco
 *  aparece o nome da empresa, não "Asaas"). Trocar pra true acrescenta a linha. */
const RODAPE_ASAAS = false as boolean;
export const BANNER_CKO = "/landing/ck-banner-home.webp";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const ICO_CADEADO = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
const ICO_PIX = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.2" y="5.2" width="13.6" height="13.6" rx="3.2" transform="rotate(45 12 12)" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="9.6" y="9.6" width="4.8" height="4.8" rx="1" transform="rotate(45 12 12)" fill="currentColor"/></svg>';
const ICO_APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.7c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-1.9-3.6-2-1.5-.2-3 .9-3.8.9s-2-.9-3.3-.8C6.1 7 4.6 8 3.7 9.5c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.8-1.1-2.9-4.2zM13.9 5.3c.7-.8 1.2-2 1-3.2-1 0-2.3.7-3 1.5-.6.7-1.2 1.9-1.1 3.1 1.2.1 2.3-.6 3.1-1.4z"/></svg>';
const ICO_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.6 2.2 13.8 12 3.6 21.8c-.4-.2-.6-.6-.6-1.1V3.3c0-.5.2-.9.6-1.1zm11.7 11.3 2.8 2.8-10.4 6c-.6.3-1.2.3-1.7 0zM18.1 8.6l3.1 1.8c1 .6 1 1.6 0 2.2l-3.1 1.8L15.3 12zM5.8 1.9l10.3 6-2.8 2.8L5.8 2c.5-.3 1.2-.3 1.7 0z"/></svg>';
const ICO_ESCUDO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4.5 6v6c0 4.4 3.2 7.8 7.5 9 4.3-1.2 7.5-4.6 7.5-9V6z"/><path d="m8.8 12 2.2 2.2 4.3-4.4"/></svg>';
const ICO_SETA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
const ICO_CELULAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>';

/* o visual do checkout v2 da /oferta (stripe-checkout.ts: CSS + CSS_V2), com o prefixo próprio .cko — nunca briga com o .oc da /oferta */
const CSS = `
.cko{position:fixed;inset:0;z-index:300;background:#fff;display:flex;flex-direction:column;height:100vh;height:100dvh;overscroll-behavior:contain;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--tx,#1c1a1f);animation:cko-sobe .22s ease}
.cko[hidden]{display:none!important}
@keyframes cko-sobe{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.cko{animation:none}}
.cko-barra{flex:none;display:flex;align-items:center;justify-content:space-between;gap:8px;height:52px;padding:0 8px 0 16px;border-bottom:1px solid var(--borda,#ebe8ee);padding-top:env(safe-area-inset-top);box-sizing:content-box}
.cko-barra b{font-size:15px;font-weight:900;letter-spacing:.14em}
.cko-barra span{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--suave,#6b6670)}
.cko-x{width:44px;height:44px;border:0;background:none;border-radius:12px;font-size:26px;line-height:1;color:var(--tx,#1c1a1f)}
.cko-corpo{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 16px calc(20px + env(safe-area-inset-bottom))}
.cko-in{max-width:440px;margin:0 auto}
.cko-banner{position:relative;display:flex;min-height:124px;border-radius:18px;overflow:hidden;color:#fff;background:radial-gradient(120px 120px at 86% 8%,rgba(214,51,138,.55),rgba(214,51,138,0) 70%),radial-gradient(160px 90px at 0% 110%,rgba(214,51,138,.18),rgba(214,51,138,0) 70%),radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.2px) 0 0/14px 14px,#1c1a1f}
.cko-b-txt{position:relative;z-index:1;box-sizing:border-box;display:flex;flex-direction:column;min-height:124px;width:calc(100% - 122px);padding:13px 0 12px 16px}
.cko-b-sobre{font-size:11.5px;line-height:1.2;font-weight:800;letter-spacing:.12em;color:#f6a8cf}
.cko-b-tit{margin:3px 0 0;font-size:17px;line-height:1.12;font-weight:800;letter-spacing:-.02em;color:#fff}
.cko-b-tit em{font-style:normal;color:#ff7ab8}
.cko-b-preco{display:flex;flex-wrap:wrap;align-items:baseline;gap:2px 7px;margin:7px 0 0}
.cko-b-preco b{font-size:24px;line-height:1;font-weight:850;letter-spacing:-.025em;color:#fff;white-space:nowrap}
.cko-b-preco span{font-size:12.5px;font-weight:700;color:#ff8cc6;white-space:nowrap}
.cko-b-lojas{display:flex;flex-wrap:wrap;gap:3px 9px;margin:auto 0 0;padding-top:6px;font-size:11.5px;line-height:1.2;font-weight:600;color:#cfc9d4}
.cko-b-lojas span{display:inline-flex;align-items:center;gap:3px;white-space:nowrap}
.cko-b-lojas svg{flex:none;width:11px;height:11px;fill:currentColor}
.cko-b-fone{position:absolute;right:16px;bottom:-18px;width:96px;height:128px;padding-top:13px;border:5px solid #3b3740;border-bottom:0;border-radius:20px 20px 0 0;overflow:hidden;background:#f4f4f4;box-shadow:0 10px 26px rgba(0,0,0,.45);box-sizing:border-box}
.cko-b-fone img{display:block;width:100%;height:auto}
.cko-b-fone img[hidden]{display:none}
.cko-b-ilha{position:absolute;z-index:1;top:4px;left:50%;width:30px;height:8px;margin-left:-15px;border-radius:99px;background:#1c1a1f}
.cko-aviso{margin:12px 0 0;padding:10px 12px;border-radius:12px;background:#fff7e6;color:#7a4b00;font-size:13.5px;line-height:1.4;font-weight:600}
.cko-rot{display:block;margin:14px 0 6px;font-size:14px;font-weight:700}
.cko-rot span{font-weight:500;color:var(--suave,#6b6670)}
.cko-campo{display:block;box-sizing:border-box;width:100%;height:50px;border-radius:12px;border:1.5px solid #d9d4dd;padding:0 14px;font-size:16px;font-family:inherit;background:#fff;color:inherit}
.cko-campo:focus{outline:none;border-color:var(--magenta,#d6338a);box-shadow:0 0 0 3px rgba(214,51,138,.15)}
.cko-campo[aria-invalid="true"]{border-color:#dc2626}
.cko-sug{display:block;margin:6px 0 0;padding:0;border:0;background:none;font:inherit;font-size:13.5px;color:var(--magenta-escuro,#b0256f);font-weight:600;text-align:left}
.cko-sug b{text-decoration:underline;text-underline-offset:3px}
.cko-sug[hidden],.cko-erro[hidden]{display:none}
.cko-erro{margin:8px 0 0;font-size:13.5px;color:#b42318;font-weight:600}
.cko-pix{display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px 12px;border-radius:12px;background:var(--papel,#f7f5f8)}
.cko-pix svg{flex:none;width:22px;height:22px;color:#32bcad}
.cko-pix p{margin:0;font-size:13.5px;line-height:1.35;color:var(--suave,#6b6670)}
.cko-pix b{font-weight:800;color:var(--tx,#1c1a1f)}
.cko-cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:56px;margin-top:12px;border:0;border-radius:16px;background:var(--grafite,#262626);color:#fff;font-size:17px;font-weight:800;font-family:inherit;box-shadow:0 8px 20px -6px rgba(0,0,0,.35)}
.cko-cta svg{flex:none;width:21px;height:21px}
.cko-depois{display:flex;align-items:center;justify-content:center;gap:6px;margin:10px 0 0;font-size:13px;line-height:1.3;font-weight:600;color:var(--suave,#6b6670);text-align:center}
.cko-depois svg{flex:none;width:15px;height:15px}
.cko-garantia{display:flex;align-items:center;justify-content:center;gap:8px;margin:8px 0 0;padding:7px 12px;border-radius:12px;background:#ecfdf3;color:#14532d;font-size:13px;line-height:1.3}
.cko-garantia svg{flex:none;width:18px;height:18px;color:#16a34a}
.cko-duvidas{margin-top:2px}
.cko-duvidas summary{list-style:none;cursor:pointer;-webkit-tap-highlight-color:transparent}
.cko-duvidas summary::-webkit-details-marker{display:none}
.cko-duvidas>summary{display:flex;align-items:center;justify-content:center;gap:5px;min-height:44px;font-size:13.5px;font-weight:700;color:var(--tx,#1c1a1f)}
.cko-duvidas>summary span{font-weight:600;color:var(--suave,#6b6670)}
.cko-duvidas>summary svg{flex:none;width:14px;height:14px;transition:transform .15s}
.cko-duvidas[open]>summary svg{transform:rotate(180deg)}
.cko-dlista{padding:0 2px 4px;border-top:1px solid var(--borda,#ebe8ee)}
.cko-dlista details{border-bottom:1px solid #f1eef3}
.cko-dlista summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;font-size:14px;font-weight:700}
.cko-dlista summary::after{content:"+";flex:none;font-size:19px;font-weight:600;color:var(--suave,#6b6670)}
.cko-dlista details[open] summary::after{content:"−"}
.cko-dlista p{margin:0 0 11px;font-size:13.5px;line-height:1.4;color:var(--suave,#6b6670)}
.cko-rodape{margin-top:6px;padding-top:10px;border-top:1px solid var(--borda,#ebe8ee);text-align:center}
.cko-rodape p{margin:0}
.cko-rodape p:first-child{display:inline-flex;align-items:center;gap:6px;font-size:13px;line-height:1.3;font-weight:700;color:#47424c}
.cko-rodape p+p{margin-top:3px;font-size:11.5px;line-height:1.4;color:var(--suave,#6b6670)}
.cko-passo{margin-top:6px}
.cko-passo .lp-pago{padding-top:14px}
@media (max-width:374px){.cko-b-tit{font-size:15.5px}.cko-b-preco b{font-size:22px}.cko-depois{font-size:12.5px}.cko-garantia{font-size:12.5px;padding:7px 10px}}
@media (max-width:359px){.cko-b-txt{width:calc(100% - 94px);padding-right:4px}.cko-b-fone{right:12px;bottom:-14px;width:76px;height:104px;padding-top:10px;border-width:4px;border-radius:16px 16px 0 0}.cko-b-ilha{top:3px;width:24px;height:6px;margin-left:-12px}}
@media (prefers-reduced-motion:reduce){.cko-duvidas>summary svg{transition:none}}
`;

/** as respostas saem da página e da tela do Pix de hoje; nada que o app ou o servidor não façam */
const duvidas = (o: OpcoesCko): Array<{ qual: string; p: string; r: string }> => [
  { qual: "mensal", p: "É mensalidade?", r: "Não. Você paga uma vez. Nada é cobrado depois." },
  { qual: "app", p: "É app de verdade?", r: "Sim. Está na App Store e na Google Play, e abre no computador com a mesma conta." },
  { qual: "entrar", p: "Como entro depois de pagar?", r: `Baixe o CORE e toque em “Já tenho conta? Entrar”, com ${o.pedeEmail ? "este" : "o seu"} e-mail.` },
  { qual: "banco", p: "Que nome aparece no banco?", r: `${esc(o.nomeNoBanco)}. É a nossa empresa (CNPJ ${esc(o.cnpj)}).` },
  { qual: "garantia", p: "E se eu não gostar?", r: "Você tem 7 dias. Mande um e-mail pra contato@coreaplicativo.com.br e devolvemos 100% no Pix." },
];
const DUVIDAS_JA_ABERTAS = ["mensal", "app"];

let raiz: HTMLElement | null = null;
let opc: OpcoesCko | null = null;
let aberta = false;
let tela: Tela | null = null;
let abertoEm = 0;
let yAntes = 0;
let focoAntes: HTMLElement | null = null;
let comHistorico = false;
let fechandoPelaTela: string | null = null;
let reservaFechar: number | null = null;
/** um history.back() nosso (fechar pela landing) ainda sem o popstate: o popstate dele não é "voltar" da pessoa */
let pularPop = 0;
let restauracaoAntes: ScrollRestoration | null = null;
let timerRestauracao: number | null = null;
/** o e-mail digitado sobrevive às trocas de tela (formulário → gerando → formulário com erro) */
let emailMemo = "";
let emailDigitado = false;
let emailComecou = false; // 1× por página
let saiuNestaAbertura = false;
let duvidasVistas = new Set<string>();
let duvidasAberto = false;
let rodapeVisto = false;
let bannerMedido = false;
let obsRodape: IntersectionObserver | null = null;

export const estaAberto = (): boolean => aberta;
export const telaAtual = (): Tela | null => (aberta ? tela : null);

function travar() {
  yAntes = Math.round(window.scrollY || window.pageYOffset || 0);
  const b = document.body.style;
  b.position = "fixed"; b.top = `-${yAntes}px`; b.left = "0"; b.right = "0"; b.width = "100%"; b.overflow = "hidden";
  document.documentElement.setAttribute("data-cko-aberto", "");
}
function soltar() {
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = ""; b.overflow = "";
  document.documentElement.removeAttribute("data-cko-aberto");
  try { window.scrollTo(0, yAntes); } catch { /* jsdom */ }
}

function montar(): HTMLElement {
  if (!document.getElementById("cko-estilo")) { const st = document.createElement("style"); st.id = "cko-estilo"; st.textContent = CSS; document.head.appendChild(st); }
  const el = document.createElement("div");
  el.className = "cko"; el.id = "cko"; el.hidden = true;
  el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-labelledby", "cko-tit");
  el.setAttribute("data-testid", "cko");
  el.innerHTML = `
    <div class="cko-barra"><b>CORE</b><span>${ICO_CADEADO}Pagamento seguro</span><button type="button" class="cko-x" id="cko-x" aria-label="Fechar o pagamento">×</button></div>
    <div class="cko-corpo" id="cko-corpo"><div class="cko-in" id="cko-in"></div></div>`;
  document.body.appendChild(el);
  el.querySelector("#cko-x")!.addEventListener("click", () => pedirFechar("x"));
  el.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); pedirFechar("esc"); return; }
    if (e.key !== "Tab") return;
    const foc = [...el.querySelectorAll<HTMLElement>("button, input, a[href], summary, [tabindex]:not([tabindex='-1'])")].filter((x) => (!x.hasAttribute("disabled") && x.offsetParent !== null) || x === document.activeElement);
    if (!foc.length) return;
    const pri = foc[0], ult = foc[foc.length - 1];
    if (e.shiftKey && document.activeElement === pri) { e.preventDefault(); ult.focus(); }
    else if (!e.shiftKey && document.activeElement === ult) { e.preventDefault(); pri.focus(); }
  });
  return el;
}

const banner = (o: OpcoesCko) => `
    <div class="cko-banner" data-testid="cko-banner">
      <div class="cko-b-txt">
        <span class="cko-b-sobre">ACESSO VITALÍCIO</span>
        <h2 class="cko-b-tit" id="cko-tit">Um app pra <em>vida inteira.</em></h2>
        <p class="cko-b-preco"><b>${esc(o.precoTxt)}</b><span>uma vez só</span></p>
        <p class="cko-b-lojas" aria-label="Na App Store e na Google Play"><span>${ICO_APPLE}App Store</span><span>${ICO_PLAY}Google Play</span></p>
      </div>
      <div class="cko-b-fone"><span class="cko-b-ilha"></span><img src="${BANNER_CKO}" width="300" height="317" alt="Tela do app CORE" decoding="async" fetchpriority="low" /></div>
    </div>`;
const rodape = () => `
    <div class="cko-rodape" data-testid="cko-rodape">${RODAPE_ASAAS ? `<p>${ICO_CADEADO}Pagamento processado pelo Asaas</p>` : ""}<p>${ICO_CADEADO}CORE · CNPJ ${esc(opc!.cnpj)}</p><p>contato@coreaplicativo.com.br</p></div>`;

function htmlForm(o: OpcoesCko): string {
  return `${banner(o)}
    ${o.aviso ? `<p class="cko-aviso" role="status" data-testid="cko-aviso">${esc(o.aviso)}</p>` : ""}
    ${o.pedeEmail ? `<label class="cko-rot" for="cko-email">Seu e-mail <span>· é por onde você entra no CORE</span></label>
    <input class="cko-campo" id="cko-email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="go" maxlength="254" placeholder="voce@email.com" value="${esc(emailMemo)}" />
    <button type="button" class="cko-sug" id="cko-sug" hidden></button>
    <p class="cko-erro" id="cko-email-erro" role="alert" hidden></p>` : ""}
    <div class="cko-pix" data-testid="cko-pix">${ICO_PIX}<p><b>Pix copia e cola.</b> Você copia o código e paga no app do seu banco.</p></div>
    <p class="cko-erro" id="cko-erro" role="alert" hidden></p>
    <button type="button" class="cko-cta" id="cko-gerar">${ICO_PIX}<span>Gerar Pix de ${esc(o.precoTxt)}</span></button>
    <p class="cko-depois">${ICO_CELULAR}<span>Depois, baixe o CORE e entre com ${o.pedeEmail ? "este" : "o seu"} e-mail.</span></p>
    <p class="cko-garantia">${ICO_ESCUDO}<span><b>Garantia de 7 dias:</b> devolvemos 100% no Pix.</span></p>
    <details class="cko-duvidas" data-testid="cko-duvidas"><summary>Dúvidas: <span>é mensal? é app de verdade?</span>${ICO_SETA}</summary><div class="cko-dlista">${duvidas(o).map((d) => `<details data-duvida="${d.qual}"><summary>${d.p}</summary><p>${d.r}</p></details>`).join("")}</div></details>
    ${rodape()}`;
}

/** a tela do formulário. `erroGeral` = o erro de gerar o Pix de hoje ("Não consegui gerar o Pix agora…"), colado acima do botão */
export function mostrarFormulario(erroGeral: string | null = null): void {
  if (!raiz || !opc) return;
  const corpo = raiz.querySelector<HTMLElement>("#cko-in")!;
  if (tela !== "form") {
    tela = "form";
    corpo.innerHTML = htmlForm(opc);
    ligarForm(corpo);
  }
  const e = corpo.querySelector<HTMLElement>("#cko-erro");
  if (e) { e.textContent = erroGeral ?? ""; e.hidden = !erroGeral; }
}
/** o código de 8 números (e-mail que já tem conta): o MESMO HTML do cartão de hoje; a landing liga os toques depois */
export function mostrarCodigo(html: string): void {
  if (!raiz || !opc) return;
  tela = "codigo";
  raiz.querySelector<HTMLElement>("#cko-in")!.innerHTML = `${banner(opc)}<div class="cko-passo">${html}</div>${rodape()}`;
  medirBanner();
  vigiarRodape();
}
/** "Gerando o seu Pix…": o MESMO HTML do cartão de hoje */
export function mostrarGerando(html: string): void {
  if (!raiz || !opc) return;
  if (tela === "gerando") return;
  tela = "gerando";
  raiz.querySelector<HTMLElement>("#cko-in")!.innerHTML = `${banner(opc)}<div class="cko-passo" data-testid="cko-gerando">${html}</div>${rodape()}`;
  medirBanner();
  vigiarRodape();
}
/** a landing apagou o campo ("Usar outro e-mail") */
export function definirEmail(v: string): void { emailMemo = v; }

function ligarForm(corpo: HTMLElement) {
  const campo = corpo.querySelector<HTMLInputElement>("#cko-email");
  const sug = corpo.querySelector<HTMLButtonElement>("#cko-sug");
  if (campo) campo.addEventListener("input", () => {
    emailMemo = campo.value;
    if (campo.value) emailDigitado = true;
    if (!emailComecou && campo.value) { emailComecou = true; opc?.evento("landing_cko_email_comecou", {}); }
  });
  opc?.aoMontarForm(campo, sug);
  corpo.querySelector("#cko-gerar")!.addEventListener("click", () => { if (campo) emailMemo = campo.value; opc?.aoGerar(); });
  ligarDuvidas(corpo);
  medirBanner();
  vigiarRodape();
}

/** a lista "Dúvidas": na 1ª vez que abre, "mensal" e "app" já abrem respondidas e o corpo rola até elas (como no v2 da /oferta) */
function ligarDuvidas(alvo: HTMLElement) {
  const lista = alvo.querySelector<HTMLDetailsElement>(".cko-duvidas");
  if (!lista) return;
  const sozinhas = new WeakSet<HTMLDetailsElement>();
  let jaAbriu = false;
  lista.addEventListener("toggle", (e) => {
    if (e.target !== lista) return;
    if (lista.open && !jaAbriu) {
      jaAbriu = true;
      const abertas = DUVIDAS_JA_ABERTAS.map((q) => lista.querySelector<HTMLDetailsElement>(`details[data-duvida="${q}"]`)).filter((d): d is HTMLDetailsElement => !!d);
      for (const d of abertas) if (!d.open) { sozinhas.add(d); d.open = true; }
      const corpo = raiz?.querySelector<HTMLElement>(".cko-corpo"), rotulo = lista.querySelector<HTMLElement>("summary"), ultima = abertas[abertas.length - 1];
      if (corpo && rotulo && ultima) {
        const c = corpo.getBoundingClientRect();
        const px = Math.min(ultima.getBoundingClientRect().bottom - (c.bottom - 8), rotulo.getBoundingClientRect().top - (c.top + 8));
        if (px > 0) rolarCorpo(corpo, px);
      }
    }
    if (lista.open === duvidasAberto) return;
    duvidasAberto = lista.open;
    opc?.evento("landing_cko_duvidas", { aberto: lista.open });
  });
  lista.querySelectorAll<HTMLDetailsElement>("details[data-duvida]").forEach((d) => d.addEventListener("toggle", () => {
    const qual = d.dataset.duvida!;
    if (!d.open) { sozinhas.delete(d); return; }
    if (sozinhas.has(d) || duvidasVistas.has(qual)) return;
    duvidasVistas.add(qual);
    opc?.evento("landing_cko_duvida", { qual });
  }));
}
function rolarCorpo(corpo: HTMLElement, px: number) {
  let calmo = false; try { calmo = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { /* sem matchMedia */ }
  try { corpo.scrollBy({ top: Math.ceil(px), behavior: calmo ? "auto" : "smooth" }); } catch { corpo.scrollTop += Math.ceil(px); }
}

/** a 1ª linha do rodapé ficou ≥ 50% visível no corpo — 1× por abertura */
function vigiarRodape() {
  obsRodape?.disconnect(); obsRodape = null;
  if (rodapeVisto || typeof IntersectionObserver === "undefined") return;
  const corpo = raiz?.querySelector<HTMLElement>(".cko-corpo"), linha = raiz?.querySelector<HTMLElement>(".cko-rodape p");
  if (!corpo || !linha) return;
  const obs = new IntersectionObserver((ens) => {
    if (rodapeVisto || !aberta || !ens.some((e) => e.isIntersecting && (e.intersectionRatio ?? 1) >= 0.5)) return;
    rodapeVisto = true;
    obs.disconnect(); if (obsRodape === obs) obsRodape = null;
    opc?.evento("landing_cko_rodape_visto", { s_aberto: Math.round((Date.now() - abertoEm) / 1000), rolou: corpo.scrollTop > 0 });
  }, { root: corpo, threshold: 0.5 });
  obs.observe(linha);
  obsRodape = obs;
}

/** o print do banner chegou? (1× por abertura) O texto nunca depende dele: falhou, some a imagem e fica a moldura */
function medirBanner() {
  const img = raiz?.querySelector<HTMLImageElement>(".cko-b-fone img");
  if (!img) return;
  img.addEventListener("error", () => { img.hidden = true; });
  if (bannerMedido) return;
  const desde = abertoEm || Date.now();
  if (img.complete && img.naturalWidth > 0) { bannerMedido = true; opc?.evento("landing_cko_banner_imagem", { estado: "pronta_ao_abrir", ms: 0 }); return; }
  const fim = (estado: string) => { if (bannerMedido || !aberta) return; bannerMedido = true; opc?.evento("landing_cko_banner_imagem", { estado, ms: Math.max(0, Date.now() - desde) }); };
  img.addEventListener("load", () => fim("pronta"), { once: true });
  img.addEventListener("error", () => fim("falhou"), { once: true });
}

/** o print do banner em segundo plano (a landing chama no ocioso, depois do pixel e do load, só com a camada valendo) */
export function preaquecerBannerCko(): void {
  try { const i = new Image(); (i as HTMLImageElement & { fetchPriority?: string }).fetchPriority = "low"; i.decoding = "async"; i.src = BANNER_CKO; } catch { /* sem Image */ }
}

/* ───────────────────────── abrir / fechar ───────────────────────── */
const marcaDoHist = (): boolean => { try { const s = history.state as { ckoOrg?: number } | null; return !!(s && typeof s === "object" && s.ckoOrg); } catch { return false; } };
const aoPop = () => {
  if (pularPop > 0) { pularPop -= 1; devolverRestauracao(); return; }
  if (!aberta) { devolverRestauracao(); return; }
  if (marcaDoHist()) return; // ainda na entrada da camada
  const via = fechandoPelaTela ?? "voltar";
  if (!fechandoPelaTela) evento("landing_cko_fechado", dadosFechado("voltar"));
  comHistorico = false;
  fecharJa(via);
  devolverRestauracao();
};
const aoVisibilidade = () => {
  if (document.visibilityState !== "hidden" || !aberta || saiuNestaAbertura) return;
  saiuNestaAbertura = true;
  evento("landing_cko_saiu", { fase: tela, s_aberto: Math.round((Date.now() - abertoEm) / 1000), email_digitado: emailDigitado });
};
const evento: Evento = (n, d) => opc?.evento(n, d);
const dadosFechado = (via: string) => ({ via, fase: tela, s_aberto: Math.round((Date.now() - abertoEm) / 1000), email_digitado: emailDigitado });

/** a rolagem do navegador volta a ser a dele 400 ms DEPOIS do popstate da entrada da camada (antes disso ele jogaria a página no y velho) */
function devolverRestauracao() {
  if (timerRestauracao !== null) window.clearTimeout(timerRestauracao);
  timerRestauracao = window.setTimeout(() => {
    timerRestauracao = null;
    if (!aberta && pularPop === 0 && restauracaoAntes !== null) { try { history.scrollRestoration = restauracaoAntes; } catch { /* noop */ } restauracaoAntes = null; }
  }, 400);
}

export function abrirCko(o: OpcoesCko): void {
  if (aberta) return;
  opc = o;
  if (!raiz || !document.body.contains(raiz)) raiz = montar();
  focoAntes = document.activeElement as HTMLElement | null;
  if (!emailMemo) emailMemo = o.emailInicial; // fechou e reabriu: o que ela digitou continua lá
  emailDigitado = !!emailMemo;
  duvidasVistas = new Set(); duvidasAberto = false; rodapeVisto = false; bannerMedido = false; saiuNestaAbertura = false;
  tela = null;
  aberta = true;
  abertoEm = Date.now();
  try { if (restauracaoAntes === null) restauracaoAntes = history.scrollRestoration; history.scrollRestoration = "manual"; } catch { /* noop */ }
  if (timerRestauracao !== null) { window.clearTimeout(timerRestauracao); timerRestauracao = null; }
  travar();
  raiz.hidden = false;
  raiz.querySelector<HTMLElement>(".cko-corpo")!.scrollTop = 0;
  try { history.pushState({ ckoOrg: 1 }, ""); comHistorico = true; } catch { comHistorico = false; }
  window.addEventListener("popstate", aoPop);
  document.addEventListener("visibilitychange", aoVisibilidade);
  mostrarFormulario(null);
  o.evento("landing_cko_aberto", { de: o.de, vez: o.vez, email_pre: !!emailMemo, aviso_vencido: !!o.aviso, ms: o.ms });
  window.setTimeout(() => { if (aberta) raiz?.querySelector<HTMLElement>("#cko-email, #cko-gerar")?.focus({ preventScroll: true }); }, 30);
}

/** X / Esc: fecha pelo histórico (o "voltar" do navegador também fecha, sem sair do site) */
function pedirFechar(via: string) {
  if (!aberta || fechandoPelaTela) return;
  evento("landing_cko_fechado", dadosFechado(via));
  fechandoPelaTela = via;
  if (comHistorico && marcaDoHist()) {
    try {
      history.back();
      // reserva: um navegador que não devolve o popstate não prende ninguém na camada
      reservaFechar = window.setTimeout(() => { reservaFechar = null; if (aberta) { pularPop += 1; fecharJa(via); } }, 700);
      return;
    } catch { /* cai no fechar direto */ }
  }
  fecharJa(via);
}

/** a landing fecha (o QR ficou pronto, "já tem", pago): JÁ, sem esperar o histórico; a entrada da camada sai do histórico por baixo */
export function fecharCko(via: string): void {
  if (!aberta) return;
  evento("landing_cko_fechado", dadosFechado(via));
  if (comHistorico && marcaDoHist()) { pularPop += 1; try { history.back(); } catch { pularPop -= 1; } }
  comHistorico = false;
  fecharJa(via);
}

function fecharJa(via: string) {
  if (!aberta) return;
  const t = tela;
  aberta = false;
  fechandoPelaTela = null;
  if (reservaFechar !== null) { window.clearTimeout(reservaFechar); reservaFechar = null; }
  document.removeEventListener("visibilitychange", aoVisibilidade);
  obsRodape?.disconnect(); obsRodape = null;
  if (raiz) raiz.hidden = true;
  soltar();
  try { focoAntes?.focus?.({ preventScroll: true }); } catch { /* noop */ }
  if (pularPop === 0) devolverRestauracao();
  opc?.aoFechar(via, t);
}

/** testes: zera o módulo entre páginas */
export function _zerar(): void {
  if (reservaFechar !== null) window.clearTimeout(reservaFechar);
  if (timerRestauracao !== null) window.clearTimeout(timerRestauracao);
  window.removeEventListener("popstate", aoPop);
  document.removeEventListener("visibilitychange", aoVisibilidade);
  obsRodape?.disconnect();
  raiz?.remove(); raiz = null; opc = null; aberta = false; tela = null; comHistorico = false; fechandoPelaTela = null; reservaFechar = null; pularPop = 0;
  restauracaoAntes = null; timerRestauracao = null; emailMemo = ""; emailDigitado = false; emailComecou = false; obsRodape = null;
  document.getElementById("cko-estilo")?.remove();
}
