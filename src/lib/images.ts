// Where an image `src` points, as both editions read it.
//
// Resolution now lives in `domain/services/resolve-images.ts`; this is the
// legacy path the web builder still names. `resolveImagePath` is the old name
// kept for that caller until Phase 5.

export { isRemoteImage, resolveImage, resolveImage as resolveImagePath } from "../domain/services/resolve-images.js";
