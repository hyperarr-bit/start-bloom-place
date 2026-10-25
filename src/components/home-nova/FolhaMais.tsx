import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Check, DollarSign, Droplets, Dumbbell, Heart, Lightbulb, ListTodo, Moon, Scale, Shield, SmilePlus, Utensils, X } from "lucide-react";
import { toast } from "sonner";
import type { ActionId } from "@/components/home/QuickActions";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl, rotuloMl } from "@/lib/saude-copo";

/**
 * A FOLHA DO "+" (mockup 25/10) — onde as Ações rápidas foram morar. Sobe de baixo (como a folha de
 * compartilhar do iOS): a pergunta, e uma grade de 4 colunas com as 12 ações de hoje, na ordem de uso real
 * (água e humor são as mais tocadas na Home, então vêm primeiro). Mesmas cores e ícones da fileira atual.
 *
 * No mockup: Água e Humor respondem na hora (✓ e toast, sem gravar nada); Gasto mostra o formulário de
 * valor + categoria; o resto avisa qual formulário abriria. Na versão de verdade cada ação reaproveita o
 * formulário de QuickActions.tsx — a lógica de gravar já existe lá.
 */
interface Acao { id: ActionId; Icone: typeof Droplets; rotulo: string; detalhe?: string; cor: string; corIcone: string }

const ACOES: Acao[] = [
  { id: "water", Icone: Droplets, rotulo: "Água", cor: "bg-cyan-400/20", corIcone: "text-cyan-600" },
  { id: "mood", Icone: SmilePlus, rotulo: "Humor", cor: "bg-pink-400/20", corIcone: "text-pink-600" },
  { id: "expense", Icone: DollarSign, rotulo: "Gasto", cor: "bg-amber-400/20", corIcone: "text-amber-600" },
  { id: "income", Icone: Banknote, rotulo: "Ganho", cor: "bg-green-400/20", corIcone: "text-green-600" },
  { id: "task", Icone: ListTodo, rotulo: "Tarefa", cor: "bg-emerald-400/20", corIcone: "text-emerald-600" },
  { id: "workout", Icone: Dumbbell, rotulo: "Treino", cor: "bg-orange-400/20", corIcone: "text-orange-600" },
  { id: "sleep", Icone: Moon, rotulo: "Sono", cor: "bg-indigo-400/20", corIcone: "text-indigo-600" },
  { id: "meal", Icone: Utensils, rotulo: "Refeição", cor: "bg-lime-400/20", corIcone: "text-lime-600" },
  { id: "weight", Icone: Scale, rotulo: "Peso", cor: "bg-purple-400/20", corIcone: "text-purple-600" },
  { id: "idea", Icone: Lightbulb, rotulo: "Ideia", cor: "bg-yellow-400/20", corIcone: "text-yellow-600" },
  { id: "gratitude", Icone: Heart, rotulo: "Gratidão", cor: "bg-rose-400/20", corIcone: "text-rose-600" },
  { id: "detox", Icone: Shield, rotulo: "Detox", cor: "bg-teal-400/20", corIcone: "text-teal-600" },
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

export const FolhaMais = ({ aberta, onFechar, inicial }: Props) => {
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
    if (a.id === "water") return concluir("water", `💧 +${rotuloMl(copo)} de água`);
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
                <X className="w-4 h-4" strokeWidth={2.4} />
              </button>
            </div>

            {ativa === null && (
              <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-1" data-testid="hn-acoes">
                {ACOES.map((a) => {
                  const ok = feita === a.id;
                  return (
                    <button key={a.id} type="button" onClick={() => tocar(a)} data-acao={a.id} className="flex flex-col items-center gap-2 min-h-[44px] active:scale-95 transition-transform">
                      <span className={`w-[58px] h-[58px] rounded-[20px] grid place-items-center ${ok ? "bg-success/15" : a.cor}`}>
                        {ok ? <Check className="w-6 h-6 text-success" strokeWidth={3} aria-hidden /> : <a.Icone className={`w-6 h-6 ${a.corIcone}`} strokeWidth={2.1} aria-hidden />}
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
                    <span className={`text-[12px] font-medium ${feita === "mood" && i === 3 ? "text-success" : "text-muted-foreground"}`}>{h.rotulo}</span>
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
                  <button type="button" onClick={() => concluir("expense", `💸 Gasto em ${categoria} registrado`)} className="h-12 px-5 rounded-2xl text-[15px] font-bold" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Salvar</button>
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
