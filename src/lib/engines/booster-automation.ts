import {
  EngineResult,
  safeExecute,
  calculateBasePoints,
  applyBooster,
} from "./core";
import { eventBus } from "./validation-bus";

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

// =============================================================================
// AUTOMATION ENGINE
// =============================================================================

export class AutomationEngine {
  private automations: Map<string, { trigger: string; action: string; active: boolean }> = new Map();

  registerAutomation(automation: { id: string; trigger: string; action: string; active: boolean }) {
    this.automations.set(automation.id, {
      trigger: automation.trigger,
      action: automation.action,
      active: automation.active,
    });
  }

  async runAutomation(action: string, userId: string) {
    return safeExecute(async () => {
      console.log(`[AutomationEngine] Running action "${action}" for ${userId}`);
      await new Promise((r) => setTimeout(r, 200));
      return true;
    });
  }

  getAutomationByTrigger(trigger: string) {
    return [...this.automations.values()].find((a) => a.trigger === trigger && a.active);
  }
}

export const automationEngine = new AutomationEngine();

eventBus.on("AUTOMATION_FIRED", async (event) => {
  if (event.type !== "AUTOMATION_FIRED") return;
  const automation = automationEngine.getAutomationByTrigger(event.automationId);
  if (!automation) return;
  await automationEngine.runAutomation(automation.action, event.userId);
});
