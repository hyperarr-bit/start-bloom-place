import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { localDayKey } from "@/lib/utils";
import type { Sequencia } from "@/components/conquistas/use-conquistas";
import { CHAVE_FOGO_ACESO_HOME_NOVA } from "@/lib/home-nova";
import { FogoSequencia, estadoDoFogo as estadoDoFogoUnificado, type EstadoDoFogo } from "@/components/fogo/FogoSequencia";

/**
 * A PÍLULA DO FOGO — APAGADA × ACESA (Home nova, 1.0.19). 26/10: o desenho é o FOGO UNIFICADO (components/fogo —
 * o mesmo da sequência das Conquistas do Codex, na paleta suave do caderno); o número em preto (como o "🔥 0" do Cal AI).
 *
 * Estilo Duolingo: enquanto o dia NÃO está garantido (a mesma regra `hojeFeito` do useSequencia), o fogo fica
 * APAGADO — a chama desbotada e parada, o número em cinza-escuro. Quando o dia é garantido, ACENDE: a chama viva
 * (o fluxo contínuo do CoreFire) + o ACENDER do CoreFire, UMA vez por dia (chave do aparelho `core-home-nova-fogo`;
 * prefers-reduced-motion desliga). Sem sequência: cinza. O toque abre a FOLHA DA SEQUÊNCIA.
 */
export type SeqDaPilula = Pick<Sequencia, "dias" | "faixa" | "hojeFeito">;
export type { EstadoDoFogo };

/** neutro = sem sequência · apagado = sequência viva mas HOJE ainda não garantido · aceso = garantido hoje. */
export const estadoDoFogo = (seq: SeqDaPilula): EstadoDoFogo => estadoDoFogoUnificado(seq);

const CHAVE_ACESO = CHAVE_FOGO_ACESO_HOME_NOVA; // chave do aparelho (lib/chaves-do-aparelho)
/** Ainda não acendeu hoje neste aparelho? (só lê — quem marca é o efeito, quando o acender começa) */
const faltaAcenderHoje = (hoje: string): boolean => {
  try { return localStorage.getItem(CHAVE_ACESO) !== hoje; } catch { return true; }
};
const marcarAcesoHoje = (hoje: string) => { try { localStorage.setItem(CHAVE_ACESO, hoje); } catch { /* sem storage: acende de novo, sem dano */ } };

/** Quanto a chama fica APAGADA antes de acender quando a pílula já MONTA com o dia garantido (voltou de um módulo
 * depois do 1º registro): a pessoa vê o fogo apagado e ele acende — não aparece já aceso. */
export const ESPERA_ANTES_DE_ACENDER_MS = 420;
/** O acender do CoreFire (cf-ignite 0,85 s + faíscas) com folga. */
const DURACAO_ACENDER_MS = 1100;

interface Props {
  seq: SeqDaPilula;
  onTocar: () => void;
  animar?: boolean;
  /** uma folha da Home está por cima (o "+", o score…): o acender ESPERA ela fechar — a pessoa precisa ver o fogo acender */
  coberta?: boolean;
}

/**
 * O ACENDER (adendo do dono, 26/10): toca no 1º registro do dia — (a) na hora, se a pessoa registrou com a Home na
 * tela (pelo "+": apagado → aceso sem desmontar) e (b) quando ela VOLTA pra Home logo depois de registrar num módulo
 * (a pílula monta já com o dia garantido: mostra apagada ~0,4 s e acende). 1x por dia por aparelho
 * (`core-home-nova-fogo`). Registrou pelo "+" (a folha cobre a pílula): o fogo fica apagado e acende ~0,4 s depois
 * que a folha fecha. Abrir o app de novo ou trocar de aba no mesmo dia não acende. A passagem apagado → aceso
 * vem DENTRO do acender (a opacidade sobe 0,52 → 1 junto com o cf-ignite — core-fire.css), sem pulo.
 * O estado é decidido NA RENDERIZAÇÃO (não num efeito) pra que "aceso" e "acendendo" entrem no MESMO quadro.
 */
export const PilulaFogoE = ({ seq, onTocar, animar = true, coberta = false }: Props) => {
  const estado = estadoDoFogo(seq);
  const hoje = localDayKey();
  const reduzir = useReducedMotion();
  const vivo = animar && !reduzir; // movimento reduzido: sem o "apagado → acende", só o estado
  // fase: null (normal) · "antes" (montou aceso, falta acender hoje: mostra apagada) · "acendendo"
  const [fase, setFase] = useState<"antes" | "acendendo" | null>(() => (vivo && estado === "aceso" && faltaAcenderHoje(hoje) ? "antes" : null));
  const [estadoAnterior, setEstadoAnterior] = useState(estado);
  if (estado !== estadoAnterior) {
    setEstadoAnterior(estado);
    // registrou com a Home na tela: apagado → aceso acende no MESMO quadro (com uma folha por cima — o "+" — fica
    // apagada até a folha fechar)
    if (vivo && estado === "aceso" && estadoAnterior !== "aceso" && faltaAcenderHoje(hoje)) setFase(coberta ? "antes" : "acendendo");
    else if (estado !== "aceso" && fase) setFase(null);
  }
  useEffect(() => {
    if (fase === null || (fase === "antes" && coberta)) return;
    // marca quando o acender COMEÇA: se a pílula sair da tela durante o "antes" (trocou de aba), acende na volta
    if (fase === "acendendo") marcarAcesoHoje(hoje);
    const t = window.setTimeout(() => setFase(fase === "antes" ? "acendendo" : null), fase === "antes" ? ESPERA_ANTES_DE_ACENDER_MS : DURACAO_ACENDER_MS);
    return () => window.clearTimeout(t);
  }, [fase, hoje, coberta]);
  const mostrado: EstadoDoFogo = fase === "antes" ? "apagado" : estado;
  const acendendo = fase === "acendendo";
  const rotulo = estado === "neutro" ? "Sem sequência — ver sua sequência" : `${seq.dias} dias de sequência${estado === "apagado" ? ", hoje ainda não garantido" : ", garantido hoje"} — ver sua sequência`;
  return (
    <button
      type="button"
      onClick={onTocar}
      aria-label={rotulo}
      data-testid="hn-pilula-fogo"
      data-fogo={estado}
      data-acendendo={acendendo ? "1" : undefined}
      className="hn-card !rounded-full h-11 pl-2 pr-3.5 flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
    >
      <FogoSequencia dias={seq.dias} estado={mostrado} tamanho={26} acender={acendendo} />
      <span
        className={`text-[17px] font-bold tabular-nums leading-none transition-colors duration-300 ${mostrado === "neutro" ? "text-muted-foreground" : mostrado === "apagado" ? "text-foreground/65" : "text-foreground"}`}
        data-testid="hn-pilula-dias"
      >
        {seq.dias}
      </span>
    </button>
  );
};
