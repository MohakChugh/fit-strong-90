/**
 * Tokens for asynchronous work where only the newest request may land: read
 * file A, then choose file B before A has been read, and A's late result must
 * not replace B's.
 */
export function latestOnly() {
  let newest = 0;
  return {
    /** Start a request; its token is current until another starts. */
    next: () => ++newest,
    isCurrent: (token: number) => token === newest,
    /** Retire every request in flight. */
    cancel: () => void ++newest,
  };
}
