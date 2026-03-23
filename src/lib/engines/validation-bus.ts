import { z } from "zod";
import {
  zReceipt,
  zBooster,
  zAutomation,
  EngineEvent,
  EngineResult,
  safeExecute,
  logEngineEvent,
} from "./core";

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

// =============================================================================
// EVENT BUS
// =============================================================================

type EventHandler = (event: EngineEvent) => Promise<void>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(eventType: EngineEvent["type"], handler: EventHandler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async emit(event: EngineEvent) {
    logEngineEvent(event);
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.length === 0) return;

    for (const handler of handlers) {
      await safeExecute(async () => {
        await handler(event);
        return true;
      });
    }
  }
}

export const eventBus = new EventBus();
