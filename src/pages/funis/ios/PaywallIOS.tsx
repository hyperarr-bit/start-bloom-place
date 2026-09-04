/**
 * PAYWALL DO iPHONE — arquivo próprio (31/08, decisão do dono: "no fundo são
 * produtos diferentes").
 *
 * POR QUE ISTO NÃO É UMA CÓPIA DO PaywallW, E SIM UM ARQUIVO SEPARADO.
 *
 * Até aqui o iPhone vivia dentro do paywall do Android, atrás de `ehApple()`.
 * Funcionava — e um teste provou que funcionava —, mas a fronteira era um
 * `if`, e um `if` depende de todo mundo lembrar dele. A prova disso aconteceu
 * no mesmo dia: a sessão do Android desligou o A/B (`AB_LIGADO = false`), e o
 * iPhone só não perdeu a coluna do mensal — contrariando a spec — porque a
 * linha estava escrita como `ehApple() ? "b" : sortearBraco()`. Se estivesse
 * escrita do jeito óbvio, a vitrine do iPhone teria mudado sozinha, em
 * silêncio, por uma mudança que não era sobre o iPhone.
 *
 * Agora a fronteira é o sistema de arquivos: o Android mexe no PaywallW e não
 * alcança este arquivo. Não tem como esquecer de uma fronteira que é física.
 *
 * O QUE É DIFERENTE AQUI, e cada item tem custo se for esquecido:
 *
 *  · SEM A/B. O iPhone nasce sem campanha (não há SDK da Meta nem ATT), então
 *    o volume não sustenta teste — dividir um fluxo pequeno ao meio produz
 *    dois números sem significância. Uma versão só.
 *  · DOIS PREÇOS SEMPRE. O dado que fez o Android escolher "vitalício
 *    sozinho" veio de público Pix-first e sensível a preço. Na App Store não
 *    existe Pix, some o atrito que empurrava pro pagamento único, e assinar
 *    é um Face ID. A física da decisão é outra.
 *  · SEM ESCADA DE PIX. Nada de reabrir a folha em 4s, "seu código vence em
 *    5 minutos" ou "Já paguei". A folha da Apple é instantânea e cancelar é
 *    cancelar; reabrir sozinho seria perseguir com pop-up quem disse não, e a
 *    Apple trata isso como padrão abusivo.
 *  · RODAPÉ LEGAL OBRIGATÓRIO. "Restaurar compras" (regra 3.1.1) e links de
 *    Termos e Privacidade na própria tela de compra (3.1.2). Sem eles, este
 *    paywall reprova — e ele é a PRIMEIRA tela que um iPhone novo vê, então
 *    quem reinstala cai aqui sem jeito de recuperar o que pagou.
 *  · O LEGAL DIZ QUE RENOVA. Na Apple o mensal é auto-renovável obrigatório;
 *    "cancele quando quiser" fala do direito de sair, não do fato de que vai
 *    cobrar de novo. A 3.1.2 exige o aviso, e é o que evita reembolso.
 *  · NENHUMA MENÇÃO A PIX/GOOGLE/PLAY. Regra 3.1.1: citar pagamento de fora
 *    da App Store dentro do app é motivo de recusa direto.
 *
 * O que continua vindo do arquivo compartilhado (`PaywallDia14`) é só
 * apresentação sem semântica de loja: gráfico de transformação, pilha de
 * valor, depoimentos, âncora do topo. Nenhum deles sabe o que é Pix. Se um
 * dia a identidade visual das duas lojas divergir, esses também se separam.
 *
 * Coberto por `paywall-ios.test.tsx`.
 */
import { erroJaAtivo, erroNaoPermitido, erroFolhaNaoConcluiu } from "@/lib/loja";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { APP_PRECOS } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";
import { type AreaKey } from "@/lib/funnel";
import { AppLegalFooter } from "@/components/paywall/PaywallFlow";
import {
  TransformChart, ValueStack, ModulesIncludedCard, AnchorCard, AreaAnchorCard,
  MuralDepoimentos, CompareTable, CHART_LABEL,
} from "@/pages/funis/dia14/PaywallDia14";

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" },
  transition: { duration: 0.4, delay: Math.min(i * 0.05, 0.3) },
});

/**
 * Qual coluna nasce selecionada. Constante de uma linha de propósito: é a
 * única alavanca de posicionamento desta tela, e trocar tem que ser trocar
 * uma linha, não refazer o paywall.
 */
const PLANO_INICIAL: "vitalicio" | "mensal" = "vitalicio";

/**
 * SELOS DE CONFIANÇA do iPhone. Os do Android ("🇧🇷 Pix na hora",
 * "🛡️ Garantia de 7 dias") não podem aparecer aqui: o primeiro é reprovação
 * na 3.1.1, e o segundo é promessa que não é nossa pra fazer — na Apple quem
 * reembolsa é a Apple, pelo formulário dela. Prometer garantia própria vira
 * dívida de suporte com quem cobra a promessa depois.
 * Estes três são fatos verificáveis.
 */
const SELOS = [
  { emoji: "", label: "Compra pela App Store" },
  { emoji: "⚡", label: "Acesso na hora" },
  { emoji: "♾️", label: "Sem mensalidade" },
];

/**
 * As duas colunas, de PESO IGUAL — mesma largura, mesma altura, preço no
 * mesmo corpo. Quem faz o trabalho de venda não é a hierarquia visual, é a
 * CONTA: 12 meses de mensal custam R$ 298,80 contra R$ 97,90 uma vez. Foi a
 * lição do sábado 29/08 no Android — quando as colunas mostravam só os
 * números "24,90 × 97,90" sem a matemática, o barato levou 92% do mix e o
 * tíquete caiu pra R$ 43. A linha "4 meses de mensal = CORE pra sempre" é o
 * que faz a comparação sem precisar de tabela.
 */
function DuasColunas({
  plano, onSelect,
}: { plano: "vitalicio" | "mensal"; onSelect: (p: "vitalicio" | "mensal") => void }) {
  const moldura = (ativo: boolean) =>
    `rounded-3xl p-[2px] transition-all ${ativo
      ? "bg-gradient-to-br from-accent via-accent/45 to-accent/15 shadow-[0_14px_40px_-16px_hsl(var(--accent)/0.5)]"
      : "bg-black/10"}`;
  return (
    <div className="grid grid-cols-2 gap-2.5 items-stretch">
      <div onClick={() => onSelect("mensal")} role="button" className={moldura(plano === "mensal")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-2.5 pb-3.5 text-center text-[#16121c] flex flex-col">
          {/* espaçador que alinha o topo com o selo da coluna irmã */}
          <span className="h-[19px]" aria-hidden />
          <span className="text-[30px] font-black leading-none mt-1.5">1</span>
          <span className="text-[12.5px] font-bold text-black/45">mês</span>
          <span className="text-[17px] font-extrabold mt-2">{APP_PRECOS.mensal.preco}</span>
          <span className="text-[10px] font-semibold text-black/40">por mês</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          {/* "renova sozinho" e não "cancele quando quiser": na Apple a
              renovação é automática e obrigatória, e a 3.1.2 quer isso dito. */}
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            renova sozinho<br />cancele quando quiser
          </span>
        </div>
      </div>

      <div onClick={() => onSelect("vitalicio")} role="button" className={moldura(plano === "vitalicio")}>
        <div className="rounded-[calc(1.5rem-2px)] bg-white h-full px-3 pt-0 pb-3.5 text-center text-[#16121c] flex flex-col overflow-hidden">
          <span className={`-mx-3 text-[10px] font-extrabold tracking-[0.08em] py-[5px] ${plano === "vitalicio" ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent"}`}>
            MELHOR ESCOLHA
          </span>
          <span className="text-[21px] font-black leading-[1.05] mt-1.5 px-1 tracking-tight">Pra sempre</span>
          <span className="text-[17px] font-extrabold mt-1.5">{APP_PRECOS.vitalicio97.preco}</span>
          <span className="text-[10px] font-semibold text-black/40">vitalício · uma única vez</span>
          <span className="mx-3 my-2 border-t border-black/10" aria-hidden />
          <span className="text-[10.5px] font-semibold text-black/45 pb-1 px-1 leading-tight mt-auto">
            4 meses de mensal =<br /><b className="text-black/60">CORE pra sempre</b>
          </span>
        </div>
      </div>
    </div>
  );
}

export function PaywallIOS({
  area, answers, onPagoSemConta,
}: { area: AreaKey; answers: Record<string, string>; onPagoSemConta: () => void }) {
  const [comprando, setComprando] = useState(false);
  const [pendente, setPendente] = useState(false);
  const [conferindo, setConferindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const vivoRef = useRef(true);
  // Disponibilidade real do vitalício: otimista até resposta NEGATIVA da loja.
  const [vitalicioNaLoja, setVitalicioNaLoja] = useState<boolean | null>(null);
  const [plano, setPlano] = useState<"vitalicio" | "mensal">(PLANO_INICIAL);

  useEffect(() => {
    vivoRef.current = true;
    // `loja: "ios"` em todo evento: sem isso o iPhone entraria somando nos
    // números do funil do Android e as duas leituras virariam uma média de
    // dois públicos, duas lojas e duas mecânicas de pagamento.
    trackEvent("funnel_view", { step: "offer", funil: "ios", area, loja: "ios" });
    /* Aquecimento do RevenueCat no mount (lição da v91 do Android): sem
     * init aqui, o primeiro toque paga init + catálogo inteiro e a folha
     * demora em aparelho popular. Só cache — o caminho do toque não muda. */
    let retry: number | null = null;
    void (async () => {
      const rc = await import("@/lib/revenuecat");
      await rc.initRevenueCat();
      await rc.prefetchVitalicio();
      if (!vivoRef.current) return;
      if (rc.estadoRevenueCat() === "pronto") setVitalicioNaLoja(rc.temVitalicio97());
      if (!rc.temVitalicio97()) {
        retry = window.setTimeout(async () => {
          await rc.initRevenueCat();
          await rc.prefetchVitalicio();
          if (vivoRef.current && rc.estadoRevenueCat() === "pronto") setVitalicioNaLoja(rc.temVitalicio97());
        }, 2500);
      }
    })();
    return () => {
      vivoRef.current = false;
      if (retry) window.clearTimeout(retry);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmarPagamento = async () => {
    setConferindo(true);
    try {
      const rc = await import("@/lib/revenuecat");
      const ok = (await rc.restaurar()) || (await rc.compraVitaliciaLocal()) || (await rc.compraAssinaturaLocal());
      if (ok) { trackEvent("funnel_click", { cta: "ios_ja_paguei_ok", funil: "ios" }); onPagoSemConta(); return; }
      setErro("Ainda não achei a compra. Espera uns segundos e toca de novo.");
    } catch { /* conferência nunca derruba o paywall */ }
    setConferindo(false);
  };

  const comprar = async (produto: "vitalicio" | "mensal") => {
    if (comprando) return;
    setErro(null);
    setComprando(true);
    try {
      const rc = await import("@/lib/revenuecat");
      const idProduto = produto === "mensal" ? "core_mensal" : "core_vitalicio_97";
      const ok = produto === "mensal"
        ? await rc.comprar("core_mensal", { semTrial: true })
        : await rc.comprarVitalicio("core_vitalicio_97");
      if (ok) {
        trackEvent("app_sheet_success", { produto: idProduto, funil: "ios", loja: "ios" });
        onPagoSemConta();
        return;
      }
      /* RECUSA NA APPLE — e aqui acaba. Não existe escada: a folha é
       * instantânea, autentica no Face ID, e um cancelamento é uma decisão,
       * não uma tela que não carregou. A pessoa continua no paywall com o
       * botão vivo, e é só isso que a gente faz. */
      const motivo = rc.motivoUltimaCompra();
      if (motivo === "pendente") {
        setPendente(true);
      } else if (motivo === "produto_ausente") {
        setErro("A loja ainda tá carregando este plano. Espera uns segundos e toca de novo.");
      } else if (motivo === "ja_ativo") {
        setErro(erroJaAtivo());
      } else if (motivo === "nao_permitido") {
        setErro(erroNaoPermitido());
      } else if (motivo && motivo !== "cancelou") {
        /* 04/09: a StoreKit recusou ("not available for purchase") e o
         * paywall ficava MUDO — botão voltava ao normal sem dizer nada. Foi o
         * que o revisor viu. Cancelar continua silencioso (foi decisão dela). */
        setErro(erroFolhaNaoConcluiu());
      }
    } catch {
      setErro("A Apple não concluiu o pagamento. Tenta de novo em instantes.");
    }
    setComprando(false);
  };

  const chartLabel = CHART_LABEL[area] ?? CHART_LABEL.dinheiro;
  const vitoria: Record<AreaKey, string> = {
    dinheiro: "ver pra onde seu dinheiro vai",
    rotina: "organizar sua rotina",
    corpo: "cuidar do seu corpo com constância",
    saude: "cuidar da sua saúde todo dia",
    metas: "tirar suas metas do papel",
  };

  const mostraMensal = plano === "mensal";

  return (
    <div className="relative w-full max-w-sm mx-auto text-center pb-40 pt-8">
      <motion.div
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 15 }}
        className="w-14 h-14 rounded-full bg-accent text-accent-foreground grid place-items-center mx-auto mb-4 shadow-[0_8px_28px_-6px_hsl(var(--accent)/0.55)]"
      >
        <Check className="w-7 h-7" strokeWidth={3} />
      </motion.div>
      <h1 className="text-[27px] font-bold tracking-tight leading-[1.12] mb-2">
        Seu plano pra<br /><span className="text-accent">{vitoria[area]}</span><br />está pronto
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed mb-5">
        Você já viu como funciona. Agora é com os seus números de verdade.
      </p>

      <div className="space-y-4">
        <motion.div {...stagger(0)}>
          {(() => {
            // A âncora do topo acompanha a coluna escolhida — resolve o medo
            // de "a pessoa se assusta com 97,90 antes de ver que tem mensal".
            const preco = mostraMensal ? "24,90" : "97,90";
            const precoSub = mostraMensal ? "por mês" : "1x, pra sempre";
            const precoTitulo = mostraMensal
              ? <>CORE mensal,<br />pra começar hoje</>
              : undefined;
            return area === "dinheiro"
              ? <AnchorCard gasto={answers?.gasto ?? ""} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} />
              : <AreaAnchorCard area={area as Exclude<AreaKey, "dinheiro">} preco={preco} precoSub={precoSub} precoTitulo={precoTitulo} />;
          })()}
        </motion.div>
        <motion.div {...stagger(1)}><TransformChart label={chartLabel} /></motion.div>
        <ValueStack area={area} />
        <motion.div {...stagger(2)}>{area === "dinheiro" ? <CompareTable /> : <ModulesIncludedCard />}</motion.div>
        <motion.div {...stagger(3)}>
          <DuasColunas
            plano={plano}
            onSelect={(p) => { setPlano(p); trackEvent("funnel_click", { cta: "ios_plano", plano: p, funil: "ios" }); }}
          />
        </motion.div>
        <MuralDepoimentos area={area} semLoja />
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px] text-[#f0a500] tracking-wide" aria-label="5 estrelas">★★★★★</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">+1000</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">aprovaram o CORE</div>
          </div>
          <div className="rounded-2xl border border-border bg-card py-3.5 text-center">
            <div className="text-[13px]" aria-hidden>⚡</div>
            <div className="text-[17px] font-extrabold tracking-tight leading-tight mt-0.5">Na hora</div>
            <div className="text-[10.5px] text-muted-foreground font-semibold">acesso liberado</div>
          </div>
        </div>
        <motion.div {...stagger(4)}>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {SELOS.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11.5px] font-semibold">
                {c.emoji && <span>{c.emoji}</span>} {c.label}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Restaurar compras (3.1.1) + Termos e Privacidade (3.1.2). Sem isto
            este paywall reprova, e ele é a primeira tela de um iPhone novo. */}
        <AppLegalFooter />
      </div>

      {/* CTA fixo */}
      <div
        className="fixed inset-x-0 bottom-0 z-[75] bg-gradient-to-t from-white via-white/95 to-transparent pt-8"
        style={{ paddingBottom: "max(0.9rem, env(safe-area-inset-bottom))" }}
      >
        <div className="max-w-sm mx-auto px-5">
          {pendente && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[12.5px] leading-snug p-3 mb-2.5 text-left">
              {/* "Pendente" na Apple é raro (Ask to Buy de conta de menor, ou
                  revisão antifraude) e não tem nada pra pessoa fazer no banco
                  — só esperar. Prometer ação aqui seria inventar. */}
              <b>Compra em processamento.</b> A App Store ainda está confirmando —
              o acesso libera sozinho aqui.
              <button className="block w-full text-center font-bold underline underline-offset-2 mt-1.5 disabled:opacity-50" disabled={conferindo} onClick={() => void confirmarPagamento()}>
                {conferindo ? "Conferindo…" : "Já comprei — atualizar"}
              </button>
            </div>
          )}
          {erro && <p className="text-[12.5px] text-destructive text-center mb-2">{erro}</p>}

          <motion.div animate={{ scale: [1, 1.02, 1] }} transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}>
            <Button
              size="lg"
              className="w-full h-14 rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
              disabled={comprando}
              onClick={() => {
                trackEvent("funnel_click", {
                  cta: "app_paywall_cta", funil: "ios", loja: "ios",
                  produto: mostraMensal ? "core_mensal" : "core_vitalicio_97",
                });
                void comprar(plano);
              }}
            >
              {comprando
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : mostraMensal
                  ? <>Começar por {APP_PRECOS.mensal.preco}/mês <ArrowRight className="w-4 h-4" /></>
                  : <>Quero pra sempre — {APP_PRECOS.vitalicio97.preco} <ArrowRight className="w-4 h-4" /></>}
            </Button>
          </motion.div>
          <p className="text-[11px] text-muted-foreground text-center mt-2 flex w-full items-start justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
            <span>
              {/* Nenhuma forma de pagamento citada (3.1.1) e, no mensal, o
                  aviso de renovação automática que a 3.1.2 exige. */}
              {mostraMensal
                ? <>Assinatura de {APP_PRECOS.mensal.preco}/mês pela App Store · renova automaticamente até você cancelar</>
                : <>Pagamento <strong className="text-foreground font-semibold">único</strong> pela App Store · sem mensalidade</>}
            </span>
          </p>
        </div>
      </div>

      {comprando && (
        <div className="fixed inset-0 z-[80] grid place-items-end pointer-events-none pb-28">
          <div className="mx-auto max-w-[92%] rounded-2xl bg-[#16121c] text-white text-[12.5px] font-bold px-4 py-2.5 shadow-lg flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> Abrindo o pagamento…
          </div>
        </div>
      )}
    </div>
  );
}
