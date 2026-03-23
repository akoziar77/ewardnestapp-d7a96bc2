import { EngineEvent, EngineResult } from "./types";
import { safeExecute, logEngineEvent } from "./core";

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
