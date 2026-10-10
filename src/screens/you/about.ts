/**
 * Which build of the app this is, for the About row.
 *
 * Vite names the entry script after a hash of what was built, so that hash
 * changes with every release and identifies it exactly — more honestly than a
 * hand-kept version number nobody bumps. A development server has no hash.
 */
export function buildId(scriptSources: readonly string[]): string | undefined {
  for (const src of scriptSources) {
    const match = /\/assets\/index-([\w-]{6,})\.js(?:[?#]|$)/.exec(src);
    if (match) return match[1];
  }
  return undefined;
}
