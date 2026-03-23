import { EngineResult } from "./types";
import { safeExecute } from "./core";
import { ValidationEngine } from "./validation-engine";
import { eventBus } from "./event-bus";

// =============================================================================
// RECEIPT ENGINE
// =============================================================================

export class ReceiptEngine {
  async processReceipt(input: unknown): Promise<EngineResult<{ userId: string; brand: string; amount: number }>> {
    return safeExecute(async () => {
      const validation = ValidationEngine.validateReceipt(input);
      if (!validation.success || !validation.data) {
        throw new Error(validation.error ?? "Invalid receipt");
      }

      const { userId, brand, amount } = validation.data;

      await eventBus.emit({
        type: "RECEIPT_UPLOADED",
        userId,
        brand,
        amount,
      });

      return { userId, brand, amount };
    });
  }
}

export const receiptEngine = new ReceiptEngine();
