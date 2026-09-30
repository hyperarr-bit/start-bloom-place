import { useEffect, useRef, useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bell, Home, ShieldCheck, RotateCcw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics";
import { armarAvisos } from "@/lib/armar-avisos";
import { CHAVE_LEMBRETE_SKINCARE } from "@/lib/beleza-lembrete";
import {
  OPCOES_OBJETIVO, OPCOES_PELE, conflitosDoPlano, diasDoPasso, diasPorExtenso, nomeCurto, passoValido, sugerirDias, temAgenda, termosDoPasso,
  type PassoDaRotina, type PerfilDaPele, type Periodo,
} from "@/lib/beleza-rotina";
import { CHAVE_WIDGETS_HOME, comWidget } from "@/hooks/use-home-widgets";
import { BOTAO_PILULA, CartaoBeleza, Dica, FaixaBeleza } from "./kit";
import { useSkincare } from "./use-skincare";
import { FolhaDoSkincare } from "./skincare-do-dia";
import { FichaDoPasso, type PassoAberto } from "./ficha-do-passo";
import { SemanaDaRotina } from "./semana-da-rotina";
import { LembreteDoSkincare } from "./lembrete-skincare";
import { avisosNoApp } from "@/lib/avisos-no-app";
import { MontarRotina } from "./montar-rotina";


/**
 * ROTINA DA BELEZA (28/09, protótipo "rotina pronta em 3 toques + skincare de
 * hoje"). Antes: duas listas soltas (manhã/noite) que abriam VAZIAS, um ciclo
 * fixo de 4 dias sem ligação com o que a pessoa passa, sem lembrete.
 * Agora:
 *  - sem rotina → as 3 perguntas ali mesmo (MontarRotina) ou "montar do zero";
 *  - SKINCARE DE HOJE: os passos do DIA (agenda por passo), com o produto de
 *    cada um, o quadradinho e HOJE | ONTEM;
 *  - MINHA SEMANA: a agenda em tabela — o ÚNICO jeito desde 28/09 (o dono tirou o
 *    ciclo fixo de 4 dias pra todo mundo). Rotina antiga, sem dias por passo, vale
 *    "todo dia" (é o que ela sempre foi e o que o app antigo mostra) e ganha a
 *    oferta de alternar os ativos da noite;
 *  - LEMBRETE manhã/noite; conflito de ativos olhando dias + ativos do produto.
 * Tocar num passo abre a ficha: dias, produto (lista curada ou digitado),
 * remover. Tudo nas chaves de sempre (ver lib/beleza-rotina).
 */
/** O aviso da rotina pronta (28/09, dono): discreto, sem alarde. */
export const AVISO_DERMATOLOGISTA = "Orientação geral — não substitui a avaliação de um dermatologista.";

export const SkincareRoutine = ({
  recemGerada: deFora,
  onGerada,
}: {
  /** a página guarda o "acabou de montar" (a Rotina troca de lugar na tela ao sair do vazio) */
  recemGerada?: PerfilDaPele | null;
  onGerada?: (p: PerfilDaPele | null) => void;
} = {}) => {
  const { get, set: gravarChave } = useUserData();
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
  /* SEM O CICLO FIXO DE 4 DIAS (28/09): a Rotina não grava mais nada ao abrir
     (o `skincare-cycle-start` era do ciclo; o app antigo grava o dele sozinho). */
  const comAgenda = temAgenda(s.passos.manha, s.passos.noite);
  const nPassos = [...s.passos.manha, ...s.passos.noite].filter(passoValido).length;

  // conflito olhando a AGENDA (dias) e os ativos do produto escolhido
  const paraConflito = (periodo: Periodo) =>
    s.passos[periodo].filter(passoValido).map((p) => ({ nome: p.name, termos: termosDoPasso(p, s.produtoDe(p)), dias: diasDoPasso(p) }));
  const conflicts = conflitosDoPlano(paraConflito("manha"), paraConflito("noite"));

  /* ALTERNAR (a migração de quem vinha do ciclo de 4 dias): rotina SEM dias por
     passo e com ativo à noite todo dia ganha a oferta dos dias que o gerador usa.
     Só aparece nesse caso, só aplica no toque, e "Agora não" não volta. */
  const sugestao = !comAgenda && !s.alternarDispensado ? sugerirDias(s.passos.noite) : [];
  const nomeDe = (i: number) => nomeCurto((s.passos.noite[i] as PassoDaRotina).name);
  const descricaoSugestao = sugestao.map(({ i, dias }) => `${nomeDe(i)} ${diasPorExtenso({ dias })}`).join("; ");

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
          <Dica testId="postit-pronta" icone={<Sparkles className="w-4 h-4" />}>
            Rotina pronta pra pele <b>{rotuloPele}</b>, foco em <b>{rotuloObjetivo}</b>. Toque num passo pra escolher o seu produto ou mudar os dias.
            <span className="block mt-1 text-[11px] opacity-75" data-testid="aviso-dermatologista-pronta">{AVISO_DERMATOLOGISTA}</span>
          </Dica>
          {/* o convite do lembrete só no app (30/09): na web o aviso não toca — seria botão morto */}
          {avisosNoApp() && !s.lembrete.manha.ligado && !s.lembrete.noite.ligado && (
            <Dica
              testId="postit-lembrete"
              icone={<Bell className="w-4 h-4" />}
              acao={<button type="button" onClick={ligarLembrete} className={BOTAO_PILULA}>Ligar</button>}
            >
              Quer que o CORE te lembre às <b>{s.lembrete.manha.hora}</b> e às <b>{s.lembrete.noite.hora}</b>?
            </Dica>
          )}
          {!naHome && (
            <Dica
              testId="postit-home"
              icone={<Home className="w-4 h-4" />}
              acao={<button type="button" onClick={porNaHome} className={BOTAO_PILULA}>Pôr</button>}
            >
              Ver o <b>skincare de hoje</b> na Home, com o quadradinho pra marcar?
            </Dica>
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
        <CartaoBeleza className="border-bz-alerta-tinta/25">
          <FaixaBeleza tom="alerta" icone={<AlertTriangle className="w-4 h-4 text-bz-alerta-tinta" />} titulo="⚠️ CONFLITOS DETECTADOS" />
          <div className="px-4 py-3 space-y-2">
            {conflicts.map((c, i) => (
              <div key={i}>
                <p className="text-[12.5px] font-semibold text-bz-alerta-tinta">{c.regra.message}</p>
                <p className="text-[11.5px] text-bz-suave">
                  💡 {c.regra.suggestion}
                  {c.dias.length < 7 ? ` · caem juntos: ${c.dias.map((d) => ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][d]).join(", ")}` : ""}
                </p>
              </div>
            ))}
          </div>
        </CartaoBeleza>
      )}

      {conflicts.length === 0 && nPassos > 0 && (
        <div className="flex items-center gap-2 pl-2 pr-4 min-h-[40px] rounded-full bg-bz-ok text-bz-ok-tinta w-fit">
          <span className="grid place-items-center w-7 h-7 rounded-full bg-bz-cartao/70" aria-hidden="true"><ShieldCheck className="w-3.5 h-3.5" /></span>
          <p className="text-[12px] font-semibold">Nenhum conflito de ativos ✅</p>
        </div>
      )}

      {sugestao.length > 0 && (
        <div className="space-y-1.5" data-testid="sugestao-alternar">
          <Dica
            acao={
              <button
                type="button"
                onClick={() => { s.aplicarDias("noite", sugestao); trackEvent("skincare_alternar", { passos: sugestao.length, conflito: conflicts.length > 0 }); }}
                className={BOTAO_PILULA}
              >
                Alternar
              </button>
            }
          >
            {conflicts.length > 0 ? "Ativo junto na mesma noite irrita a pele." : "Agora cada passo tem os seus dias."} Quer alternar? <b>{descricaoSugestao}</b>.
          </Dica>
          <button type="button" onClick={s.dispensarAlternar} className="ml-auto block h-10 px-3 rounded-full bg-transparent text-[12px] font-semibold text-bz-suave">
            Agora não
          </button>
        </div>
      )}

      {nPassos > 0 && <SemanaDaRotina s={s} onAbrirPasso={(periodo, i) => setAberto({ periodo, i, vista: "ficha" })} />}

      {nPassos > 0 && avisosNoApp() && <LembreteDoSkincare s={s} />}

      {/* Conflict guide */}
      <Button variant="ghost" size="sm" className="w-full h-10 rounded-full text-[12.5px] text-bz-suave hover:text-bz-tinta" onClick={() => setShowGuide(!showGuide)}>
        <AlertTriangle className="w-3.5 h-3.5 mr-1.5" /> Guia: Pode vs. Não Pode
      </Button>
      {showGuide && (
        <CartaoBeleza>
          <FaixaBeleza tom="manha" titulo="📋 COMBINAÇÕES A EVITAR" />
          <div className="px-4 py-3 space-y-2">
            {[
              { bad: "Retinol + AHA/BHA", tip: "Alterne os dias" },
              { bad: "Retinol + Vitamina C", tip: "Vit C de manhã, Retinol à noite" },
              { bad: "Peróxido de Benzoíla + Vitamina C", tip: "Nunca juntos" },
              { bad: "AHA + BHA juntos", tip: "Alterne os dias" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <span className="text-bz-alerta-tinta font-bold">✗</span>
                <div><span className="font-semibold text-bz-tinta">{item.bad}</span> <span className="text-bz-suave">— {item.tip}</span></div>
              </div>
            ))}
          </div>
        </CartaoBeleza>
      )}

      {/* Triggers banner */}
      {s.evitar.length > 0 && (
        <CartaoBeleza>
          <FaixaBeleza tom="alerta" titulo="🚫 INGREDIENTES A EVITAR" />
          <p className="px-4 py-2.5 text-[12px] text-bz-alerta-tinta">{s.evitar.join(", ")}</p>
        </CartaoBeleza>
      )}

      {/* 28/09 (dono): a rotina que as 3 perguntas montam é orientação geral — dito sem alarde, no pé */}
      {nPassos > 0 && s.perfil?.pele && (
        <p className="px-4 text-center text-[11px] leading-snug text-bz-suave" data-testid="aviso-dermatologista">
          {AVISO_DERMATOLOGISTA}
        </p>
      )}

      {nPassos > 0 && (
        <button
          type="button"
          onClick={() => setModo("trocar")}
          className="w-full h-10 rounded-full bg-transparent inline-flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-bz-suave"
          data-testid="refazer-perguntas"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Refazer as 3 perguntas
        </button>
      )}

      <FichaDoPasso s={s} aberto={aberto} onFechar={() => setAberto(null)} onVista={(vista) => setAberto((a) => (a ? { ...a, vista } : a))} />
    </div>
  );
};
