import { useEffect, useRef, useState } from "react";
import { localDayKey } from "@/lib/utils";
import { useUserData } from "@/hooks/use-user-data";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { armarAvisos } from "@/lib/armar-avisos";
import { CHAVE_LEMBRETE_SKINCARE } from "@/lib/beleza-lembrete";
import {
  OPCOES_OBJETIVO, OPCOES_PELE, conflitosDoPlano, diasDoPasso, passoValido, temAgenda, termosDoPasso, type PerfilDaPele, type Periodo,
} from "@/lib/beleza-rotina";
import { CHAVE_WIDGETS_HOME, comWidget } from "@/hooks/use-home-widgets";
import { PostIt } from "@/components/treino/planner";
import { faseDoCiclo } from "./utils";
import { useSkincare } from "./use-skincare";
import { FolhaDoSkincare } from "./skincare-do-dia";
import { FichaDoPasso, type PassoAberto } from "./ficha-do-passo";
import { SemanaDaRotina } from "./semana-da-rotina";
import { LembreteDoSkincare } from "./lembrete-skincare";
import { MontarRotina } from "./montar-rotina";

const getDateKey = () => localDayKey();

const SKIN_CYCLE_PHASES = [
  { label: "Esfoliação", emoji: "✨", desc: "Ácido Glicólico ou Lático", color: "text-emerald-600 dark:text-emerald-400" },
  { label: "Retinol", emoji: "💎", desc: "Anti-idade e renovação", color: "text-purple-600 dark:text-purple-400" },
  { label: "Recuperação", emoji: "🧊", desc: "Só hidratação e calmantes", color: "text-muted-foreground" },
  { label: "Recuperação", emoji: "🧊", desc: "Só hidratação e calmantes", color: "text-muted-foreground" },
];

/**
 * ROTINA DA BELEZA (28/09, protótipo "rotina pronta em 3 toques + skincare de
 * hoje"). Antes: duas listas soltas (manhã/noite) que abriam VAZIAS, um ciclo
 * fixo de 4 dias sem ligação com o que a pessoa passa, sem lembrete.
 * Agora:
 *  - sem rotina → as 3 perguntas ali mesmo (MontarRotina) ou "montar do zero";
 *  - SKINCARE DE HOJE: os passos do DIA (agenda por passo), com o produto de
 *    cada um, o quadradinho e HOJE | ONTEM;
 *  - MINHA SEMANA: a agenda em tabela; substitui o ciclo de 4 dias quando algum
 *    passo tem dias próprios (rotina antiga, sem dias, segue com o ciclo);
 *  - LEMBRETE manhã/noite; conflito de ativos olhando dias + ativos do produto.
 * Tocar num passo abre a ficha: dias, produto (lista curada ou digitado),
 * remover. Tudo nas chaves de sempre (ver lib/beleza-rotina).
 */
export const SkincareRoutine = ({
  recemGerada: deFora,
  onGerada,
}: {
  /** a página guarda o "acabou de montar" (a Rotina troca de lugar na tela ao sair do vazio) */
  recemGerada?: PerfilDaPele | null;
  onGerada?: (p: PerfilDaPele | null) => void;
} = {}) => {
  const today = getDateKey();
  const { loaded, get, set: gravarChave } = useUserData();
  const s = useSkincare();
  const [modo, setModo] = useState<"normal" | "zero" | "trocar">("normal");
  const [recemInterna, setRecemInterna] = useState<PerfilDaPele | null>(null);
  const recemGerada = onGerada ? deFora ?? null : recemInterna;
  const setRecemGerada = onGerada ?? setRecemInterna;
  const postIts = useRef<HTMLDivElement>(null);
  // acabou de montar: o "rotina pronta" (com o lembrete e o "pôr na Home") entra na tela
  useEffect(() => {
    if (recemGerada) postIts.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }, [recemGerada]);
  const [aberto, setAberto] = useState<PassoAberto | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const cycleStart = get<string>("skincare-cycle-start", "");

  /* SKIN CYCLING PARADO NO DIA 1 (26/09, varredura): o início do ciclo nunca
     era gravado — o padrão era "hoje", então todo dia virava "Esfoliação ·
     Dia 1/4". Grava na 1ª vez que a rotina abre, só depois de carregar (senão
     um aparelho novo gravaria "hoje" por cima do início que está no servidor),
     e como escrita de SISTEMA (não é gesto da pessoa, não conta ativação). */
  useEffect(() => {
    if (!loaded || (typeof cycleStart === "string" && cycleStart)) return;
    gravarChave("skincare-cycle-start", today, { system: true });
  }, [loaded, cycleStart, today, gravarChave]);

  const cyclePhase = faseDoCiclo(typeof cycleStart === "string" && cycleStart ? cycleStart : today, today);
  const currentPhase = SKIN_CYCLE_PHASES[cyclePhase];
  const comAgenda = temAgenda(s.passos.manha, s.passos.noite);
  const nPassos = [...s.passos.manha, ...s.passos.noite].filter(passoValido).length;

  // conflito olhando a AGENDA (dias) e os ativos do produto escolhido
  const paraConflito = (periodo: Periodo) =>
    s.passos[periodo].filter(passoValido).map((p) => ({ nome: p.name, termos: termosDoPasso(p, s.produtoDe(p)), dias: diasDoPasso(p) }));
  const conflicts = conflitosDoPlano(paraConflito("manha"), paraConflito("noite"));

  const gerar = (perfil: PerfilDaPele) => {
    const trocando = modo === "trocar";
    s.gerar(perfil);
    setModo("normal");
    setRecemGerada(perfil);
    trackEvent("skincare_rotina_pronta", { ...perfil, trocou: trocando });
  };

  const naHome = (() => {
    const lista = get<unknown>(CHAVE_WIDGETS_HOME, []);
    return Array.isArray(lista) && lista.some((w) => (w as { id?: string })?.id === "skincare");
  })();
  const porNaHome = () => {
    const nova = comWidget(get<unknown>(CHAVE_WIDGETS_HOME, []), "skincare", "large");
    if (nova) gravarChave(CHAVE_WIDGETS_HOME, nova);
    trackEvent("skincare_widget_home", { origem: "rotina_pronta" });
    toast.success("\"Skincare de hoje\" está na sua Home", { description: "Tira quando quiser em Adicionar widget." });
  };
  const ligarLembrete = () => {
    const novo = s.ligarLembretes();
    trackEvent("skincare_lembrete", { periodo: "ambos", ligado: true, origem: "rotina_pronta" });
    void armarAvisos(get, { [CHAVE_LEMBRETE_SKINCARE]: novo }, true, { nome: "skincare_lembrete_permissao", total: 1 });
  };

  if ((s.vazia && modo !== "zero") || modo === "trocar") {
    return (
      <div className="space-y-4 mt-4">
        <MontarRotina
          onPronto={gerar}
          onDoZero={s.vazia ? () => setModo("zero") : undefined}
          onCancelar={modo === "trocar" ? () => setModo("normal") : undefined}
          passosAtuais={modo === "trocar" ? nPassos : 0}
        />
      </div>
    );
  }

  const rotuloPele = OPCOES_PELE.find((o) => o.id === recemGerada?.pele)?.rotulo.toLowerCase();
  const rotuloObjetivo = OPCOES_OBJETIVO.find((o) => o.id === recemGerada?.objetivo)?.rotulo.toLowerCase();

  return (
    <div className="space-y-4 mt-4">
      {recemGerada && (
        <div ref={postIts} className="space-y-2.5 pt-1 scroll-mt-32" data-testid="rotina-pronta">
          <PostIt testId="postit-pronta">
            Rotina pronta pra pele <b>{rotuloPele}</b>, foco em <b>{rotuloObjetivo}</b>. Toque num passo pra escolher o seu produto ou mudar os dias.
          </PostIt>
          {!s.lembrete.manha.ligado && !s.lembrete.noite.ligado && (
            <PostIt
              testId="postit-lembrete"
              acao={<button type="button" onClick={ligarLembrete} className="shrink-0 h-10 px-3 rounded-md bg-amber-900 text-amber-50 text-[12.5px] font-bold active:scale-95 transition">Ligar</button>}
            >
              Quer que o CORE te lembre às <b>{s.lembrete.manha.hora}</b> e às <b>{s.lembrete.noite.hora}</b>?
            </PostIt>
          )}
          {!naHome && (
            <PostIt
              testId="postit-home"
              acao={<button type="button" onClick={porNaHome} className="shrink-0 h-10 px-3 rounded-md bg-amber-900 text-amber-50 text-[12.5px] font-bold active:scale-95 transition">Pôr</button>}
            >
              Ver o <b>skincare de hoje</b> na Home, com o quadradinho pra marcar?
            </PostIt>
          )}
        </div>
      )}

      <FolhaDoSkincare
        s={s}
        modo="modulo"
        onAbrirPasso={(periodo, i) => setAberto({ periodo, i, vista: "ficha" })}
        onEscolherProduto={(periodo, i) => setAberto({ periodo, i, vista: "escolher" })}
      />

      {conflicts.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800/30 overflow-hidden">
          <div className="bg-red-200 dark:bg-red-800/50 px-3 py-1.5 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">⚠️ CONFLITOS DETECTADOS</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 p-3 space-y-1.5">
            {conflicts.map((c, i) => (
              <div key={i}>
                <p className="text-[11px] text-red-700 dark:text-red-300">{c.regra.message}</p>
                <p className="text-[10.5px] text-muted-foreground">
                  💡 {c.regra.suggestion}
                  {c.dias.length < 7 ? ` · caem juntos: ${c.dias.map((d) => ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][d]).join(", ")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {conflicts.length === 0 && nPassos > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800/30 bg-emerald-50 dark:bg-emerald-950/20">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-[10.5px] text-emerald-700 dark:text-emerald-300 font-medium">Nenhum conflito de ativos ✅</p>
        </div>
      )}

      {comAgenda ? (
        <SemanaDaRotina s={s} onAbrirPasso={(periodo, i) => setAberto({ periodo, i, vista: "ficha" })} />
      ) : (
        nPassos > 0 && (
          /* rotina antiga (sem dias por passo): o ciclo fixo de sempre */
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="bg-indigo-200 dark:bg-indigo-800/50 px-4 py-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">🔄 CICLO DE 4 DIAS</span>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentPhase.emoji}</span>
                <div className="flex-1">
                  <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-300">Skin Cycling: {currentPhase.label}</p>
                  <p className="text-[9px] text-muted-foreground">{currentPhase.desc}</p>
                </div>
                <span className="text-[8px] text-muted-foreground">Dia {cyclePhase + 1}/4</span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[9px] text-muted-foreground">Esfoliação → Retinol → Recuperação × 2</p>
                <div className="flex gap-1">
                  {SKIN_CYCLE_PHASES.map((p, i) => (
                    <div
                      key={i}
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border transition-all ${i === cyclePhase ? "border-indigo-400 bg-indigo-100 dark:bg-indigo-800/30 scale-110" : "border-border"}`}
                    >
                      {p.emoji}
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground">Quer que cada passo tenha os seus dias? Toque no passo e escolha os dias da semana.</p>
            </div>
          </div>
        )
      )}

      {nPassos > 0 && <LembreteDoSkincare s={s} />}

      {/* Conflict guide */}
      <Button variant="ghost" size="sm" className="w-full h-10 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowGuide(!showGuide)}>
        <AlertTriangle className="w-3 h-3 mr-1.5" /> Guia: Pode vs. Não Pode
      </Button>
      {showGuide && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-amber-200 dark:bg-amber-800/50 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">📋 COMBINAÇÕES A EVITAR</span>
          </div>
          <div className="bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2">
            {[
              { bad: "Retinol + AHA/BHA", tip: "Alterne os dias" },
              { bad: "Retinol + Vitamina C", tip: "Vit C de manhã, Retinol à noite" },
              { bad: "Peróxido de Benzoíla + Vitamina C", tip: "Nunca juntos" },
              { bad: "AHA + BHA juntos", tip: "Alterne os dias" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <span className="text-red-500 font-bold">✗</span>
                <div><span className="font-medium">{item.bad}</span> <span className="text-muted-foreground">— {item.tip}</span></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triggers banner */}
      {s.evitar.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800/30 overflow-hidden">
          <div className="bg-red-200 dark:bg-red-800/50 px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">🚫 INGREDIENTES A EVITAR</span>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 px-3 py-2">
            <p className="text-[9px] text-red-700 dark:text-red-300">{s.evitar.join(", ")}</p>
          </div>
        </div>
      )}

      {nPassos > 0 && (
        <button
          type="button"
          onClick={() => setModo("trocar")}
          className="w-full h-10 inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground"
          data-testid="refazer-perguntas"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Refazer as 3 perguntas
        </button>
      )}

      <FichaDoPasso s={s} aberto={aberto} onFechar={() => setAberto(null)} onVista={(vista) => setAberto((a) => (a ? { ...a, vista } : a))} />
    </div>
  );
};
