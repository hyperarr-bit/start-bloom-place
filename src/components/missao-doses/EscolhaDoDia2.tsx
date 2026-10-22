import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { MODULOS, SUB_DO_TILE, diaDaMissao, dosesFeitas, type EstadoMissaoDoses, type ModuloDaMissao } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";
import { entrada, MOV } from "@/lib/movimento";
import "./missao-doses.css";

const reais = (n: number): string => Math.floor(n).toLocaleString("pt-BR");

/**
 * O título pelo dia REAL da missão (revisor 22/10): quem tocou "Agora não" no dia 2 (ou só voltou no dia 4) vê a folha
 * de novo num dia seguinte (1x por dia, a régua do convite) — "Dia 2: escolhe o seu" no dia 5 era mentira. Dia 2 =
 * "Dia 2: escolhe o seu"; qualquer outro dia = "Hoje: escolhe o seu". A linha da dose 1 idem: "Ontem" só no dia 2.
 */
export const tituloDaEscolha = (dia: number): string => (dia === 2 ? "Dia 2: escolhe o seu" : "Hoje: escolhe o seu");
export const quandoFoiADose1 = (dia: number): string => (dia === 2 ? "Ontem" : "Dia 1");

/**
 * "DIA 2: ESCOLHE O SEU" (1.0.18, chave `dias23` — RELATORIO M1 + M3, mockup dia2-escolhe-o-seu).
 *
 * No lugar do convite "Dia 2: Rotina" (feito por 2–4%), quem volta no dia 2 encontra, 1x por dia, esta folha de baixo:
 *   · o que FICOU PRONTO desde ontem — "Hoje dá pra gastar R$ 58" (o número de Finanças recalculado; só com Finanças
 *     montada);
 *   · "Dia 2: escolhe o seu" + 3 módulos pessoais (filtrados pela área da porta, sem intro vista) — "Começar Beleza"
 *     leva pro módulo e a INTRO dele é a dose 2 (o tutorial na 1ª abertura continua valendo);
 *   · "Agora não": nada escolhido; a linha "Dia 2 · escolhe o seu" fica nas Pendências (tocar reabre esta folha).
 * A decisão e as vistas moram na missão (`convites`/`convitesVistos`, como o convite de sempre): fechar e reabrir o
 * app não repete no mesmo dia. Segue o tema do app (claro/escuro). Sem card no topo da Home.
 */
export function EscolhaDoDia2({ missao, opcoes, porDia, aoVer, aoComecar, aoAgoraNao }: {
  missao: EstadoMissaoDoses;
  opcoes: ModuloDaMissao[];
  /** o "quanto dá pra gastar hoje" recalculado (null = sem Finanças montada: a linha de ontem no lugar) */
  porDia: number | null;
  aoVer?: () => void;
  aoComecar: (modulo: ModuloDaMissao, posicao: number) => void;
  aoAgoraNao: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const [marcado, setMarcado] = useState<ModuloDaMissao | null>(opcoes[0] ?? null);
  const feitas = dosesFeitas(missao);
  useEffect(() => { if (opcoes.length) aoVer?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!opcoes.length || !marcado) return null;
  const ontem = MODULOS[missao.modulos[0]];
  const dia = (() => { try { return diaDaMissao(missao, localDayKey()); } catch { return 2; } })();
  const titulo = tituloDaEscolha(dia);
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10 overflow-y-auto"
      style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      role="dialog" aria-modal="true" aria-label={titulo}
      data-camada-guia="missao-doses-convite" data-testid="dia2-escolha"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={entrada(reduzir, MOV.base)}
    >
      <motion.div
        initial={reduzir ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={entrada(reduzir, MOV.calmo, 0.08)}
        className="md-tema relative w-full max-w-[380px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 text-left shadow-2xl"
      >
        <span className="flex gap-1" role="img" aria-label={`${feitas} de 3 feitos`}>
          {[0, 1, 2].map((i) => <Quadradinho key={i} marcado={i < feitas} tam={16} />)}
        </span>
        {porDia !== null && (
          <div className="mt-3 rounded-2xl px-4 py-3 bg-[#FFF6D1] text-[#2b2b2f] dark:bg-[rgba(255,211,110,.14)] dark:text-foreground" data-testid="dia2-pronto">
            <span className="block text-[11px] font-extrabold tracking-[.12em] uppercase text-[#9a5b00] dark:text-[#ffd36e]">Ficou pronto</span>
            <span className="block text-[18px] font-black tracking-[-0.01em] leading-tight mt-0.5" data-testid="dia2-pronto-valor">Hoje dá pra gastar R$ {reais(porDia)}</span>
          </div>
        )}
        <p className="text-[24px] font-black tracking-[-0.02em] leading-tight mt-3" data-testid="dia2-escolha-titulo">{titulo}</p>
        {porDia === null && (
          <p className="text-[14px] text-muted-foreground mt-1 flex items-center gap-1.5" data-testid="dia2-ontem">
            <Check className="w-4 h-4 text-[#1a8f5a]" aria-hidden /> {quandoFoiADose1(dia)}: {ontem.nome}
          </p>
        )}
        <div className="grid grid-cols-3 gap-2.5 mt-4" role="radiogroup" aria-label="O seu 2º módulo">
          {opcoes.map((mod) => {
            const cfg = MODULOS[mod];
            const ativo = mod === marcado;
            return (
              <button key={mod} type="button" role="radio" aria-checked={ativo}
                className="md-tile !aspect-auto py-4 px-1 normal-case" style={{ background: cfg.cor, borderColor: ativo ? "hsl(var(--foreground))" : "transparent" }}
                data-marcado={ativo ? "" : undefined} data-testid={`dia2-opcao-${mod}`} onClick={() => setMarcado(mod)}>
                <span className="md-tile-emoji" aria-hidden>{cfg.emoji}</span>
                <span className="uppercase">{cfg.nome}</span>
                {SUB_DO_TILE[mod] && <span className="text-[11px] font-semibold tracking-normal normal-case text-[#2b2b2f]/70 leading-tight text-center">{SUB_DO_TILE[mod]}</span>}
              </button>
            );
          })}
        </div>
        <button type="button" className="md-botao mt-5" data-tom="magenta" data-testid="dia2-escolha-comecar"
          onClick={() => aoComecar(marcado, opcoes.indexOf(marcado) + 1)}>
          Começar {MODULOS[marcado].nome}
        </button>
        <button type="button" className="md-link" data-testid="dia2-escolha-depois" onClick={aoAgoraNao}>Agora não</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
