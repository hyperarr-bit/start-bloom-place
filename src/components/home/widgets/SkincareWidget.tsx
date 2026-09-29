import { useNavigate } from "react-router-dom";
import { Bell, BellOff, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { diaDaSemanaDaChave, passosDoDia } from "@/lib/beleza-rotina";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import { useSkincare } from "@/components/beleza/use-skincare";
import { FolhaDoSkincare, nomeDoDia } from "@/components/beleza/skincare-do-dia";
import { CartaoBeleza, Serif, TEMA_BELEZA } from "@/components/beleza/kit";

/**
 * SKINCARE DE HOJE na Home (28/09, protótipo da Beleza). Os módulos com
 * lembrete + presença na Home são os mais usados do app; a Beleza não tinha
 * nenhum dos dois (32% abrem, 1,5 min por pessoa no mês). Este card é a MESMA
 * folha do dia da Rotina da Beleza (cabeçalho rosé, manhã pêssego, noite malva,
 * o quadradinho, HOJE | ONTEM): marcar aqui grava na mesma chave de lá.
 * Tocar no passo abre a Beleza. Leva o tema da Beleza (`tema-beleza`): no meio
 * da Home, é o cantinho rosé que diz "isto é da Beleza".
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
      <CartaoBeleza className={TEMA_BELEZA} data-testid="skincare-widget" data-card="skincare-de-hoje">
        <div className="bg-bz-rose text-bz-rose-tinta px-4 pt-3 pb-3">
          <p className="text-[11px] font-extrabold tracking-[.16em] opacity-80">{nome} · {diaCurto(s.hoje)}</p>
          <h4 className="mt-0.5 text-[20px] leading-tight font-bold tracking-tight">
            Skincare <Serif className="text-[23px] font-normal">de hoje</Serif>
          </h4>
        </div>
        <button type="button" onClick={abrir} className="w-full text-left px-4 py-3 flex items-center gap-3 bg-transparent active:bg-bz-blush" data-testid="skincare-vazio">
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-bz-tinta">Sua rotina de pele ainda está vazia.</span>
            <span className="block text-[12px] text-bz-suave">3 perguntas e ela sai pronta, de manhã e de noite.</span>
          </span>
          <ChevronRight className="w-4 h-4 text-bz-suave shrink-0" aria-hidden="true" />
        </button>
      </CartaoBeleza>
    );
  }

  if (size === "small") {
    // o pequeno: quanto falta hoje e quando o próximo lembrete toca
    const semana = diaDaSemanaDaChave(s.hoje);
    const lista = (["manha", "noite"] as const).flatMap((p) => passosDoDia(s.passos[p], semana).map(({ i }) => ({ p, i })));
    const feitos = lista.filter(({ p, i }) => s.feitosDoDia(p, s.hoje).includes(i)).length;
    return (
      <button type="button" onClick={abrir} className={cn(TEMA_BELEZA, "w-full text-left bg-bz-cartao rounded-[var(--bz-raio,24px)] border border-bz-linha overflow-hidden")} data-testid="skincare-widget" data-card="skincare-de-hoje">
        <div className="bg-bz-rose text-bz-rose-tinta px-3 py-2 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-bz-acento" aria-hidden="true" />
          <p className="text-[11.5px] font-extrabold tracking-[.14em]">SKINCARE</p>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[22px] font-extrabold tabular-nums leading-none text-bz-tinta">{feitos}/{lista.length}</p>
          <p className="text-[11.5px] text-bz-suave mt-1">feitos hoje{horas ? ` · 🔔 ${horas}` : ""}</p>
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
        <button type="button" onClick={abrir} className="w-full flex items-center gap-2 px-4 h-12 border-t border-bz-linha bg-bz-papel text-[13px] font-semibold text-bz-suave active:bg-bz-blush" data-testid="abrir-beleza">
          {horas ? <Bell className="w-4 h-4 text-bz-acento" aria-hidden="true" /> : <BellOff className="w-4 h-4" aria-hidden="true" />}
          <span className="text-[12px] font-medium">{horas ? `Lembrete ${horas}` : "Sem lembrete"}</span>
          <span className="ml-auto inline-flex items-center gap-0.5 text-bz-acento font-bold">Abrir Beleza <ChevronRight className="w-4 h-4" aria-hidden="true" /></span>
        </button>
      }
    />
  );
};
