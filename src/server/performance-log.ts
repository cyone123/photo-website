import { performance } from "node:perf_hooks";

export function startTimer() {
  return performance.now();
}

export function logDuration(event: string, values: Record<string, unknown>, startedAt: number) {
  console.log(
    JSON.stringify({
      level: "info",
      event,
      ...values,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      timestamp: new Date().toISOString(),
    }),
  );
}
