import { Sun, Moon, Palette } from "lucide-react";
import { useTheme, palettes, type ThemePalette } from "@/hooks/use-theme";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";

export const ThemeToggle = ({ showPalette = false }: { showPalette?: boolean }) => {
  const { mode, toggleMode, palette, setPalette } = useTheme();
  const [showPaletteMenu, setShowPaletteMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowPaletteMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex items-center gap-1.5">
      {/* Dark mode toggle */}
      <motion.button
        onClick={toggleMode}
        className="relative w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
        whileTap={{ scale: 0.9 }}
        aria-label="Toggle dark mode"
      >
        <AnimatePresence mode="wait">
          {mode === "light" ? (
            <motion.div key="sun" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Sun className="w-4 h-4" />
            </motion.div>
          ) : (
            <motion.div key="moon" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <Moon className="w-4 h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Palette picker */}
      {showPalette && (
        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={() => setShowPaletteMenu(!showPaletteMenu)}
            className="w-9 h-9 rounded-xl bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            whileTap={{ scale: 0.9 }}
            aria-label="Change theme"
          >
            <Palette className="w-4 h-4" />
          </motion.button>

          <AnimatePresence>
            {showPaletteMenu && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-11 bg-card border border-border rounded-xl shadow-lg p-3 z-50 w-48"
              >
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Tema</p>
                {(Object.keys(palettes) as ThemePalette[]).map(key => (
                  <motion.button
                    key={key}
                    onClick={() => { setPalette(key as any); setShowPaletteMenu(false); }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                      palette === key ? "bg-primary/10 text-primary" : "hover:bg-muted"
                    }`}
                    whileHover={{ x: 2 }}
                  >
                    <div className="flex gap-0.5">
                      {palettes[key].preview.map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full border border-border/50" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <span>{palettes[key].name}</span>
                    {palette === key && <span className="ml-auto text-primary">✓</span>}
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
