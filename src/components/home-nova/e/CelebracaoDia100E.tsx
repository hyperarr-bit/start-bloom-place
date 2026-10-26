import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CHAVE_DIA_100_VISTO } from "@/components/home/DayScoreRing";
import { FogoSequencia } from "@/components/fogo/FogoSequencia";
import { useFaixaDoRelogioTransparente } from "@/components/app/faixaDoRelogio";
import { localDayKey } from "@/lib/utils";
import { Anel } from "./Anel";
import { DURACAO_FESTA_MS, EcoDoAnel, EstrelaFesta, corDaFase, type Fase100 } from "./Festa100";

/**
 * A COMEMORAÇÃO DO DIA 100 NA HOME NOVA (dono 26/10: a de hoje "ficou feia" — o anel verde com o selo ✓, "Dia 100%.
 * Fecha o app em paz. 🌟", a pílula roxa com contorno e a faixa cinza atrás do relógio). Refeita no estilo da Home nova
 * (Cal AI): fundo branco chapado de ponta a ponta — inclusive atrás do relógio (a faixa do relógio fica transparente
 * enquanto ela está aberta) —, Inter, sem bordas, sem pílula, sem emoji, sem confete.
 *
 * O centro é a mesma ESTRELA do card do score, com a MESMA festinha (Festa100.tsx): o anel enche, a estrela pula e
 * vira âmbar com o brilho. Embaixo, o "100" + "Dia completo" e a sequência com o fogo (sem caixa).
 * Botão preto de canto redondo: "Continuar".
 *
 * Variantes (a rota de dev escolhe com &celebracao=anel|estrela; o app usa `VARIANTE_PADRAO`):
 *   "estrela" (ESCOLHIDA) — a estrela âmbar grande com o brilho, o "100" enorme em âmbar e "Dia completo" cinza embaixo:
 *             é a proposta do dono quase literal e a mais Cal AI (um número-herói + um rótulo curto, nada mais);
 *   "anel"    — o anel âmbar com a estrela dentro (o desenho do card, grande) + "Dia completo" + "100 de 100 pontos":
 *             bonita como ponte com o card, mas são dois "círculos" e três linhas de texto — mais carregada.
 *
 * Regra de quando abre: a MESMA da comemoração antiga (components/home/CelebracaoDia100) — 1x por dia, chave do
 * aparelho `core-dia-100-visto`. Com a chave `home_nova` desligada a Home antiga continua montando a antiga, intocada.
 */
export type VarianteCelebracao = "anel" | "estrela";
export const VARIANTE_PADRAO: VarianteCelebracao = "estrela";

export const dia100JaVisto = (): boolean => {
  try { return localStorage.getItem(CHAVE_DIA_100_VISTO) === localDayKey(); } catch { return false; }
};
const marcarDia100Visto = () => {
  try { localStorage.setItem(CHAVE_DIA_100_VISTO, localDayKey()); } catch { /* sem storage: no máximo repete */ }
};
/** O dia está em 100 e a comemoração de hoje ainda não abriu: o card do score espera (a festinha toca depois). */
export const celebracaoPendente = (score: number): boolean => score >= 100 && !dia100JaVisto();

interface Props {
  score: number;
  streak: number;
  onAbrir?: () => void;
  onFechar?: () => void;
  variante?: VarianteCelebracao;
  /** só a rota de dev: abre já, sem olhar nem gravar a chave do dia */
  forcar?: boolean;
}

/** A fase da estrela dentro da comemoração: preto → festa → ouro. Com o anel, a festa espera ele encher (~1 s);
 *  só a estrela, ela pula logo depois de a tela aparecer. */
function useFaseDaCelebracao(aberta: boolean, variante: VarianteCelebracao): Fase100 {
  const reduzido = !!useReducedMotion();
  const [fase, setFase] = useState<Fase100>(reduzido ? "ouro" : "preto");
  useEffect(() => {
    if (!aberta) return;
    if (reduzido) { setFase("ouro"); return; }
    setFase("preto");
    const inicio = variante === "anel" ? 1050 : 420;
    const t1 = window.setTimeout(() => setFase("festa"), inicio);
    const t2 = window.setTimeout(() => setFase("ouro"), inicio + DURACAO_FESTA_MS);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [aberta, reduzido, variante]);
  return fase;
}

export const CelebracaoDia100E = ({ score, streak, onAbrir, onFechar, variante = VARIANTE_PADRAO, forcar = false }: Props) => {
  const [aberta, setAberta] = useState(false);
  const reduzido = !!useReducedMotion();
  const completo = score >= 100;
  const fase = useFaseDaCelebracao(aberta, variante);
  useFaixaDoRelogioTransparente(aberta);

  useEffect(() => {
    if (forcar) { setAberta(true); onAbrir?.(); return; }
    if (!completo || dia100JaVisto()) return;
    marcarDia100Visto();
    setAberta(true);
    onAbrir?.();
    // onAbrir é estável o bastante: só a virada pra 100 importa
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completo, forcar]);

  const fechar = () => { setAberta(false); onFechar?.(); };
  /** entrada suave de cada bloco, escalonada; parada com reduzir movimento */
  const entra = (atraso: number) => (reduzido
    ? { initial: false as const }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { delay: atraso, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } });

  const sequencia = streak > 0 && (
    <motion.p className="mt-7 inline-flex items-center gap-1.5 text-[15px] font-semibold text-foreground/80 tabular-nums" data-testid="dia100-sequencia" {...entra(1.25)}>
      <FogoSequencia dias={streak} estado="aceso" tamanho={22} testid="dia100-fogo" />
      {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
    </motion.p>
  );

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Dia completo"
          data-testid="celebracao-100"
          data-folha="dia-100"
          data-variante={variante}
          className="he-dia100 fixed inset-0 z-[400] flex flex-col text-foreground overflow-hidden"
          initial={reduzido ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center pt-[var(--app-safe-top,0px)]">
            {variante === "anel" ? (
              <>
                <div className="relative he-festa-anel" data-testid="dia100-anel">
                  <EcoDoAnel fase={fase} espessura={14} />
                  <Anel tamanho={176} espessura={14} valor={100} max={100} cor={corDaFase(fase)} atraso={0.15}>
                    <EstrelaFesta fase={fase} tamanho={64} testid="dia100-estrela" />
                  </Anel>
                </div>
                <motion.h2 className="mt-10 text-[32px] leading-[1.1] font-bold tracking-[-0.025em]" {...entra(0.5)}>Dia completo</motion.h2>
                <motion.p className="mt-2.5 text-[16px] font-medium text-muted-foreground tabular-nums" data-testid="dia100-pontos" {...entra(0.65)}>
                  {score} de 100 pontos
                </motion.p>
                {sequencia}
              </>
            ) : (
              <>
                <div className="relative grid place-items-center w-[140px] h-[140px]" data-testid="dia100-anel">
                  <EstrelaFesta fase={fase} tamanho={100} testid="dia100-estrela" />
                </div>
                <motion.span
                  className={`he-numero-100 mt-5 text-[84px] leading-[0.9] font-bold tabular-nums tracking-[-0.045em] ${fase === "preto" ? "" : "text-[color:var(--he-ouro-texto)]"}`}
                  data-testid="dia100-pontos"
                  {...entra(0.45)}
                >
                  {score}
                </motion.span>
                <motion.h2 className="mt-3 text-[20px] leading-tight font-semibold text-muted-foreground tracking-[-0.01em]" {...entra(0.6)}>Dia completo</motion.h2>
                {sequencia}
              </>
            )}
          </div>

          <motion.div className="px-5 pb-[max(24px,calc(var(--app-safe-bottom,0px)+12px))]" {...entra(1.1)}>
            <button
              type="button"
              onClick={fechar}
              data-testid="dia100-continuar"
              className="w-full h-14 rounded-full bg-[var(--hn-mais)] text-[var(--hn-mais-texto)] text-[17px] font-semibold active:scale-[0.98] transition-transform"
            >
              Continuar
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
