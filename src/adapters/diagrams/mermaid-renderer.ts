// The mermaid adapter: the pipeline's `DiagramRenderer` over the drawing modules beside it.
//
// Taking the fences out of a chapter is pure string work and lives in the
// domain (`domain/services/extract-diagrams.ts`); this adapter only draws one,
// and reads the drawing's size out of the SVG's viewBox — all jsdom can say
// about a diagram it cannot lay out. A drawing with no viewBox keeps a `null`
// size, and the serializer places it as it sees fit.

import { renderMermaid } from "./render.js";
import type { BookSettings } from "../../application/settings.js";
import type { DiagramRenderer } from "../../application/ports/diagram-renderer.js";
import type { Figure } from "../../domain/model/assets.js";

export class MermaidRenderer implements DiagramRenderer {
  constructor(private readonly cfg: BookSettings) {}

  async render(source: string, id: string, name: string): Promise<Figure> {
    const svg = await renderMermaid(this.cfg, source, id);
    const viewBox = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
    return {
      name,
      svg,
      size: viewBox ? { width: Number(viewBox[3]), height: Number(viewBox[4]) } : null,
    };
  }
}
