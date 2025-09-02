/*
  Lightweight debug logger with namespace support for Next.js (client & server).
  Enable logs via:
  - NEXT_PUBLIC_DEBUG env var (e.g., "*" or "home,not-found,sdk")
  - In browser: localStorage.setItem("DEBUG", "*") or "home,not-found"

  Usage:
    import { createLogger } from "../utils/debug";
    const log = createLogger("home");
    log.info("mounted");
*/

export type LogLevel = "debug" | "info" | "warn" | "error";

function getEnabledNamespaces(): string[] | "*" {
  // Prefer browser localStorage when available
  if (typeof window !== "undefined") {
    try {
      const v = window.localStorage.getItem("DEBUG");
      if (v)
        return v.trim() === "*"
          ? "*"
          : v
              .split(",")
              .map(s => s.trim())
              .filter(Boolean);
    } catch {}
  }

  // Fallback to env (must be exposed via NEXT_PUBLIC_*)
  const env = process.env.NEXT_PUBLIC_DEBUG;
  if (env)
    return env.trim() === "*"
      ? "*"
      : env
          .split(",")
          .map(s => s.trim())
          .filter(Boolean);

  return [];
}

function isEnabled(ns: string): boolean {
  const enabled = getEnabledNamespaces();
  if (enabled === "*") return true;
  return enabled.includes(ns);
}

function prefix(ns: string, level: LogLevel): [string, string] {
  const color = level === "error" ? "#ef4444" : level === "warn" ? "#f59e0b" : level === "info" ? "#3b82f6" : "#10b981";
  const label = `${ns}:${level.toUpperCase()}`;
  const style = `color:${color};font-weight:600`;
  return [label, style];
}

export function createLogger(ns: string) {
  const base =
    (level: LogLevel) =>
    (...args: unknown[]) => {
      if (!isEnabled(ns)) return;
      const [label, style] = prefix(ns, level);
      const time = new Date().toISOString();
      const msg = [`%c${label}`, style, time, ...args] as const;
      switch (level) {
        case "debug":
          console.debug(...msg);
          break;
        case "info":
          console.info(...msg);
          break;
        case "warn":
          console.warn(...msg);
          break;
        case "error":
          console.error(...msg);
          break;
      }
    };

  return {
    ns,
    debug: base("debug"),
    info: base("info"),
    warn: base("warn"),
    error: base("error"),
    enabled: () => isEnabled(ns),
  };
}

export const log = createLogger("app");
