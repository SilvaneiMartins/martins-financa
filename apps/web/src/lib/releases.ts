import { useEffect, useState } from "react";
import { REPO, RELEASES_URL } from "./config";

export type OS = "windows" | "mac-arm" | "mac-intel" | "linux";

interface Asset {
  name: string;
  browser_download_url: string;
}

const pick: Record<OS, (a: Asset[]) => Asset | undefined> = {
  windows: (a) => a.find((x) => /setup\.exe$/i.test(x.name)) || a.find((x) => /\.msi$/i.test(x.name)),
  "mac-arm": (a) => a.find((x) => /aarch64.*\.dmg$/i.test(x.name)),
  "mac-intel": (a) => a.find((x) => /(x64|x86_64).*\.dmg$/i.test(x.name)),
  linux: (a) => a.find((x) => /\.AppImage$/i.test(x.name)) || a.find((x) => /\.deb$/i.test(x.name)),
};

export const OS_LABEL: Record<OS, string> = {
  windows: "Baixar para Windows",
  "mac-arm": "Baixar para macOS",
  "mac-intel": "Baixar para macOS (Intel)",
  linux: "Baixar para Linux",
};

export function detectOS(): OS | null {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "mac-arm"; // a maioria dos Macs atuais é Apple Silicon
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return "linux";
  return null;
}

export interface Release {
  tag: string | null;
  url: (os: OS) => string;
}

/** Busca a última release no GitHub; sem rede/release, os links apontam para a página de releases. */
export function useLatestRelease(): Release {
  const [state, setState] = useState<{ tag: string; assets: Asset[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`https://api.github.com/repos/${REPO}/releases/latest`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rel) => alive && setState({ tag: rel.tag_name, assets: rel.assets ?? [] }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return {
    tag: state?.tag ?? null,
    url: (os) => (state && pick[os](state.assets)?.browser_download_url) || RELEASES_URL,
  };
}
