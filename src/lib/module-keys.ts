// Lightweight list of module route segments. Kept free of component imports so
// it can be used by use-demo-mode (which module pages import) without creating
// a circular dependency. The heavy component map lives in preview-modules.tsx.
export const MODULE_KEYS = [
  "financas",
  "rotina",
  "desenvolvimento",
  "saude",
  "casa",
  "estudos",
  "biblioteca",
  "beleza",
  "viagens",
  "carreira",
  "treino",
  "dieta",
  "hiperfoco",
  "mente",
  "relacionamentos",
  "pet",
  "detox",
] as const;

export const MODULE_KEY_SET = new Set<string>(MODULE_KEYS);
