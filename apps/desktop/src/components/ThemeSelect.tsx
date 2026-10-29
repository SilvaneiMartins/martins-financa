import { Monitor, Moon, Sun } from "lucide-react";

import { Combobox } from "./Combobox";
import { useApp } from "../lib/app-context";

const THEME_OPTIONS = [
  { 
    value: "system" as const, 
    label: "Sistema", 
    description: "Acompanha o tema do Windows, macOS ou Linux", 
    icon: <Monitor /> 
  },
  {
     value: "light" as const, 
     label: "Claro", 
     description: "Fundo claro — padrão da aplicação", 
     icon: <Sun /> 
    },
  { 
    value: "dark" as const, 
    label: "Escuro", 
    description: "Fundo escuro, mais confortável à noite", 
    icon: <Moon /> 
  },
];

/** Seletor de tema (Sistema, Claro, Escuro). */
export function ThemeSelect({ size, className }: { size?: "sm" | "md"; className?: string }) {
  const { prefs, setPrefs } = useApp();
  return (
    <Combobox
      value={prefs.theme}
      onChange={(v) => v && setPrefs({ theme: v })}
      searchable={false}
      size={size}
      className={className}
      options={THEME_OPTIONS}
      aria-label="Tema da aplicação"
    />
  );
}
