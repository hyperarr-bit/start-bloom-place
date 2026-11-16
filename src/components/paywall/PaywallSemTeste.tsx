/**
 * PAYWALL SEM TESTE GRÁTIS (12/11, 1.0.26 iPhone / Android 138) — chave `paywall_teste` off (padrão, lib/paywall-teste).
 * Com a chave "on" esta tela não aparece: volta o fluxo de hoje com o teste de 3 dias, intacto.
 *
 * A ESTRUTURA é a do paywall da Enxovaly (prints do dono, 12/11), com a identidade do CORE (grafite + magenta + Inter):
 *   1. foto grande no topo (print REAL do app num iPhone — public/paywall-sem-teste-foto.jpg; 12/11 noite: a foto antiga mostrava
 *      "Outubro de 2026" e saiu) com degradê pro fundo;
 *      botão Voltar redondo por cima (só no funil e no /planos);
 *   2. título grande ("Libere o CORE completo"; o braço "com" do teste de título troca pelo da área, lib/titulo-paywall);
 *   3. subtítulo de 1 linha;
 *   4. "Incluso na assinatura" + 4 itens com ✓ em círculo (os 4 do ValueStack da área, os mesmos do paywall de hoje);
 *   5. card do anual MARCADO, com a faixa "ECONOMIZE N%. MELHOR VALOR" (N dos preços da loja; reserva 77);
 *   6. card do mensal;
 *   7. botão "Assinar plano anual" / "Assinar plano mensal";
 *   8. "Você paga R$ 97,90 hoje. Renovação anual automática. Cancele quando quiser.";
 *   9. Restaurar compras · Termos · Privacidade.
 * Preços SEMPRE da loja (priceString de core_anual_97_direto / core_mensal_34); o texto fixo é só reserva.
 * 12/11 noite (dono): SÓ no iPhone, e é o braço "enxovaly" do A/B `paywall_visual` (o outro é o PaywallW semTeste).
 *
 * SAÍDA: fechou o paywall (Voltar redondo, Voltar do Android = `core:voltar`, fechar no /planos) ou cancelou a folha
 * da loja → o PRESENTE de 69,90/ano SEM teste (core_anual_69_direto, paga na hora), 1x por paywall aberto. Sem o
 * produto na loja, nada aparece (nunca botão morto). "Agora não" devolve o paywall; o próximo Voltar recua.
 *
 * Três molduras (`modo`): "funil" (passo offer do ComecarW, iPhone e Android), "gate" (conta logada sem acesso no
 * TrialBanner — sem Voltar, com "Entrar com outra conta" e "Excluir conta") e "planos" (o "Ver planos" do /planos).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Loader2 } from "lucide-react";
import { trackEvent, trackEventBeacon } from "@/lib/analytics";
import type { AreaKey } from "@/lib/funnel";
import { ehApple, erroFolhaNaoConcluiu, erroJaAtivo, erroNaoPermitido } from "@/lib/loja";
import { useAuth } from "@/hooks/use-auth";
import { JaPagouPeloSite } from "@/components/app/JaPagouPeloSite";
import { DeleteAccountDialog } from "@/components/account/DeleteAccountDialog";
import { CaixaDePresente } from "@/components/paywall/CaixaDePresente";
import { STACKS } from "@/pages/funis/dia14/stacks";
import { bracoTitulo, guardarForcaTitulo, tituloDaArea } from "@/lib/titulo-paywall";
import { PRECOS_RESERVA_SEM_TESTE, PRODUTOS_SEM_TESTE, anotarOfertaDaFolha, visualDoPaywall } from "@/lib/paywall-teste";
import type { DadosSemTeste } from "@/lib/revenuecat";

export const TITULO_SEM_TESTE = "Libere o CORE completo";
export const SUBTITULO_SEM_TESTE = "Dinheiro, rotina, corpo e metas num app só.";
/** Reserva do selo enquanto a loja não respondeu: 97,90 contra 12 × 34,90 = 418,80 → 76,6% → 77. */
export const ECONOMIA_RESERVA = 77;
/** Reserva do "por mês" do anual: 97,90 ÷ 12 = 8,158 → R$ 8,16. */
export const ANUAL_MES_RESERVA = "R$ 8,16";

/** A economia do anual contra 12 meses de mensal (pura): 97,90 × 34,90 → 77. */
export const economiaDoAnual = (anual: number | null | undefined, mensal: number | null | undefined): number | null => {
  if (!anual || !mensal || anual <= 0 || mensal <= 0) return null;
  const pct = Math.round((1 - anual / (12 * mensal)) * 100);
  return pct >= 1 && pct <= 99 ? pct : null;
};

/** Os 4 itens de "Incluso na assinatura": o ValueStack da área (o que o paywall de hoje já promete). */
export const itensIncluidos = (area: AreaKey): string[] =>
  (STACKS[area] ?? STACKS.dinheiro).slice(0, 4).map((s) => `${s.title}: ${s.sub}`);

/** "Você paga R$ 97,90 hoje. Renovação anual automática. Cancele quando quiser." */
export const linhaDoQueVocePaga = (plano: "anual" | "mensal", preco: string): string =>
  `Você paga ${preco} hoje. Renovação ${plano === "anual" ? "anual" : "mensal"} automática. Cancele quando quiser.`;

const TEMA_CLARO = {
  "--background": "0 0% 100%", "--foreground": "0 0% 15%", "--card": "0 0% 100%", "--card-foreground": "0 0% 15%",
  "--primary": "0 0% 20%", "--primary-foreground": "0 0% 100%", "--secondary": "40 20% 96%", "--secondary-foreground": "0 0% 15%",
  "--muted": "40 15% 95%", "--muted-foreground": "0 0% 45%", "--accent": "330 65% 50%", "--accent-foreground": "0 0% 100%",
  "--border": "0 0% 90%", "--input": "0 0% 90%", "--ring": "0 0% 20%",
} as CSSProperties;

const GRAFITE = "#16121c";
const FUNDO = "#fbf8fa";

type Modo = "funil" | "gate" | "planos";
type Precos = { anual: DadosSemTeste | null; mensal: DadosSemTeste | null };

export function PaywallSemTeste({
  area, answers = {}, onPagoSemConta, onVoltar, modo = "funil",
}: {
  area: AreaKey;
  answers?: Record<string, string>;
  /** compra (ou restaurar) que deu certo */
  onPagoSemConta: () => void;
  /** recuo do funil / fechar o /planos — chamado quando nenhum presente abriu por cima */
  onVoltar?: () => void;
  modo?: Modo;
}) {
  const apple = ehApple();
  const loja = apple ? "ios" : "android";
  const FUNIL = modo === "gate" ? `gate_${loja}` : modo === "planos" ? "planos" : apple ? "ios" : "w";
  const gate = modo === "gate";
  const { user: usuarioLogado } = useAuth();
  const [plano, setPlano] = useState<"anual" | "mensal">("anual");
  const [precos, setPrecos] = useState<Precos>({ anual: null, mensal: null });
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, setPendente] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [presente, setPresente] = useState<DadosSemTeste | null>(null);
  const [tituloBraco] = useState(() => { guardarForcaTitulo(); return gate ? null : bracoTitulo(area, answers); });
  const vivoRef = useRef(true);
  const comprandoRef = useRef(false);
  const presenteTentadoRef = useRef(false);
  const presenteAbertoRef = useRef(false);
  presenteAbertoRef.current = !!presente;
  const compraFeitaRef = useRef(false);
  const abertoEmRef = useRef(Date.now());
  const saiuRef = useRef(false);

  const anualTxt = precos.anual?.preco ?? PRECOS_RESERVA_SEM_TESTE.anual.preco;
  const mensalTxt = precos.mensal?.preco ?? PRECOS_RESERVA_SEM_TESTE.mensal.preco;
  const anualMesTxt = precos.anual?.precoMes ?? ANUAL_MES_RESERVA;
  const economia = economiaDoAnual(precos.anual?.valor ?? PRECOS_RESERVA_SEM_TESTE.anual.valor, precos.mensal?.valor ?? PRECOS_RESERVA_SEM_TESTE.mensal.valor) ?? ECONOMIA_RESERVA;
  const titulo = tituloBraco === "com" ? (tituloDaArea(area) ?? TITULO_SEM_TESTE) : TITULO_SEM_TESTE;
  // 12/11 noite: o braço do A/B do visual (só iPhone) em TODO evento; gate e /planos mostram este desenho pros dois
  // braços, então levam também o braço do aparelho (`paywall_visual_braco`) pra separar na conta
  const [bracoAparelho] = useState(() => visualDoPaywall());
  // 12/11: o A/B da oferta (anual × vitalício) mora no desenho android; este desenho só vende o anual
  const campos = { funil: FUNIL, loja, area, paywall_teste: "off", paywall_visual: "enxovaly", paywall_oferta: "anual", ...(modo !== "funil" ? { paywall_visual_braco: bracoAparelho } : {}), ...(tituloBraco ? { titulo_area: tituloBraco } : {}) };

  /* as folhas abertas daqui levam paywall_oferta: "anual" (folha_apple_resultado nasce no revenuecat.ts) */
  useEffect(() => { anotarOfertaDaFolha("anual"); return () => anotarOfertaDaFolha(null); }, []);
  /* a loja: preços reais + o presente já carregado (o toque em sair não espera rede) */
  useEffect(() => {
    vivoRef.current = true;
    trackEvent("funnel_view", { step: "offer", ...campos });
    let retry: number | null = null;
    void (async () => {
      try {
        const rc = await import("@/lib/revenuecat");
        await rc.initRevenueCat();
        await rc.prefetchSemTeste();
        const ler = () => {
          if (!vivoRef.current) return;
          const a = rc.dadosSemTeste("anual"), m = rc.dadosSemTeste("mensal");
          setPrecos({ anual: a, mensal: m });
          trackEvent("paywall_oferta_vista", { ...campos, produto: PRODUTOS_SEM_TESTE.anual, preco: a?.preco ?? null, preco_mensal: m?.preco ?? null, offering: a?.offering ?? null, trial: false });
        };
        if (!rc.dadosSemTeste("anual")) {
          retry = window.setTimeout(async () => { await rc.prefetchSemTeste(); ler(); }, 2500);
        } else ler();
      } catch { /* a reserva de texto segura a tela */ }
    })();
    return () => { vivoRef.current = false; if (retry) window.clearTimeout(retry); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* saída sem compra: 1 evento por paywall aberto (desmontou ou o app foi pro fundo) */
  const registrarSaida = (beacon = false) => {
    if (saiuRef.current || compraFeitaRef.current) return;
    saiuRef.current = true;
    (beacon ? trackEventBeacon : trackEvent)("paywall_saiu", { ...campos, segundos_na_tela: Math.round((Date.now() - abertoEmRef.current) / 1000), viu_oferta: presenteTentadoRef.current });
  };
  useEffect(() => {
    const aoEsconder = () => { if (document.visibilityState === "hidden" && !comprandoRef.current) registrarSaida(true); };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => { document.removeEventListener("visibilitychange", aoEsconder); registrarSaida(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** o presente de 69,90 sem teste: 1x por paywall aberto, só se a loja tem o produto. true = abriu. */
  const abrirPresente = async (lugar: "x_paywall" | "folha_cancelada"): Promise<boolean> => {
    if (presenteTentadoRef.current || comprandoRef.current || compraFeitaRef.current) return false;
    presenteTentadoRef.current = true;
    try {
      const rc = await import("@/lib/revenuecat");
      if (!rc.dadosSemTeste("presente")) await rc.prefetchSemTeste();
      const d = rc.dadosSemTeste("presente");
      if (!d || !vivoRef.current) return false;
      // downsell é MAIS BARATO que a vitrine (regra do dono, 16/10)
      const vitrine = rc.dadosSemTeste("anual")?.valor ?? PRECOS_RESERVA_SEM_TESTE.anual.valor;
      if (d.valor && d.valor >= vitrine) return false;
      trackEvent("presente69_view", { ...campos, lugar, preco: d.preco, de: precos.anual?.preco ?? anualTxt, trial: false, direto: true });
      setPresente(d);
      return true;
    } catch { return false; }
  };

  /* o Voltar do funil (o físico do Android vira `core:voltar` no ComecarW) */
  useEffect(() => {
    const aoVoltar = () => { void abrirPresente("x_paywall"); };
    window.addEventListener("core:voltar", aoVoltar);
    return () => window.removeEventListener("core:voltar", aoVoltar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const concluir = (produto: string, oferta: string, preco: string | null, extra: Record<string, unknown> = {}) => {
    compraFeitaRef.current = true;
    // gate e /planos recarregam logo depois: o sucesso vai por beacon (o insert normal morria na recarga)
    (modo === "funil" ? trackEvent : trackEventBeacon)("app_sheet_success", { ...campos, produto, oferta, preco, trial: false, ...extra });
    void import("@/lib/notificacoes").then((n) => { void n.cancelarResgateDoPlano(); }).catch(() => { /* noop */ });
    onPagoSemConta();
  };

  const tratarFalha = async (lugar: "paywall" | "presente") => {
    const rc = await import("@/lib/revenuecat");
    const motivo = rc.motivoUltimaCompra();
    if (motivo === "pendente") { setPendente(true); return; }
    if (motivo === "ja_ativo") { setErro(erroJaAtivo()); return; }
    if (motivo === "nao_permitido") { setErro(erroNaoPermitido()); return; }
    if (motivo === "produto_ausente" || motivo === "catalogo") { setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo."); return; }
    if (motivo === "cancelou" || motivo === null) {
      if (lugar === "paywall") void abrirPresente("folha_cancelada");
      return;
    }
    setErro(erroFolhaNaoConcluiu());
  };

  const comprar = async () => {
    if (comprandoRef.current) return;
    comprandoRef.current = true;
    setComprando(true);
    setErro(null);
    const p = plano;
    trackEvent("funnel_click", { cta: "app_paywall_cta", ...campos, plano: p, produto: PRODUTOS_SEM_TESTE[p], preco: p === "anual" ? anualTxt : mensalTxt });
    try {
      const rc = await import("@/lib/revenuecat");
      if (usuarioLogado?.id) { try { await rc.identificarRevenueCat(usuarioLogado.id); } catch { /* o init já usa a sessão */ } }
      rc.marcarToqueDeCompra();
      const ok = await rc.comprarSemTeste(p, FUNIL);
      comprandoRef.current = false;
      if (!vivoRef.current) return;
      setComprando(false);
      if (ok) { concluir(PRODUTOS_SEM_TESTE[p], `sem_teste_${p}`, p === "anual" ? anualTxt : mensalTxt); return; }
      await tratarFalha("paywall");
    } catch {
      comprandoRef.current = false;
      if (vivoRef.current) { setComprando(false); setErro(erroFolhaNaoConcluiu()); }
    }
  };

  const restaurarCompras = async () => {
    if (restaurando) return;
    setRestaurando(true);
    setErro(null);
    trackEvent("app_restore_paywall", { ...campos });
    try {
      const rc = await import("@/lib/revenuecat");
      const ok = (await rc.restaurar()) || (await rc.compraAssinaturaLocal());
      if (ok) { compraFeitaRef.current = true; onPagoSemConta(); return; }
      if (vivoRef.current) setErro(`Nenhuma assinatura encontrada nesta conta ${apple ? "da App Store" : "do Google"}.`);
    } catch { /* restaurar nunca derruba o paywall */ }
    if (vivoRef.current) setRestaurando(false);
  };

  const voltar = () => {
    trackEvent("funnel_click", { cta: "paywall_voltar", ...campos });
    window.dispatchEvent(new CustomEvent("core:voltar"));
    // o presente abre por cima com este toque? então fica; senão recua (funil) / fecha (/planos)
    if (onVoltar) window.setTimeout(() => { if (vivoRef.current && !presenteAbertoRef.current && !comprandoRef.current) onVoltar(); }, 450);
  };

  const trocarConta = async () => {
    trackEvent("gate_trocar_conta", { funil: FUNIL });
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
    } catch { /* sem rede: o /entrar resolve */ }
    window.location.href = "/entrar";
  };

  const escolher = (p: "anual" | "mensal") => {
    if (p === plano) return;
    setPlano(p);
    trackEvent("funnel_click", { cta: "paywall_plano", plano: p, ...campos });
  };

  const precoDoPlano = plano === "anual" ? anualTxt : mensalTxt;

  return (
    <div
      style={{ ...TEMA_CLARO, background: FUNDO }}
      /* gate: no fluxo (o TrialBanner já é a tela cheia e abre a vaga do aviso de cartão recusado ACIMA do paywall);
         funil e /planos: tela cheia própria por cima do passo */
      className={`tema-claro text-[#16121c] ${gate ? "relative min-h-[100dvh]" : "fixed inset-0 z-[300] overflow-y-auto"}`}
      data-testid="paywall-sem-teste" data-plano={plano} data-modo={modo}
    >
      <div className="relative max-w-[480px] mx-auto">
        {/* 1. a foto: o CORE real num iPhone, na mão, sangrando até as bordas, com degradê pro fundo */}
        <div className="relative w-full h-[min(46vh,420px)] overflow-hidden" aria-hidden>
          <img src="/paywall-sem-teste-foto.jpg" alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_18%]" draggable={false} />
          <div className="absolute inset-x-0 bottom-0 h-[42%]" style={{ background: `linear-gradient(180deg, rgba(251,248,250,0) 0%, ${FUNDO} 92%)` }} />
        </div>
        {modo !== "gate" && (
          <button
            type="button" aria-label="Voltar" data-testid="sem-teste-voltar" onClick={voltar}
            className="absolute left-4 w-11 h-11 rounded-full bg-white/85 backdrop-blur text-[#16121c] grid place-items-center shadow-[0_6px_18px_-8px_rgba(0,0,0,.35)] active:scale-95 transition-transform"
            style={{ top: "calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + 12px)" }}
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2.5} />
          </button>
        )}

        <div className="relative -mt-10 px-5" style={{ paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))" }}>
          {/* 2–3. título + subtítulo */}
          <h1 className="text-[31px] leading-[1.08] font-black tracking-[-0.035em]" data-testid="sem-teste-titulo">{titulo}</h1>
          <p className="mt-2 text-[15px] leading-snug text-[#5b5562]" data-testid="sem-teste-subtitulo">{SUBTITULO_SEM_TESTE}</p>

          {/* 4. incluso na assinatura */}
          <p className="mt-6 text-[14.5px] font-semibold">Incluso na assinatura</p>
          <ul className="mt-2.5 space-y-2.5" data-testid="sem-teste-itens">
            {itensIncluidos(area).map((t) => (
              <li key={t} className="flex items-start gap-3 text-[14.5px] leading-snug text-[#3f3946]">
                <span className="mt-[1px] w-[22px] h-[22px] rounded-full bg-accent/10 text-accent grid place-items-center shrink-0" aria-hidden>
                  <Check className="w-3 h-3" strokeWidth={3} />
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          {/* 5. anual (marcado por padrão), com a faixa no topo */}
          <button
            type="button" onClick={() => escolher("anual")} data-testid="sem-teste-anual" aria-pressed={plano === "anual"}
            className={`mt-6 w-full text-left rounded-[20px] border-2 overflow-hidden transition-colors ${plano === "anual" ? "border-accent bg-[#fdf1f7]" : "border-black/10 bg-white"}`}
          >
            <span className={`block text-center text-[11.5px] font-bold tracking-[0.14em] py-1.5 ${plano === "anual" ? "bg-accent text-white" : "bg-accent/10 text-accent"}`} data-testid="sem-teste-selo">
              ECONOMIZE {economia}%. MELHOR VALOR
            </span>
            <span className="flex items-center gap-2.5 px-3.5 py-3.5">
              <Radio ativo={plano === "anual"} />
              <span className="flex-1 min-w-0">
                <b className="block text-[17px] font-extrabold tracking-tight">Anual</b>
                <span className="block text-[12px] leading-snug text-[#6b6572] mt-0.5">{anualTxt} cobrados por ano</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[18px] font-extrabold tracking-tight whitespace-nowrap">{anualTxt}<small className="text-[12px] font-semibold text-[#6b6572]">/ano</small></span>
                <span className="block text-[12px] text-[#6b6572] mt-0.5 whitespace-nowrap">{anualMesTxt}/mês</span>
              </span>
            </span>
          </button>

          {/* 6. mensal */}
          <button
            type="button" onClick={() => escolher("mensal")} data-testid="sem-teste-mensal" aria-pressed={plano === "mensal"}
            className={`mt-3 w-full text-left rounded-[20px] border-2 transition-colors ${plano === "mensal" ? "border-accent bg-[#fdf1f7]" : "border-black/10 bg-white"}`}
          >
            <span className="flex items-center gap-2.5 px-3.5 py-3.5">
              <Radio ativo={plano === "mensal"} />
              <span className="flex-1 min-w-0">
                <b className="block text-[17px] font-extrabold tracking-tight">Mensal</b>
                <span className="block text-[12px] leading-snug text-[#6b6572] mt-0.5">{mensalTxt} cobrados por mês</span>
              </span>
              <span className="text-right shrink-0">
                <span className="block text-[18px] font-extrabold tracking-tight whitespace-nowrap">{mensalTxt}<small className="text-[12px] font-semibold text-[#6b6572]">/mês</small></span>
              </span>
            </span>
          </button>

          {pendente && (
            <p className="mt-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-2.5">
              <b>Compra em processamento.</b> A loja ainda está confirmando — o acesso libera sozinho aqui.
            </p>
          )}
          {erro && <p className="mt-3 text-[12.5px] text-destructive text-center" role="alert" data-testid="sem-teste-erro">{erro}</p>}

          {/* 7. o botão */}
          <button
            type="button" onClick={() => void comprar()} disabled={comprando} data-testid="sem-teste-cta"
            className="mt-4 w-full min-h-[56px] rounded-full text-white text-[17px] font-bold grid place-items-center shadow-[0_14px_30px_-12px_rgba(22,18,28,.55)] active:scale-[0.985] transition-transform disabled:opacity-70"
            style={{ background: GRAFITE }}
          >
            {comprando ? <Loader2 className="w-5 h-5 animate-spin" /> : plano === "anual" ? "Assinar plano anual" : "Assinar plano mensal"}
          </button>

          {/* 8. a linha do que se paga hoje (3.1.2: valor, período, renovação) */}
          <p className="mt-3 text-center text-[12.5px] leading-snug text-[#6b6572]" data-testid="sem-teste-legal">
            {linhaDoQueVocePaga(plano, precoDoPlano)}
          </p>

          {/* 9. rodapé */}
          <p className="mt-5 text-center text-[12.5px] text-[#6b6572]" data-testid="sem-teste-rodape">
            <button type="button" className="font-medium disabled:opacity-50" disabled={restaurando} onClick={() => void restaurarCompras()}>
              {restaurando ? "Restaurando…" : "Restaurar compras"}
            </button>
            <span className="mx-2 text-black/25">·</span>
            <a href="/termos" className="font-medium text-[#16121c]">Termos</a>
            <span className="mx-2 text-black/25">·</span>
            <a href="/privacidade" className="font-medium text-[#16121c]">Privacidade</a>
          </p>
          {!gate && <JaPagouPeloSite origem="paywall_sem_teste" logado={!!usuarioLogado} className="block mx-auto mt-2 text-center text-[11.5px] text-[#8a8490]" />}
          {gate && (
            <p className="mt-2 text-center text-[11.5px] text-[#8a8490]">
              <button type="button" className="underline underline-offset-2" onClick={() => void trocarConta()}>Entrar com outra conta</button>
              <span className="mx-2">·</span>
              <button type="button" className="underline underline-offset-2" onClick={() => setExcluirAberto(true)}>Excluir conta</button>
            </p>
          )}
        </div>
      </div>

      {gate && <DeleteAccountDialog open={excluirAberto} onOpenChange={setExcluirAberto} />}

      {presente && (
        <PresenteDireto
          oferta={presente}
          precoDe={precos.anual?.preco ?? anualTxt}
          onFechar={() => { trackEvent("presente69_fechou", { ...campos, direto: true }); setPresente(null); }}
          onComprar={async () => {
            const rc = await import("@/lib/revenuecat");
            if (usuarioLogado?.id) { try { await rc.identificarRevenueCat(usuarioLogado.id); } catch { /* noop */ } }
            trackEvent("presente69_toque", { ...campos, direto: true });
            rc.marcarToqueDeCompra();
            const ok = await rc.comprarSemTeste("presente", FUNIL);
            if (ok) {
              trackEvent("presente69_sucesso", { ...campos, preco: presente.preco, direto: true });
              concluir(PRODUTOS_SEM_TESTE.presente, "presente69_direto", presente.preco);
              return null;
            }
            const motivo = rc.motivoUltimaCompra();
            trackEvent("presente69_falhou", { ...campos, motivo, direto: true });
            if (motivo === "cancelou" || motivo === null) return null;
            if (motivo === "ja_ativo") return erroJaAtivo();
            if (motivo === "nao_permitido") return erroNaoPermitido();
            return erroFolhaNaoConcluiu();
          }}
        />
      )}
    </div>
  );
}

const Radio = ({ ativo }: { ativo: boolean }) => (
  <span
    className={`w-[26px] h-[26px] rounded-full grid place-items-center shrink-0 border-2 ${ativo ? "bg-accent border-accent text-white" : "border-black/20 bg-white"}`}
    aria-hidden
  >
    {ativo && <Check className="w-3.5 h-3.5" strokeWidth={3.5} />}
  </span>
);

/**
 * O PRESENTE DE SAÍDA SEM TESTE: o mesmo desenho do presente de 69,90 de hoje (Presente69Folha: caixa grafite com fita
 * magenta, cartão do anual), sem nenhum texto de teste — o 69,90 é cobrado na hora.
 */
export function PresenteDireto({ oferta, precoDe, onFechar, onComprar }: {
  oferta: DadosSemTeste;
  precoDe: string | null;
  onFechar: () => void;
  /** abre a folha; devolve a frase de erro (ou null quando deu certo / foi cancelada) */
  onComprar: () => Promise<string | null>;
}) {
  const reduzir = !!useReducedMotion();
  const [aberta, setAberta] = useState(reduzir);
  const [comprando, setComprando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    const t = window.setTimeout(() => { if (vivo.current) setAberta(true); }, reduzir ? 0 : 420);
    return () => { vivo.current = false; window.clearTimeout(t); };
  }, [reduzir]);
  const de = precoDe && precoDe !== oferta.preco ? precoDe : null;
  return (
    <div data-testid="presente-direto" className="fixed inset-0 z-[320] overflow-y-auto" style={{ background: "linear-gradient(180deg,#fbf0f6 0%,#ffffff 52%)" }}>
      <div className="min-h-full max-w-[400px] mx-auto flex flex-col px-6 pb-8" style={{ paddingTop: "calc(var(--app-safe-top, env(safe-area-inset-top, 0px)) + 28px)" }}>
        <div className="text-center">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-wider">Antes de ir</span>
          <h1 className="text-[26px] font-black tracking-[-0.03em] leading-[1.12] text-[#16121c] mt-3">Antes de ir,<br />um presente.</h1>
          <p className="text-[13.5px] text-[#4f5a64] mt-2.5 leading-snug">
            O ano inteiro{de ? <> sai de <s>{de}</s></> : null} por <b className="text-[#16121c]">{oferta.preco}</b>{oferta.precoMes ? <> — {oferta.precoMes} por mês</> : null}.
          </p>
        </div>
        <div className="grid place-items-center mt-2 -mb-2" aria-hidden>
          <CaixaDePresente aberta={aberta} reduzir={reduzir} />
        </div>
        <motion.div
          initial={reduzir ? false : { opacity: 0, y: 28, scale: 0.92 }}
          animate={aberta ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 28, scale: 0.92 }}
          transition={reduzir ? { duration: 0 } : { delay: 0.1, type: "spring", stiffness: 300, damping: 24 }}
          className="rounded-3xl bg-white border-2 border-accent p-5 shadow-[0_24px_48px_-18px_rgba(210,41,122,.35)]"
          data-testid="presente-direto-cartao"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[16px] font-extrabold text-[#16121c]">CORE Anual</span>
            <span className="text-right">
              {de && <s className="block text-[12px] font-bold text-[#8a93a0] leading-none">{de}</s>}
              <span className="text-[24px] font-black tracking-tight text-[#16121c] leading-none">{oferta.preco}<small className="text-[12px] font-bold text-[#8a93a0]">/ano</small></span>
            </span>
          </div>
          <p className="text-[12px] font-semibold text-[#4f5a64] mt-1.5">{oferta.precoMes ? <>{oferta.precoMes} por mês · </> : null}os 16 módulos, sem limite</p>
        </motion.div>
        <p className="text-[12px] text-[#4f5a64] text-center leading-snug mt-4" data-testid="presente-direto-regra">
          {linhaDoQueVocePaga("anual", oferta.preco)}
        </p>
        {erro && <p className="text-[12.5px] text-destructive text-center mt-3" role="alert">{erro}</p>}
        <div className="mt-auto pt-6">
          <button
            type="button" disabled={comprando || !aberta} data-testid="presente-direto-cta"
            onClick={async () => {
              if (comprando) return;
              setComprando(true); setErro(null);
              const e = await onComprar().catch(() => erroFolhaNaoConcluiu());
              if (!vivo.current) return;
              setComprando(false);
              if (e) setErro(e);
            }}
            className="w-full min-h-[54px] rounded-full text-[16px] font-extrabold text-white bg-[#16121c] shadow-[0_18px_38px_-10px_rgba(22,18,28,.5)] active:scale-[0.985] transition-transform grid place-items-center disabled:opacity-60"
          >
            {comprando ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Quero o presente — {oferta.preco}/ano</>}
          </button>
          <p className="text-[10.5px] text-[#8a93a0] text-center mt-2 leading-snug">Assinatura {ehApple() ? "pela App Store" : "pelo Google Play"} · renova por {oferta.preco}/ano até você cancelar</p>
          <button type="button" onClick={onFechar} disabled={comprando} data-testid="presente-direto-agora-nao" className="w-full text-center text-[13px] font-semibold text-[#4f5a64] mt-3 py-2">
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
