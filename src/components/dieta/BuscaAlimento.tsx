import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buscarAlimentos, carregarTaco, porcao, rotuloDaPorcao, type Alimento } from "@/lib/taco";
import { trackEvent } from "@/lib/analytics";

/**
 * Busca na tabela TACO + quantidade em gramas → uma entrada pro diário com
 * kcal e macros já calculados (22/09). Ver lib/taco.ts. O componente não
 * grava nada: devolve a entrada pronta em `onAdicionar`, e quem chama decide
 * a chave (o diário da Dieta grava em core-dieta-log, que é o que os widgets
 * Calorias e Macros do Dia leem).
 */
export type EntradaDeAlimento = { name: string; calories: number; protein: number; carbs: number; fat: number };

const GRAMAS_RAPIDAS = [50, 100, 150, 200];

export const BuscaAlimento = ({ onAdicionar, onFechar }: { onAdicionar: (e: EntradaDeAlimento) => void; onFechar?: () => void }) => {
  const [tabela, setTabela] = useState<Alimento[] | null>(null);
  const [erro, setErro] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [escolhido, setEscolhido] = useState<Alimento | null>(null);
  const [gramas, setGramas] = useState("100");

  useEffect(() => {
    let vivo = true;
    carregarTaco().then((t) => { if (vivo) setTabela(t); }).catch(() => { if (vivo) setErro(true); });
    return () => { vivo = false; };
  }, []);

  const resultados = useMemo(() => (tabela ? buscarAlimentos(tabela, consulta) : []), [tabela, consulta]);
  const g = Math.round(Number(String(gramas).replace(",", ".")) || 0);
  const calc = escolhido ? porcao(escolhido, g) : null;

  const adicionar = () => {
    if (!escolhido || !calc || g <= 0) return;
    onAdicionar({ name: rotuloDaPorcao(escolhido, g), calories: calc.kcal, protein: calc.p, carbs: calc.c, fat: calc.g });
    trackEvent("dieta_alimento_taco", { id: escolhido.id, gramas: g });
    setEscolhido(null);
    setConsulta("");
    setGramas("100");
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2" data-testid="busca-alimento">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={consulta}
            onChange={(e) => { setConsulta(e.target.value); setEscolhido(null); }}
            placeholder="Buscar alimento (ex.: arroz, frango, banana)"
            className="h-9 text-xs pl-8"
            aria-label="Buscar alimento na tabela"
            autoFocus
          />
        </div>
        {onFechar && (
          <button type="button" onClick={onFechar} aria-label="Fechar busca" className="text-muted-foreground p-1"><X className="w-4 h-4" /></button>
        )}
      </div>

      {erro && <p className="text-[11px] text-destructive">Não consegui carregar a tabela de alimentos. Tenta de novo com internet.</p>}
      {!tabela && !erro && consulta.length >= 2 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> carregando a tabela…</p>
      )}

      {!escolhido && tabela && consulta.length >= 2 && (
        resultados.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Nada com esse nome na tabela. Tenta uma palavra só (ex.: "feijão").</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border bg-card max-h-56 overflow-y-auto" data-testid="resultados-alimento">
            {resultados.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setEscolhido(a)} className="w-full text-left px-3 py-2 hover:bg-muted/50">
                  <p className="text-xs font-medium leading-snug">{a.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{a.kcal} kcal · P {a.p} · C {a.c} · G {a.g} <span className="opacity-70">/ 100 g</span></p>
                </button>
              </li>
            ))}
          </ul>
        )
      )}

      {escolhido && calc && (
        <div className="space-y-2" data-testid="porcao-alimento">
          <p className="text-xs font-semibold">{escolhido.nome}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {GRAMAS_RAPIDAS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setGramas(String(q))}
                className={`h-7 px-2 rounded-md text-[11px] font-semibold border ${g === q ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}
              >
                {q} g
              </button>
            ))}
            <Input
              type="number"
              inputMode="numeric"
              value={gramas}
              onChange={(e) => setGramas(e.target.value)}
              className="h-7 w-20 text-xs"
              aria-label="Quantidade em gramas"
            />
            <span className="text-[11px] text-muted-foreground">g</span>
          </div>
          <div className="grid grid-cols-4 gap-1 text-center">
            {[["kcal", calc.kcal], ["P", `${calc.p} g`], ["C", `${calc.c} g`], ["G", `${calc.g} g`]].map(([k, v]) => (
              <div key={String(k)} className="rounded-md bg-card border border-border py-1">
                <p className="text-[9px] text-muted-foreground uppercase">{k}</p>
                <p className="text-xs font-bold tabular-nums">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={adicionar} disabled={g <= 0} className="h-8 text-xs flex-1"><Plus className="w-3.5 h-3.5 mr-1" /> Adicionar ao dia</Button>
            <Button size="sm" variant="ghost" onClick={() => setEscolhido(null)} className="h-8 text-xs">Trocar</Button>
          </div>
        </div>
      )}
    </div>
  );
};
