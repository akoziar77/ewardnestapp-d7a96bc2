import { z } from "zod";

// =============================================================================
// SHARED TYPES
// =============================================================================

export type EngineResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type EngineEvent =
  | { type: "RECEIPT_UPLOADED"; userId: string; brand: string; amount: number }
  | { type: "BOOSTER_TRIGGERED"; userId: string; boosterId: string }
  | { type: "AUTOMATION_FIRED"; automationId: string; userId: string }
  | { type: "OCR_PARSED"; userId: string; text: string }
  | { type: "INTEGRATION_WEBHOOK"; provider: string; payload: unknown };

// =============================================================================
// ZOD SCHEMAS
// =============================================================================

export const zReceipt = z.object({
  userId: z.string(),
  brand: z.string(),
  amount: z.number().nonnegative(),
  uploadedAt: z.string(),
});

export const zBooster = z.object({
  id: z.string(),
  brand: z.string(),
  multiplier: z.number().positive(),
  active: z.boolean(),
});

export const zAutomation = z.object({
  id: z.string(),
  trigger: z.string(),
  action: z.string(),
  active: z.boolean(),
});

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
