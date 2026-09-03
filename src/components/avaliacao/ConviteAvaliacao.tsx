import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Star } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { pedirAvaliacaoSePuder } from "@/lib/avaliacao";
import { trackEvent } from "@/lib/analytics";

/**
 * CONVITE DE AVALIAÇÃO — a folha que vem ANTES da caixa do Google (02/09).
 *
 * De onde veio: em 27–29/08 o app pediu nota no fim do funil e colheu 63
 * avaliações em 3 dias (76% das de agosto, média 4,9) — mas pedia pra quem
 * nunca tinha usado nada, e cada pedido queimava a janela de 90 dias do
 * aparelho. O gatilho morreu em 28/08 e as avaliações caíram pra 1–2/dia.
 *
 * Este convite recoloca o VOLUME sem repetir o erro: aparece uma vez na
 * vida do aparelho, no primeiro gasto lançado (96% dos pagantes fazem isso,
 * no primeiro dia), e só chama a caixa do Google se a pessoa tocar em
 * "Deixar minha nota". Quem toca em "Agora não" NÃO gasta a cota — pode ser
 * convidada de novo num momento de valor mais pra frente.
 *
 * O que ela pode e não pode dizer (regras do In-App Review; quebrar derruba
 * o app da loja): nenhuma PERGUNTA antes da caixa ("está gostando?"), nada
 * de prever nota ("5 estrelas?"), nenhum seletor de estrelas nosso. Aqui é
 * um pedido direto, com o porquê, e um botão. A folha FECHA antes da caixa
 * do Google abrir — a regra proíbe cobrir a caixa com qualquer coisa nossa.
 *
 * Visual: é o mesmo mundo da Retrospectiva (grafite → magenta), de propósito
 * — é uma comemoração, não um formulário. Uma tela só, sempre escura.
 */

export interface GastoDoConvite {
  id: string;
  descricao: string;
  valor: number;
  categoria: string;
}

/** O plano recém-montado no funil — a mesma folha, outro motivo (03/09). */
export interface PlanoDoConvite {
  emoji: string;
  /** Nome curto da área escolhida ("Dinheiro", "Rotina"). */
  nome: string;
}

interface ConviteAvaliacaoProps {
  /** O gasto recém-lançado; `null` quando o convite não é esse. */
  gasto?: GastoDoConvite | null;
  /** O plano recém-montado; `null` quando o convite não é esse. */
  plano?: PlanoDoConvite | null;
  pagante: boolean;
  onFechar: () => void;
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const ConviteAvaliacao = ({ gasto = null, plano = null, pagante, onFechar }: ConviteAvaliacaoProps) => {
  const semMovimento = useReducedMotion();
  const motivo: "primeiro_gasto" | "plano_pronto" = gasto ? "primeiro_gasto" : "plano_pronto";
  const aberto = !!gasto || !!plano;
  // Distingue "fechou porque aceitou" de "fechou porque deslizou/recusou" —
  // o Drawer avisa `open=false` nos dois casos.
  const decidiu = useRef(false);

  useEffect(() => {
    if (!aberto) { decidiu.current = false; return; }
    trackEvent("app_avaliacao_convite", { motivo, acao: "visto", pagante });
  }, [aberto, motivo, pagante]);

  const aceitar = () => {
    decidiu.current = true;
    trackEvent("app_avaliacao_convite", { motivo, acao: "aceitou", pagante });
    onFechar();
    // A caixa do Google só depois da folha sair da tela (≈300ms de animação):
    // a diretriz proíbe sobrepor a caixa, e a pessoa acabou de decidir — não
    // precisa de mais nada nossa na frente.
    window.setTimeout(() => { void pedirAvaliacaoSePuder(motivo, { pagante, forte: true }); }, 380);
  };

  const recusar = () => {
    if (decidiu.current) return;
    decidiu.current = true;
    trackEvent("app_avaliacao_convite", { motivo, acao: "recusou", pagante });
    onFechar();
  };

  const entra = (atraso: number) =>
    semMovimento
      ? {}
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: atraso, duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } };

  return (
    <Drawer open={aberto} onOpenChange={(aberto) => { if (!aberto) recusar(); }}>
      <DrawerContent
        className="border-0 bg-transparent rounded-t-[28px] text-white [&>div:first-child]:bg-white/25"
        style={{ background: "linear-gradient(160deg, #1c1917 35%, #D22D80 190%)" }}
        aria-describedby={undefined}
      >
        <div className="px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-5">
          {/* O gasto que acabou de entrar — a prova de que funcionou, antes de
              qualquer pedido. */}
          {(gasto || plano) && (
            <motion.div
              {...entra(0)}
              className="flex items-center gap-3 rounded-2xl bg-white/10 ring-1 ring-white/10 px-4 py-3"
            >
              <motion.span
                className="grid place-items-center w-10 h-10 rounded-full bg-emerald-400 text-[#1c1917] shrink-0"
                initial={semMovimento ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.2 }}
              >
                <Check className="w-5 h-5" strokeWidth={3} />
              </motion.span>
              {gasto ? (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight truncate">{gasto.descricao}</span>
                    <span className="block text-[12px] text-white/55 mt-0.5 truncate">{gasto.categoria}</span>
                  </span>
                  <span className="text-[15px] font-bold tabular-nums shrink-0">{brl(gasto.valor)}</span>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight truncate">
                      Seu plano de {plano!.nome}
                    </span>
                    <span className="block text-[12px] text-white/55 mt-0.5 truncate">16 módulos liberados</span>
                  </span>
                  <span className="text-[20px] shrink-0" aria-hidden>{plano!.emoji}</span>
                </>
              )}
            </motion.div>
          )}

          <motion.div {...entra(0.1)} className="space-y-2">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-white/50">
              {gasto ? "PRIMEIRO GASTO LANÇADO" : "SEU PLANO ESTÁ PRONTO"}
            </p>
            <DrawerTitle className="text-[24px] font-bold leading-[1.15] tracking-tight text-white [text-wrap:balance]">
              {gasto ? "Agora o CORE cuida do resto." : "Montado do jeito que você respondeu."}
            </DrawerTitle>
            <DrawerDescription className="text-[14px] leading-relaxed text-white/70">
              {gasto
                ? "Cada gasto que você lançar vira gráfico, orçamento e retrospectiva no fim do mês. Sem planilha, sem conta de cabeça."
                : "Suas respostas viraram um plano com os 16 módulos do CORE — e ele começa pela área que você escolheu."}
            </DrawerDescription>
          </motion.div>

          <motion.div {...entra(0.2)} className="border-t border-white/10 pt-4 space-y-1.5">
            <p className="text-[14px] leading-relaxed text-white/85">
              O CORE é feito por uma equipe pequena, sem investidor. É a sua nota na Play
              que faz o app chegar em mais gente.
            </p>
            <p className="text-[12px] text-white/50">Leva 10 segundos e não precisa escrever nada.</p>
          </motion.div>

          <motion.div {...entra(0.28)} className="space-y-1 pt-1">
            <button
              type="button"
              onClick={aceitar}
              className="w-full h-12 rounded-full bg-white text-[#1c1917] font-semibold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <Star className="w-4 h-4 fill-[#D22D80] text-[#D22D80]" />
              Deixar minha nota na Play
            </button>
            <button
              type="button"
              onClick={recusar}
              className="w-full h-10 text-[14px] text-white/55 hover:text-white/80 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              Agora não
            </button>
          </motion.div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
