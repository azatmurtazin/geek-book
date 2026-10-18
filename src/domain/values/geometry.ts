// The papers a book may set and the text block a page leaves inside them.
//
// All in millimetres. The PDF builder measures pictures against the text block,
// so a book that changes its margins does not have to say anything else. Pure:
// no imports outside `domain/`.

/** The papers a book may set, with their dimensions in millimetres. */
export const PAPERS = {
  a4: { option: "a4paper", widthMm: 210, heightMm: 297 },
  a5: { option: "a5paper", widthMm: 148, heightMm: 210 },
  letter: { option: "letterpaper", widthMm: 215.9, heightMm: 279.4 },
  legal: { option: "legalpaper", widthMm: 215.9, heightMm: 355.6 },
} as const;

export type PaperName = keyof typeof PAPERS;

/** The page margins, in millimetres. */
export interface Margins {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
}

/** The text block a page leaves, in millimetres. */
export interface Geometry {
  /** Paper width less the side margins. */
  readonly textWidthMm: number;
  /** Paper height less the top and bottom margins. */
  readonly textHeightMm: number;
}

/** Round to hundredths, so derived lengths read cleanly in the config dump. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The text block `paper` leaves inside `margins`.
 *
 * A margin wider than the paper clamps to a hairline rather than a non-positive
 * block, which would break the picture scaling.
 */
export function textBlock(paper: PaperName, margins: Margins): Geometry {
  const size = PAPERS[paper];
  return {
    textWidthMm: round2(Math.max(1, size.widthMm - margins.left - margins.right)),
    textHeightMm: round2(Math.max(1, size.heightMm - margins.top - margins.bottom)),
  };
}
