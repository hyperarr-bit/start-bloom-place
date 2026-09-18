import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ThemeMode = "light" | "dark";
export type ThemePalette = "default" | "midnight" | "ocean" | "rose" | "forest" | "areia";

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

/**
 * TEMAS (refeitos 18/09, pedido do dono: "o Original é lindo, os outros
 * são muito abaixo").
 *
 * O que estava errado nos antigos: eram o Original com uma lavagem de cor —
 * fundo tingido, botão principal saturado (#2b2bd6 no Midnight) e, pior, as
 * cores SEMÂNTICAS trocadas: no Midnight "sucesso" virava roxo e "aviso"
 * lilás; no Rosé, sucesso era rosa. Verde é verde em qualquer tema, porque é
 * informação. E gráficos/dinheiro nem mudavam, então o tema pintava só a
 * moldura.
 *
 * A regra agora, a mesma do Todoist, Bear, Things e Linear: um tema é
 * PAPEL + TINTA + ACENTO. Superfícies e texto mudam; o que significa alguma
 * coisa (sucesso, aviso, erro, receita, despesa, gráficos) fica igual ao
 * Original. O botão principal é a tinta (grafite do tema), não o acento —
 * é o que faz o Original ser bonito: uma cor só, usada pouco.
 *
 * Cada tema tem uma referência de paleta conhecida no escuro (Catppuccin,
 * Nord, Rosé Pine, Everforest, Gruvbox) — identidades que gente reconhece e
 * gosta — e um claro próprio, de papel quase branco com um sopro da cor.
 * Contraste verificado antes de entrar: tinta/papel ≥ 11:1, texto
 * secundário ≥ 5:1, acento como texto ≥ 4.5:1 (claro) / ≥ 5.8:1 (escuro).
 * No escuro o texto em cima do acento é o PAPEL (escuro), não branco —
 * acento claro + branco dava 2:1.
 *
 * Os ids (midnight, ocean, rose, forest) ficam: estão salvos no aparelho de
 * quem já escolheu. Só o nome e as cores mudam. "default" continua vazio:
 * o Original é o :root do index.css, intocado.
 */
type Lado = { paper: string; card: string; chip: string; border: string; ink: string; ink2: string; accent: string };
type Spec = { name: string; preview: string[]; light: Lado; dark: Lado };

const SPEC: Record<Exclude<ThemePalette, "default">, Spec> = {
  midnight: { // Índigo — claro: papel frio; escuro: Catppuccin Mocha (base #1E1E2E, lavender #B4BEFE)
    name: "Índigo", preview: ["#f4f6fc", "#1a1d33", "#5b62d6", "#b4befe"],
    light: { paper: "228 33% 98%", card: "0 0% 100%", chip: "228 28% 94%", border: "228 20% 88%", ink: "232 35% 12%", ink2: "232 12% 44%", accent: "239 65% 56%" },
    dark:  { paper: "240 21% 12%", card: "240 21% 15%", chip: "240 19% 19%", border: "240 17% 24%", ink: "226 64% 88%", ink2: "228 24% 72%", accent: "232 97% 85%" },
  },
  ocean: { // Oceano — claro: papel azul-gelo; escuro: Nord (polar night #2E3440, frost #88C0D0)
    name: "Oceano", preview: ["#f3f8fc", "#132436", "#1a7fb0", "#88c0d0"],
    light: { paper: "204 40% 98%", card: "0 0% 100%", chip: "204 33% 94%", border: "204 22% 88%", ink: "208 40% 11%", ink2: "208 14% 42%", accent: "199 78% 38%" },
    dark:  { paper: "220 16% 14%", card: "220 16% 18%", chip: "220 16% 22%", border: "220 15% 27%", ink: "218 27% 92%", ink2: "219 15% 68%", accent: "193 43% 67%" },
  },
  rose: { // Rosé — claro: papel blush; escuro: Rosé Pine (base #191724, love #EB6F92, text #E0DEF4)
    name: "Rosé", preview: ["#fdf5f6", "#2b1a20", "#d6336c", "#eb6f92"],
    light: { paper: "350 40% 98%", card: "0 0% 100%", chip: "350 33% 95%", border: "350 20% 89%", ink: "345 30% 12%", ink2: "345 10% 44%", accent: "350 70% 50%" },
    dark:  { paper: "249 22% 12%", card: "247 21% 15%", chip: "248 19% 19%", border: "248 16% 25%", ink: "245 50% 91%", ink2: "246 17% 68%", accent: "343 76% 68%" },
  },
  forest: { // Floresta — claro: papel verde-oliva; escuro: Everforest (bg #2D353B, green #A7C080, fg #D3C6AA)
    name: "Floresta", preview: ["#f6f8f2", "#13221a", "#237a4f", "#a7c080"],
    light: { paper: "80 25% 97%", card: "0 0% 100%", chip: "90 22% 93%", border: "90 15% 87%", ink: "150 25% 10%", ink2: "150 8% 40%", accent: "152 55% 32%" },
    dark:  { paper: "200 13% 15%", card: "200 12% 19%", chip: "200 11% 23%", border: "200 10% 29%", ink: "40 30% 82%", ink2: "40 12% 64%", accent: "96 33% 63%" },
  },
  areia: { // Areia — claro: papel creme (Bear Dieci / Craft); escuro: Gruvbox (bg #282828, orange #FE8019, fg #EBDBB2)
    name: "Areia", preview: ["#f7f2ea", "#2a1d14", "#c0552a", "#fe8019"],
    light: { paper: "38 40% 96%", card: "36 30% 99%", chip: "36 30% 92%", border: "34 20% 85%", ink: "25 30% 12%", ink2: "25 10% 42%", accent: "18 70% 44%" },
    dark:  { paper: "0 0% 16%", card: "0 0% 20%", chip: "0 0% 24%", border: "0 0% 30%", ink: "43 59% 81%", ink2: "40 20% 66%", accent: "24 99% 55%" },
  },
};

export const palettes: Record<ThemePalette, { name: string; preview: string[] }> = {
  default: { name: "Original", preview: ["#ffffff", "#1a1a1a", "#d6336c", "#f5f0e8"] },
  ...(Object.fromEntries(Object.entries(SPEC).map(([k, v]) => [k, { name: v.name, preview: v.preview }])) as Record<Exclude<ThemePalette, "default">, { name: string; preview: string[] }>),
};

/* Todas as variáveis de SUPERFÍCIE/TEXTO que o app usa, derivadas do lado.
 * Inclui as dos módulos que têm token próprio (Rotina --rt-*, Saúde
 * --saude-card/muted): sem isso, Rotina ficava branco puro em cima de papel
 * tingido. Semânticas (success/warning/destructive/card-receitas/income/
 * expense/chart) NÃO entram — são as do Original em todo tema. */
const varsDoLado = (l: Lado, modo: ThemeMode): Record<string, string> => {
  const escuro = modo === "dark";
  return {
    "--background": l.paper, "--foreground": l.ink,
    "--card": l.card, "--card-foreground": l.ink,
    "--popover": l.card, "--popover-foreground": l.ink,
    /* 18/09 (dono: "com a troca de tema as cores têm que mudar mais"): nos
       temas alternativos o botão principal, barras de progresso, checkbox,
       switch e aba ativa são o ACENTO do tema (regra do Todoist), não a
       tinta. O anel do score e o selo de sequência também. O Original fica
       como está: grafite. */
    "--primary": l.accent, "--primary-foreground": escuro ? l.paper : "0 0% 100%",
    "--score-ring": l.accent, "--streak": l.accent,
    "--secondary": l.chip, "--secondary-foreground": l.ink,
    "--muted": l.chip, "--muted-foreground": l.ink2,
    "--accent": l.accent, "--accent-foreground": escuro ? l.paper : "0 0% 100%",
    "--border": l.border, "--input": l.border, "--ring": l.accent,
    "--sidebar-background": l.paper, "--sidebar-foreground": l.ink,
    "--sidebar-primary": l.accent, "--sidebar-primary-foreground": escuro ? l.paper : "0 0% 100%",
    "--sidebar-accent": l.chip, "--sidebar-accent-foreground": l.ink,
    "--sidebar-border": l.border, "--sidebar-ring": l.accent,
    "--rt-surface": l.paper, "--rt-card": l.card, "--rt-card-2": l.chip, "--rt-border": l.border,
    "--rt-text": l.ink, "--rt-text-soft": l.ink2,
    "--saude-card": l.card, "--saude-muted": l.ink2,
  };
};

const paletteVars: Record<ThemePalette, Record<string, Record<string, string>>> = {
  default: { light: {}, dark: {} },
  midnight: { light: varsDoLado(SPEC.midnight.light, "light"), dark: varsDoLado(SPEC.midnight.dark, "dark") },
  ocean: { light: varsDoLado(SPEC.ocean.light, "light"), dark: varsDoLado(SPEC.ocean.dark, "dark") },
  rose: { light: varsDoLado(SPEC.rose.light, "light"), dark: varsDoLado(SPEC.rose.dark, "dark") },
  forest: { light: varsDoLado(SPEC.forest.light, "light"), dark: varsDoLado(SPEC.forest.dark, "dark") },
  areia: { light: varsDoLado(SPEC.areia.light, "light"), dark: varsDoLado(SPEC.areia.dark, "dark") },
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
    // Sync the UA color-scheme so Android Chrome paints native widgets
    // (inputs, scrollbars, form controls) with the right colors.
    root.style.colorScheme = mode === "dark" ? "dark" : "light";
    // App da loja: a barra de status do Android tem que seguir o tema DO APP
    // (a classe .dark acima), não o do sistema. Import dinâmico pra não pesar
    // um grama no bundle da web.
    import("@/lib/status-bar").then(m => m.aplicarBarraDeStatus(mode)).catch(() => {});
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
