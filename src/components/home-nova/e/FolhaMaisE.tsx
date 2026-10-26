import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Alca, useFolhaArrastavel } from "./folha-arrasto";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Banknote, Droplets, Dumbbell, Heart, Leaf, Lightbulb, ListTodo, Moon, Scale, Smile, Utensils, Wallet, X, type LucideIcon } from "lucide-react";
import type { ActionId } from "@/components/home/QuickActions";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { useVoltarFecha } from "@/hooks/use-voltar-fecha";
import { estiloDaFolhaComTeclado, rolarCampoFocado, useAreaVisivel } from "@/hooks/use-area-visivel";
import { FolhaNovaTarefa, useTarefasDoDia } from "@/components/tarefas/tarefas-do-dia";
import { CHAVE_TAREFAS_ROTINA } from "@/lib/tarefas";
import { gravarTarefa, marcarAcaoRapidaFeita } from "@/lib/acoes-rapidas";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl, rotuloMl } from "@/lib/saude-copo";
import { trackEvent } from "@/lib/analytics";
import { FolhaAcaoE, ROTULO_DA_ACAO } from "./FolhaAcaoE";
import { TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, tinta, type Tom } from "./paleta";

/**
 * A FOLHA DO "+" DA HOME NOVA (1.0.19) — onde as Ações rápidas foram morar. Sobe de baixo: a pergunta e a grade
 * de 4 colunas com as 12 ações, na ordem de uso real (água e humor são as mais tocadas), na paleta e nos
 * ícones da Home nova. Tocar numa ação troca a grade pelo FORMULÁRIO dela (FolhaAcaoE: um campo grande, o
 * teclado certo, um botão principal — rodada 2, 26/10), com a seta ← de volta à grade; a Tarefa abre a folha
 * da Rotina (FolhaNovaTarefa, Sheet do Radix) por cima — enquanto ela está lá esta folha sai da frente, sem
 * desmontar, e fecha junto quando a tarefa salva ou cancela. Vindo já numa ação (card/pendência/folha do score)
 * abre direto no formulário. Quem GRAVA é lib/acoes-rapidas (as mesmas funções da Home de hoje) — mesmas
 * chaves, validações, toasts, eventos (`home_acao_rapida`, + `origem: "folha"`).
 *
 * TECLADO: a folha acompanha a área visível (use-area-visivel: acima do que o teclado cobre, nunca mais alta que
 * a janela visível, abaixo do relógio) e o campo em foco é rolado pra dentro. Voltar do Android fecha a folha (useVoltarFecha).
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

interface Props {
  aberta: boolean;
  onFechar: () => void;
  /** já abre numa ação (toque num card / numa pendência / na folha do score) */
  inicial?: ActionId | null;
  data: LifeHubData;
}

export const FolhaMaisE = ({ aberta, onFechar, inicial, data }: Props) => {
  const { get, set } = useUserData();
  const navigate = useNavigate();
  const semMovimento = useReducedMotion();
  const tarefasRotina = useTarefasDoDia(CHAVE_TAREFAS_ROTINA);
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  // já nasce na ação pedida (o 1º quadro de "vindo em Tarefa" não pode mostrar a grade)
  const [ativa, setAtiva] = useState<ActionId | null>(inicial && inicial !== "task" ? inicial : null);
  const [tarefa, setTarefa] = useState(inicial === "task");
  const [veioDaGrade, setVeioDaGrade] = useState(!inicial);
  const [assentada, setAssentada] = useState(false);
  const fechando = useRef(false);
  const timer = useRef<number | null>(null);
  const folha = useRef<HTMLDivElement>(null);
  const area = useAreaVisivel(aberta);
  useVoltarFecha(aberta, onFechar, "home-mais");

  // abrir: zera e, se veio com uma ação, já abre nela (a Tarefa vai direto pra folha da Rotina); a folha "assenta"
  // em 450 ms — só então os campos focam. Fechar: esquece tudo (a próxima abertura nasce limpa).
  useEffect(() => {
    if (!aberta) { fechando.current = false; setAssentada(false); return; }
    fechando.current = false;
    setAssentada(false);
    setVeioDaGrade(!inicial);
    if (inicial === "task") { setAtiva(null); setTarefa(true); } else { setAtiva(inicial ?? null); setTarefa(false); }
    const t = window.setTimeout(() => setAssentada(true), 450);
    return () => window.clearTimeout(t);
  }, [aberta, inicial]);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  // o campo em foco fica à vista dentro da folha, acima do teclado
  useEffect(() => {
    if (!aberta) return;
    const aoFocar = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !folha.current?.contains(el)) return;
      rolarCampoFocado(e, 250);
    };
    document.addEventListener("focusin", aoFocar);
    return () => document.removeEventListener("focusin", aoFocar);
  }, [aberta]);

  const fecharEmBreve = (ms: number) => {
    if (fechando.current) return;
    fechando.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; onFechar(); }, ms);
  };

  const tocar = (a: Acao) => {
    if (fechando.current) return;
    trackEvent("home_acao_rapida", { acao: a.id, origem: "folha" });
    if (a.id === "task") { setTarefa(true); return; }
    setAtiva(a.id);
  };
  /** uma ação gravou: a folha fecha (a água fica aberta — dá pra somar copos; "Pronto" fecha) */
  const feito = (id: ActionId) => { if (id !== "water") fecharEmBreve(350); };
  const criarTarefa = (c: Parameters<typeof tarefasRotina.adicionar>[0]) => {
    gravarTarefa({ get, set, navigate }, tarefasRotina, c, () => marcarAcaoRapidaFeita(get, set));
  };

  const escondida = tarefa;
  const titulo = ativa ? ROTULO_DA_ACAO[ativa] : "O que você quer registrar?";
  const estilo: CSSProperties = {
    ...(estiloDaFolhaComTeclado(area, 12) ?? { maxHeight: "88dvh" }),
    ...(escondida ? { pointerEvents: "none", visibility: "hidden" } : {}),
  };
  const mola = semMovimento ? { duration: 0 } : { type: "spring" as const, stiffness: 420, damping: 38 };
  const arrasto = useFolhaArrastavel(onFechar, !!semMovimento); // rodada 3: arrastar pra baixo fecha (grade e formulários)

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button
            type="button" aria-label="Fechar" onClick={onFechar} tabIndex={escondida ? -1 : undefined}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            style={escondida ? { visibility: "hidden", pointerEvents: "none" } : undefined}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }}
          />
          <motion.div
            ref={folha}
            role="dialog" aria-label="Registrar agora" data-testid="hn-folha-mais" data-ativa={ativa ?? undefined}
            data-escondida={escondida ? "1" : undefined} aria-hidden={escondida || undefined}
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
            style={{ ...estilo, y: arrasto.y }} {...arrasto.folha}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={mola}
          >
            <Alca arrasto={arrasto} className="mb-1.5" />
            <div className="flex items-center gap-2 mb-4">
              {ativa && veioDaGrade && (
                <button type="button" onClick={() => setAtiva(null)} aria-label="Voltar" data-testid="hn-acao-voltar" className="w-9 h-9 -ml-1.5 rounded-full grid place-items-center bg-muted">
                  <ArrowLeft className="w-4 h-4" strokeWidth={2.2} />
                </button>
              )}
              <h3 className="flex-1 min-w-0 text-[19px] font-bold tracking-tight truncate">{titulo}</h3>
              <button type="button" onClick={onFechar} aria-label="Fechar" data-testid="hn-folha-mais-fechar" className="w-9 h-9 -mr-1.5 rounded-full grid place-items-center bg-muted">
                <X className="w-4 h-4" strokeWidth={2.2} />
              </button>
            </div>

            {ativa ? (
              <FolhaAcaoE key={ativa} acao={ativa} data={data} assentada={assentada} onFeito={feito} onFechar={onFechar} />
            ) : (
              <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-1" data-testid="hn-acoes">
                {ACOES.map((a) => (
                  <button key={a.id} type="button" onClick={() => tocar(a)} data-acao={a.id} data-track={`acao:${a.id}`} className="flex flex-col items-center gap-2 min-h-[44px] active:scale-95 transition-transform">
                    <span className="w-[58px] h-[58px] rounded-[20px] grid place-items-center" style={{ background: tinta(a.tom), color: cor(a.tom) }}>
                      <a.Icone className="w-6 h-6" strokeWidth={TRACO} aria-hidden />
                    </span>
                    <span className="text-[12.5px] font-medium leading-tight text-center">
                      {a.rotulo}
                      {a.id === "water" && <span className="block text-[11px] text-muted-foreground font-normal">+{rotuloMl(copo)}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
          {/* a Tarefa é a folha da Rotina (Sheet do Radix, por cima); salvar ou cancelar fecha o "+" junto */}
          <FolhaNovaTarefa aberta={tarefa} onFechar={() => { setTarefa(false); fecharEmBreve(0); }} onde="Rotina" onSalvar={criarTarefa} />
        </>
      )}
    </AnimatePresence>
  );
};
