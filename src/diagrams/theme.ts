// The diagram palette and type size.
//
// Mermaid theme variables built from the book's printed colours, so a diagram
// follows `tex.colors` on the page and on paper alike.

import type { BookConfig, ColorsConfig } from "../lib/book-config.js";

/** Diagram type size, in px; also the label line height in `fixup.ts`. */
export const FONT_SIZE = 13;

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
