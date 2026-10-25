import { useNavigate } from "react-router-dom";
import { Settings2, Star } from "lucide-react";
import { MODULOS, type Modulo } from "@/lib/modulos";
import type { useModulePreferences } from "@/hooks/use-module-preferences";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { trackEvent } from "@/lib/analytics";
import { estadoDoModulo } from "../ModulosNova";
import { TRACO, corDoModulo, tintaDoModulo } from "./paleta";

/**
 * OS MÓDULOS (opção E) — logo abaixo do carrossel, começando ainda na primeira tela.
 *
 *  GRADE (recomendada): 4 colunas, 16 azulejos de 64 px, o nome embaixo. A ordem é a da pessoa, favoritos
 *  na frente com a estrelinha; oculto fica fora. RODADA 3: os azulejos na PALETA ÚNICA — o fundo é a cor do
 *  módulo a 14 % e o ícone (o mesmo glifo de hoje, traço 1,75) é a cor cheia; os SELOS com o número do que
 *  falta (1 · 4 · 5 · 2) saíram — o dono não entendeu o que eram, e o "o que falta" já mora no carrossel.
 *
 *  CARTÕES 3: cartões menores, 3 por linha, com a linha de estado do dia por extenso.
 */
export type VarianteModulosE = "grade" | "cartoes3";
/** RODADA 5: azulejo com a tinta da cor (versão 1) ou BRANCO como os cards, só o ícone colorido (versão 2). */
export type AzulejoE = "tinta" | "branco";

const Azulejo = ({ m, favorito, branco, onClick }: { m: Modulo; favorito: boolean; branco?: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} data-track={`modulo:${m.id}`} data-testid="hn-modulo" className="flex flex-col items-center gap-2 min-w-0 active:scale-95 transition-transform">
    <span className="relative">
      <span
        className={`w-[64px] h-[64px] rounded-[19px] grid place-items-center${branco ? " hn-card !rounded-[19px]" : ""}`}
        style={branco ? { color: corDoModulo(m.id) } : { background: tintaDoModulo(m.id), color: corDoModulo(m.id) }}
      >
        <m.Icon className="w-[28px] h-[28px]" strokeWidth={TRACO} aria-hidden />
      </span>
      {favorito && (
        <span className="absolute -top-1 -left-1 w-[18px] h-[18px] rounded-full grid place-items-center" aria-label="Favorito" style={{ background: corDoModulo("financas"), boxShadow: "0 0 0 2px hsl(var(--hn-fundo))" }}>
          <Star className="w-2.5 h-2.5 text-white fill-white" />
        </span>
      )}
    </span>
    <span className="text-[12px] leading-none font-semibold text-foreground/90 truncate max-w-full">{m.label}</span>
  </button>
);

const Cartao3 = ({ m, estado, favorito, onClick }: { m: Modulo; estado: string; favorito: boolean; onClick: () => void }) => (
  <button type="button" onClick={onClick} data-track={`modulo:${m.id}`} data-testid="hn-modulo" className="hn-card !rounded-[18px] relative p-3 text-left flex flex-col gap-2.5 min-h-[118px] active:scale-[0.98] transition-transform">
    <span className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: tintaDoModulo(m.id), color: corDoModulo(m.id) }}><m.Icon className="w-5 h-5" strokeWidth={TRACO} aria-hidden /></span>
    {favorito && <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full grid place-items-center" aria-label="Favorito" style={{ background: corDoModulo("financas") }}><Star className="w-2.5 h-2.5 text-white fill-white" /></span>}
    <span className="min-w-0">
      <span className="block text-[13.5px] font-semibold leading-tight truncate">{m.label}</span>
      <span className="text-[11.5px] text-muted-foreground leading-[1.3] line-clamp-2 mt-0.5">{estado}</span>
    </span>
  </button>
);

interface Props {
  data: LifeHubData;
  variante: VarianteModulosE;
  azulejo?: AzulejoE;
  /** "Organizar" (e "+N ocultos"): abre a configuração de módulos (a mesma de hoje, use-module-preferences) */
  onOrganizar?: () => void;
  /** A instância ÚNICA de use-module-preferences (a Home é a dona): a grade e a folha "Organizar" leem o mesmo estado. */
  preferencias: ReturnType<typeof useModulePreferences>;
}

export const ModulosE = ({ data, variante, azulejo = "tinta", onOrganizar, preferencias }: Props) => {
  const navigate = useNavigate();
  const { isFavorite, isHidden, ordenar } = preferencias;
  const visiveis = ordenar(MODULOS).filter((m) => !isHidden(m.id));
  const ocultos = MODULOS.length - visiveis.length;
  const abrir = (m: Modulo, i: number) => { trackEvent("home_modulo", { modulo: m.id, posicao: i, favorito: isFavorite(m.id) }); navigate(m.path); };

  return (
    <section data-testid="hn-modulos" data-variante={variante} data-azulejo={azulejo}>
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-[20px] font-bold tracking-tight leading-none">Módulos</h2>
        <button
          type="button"
          onClick={() => onOrganizar?.()}
          data-testid="hn-organizar"
          className="min-h-[36px] -mr-1 px-2.5 rounded-full flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground active:bg-muted/60"
        >
          <Settings2 className="w-4 h-4" strokeWidth={TRACO} aria-hidden />
          Organizar
        </button>
      </div>

      {variante === "grade" ? (
        <div className="grid grid-cols-4 gap-x-2 gap-y-5 px-0.5">
          {visiveis.map((m, i) => <Azulejo key={m.id} m={m} favorito={isFavorite(m.id)} branco={azulejo === "branco"} onClick={() => abrir(m, i)} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {visiveis.map((m, i) => <Cartao3 key={m.id} m={m} estado={estadoDoModulo(m.id, data)} favorito={isFavorite(m.id)} onClick={() => abrir(m, i)} />)}
        </div>
      )}

      {ocultos > 0 && (
        <button type="button" onClick={() => { trackEvent("home_modulos_editar", { origem: "ocultos", ocultos }); onOrganizar?.(); }} data-track="modulos-ocultos-editar" className="w-full min-h-[40px] text-center text-[12.5px] text-muted-foreground mt-2">
          +{ocultos} {ocultos === 1 ? "oculto" : "ocultos"} · Organizar
        </button>
      )}
    </section>
  );
};
