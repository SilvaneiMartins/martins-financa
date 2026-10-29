// Preferências de interface (por computador). Ficam no localStorage e são
// sincronizadas entre a janela principal e a janela de configurações.
import { emit, listen } from "@tauri-apps/api/event";
import { isTauri } from "./db";

export type Theme = "light" | "dark" | "system";

export interface Prefs {
  theme: Theme;
  fontScale: number; // 90 | 100 | 112 | 125 | 140
  privacy: boolean; // borra valores na tela
  notifyOS: boolean; // notificação do sistema para vencimentos
  alertDays: number; // antecedência dos alertas
  compact: boolean;
}

const DEFAULTS: Prefs = { theme: "light", fontScale: 100, privacy: false, notifyOS: true, alertDays: 7, compact: false };
const KEY = "mf:prefs";

export function loadPrefs(): Prefs {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

export function applyPrefs(p: Prefs) {
  const root = document.documentElement;
  const dark = p.theme === "dark" || (p.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.classList.toggle("privacy", p.privacy);
  root.style.setProperty("--font-scale", `${p.fontScale}%`);
}

export async function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sem storage: segue só na memória */
  }
  applyPrefs(p);
  if (isTauri()) await emit("mf:prefs", p);
}

export function onPrefsChanged(cb: (p: Prefs) => void): () => void {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb(loadPrefs());
  window.addEventListener("storage", onStorage);
  let unlisten: (() => void) | undefined;
  if (isTauri()) listen<Prefs>("mf:prefs", (e) => cb(e.payload)).then((u) => (unlisten = u));
  return () => {
    window.removeEventListener("storage", onStorage);
    unlisten?.();
  };
}
