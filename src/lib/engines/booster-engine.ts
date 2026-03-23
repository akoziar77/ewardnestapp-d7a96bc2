import { EngineResult } from "./types";
import { calculateBasePoints, applyBooster } from "./core";
import { eventBus } from "./event-bus";

// =============================================================================
// BOOSTER ENGINE
// =============================================================================

export class BoosterEngine {
  private boosters: Map<string, { brand: string; multiplier: number }> = new Map();

  registerBooster(booster: { id: string; brand: string; multiplier: number }) {
    this.boosters.set(booster.id, {
      brand: booster.brand,
      multiplier: booster.multiplier,
    });
  }

  applyBoosterIfEligible(brand: string, basePoints: number): EngineResult<number> {
    try {
      const booster = [...this.boosters.values()].find((b) => b.brand === brand);
      if (!booster) {
        return { success: true, data: basePoints };
      }
      const boosted = applyBooster(basePoints, booster.multiplier);
      return { success: true, data: boosted };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Booster error";
      return { success: false, error: message };
    }
  }
}

export const boosterEngine = new BoosterEngine();

eventBus.on("RECEIPT_UPLOADED", async (event) => {
  if (event.type !== "RECEIPT_UPLOADED") return;
  const basePoints = calculateBasePoints(event.amount);
  const boosted = boosterEngine.applyBoosterIfEligible(event.brand, basePoints);
  if (boosted.success) {
    console.log(`[BoosterEngine] User ${event.userId} earned ${boosted.data} points`);
  }
});
