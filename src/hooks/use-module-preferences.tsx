import { useState, useEffect } from "react";
import { useUserData } from "@/hooks/use-user-data";

export interface ModulePrefs {
  favorites: string[];
  hidden: string[];
}

const KEY = "core-module-prefs";

export function useModulePreferences() {
  const { get, set: setData } = useUserData();
  const [prefs, setPrefs] = useState<ModulePrefs>(() => get(KEY, { favorites: [], hidden: [] }));

  useEffect(() => {
    setData(KEY, prefs);
  }, [prefs, setData]);

  const toggleFavorite = (id: string) => {
    setPrefs(p => ({
      ...p,
      favorites: p.favorites.includes(id) ? p.favorites.filter(f => f !== id) : [...p.favorites, id],
    }));
  };

  const toggleHidden = (id: string) => {
    setPrefs(p => ({
      ...p,
      hidden: p.hidden.includes(id) ? p.hidden.filter(h => h !== id) : [...p.hidden, id],
    }));
  };

  const isFavorite = (id: string) => prefs.favorites.includes(id);
  const isHidden = (id: string) => prefs.hidden.includes(id);

  return { prefs, toggleFavorite, toggleHidden, isFavorite, isHidden };
}
