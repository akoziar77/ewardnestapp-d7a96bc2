import { EngineResult } from "./types";
import { calculateBasePoints } from "./core";

// =============================================================================
// POINTS ENGINE
// =============================================================================

export class PointsEngine {
  calculatePoints(amount: number): EngineResult<number> {
    try {
      const points = calculateBasePoints(amount);
      return { success: true, data: points };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Points calculation error";
      return { success: false, error: message };
    }
  }

  calculateWithMultiplier(amount: number, multiplier: number): EngineResult<number> {
    try {
      const base = calculateBasePoints(amount);
      const total = Math.floor(base * multiplier);
      return { success: true, data: total };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Points calculation error";
      return { success: false, error: message };
    }
  }
}

export const pointsEngine = new PointsEngine();
