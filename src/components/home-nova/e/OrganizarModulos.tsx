import { AnimatePresence, motion } from "framer-motion";
import { Alca, useFolhaArrastavel, CLASSE_FUNDO_FOLHA, FaixaDoRelogioSobFolha, propsDaFolha } from "./folha-arrasto";
import { ChevronDown, ChevronUp, Eye, EyeOff, Star, X } from "lucide-react";
import { MODULOS } from "@/lib/modulos";
import type { useModulePreferences } from "@/hooks/use-module-preferences";
import { TRACO, corDoModulo, tintaDoModulo } from "./paleta";

/**
 * "ORGANIZAR" (Home nova, 1.0.19) — a mesma configuração de módulos da Home de hoje (a engrenagem do
 * ModuleDrawer: favoritar ★, esconder, mover), com a MESMA fonte (use-module-preferences: `core-module-prefs`,
 * favoritos/ocultos/ordem). Só a cara muda: uma folha com a lista dos 16, cada linha com ★ · olho · ↑ ↓.
 * Esconder um módulo tira o azulejo da grade (e, com MODULO_OCULTA_PENDENCIAS ligada, as pendências dele).
 */
interface Props { aberta: boolean; onFechar: () => void; preferencias: ReturnType<typeof useModulePreferences> }

export const OrganizarModulos = ({ aberta, onFechar, preferencias }: Props) => {
  const { toggleFavorite, toggleHidden, isFavorite, isHidden, ordenar, moveModule } = preferencias;
  const lista = ordenar(MODULOS);
  const arrasto = useFolhaArrastavel(onFechar); // rodada 3: arrastar pra baixo fecha
  const ids = lista.map((m) => m.id);
  const ocultos = lista.filter((m) => isHidden(m.id)).length;

  return (
    <AnimatePresence>
      {aberta && (
        <>
          <FaixaDoRelogioSobFolha />
          <motion.button type="button" aria-label="Fechar" onClick={onFechar} className={CLASSE_FUNDO_FOLHA} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
          <motion.div
            role="dialog" aria-label="Organizar módulos" data-testid="hn-organizar-folha"
            className="fixed inset-x-0 bottom-0 z-[71] max-w-lg mx-auto rounded-t-[28px] bg-card max-h-[88dvh] overflow-y-auto overscroll-contain px-4 pt-2.5 pb-[calc(var(--app-safe-bottom,0px)+16px)]"
            style={{ y: arrasto.y }} {...arrasto.folha}
            {...propsDaFolha(false)}
          >
            <Alca arrasto={arrasto} className="mb-0.5" />
            <div className="flex items-center justify-between px-1 mb-1">
              <div>
                <h3 className="text-[19px] font-bold tracking-tight">Organizar módulos</h3>
                <p className="text-[12.5px] text-muted-foreground">Favorito vai pra frente · esconder tira da Home{ocultos ? ` · ${ocultos} ${ocultos === 1 ? "oculto" : "ocultos"}` : ""}</p>
              </div>
              <button type="button" onClick={onFechar} aria-label="Pronto" data-testid="hn-organizar-pronto" className="h-9 px-3.5 rounded-full text-[13px] font-bold shrink-0" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Pronto</button>
            </div>
            <ul className="mt-2">
              {lista.map((m, i) => {
                const oculto = isHidden(m.id);
                const favorito = isFavorite(m.id);
                return (
                  <li key={m.id} className={`flex items-center gap-2.5 min-h-[56px] px-1 ${oculto ? "opacity-50" : ""}`} data-testid="hn-organizar-linha" data-modulo={m.id} data-oculto={oculto ? "1" : "0"}>
                    <span className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: tintaDoModulo(m.id), color: corDoModulo(m.id) }} aria-hidden>
                      <m.Icon className="w-5 h-5" strokeWidth={TRACO} />
                    </span>
                    <span className="flex-1 min-w-0 text-[15px] font-semibold truncate">{m.label}</span>
                    <button type="button" onClick={() => toggleFavorite(m.id)} data-track="modulo-favoritar" aria-label={favorito ? `Tirar ${m.label} dos favoritos` : `Favoritar ${m.label}`} aria-pressed={favorito} className={`w-10 h-10 rounded-full grid place-items-center ${favorito ? "text-yellow-500" : "text-muted-foreground"}`}>
                      <Star className={`w-[18px] h-[18px] ${favorito ? "fill-current" : ""}`} strokeWidth={2} />
                    </button>
                    <button type="button" onClick={() => toggleHidden(m.id)} data-track={`modulo-ocultar:${m.id}`} aria-label={oculto ? `Mostrar ${m.label}` : `Esconder ${m.label}`} aria-pressed={oculto} className="w-10 h-10 rounded-full grid place-items-center text-muted-foreground">
                      {oculto ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2} />}
                    </button>
                    <span className="flex flex-col">
                      <button type="button" onClick={() => moveModule(m.id, -1, ids)} data-track="modulo-mover-frente" disabled={i === 0} aria-label={`Mover ${m.label} pra cima`} className="w-9 h-7 grid place-items-center text-muted-foreground disabled:opacity-25"><ChevronUp className="w-4 h-4" strokeWidth={2.2} /></button>
                      <button type="button" onClick={() => moveModule(m.id, 1, ids)} data-track="modulo-mover-tras" disabled={i === lista.length - 1} aria-label={`Mover ${m.label} pra baixo`} className="w-9 h-7 grid place-items-center text-muted-foreground disabled:opacity-25"><ChevronDown className="w-4 h-4" strokeWidth={2.2} /></button>
                    </span>
                  </li>
                );
              })}
            </ul>
            <button type="button" onClick={onFechar} className="w-full h-12 mt-2 rounded-2xl text-[15px] font-bold" style={{ background: "var(--hn-mais)", color: "var(--hn-mais-texto)" }}>Pronto</button>
            <span className="sr-only"><X /></span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
