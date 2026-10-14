// Minimal typing for the jsdom shim. The repo targets Node (lib: es2022 only),
// so we declare just the surface this project uses instead of pulling the DOM
// typings into the whole build.
declare module "jsdom" {
  export class JSDOM {
    constructor(html: string, options?: Record<string, unknown>);
    readonly window: unknown;
  }
}
