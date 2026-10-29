import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { rotuloHora } from "@/lib/prefs-notificacoes";
import { SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import { Alca, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha, useFolhaArrastavel } from "@/components/home-nova/e/folha-arrasto";

/** As horas cheias que a central sempre ofereceu (a mesma fileira dos cartões antigos). */
export const HORAS = [6, 7, 8, 9, 10, 12, 18, 20, 21, 22];

export type ControleDeHora =
  | { tipo: "cheia"; hora: number; onHora: (h: number) => void }
  /** a Rotina de manhã tem minuto (nasce 15 min depois da hora de acordar) */
  | { tipo: "minuto"; hora: string; onHora: (hhmm: string) => void; rotulo: string }
  /** horário escolhido no próprio módulo (Beleza, Relações): só mostra */
  | { tipo: "fixa"; texto: string };

interface Props {
  aberta: boolean;
  onFechar: () => void;
  titulo: string;
  descricao: string;
  rodape?: string;
  icone: ReactNode;
  controle?: ControleDeHora;
}

/**
 * A FOLHA DE UM LEMBRETE (29/10, tela de Lembretes A6): o toque na linha ou na pílula do horário abre aqui o texto
 * completo de antes (o que o aviso faz e quando não vem), o estado do agendamento e o horário. Mesma folha de baixo da
 * Home nova (arrastar pra baixo fecha). Num portal: a tela entra com PageTransition (transform), e `fixed` dentro de um
 * pai transformado não cobriria a tela inteira.
 */
export function FolhaLembrete({ aberta, onFechar, titulo, descricao, rodape, icone, controle }: Props) {
  const semMovimento = useReducedMotion();
  const arrasto = useFolhaArrastavel(onFechar, !!semMovimento);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="hn he he-so-vars" data-suave={SUAVIDADE_HOME_NOVA}>
      <AnimatePresence>
        {aberta && (
          <>
            <FaixaDoRelogioSobFolha />
            <motion.button
              type="button" aria-label="Fechar" onClick={onFechar}
              className={CLASSE_FUNDO_FOLHA}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }}
            />
            <motion.div
              role="dialog" aria-label={titulo} data-testid="folha-lembrete"
              className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card text-foreground max-h-[88dvh] overflow-y-auto overscroll-contain px-5 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+20px)]"
              style={{ y: arrasto.y }} {...arrasto.folha}
              {...propsDaFolha(!!semMovimento)}
            >
              <Alca arrasto={arrasto} className="mb-1.5" />
              <div className="flex items-start gap-3">
                {icone}
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-[17px] font-bold leading-tight">{titulo}</p>
                  <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{descricao}</p>
                </div>
                <button type="button" onClick={onFechar} aria-label="Fechar" className="w-9 h-9 -mr-1.5 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
              </div>
              {rodape && <p className="mt-3 text-[12.5px] text-muted-foreground/90" data-testid="folha-lembrete-rodape">{rodape}</p>}

              {controle?.tipo === "cheia" && (
                <>
                  <p className="mt-5 mb-2.5 text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Horário</p>
                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={`Horário: ${titulo}`}>
                    {HORAS.map((h) => (
                      <button
                        key={h} type="button" role="radio" aria-checked={controle.hora === h}
                        onClick={() => controle.onHora(h)}
                        className={`h-11 rounded-[14px] text-[14.5px] font-semibold tabular-nums transition-colors ${controle.hora === h ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {rotuloHora(h)}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {controle?.tipo === "minuto" && (
                <label className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Horário</span>
                  <input
                    type="time" aria-label={controle.rotulo} value={controle.hora}
                    onChange={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) controle.onHora(e.target.value); }}
                    className="h-11 rounded-full bg-muted px-5 text-[16px] font-semibold tabular-nums text-foreground"
                  />
                </label>
              )}
              {controle?.tipo === "fixa" && (
                <p className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-[12px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Horário</span>
                  <span className="h-9 px-4 rounded-full bg-muted grid place-items-center text-[14px] font-semibold tabular-nums">{controle.texto}</span>
                </p>
              )}

              <button type="button" onClick={onFechar} className="mt-6 w-full h-12 rounded-2xl bg-primary text-primary-foreground text-[15.5px] font-semibold active:scale-[.99] transition-transform">
                Pronto
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
