import { receiptEngine } from "@/lib/engines";
import { pointsService } from "./points-service";
import type { EngineResult } from "@/lib/engines";

// =============================================================================
// RECEIPT SERVICE — end-to-end receipt processing with points award
// =============================================================================

export interface ReceiptResult {
  userId: string;
  brand: string;
  amount: number;
  pointsEarned: number;
}

export class ReceiptService {
  async processAndAward(input: unknown): Promise<EngineResult<ReceiptResult>> {
    const receipt = await receiptEngine.processReceipt(input);
    if (!receipt.success || !receipt.data) {
      return { success: false, error: receipt.error ?? "Receipt processing failed" };
    }

    const { userId, brand, amount } = receipt.data;
    const points = pointsService.calculateEarnings(brand, amount);
    if (!points.success || points.data === undefined) {
      return { success: false, error: points.error ?? "Points calculation failed" };
    }

    return {
      success: true,
      data: { userId, brand, amount, pointsEarned: points.data },
    };
  }
}

export const receiptService = new ReceiptService();
