import { ChevronLeft, ChevronRight } from "lucide-react";
import { AREAS, DOOR_AREAS, type AreaKey } from "@/lib/funnel";

/**
 * TELA 2 DO APP DAS LOJAS — a porta do /inicio como PERGUNTA PURA, no molde
 * exato do QuizScreen (decisão do dono 23/07): sem headline, sem grade de 16
 * ícones, sem rodapé de captura. Barra em ~12% (a porta é o passo 1 do
 * fluxo), sem contador. O ← reabre o welcome (overlay na mesma rota).
 *
 * Só monta no shell nativo (branch em Comecar.tsx); o web segue na
 * VitrineStartScreen intocada. Classes copiadas 1:1 do QuizScreen — se o
 * molde do quiz web mudar, espelhar aqui. A geometria (sem padding próprio,
 * header mb-8) tem que bater PIXEL com o QuizScreen no shell top-aligned.
 */
// Mesma paleta da grade do welcome — a tela 1 e as perguntas conversam.
const TILE_CORES = ["#fdeccb", "#cdeeee", "#d9e4fb", "#e6def8", "#fbd8e8"];

export function PortaPerguntaApp({ onPickArea, onBack }: {
  onPickArea: (area: AreaKey, label: string) => void;
  onBack: () => void;
}) {
  const options: Array<{ area: AreaKey; emoji: string; label: string }> = [
    ...DOOR_AREAS.map((key) => ({ area: key, emoji: AREAS[key].emoji, label: AREAS[key].label })),
    { area: "dinheiro" as AreaKey, emoji: "😵", label: "Tudo, sinceramente" },
  ];

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="-ml-1 p-1 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent rounded-full" style={{ width: "12%" }} />
        </div>
      </div>

      <h2 className="text-[27px] font-black tracking-tight leading-[1.15] mb-7">
        Qual área tá mais fora de controle hoje?
      </h2>
      <div className="space-y-3">
        {options.map((o, oi) => (
          <button
            key={o.label}
            onClick={() => onPickArea(o.area, o.label)}
            className="group w-full flex items-center gap-3.5 rounded-2xl border border-[#e8eef4] bg-white p-3.5 text-left shadow-[0_10px_24px_-14px_rgba(20,40,70,0.25)] active:scale-[0.99] transition-all"
          >
            <span
              className="grid place-items-center w-11 h-11 rounded-xl text-2xl shrink-0"
              style={{ background: TILE_CORES[oi % TILE_CORES.length] }}
            >{o.emoji}</span>
            <span className="font-semibold text-[15px] flex-1 leading-snug">{o.label}</span>
            <ChevronRight className="w-4 h-4 text-[#c3cad2] shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
