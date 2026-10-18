// The remote-image adapter: the pipeline's `ImageStore` over `RemoteImages`.
//
// A printed book cannot hotlink, so both editions fetch every remote image once
// per build and read the local copy (see `lib/remote-images.ts`). This is the
// cache the pipeline fetches through.

import type { RemoteImages } from "../../lib/remote-images.js";
import type { ImageStore, StoredImage } from "../../application/ports/image-store.js";

export class RemoteImageStore implements ImageStore {
  constructor(private readonly remote: RemoteImages) {}

  collect(markdown: string): Promise<void> {
    return this.remote.collect(markdown);
  }

  lookup(url: string): StoredImage | null {
    const name = this.remote.nameFor(url);
    const file = this.remote.fileFor(url);
    return name === null || file === null ? null : { file, name };
  }

  get fetched(): number {
    return this.remote.fetched;
  }
}

/** An `ImageStore` for a chapter with no remote cache: fetches nothing, finds
 *  nothing. The pure walk and the fixture chapters use it. */
export class NoRemoteImages implements ImageStore {
  async collect(): Promise<void> {}

  lookup(): StoredImage | null {
    return null;
  }

  readonly fetched = 0;
}
