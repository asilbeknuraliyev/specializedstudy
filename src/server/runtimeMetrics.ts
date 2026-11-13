export function createRuntimeMetrics(clock = () => Date.now()) {
  const startedAt = new Date(clock()).toISOString();
  let reads = 0,
    writes = 0,
    conflicts = 0;
  const errors: Array<{ kind: string; at: string }> = [];
  return {
    read: (count = 1) => {
      if (Number.isInteger(count) && count > 0) reads += count;
    },
    write: (count = 1) => {
      if (Number.isInteger(count) && count > 0) writes += count;
    },
    failure: (value: unknown) => {
      const kind =
        typeof value === "string" &&
        ["conflict", "read_failed", "write_failed"].includes(value)
          ? value
          : "internal";
      if (kind === "conflict") conflicts++;
      errors.push({ kind, at: new Date(clock()).toISOString() });
      if (errors.length > 20) errors.shift();
    },
    snapshot: () => ({
      startedAt,
      snapshotReadAttempts: reads,
      snapshotWriteAttempts: writes,
      conflicts,
      errors: errors.map((v) => ({ ...v })),
    }),
  };
}
export const runtimeMetrics = createRuntimeMetrics();
