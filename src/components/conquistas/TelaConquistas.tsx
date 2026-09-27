import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Instagram, Loader2, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { mesAtualExtenso } from "@/lib/utils";
import { BadgeDetailSheet } from "@/components/gamification/BadgeDetailSheet";
import { LEVELS, type Badge } from "@/components/gamification/types";
import { CAPAS, CapaResponsiva, ORDEM_CAPAS, ehCapa, type CapaId } from "./CapaPlanner";
import { CardSequencia } from "./CardSequencia";
import { GradeAdesivos } from "./GradeAdesivos";
import { SeloNivel } from "./SeloNivel";
import { compartilharCapa } from "./compartilhar-conquistas";
import { useConquistas, usePerfilConquistas, useSequencia } from "./use-conquistas";

export const CHAVE_CAPA = "conquistas-capa";

/** "Set 2026" — o mês do cabeçalho quando a tela é estreita. */
const mesCurto = (d = new Date()) => {
  const m = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${d.getFullYear()}`;
};
const ORIGENS = ["home", "menu", "celebracao"];

/**
 * CONQUISTAS (refeita 26/09, aprovada pelo dono): a capa do planner como
 * cartão de membro, a sequência de dias anotados e a folha de adesivos.
 */
export const TelaConquistas = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { get, set, loaded } = useUserData();
  const seq = useSequencia();
  const conq = useConquistas();
  const perfil = usePerfilConquistas();
  const [selecionado, setSelecionado] = useState<Badge | null>(null);
  const [nivelAberto, setNivelAberto] = useState(false);
  const [postando, setPostando] = useState(false);
  const [desafiosOcultos, setDesafiosOcultos] = usePersistedState<boolean>("finance-challenges-hidden", false);
  const capaGravada = get<unknown>(CHAVE_CAPA, "grafite");
  const capa: CapaId = ehCapa(capaGravada) ? capaGravada : "grafite";

  useEffect(() => {
    const origem = (location.state as { origem?: string } | null)?.origem;
    trackEvent("conquistas_open", { origem: origem && ORIGENS.includes(origem) ? origem : "outro" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trocarCapa = (id: CapaId) => {
    if (id === capa) return;
    set(CHAVE_CAPA, id);
    trackEvent("capa_trocar", { capa: id });
  };

  const postar = async () => {
    setPostando(true);
    try {
      await compartilharCapa({ capa, nome: perfil.nome, membroDesde: perfil.membroDesde, dias: seq.dias, nivel: conq.nivel.name, adesivos: conq.abertos });
    } finally {
      setPostando(false);
    }
  };

  const faltaXp = conq.proximoNivel ? conq.proximoNivel.minXP - conq.xp : 0;
  const base = conq.nivel.minXP;
  const fracaoNivel = conq.proximoNivel ? (conq.xp - base) / (conq.proximoNivel.minXP - base) : 1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/home")} className="hover:bg-muted rounded-md p-1 transition-colors" aria-label="Voltar">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <Trophy className="w-5 h-5 text-amber-500" aria-hidden />
          <h1 className="text-base font-bold tracking-tight">CONQUISTAS</h1>
          <div className="flex items-center gap-2 ml-auto">
            {/* 360 px: "Setembro de 2026" quebrava em duas linhas ao lado de CONQUISTAS */}
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              <span className="hidden min-[400px]:inline">{mesAtualExtenso()}</span>
              <span className="min-[400px]:hidden">{mesCurto()}</span>
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {loaded && (
        <main className="max-w-lg mx-auto px-4 pt-4 pb-8 space-y-3.5">
          <CapaResponsiva
            capa={capa}
            nome={perfil.nome}
            membroDesde={perfil.membroDesde}
            dias={seq.dias}
            nivel={conq.nivel.name}
            onSelo={() => setNivelAberto(true)}
          />

          {/* no 360 o rótulo "CAPA" sai pra caber na mesma fileira (as bolinhas logo embaixo da capa já dizem) */}
          <div className="grid grid-cols-1 min-[350px]:grid-cols-2 gap-2.5">
            <div role="radiogroup" aria-label="Capa do planner" className="h-11 rounded-xl border border-border flex items-center justify-center gap-2 px-1.5">
              <span className="hidden min-[400px]:inline text-[11px] font-extrabold tracking-[0.14em] text-muted-foreground">CAPA</span>
              <span className="flex items-center">
                {ORDEM_CAPAS.map((id) => {
                  const ativa = id === capa;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={ativa}
                      aria-label={CAPAS[id].nome}
                      onClick={() => trocarCapa(id)}
                      className="w-6 h-6 grid place-items-center rounded-full"
                    >
                      <i
                        className={`block w-[18px] h-[18px] rounded-full ${ativa ? "ring-2 ring-offset-1 ring-foreground ring-offset-background" : "border border-black/10 dark:border-white/25"}`}
                        style={{ background: CAPAS[id].amostra }}
                      />
                    </button>
                  );
                })}
              </span>
            </div>
            <button
              type="button"
              onClick={postar}
              disabled={postando}
              className="h-11 rounded-xl bg-foreground text-background font-bold text-[13.5px] inline-flex items-center justify-center gap-2 active:scale-[0.99] transition-transform disabled:opacity-70"
            >
              {postando ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Instagram className="w-[18px] h-[18px]" aria-hidden />}
              Postar nos Stories
            </button>
          </div>

          <CardSequencia seq={seq} onAcao={(rota) => navigate(rota)} />

          <GradeAdesivos
            folha={conq.folha}
            abertos={conq.abertos}
            proximo={conq.proximo}
            diasDeSequencia={seq.dias}
            onSelecionar={setSelecionado}
          />

          {/* Quem escondeu os desafios semanais reativa por aqui (os adesivos de desafio dependem deles) */}
          {desafiosOcultos && (
            <button
              type="button"
              onClick={() => { setDesafiosOcultos(false); toast.success("Desafios semanais de volta no Dashboard! 🎯"); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <Target className="w-3.5 h-3.5" /> Reativar desafios semanais
            </button>
          )}
        </main>
      )}

      <BadgeDetailSheet
        badge={selecionado}
        onClose={() => setSelecionado(null)}
        desbloqueadoEm={selecionado ? conq.desbloqueadas[selecionado.id] : undefined}
        diasDeSequencia={seq.dias}
        perfil={{ nome: perfil.nome, membroDesde: perfil.membroDesde, nivel: conq.nivel.name }}
      />

      {/* Toque no selo da capa: o caminho até o próximo nível */}
      <Sheet open={nivelAberto} onOpenChange={setNivelAberto}>
        <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="max-w-sm mx-auto text-center pt-2">
            <div className="flex justify-center"><SeloNivel nivel={conq.nivel.name} tamanho={84} /></div>
            <SheetTitle className="text-2xl font-bold tracking-tight mt-3">Nível {conq.nivel.name}</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground mt-1">
              {conq.proximoNivel
                ? `${conq.xp} XP · faltam ${faltaXp} XP pra ${conq.proximoNivel.name}`
                : `${conq.xp} XP · o nível mais alto do CORE`}
            </SheetDescription>
            <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-foreground/60" style={{ width: `${Math.round(Math.min(1, fracaoNivel) * 100)}%` }} />
            </div>
            <div className="mt-4 flex justify-between">
              {LEVELS.map((l) => (
                <div key={l.name} className={`flex flex-col items-center gap-1 ${conq.xp >= l.minXP ? "" : "opacity-35 grayscale"}`}>
                  <SeloNivel nivel={l.name} tamanho={34} sombra={false} />
                  <span className="text-[10px] font-bold text-muted-foreground">{l.name}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Cada adesivo vale XP — e o que você conquista fica: o nível nunca volta atrás.</p>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
};
