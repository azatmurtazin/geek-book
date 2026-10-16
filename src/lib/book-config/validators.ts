// The `as*` readers: one lenient reader per config value, each falling back to
// `defaults.ts` rather than throwing, so a malformed config degrades to the
// conventional book instead of failing the build. The composite readers at the
// bottom (`readColors`, `readLint`, …) assemble a whole section from its raw
// JSON.

import type {
  CodeLangConfig,
  ColorsConfig,
  CommentStyle,
  LintConfig,
  PaperName,
  TypeConfig,
  WebLinkConfig,
} from "./types.js";
import { PAPERS } from "./types.js";
import { DEFAULTS } from "./defaults.js";

export function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : fallback;
}

/** Like `asString`, but an explicit empty string counts as a value: it turns
 * the setting off (no webfonts, no bold face of its own). */
export function asOptionalString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

export function asStringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
  return list.length ? list : null;
}

/** A `{ token: value }` map of strings, else empty. Values are kept verbatim,
 * so a token may stand for an empty string; non-string values are dropped. */
export function asStringMap(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === "string" && key.trim() !== "") out[key.trim()] = item;
  }
  return out;
}

/** A site base URL: an absolute `http(s)` URL or a root-relative path, with a
 * trailing slash, else "". */
export function asBaseUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim();
  if (!raw) return "";
  if (raw.startsWith("/")) return raw.endsWith("/") ? raw : `${raw}/`;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/`;
  } catch {
    return "";
  }
}

/** The footer links: `{ label, href }` pairs, entries missing either dropped. */
export function asWebLinks(value: unknown): WebLinkConfig[] {
  if (!Array.isArray(value)) return [];
  const links: WebLinkConfig[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) continue;
    const { label, href } = item as Record<string, unknown>;
    if (typeof label === "string" && label.trim() && typeof href === "string" && href.trim()) {
      links.push({ label: label.trim(), href: href.trim() });
    }
  }
  return links;
}

/** A length in millimetres: a non-negative finite number, else the default. */
export function asMillimetres(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** A point size: a positive finite number, else the default. */
export function asPoints(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** A line budget in columns: a positive finite number, else the default. */
export function asWidth(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** The document class size: LaTeX takes 10, 11 or 12. */
function asBaseSize(value: unknown, fallback: number): number {
  return value === 10 || value === 11 || value === 12 ? value : fallback;
}

/** A boolean, else the default. */
export function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** A duration in seconds: a positive finite number, else the default. */
export function asSeconds(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** A TCP port: a whole number in range, else the default. */
export function asPort(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535
    ? value
    : fallback;
}

/** Accepted remote-image content types, each mapped to a file extension. */
export function asContentTypes(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof value !== "object" || value === null) return out;
  for (const [type, ext] of Object.entries(value as Record<string, unknown>)) {
    const key = type.trim().toLowerCase();
    if (key && typeof ext === "string" && ext.trim()) out[key] = ext.trim();
  }
  return out;
}

/** Round to hundredths, so derived lengths read cleanly in the config dump. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A `#rrggbb` colour, normalized to lower case, else the default. */
function asColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const hex = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex.toLowerCase() : fallback;
}

export function asPaper(value: unknown, fallback: PaperName): PaperName {
  return typeof value === "string" && value in PAPERS ? (value as PaperName) : fallback;
}

export function readColors(raw: Record<string, unknown>): ColorsConfig {
  return {
    fg: asColor(raw.fg, DEFAULTS.tex.colors.fg),
    muted: asColor(raw.muted, DEFAULTS.tex.colors.muted),
    rule: asColor(raw.rule, DEFAULTS.tex.colors.rule),
    codeBackground: asColor(raw.codeBackground, DEFAULTS.tex.colors.codeBackground),
    codeForeground: asColor(raw.codeForeground, DEFAULTS.tex.colors.codeForeground),
    codeComment: asColor(raw.codeComment, DEFAULTS.tex.colors.codeComment),
    calloutBackground: asColor(raw.calloutBackground, DEFAULTS.tex.colors.calloutBackground),
    calloutBorder: asColor(raw.calloutBorder, DEFAULTS.tex.colors.calloutBorder),
    calloutForeground: asColor(raw.calloutForeground, DEFAULTS.tex.colors.calloutForeground),
  };
}

export function readType(raw: Record<string, unknown>): TypeConfig {
  return {
    base: asBaseSize(raw.base, DEFAULTS.tex.type.base),
    chapter: asPoints(raw.chapter, DEFAULTS.tex.type.chapter),
    section: asPoints(raw.section, DEFAULTS.tex.type.section),
    subsection: asPoints(raw.subsection, DEFAULTS.tex.type.subsection),
    subsubsection: asPoints(raw.subsubsection, DEFAULTS.tex.type.subsubsection),
    paragraph: asPoints(raw.paragraph, DEFAULTS.tex.type.paragraph),
  };
}

export function readLint(raw: Record<string, unknown>): LintConfig {
  return {
    proseWidth: asWidth(raw.proseWidth, DEFAULTS.lint.proseWidth),
    tableWidth: asWidth(raw.tableWidth, DEFAULTS.lint.tableWidth),
    diagramWidth: asWidth(raw.diagramWidth, DEFAULTS.lint.diagramWidth),
  };
}

/** The book's `code` map: lower-case tags, each with a label and comment style. */
export function readCode(raw: Record<string, unknown>): Record<string, CodeLangConfig> {
  const out: Record<string, CodeLangConfig> = {};
  for (const [tag, value] of Object.entries(raw)) {
    const lang = tag.trim().toLowerCase();
    if (!lang || typeof value !== "object" || value === null) continue;
    const entry = value as Record<string, unknown>;
    out[lang] = { label: asString(entry.label, ""), comment: asCommentStyle(entry.comment) };
  }
  return out;
}

/** `slash` or `hash`, else "" (keep the built-in choice). */
function asCommentStyle(value: unknown): CommentStyle | "" {
  return value === "slash" || value === "hash" ? value : "";
}
