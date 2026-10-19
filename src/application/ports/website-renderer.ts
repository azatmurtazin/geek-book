// The port the website build renders pages through.
//
// The HTML — a chapter's body and the page around it — is a web technology, so
// it lives in an adapter (`adapters/web/html-website-renderer.ts`). The use case
// owns the orchestration (plan, clean, pipeline, copy the pictures, write the
// files) and asks the renderer for the two strings a page is made of. The
// requests carry the model and the site's page map, so the renderer can resolve
// each page's links and pictures without knowing the build's control flow.

import type { Chapter } from "../../domain/model/chapter.js";
import type { ImageStore } from "./image-store.js";
import type { BookSettings } from "../settings.js";

/** Where fetched remote images land inside a website build, under its root. */
export const REMOTE_IMAGE_DIR = "images/remote";

/** A sidebar item: a group heading, or a chapter entry that links to a page. */
export interface NavItem {
  readonly kind: "group" | "entry";
  readonly label: string;
  readonly relBook?: string;
  readonly indent?: number;
}

/** A previous/next link: what the reader clicks and where the page sits. */
export interface NavSlot {
  readonly label: string;
  readonly outputRel: string;
}

export interface ChapterBodyRequest {
  readonly settings: BookSettings;
  readonly chapter: Chapter;
  /** The chapter's source path relative to book/, for resolving its links. */
  readonly relBook: string;
  /** Where this chapter's page lands, relative to the output root. */
  readonly outputRel: string;
  /** Every written chapter's page, by book-relative path. */
  readonly pages: Map<string, string>;
  /** The build's remote-image cache, for pictures fetched this run. */
  readonly images: ImageStore;
  /**
   * Appended with each book picture the body referenced (a book-relative path),
   * so the caller copies them into the output.
   */
  readonly assets: string[];
}

export interface PageRequest {
  readonly settings: BookSettings;
  readonly title: string;
  readonly content: string;
  readonly items: readonly NavItem[];
  readonly pages: Map<string, string>;
  readonly activeOutputRel: string | null;
  readonly homeOutputRel: string;
  readonly prev: NavSlot | null;
  readonly next: NavSlot | null;
  /** The page's source path from the book root, for `{path}` in footer links. */
  readonly sourcePath: string | null;
  /** The favicon's output path, relative to the site root, or null. */
  readonly faviconOutput: string | null;
  /** Extra `<head>` HTML from the book's `web.head`, or "". */
  readonly head: string;
}

export interface WebsiteRenderer {
  /** Where a chapter's page lands, relative to the output root. */
  outputPath(settings: BookSettings, relBook: string): string;
  /** The site's stylesheet. */
  stylesheet(settings: BookSettings): string;
  /** A chapter's body, with its links and pictures resolved for its page. */
  chapterBody(request: ChapterBodyRequest): string;
  /** A whole page: the body wrapped in the site's layout. */
  page(request: PageRequest): string;
  /** The home page a book with no `readme` gets: a redirect to `firstOutputRel`. */
  redirectHome(settings: BookSettings, firstOutputRel: string): string;
}
