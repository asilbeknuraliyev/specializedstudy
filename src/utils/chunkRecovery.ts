// A tab left open over a deployment may reference a removed hashed page asset.
// Retry only this failure, once per minute, and retain the normal error screen
// if storage is unavailable or the retry also fails.
export function claimChunkRecovery(error: unknown, storage: Pick<Storage, 'getItem' | 'setItem'>, now = Date.now()): boolean {
  const message = error instanceof Error ? error.message : '';
  if (!/Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .* failed/i.test(message)) return false;
  try {
    const previous = Number(storage.getItem('ss-chunk-recovery-at'));
    if (previous && now - previous < 60_000) return false;
    storage.setItem('ss-chunk-recovery-at', String(now));
    return true;
  } catch { return false; }
}
