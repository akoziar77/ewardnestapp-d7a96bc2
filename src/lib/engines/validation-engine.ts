import { z } from "zod";
import { EngineResult } from "./types";

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
// VALIDATION ENGINE
// =============================================================================

export const ValidationEngine = {
  validateReceipt(input: unknown): EngineResult<z.infer<typeof zReceipt>> {
    try {
      const parsed = zReceipt.parse(input);
      return { success: true, data: parsed };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid receipt";
      return { success: false, error: message };
    }
  },

  validateBooster(input: unknown): EngineResult<z.infer<typeof zBooster>> {
    try {
      const parsed = zBooster.parse(input);
      return { success: true, data: parsed };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid booster";
      return { success: false, error: message };
    }
  },

  validateAutomation(input: unknown): EngineResult<z.infer<typeof zAutomation>> {
    try {
      const parsed = zAutomation.parse(input);
      return { success: true, data: parsed };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid automation";
      return { success: false, error: message };
    }
  },
};
