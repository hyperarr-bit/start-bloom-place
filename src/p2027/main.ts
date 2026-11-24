/**
 * /2027 (23/11) — a página do carrossel 2027. A página e o pagamento na MESMA rolagem: o checkout Stripe compartilhado
 * (src/landing/stripe-checkout.ts, layout "cartao", montarEm) entra DENTRO do cartão do preço, no lugar do esqueleto que já está no
 * HTML com o mesmo desenho (a página não pula). O PaymentIntent só nasce pra quem chega perto do cartão (~700 px antes), toca na
 * barra fixa / no botão do fecho, ou mexe no esqueleto; ou na hora, quando:
 *   • voltou do banco (3DS por redirecionamento: ?payment_intent=…&redirect_status=…);
 *   • a aba já tem um pedido (recarregou com o Pix gerado → o MESMO QR volta);
 * Já pagou nesta aba (6 h): no lugar do pagamento, "Você já comprou o CORE ✓" e o passo a passo de entrar no app (tela cheia),
 * como a /tudo. Depois do pago na hora: o cartão vira o pós-compra (as duas lojas, "entre com este e-mail", "não compre de novo").
 *
 * EVENTOS (todos com funil/pagina "p2027", path "/2027", sessão, aparelho, preco_centavos e utm; nenhum leva e-mail; na prévia ficam
 * só em window.__p2027Events):
 *   landing_view {}                                       a página abriu
 *   landing_section_view {section}                        1× por bloco: topo, dia, areas, contou, depois, oferta, garantia, avaliacoes, duvidas, fecho
 *   landing_oferta_vista {via}                            1×: o NÚMERO do preço apareceu inteiro na tela (via: rolou | barra_fixa | fecho)
 *   landing_checkout_click {placement, com_preco}         toque na barra fixa (placement "barra_fixa") ou no botão do fecho ("fecho")
 *   landing_topo_elo {}                                   o "Veja um dia comum com o CORE ↓" da 1ª tela
 *   landing_erro {onde}                                   p2027_checkout_load | chunk_pos_compra (+ os do checkout)
 *   do checkout: landing_stripe_aberto · _comecou · _carregou · _cartao_pronto · _email_comecou · _email_valido · _metodo {metodo, via}
 *               · _pagar {metodo} · _pagar_erro · _pix_gerado {pi} · landing_pix_copiado · _pago {metodo, pi} · _recusado · _pix_voltou
 *               · _pix_velho_pago · _recebido_sem_confirmar;  do pós-compra: pos_compra_view · _aba · _loja · _copiar_email · _navegador · _ajuda
 *               rodada 2 (só no layout "cartao"): landing_stripe_email_pergunta {} · _email_pergunta_resposta {escolha: corrigido | manteve}
 *               · landing_stripe_pix_vencido {pi} · landing_stripe_pix_velho_email {ok} (o e-mail do Pix velho trocado depois do "Voltar")
 * Pixel da Meta (só produção): PageView + ViewContent ao abrir, InitiateCheckout no 1º toque no pagamento, Purchase com eventID = id do PI.
 */
import { event, initPixel, mountPayment, bankReturn, QA, STORAGE_PREFIX } from "./payment";
import { faixaDaPrevia } from "./previa";
import "./style.css";
import "./checkout.css";

const desligada = document.documentElement.hasAttribute("data-desligada");
if (!desligada) iniciar();

function iniciar() {
  // a faixa da prévia. rodada 2 (T-BAIXA 1): ?print=1 só a esconde FORA do domínio de produção (é o modo dos prints e das medidas)
  if (faixaDaPrevia(QA, location.hostname, location.search)) {
    const s = document.createElement("div"); s.className = "p27-qa"; s.textContent = "PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA"; document.body.prepend(s);
  }
  initPixel();
  event("landing_view");

  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const barra = $("barra"), linkBarra = barra.querySelector("a") as HTMLAnchorElement;
  const topo = $("topo"), preco = $("preco"), cartao = $("cartao"), oferta = $("oferta"), fecho = $("fecho"), alvo = $("pagamento");
  const reduz = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
  let pago = false, viuPreco = false, ofertaVista = false;
  let ultimoToque: { via: string; em: number } | null = null;

  /* ───────── o pagamento dentro do cartão ───────── */
  const marcarPago = () => {
    if (pago) return;
    pago = true;
    cartao.setAttribute("data-pago", ""); oferta.setAttribute("data-pago", "");
    atualizarBarra();
  };
  // o "pago" do checkout passa por aqui: o cartão vira o pós-compra (o preço, a confiança e a avaliação saem) e a barra some
  const eventoDoCheckout = (nome: string, dados: Record<string, unknown> = {}) => { event(nome, dados); if (nome === "landing_stripe_pago") marcarPago(); };
  let metodoPedido: string | null = null;
  let montado: Promise<void> | null = null;
  const montar = (volta?: { pi: string; status: string }): Promise<void> => {
    if (montado) return montado;
    const digitado = alvo.querySelector<HTMLInputElement>("#sk-email")?.value.trim() || undefined; // o que ela digitou no esqueleto vai junto
    montado = mountPayment(alvo, { voltaDoBanco: volta, emailInicial: digitado, evento: eventoDoCheckout })
      .then(() => { if (metodoPedido === "card") alvo.querySelector<HTMLElement>("[data-metodo='card']")?.click(); })
      .catch(() => {
        montado = null; event("landing_erro", { onde: "p2027_checkout_load" });
        alvo.innerHTML = '<div class="ck-espera" role="alert"><b>O pagamento não carregou.</b><span>Confira a internet e tente de novo.</span><button type="button" class="ck-tentar">Tentar de novo</button></div>';
        alvo.querySelector("button")!.addEventListener("click", () => { void montar(); });
      });
    return montado;
  };
  // mexeu no esqueleto antes de o formulário chegar: monta já (e lembra se tocou em Cartão). O e-mail e o foco do esqueleto vão pro
  // formulário de verdade na hora da troca (payment.ts). rodada 2 (T-BAIXA 2): o "Pagar" do esqueleto responde ao toque ("Carregando…").
  const esqueleto = alvo.querySelector<HTMLElement>("[data-esqueleto]");
  if (esqueleto) {
    esqueleto.addEventListener("pointerdown", () => { void montar(); }, { once: true });
    esqueleto.addEventListener("focusin", () => { void montar(); }, { once: true });
    esqueleto.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-sk-metodo]"); if (b) metodoPedido = b.dataset.skMetodo ?? null;
      const pg = (e.target as HTMLElement).closest<HTMLElement>("[data-sk-pagar]"); if (pg) { pg.textContent = "Carregando…"; pg.setAttribute("aria-busy", "true"); void montar(); }
    });
  }
  // rodada 2 (V-M2): o pedaço do checkout esquenta no 1º gesto de rolagem (só baixa o código: não monta nada nem cria pagamento),
  // pra quem pula pela barra ou toca no esqueleto com internet lenta não perder o que digitou na troca
  window.addEventListener("scroll", () => { void import("@/landing/stripe-checkout").catch(() => { /* o montar tenta de novo e mostra o erro */ }); }, { once: true, passive: true });

  let temPedido = false; try { temPedido = !!sessionStorage.getItem(`${STORAGE_PREFIX}-stripe-ref`); } catch { /* sem storage */ }
  // a volta do banco sai da URL já (recarregar depois não repete a conferência; a compra gravada na aba cuida do resto)
  if (bankReturn) { try { const limpa = new URL(location.href); for (const k of ["payment_intent", "payment_intent_client_secret", "redirect_status"]) limpa.searchParams.delete(k); history.replaceState(history.state, "", `${limpa.pathname}${limpa.search}${limpa.hash}`); } catch { /* noop */ } }

  /** leva ao cartão com o NÚMERO do preço, o e-mail e o botão de pagar na mesma vista (o topo do cartão no alto, se couber) */
  const rolarAoCartao = () => {
    const y = window.scrollY || 0, vh = window.innerHeight;
    const c = cartao.getBoundingClientRect(), p = preco.getBoundingClientRect();
    const botao = (alvo.querySelector("#oc-pagar, [data-sk-pagar], .ja-comprou") ?? alvo).getBoundingClientRect();
    let destino = y + c.top - 8;
    const fimBotao = y + botao.bottom + 12;
    if (fimBotao - destino > vh) destino = Math.min(y + p.top - 8, fimBotao - vh);
    if (pago) destino = y + c.top - 8;
    try { window.scrollTo({ top: Math.max(0, Math.round(destino)), behavior: reduz ? "auto" : "smooth" }); } catch { window.scrollTo(0, Math.max(0, Math.round(destino))); }
  };

  const ligarFormulario = () => {
    if (bankReturn) { void montar(bankReturn).then(rolarAoCartao); return; }
    if (temPedido) { void montar(); return; }
    if ("IntersectionObserver" in window) {
      const perto = new IntersectionObserver((entradas) => { if (entradas.some((e) => e.isIntersecting)) { perto.disconnect(); void montar(); } }, { rootMargin: "700px 0px" });
      perto.observe(alvo);
    } else void montar();
  };

  // já pagou nesta aba (6 h): nada de formulário novo nem PaymentIntent — "Você já comprou" e o passo a passo de entrar no app
  let comprou = false; try { comprou = !!sessionStorage.getItem("oferta-pos-compra"); } catch { /* sem storage */ }
  if (!comprou) ligarFormulario();
  else void import("@/landing/pos-compra-app").then((m) => {
    const c = m.lerCompraPos();
    if (!c || (bankReturn && c.pi !== bankReturn.pi)) { comprou = false; ligarFormulario(); return; }
    marcarPago();
    const ctx = { ...c, evento: event };
    alvo.innerHTML = '<div class="ja-comprou" data-testid="p2027-ja-comprou"><b>Você já comprou o CORE ✓</b><span>Seu acesso é vitalício. Agora é só entrar no app com o seu e-mail.</span><button type="button">Ver como entrar no app</button></div>';
    alvo.querySelector("button")!.addEventListener("click", () => m.abrirPosCompraTelaCheia(ctx, "ja_comprou"));
    if (!document.querySelector("[data-testid='pos-compra']")) m.abrirPosCompraTelaCheia(ctx, bankReturn ? "volta_banco" : "recarga");
  }, () => { event("landing_erro", { onde: "chunk_pos_compra" }); comprou = false; ligarFormulario(); });

  /* ───────── a barra fixa ───────── */
  function atualizarBarra() {
    const vh = window.innerHeight;
    // rodada 2 (V-M3): só depois da 1ª tela — o bloco do topo saiu INTEIRO da tela (antes: ligava com o fim do topo a 55% da tela)
    const passouTopo = topo.getBoundingClientRect().bottom <= 0;
    const p = preco.getBoundingClientRect();
    // "viu o preço" = o número inteiro na tela, acima de onde a barra fica (só então a barra pode mostrar o valor)
    if (!viuPreco && !pago && p.height > 0 && p.top >= 0 && p.bottom <= vh - 80) {
      viuPreco = true;
      const via = ultimoToque && Date.now() - ultimoToque.em < 2500 ? ultimoToque.via : "rolou";
      if (!ofertaVista) { ofertaVista = true; event("landing_oferta_vista", { via }); }
    }
    const c = cartao.getBoundingClientRect();
    const cartaoNaTela = c.top < vh - 60 && c.bottom > 60;
    const noFim = fecho.getBoundingClientRect().top < vh; // do fecho pra baixo: o botão do fecho já está ali
    const on = passouTopo && !cartaoNaTela && !noFim && !pago;
    barra.classList.toggle("on", on);
    barra.setAttribute("aria-hidden", on ? "false" : "true");
    linkBarra.tabIndex = on ? 0 : -1;
    barra.classList.toggle("com-preco", viuPreco);
  }
  let pedido = 0;
  const agendar = () => { if (pedido) return; pedido = requestAnimationFrame(() => { pedido = 0; atualizarBarra(); }); };
  window.addEventListener("scroll", agendar, { passive: true });
  window.addEventListener("resize", agendar);
  atualizarBarra();

  for (const a of document.querySelectorAll<HTMLAnchorElement>("[data-ir]")) {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const placement = a.dataset.ir ?? "outro";
      event("landing_checkout_click", { placement, com_preco: viuPreco });
      ultimoToque = { via: placement, em: Date.now() };
      if (!pago && !comprou) void montar();
      rolarAoCartao();
    });
  }
  document.querySelector("[data-elo]")?.addEventListener("click", () => event("landing_topo_elo", {}));

  /* ───────── teclado aberto: o e-mail e o botão de pagar na parte que sobra da tela ─────────
     Só em tela de toque. Se o botão ficou escondido atrás do teclado, a página sobe o que falta (sem passar o campo de e-mail do topo
     da parte visível). Nada de foco forçado: só reage ao toque dela no campo.
     rodada 2 (V-M1): a conta é refeita a cada mudança de tamanho da parte visível (visualViewport e janela) enquanto o e-mail tem foco
     — o teclado que sobe DEPOIS dos 350 ms (iPhone e Android barato avisam no fim da animação) também é coberto. */
  const toque = (() => { try { return matchMedia("(pointer: coarse)").matches; } catch { return false; } })();
  const ajustarAoTeclado = (campo: HTMLInputElement) => {
    const botao = alvo.querySelector<HTMLElement>("#oc-pagar");
    if (!botao || document.activeElement !== campo) return;
    const vv = window.visualViewport;
    const topoVisivel = vv ? vv.offsetTop : 0, fimVisivel = topoVisivel + (vv ? vv.height : window.innerHeight);
    const falta = botao.getBoundingClientRect().bottom + 12 - fimVisivel;
    const folga = campo.getBoundingClientRect().top - (topoVisivel + 8);
    const passo = Math.min(falta, folga);
    if (passo > 4) { try { window.scrollBy({ top: Math.round(passo), behavior: reduz ? "auto" : "smooth" }); } catch { window.scrollBy(0, Math.round(passo)); } }
  };
  if (toque) alvo.addEventListener("focusin", (e) => {
    const campo = e.target;
    if (!(campo instanceof HTMLInputElement) || campo.type !== "email") return;
    let espera = 0;
    const deNovo = () => { window.clearTimeout(espera); espera = window.setTimeout(() => ajustarAoTeclado(campo), 80); };
    const vv = window.visualViewport;
    window.setTimeout(() => ajustarAoTeclado(campo), 350);
    vv?.addEventListener("resize", deNovo); window.addEventListener("resize", deNovo);
    campo.addEventListener("blur", () => { window.clearTimeout(espera); vv?.removeEventListener("resize", deNovo); window.removeEventListener("resize", deNovo); }, { once: true });
  });

  /* ───────── bloco visto (1× cada) ───────── */
  if ("IntersectionObserver" in window) {
    const visto = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { event("landing_section_view", { section: (e.target as HTMLElement).dataset.secao || e.target.id }); visto.unobserve(e.target); }
    }, { threshold: 0, rootMargin: "0px 0px -35% 0px" });
    for (const s of document.querySelectorAll("[data-secao]")) visto.observe(s);
  }
}
