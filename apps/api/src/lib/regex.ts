/**
 * Escapes a user-supplied string for safe use inside a RegExp.
 *
 * Search terms end up in `$regex`, where an unescaped `(`, `[` or `\` is at
 * best a 500 from an invalid pattern and at worst a catastrophic-backtracking
 * denial of service. Escaping makes the term a literal, which is what a search
 * box means anyway.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
