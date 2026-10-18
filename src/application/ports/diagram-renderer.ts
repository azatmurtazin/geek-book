// The port the pipeline draws mermaid fences through.
//
// A renderer turns one fence's source into a `Figure`: the inline <svg> the
// website embeds and the drawing the printed edition writes as a PDF figure.
// Which renderer runs, and that it needs a DOM to run in, is an adapter's
// business (see `adapters/diagrams/mermaid-renderer.ts`).

import type { Figure } from "../../domain/model/assets.js";

export interface DiagramRenderer {
  /**
   * Draw one fence.
   *
   * `id` names the render inside the SVG (the two editions use different ids);
   * `name` is the figure's output base name, e.g. `c3-d0.pdf`. The website
   * embeds the SVG and ignores the name.
   */
  render(source: string, id: string, name: string): Promise<Figure>;
}
