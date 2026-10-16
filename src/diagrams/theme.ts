// The diagram palette, type size and theme.
//
// Mermaid theme variables built from the book's printed colours, so a diagram
// follows `tex.colors` on the page and on paper alike. A book that wants
// another look names a Mermaid theme under `diagrams.theme` instead.

import { diagramFamily } from "../lib/fonts.js";
import type { BookConfig, ColorsConfig } from "../lib/book-config.js";
import type { MermaidConfig } from "mermaid";

// Build mermaid theme variables from the book's printed palette so diagrams follow `tex.colors`.
export function themeVariables(cfg: BookConfig) {
  const colors: ColorsConfig = cfg.tex.colors;

  return {
    background: "#ffffff",
    primaryColor: colors.codeBackground,
    primaryBorderColor: colors.muted,
    primaryTextColor: colors.codeForeground,
    secondaryColor: colors.codeBackground,
    secondaryBorderColor: colors.muted,
    secondaryTextColor: colors.codeForeground,
    tertiaryColor: colors.codeBackground,
    tertiaryBorderColor: colors.muted,
    tertiaryTextColor: colors.codeForeground,
    lineColor: colors.muted,
    edgeLabelBackground: "#ffffff",
    mainBkg: colors.codeBackground,
    nodeBorder: colors.muted,
    nodeTextColor: colors.codeForeground,
    textColor: colors.codeForeground,
    titleColor: colors.codeForeground,
    noteBkgColor: colors.calloutBackground,
    noteBorderColor: colors.calloutBorder,
    noteTextColor: colors.calloutForeground,
    clusterBkg: "#ffffff",
    clusterBorder: colors.rule,
    actorBkg: colors.codeBackground,
    actorBorder: colors.muted,
    actorTextColor: colors.codeForeground,
    actorLineColor: colors.muted,
    labelBoxBkgColor: colors.codeBackground,
    labelBoxBorderColor: colors.muted,
    labelTextColor: colors.codeForeground,
    signalColor: colors.muted,
    signalTextColor: colors.codeForeground,
    activationBkgColor: colors.codeBackground,
    activationBorderColor: colors.muted,
    sequenceNumberColor: colors.codeForeground,
    loopTextColor: colors.codeForeground,
    stateBkg: colors.codeBackground,
    stateBorder: colors.muted,
    stateLabelColor: colors.codeForeground,
    stateEndColor: colors.muted,
    innerEndBackground: colors.muted,
    specialStateColor: colors.muted,
    labelBackgroundColor: colors.codeBackground,
    compositeBackground: "#ffffff",
    compositeTitleBackground: colors.codeBackground,
  };
}

/**
 * The options Mermaid is initialised with for a book: its theme, its type size
 * and — under the default `auto` theme — the palette derived from `tex.colors`.
 * Kept apart from the loader in `render.ts` so it needs no DOM and can be read
 * on its own.
 */
export function diagramOptions(cfg: BookConfig): MermaidConfig {
  const theme = cfg.diagrams.theme;
  const derived = theme === "auto";
  const fontFamily = diagramFamily(cfg);

  return {
    startOnLoad: false,
    // `auto` keeps Mermaid's own default look and tints it with the book's
    // palette below; a named theme is used as it is, palette and all.
    theme: derived ? "default" : theme,
    securityLevel: "loose",
    fontFamily,
    themeVariables: {
      fontSize: `${cfg.diagrams.fontSize}px`,
      fontFamily,
      ...(derived ? themeVariables(cfg) : {}),
    },
    flowchart: { htmlLabels: true },
  };
}
