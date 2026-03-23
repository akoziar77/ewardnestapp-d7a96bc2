// =============================================================================
// SHARED TYPES
// =============================================================================

export type EngineResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type EngineEvent =
  | { type: "RECEIPT_UPLOADED"; userId: string; brand: string; amount: number }
  | { type: "BOOSTER_TRIGGERED"; userId: string; boosterId: string }
  | { type: "AUTOMATION_FIRED"; automationId: string; userId: string }
  | { type: "OCR_PARSED"; userId: string; text: string }
  | { type: "INTEGRATION_WEBHOOK"; provider: string; payload: unknown };
