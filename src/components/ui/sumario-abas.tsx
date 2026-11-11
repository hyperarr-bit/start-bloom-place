/**
 * O SUMÁRIO DAS ABAS — o índice do caderno (07/11, SPEC novidades-guardadas/2026-11-07/trial-abas/SPEC.md §3 T3, §5.1).
 *
 * Só aparece no braço "sumario" (lib/abas-caderno), só pra conta nova. A diferença pro "Ver todas" de hoje: ABRIR NÃO
 * GRAVA NADA. Tocar numa linha abre a aba (tracejada na fileira, o mesmo caminho de um link pra aba oculta) e fecha a
 * folha — ao trocar de aba ela sai da fileira. Só o MARCADOR grava, e só aquela aba, pelo `mostrar()`/`ocultar()` de
 * sempre (`abas-ocultas:<módulo>`, string[] — o mesmo tipo de antes). "Pôr todas na fileira" = o "Mostrar todas" de hoje.
 * "Mudar a ordem" troca os marcadores pelas ↑↓ de hoje.
 *
 * Seções: NA FILEIRA (as à vista) e GUARDADAS (Finanças: PLANEJAR — as 6 foram escolhidas juntas na 1.0.21 e o dado não
 * separa uma da outra). Numeração seguida. Cada linha: número, emoji, nome, a frase de 1 linha (lib/abas-sumario), a
 * faixa fina na cor do módulo e o marcador (cheio = na fileira, vazado = guardada). Letra ≥ 11 px.
 * Mesma folha das outras (alça, arrastar pra baixo fecha, Esc fecha), em portal.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import type { AbaOcultavel, AbasOcultas } from "@/hooks/use-abas-ocultas";
import { useUserData } from "@/hooks/use-user-data";
import { trackEvent } from "@/lib/analytics";
import { fraseDaAba, tituloDasGuardadas } from "@/lib/abas-sumario";
import { EVENTO_DICAS_DE_NOVO, dicasDoModulo, type DetalheDicasDeNovo } from "@/lib/dicas-do-modulo";
import {
  Alca, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha, propsDoFundo, useFolhaArrastavel,
} from "@/components/home-nova/e/folha-arrasto";

const useContaSePuder = () => {
  try { return useUserData(); } catch { return null; }
};
const dois = (n: number) => String(n).padStart(2, "0");

interface FolhaSumarioProps<T extends AbaOcultavel> {
  abas: AbasOcultas<T>;
  aberta: boolean;
  onFechar: () => void;
  ativa: string;
  /** A cor do módulo (faixa fina de cada linha e o fio das seções). */
  cor: string;
  /** Abrir a aba (sem gravar) — a fileira fecha a folha e troca. */
  onAbrir: (id: string) => void;
  /** Guardar a aba (o marcador) — o mesmo ocultar da fileira, com a origem "sumario". */
  ocultarAba: (id: string) => boolean;
}

export function FolhaSumario<T extends AbaOcultavel>({ abas, aberta, onFechar, ativa, cor, onAbrir, ocultarAba }: FolhaSumarioProps<T>) {
  const { todas, visiveis, ocultas, mostrar, mostrarTodas, mover, modulo } = abas;
  const semMovimento = !!useReducedMotion();
  const [ordenando, setOrdenando] = useState(false);
  const arrasto = useFolhaArrastavel(onFechar, semMovimento);
  const conta = useContaSePuder();
  const chaveDaDica = modulo ? `core-tip-seen-${modulo}` : "";
  const podeVerDicas = !!conta && !!modulo && dicasDoModulo(modulo).length > 0 && !!conta.get<unknown>(chaveDaDica, "");

  useEffect(() => { if (!aberta) setOrdenando(false); }, [aberta]);
  useEffect(() => {
    if (!aberta) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [aberta, onFechar]);

  const verDicasDeNovo = () => {
    if (!modulo || !conta) return;
    conta.set(chaveDaDica, "");
    window.dispatchEvent(new CustomEvent<DetalheDicasDeNovo>(EVENTO_DICAS_DE_NOVO, { detail: { modulo } }));
    trackEvent("dicas_de_novo", { modulo });
    onFechar();
  };

  if (typeof document === "undefined") return null;
  const visIds = new Set(visiveis.map((a) => a.id));
  const naFileira = todas.filter((a) => visIds.has(a.id));
  const guardadas = todas.filter((a) => !visIds.has(a.id));
  const numero = new Map([...naFileira, ...guardadas].map((a, i) => [a.id, i + 1]));

  // funções de desenho (não componentes): o marcador troca a linha de seção sem desmontar a folha nem perder o foco
  const linha = (tab: T, i: number) => {
    const naFila = visIds.has(tab.id);
    const ultima = naFila && visiveis.length === 1;
    const frase = modulo ? fraseDaAba(modulo, tab.id) : undefined;
    return (
      <li
        key={tab.id}
        data-testid="sumario-linha" data-aba={tab.id} data-na-fileira={naFila ? "1" : "0"}
        className={`relative flex items-center gap-2 min-h-[56px] border-t border-border/60 first:border-t-0 ${tab.id === ativa ? "bg-muted/50" : ""}`}
      >
        <span aria-hidden className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: cor, opacity: naFila ? 0.9 : 0.35 }} />
        <button
          type="button"
          onClick={() => onAbrir(tab.id)}
          aria-label={`Abrir ${tab.label}`}
          data-track={`sumario-abrir:${tab.id}`}
          className="flex-1 min-w-0 flex items-center gap-2.5 py-2 pl-3 text-left"
        >
          <span className="w-6 shrink-0 text-[11px] tabular-nums text-muted-foreground">{dois(numero.get(tab.id) ?? i + 1)}</span>
          <span className="w-6 shrink-0 text-[17px] leading-none" aria-hidden>{tab.icon ?? "•"}</span>
          <span className="min-w-0 flex flex-col">
            <span className={`text-[13px] font-bold uppercase tracking-wide truncate ${naFila ? "" : "text-foreground/75"}`}>{tab.label}</span>
            {frase && <span className="text-[12px] text-muted-foreground truncate">{frase}</span>}
          </span>
        </button>
        {ordenando && mover ? (
          <span className="flex flex-col pr-1">
            <button type="button" onClick={() => mover(tab.id, -1)} disabled={todas[0]?.id === tab.id} aria-label={`Mover ${tab.label} pra cima`} data-track="aba-mover-frente" className="w-10 h-7 grid place-items-center text-muted-foreground disabled:opacity-25"><ChevronUp className="w-4 h-4" strokeWidth={2.2} /></button>
            <button type="button" onClick={() => mover(tab.id, 1)} disabled={todas[todas.length - 1]?.id === tab.id} aria-label={`Mover ${tab.label} pra baixo`} data-track="aba-mover-tras" className="w-10 h-7 grid place-items-center text-muted-foreground disabled:opacity-25"><ChevronDown className="w-4 h-4" strokeWidth={2.2} /></button>
          </span>
        ) : (
          <button
            type="button"
            disabled={ultima}
            aria-pressed={naFila}
            aria-label={naFila ? `Tirar ${tab.label} da fileira` : `Pôr ${tab.label} na fileira`}
            data-track={`sumario-marcador:${tab.id}`}
            data-testid="sumario-marcador"
            onClick={() => { if (naFila) ocultarAba(tab.id); else mostrar(tab.id, "sumario"); }}
            className="w-11 h-11 shrink-0 grid place-items-center disabled:opacity-40"
          >
            <Bookmark className="w-[18px] h-[18px]" strokeWidth={2} style={{ color: naFila ? cor : undefined }} fill={naFila ? "currentColor" : "none"} aria-hidden />
          </button>
        )}
      </li>
    );
  };

  const secao = (titulo: string, lista: T[], inicio: number) => lista.length === 0 ? null : (
    <section className="mt-3" data-testid="sumario-secao" data-titulo={titulo}>
      <div className="flex items-baseline justify-between px-1 pt-2 pb-1 border-t-2" style={{ borderColor: cor }}>
        <h4 className="text-[11px] font-bold tracking-[0.14em] text-foreground/80">{titulo}</h4>
        <span className="text-[11px] text-muted-foreground">{lista.length} {lista.length === 1 ? "aba" : "abas"}</span>
      </div>
      <ul>{lista.map((t, i) => linha(t, inicio + i))}</ul>
    </section>
  );

  return createPortal(
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button type="button" aria-label="Fechar" tabIndex={-1} onClick={onFechar} className={CLASSE_FUNDO_FOLHA} {...propsDoFundo(semMovimento)} />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Sumário" data-testid="abas-sumario-folha"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card text-foreground border-t border-border max-h-[85dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(semMovimento)}
          >
            <Alca arrasto={arrasto} className="mb-0.5" />
            <div className="flex items-start justify-between gap-3 px-1 mb-1">
              <div className="min-w-0">
                <h3 className="text-[19px] font-bold tracking-tight">Sumário</h3>
                <p className="text-[12.5px] text-muted-foreground leading-snug">
                  {ordenando ? "Use as setas pra mudar a ordem da fileira." : "Toque pra abrir. O marcador põe a aba na fileira."}
                </p>
              </div>
              <button
                type="button"
                onClick={ordenando ? () => setOrdenando(false) : onFechar}
                data-testid="abas-sumario-pronto"
                className="h-9 px-3.5 rounded-full text-[13px] font-bold shrink-0 bg-foreground text-background"
              >
                Pronto
              </button>
            </div>
            {secao("NA FILEIRA", naFileira, 0)}
            {secao(modulo ? tituloDasGuardadas(modulo) : "GUARDADAS", guardadas, naFileira.length)}
            <div className="flex items-center justify-between gap-3 px-1 pt-3 mt-1 border-t border-border/60">
              {mover && !ordenando ? (
                <button type="button" onClick={() => setOrdenando(true)} data-testid="sumario-mudar-ordem" className="min-h-[44px] text-[12.5px] text-muted-foreground">
                  Mudar a ordem
                </button>
              ) : <span />}
              {ocultas.length > 0 && !ordenando && (
                <button
                  type="button"
                  onClick={() => mostrarTodas("sumario")}
                  data-testid="sumario-por-todas"
                  className="min-h-[44px] text-[12.5px] font-semibold underline decoration-dotted underline-offset-4"
                >
                  Pôr todas na fileira
                </button>
              )}
            </div>
            {podeVerDicas && (
              <button type="button" onClick={verDicasDeNovo} data-testid="abas-ver-dicas-de-novo" className="w-full mt-1 py-2 text-[12.5px] text-muted-foreground underline decoration-dotted underline-offset-4">
                Ver dicas de novo
              </button>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
