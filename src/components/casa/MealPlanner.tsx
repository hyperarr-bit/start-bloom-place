import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DIAS_DO_CARDAPIO, cardapioAntigoDaCasa, levarCardapioAntigo,
} from "@/lib/lista-e-cardapio-unicos";

/**
 * CASA › CARDÁPIO (1.0.22, sem repetição — dono 28/10). Era um segundo cardápio (`casa-meal-plan`, almoço/janta por
 * receita do `casa-recipes`, 0,7% de uso) ao lado do da Dieta (19,4%). Agora esta aba mostra e edita o MESMO cardápio
 * da Dieta (`saude-meals`, no formato de sempre: { SEGUNDA: { "Almoço": "texto" } }) — escrever aqui aparece lá e
 * vice-versa. O cardápio antigo da Casa não é apagado: aparece embaixo ("Do cardápio antigo da Casa") e dá pra levar
 * pro cardápio, preenchendo só o que estiver vazio. O app antigo continua lendo as duas chaves como sempre.
 */
const PADRAO_REFEICOES = ["Café da Manhã", "Almoço", "Lanche", "Janta"];
const EMOJI: Record<string, string> = { "Café da Manhã": "🌅", "Almoço": "🍽️", "Lanche": "🍎", "Janta": "🌙", "Pré-Treino": "⚡", "Pós-Treino": "💪", "Ceia": "🌙", "Café da Tarde": "☕" };
const COR_DO_DIA: Record<string, { header: string; body: string }> = {
  SEGUNDA: { header: "bg-blue-200 dark:bg-blue-900/60", body: "bg-blue-50 dark:bg-blue-950/30" },
  TERÇA: { header: "bg-indigo-200 dark:bg-indigo-900/60", body: "bg-indigo-50 dark:bg-indigo-950/30" },
  QUARTA: { header: "bg-green-200 dark:bg-green-900/60", body: "bg-green-50 dark:bg-green-950/30" },
  QUINTA: { header: "bg-yellow-200 dark:bg-yellow-900/60", body: "bg-yellow-50 dark:bg-yellow-950/30" },
  SEXTA: { header: "bg-pink-200 dark:bg-pink-900/60", body: "bg-pink-50 dark:bg-pink-950/30" },
  SÁBADO: { header: "bg-purple-200 dark:bg-purple-900/60", body: "bg-purple-50 dark:bg-purple-950/30" },
  DOMINGO: { header: "bg-violet-200 dark:bg-violet-900/60", body: "bg-violet-50 dark:bg-violet-950/30" },
};
const diaDeHoje = () => DIAS_DO_CARDAPIO[(new Date().getDay() + 6) % 7];
const nomeDoDia = (d: string) => d.charAt(0) + d.slice(1).toLowerCase();

type Cardapio = Record<string, Record<string, string>>;

const MealPlanner = () => {
  const navigate = useNavigate();
  const [refeicoesSalvas] = usePersistedState<string[]>("dieta-meals-config", PADRAO_REFEICOES);
  const refeicoes = Array.isArray(refeicoesSalvas) && refeicoesSalvas.length ? refeicoesSalvas.filter((m) => typeof m === "string") : PADRAO_REFEICOES;
  // o MESMO padrão da Dieta (todos os dias com as refeições vazias) — a 1ª escrita daqui sai no formato completo
  const padrao = useMemo<Cardapio>(() => Object.fromEntries(DIAS_DO_CARDAPIO.map((d) => [d, Object.fromEntries(refeicoes.map((m) => [m, ""]))])), [refeicoes]);
  const [cardapioBruto, setCardapio] = usePersistedState<Cardapio>("saude-meals", padrao);
  const cardapio: Cardapio = cardapioBruto && typeof cardapioBruto === "object" && !Array.isArray(cardapioBruto) ? cardapioBruto : {};
  // o cardápio antigo da Casa: só leitura (as chaves ficam como estão)
  const [planoAntigo] = usePersistedState<unknown>("casa-meal-plan", {});
  const [receitasAntigas] = usePersistedState<unknown>("casa-recipes", []);
  const antigo = cardapioAntigoDaCasa(planoAntigo, receitasAntigas);
  const levaria = levarCardapioAntigo(cardapio, antigo).preenchidas;

  const [editando, setEditando] = useState<{ dia: string; refeicao: string; texto: string } | null>(null);
  const hoje = diaDeHoje();

  const salvar = () => {
    if (!editando) return;
    const { dia, refeicao, texto } = editando;
    setCardapio((prev) => {
      const base = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
      return { ...base, [dia]: { ...(base[dia] && typeof base[dia] === "object" ? base[dia] : {}), [refeicao]: texto.trim() } };
    });
    setEditando(null);
  };

  const levar = () => {
    const r = levarCardapioAntigo(cardapio, antigo);
    if (r.preenchidas === 0) return;
    setCardapio(r.cardapio);
    toast.success(r.preenchidas === 1 ? "1 refeição entrou no cardápio" : `${r.preenchidas} refeições entraram no cardápio`);
  };

  return (
    <div className="space-y-4" data-testid="cardapio-da-casa">
      <div className="rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-3">
        <p className="text-[11.5px] text-muted-foreground flex-1 leading-snug">
          É o <span className="font-semibold text-foreground">mesmo cardápio da Dieta</span> — o que você escreve aqui aparece lá.
        </p>
        <Button size="sm" variant="outline" className="text-xs h-8 gap-1 shrink-0" onClick={() => navigate("/dieta")}>
          Abrir na Dieta <ArrowRight className="w-3 h-3" />
        </Button>
      </div>

      <div className="space-y-3">
        {DIAS_DO_CARDAPIO.map((dia) => {
          const cor = COR_DO_DIA[dia];
          const doDia = cardapio[dia] && typeof cardapio[dia] === "object" ? cardapio[dia] : {};
          const extras = Object.keys(doDia).filter((m) => !refeicoes.includes(m) && typeof doDia[m] === "string" && doDia[m].trim());
          return (
            <div key={dia} className="rounded-xl overflow-hidden border border-border" data-testid={`cardapio-casa-${dia}`}>
              <div className={`${cor.header} px-3 py-2 flex items-center justify-between`}>
                <h4 className="text-xs font-bold text-foreground">{dia}</h4>
                {dia === hoje && <span className="text-[10px] font-bold text-foreground/70">HOJE</span>}
              </div>
              <div className={`${cor.body} p-2.5 space-y-1.5`}>
                {[...refeicoes, ...extras].map((m) => {
                  const texto = typeof doDia[m] === "string" ? doDia[m] : "";
                  const aberto = editando?.dia === dia && editando.refeicao === m;
                  return (
                    <div key={m} className="flex items-start gap-2">
                      <span className="text-[10.5px] text-muted-foreground w-24 shrink-0 pt-1.5">{EMOJI[m] ?? "🍴"} {m}</span>
                      {aberto ? (
                        <Input
                          autoFocus
                          value={editando.texto}
                          onChange={(e) => setEditando({ ...editando, texto: e.target.value })}
                          onBlur={salvar}
                          onKeyDown={(e) => { if (e.key === "Enter") salvar(); if (e.key === "Escape") setEditando(null); }}
                          className="text-xs h-8 flex-1 bg-background/80"
                          aria-label={`${m} de ${nomeDoDia(dia)}`}
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditando({ dia, refeicao: m, texto })}
                          className="flex-1 min-w-0 text-left text-xs rounded-md px-2 py-1.5 bg-background/60 hover:bg-background/90 flex items-center gap-1.5"
                          aria-label={`Editar ${m} de ${nomeDoDia(dia)}`}
                        >
                          <span className={`flex-1 min-w-0 ${texto ? "" : "text-muted-foreground italic"}`}>{texto || "—"}</span>
                          <Pencil className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {antigo.length > 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card p-3 space-y-2" data-testid="cardapio-antigo-casa">
          <p className="text-[10px] font-bold text-muted-foreground">DO CARDÁPIO ANTIGO DA CASA</p>
          <ul className="space-y-1">
            {antigo.map((d) => (
              <li key={d.dia} className="text-xs">
                <span className="font-semibold">{nomeDoDia(d.dia)}:</span>{" "}
                {[d.almoco && `🌞 ${d.almoco}`, d.janta && `🌙 ${d.janta}`].filter(Boolean).join(" · ")}
              </li>
            ))}
          </ul>
          {levaria > 0 ? (
            <Button size="sm" variant="outline" className="text-xs h-8 w-full" onClick={levar} data-testid="levar-cardapio-antigo">
              Levar pro cardápio (só onde estiver vazio)
            </Button>
          ) : (
            <p className="text-[10.5px] text-muted-foreground">Já está no cardápio (ou o dia já tinha outra refeição escrita).</p>
          )}
        </div>
      )}
    </div>
  );
};

export default MealPlanner;
