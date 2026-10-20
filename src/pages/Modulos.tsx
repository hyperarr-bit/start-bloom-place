import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, ChevronUp, ChevronDown, Eye, EyeOff, Star } from "lucide-react";
import { MODULOS, type Modulo } from "@/lib/modulos";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { trackEvent } from "@/lib/analytics";
import { ATRIBUTO_RAIZ, marcarVolta } from "@/lib/nav-abas";

/**
 * ABA MÓDULOS (1.0.17). Os 16 numa lista de planner (ícone na cor do módulo, nome, uma linha do que tem),
 * na ORDEM da pessoa — a mesma preferência da grade da Home (`core-module-prefs`, use-module-preferences).
 * "Editar" é UM botão que liga a edição da lista (★ favorito · olho esconde · ↑↓ ordem), com "Pronto" —
 * no lugar da engrenagem da Home, que punha 4 botões em cada ícone. Ocultos ficam numa seção própria,
 * ainda abrem com um toque. Eventos de sempre (home_modulo / home_modulos_editar) com `origem: "aba_modulos"`.
 */
const DESCRICAO: Record<string, string> = {
  financas: "Gastos, contas e orçamento",
  treino: "Seus treinos da semana",
  dieta: "Refeições e calorias",
  rotina: "Hábitos e agenda da semana",
  desenvolvimento: "Metas e reflexões",
  saude: "Água, sono, remédios e exames",
  casa: "Tarefas e compras da casa",
  estudos: "Matérias, cursos e revisões",
  biblioteca: "Livros e leituras",
  beleza: "Skincare e cuidados",
  viagens: "Destinos e roteiros",
  carreira: "Tarefas e metas do trabalho",
  hiperfoco: "Foco e pensamentos",
  relacionamentos: "Pessoas e datas importantes",
  pet: "Cuidados com o seu pet",
  detox: "Menos tela, mais tempo seu",
};

export default function Modulos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleFavorite, toggleHidden, isFavorite, isHidden, ordenar, moveModule } = useModulePreferences();
  // "+N ocultos · Editar" da Home chega aqui já editando
  const [editando, setEditando] = useState(() => new URLSearchParams(location.search).get("editar") === "1");
  useEffect(() => { if (editando) trackEvent("home_modulos_editar", { origem: "aba_modulos" }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ordenados = ordenar(MODULOS);
  const ids = ordenados.map((m) => m.id);
  const visiveis = ordenados.filter((m) => !isHidden(m.id));
  const ocultos = ordenados.filter((m) => isHidden(m.id));

  const abrir = (m: Modulo, posicao: number) => {
    if (editando) return;
    trackEvent("home_modulo", { modulo: m.id, posicao, favorito: isFavorite(m.id), origem: "aba_modulos" });
    marcarVolta(m.path, "/modulos");
    navigate(m.path);
  };

  const alternarEdicao = () => {
    if (!editando) trackEvent("home_modulos_editar", { origem: "aba_modulos" });
    setEditando((e) => !e);
  };

  const linha = (m: Modulo, i: number, oculto = false) => {
    const pos = ids.indexOf(m.id);
    return (
      <li key={m.id} className={`flex items-center gap-3 px-3 min-h-[60px] ${oculto ? "opacity-60" : ""}`}>
        <button
          type="button"
          onClick={() => abrir(m, i)}
          disabled={editando}
          data-track={`modulo:${m.id}`}
          data-testid={`modulo-${m.id}`}
          className="flex-1 min-w-0 flex items-center gap-3 py-2.5 text-left disabled:cursor-default"
        >
          <span className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center shrink-0 relative`}>
            <m.Icon className="w-5 h-5" aria-hidden />
            {isFavorite(m.id) && !editando && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center" aria-label="Favorito">
                <Star className="w-2 h-2 text-white fill-white" aria-hidden />
              </span>
            )}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">{m.label}</span>
            {!editando && <span className="block text-xs text-muted-foreground truncate">{DESCRICAO[m.id] ?? ""}</span>}
          </span>
        </button>
        {editando ? (
          <span className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => toggleFavorite(m.id)} data-track="modulo-favoritar"
              aria-label={isFavorite(m.id) ? `Tirar ${m.label} dos favoritos` : `Favoritar ${m.label}`} aria-pressed={isFavorite(m.id)}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${isFavorite(m.id) ? "text-yellow-500" : "text-muted-foreground"}`}>
              <Star className={`w-[18px] h-[18px] ${isFavorite(m.id) ? "fill-current" : ""}`} />
            </button>
            <button type="button" onClick={() => toggleHidden(m.id)} data-track={`modulo-ocultar:${m.id}`}
              aria-label={isHidden(m.id) ? `Mostrar ${m.label}` : `Esconder ${m.label}`} aria-pressed={isHidden(m.id)}
              className={`w-9 h-9 rounded-full flex items-center justify-center ${isHidden(m.id) ? "text-destructive" : "text-muted-foreground"}`}>
              {isHidden(m.id) ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
            {!oculto && (
              <>
                <button type="button" onClick={() => moveModule(m.id, -1, ids)} disabled={pos <= 0} data-track="modulo-mover-frente"
                  aria-label={`Subir ${m.label}`} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30">
                  <ChevronUp className="w-[18px] h-[18px]" />
                </button>
                <button type="button" onClick={() => moveModule(m.id, 1, ids)} disabled={pos >= ids.length - 1} data-track="modulo-mover-tras"
                  aria-label={`Descer ${m.label}`} className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground disabled:opacity-30">
                  <ChevronDown className="w-[18px] h-[18px]" />
                </button>
              </>
            )}
          </span>
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" aria-hidden />
        )}
      </li>
    );
  };

  return (
    <div className="min-h-dvh bg-background flex flex-col" {...{ [ATRIBUTO_RAIZ]: "modulos" }} data-testid="tela-modulos">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-lg md:max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold">Módulos</h1>
          <button
            type="button"
            onClick={alternarEdicao}
            data-testid="modulos-editar"
            data-track="modulos-editar"
            className={`h-9 px-3.5 rounded-full text-sm font-semibold transition-colors ${editando ? "bg-foreground text-background" : "text-foreground hover:bg-muted"}`}
          >
            {editando ? "Pronto" : "Editar"}
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-lg md:max-w-2xl mx-auto w-full px-4 pt-4 pb-6 space-y-6">
        {editando && (
          <p className="text-xs text-muted-foreground px-1">
            ★ favorito vem primeiro · o olho esconde · as setas mudam a ordem
          </p>
        )}
        <section aria-labelledby="modulos-seus">
          <h2 id="modulos-seus" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
            Seus módulos · {visiveis.length}
          </h2>
          <ul className="bg-card rounded-2xl border border-border/60 divide-y divide-border/60 overflow-hidden">
            {visiveis.map((m, i) => linha(m, i))}
          </ul>
        </section>

        {ocultos.length > 0 && (
          <section aria-labelledby="modulos-ocultos">
            <h2 id="modulos-ocultos" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Ocultos · {ocultos.length}
            </h2>
            <ul className="bg-card rounded-2xl border border-border/60 divide-y divide-border/60 overflow-hidden">
              {ocultos.map((m, i) => linha(m, visiveis.length + i, true))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
