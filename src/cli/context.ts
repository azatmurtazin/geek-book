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
import { NodeFileWatcher } from "../adapters/fs/node-file-watcher.js";
import { NodeHttpClient } from "../adapters/http/node-http-client.js";
import { NodeSiteServer } from "../adapters/http/node-site-server.js";
import { RemoteImages } from "../adapters/http/remote-images.js";
import { BookLintChecks } from "../adapters/lint/book-checks.js";
import { MarkedParser } from "../adapters/markdown/marked-parser.js";
import { NodeProcessRunner } from "../adapters/process/node-process-runner.js";
import { SystemPdfToolchain } from "../adapters/process/system-pdf-toolchain.js";
import { SystemLatexRenderer } from "../adapters/render-tex/tex-renderer.js";
import { AssetTemplateStore } from "../adapters/templates/asset-template-store.js";
import { HtmlWebsiteRenderer } from "../adapters/web/html-website-renderer.js";
import { LayoutStandaloneRenderer } from "../adapters/web/standalone-renderer.js";
import type { DiagramRenderer } from "../application/ports/diagram-renderer.js";
import type { FileSystem } from "../application/ports/file-system.js";
import type { FileWatcher } from "../application/ports/file-watcher.js";
import type { ImageStore } from "../application/ports/image-store.js";
import type { LatexRenderer } from "../application/ports/latex-renderer.js";
import type { LintChecks } from "../application/ports/lint-checks.js";
import type { Logger } from "../application/ports/logger.js";
import type { MarkdownParser } from "../application/ports/markdown-parser.js";
import type { PdfToolchain } from "../application/ports/pdf-toolchain.js";
import type { Reporter } from "../application/ports/reporter.js";
import type { SiteServer } from "../application/ports/site-server.js";
import type { StandaloneRenderer } from "../application/ports/standalone-renderer.js";
import type { TemplateStore } from "../application/ports/template-store.js";
import type { WebsiteRenderer } from "../application/ports/website-renderer.js";
import type { BookSettings } from "../application/settings.js";

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
  /** The single-file renderer the `md` command draws through. */
  readonly standalone: StandaloneRenderer;
  /** The printed edition's LaTeX renderer. */
  readonly latex: LatexRenderer;
  /** LaTeX, rsvg-convert and pdfinfo, on the host running the build. */
  readonly tools: PdfToolchain;
  /** The preview server the `serve` command starts. */
  readonly server: SiteServer;
  /** The source watcher behind `serve --watch`. */
  readonly watcher: FileWatcher;
  /** The source checks the `lint` command runs. */
  readonly checks: LintChecks;
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
  const templates = new AssetTemplateStore();
  return {
    settings,
    fs,
    templates,
    reporter,
    logger,
    markdown: new MarkedParser(settings.markdown.breaks),
    diagrams: new MermaidRenderer(settings),
    renderer: new HtmlWebsiteRenderer(),
    standalone: new LayoutStandaloneRenderer(settings, templates),
    latex: new SystemLatexRenderer(),
    tools: new SystemPdfToolchain(new NodeProcessRunner(), fs),
    server: new NodeSiteServer(),
    watcher: new NodeFileWatcher(),
    checks: new BookLintChecks(),
    openImages: (dir, print) =>
      new RemoteImages(dir, new NodeHttpClient(), fs, {
        print,
        timeout: settings.images.timeout,
        maxBytes: settings.images.maxBytes,
        types: settings.images.types,
      }),
  };
}

/** One `geek-book` subcommand. */
export interface Command {
  /** One-liner for the help text. */
  readonly summary: string;
  /** Run it; the number is the process exit code. */
  run(ctx: AppContext, args: string[]): Promise<number> | number;
}
