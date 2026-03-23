import { EngineEvent, EngineResult } from "./types";

// =============================================================================
// UTILITIES
// =============================================================================

export async function safeExecute<T>(
  fn: () => Promise<T>
): Promise<EngineResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function logEngineEvent(event: EngineEvent) {
  console.log(`[Engine Event]`, JSON.stringify(event, null, 2));
}

export function calculateBasePoints(amount: number): number {
  return Math.floor(amount);
}

export function applyBooster(points: number, multiplier: number): number {
  return Math.floor(points * multiplier);
}
