import { useNavigate } from "react-router-dom";
import { Bell, BellOff, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { diaDaSemanaDaChave, passosDoDia } from "@/lib/beleza-rotina";
import { COR_DO_DIA, textoDoDia } from "@/components/treino/planner";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import { useSkincare } from "@/components/beleza/use-skincare";
import { FolhaDoSkincare, nomeDoDia } from "@/components/beleza/skincare-do-dia";

/**
 * SKINCARE DE HOJE na Home (28/09, protótipo da Beleza). Os módulos com
 * lembrete + presença na Home são os mais usados do app; a Beleza não tinha
 * nenhum dos dois (32% abrem, 1,5 min por pessoa no mês). Este card é a MESMA
 * folha do dia da Rotina da Beleza (faixa na cor do dia, MANHÃ/NOITE, o
 * quadradinho, HOJE | ONTEM): marcar aqui grava na mesma chave de lá.
 * Tocar no passo abre a Beleza.
 *
 * Opcional como todo widget (ordem do dono): entra pelo "Adicionar widget" ou
 * pelo "Pôr na Home" que a Beleza oferece logo depois de montar a rotina.
 */
export const SkincareWidget = ({ size = "large" }: { size?: "small" | "large" }) => {
  const navigate = useNavigate();
  const s = useSkincare();
  const abrir = () => navigate("/beleza");
  const nome = nomeDoDia(s.hoje);
  const lembrete = s.lembrete;
  const horas = [lembrete.manha.ligado && lembrete.manha.hora, lembrete.noite.ligado && lembrete.noite.hora].filter(Boolean).join(" · ");

  if (s.vazia) {
    return (
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden" data-testid="skincare-widget" data-card="skincare-de-hoje">
        <div className={cn(COR_DO_DIA[nome], textoDoDia(nome), "px-4 py-2.5")}>
          <h4 className="text-[15px] font-extrabold tracking-wide leading-tight">{nome} · {diaCurto(s.hoje)}</h4>
          <p className="text-[12px] opacity-90 mt-0.5 inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> Skincare de hoje</p>
        </div>
        <button type="button" onClick={abrir} className="w-full text-left px-4 py-3 flex items-center gap-3 active:bg-muted/40" data-testid="skincare-vazio">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold">Sua rotina de pele ainda está vazia.</span>
            <span className="block text-[12px] text-muted-foreground">3 perguntas e ela sai pronta, de manhã e de noite.</span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (size === "small") {
    // o pequeno: quanto falta hoje e quando o próximo lembrete toca
    const semana = diaDaSemanaDaChave(s.hoje);
    const lista = (["manha", "noite"] as const).flatMap((p) => passosDoDia(s.passos[p], semana).map(({ i }) => ({ p, i })));
    const feitos = lista.filter(({ p, i }) => s.feitosDoDia(p, s.hoje).includes(i)).length;
    return (
      <button type="button" onClick={abrir} className="w-full text-left bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden" data-testid="skincare-widget" data-card="skincare-de-hoje">
        <div className={cn(COR_DO_DIA[nome], textoDoDia(nome), "px-3 py-2")}>
          <p className="text-[12px] font-extrabold tracking-wide">🧴 SKINCARE</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[20px] font-extrabold tabular-nums leading-none">{feitos}/{lista.length}</p>
          <p className="text-[11.5px] text-muted-foreground mt-1">feitos hoje{horas ? ` · 🔔 ${horas}` : ""}</p>
        </div>
      </button>
    );
  }

  return (
    <FolhaDoSkincare
      s={s}
      modo="home"
      testId="skincare-widget"
      onAbrirPasso={abrir}
      rodape={
        <button type="button" onClick={abrir} className="w-full flex items-center gap-2 px-3 h-12 border-t border-border/60 text-[13px] font-semibold text-muted-foreground active:bg-muted/40" data-testid="abrir-beleza">
          {horas ? <Bell className="w-4 h-4" aria-hidden="true" /> : <BellOff className="w-4 h-4" aria-hidden="true" />}
          <span className="text-[12px] font-medium">{horas ? `Lembrete ${horas}` : "Sem lembrete"}</span>
          <span className="ml-auto inline-flex items-center gap-0.5">Abrir Beleza <ChevronRight className="w-4 h-4" aria-hidden="true" /></span>
        </button>
      }
    />
  );
};
