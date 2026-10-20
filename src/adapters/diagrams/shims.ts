// A minimal browser for mermaid.
//
// jsdom, the globals mermaid's dependencies (dompurify, d3) reach for, and the
// SVG measurement APIs jsdom does not implement — it performs no layout, so
// every box is sized from its label text instead.

import { JSDOM } from "jsdom";

function setGlobal(key: string, value: unknown): void {
  (globalThis as unknown as Record<string, unknown>)[key] = value;
}

type Measurable = {
  querySelectorAll?: (selector: string) => unknown[];
  prototype: {
    getBBox?: () => unknown;
    getComputedTextLength?: () => unknown;
  };
};

function labelChars(el: unknown): number {
  let best = "";
  const meas = el as Measurable;
  const foreigns = meas.querySelectorAll?.("foreignObject") ?? [];
  for (const foreign of foreigns as { textContent?: string }[]) {
    const s = (foreign.textContent ?? "").replace(/\s+/g, " ").trim();
    if (s.length > best.length) best = s;
  }
  return best.length;
}

/** jsdom has no layout engine; size boxes from their label text. */
function shimMeasurement(windowObject: unknown): void {
  const proto = (windowObject as { SVGElement?: Measurable }).SVGElement?.prototype;
  if (!proto) return;
  proto.getBBox = function (this: unknown) {
    const chars = labelChars(this);
    const width = chars ? chars * 6.2 + 16 : 22;
    return { x: 0, y: 0, width, height: 24 };
  } as never;
  proto.getComputedTextLength = function (this: unknown) {
    return Math.max(10, labelChars(this) * 6.2);
  } as never;
  // mermaid sizes HTML labels through getBoundingClientRect, which jsdom
  // always reports as 0×0 — that makes flowchart edge labels come back as
  // translate(undefined, NaN). Return a text-sized box instead.
  const elementProto = (windowObject as { Element?: Measurable }).Element?.prototype as
    | { getBoundingClientRect?: unknown }
    | undefined;
  if (elementProto === undefined) return;
  elementProto.getBoundingClientRect = function (this: unknown) {
    const txt = ((this as { textContent?: string }).textContent ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const width = txt.length > 0 ? Math.max(10, txt.length * 6.2 + 6) : 0;
    const height = txt.length > 0 ? 20 : 0;
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    };
  } as never;
}

/**
 * Install the DOM mermaid's dependencies expect.
 *
 * The DOM must exist before mermaid is imported, so the caller imports it
 * dynamically, after this has run. Call once.
 */
export function installBrowserShims(): void {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true,
  });
  const win = dom.window as Record<string, unknown>;
  setGlobal("window", win);
  setGlobal("document", win.document);
  Object.defineProperty(globalThis, "navigator", {
    value: win.navigator,
    configurable: true,
  });
  setGlobal("XMLSerializer", win.XMLSerializer);
  if (win.CSSStyleSheet !== undefined) setGlobal("CSSStyleSheet", win.CSSStyleSheet);
  shimMeasurement(win);
}
