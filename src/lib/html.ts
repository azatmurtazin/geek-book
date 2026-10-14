// Escape the characters HTML treats specially, in text and attribute values.
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A book title with its first word emphasized, escaped: `**Programming** Essentials`. */
export function brandHtml(title: string): string {
  const [lead, ...rest] = title.trim().split(/\s+/);
  const tail = rest.length ? ` ${escapeHtml(rest.join(" "))}` : "";
  return `<em>${escapeHtml(lead ?? "")}</em>${tail}`;
}
