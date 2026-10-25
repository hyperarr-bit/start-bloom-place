import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Banknote, Check, Droplets, Dumbbell, Heart, Leaf, Lightbulb, ListTodo, Moon, Scale, Smile, Utensils, Wallet, X, type LucideIcon } from "lucide-react";
import { QuickActions, abrirAcaoRapida, type ActionId } from "@/components/home/QuickActions";
import { useUserData } from "@/hooks/use-user-data";
import { useVoltarFecha } from "@/hooks/use-voltar-fecha";
import { estiloDaFolhaComTeclado, useAreaVisivel } from "@/hooks/use-area-visivel";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl, rotuloMl } from "@/lib/saude-copo";
import { trackEvent } from "@/lib/analytics";
import { TOM_DO_MODULO, TOM_DO_TIPO, TRACO, cor, tinta, type Tom } from "./paleta";

/**
 * A FOLHA DO "+" DA HOME NOVA (1.0.19) — onde as Ações rápidas foram morar. Sobe de baixo: a pergunta e a grade
 * de 4 colunas com as 12 ações, na ordem de uso real (água e humor são as mais tocadas), na paleta e nos
 * ícones da Home nova.
 *
 * GRAVA DE VERDADE: o que faz o trabalho é o MESMO QuickActions.tsx da Home de hoje, montado aqui só com os
 * formulários (`apenasFormularios`) — tocar num azulejo dispara `abrirAcaoRapida(id)` (o mesmo evento que as
 * pendências usam), e o QuickActions responde como sempre: água e treino gravam na hora (toast e "Desfazer" iguais),
 * tarefa abre a folha de tarefa da Rotina, o resto abre o formulário de sempre aqui dentro. Mesmas chaves,
 * mesmas validações, mesmos toasts, mesmos eventos (`home_acao_rapida`, + `origem: "folha"`).
 *
 * TECLADO (o dono já achou bugs de teclado em aparelho real): a folha acompanha o visualViewport — com o
 * teclado aberto ela sobe junto (bottom = o que o teclado cobre) e o campo em foco é rolado pra dentro dela.
 *
 * FOLHA PRÓPRIA DE UMA AÇÃO (revisor 26/10): "Tarefa" não é formulário inline — o QuickActions abre a FolhaNovaTarefa
 * da Rotina, um Sheet do Radix (z-50, modal: põe pointer-events:none no body). Esta folha é z-70, então a da tarefa
 * abria ESCONDIDA atrás e a grade travava. Agora, quando o QuickActions avisa (`onFolhaPropriaChange`) que abriu uma
 * folha própria, ESTA sai da frente (desce e fica inerte, sem desmontar — o QuickActions, e a folha da tarefa com
 * ele, continuam vivos); quando a folha própria fecha (salvou ou cancelou), esta fecha junto. Vindo já em "task"
 * (pendência/folha do score), nem chega a aparecer. O Voltar do Android com a folha aberta fecha a folha (useVoltarFecha).
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
const ROTULO: Record<ActionId, string> = Object.fromEntries(ACOES.map((a) => [a.id, a.rotulo])) as Record<ActionId, string>;
/** Ações que gravam no primeiro toque (sem formulário): a folha mostra o ✓ e fecha sozinha. */
const DIRETAS: ReadonlySet<ActionId> = new Set<ActionId>(["water", "workout"]);

interface Props {
  aberta: boolean;
  onFechar: () => void;
  /** já abre numa ação (toque numa pendência / na folha do score) */
  inicial?: ActionId | null;
}

export const FolhaMaisE = ({ aberta, onFechar, inicial }: Props) => {
  const { get } = useUserData();
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  const [ativa, setAtiva] = useState<ActionId | null>(null);
  const [feita, setFeita] = useState<ActionId | null>(null);
  /** uma folha PRÓPRIA da ação (a da Tarefa) está na frente: esta desce e fica inerte, sem desmontar */
  const [escondida, setEscondida] = useState(false);
  const tinhaAtiva = useRef(false);
  const tinhaPropria = useRef(false);
  const fechando = useRef(false);
  const timer = useRef<number | null>(null);
  const folha = useRef<HTMLDivElement>(null);
  const area = useAreaVisivel(aberta);
  useVoltarFecha(aberta, onFechar, "home-mais");

  // abrir: zera; e, se veio com uma ação (pendência), pede ao QuickActions assim que ele estiver montado.
  // Vindo em "task" a folha já nasce escondida (a da tarefa é quem aparece); se a folha própria não vier, fecha.
  useEffect(() => {
    // fechou (pelo X, com um formulário aberto): esquece a abertura — senão o aviso da próxima montagem do QuickActions
    // encontrava `tinhaAtiva` ligado e fechava a folha recém-reaberta (achado no Simulador, 26/10)
    if (!aberta) { tinhaAtiva.current = false; tinhaPropria.current = false; fechando.current = false; return; }
    setAtiva(null); setFeita(null); tinhaAtiva.current = false; tinhaPropria.current = false; fechando.current = false;
    setEscondida(inicial === "task");
    if (!inicial) return;
    const t = window.setTimeout(() => abrirAcaoRapida(inicial), 60);
    const guarda = inicial === "task" ? window.setTimeout(() => { if (!tinhaPropria.current) onFechar(); }, 2500) : null;
    return () => { window.clearTimeout(t); if (guarda !== null) window.clearTimeout(guarda); };
  }, [aberta, inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  // o campo em foco (o QuickActions foca sozinho) fica à vista dentro da folha, acima do teclado
  useEffect(() => {
    if (!aberta) return;
    const aoFocar = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !folha.current?.contains(el)) return;
      window.setTimeout(() => { try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* noop */ } }, 250);
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
    abrirAcaoRapida(a.id);
  };

  /** O QuickActions abriu/fechou um formulário: fechou depois de aberto (salvou ou cancelou) = a folha vai junto. */
  const aoMudarAtiva = (id: ActionId | null) => {
    setAtiva(id);
    if (id) { tinhaAtiva.current = true; return; }
    if (tinhaAtiva.current) { tinhaAtiva.current = false; fecharEmBreve(fechando.current ? 0 : 150); }
  };
  /** Uma ação gravou: as diretas (água, treino) mostram o ✓ no azulejo e a folha fecha; as outras fecham pelo formulário
   *  (a tarefa fecha pela folha própria — aoMudarPropria). */
  const aoFeito = (id: ActionId) => {
    if (DIRETAS.has(id)) { setFeita(id); fecharEmBreve(650); }
  };
  /** O QuickActions abriu uma folha própria (Tarefa): esta sai da frente; fechou-a (salvou ou cancelou): esta fecha junto. */
  const aoMudarPropria = (id: ActionId | null) => {
    if (id) { tinhaPropria.current = true; setEscondida(true); return; }
    if (tinhaPropria.current) { tinhaPropria.current = false; fecharEmBreve(0); }
  };

  const titulo = ativa ? ROTULO[ativa] : "O que você quer registrar?";
  // teclado aberto: ancorada logo acima do que ele cobre e nunca mais alta que a ÁREA VISÍVEL (o iOS arrasta a janela
  // visível quando o campo está num elemento fixo — "100dvh - teclado" não serve, 100dvh continua sendo a tela inteira)
  const estilo: CSSProperties = {
    ...(estiloDaFolhaComTeclado(area, 12) ?? { maxHeight: "88dvh" }),
    ...(escondida ? { pointerEvents: "none", visibility: "hidden" } : {}),
  };

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <motion.button
            type="button" aria-label="Fechar" onClick={onFechar} tabIndex={escondida ? -1 : undefined}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]"
            style={escondida ? { visibility: "hidden", pointerEvents: "none" } : undefined}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
          />
          <motion.div
            ref={folha}
            role="dialog" aria-label="Registrar agora" data-testid="hn-folha-mais" data-ativa={ativa ?? undefined}
            data-escondida={escondida ? "1" : undefined} aria-hidden={escondida || undefined}
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
            style={estilo}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 420, damping: 38 }}
          >
            <span className="block w-9 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" aria-hidden />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[19px] font-bold tracking-tight">{titulo}</h3>
              <button type="button" onClick={onFechar} aria-label="Fechar" data-testid="hn-folha-mais-fechar" className="w-9 h-9 -mr-1.5 rounded-full grid place-items-center bg-muted">
                <X className="w-4 h-4" strokeWidth={2.2} />
              </button>
            </div>

            {/* a grade some enquanto um formulário está aberto (o QuickActions desenha o formulário logo abaixo) */}
            {!ativa && (
              <div className="grid grid-cols-4 gap-x-2 gap-y-5 pb-1" data-testid="hn-acoes">
                {ACOES.map((a) => {
                  const ok = feita === a.id;
                  return (
                    <button key={a.id} type="button" onClick={() => tocar(a)} data-acao={a.id} data-track={`acao:${a.id}`} className="flex flex-col items-center gap-2 min-h-[44px] active:scale-95 transition-transform">
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

            {/* o QuickActions de verdade, só com os formulários — é ele quem grava */}
            <div className={ativa ? "-mt-2" : "hidden"} data-testid="hn-formularios">
              <QuickActions apenasFormularios onAtivaChange={aoMudarAtiva} onFeito={aoFeito} onFolhaPropriaChange={aoMudarPropria} />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
