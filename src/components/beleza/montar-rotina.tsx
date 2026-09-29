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
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  OPCOES_NIVEL, OPCOES_OBJETIVO, OPCOES_PELE, type Nivel, type Objetivo, type PerfilDaPele, type TipoDePele,
} from "@/lib/beleza-rotina";

const ROTULO = "text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground";

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
    <section className="rounded-2xl border border-pink-100 overflow-hidden bg-card" data-card="montar-rotina" data-testid="montar-rotina">
      <div className="bg-pink-500 text-white px-2 pt-2.5 pb-3">
        <div className="flex items-start gap-1">
          {passo > 0 ? (
            <button type="button" onClick={() => setPasso((p) => p - 1)} aria-label="Pergunta anterior" className="w-10 h-10 -mt-1 shrink-0 grid place-items-center rounded-full hover:bg-white/15">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-2 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-extrabold tracking-wide leading-tight">MONTE SUA ROTINA</h2>
            <p className="text-[12px] opacity-90 mt-0.5">3 perguntas · sai pronta, de manhã e de noite</p>
          </div>
          <span className="shrink-0 pr-2 text-[13px] font-extrabold tabular-nums" data-testid="pergunta-n">{passo + 1}/3</span>
        </div>
        <div className="mt-2.5 mx-2 grid grid-cols-3 gap-1" aria-hidden="true">
          {[0, 1, 2].map((k) => <span key={k} className={cn("h-1.5 rounded-full bg-white", k <= passo ? "opacity-95" : "opacity-30")} />)}
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className={ROTULO}>PERGUNTA {passo + 1} DE 3</p>
        <h3 className="mt-1 text-[18px] font-bold leading-snug">{pergunta.titulo}</h3>
        {passosAtuais > 0 && passo === 0 && (
          <p className="mt-1 text-[12px] text-amber-700 dark:text-amber-300">A rotina nova troca a de agora ({passosAtuais} passos). Os seus produtos ficam. Dá pra desfazer.</p>
        )}
      </div>

      <div className="mx-4 mb-3 rounded-xl border border-pink-100 overflow-hidden">
        {pergunta.opcoes.map((o, k) => (
          <button
            key={o.id}
            type="button"
            onClick={() => responder(o.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 min-h-[58px] text-left active:bg-pink-50 transition-colors",
              k > 0 && "border-t border-pink-100",
              escolhido === o.id && "bg-pink-50",
            )}
            data-testid={`opcao-${o.id}`}
          >
            <span className="w-8 text-center text-[20px] leading-none shrink-0" aria-hidden="true">{o.emoji}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14.5px] font-semibold leading-snug">{o.rotulo}</span>
              <span className="block text-[12px] text-muted-foreground leading-snug">{o.dica}</span>
            </span>
            <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
        ))}
      </div>

      {onDoZero && passo === 0 && (
        <button type="button" onClick={onDoZero} className="w-full h-11 border-t border-pink-100 text-[13px] font-semibold text-muted-foreground active:bg-muted/40" data-testid="do-zero">
          Prefiro montar do zero
        </button>
      )}
      {onCancelar && (
        <button type="button" onClick={onCancelar} className="w-full h-11 border-t border-pink-100 text-[13px] font-semibold text-muted-foreground active:bg-muted/40">
          Cancelar — manter minha rotina
        </button>
      )}
    </section>
  );
}
