// The few POSIX path operations the domain does, without `node:path`.
//
// The domain resolves links and pictures against forward-slashed, book-relative
// paths. It cannot import `node:path` (the pure layer imports nothing outside
// `domain/`), so the handful of operations it needs live here, with `path.posix`
// semantics on the inputs the engine actually passes. A Windows path never
// reaches this module: book-relative paths are forward-slashed by construction,
// and the one absolute path joined here is the book directory an adapter read
// off the host, which the engine's platforms spell with `/`.
//
// Pure: part of `domain/`, imports nothing outside `domain/`.

/** The directory part of a path, `.` when there is none. */
export function dirname(value: string): string {
  if (value.length === 0) {
    return ".";
  }
  const rooted = value.charCodeAt(0) === 47;
  let end = -1;
  let seenSlash = true;
  for (let i = value.length - 1; i >= 1; i--) {
    if (value.charCodeAt(i) === 47) {
      if (!seenSlash) {
        end = i;
        break;
      }
    } else {
      seenSlash = false;
    }
  }
  if (end === -1) {
    return rooted ? "/" : ".";
  }
  if (rooted && end === 1) {
    return "//";
  }
  return value.slice(0, end);
}

/** The final piece of a path: `a/b/c.png` → `c.png`, `a/b/` → `b`. */
export function basename(value: string): string {
  const trimmed = value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
  const slash = trimmed.lastIndexOf("/");
  return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

/** The extension of a path's final piece, `""` when it has none (`.gitignore`). */
export function extname(value: string): string {
  const base = basename(value);
  const dot = base.lastIndexOf(".");
  if (dot <= 0) {
    return "";
  }
  return base.slice(dot);
}

/** Whether a path is rooted at `/`. */
export function isAbsolute(value: string): boolean {
  return value.charCodeAt(0) === 47;
}

/** Normalize a path: drop `.` and empty pieces, and fold `..` where it can. */
export function normalize(value: string): string {
  if (value.length === 0) {
    return ".";
  }
  const rooted = value.charCodeAt(0) === 47;
  const trailing = value.length > 1 && value.endsWith("/");
  const out: string[] = [];
  for (const piece of value.split("/")) {
    if (piece === "" || piece === ".") {
      continue;
    }
    if (piece === "..") {
      if (out.length > 0 && out[out.length - 1] !== "..") {
        out.pop();
      } else if (!rooted) {
        out.push("..");
      }
      continue;
    }
    out.push(piece);
  }
  let result = out.join("/");
  if (rooted) {
    result = "/" + result;
  }
  if (result === "") {
    result = rooted ? "/" : ".";
  } else if (trailing && result !== "/") {
    result += "/";
  }
  return result;
}

/** Join path pieces with `/` and normalize the result. */
export function join(...pieces: string[]): string {
  let joined = "";
  for (const piece of pieces) {
    if (piece === "") {
      continue;
    }
    joined = joined === "" ? piece : `${joined}/${piece}`;
  }
  return joined === "" ? "." : normalize(joined);
}

/**
 * Resolve `value` against `base`: an absolute `value` wins, otherwise it hangs
 * off `base`. Like `path.resolve`, the result has no trailing slash (except the
 * root), which is how the settings' absolute paths are spelled.
 */
export function resolve(base: string, value: string): string {
  const combined = isAbsolute(value) ? value : `${base}/${value}`;
  const normalized = normalize(combined);
  return normalized.length > 1 ? normalized.replace(/\/+$/, "") : normalized;
}

/**
 * The path from `from` to `to`, both absolute and forward-slashed. `""` when
 * they are the same, as `path.relative` answers; the caller adds the `.` the
 * printed config uses.
 */
export function relative(from: string, to: string): string {
  const fromParts = normalize(from).split("/").filter((piece) => piece !== "" && piece !== ".");
  const toParts = normalize(to).split("/").filter((piece) => piece !== "" && piece !== ".");
  let shared = 0;
  while (shared < fromParts.length && shared < toParts.length && fromParts[shared] === toParts[shared]) {
    shared += 1;
  }
  const up = fromParts.slice(shared).map(() => "..");
  return [...up, ...toParts.slice(shared)].join("/");
}
