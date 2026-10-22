import { Check, Moon, Sun } from "lucide-react";
import { useTheme, palettes, type ThemePalette } from "@/hooks/use-theme";
import { trackEvent } from "@/lib/analytics";

/**
 * O MIOLO DA APARÊNCIA (modo claro/escuro + a cor do tema) — o que morava no sol e na paleta do topo da Home.
 * Uma peça só pra dois lugares: a página /voce/aparencia da aba Você (1.0.17, NAV_ABAS) e a sub-tela "Aparência"
 * do menu da conta (1.0.18, lib/menu-novo). `tema_trocado {modo, paleta, origem}` em toda troca.
 */
export function PainelAparencia({ origem }: { origem: "aparencia" | "menu" }) {
  const { mode, toggleMode, palette, setPalette } = useTheme();

  const escolherModo = (m: "light" | "dark") => {
    if (m === mode) return;
    trackEvent("tema_trocado", { modo: m, paleta: palette, origem });
    toggleMode();
  };
  const escolherPaleta = (p: ThemePalette) => {
    if (p === palette) return;
    trackEvent("tema_trocado", { modo: mode, paleta: p, origem });
    setPalette(p);
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 id={`aparencia-modo-${origem}`} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Modo</h2>
        <div role="radiogroup" aria-labelledby={`aparencia-modo-${origem}`} className="grid grid-cols-2 gap-3">
          {([["light", "Claro", Sun], ["dark", "Escuro", Moon]] as const).map(([m, rotulo, Icone]) => {
            const ativo = mode === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={ativo}
                onClick={() => escolherModo(m)}
                data-testid={`modo-${m}`}
                className={`min-h-[88px] rounded-2xl border bg-card flex flex-col items-center justify-center gap-2 transition-colors ${ativo ? "border-foreground ring-1 ring-foreground" : "border-border/60 hover:bg-muted/40"}`}
              >
                <Icone className="w-5 h-5" aria-hidden />
                <span className="text-sm font-semibold">{rotulo}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 id={`aparencia-cor-${origem}`} className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">Cor</h2>
        <ul role="radiogroup" aria-labelledby={`aparencia-cor-${origem}`} className="bg-card rounded-2xl border border-border/60 divide-y divide-border/60 overflow-hidden">
          {(Object.keys(palettes) as ThemePalette[]).map((p) => {
            const ativo = palette === p;
            return (
              <li key={p}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  onClick={() => escolherPaleta(p)}
                  data-testid={`paleta-${p}`}
                  className="w-full min-h-[52px] flex items-center gap-3 px-4 text-left hover:bg-muted/40 transition-colors"
                >
                  <span className="flex -space-x-1" aria-hidden>
                    {palettes[p].preview.map((c, i) => (
                      <span key={i} className="w-4 h-4 rounded-full border border-border/60" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                  <span className="flex-1 text-sm font-medium">{palettes[p].name}</span>
                  {ativo && <Check className="w-4 h-4 text-foreground" aria-label="Escolhida" />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
