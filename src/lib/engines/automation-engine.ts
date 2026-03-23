import { safeExecute } from "./core";
import { eventBus } from "./event-bus";

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
