import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Check, Droplets, Dumbbell, Heart, Leaf, Lightbulb, ListTodo, Moon, Scale, Smile, Utensils, Wallet, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import type { ActionId } from "@/components/home/QuickActions";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl, rotuloMl } from "@/lib/saude-copo";
import { TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, tinta, type Tom } from "./paleta";

/**
 * A FOLHA DO "+" DA OPÇÃO E (rodada 4) — a mesma folha da direção A (../FolhaMais.tsx: a pergunta e a grade de
 * 4 colunas com as 12 ações rápidas, na ordem de uso real), agora na PALETA ÚNICA e na família de ícones da
 * rodada 3: cada ação num azulejo da cor do módulo de origem a 14 % (18 % no escuro) com o ícone na cor cheia,
 * traço 1,75 — os mesmos ícones das pendências e da folha da pontuação (água = gotas, humor = sorriso, gasto =
 * carteira, sono = lua, refeição = talheres, peso = balança, ideia = lâmpada, gratidão = coração, detox = folha).
 * Variante só da E: o arquivo da A não muda.
 *
 * No mockup: Água e Humor respondem na hora (✓ e toast, sem gravar nada); Gasto mostra o formulário de valor +
 * categoria; o resto avisa qual formulário abriria. Na versão de verdade cada ação reaproveita o formulário de
 * QuickActions.tsx — a lógica de gravar já existe lá.
 */
interface Acao { id: ActionId; Icone: LucideIcon; rotulo: string; tom: Tom }

const ACOES: Acao[] = [
  { id: "water", Icone: Droplets, rotulo: "Água", tom: TOM_DO_TIPO.agua },
  { id: "mood", Icone: Smile, rotulo: "Humor", tom: TOM_DO_TIPO.humor },
  { id: "expense", Icone: Wallet, rotulo: "Gasto", tom: TOM_DO_TIPO.gasto },
  { id: "income", Icone: Banknote, rotulo: "Ganho", tom: TOM_DO_MODULO.rotina },
  { id: "task", Icone: ListTodo, rotulo: "Tarefa", tom: TOM_DO_MODULO.casa },
  { id: "workout", Icone: Dumbbell, rotulo: "Treino", tom: TOM_DO_TIPO.treino },
  { id: "sleep", Icone: Moon, rotulo: "Sono", tom: TOM_DO_TIPO.sono },
  { id: "meal", Icone: Utensils, rotulo: "Refeição", tom: TOM_DO_TIPO.refeicoes },
  { id: "weight", Icone: Scale, rotulo: "Peso", tom: TOM_DO_TIPO.peso },
  { id: "idea", Icone: Lightbulb, rotulo: "Ideia", tom: TOM_DO_TIPO.ideia },
  { id: "gratitude", Icone: Heart, rotulo: "Gratidão", tom: TOM_DO_TIPO.gratidao },
  { id: "detox", Icone: Leaf, rotulo: "Detox", tom: TOM_DO_MODULO.detox },
];

const HUMORES = [
  { emoji: "😡", rotulo: "Péssimo" }, { emoji: "😔", rotulo: "Ruim" }, { emoji: "😐", rotulo: "Neutro" }, { emoji: "🙂", rotulo: "Bom" }, { emoji: "🤩", rotulo: "Ótimo" },
];
const CATEGORIAS = ["Alimentação", "Transporte", "Lazer", "Saúde", "Educação", "Compras", "Outros"];

interface Props {
  aberta: boolean;
  onFechar: () => void;
  /** já abre numa ação (toque numa pendência) */
  inicial?: ActionId | null;
}

export const FolhaMaisE = ({ aberta, onFechar, inicial }: Props) => {
  const { get } = useUserData();
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  const [ativa, setAtiva] = useState<ActionId | null>(null);
  const [feita, setFeita] = useState<ActionId | null>(null);
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Outros");

  useEffect(() => { if (aberta) { setAtiva(inicial ?? null); setFeita(null); } }, [aberta, inicial]);

  const concluir = (id: ActionId, msg: string) => {
    setFeita(id);
    toast.success(msg);
    window.setTimeout(() => { setFeita(null); setAtiva(null); onFechar(); }, 700);
  };

  const tocar = (a: Acao) => {
    if (a.id === "water") return concluir("water", `+${rotuloMl(copo)} de água`);
    if (a.id === "mood" || a.id === "expense") return setAtiva(a.id);
    toast(`Abre o formulário de ${a.rotulo} (o mesmo de hoje)`);
    onFechar();
  };

  const titulo = ativa === "mood" ? "Como você está agora?" : ativa === "expense" ? "Registrar gasto" : "O que você quer registrar?";

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button
            type="button" aria-label="Fechar" onClick={onFechar}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          />
          <motion.div
            role="dialog" aria-label="Registrar agora" data-testid="hn-folha-mais"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <span className="block w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" aria-hidden />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[19px] font-bold tracking-tight">{titulo}</h3>
              <button type="button" onClick={ativa ? () => setAtiva(null) : onFechar} aria-label={ativa ? "Voltar" : "Fechar"} className="w-9 h-9 -mr-1.5 rounded-full grid place-items-center bg-muted">
                <X className="w-4 h-4" strokeWidth={2.2} />
              </button>
            </div>

            {ativa === null && (
              <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-1" data-testid="hn-acoes">
                {ACOES.map((a) => {
                  const ok = feita === a.id;
                  return (
                    <button key={a.id} type="button" onClick={() => tocar(a)} data-acao={a.id} className="flex flex-col items-center gap-2 min-h-[44px] active:scale-95 transition-transform">
                      <span className="w-[58px] h-[58px] rounded-[20px] grid place-items-center" style={{ background: tinta(a.tom), color: cor(a.tom) }}>
                        {ok ? <Check className="w-6 h-6" strokeWidth={2.5} aria-hidden /> : <a.Icone className="w-6 h-6" strokeWidth={TRACO} aria-hidden />}
                      </span>
                      <span className="text-[12.5px] font-medium leading-tight text-center">
                        {ok ? "Feito!" : a.rotulo}
                        {a.id === "water" && !ok && <span className="block text-[11px] text-muted-foreground font-normal">+{rotuloMl(copo)}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {ativa === "mood" && (
              <div className="grid grid-cols-5 gap-1 pb-2" data-testid="hn-humores">
                {HUMORES.map((h, i) => (
                  <button key={h.rotulo} type="button" onClick={() => concluir("mood", `${h.emoji} Humor registrado`)} className="flex flex-col items-center gap-2 py-2 rounded-2xl active:bg-muted/60">
                    <span className="text-[36px] leading-none" aria-hidden>{h.emoji}</span>
                    <span className={`text-[12px] font-medium ${feita === "mood" && i === 3 ? "text-foreground" : "text-muted-foreground"}`}>{h.rotulo}</span>
                  </button>
                ))}
              </div>
            )}

            {ativa === "expense" && (
              <div className="space-y-3 pb-1" data-testid="hn-gasto">
                <div className="flex gap-2">
                  <input
                    inputMode="decimal" placeholder="R$ 0,00" value={valor} onChange={(e) => setValor(e.target.value)} autoFocus
                    className="flex-1 h-12 rounded-2xl bg-muted px-4 text-[16px] font-semibold outline-none placeholder:text-muted-foreground/60"
                  />
                  <button type="button" onClick={() => concluir("expense", `Gasto em ${categoria} registrado`)} className="h-12 px-5 rounded-2xl text-[15px] font-bold" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Salvar</button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIAS.map((c) => (
                    <button key={c} type="button" onClick={() => setCategoria(c)} className={`h-9 px-3.5 rounded-full text-[13px] font-semibold ${categoria === c ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}>{c}</button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
