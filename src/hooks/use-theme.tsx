import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type ThemePalette = "default" | "midnight" | "ocean" | "rose" | "forest";

interface ThemeContextType {
  mode: ThemeMode;
  palette: ThemePalette;
  toggleMode: () => void;
  setPalette: (p: ThemePalette) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "light",
  palette: "default",
  toggleMode: () => {},
  setPalette: () => {},
});

export const palettes: Record<ThemePalette, { name: string; preview: string[]; accent: string }> = {
  default: { name: "Original", preview: ["#f5f0e8", "#1a1a1a", "#d6336c", "#f59f00"], accent: "330 65% 50%" },
  midnight: { name: "Midnight", preview: ["#0f172a", "#818cf8", "#6366f1", "#4f46e5"], accent: "239 84% 67%" },
  ocean: { name: "Ocean", preview: ["#f0f9ff", "#0ea5e9", "#06b6d4", "#0284c7"], accent: "199 89% 48%" },
  rose: { name: "Rosé", preview: ["#fff1f2", "#f43f5e", "#fb7185", "#e11d48"], accent: "350 89% 60%" },
  forest: { name: "Forest", preview: ["#f0fdf4", "#22c55e", "#16a34a", "#15803d"], accent: "142 71% 45%" },
};

// Comprehensive CSS variable overrides per palette per mode
const paletteVars: Record<ThemePalette, Record<string, Record<string, string>>> = {
  default: {
    light: {},
    dark: {},
  },
  midnight: {
    light: {
      "--background": "230 25% 95%",
      "--foreground": "230 50% 10%",
      "--card": "230 25% 98%",
      "--card-foreground": "230 50% 10%",
      "--popover": "230 25% 98%",
      "--popover-foreground": "230 50% 10%",
      "--primary": "239 84% 50%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "230 20% 93%",
      "--secondary-foreground": "230 50% 10%",
      "--muted": "230 15% 92%",
      "--muted-foreground": "230 15% 45%",
      "--accent": "239 84% 67%",
      "--accent-foreground": "0 0% 100%",
      "--border": "230 15% 88%",
      "--input": "230 15% 88%",
      "--ring": "239 84% 50%",
      "--chart-1": "239 84% 67%",
      "--chart-2": "260 60% 55%",
      "--chart-3": "220 70% 50%",
      "--chart-4": "280 60% 55%",
      "--chart-5": "200 70% 50%",
    },
    dark: {
      "--background": "230 30% 8%",
      "--foreground": "230 10% 90%",
      "--card": "230 30% 12%",
      "--card-foreground": "230 10% 90%",
      "--popover": "230 30% 12%",
      "--popover-foreground": "230 10% 90%",
      "--primary": "239 84% 75%",
      "--primary-foreground": "230 30% 8%",
      "--secondary": "230 20% 16%",
      "--secondary-foreground": "230 10% 90%",
      "--muted": "230 20% 16%",
      "--muted-foreground": "230 10% 55%",
      "--accent": "239 84% 67%",
      "--accent-foreground": "0 0% 100%",
      "--border": "230 20% 20%",
      "--input": "230 20% 20%",
      "--ring": "239 84% 67%",
      "--chart-1": "239 84% 67%",
      "--chart-2": "260 60% 60%",
      "--chart-3": "220 70% 55%",
      "--chart-4": "280 60% 60%",
      "--chart-5": "200 70% 55%",
    },
  },
  ocean: {
    light: {
      "--background": "200 30% 97%",
      "--foreground": "200 50% 10%",
      "--card": "200 25% 99%",
      "--card-foreground": "200 50% 10%",
      "--popover": "200 25% 99%",
      "--popover-foreground": "200 50% 10%",
      "--primary": "199 89% 38%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "200 20% 94%",
      "--secondary-foreground": "200 50% 10%",
      "--muted": "200 15% 93%",
      "--muted-foreground": "200 15% 40%",
      "--accent": "199 89% 48%",
      "--accent-foreground": "0 0% 100%",
      "--border": "200 15% 88%",
      "--input": "200 15% 88%",
      "--ring": "199 89% 38%",
      "--chart-1": "199 89% 48%",
      "--chart-2": "180 60% 40%",
      "--chart-3": "210 70% 50%",
      "--chart-4": "170 50% 45%",
      "--chart-5": "220 60% 55%",
    },
    dark: {
      "--background": "200 30% 7%",
      "--foreground": "200 10% 92%",
      "--card": "200 30% 11%",
      "--card-foreground": "200 10% 92%",
      "--popover": "200 30% 11%",
      "--popover-foreground": "200 10% 92%",
      "--primary": "199 89% 65%",
      "--primary-foreground": "200 30% 7%",
      "--secondary": "200 20% 15%",
      "--secondary-foreground": "200 10% 92%",
      "--muted": "200 20% 15%",
      "--muted-foreground": "200 10% 55%",
      "--accent": "199 89% 55%",
      "--accent-foreground": "0 0% 100%",
      "--border": "200 20% 18%",
      "--input": "200 20% 18%",
      "--ring": "199 89% 55%",
      "--chart-1": "199 89% 55%",
      "--chart-2": "180 60% 45%",
      "--chart-3": "210 70% 55%",
      "--chart-4": "170 50% 50%",
      "--chart-5": "220 60% 60%",
    },
  },
  rose: {
    light: {
      "--background": "350 30% 97%",
      "--foreground": "350 40% 10%",
      "--card": "350 25% 99%",
      "--card-foreground": "350 40% 10%",
      "--popover": "350 25% 99%",
      "--popover-foreground": "350 40% 10%",
      "--primary": "350 89% 45%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "350 20% 94%",
      "--secondary-foreground": "350 40% 10%",
      "--muted": "350 15% 93%",
      "--muted-foreground": "350 10% 45%",
      "--accent": "350 89% 60%",
      "--accent-foreground": "0 0% 100%",
      "--border": "350 15% 88%",
      "--input": "350 15% 88%",
      "--ring": "350 89% 45%",
      "--chart-1": "350 89% 60%",
      "--chart-2": "330 60% 55%",
      "--chart-3": "10 70% 55%",
      "--chart-4": "320 50% 50%",
      "--chart-5": "0 60% 50%",
    },
    dark: {
      "--background": "350 25% 7%",
      "--foreground": "350 10% 92%",
      "--card": "350 25% 11%",
      "--card-foreground": "350 10% 92%",
      "--popover": "350 25% 11%",
      "--popover-foreground": "350 10% 92%",
      "--primary": "350 89% 70%",
      "--primary-foreground": "350 25% 7%",
      "--secondary": "350 20% 15%",
      "--secondary-foreground": "350 10% 92%",
      "--muted": "350 15% 15%",
      "--muted-foreground": "350 10% 55%",
      "--accent": "350 89% 60%",
      "--accent-foreground": "0 0% 100%",
      "--border": "350 15% 18%",
      "--input": "350 15% 18%",
      "--ring": "350 89% 60%",
      "--chart-1": "350 89% 60%",
      "--chart-2": "330 60% 60%",
      "--chart-3": "10 70% 60%",
      "--chart-4": "320 50% 55%",
      "--chart-5": "0 60% 55%",
    },
  },
  forest: {
    light: {
      "--background": "140 25% 96%",
      "--foreground": "140 40% 10%",
      "--card": "140 20% 99%",
      "--card-foreground": "140 40% 10%",
      "--popover": "140 20% 99%",
      "--popover-foreground": "140 40% 10%",
      "--primary": "142 71% 30%",
      "--primary-foreground": "0 0% 100%",
      "--secondary": "140 15% 93%",
      "--secondary-foreground": "140 40% 10%",
      "--muted": "140 12% 92%",
      "--muted-foreground": "140 10% 42%",
      "--accent": "142 71% 45%",
      "--accent-foreground": "0 0% 100%",
      "--border": "140 12% 87%",
      "--input": "140 12% 87%",
      "--ring": "142 71% 30%",
      "--chart-1": "142 71% 45%",
      "--chart-2": "160 55% 40%",
      "--chart-3": "120 50% 40%",
      "--chart-4": "170 45% 42%",
      "--chart-5": "100 50% 45%",
    },
    dark: {
      "--background": "140 25% 6%",
      "--foreground": "140 10% 92%",
      "--card": "140 25% 10%",
      "--card-foreground": "140 10% 92%",
      "--popover": "140 25% 10%",
      "--popover-foreground": "140 10% 92%",
      "--primary": "142 71% 65%",
      "--primary-foreground": "140 25% 6%",
      "--secondary": "140 15% 14%",
      "--secondary-foreground": "140 10% 92%",
      "--muted": "140 15% 14%",
      "--muted-foreground": "140 10% 55%",
      "--accent": "142 71% 50%",
      "--accent-foreground": "0 0% 100%",
      "--border": "140 15% 17%",
      "--input": "140 15% 17%",
      "--ring": "142 71% 50%",
      "--chart-1": "142 71% 50%",
      "--chart-2": "160 55% 45%",
      "--chart-3": "120 50% 45%",
      "--chart-4": "170 45% 47%",
      "--chart-5": "100 50% 50%",
    },
  },
};

// Collect all CSS variable keys used across all palettes
const allVarKeys = new Set<string>();
Object.values(paletteVars).forEach(modes => {
  Object.values(modes).forEach(vars => {
    Object.keys(vars).forEach(k => allVarKeys.add(k));
  });
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("core-theme-mode");
    return (saved as ThemeMode) || "light";
  });
  const [palette, setPaletteState] = useState<ThemePalette>(() => {
    const saved = localStorage.getItem("core-theme-palette");
    return (saved as ThemePalette) || "default";
  });

  const toggleMode = () => setMode(m => (m === "light" ? "dark" : "light"));
  const setPalette = (p: ThemePalette) => setPaletteState(p);

  useEffect(() => {
    localStorage.setItem("core-theme-mode", mode);
    const root = document.documentElement;
    if (mode === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [mode]);

  useEffect(() => {
    localStorage.setItem("core-theme-palette", palette);
    const root = document.documentElement;
    const vars = paletteVars[palette]?.[mode] || {};
    
    // Reset all custom properties first
    allVarKeys.forEach(key => {
      root.style.removeProperty(key);
    });
    
    // Apply current palette vars
    Object.entries(vars).forEach(([key, val]) => {
      root.style.setProperty(key, val);
    });
  }, [palette, mode]);

  return (
    <ThemeContext.Provider value={{ mode, palette, toggleMode, setPalette }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
