import { useCallback, useEffect, useState } from "react";

export type Theme = "system" | "light" | "dark";

const KEY = "mf:web-theme";
const DEFAULT: Theme = "light";

export function loadTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "system" || v === "light" || v === "dark" ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Tema escolhido pelo visitante (Claro por padrão), guardado no navegador. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(loadTheme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyTheme("system");
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* sem storage: vale só nesta visita */
    }
    setThemeState(t);
  }, []);

  return { theme, setTheme };
}
