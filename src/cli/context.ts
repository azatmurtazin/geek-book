// What the composition root hands a command.
//
// One plain object, no container: an adapter for each port the run may need,
// built around the resolved settings. A command declares the ports it uses
// through this shape rather than importing an adapter itself, and reads nothing
// about *which* book is being built except `settings`. `composeContext` builds
// it, so a test can drive a use case with the real adapters without going
// through the command line.

import { MermaidRenderer } from "../adapters/diagrams/mermaid-renderer.js";
import { NodeFileSystem } from "../adapters/fs/node-file-system.js";
import { RemoteImageStore } from "../adapters/http/remote-image-store.js";
import { MarkedParser } from "../adapters/markdown/marked-parser.js";
import { AssetTemplateStore } from "../adapters/templates/asset-template-store.js";
import { HtmlWebsiteRenderer } from "../adapters/web/html-website-renderer.js";
import type { DiagramRenderer } from "../application/ports/diagram-renderer.js";
import type { FileSystem } from "../application/ports/file-system.js";
import type { ImageStore } from "../application/ports/image-store.js";
import type { Logger } from "../application/ports/logger.js";
import type { MarkdownParser } from "../application/ports/markdown-parser.js";
import type { Reporter } from "../application/ports/reporter.js";
import type { TemplateStore } from "../application/ports/template-store.js";
import type { WebsiteRenderer } from "../application/ports/website-renderer.js";
import type { BookSettings } from "../application/settings.js";
import { RemoteImages } from "../lib/remote-images.js";

/** The adapters and settings a command may use, built once by the root. */
export interface AppContext {
  readonly settings: BookSettings;
  readonly fs: FileSystem;
  readonly templates: TemplateStore;
  readonly reporter: Reporter;
  readonly logger: Logger;
  /** The Markdown parser, configured for the book's `markdown` block. */
  readonly markdown: MarkdownParser;
  /** The diagram renderer, configured for the book's `diagrams` block. */
  readonly diagrams: DiagramRenderer;
  /** The website's HTML renderer. */
  readonly renderer: WebsiteRenderer;
  /**
   * Open the remote-image cache a build roots at `dir`. `print` rejects formats
   * the printed edition cannot embed; the website takes anything.
   */
  readonly openImages: (dir: string, print: boolean) => ImageStore;
}

/** Build the object graph a command runs against. */
export function composeContext(
  settings: BookSettings,
  reporter: Reporter,
  logger: Logger,
  fs: FileSystem = new NodeFileSystem(),
): AppContext {
  return {
    settings,
    fs,
    templates: new AssetTemplateStore(),
    reporter,
    logger,
    markdown: new MarkedParser(settings.markdown.breaks),
    diagrams: new MermaidRenderer(settings),
    renderer: new HtmlWebsiteRenderer(),
    openImages: (dir, print) =>
      new RemoteImageStore(
        new RemoteImages(dir, {
          print,
          timeout: settings.images.timeout,
          types: settings.images.types,
        }),
      ),
  };
}

/** One `geek-book` subcommand. */
export interface Command {
  /** One-liner for the help text. */
  readonly summary: string;
  /** Run it; the number is the process exit code. */
  run(ctx: AppContext, args: string[]): Promise<number> | number;
}
