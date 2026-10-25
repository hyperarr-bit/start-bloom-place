import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings2, Star } from "lucide-react";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { trackEvent } from "@/lib/analytics";

/**
 * OS MÓDULOS, GRANDES E EM FOCO (mockup 25/10). A grade de ícones pequenos vira cartões de 2 colunas:
 * o tile colorido do módulo (as cores e ícones de hoje, lib/modulos), o nome e UMA linha de estado que
 * vem dos dados do dia (hub) — "Hoje: Peito", "3/5 hábitos hoje", "Lendo: Essencialismo". Onde não há
 * dado do dia, uma descrição curta do que mora ali. Nunca R$: dinheiro só quando a pessoa entra.
 *
 * Variação "Páginas": os mesmos cartões em páginas de 2×2 que rolam de lado, com bolinhas — a Home fica
 * curta (os 16 módulos cabem numa altura só), como os cartões de macros do Cal AI.
 *
 * Favorito continua com a estrelinha; oculto continua fora. "Organizar" (★ / esconder / ordem) é a mesma
 * edição de hoje — no mockup o botão só existe.
 */
export type VarianteModulos = "cartoes" | "paginas";

const DESCRICAO: Record<string, string> = {
  financas: "Gastos, contas e metas",
  treino: "Monte seu treino",
  dieta: "Cardápio e calorias",
  rotina: "Hábitos e tarefas",
  desenvolvimento: "Metas pessoais",
  saude: "Água, sono e exames",
  casa: "Tarefas da casa",
  estudos: "Matérias e provas",
  biblioteca: "Seus livros",
  beleza: "Pele, cabelo e cuidados",
  viagens: "Roteiros e malas",
  carreira: "Metas e tarefas",
  hiperfoco: "Foco e ideias",
  relacionamentos: "Pessoas e datas",
  pet: "Rotina do pet",
  detox: "Hábitos a largar",
};

/** A linha de estado do módulo pelos dados do dia (sem dinheiro). */
export const estadoDoModulo = (id: string, d: LifeHubData): string => {
  switch (id) {
    case "financas":
      return d.nextBillName ? `Próxima conta: ${d.nextBillName}` : DESCRICAO.financas;
    case "rotina": {
      const total = d.habits.length;
      if (!total) return DESCRICAO.rotina;
      const feitos = d.habits.filter((h) => h.done).length;
      return feitos === total ? "Hábitos de hoje feitos" : `${feitos}/${total} hábitos hoje`;
    }
    case "treino":
      if (d.todayWorkoutGroup) return d.workoutDone ? "Treino de hoje feito ✓" : `Hoje: ${d.todayWorkoutGroup}`;
      if (d.workoutStatus === "descanso") return "Hoje é descanso";
      return DESCRICAO.treino;
    case "dieta":
      return d.mealsTotal > 0 ? `${d.mealsLogged}/${d.mealsTotal} refeições hoje` : DESCRICAO.dieta;
    case "saude":
      return d.waterGoal > 0 ? `Água ${Math.min(d.waterGlasses, d.waterGoal)}/${d.waterGoal} hoje` : DESCRICAO.saude;
    case "biblioteca":
      return d.currentBook ? `Lendo: ${d.currentBook}` : DESCRICAO.biblioteca;
    default:
      return DESCRICAO[id] ?? "";
  }
};

const Cartao = ({ m, estado, favorito, onClick }: { m: Modulo; estado: string; favorito: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    data-track={`modulo:${m.id}`}
    data-testid="hn-modulo"
    className="hn-card !rounded-[20px] relative p-3.5 text-left flex flex-col gap-3 min-h-[112px] active:scale-[0.98] transition-transform"
  >
    <span className={`w-11 h-11 rounded-2xl ${m.color} grid place-items-center`}>
      <m.Icon className="w-[22px] h-[22px]" strokeWidth={2.1} aria-hidden />
    </span>
    {favorito && (
      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-yellow-400 grid place-items-center" aria-label="Favorito">
        <Star className="w-3 h-3 text-white fill-white" />
      </span>
    )}
    <span className="min-w-0">
      <span className="block text-[15px] font-semibold leading-tight truncate">{m.label}</span>
      {/* sem `block`: o line-clamp precisa do display -webkit-box dele (com block o corte em 2 linhas não valia) */}
      <span className="text-[12.5px] text-muted-foreground leading-snug line-clamp-2 mt-0.5">{estado}</span>
    </span>
  </button>
);

interface Props {
  data: LifeHubData;
  variante: VarianteModulos;
}

export const ModulosNova = ({ data, variante }: Props) => {
  const navigate = useNavigate();
  const { isFavorite, isHidden, ordenar } = useModulePreferences();
  const visiveis = ordenar(MODULOS).filter((m) => !isHidden(m.id));
  const ocultos = MODULOS.length - visiveis.length;
  const abrir = (m: Modulo, i: number) => { trackEvent("home_modulo", { modulo: m.id, posicao: i, favorito: isFavorite(m.id) }); navigate(m.path); };

  // variação "páginas": qual página está na tela (pras bolinhas)
  const trilho = useRef<HTMLDivElement>(null);
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    const el = trilho.current;
    if (!el || variante !== "paginas") return;
    const ler = () => setPagina(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", ler, { passive: true });
    return () => el.removeEventListener("scroll", ler);
  }, [variante]);

  const paginas: Modulo[][] = [];
  for (let i = 0; i < visiveis.length; i += 4) paginas.push(visiveis.slice(i, i + 4));

  return (
    <section data-testid="hn-modulos">
      <div className="flex items-end justify-between mb-3 px-1">
        <h2 className="text-[20px] font-bold tracking-tight leading-none">Módulos</h2>
        <button
          type="button"
          onClick={() => trackEvent("home_modulos_editar", { origem: "home-nova" })}
          data-testid="hn-organizar"
          className="min-h-[36px] -mr-1 px-2.5 rounded-full flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground active:bg-muted/60"
        >
          <Settings2 className="w-4 h-4" strokeWidth={2.2} aria-hidden />
          Organizar
        </button>
      </div>

      {variante === "cartoes" ? (
        <div className="grid grid-cols-2 gap-3">
          {visiveis.map((m, i) => <Cartao key={m.id} m={m} estado={estadoDoModulo(m.id, data)} favorito={isFavorite(m.id)} onClick={() => abrir(m, i)} />)}
        </div>
      ) : (
        <>
          <div ref={trilho} className="hn-paginas flex items-start overflow-x-auto snap-x snap-mandatory -mx-4 px-4 gap-4" data-testid="hn-paginas">
            {paginas.map((p, pi) => (
              <div key={pi} className="w-full shrink-0 snap-center grid grid-cols-2 gap-3">
                {p.map((m, i) => <Cartao key={m.id} m={m} estado={estadoDoModulo(m.id, data)} favorito={isFavorite(m.id)} onClick={() => abrir(m, pi * 4 + i)} />)}
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-1.5 mt-4" aria-hidden>
            {paginas.map((_, i) => <span key={i} className={`h-2 rounded-full transition-all ${i === pagina ? "w-5 bg-foreground" : "w-2 bg-foreground/20"}`} />)}
          </div>
        </>
      )}

      {ocultos > 0 && (
        <p className="text-center text-[12.5px] text-muted-foreground mt-3">+{ocultos} {ocultos === 1 ? "oculto" : "ocultos"} · Organizar</p>
      )}
    </section>
  );
};
