import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, Lightbulb } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { useDemoDoFunil } from "@/lib/demo-do-funil";
import { fileiraDeDemo } from "@/components/ui/abas-ocultaveis";
import { dicasDoModulo, irParaDica, modoDasDicas, type Dica } from "@/lib/dicas-do-modulo";

interface ModuleTipProps {
  moduleId: string;
  /** Reserva: módulo sem lista em lib/dicas-do-modulo (só texto). Com lista, a lista vence. */
  tips?: string[];
  icon?: string;
  /** Beleza tem a paleta dela (bz-*); o resto usa a do app. */
  tema?: "app" | "beleza";
}

/* 29/10 (dono: "quero o design antigo das dicas, o da lâmpada"): o cartão volta ao desenho da 1.0.12 — caixa tingida, a
 * lâmpada num quadradinho à esquerda, título na cor do tema e as dicas em lista — e cada dica continua sendo um botão que
 * leva ao lugar (modo "toque"). Beleza usa o mesmo desenho na paleta dela. */
const TEMAS = {
  app: {
    caixa: "bg-primary/5 border border-primary/20 rounded-xl",
    lampada: "bg-primary/10 text-primary",
    titulo: "text-xs font-bold text-primary",
    linha: "text-[11.5px] leading-snug text-muted-foreground",
    marca: "text-primary/60",
    botao: "text-[12px] leading-snug text-muted-foreground hover:bg-primary/10 hover:text-foreground active:bg-primary/15",
    seta: "text-primary/50",
    fechar: "bg-muted/80 hover:bg-muted text-foreground",
  },
  beleza: {
    caixa: "border border-bz-dica-borda bg-bz-dica rounded-2xl",
    lampada: "bg-bz-acento/15 text-bz-acento",
    titulo: "text-xs font-bold text-bz-dica-tinta",
    linha: "text-[11.5px] leading-snug text-bz-dica-tinta/85",
    marca: "text-bz-acento/70",
    botao: "text-[12px] leading-snug text-bz-dica-tinta/90 hover:bg-bz-acento/10 active:bg-bz-acento/15",
    seta: "text-bz-dica-tinta/50",
    fechar: "bg-transparent text-bz-dica-tinta/70",
  },
} as const;

/**
 * "DICAS PARA COMEÇAR" (1.0.22, 28/10 — reescritas pelo uso real, lib/dicas-do-modulo). Até 3 dicas; a 1ª abertura do
 * módulo mostra, fica em todas as abas do módulo até o X e o X grava `core-tip-seen-<módulo>` na conta (não volta ao
 * reabrir nem em outro aparelho). Duas apresentações (DICAS_MODO / `?dicas=`): "toque" = cada dica é um botão que leva
 * ao lugar; "texto" = só o texto, o cartão mais enxuto. Nunca nas demos de venda.
 */
export const ModuleTip = ({ moduleId, tips, tema = "app" }: ModuleTipProps) => {
  // funil-demo (/experimente, 14/10) e demos de venda (/preview, /liberar, /hoje/demo, /organizar/demo): sem cartão
  const demoDoFunil = useDemoDoFunil();
  const { get, set: setData, loaded } = useUserData();
  const storageKey = `core-tip-seen-${moduleId}`;
  /* 28/10 (auditoria das dicas): a marca é lida a cada render e o cartão só aparece com a conta carregada — lida 1x na
   * montagem, reabrir direto no módulo trazia o cartão fechado de volta. */
  const [fechadaAgora, setFechadaAgora] = useState(false);
  const visible = loaded && !fechadaAgora && !get<string>(storageKey, "");

  const daLista = dicasDoModulo(moduleId);
  const dicas: readonly Dica[] = daLista.length ? daLista : (tips ?? []).map((texto) => ({ texto }));
  const modo = modoDasDicas();
  const t = TEMAS[tema];

  const dismiss = () => {
    setData(storageKey, "true");
    setFechadaAgora(true);
  };

  if (demoDoFunil || fileiraDeDemo() || dicas.length === 0) return null;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          /* 22/09 (varredura): monta já no tamanho certo (sem CLS); só o fechar anima. */
          initial={false}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          className="mb-4 overflow-hidden"
        >
          <div
            className={`${t.caixa} relative p-4 pr-3`}
            data-testid={tema === "beleza" ? "dicas-beleza" : "dicas-modulo"}
            data-modo={modo}
            data-modulo={moduleId}
          >
            <button
              onClick={dismiss}
              aria-label="Fechar dicas"
              className={`absolute top-1.5 right-1.5 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${t.fechar}`}
            >
              <X className="w-3 h-3" />
            </button>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${t.lampada}`} data-testid="dicas-lampada" aria-hidden>
                <Lightbulb className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`${t.titulo} pr-8 mb-1.5`}>
                  {tema === "beleza" ? "Dicas pra começar" : "Dicas para começar"}
                </p>
                {modo === "toque" ? (
                  <ul className="-ml-2">
                    {dicas.map((d, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => irParaDica(moduleId, d, i)}
                          data-testid={`dica-${i + 1}`}
                          className={`w-full min-h-[36px] flex items-start gap-1.5 rounded-lg px-2 py-1.5 text-left transition-colors ${t.botao}`}
                        >
                          <span className={`mt-px ${t.marca}`} aria-hidden>•</span>
                          <span className="flex-1">{d.texto}</span>
                          <ChevronRight className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${t.seta}`} aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1 pr-4">
                    {dicas.map((d, i) => (
                      <li key={i} className={`${t.linha} flex items-start gap-1.5`}>
                        <span className={`mt-px ${t.marca}`} aria-hidden>•</span>
                        <span data-testid={`dica-${i + 1}`}>{d.textoSemToque ?? d.texto}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
