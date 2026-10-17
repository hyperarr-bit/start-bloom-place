import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { somarDias } from "@/lib/sequencia";
import { doseCurta, MODULOS, dosesFeitas, passoPendente, type DiaDaMissao, type EstadoMissaoDoses } from "@/lib/missao-doses";
import "./missao-doses.css";

/** "Ontem" / "Na sexta" / "No sábado" — quando a dose anterior foi feita, do jeito que se fala. */
export function quandoFoi(dia: string, hoje: string): string {
  if (dia === somarDias(hoje, -1)) return "Ontem";
  const nome = new Date(`${dia}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return `${/^(sábado|domingo)$/.test(nome) ? "No" : "Na"} ${nome}`;
}

/** A linha do que ela fez na dose anterior, com o número dela quando existe ("Ontem você montou suas Finanças: R$ 61 por dia."). */
export function linhaDaDoseAnterior(m: EstadoMissaoDoses, hoje: string): string | null {
  const feitas = dosesFeitas(m);
  if (!feitas) return null;
  const f = m.feitos[feitas as DiaDaMissao];
  if (!f?.rotulo) return null;
  const quando = quandoFoi(f.dia, hoje);
  const modulo = m.modulos[feitas - 1];
  const porDia = /^Pode gastar (R\$ [\d.,]+ por dia)$/.exec(f.rotulo.trim());
  if (modulo === "financas" && porDia) return `${quando} você montou suas Finanças: ${porDia[1]}.`;
  if (modulo === "rotina") return `${quando} você começou o hábito “${f.rotulo}”.`;
  if (modulo === "saude") return `${quando} você marcou o 1º copo d'água.`;
  if (modulo === "treino") return `${quando} você montou o treino “${f.rotulo}”.`;
  return `${quando}: “${f.rotulo}” ${MODULOS[modulo].onde}.`;
}

/**
 * O CONVITE DO DIA (16/10, 1.0.16 — braço A, "uma dose por dia").
 *
 * No app a Home não ganha card (dono 03/10: "nada de card novo no topo da Home"). Na 1.0.10 a dose
 * do dia 2 só aparecia pra quem tocava no Lembrete do dia 2 ou entrava SOZINHA no módulo certo — e
 * 47% nunca reabriam. Quem reabre num dia novo encontra, UMA vez por dia, esta folha de baixo:
 * "Dia 2 de 3 · 📅 Rotina · 20 s" + o que ela fez na dose anterior + "Bora" (abre o módulo, o passo entra
 * lá) e "Agora não" (some até amanhã; a dose continua no módulo, na linha das Pendências e no lembrete).
 * A decisão fica na missão (`convites[dia]`, chave `missao-doses`, que nenhuma vassoura leva): fechar e
 * reabrir o app, ou sair e entrar na conta, não a repete no mesmo dia. Segue o tema do app (claro/escuro).
 */
export function ConviteDoDia({ missao, hoje, aoIr, aoDepois, aoVer }: {
  missao: EstadoMissaoDoses;
  hoje: string;
  aoIr: () => void;
  aoDepois: () => void;
  /** chamado 1x quando a folha aparece (quem chama conta a vista e manda `missao_convite acao=visto`) — só se ela
   *  desenha de fato (sem passo pendente ela não desenha nada, e nada conta) */
  aoVer?: () => void;
}) {
  const reduzir = !!useReducedMotion();
  const seq = useSequencia();
  const pendente = passoPendente(missao);
  const feitas = dosesFeitas(missao);
  useEffect(() => { if (pendente) aoVer?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pendente) return null;
  const cfg = MODULOS[pendente.modulo];
  const dia = pendente.n;
  const seg = doseCurta(pendente.modulo, pendente.n).seg;
  // a sequência (dias com QUALQUER registro) está viva em 2 dias e hoje ainda não tem registro: esta dose fecha os 3
  const fechaTres = dia === 3 && seq.dias === 2 && !seq.hojeFeito;
  const anterior = linhaDaDoseAnterior(missao, hoje);
  return createPortal(
    <motion.div
      className="fixed inset-0 z-[230] flex items-end justify-center px-4 pt-10"
      style={{ background: "rgba(15,12,20,.45)", paddingBottom: "calc(var(--app-safe-bottom, 0px) + 20px)" }}
      role="dialog" aria-modal="true" aria-label={`Dia ${dia} de 3`}
      data-camada-guia="missao-doses-convite" data-testid="missao-doses-convite" data-dia={dia}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <motion.div
        initial={reduzir ? false : { y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 26 }}
        className="md-tema relative w-full max-w-[380px] rounded-3xl bg-card text-card-foreground border border-border/60 p-5 text-left shadow-2xl"
      >
        <div className="flex items-center gap-2">
          <span className="flex gap-1" role="img" aria-label={`${feitas} de 3 feitos`}>
            {[0, 1, 2].map((i) => <Quadradinho key={i} marcado={i < feitas} tam={16} />)}
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">Seu plano de 3 dias</span>
        </div>
        <p className="text-[22px] font-black tracking-[-0.02em] leading-tight mt-2.5" data-testid="missao-doses-convite-titulo">
          Dia {dia} de 3 · {cfg.emoji} {cfg.nome} · {seg} s
        </p>
        {(fechaTres || anterior) && (
          <p className="text-[13.5px] text-muted-foreground leading-snug mt-1.5" data-testid="missao-doses-convite-texto">
            {fechaTres ? <><b className="text-foreground">Faltam {seg} s pros seus 3 dias seguidos.</b> </> : null}
            {anterior}
          </p>
        )}
        <button type="button" className="md-botao mt-4" data-tom="magenta" data-testid="missao-doses-convite-ir" onClick={aoIr}>
          Bora <ArrowRight className="w-4 h-4" />
        </button>
        <button type="button" className="md-link" data-testid="missao-doses-convite-depois" onClick={aoDepois}>Agora não</button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
