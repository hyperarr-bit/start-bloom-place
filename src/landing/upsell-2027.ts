/**
 * "SEU 2027 ORGANIZADO" NO PÓS-PAGO DA /organizar (31/10, PLANO.md §A — novidades-guardadas/2026-10-31/upsell-2027-presente).
 * Só baixa com a chave ligada (html[data-u2027="on"]) ou pelo link do e-mail (?r=u2027). HTML puro dentro do cartão
 * (#lp-pix), no mesmo padrão das fases da landing, com o PRÓPRIO <style> (o 1º <style> do landing.html não muda: o
 * braço "atual" é comparado linha a linha com a página de 30/10).
 *
 *   oferta   "✓ Pagamento confirmado" · "Seu 2027 já organizado" · R$ 14,90 · uma vez, sem mensalidade ·
 *            "Quero · copiar o Pix" · "Agora não" (→ conta pronta, SEM o plano de 30 dias: 0 em 39).
 *            O Pix já está sendo gerado ao mostrar a oferta (pré-aquecido; o MESMO do e-mail, 24 h).
 *   qr       o toque copia o código (ClipboardItem com a promessa do Pix pré-aquecido) → QR + código + "Pagou? Volte aqui.
 *            Esta tela confirma sozinha." · confere a cada 3 s e na volta da aba (asaas-pix check, SEM pixel).
 *   pronto   "Pronto, seu 2027 tá no seu CORE" · os 4 ✓ · onde fica · Continuar → conta pronta (com as lojas).
 *   fim      a landing mostra a conta pronta de sempre.
 * Sem Purchase pra Meta em nenhum passo (decisão do dono: _shared/pix-upsell.ts META_PURCHASE_UPSELL).
 *
 * Eventos (todos com braco_lp/braco_checkout pelo `evento` da landing + order_id = a compra do vitalício):
 *   landing_u2027_view · _quero · _nao {de} · _pix_pronto {ms, ok, motivo?} · _copiado {ok, via} · _pago · _continuar ·
 *   _volta_email {restaurado} · _erro {onde}
 */
import { VALOR_U2027, reais, validadeU2027, type EstadoU2027, type PixU2027 } from "./regras";
import { gravarEstadoU2027, lerEstadoU2027 } from "./u2027-estado";

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
  /** terminou (Agora não / Continuar): a landing volta pra conta pronta */
  aoTerminar: () => void;
  /** a tela do cartão mudou (a landing rola até o cartão) */
  aoMudar: () => void;
};

const ICO_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ICO_COPIAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

/** O que veio — SÓ o que o app faz de verdade (src/lib/pacote-2027.ts; os mesmos 4 do Fluxo2027). */
export const ITENS_U2027 = ["Planejar 2027 em 5 minutos", "12 revisões do mês", "Cofrinho das 52 semanas", "Planner 2027 pra imprimir"] as const;

/* o estilo próprio (1x por página). Escopado em .u27 — nada vaza pro resto da landing. */
const CSS = `
/* a faixa do cartão do vitalício ("OFERTA ESPECIAL · HOJE" no atual) não fica em cima do 2027: nada de "hoje" no upsell */
.lp-card[data-u27] .lp-card-faixa { display: none; }
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
.u27-nota { margin: 12px 0 0; font-size: 12.5px; line-height: 1.4; color: var(--fraco, #9a95a0); text-align: center; }
.u27-copiado { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border-radius: 14px; background: var(--verde-suave, #ecfdf3); color: #14532d; font-size: 14px; line-height: 1.35; }
.u27-copiado svg { width: 22px; height: 22px; flex-shrink: 0; padding: 4px; border-radius: 50%; background: var(--verde, #16a34a); color: #fff; }
.u27-copiado b { display: block; font-size: 15.5px; }
.u27-copiado.falta { background: var(--papel, #f7f5f8); color: var(--tx, #1c1a1f); }
.u27-copiado.falta svg { background: var(--grafite, #262626); }
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
  /** dev/testes: confirma o Pix simulado */
  simularPago: () => void;
  etapa: () => EstadoU2027["etapa"];
  /** pra parar o relógio/conferência (outra página do mesmo documento — testes) */
  parar: () => void;
};

export function criarUpsell2027(compra: string, ctx: CtxU2027): Upsell2027 {
  garantirCss();
  let e: EstadoU2027 = lerEstadoU2027(compra);
  let promessa: Promise<GeradoU2027> | null = null;
  let tPre = 0;
  let copiado: boolean | null = null;
  let gerando = false;
  let erro: string | null = null;
  let aviso: string | null = null;
  let comEmail = false;
  let loop: number | null = null;
  let relogio: number | null = null;
  let vistaOferta = false;
  let conferindo = false;
  const base = () => ({ order_id: compra, pedido_u2027: e.pix?.orderId ?? null });
  const ev = (nome: string, d: Record<string, unknown> = {}) => ctx.evento(nome, { ...base(), ...d });

  const salvar = (novo: Partial<EstadoU2027>) => {
    const antes = e.etapa;
    e = { ...e, ...novo, salvoEm: Date.now() };
    gravarEstadoU2027(e);
    if (e.etapa === "fim") { parar(); ctx.card.removeAttribute("data-u27"); ctx.aoTerminar(); return; }
    render();
    if (antes !== e.etapa) ctx.aoMudar();
  };

  function preaquecer() {
    if (promessa || e.etapa === "fim" || e.etapa === "pronto") return;
    if (e.pix && Date.parse(e.pix.expiresAt) - Date.now() > 60_000) { promessa = Promise.resolve(e.pix); return; }
    tPre = Date.now();
    const p = ctx.api.gerar(compra).catch((x): GeradoU2027 => ({ erro: "Não consegui gerar o Pix agora. Tenta de novo em alguns segundos.", onde: String(x).slice(0, 120) }));
    promessa = p;
    void p.then((r) => {
      const ok = "qrCode" in r;
      ev("landing_u2027_pix_pronto", { ms: Date.now() - tPre, ok, ...(ok ? {} : { motivo: "jaTem2027" in r ? "ja_tem" : r.onde }) });
      if ("qrCode" in r) { comEmail = !!r.comEmail; if (!e.pix || e.pix.orderId !== r.orderId) { e = { ...e, pix: { orderId: r.orderId, qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64, expiresAt: r.expiresAt, donoIgual: r.donoIgual } }; gravarEstadoU2027(e); } }
      else { promessa = null; } // falhou: o toque em "Quero" tenta de novo (lá mesmo)
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
    if ("erro" in r) {
      void copia.catch(() => null);
      erro = r.erro; promessa = null;
      ev("landing_u2027_erro", { onde: "pix_create", msg: r.onde });
      render(); return;
    }
    const c = await copia;
    copiado = c.ok;
    ev("landing_u2027_copiado", { ok: c.ok, via: c.via, auto: true });
    salvar({ etapa: "qr", pix: { orderId: r.orderId, qrCode: r.qrCode, qrCodeBase64: r.qrCodeBase64, expiresAt: r.expiresAt, donoIgual: r.donoIgual } });
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
  function conferirEmLoop() {
    if (loop) window.clearTimeout(loop);
    if (ctx.api.simulado) return;
    const passo = async () => {
      if (e.etapa !== "qr") return;
      await conferirUmaVez();
      if (e.etapa === "qr") loop = window.setTimeout(passo, 3000);
    };
    loop = window.setTimeout(passo, 3000);
  }
  const aoVoltar = () => { if (document.visibilityState === "visible" && e.etapa === "qr") void conferirUmaVez(); };
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
      aviso = e.pix?.donoIgual === false || e.pix?.doEmail
        ? "Quando o pagamento cair, o 2027 entra na sua conta e a gente avisa por e-mail."
        : "Ainda não chegou. Confere no app do banco: quando cair, esta tela muda sozinha.";
      render();
    }
  }

  /* ───────── as telas ───────── */
  function render(): boolean {
    if (relogio) { window.clearInterval(relogio); relogio = null; }
    if (e.etapa === "fim") { ctx.card.removeAttribute("data-u27"); return false; }
    ctx.card.dataset.fase = "conta"; // o CSS esconde a oferta do vitalício (qualquer fase ≠ "oferta")
    ctx.card.setAttribute("data-u27", "");
    const c = ctx.caixa;
    if (e.etapa === "oferta") {
      if (!vistaOferta) { vistaOferta = true; ev("landing_u2027_view"); }
      preaquecer();
      c.innerHTML = `
      <div class="u27" data-testid="u2027-oferta">
        <div class="u27-ok">${ICO_CHECK}<span>Pagamento confirmado</span></div>
        <div class="u27-sep"></div>
        <div class="u27-kicker">Quer ir além?</div>
        <h3>Seu 2027 já organizado</h3>
        <p class="u27-desc">3 metas, orçamento do ano, 12 revisões do mês e o cofrinho de 52 semanas.</p>
        <div class="u27-preco"><b data-testid="u2027-preco">${reais(VALOR_U2027)}</b><span>uma vez, sem mensalidade</span></div>
        ${gerando
          ? '<button type="button" class="lp-cta" id="u27-quero" disabled><i class="lp-gira"></i>Gerando o Pix…</button>'
          : '<button type="button" class="lp-cta" id="u27-quero">Quero · copiar o Pix</button>'}
        ${erro ? `<p class="lp-erro" role="alert">${esc(erro)}</p>` : ""}
        <div class="lp-links"><button type="button" class="lp-link" id="u27-nao">Agora não</button></div>
        <p class="u27-nota">É separado do CORE que você já pagou. Fica no app e no site.</p>
      </div>`;
      c.querySelector<HTMLButtonElement>("#u27-quero")!.addEventListener("click", () => { void quero(); });
      c.querySelector<HTMLButtonElement>("#u27-nao")!.addEventListener("click", () => { ev("landing_u2027_nao", { de: "oferta" }); salvar({ etapa: "fim" }); });
      return true;
    }
    if (e.etapa === "qr" && e.pix) {
      const p = e.pix;
      const fora = p.donoIgual === false || !!p.doEmail;
      const resta = () => Date.parse(p.expiresAt) - Date.now();
      c.innerHTML = `
      <div class="u27" data-testid="u2027-qr">
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
      </div>`;
      void ctx.desenharQr(c.querySelector<HTMLElement>("#u27-qr-img")!, p);
      c.querySelector<HTMLButtonElement>("#u27-copiar")!.addEventListener("click", async () => {
        const ok = await ctx.copiarTexto(p.qrCode);
        ev("landing_u2027_copiado", { ok, via: "botao", auto: false });
        if (ok && !copiado) { copiado = true; render(); return; }
        const rot = c.querySelector<HTMLElement>("#u27-copiar span");
        if (ok && rot) { rot.textContent = "Copiado ✓"; window.setTimeout(() => { if (rot.isConnected) rot.textContent = "Copiar de novo"; }, 1500); }
      });
      c.querySelector<HTMLButtonElement>("#u27-ja-paguei")!.addEventListener("click", () => { void jaPaguei(); });
      c.querySelector<HTMLButtonElement>("#u27-sair")!.addEventListener("click", () => { ev("landing_u2027_nao", { de: "qr" }); salvar({ etapa: "fim" }); });
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
      c.innerHTML = `
      <div class="lp-pago u27 u27-pronto" data-testid="u2027-pronto">
        <div class="lp-pago-check">${ICO_CHECK}</div>
        <h3>Pronto, seu 2027 tá no seu CORE</h3>
        <ul class="u27-lista">${ITENS_U2027.map((t) => `<li>${ICO_CHECK}<span>${t}</span></li>`).join("")}</ul>
        <div class="u27-onde" data-testid="u2027-onde">No app e no site: <b>Dev. Pessoal → Seu 2027</b>.${email ? ` Entre com <b>${esc(email)}</b>.` : ""}</div>
        <div class="lp-form"><button type="button" class="lp-cta" id="u27-continuar">Continuar</button></div>
      </div>`;
      c.querySelector<HTMLButtonElement>("#u27-continuar")!.addEventListener("click", () => { ev("landing_u2027_continuar"); salvar({ etapa: "fim" }); });
      return true;
    }
    // etapa qr sem Pix (não deveria): volta pra oferta
    e = { ...e, etapa: "oferta", pix: null };
    return render();
  }

  function voltaDoEmail(pix: PixU2027 | null) {
    let restaurado = "oferta";
    if (e.etapa === "pronto") restaurado = "pronto";
    else if (e.pix && pix && e.pix.orderId === pix.orderId && e.etapa === "qr") restaurado = "aba";
    else if (pix) { restaurado = "link"; e = { ...e, etapa: "qr", pix: { ...pix, donoIgual: e.pix?.orderId === pix.orderId ? e.pix.donoIgual : false } }; gravarEstadoU2027(e); copiado = null; }
    else { e = { ...e, etapa: "oferta", pix: null }; gravarEstadoU2027(e); }
    ev("landing_u2027_volta_email", { restaurado });
  }

  if (e.etapa === "qr") conferirEmLoop();

  return {
    ativo: () => e.etapa !== "fim",
    render,
    preaquecer,
    voltaDoEmail,
    simularPago: () => { if (e.etapa === "qr") pago(); },
    etapa: () => e.etapa,
    parar: () => { parar(); document.removeEventListener("visibilitychange", aoVoltar); window.removeEventListener("pageshow", aoVoltar); },
  };
}
