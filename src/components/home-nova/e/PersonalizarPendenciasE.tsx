import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Alca, useFolhaArrastavel } from "./folha-arrasto";
import { X } from "lucide-react";
import {
  CATALOGO_PENDENCIAS, DIAS_CURTOS, comPeso, estaOculto, ocultar, religar,
  type PendenciasPrefs, type TipoPendencia,
} from "@/lib/home-pendencias";
import { ICONE_DO_TIPO, TRACO, corDoTipo, tintaDoTipo } from "./paleta";

/**
 * "PERSONALIZAR PENDÊNCIAS" NO ESTILO DA HOME NOVA (rodada 2, 26/10 — dono: "está complexo e no design velho").
 * A mesma coisa que a folha de hoje faz (lib/home-pendencias: ocultar/religar um tipo; o peso todo dia ou 1x por
 * semana num dia), em UMA lista limpa: o ícone no disco da cor, o nome e um interruptor por linha; o peso, quando
 * ligado, mostra as duas opções embaixo. Uma frase só de explicação. Sem bordas, cantos grandes, tudo em pílulas.
 */
export const Interruptor = ({ ligado, onChange, rotulo, disabled, testid }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; disabled?: boolean; testid?: string }) => (
  <button
    type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={disabled} data-testid={testid}
    onClick={() => onChange(!ligado)}
    className="relative w-[46px] h-[28px] rounded-full transition-colors shrink-0 disabled:opacity-40"
    style={{ background: ligado ? "var(--hn-mais)" : "hsl(var(--muted-foreground) / 0.28)" }}
  >
    <span className="absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform" style={{ transform: ligado ? "translateX(18px)" : "none" }} aria-hidden />
  </button>
);

/** Um grupo de pílulas (uma escolha só). */
export const Segmentos = <T extends string>({ opcoes, ativa, aoEscolher, rotulo }: { opcoes: ReadonlyArray<[T, string]>; ativa: T; aoEscolher: (v: T) => void; rotulo: string }) => (
  <div className="flex gap-1.5 rounded-full p-1" role="group" aria-label={rotulo} style={{ background: "hsl(var(--muted) / 0.6)" }}>
    {opcoes.map(([v, texto]) => {
      const on = v === ativa;
      return (
        <button key={v} type="button" onClick={() => aoEscolher(v)} aria-pressed={on} className="flex-1 h-9 rounded-full text-[13px] font-semibold transition-colors" style={on ? { background: "hsl(var(--card))", boxShadow: "var(--hn-sombra)" } : { color: "hsl(var(--muted-foreground))" }}>
          {texto}
        </button>
      );
    })}
  </div>
);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefs: PendenciasPrefs;
  onChange: (p: PendenciasPrefs) => void;
  /** tipos escondidos porque o MÓDULO deles está oculto na Home: a linha explica e o interruptor trava */
  porModulo?: TipoPendencia[];
  /** sem título próprio (quando mora dentro de outra página) */
  embutida?: boolean;
}

export function ListaDePendencias({ prefs, onChange, porModulo = [] }: Pick<Props, "prefs" | "onChange" | "porModulo">) {
  const alternar = (tipo: TipoPendencia, mostrar: boolean) => onChange(mostrar ? religar(prefs, tipo) : ocultar(prefs, tipo));
  return (
    <ul className="space-y-1" data-testid="hn-prefs-lista">
      {CATALOGO_PENDENCIAS.map((c) => {
        const peloModulo = porModulo.includes(c.tipo);
        const ligado = !estaOculto(prefs, c.tipo) && !peloModulo;
        const Icone = ICONE_DO_TIPO[c.tipo];
        return (
          <li key={c.tipo} data-testid={`pref-${c.tipo}`} data-ligado={ligado ? "1" : "0"} data-pelo-modulo={peloModulo ? "" : undefined} className="rounded-[18px]" style={{ background: ligado ? "transparent" : "hsl(var(--muted) / 0.35)" }}>
            <div className="flex items-center gap-3 h-[56px] px-2">
              <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0" style={{ background: ligado ? tintaDoTipo(c.tipo) : "hsl(var(--muted))" }} aria-hidden>
                <Icone className="w-[18px] h-[18px]" strokeWidth={TRACO} style={{ color: ligado ? corDoTipo(c.tipo) : "hsl(var(--muted-foreground))" }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className={`block text-[15px] font-semibold truncate ${ligado ? "" : "text-muted-foreground"}`}>{c.nome}</span>
                {peloModulo && <span className="block text-[11.5px] text-muted-foreground leading-tight">Escondido junto com o módulo</span>}
              </span>
              <Interruptor ligado={ligado} disabled={peloModulo} onChange={(v) => alternar(c.tipo, v)} rotulo={`Mostrar ${c.nome}`} />
            </div>
            {c.tipo === "peso" && ligado && (
              <div className="px-2 pb-3 space-y-2" data-testid="peso-frequencia">
                <Segmentos
                  rotulo="Frequência da pesagem"
                  opcoes={[["diaria", "Todo dia"], ["semanal", "1x por semana"]] as const}
                  ativa={prefs.peso.frequencia}
                  // ao virar semanal, o dia nasce como HOJE ("a partir de hoje, toda semana"); já semanal, só troca a frequência
                  aoEscolher={(f) => onChange(comPeso(prefs, f, f === "semanal" && prefs.peso.frequencia !== "semanal" ? new Date().getDay() : undefined))}
                />
                {prefs.peso.frequencia === "semanal" && (
                  <div className="flex gap-1.5" role="group" aria-label="Dia da pesagem">
                    {DIAS_CURTOS.map((d, i) => {
                      const on = prefs.peso.diaSemana === i;
                      return (
                        <button key={d} type="button" onClick={() => onChange(comPeso(prefs, "semanal", i))} aria-pressed={on} aria-label={`Pesar ${d}`} className="flex-1 h-9 rounded-full text-[12px] font-semibold transition-colors" style={on ? { background: "var(--hn-mais)", color: "var(--hn-mais-texto)" } : { background: "hsl(var(--muted) / 0.6)", color: "hsl(var(--muted-foreground))" }}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PersonalizarPendenciasE({ open, onOpenChange, prefs, onChange, porModulo = [] }: Props) {
  const semMovimento = useReducedMotion();
  const fechar = () => onOpenChange(false);
  const arrasto = useFolhaArrastavel(fechar, !!semMovimento); // rodada 3: arrastar pra baixo fecha
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button type="button" aria-label="Fechar" onClick={fechar} className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: semMovimento ? 0 : 0.2 }} />
          <motion.div
            role="dialog" aria-label="Personalizar pendências" data-testid="hn-prefs-folha" data-folha="pendencias-personalizar"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={semMovimento ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 38 }}
          >
            <Alca arrasto={arrasto} className="mb-1.5" />
            <div className="flex items-start justify-between gap-3 px-1 mb-3">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">Pendências de hoje</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">O que fica desligado sai da lista e do score.</p>
              </div>
              <button type="button" onClick={fechar} aria-label="Fechar" data-testid="hn-prefs-fechar" className="w-9 h-9 -mr-1 rounded-full grid place-items-center bg-muted shrink-0"><X className="w-4 h-4" strokeWidth={2.2} /></button>
            </div>
            <ListaDePendencias prefs={prefs} onChange={onChange} porModulo={porModulo} />
            <p className="px-2 pt-3 text-[12px] text-muted-foreground leading-snug">Compromissos, tarefas e contas que você criou sempre aparecem.</p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
