/**
 * MONTE SUA ROTINA EM 3 TOQUES (28/09, protótipo). A Rotina da Beleza abria
 * VAZIA ("Adicione seus passos") e 32% das pessoas que entram saem em 35 s.
 * Agora quem chega sem rotina vê a primeira pergunta ali mesmo, na aba — nada
 * de folha nem de botão "começar": cada toque numa resposta já é a próxima
 * pergunta, e o terceiro toque grava a rotina de manhã e de noite.
 *
 * Nas avaliações de apps de pele, "recomendação ou quiz" é o 2º motivo de 5★
 * (12,9%) e "fácil e simples" o 1º. Sem foto do rosto, sem IA de pele: três
 * perguntas que a pessoa sabe responder.
 *
 * Visual da Beleza (kit): cabeçalho rosé com "Monte sua rotina" em serifa,
 * progresso em pílulas magenta, respostas em linhas macias com o emoji num
 * círculo blush.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CartaoBeleza, ROTULO_BZ, Serif } from "./kit";
import {
  OPCOES_NIVEL, OPCOES_OBJETIVO, OPCOES_PELE, type Nivel, type Objetivo, type PerfilDaPele, type TipoDePele,
} from "@/lib/beleza-rotina";

const ROTULO = ROTULO_BZ;

const PERGUNTAS = [
  { titulo: "Como é a sua pele?", opcoes: OPCOES_PELE },
  { titulo: "O que você mais quer cuidar agora?", opcoes: OPCOES_OBJETIVO },
  { titulo: "Quanto de rotina você topa?", opcoes: OPCOES_NIVEL },
] as const;

export function MontarRotina({
  onPronto,
  onDoZero,
  onCancelar,
  passosAtuais = 0,
}: {
  onPronto: (perfil: PerfilDaPele) => void;
  /** "Prefiro montar do zero" — só pra quem ainda não tem rotina */
  onDoZero?: () => void;
  /** refazendo as perguntas com rotina existente: dá pra desistir */
  onCancelar?: () => void;
  passosAtuais?: number;
}) {
  const [passo, setPasso] = useState(0);
  const [pele, setPele] = useState<TipoDePele | null>(null);
  const [objetivo, setObjetivo] = useState<Objetivo | null>(null);
  const pergunta = PERGUNTAS[passo];

  const responder = (id: string) => {
    if (passo === 0) { setPele(id as TipoDePele); setPasso(1); return; }
    if (passo === 1) { setObjetivo(id as Objetivo); setPasso(2); return; }
    if (pele && objetivo) onPronto({ pele, objetivo, nivel: id as Nivel });
  };
  const escolhido = passo === 0 ? pele : passo === 1 ? objetivo : null;

  return (
    <CartaoBeleza data-card="montar-rotina" data-testid="montar-rotina">
      <div className="bg-bz-rose text-bz-rose-tinta px-2 pt-3 pb-3.5">
        <div className="flex items-start gap-1.5">
          {passo > 0 ? (
            <button type="button" onClick={() => setPasso((p) => p - 1)} aria-label="Pergunta anterior" className="w-10 h-10 -mt-0.5 shrink-0 grid place-items-center rounded-full bg-bz-cartao/60">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-2 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold tracking-[.16em] opacity-80">3 PERGUNTAS · 20 SEGUNDOS</p>
            <h2 className="mt-0.5 text-[21px] leading-[1.1] font-bold tracking-tight">
              Monte sua <Serif className="text-[25px] font-normal">rotina</Serif>
            </h2>
            <p className="text-[12px] opacity-85 mt-0.5">sai pronta, de manhã e de noite</p>
          </div>
          <span className="shrink-0 pr-2 pt-0.5 text-[13px] font-extrabold tabular-nums" data-testid="pergunta-n">{passo + 1}/3</span>
        </div>
        <div className="mt-3 mx-2 grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((k) => <span key={k} className={cn("h-1.5 rounded-full", k <= passo ? "bg-bz-acento" : "bg-bz-cartao/70")} />)}
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className={ROTULO}>PERGUNTA {passo + 1} DE 3</p>
        <h3 className="mt-1 text-[19px] font-bold leading-snug text-bz-tinta">{pergunta.titulo}</h3>
        {passosAtuais > 0 && passo === 0 && (
          <p className="mt-1.5 text-[12px] text-bz-alerta-tinta">A rotina nova troca a de agora ({passosAtuais} passos). Os seus produtos ficam. Dá pra desfazer.</p>
        )}
      </div>

      <div className="mx-4 mb-3 rounded-2xl border border-bz-linha overflow-hidden">
        {pergunta.opcoes.map((o, k) => (
          <button
            key={o.id}
            type="button"
            onClick={() => responder(o.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 min-h-[60px] text-left transition-colors active:bg-bz-blush",
              k > 0 && "border-t border-bz-linha",
              escolhido === o.id ? "bg-bz-dica" : "bg-bz-cartao",
            )}
            data-testid={`opcao-${o.id}`}
          >
            <span className="w-10 h-10 shrink-0 grid place-items-center rounded-full bg-bz-blush text-[19px] leading-none" aria-hidden="true">{o.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold leading-snug text-bz-tinta">{o.rotulo}</span>
              <span className="block text-[12px] text-bz-suave leading-snug">{o.dica}</span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-bz-suave" aria-hidden="true" />
          </button>
        ))}
      </div>

      {onDoZero && passo === 0 && (
        <button type="button" onClick={onDoZero} className="w-full h-11 border-t border-bz-linha bg-transparent text-[13px] font-semibold text-bz-suave active:bg-bz-blush" data-testid="do-zero">
          Prefiro montar do zero
        </button>
      )}
      {onCancelar && (
        <button type="button" onClick={onCancelar} className="w-full h-11 border-t border-bz-linha bg-transparent text-[13px] font-semibold text-bz-suave active:bg-bz-blush">
          Cancelar — manter minha rotina
        </button>
      )}
    </CartaoBeleza>
  );
}
