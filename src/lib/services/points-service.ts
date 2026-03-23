import { pointsEngine } from "@/lib/engines";
import { boosterEngine } from "@/lib/engines";
import type { EngineResult } from "@/lib/engines";

// =============================================================================
// POINTS SERVICE — orchestrates points calculation with boosters
// =============================================================================

export class PointsService {
  calculateEarnings(brand: string, amount: number): EngineResult<number> {
    const base = pointsEngine.calculatePoints(amount);
    if (!base.success || base.data === undefined) return base;

    return boosterEngine.applyBoosterIfEligible(brand, base.data);
  }

  calculateWithMultiplier(amount: number, multiplier: number): EngineResult<number> {
    return pointsEngine.calculateWithMultiplier(amount, multiplier);
  }
}

export const pointsService = new PointsService();
