import { EngineResult, safeExecute } from "./core";
import { eventBus } from "./validation-bus";

// =============================================================================
// INTEGRATION ENGINE
// =============================================================================

type WebhookHandler = (payload: unknown) => Promise<EngineResult<boolean>>;

export class IntegrationEngine {
  private providers: Map<string, WebhookHandler> = new Map();

  registerProvider(provider: string, handler: WebhookHandler) {
    this.providers.set(provider, handler);
  }

  async handleWebhook(
    provider: string,
    payload: unknown
  ): Promise<EngineResult<boolean>> {
    const handler = this.providers.get(provider);
    if (!handler) {
      return { success: false, error: `No handler for provider: ${provider}` };
    }

    const result = await handler(payload);

    if (result.success) {
      await eventBus.emit({
        type: "INTEGRATION_WEBHOOK",
        provider,
        payload,
      });
    }

    return result;
  }

  getRegisteredProviders(): string[] {
    return [...this.providers.keys()];
  }
}

export const integrationEngine = new IntegrationEngine();
