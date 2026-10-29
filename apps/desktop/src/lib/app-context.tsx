import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { isTauri } from "./db";
import { currentMonth } from "./format";
import { applyPrefs, loadPrefs, onPrefsChanged, savePrefs, type Prefs } from "./prefs";

export interface LanStatus {
  mode: "local" | "server" | "client";
  ip: string;
  port: number | null;
  token: string | null;
  remote_host: string | null;
  db_path: string;
  version: string;
}

interface Toast { id: number; text: string; tone: "ok" | "erro" }

interface Ctx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  month: string;
  setMonth: (m: string) => void;
  version: number; // muda sempre que dados mudam -> telas recarregam
  bump: () => void;
  lan: LanStatus | null;
  refreshLan: () => Promise<void>;
  toast: (text: string, tone?: "ok" | "erro") => void;
  toasts: Toast[];
  lastSync: Date;
  settings: { open: boolean; section: string };
  openSettings: (section?: string) => void;
  closeSettings: () => void;
  help: boolean;
  openHelp: () => void;
  closeHelp: () => void;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const [month, setMonth] = useState(currentMonth());
  const [version, setVersion] = useState(0);
  const [lan, setLan] = useState<LanStatus | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSync, setLastSync] = useState(new Date());
  const [settings, setSettings] = useState({ open: false, section: "aparencia" });
  const [help, setHelp] = useState(false);
  const openHelp = useCallback(() => setHelp(true), []);
  const closeHelp = useCallback(() => setHelp(false), []);
  const openSettings = useCallback((section?: string) => setSettings((s) => ({ open: true, section: section ?? (s.open ? s.section : "aparencia") })), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);

  useEffect(() => applyPrefs(prefs), [prefs]);
  useEffect(() => onPrefsChanged(setPrefsState), []);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => applyPrefs(loadPrefs());
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  const bump = useCallback(() => {
    setVersion((v) => v + 1);
    setLastSync(new Date());
  }, []);

  useEffect(() => {
    const fn = () => bump();
    window.addEventListener("mf:data-changed", fn);
    let un: (() => void) | undefined;
    if (isTauri()) listen("mf:data-changed", fn).then((u) => (un = u));
    return () => {
      window.removeEventListener("mf:data-changed", fn);
      un?.();
    };
  }, [bump]);

  const refreshLan = useCallback(async () => {
    if (!isTauri()) return;
    setLan(await invoke<LanStatus>("lan_status"));
  }, []);

  useEffect(() => {
    refreshLan();
    if (!isTauri()) return;
    let un: (() => void) | undefined;
    listen("mf:lan-changed", () => {
      refreshLan();
      bump();
    }).then((u) => (un = u));
    return () => un?.();
  }, [refreshLan, bump]);

  // Em modo cliente, recarrega periodicamente para ver o que outros computadores lançaram.
  useEffect(() => {
    if (lan?.mode !== "client" && lan?.mode !== "server") return;
    const t = setInterval(bump, 30_000);
    return () => clearInterval(t);
  }, [lan?.mode, bump]);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p };
      savePrefs(next);
      return next;
    });
  }, []);

  const toast = useCallback((text: string, tone: "ok" | "erro" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <AppCtx.Provider value={{ prefs, setPrefs, month, setMonth, version, bump, lan, refreshLan, toast, toasts, lastSync, settings, openSettings, closeSettings, help, openHelp, closeHelp }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}

/** Carrega dados e recarrega quando qualquer coisa muda no banco. */
export function useData<T>(loader: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; error: string | null; reload: () => void } {
  const { version, toast } = useApp();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loader()
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => {
        if (!alive) return;
        const msg = String(e);
        setError(msg);
        toast(msg, "erro");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, tick, ...deps]);

  return { data, loading, error, reload: () => setTick((t) => t + 1) };
}
