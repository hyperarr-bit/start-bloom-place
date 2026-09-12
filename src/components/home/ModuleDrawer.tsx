import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Settings, Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { MODULOS } from "@/lib/modulos";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { useState } from "react";

const modules = MODULOS;

export const ModuleDrawer = () => {
  const navigate = useNavigate();
  const { toggleFavorite, toggleHidden, isFavorite, isHidden, ordenar, moveModule } = useModulePreferences();
  const [editMode, setEditMode] = useState(false);

  // Ordem da pessoa (avaliação: "poder mover a ordem das coisas... deixar a
  // tela inicial do seu jeito, mover, editar, ocultar"). Sem ordem salva, é
  // o de sempre: favoritos na frente. As setas do modo de edição andam
  // uma casa por toque — na grade, "esquerda" é subir na leitura.
  const sorted = ordenar(modules);
  const idsOrdenados = sorted.map(m => m.id);

  const visible = editMode ? sorted : sorted.filter(m => !isHidden(m.id));
  const hiddenCount = modules.filter(m => isHidden(m.id)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Módulos</h3>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`p-1.5 rounded-lg transition-colors ${editMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {visible.map((m, i) => (
          <motion.div
            key={m.id}
            className="relative"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: isHidden(m.id) ? 0.4 : 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
          >
            {editMode && (
              <div className="absolute -top-1 -right-1 z-10 flex gap-0.5">
                <button
                  onClick={() => toggleFavorite(m.id)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    isFavorite(m.id) ? "bg-yellow-400 text-white" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  <Star className={`w-2.5 h-2.5 ${isFavorite(m.id) ? "fill-current" : ""}`} />
                </button>
                <button
                  onClick={() => toggleHidden(m.id)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center ${
                    isHidden(m.id) ? "bg-destructive text-white" : "bg-card border border-border text-muted-foreground"
                  }`}
                >
                  {isHidden(m.id) ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                </button>
              </div>
            )}
            <button
              onClick={() => !editMode && navigate(m.path)}
              className="w-full flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <div className={`w-10 h-10 rounded-xl ${m.color} flex items-center justify-center relative`}>
                <m.Icon className="w-5 h-5" />
                {isFavorite(m.id) && !editMode && (
                  <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-yellow-400 flex items-center justify-center">
                    <Star className="w-2 h-2 text-white fill-white" />
                  </div>
                )}
              </div>
              <span className="text-[10px] font-medium text-center leading-tight">{m.label}</span>
            </button>
            {editMode && (
              <div className="flex justify-center gap-1 -mt-1 pb-1">
                <button
                  onClick={() => moveModule(m.id, -1, idsOrdenados)}
                  disabled={i === 0}
                  aria-label={`Mover ${m.label} pra frente`}
                  className="w-6 h-6 rounded-full bg-card border border-border text-muted-foreground flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveModule(m.id, 1, idsOrdenados)}
                  disabled={i === visible.length - 1}
                  aria-label={`Mover ${m.label} pra trás`}
                  className="w-6 h-6 rounded-full bg-card border border-border text-muted-foreground flex items-center justify-center disabled:opacity-30"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {hiddenCount > 0 && !editMode && (
        <button
          onClick={() => setEditMode(true)}
          className="w-full text-center mt-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          +{hiddenCount} oculto{hiddenCount > 1 ? "s" : ""} · Editar
        </button>
      )}

    </div>
  );
};
