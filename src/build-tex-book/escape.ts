// Escaping text for LaTeX.
//
// Two flavours: `texEscape` for prose, where every character TeX treats
// specially gets a control sequence, and `texEscapeCode` for fancyvrb's
// `commandchars=\{\}` verbatim, which needs only the backslash and the braces.

/**
 * Escape prose for LaTeX text mode. Unicode walks through untouched — the
 * engine is Unicode-native — and everything TeX treats specially gets a
 * control sequence, including `|` so cells are safe inside tabulars.
 */
export function texEscape(text: string): string {
  let out = "";
  for (const ch of text) {
    switch (ch) {
      case "\\":
        out += "\\textbackslash{}";
        break;
      case "^":
        out += "\\textasciicircum{}";
        break;
      case "~":
        out += "\\textasciitilde{}";
        break;
      case "|":
        out += "\\textbar{}";
        break;
      case "{":
      case "}":
      case "#":
      case "$":
      case "%":
      case "&":
      case "_":
        out += "\\" + ch;
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/** Escape a code run for fancyvrb's `commandchars=\{\}` verbatim. */
export function texEscapeCode(code: string): string {
  let out = "";
  for (const ch of code) {
    if (ch === "\\") out += "\\textbackslash{}";
    else if (ch === "{") out += "\\{";
    else if (ch === "}") out += "\\}";
    else out += ch;
  }
  return out;
}
