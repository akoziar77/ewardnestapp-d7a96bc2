import { describe, it, expect } from "vitest";
import {
  ValidationEngine,
  eventBus,
  boosterEngine,
  automationEngine,
  ocrEngine,
  integrationEngine,
  pointsEngine,
  receiptEngine,
} from "@/lib/engines";

// =============================================================================
// VALIDATION ENGINE TESTS
// =============================================================================

describe("Validation Engine", () => {
  it("should pass a valid receipt", () => {
    const result = ValidationEngine.validateReceipt({
      userId: "user_001",
      brand: "Starbucks",
      amount: 7.45,
      uploadedAt: "2026-03-20T14:22:10Z",
    });
    expect(result.success).toBe(true);
  });

  it("should fail an invalid receipt", () => {
    const result = ValidationEngine.validateReceipt({ foo: "bar" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// BOOSTER ENGINE TESTS
// =============================================================================

describe("Booster Engine", () => {
  it("should double points with a 2x booster", () => {
    boosterEngine.registerBooster({ id: "boost_sb", brand: "Starbucks", multiplier: 2 });
    const result = boosterEngine.applyBoosterIfEligible("Starbucks", 10);
    expect(result.success).toBe(true);
    expect(result.data).toBe(20);
  });

  it("should return base points when no booster matches", () => {
    const result = boosterEngine.applyBoosterIfEligible("Nike", 10);
    expect(result.data).toBe(10);
  });
});

// =============================================================================
// AUTOMATION ENGINE TESTS
// =============================================================================

describe("Automation Engine", () => {
  it("should run an automation successfully", async () => {
    automationEngine.registerAutomation({
      id: "auto_test",
      trigger: "RECEIPT_UPLOADED",
      action: "SEND_NOTIFICATION",
      active: true,
    });
    const result = await automationEngine.runAutomation("SEND_NOTIFICATION", "user_001");
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// OCR ENGINE TESTS
// =============================================================================

describe("OCR Engine", () => {
  it("should return success from parseImage", async () => {
    const result = await ocrEngine.parseImage("base64string");
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});

// =============================================================================
// INTEGRATION ENGINE TESTS
// =============================================================================

describe("Integration Engine", () => {
  it("should handle a registered provider webhook", async () => {
    integrationEngine.registerProvider("Shopify", async () => ({ success: true, data: true }));
    const result = await integrationEngine.handleWebhook("Shopify", { order_id: "123" });
    expect(result.success).toBe(true);
  });

  it("should fail for unregistered provider", async () => {
    const result = await integrationEngine.handleWebhook("Unknown", {});
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// POINTS ENGINE TESTS
// =============================================================================

describe("Points Engine", () => {
  it("should calculate base points from amount", () => {
    const result = pointsEngine.calculatePoints(7.45);
    expect(result.success).toBe(true);
    expect(result.data).toBe(7);
  });

  it("should calculate points with multiplier", () => {
    const result = pointsEngine.calculateWithMultiplier(10, 3);
    expect(result.success).toBe(true);
    expect(result.data).toBe(30);
  });
});

// =============================================================================
// RECEIPT ENGINE TESTS
// =============================================================================

describe("Receipt Engine", () => {
  it("should process a valid receipt and emit event", async () => {
    const result = await receiptEngine.processReceipt({
      userId: "user_001",
      brand: "Starbucks",
      amount: 7.45,
      uploadedAt: "2026-03-20T14:22:10Z",
    });
    expect(result.success).toBe(true);
    expect(result.data?.brand).toBe("Starbucks");
  });

  it("should fail on invalid receipt", async () => {
    const result = await receiptEngine.processReceipt({ foo: "bar" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// EVENT BUS TESTS
// =============================================================================

describe("Event Bus", () => {
  it("should fire subscribed handlers", async () => {
    let fired = false;
    eventBus.on("OCR_PARSED", async () => { fired = true; });
    await eventBus.emit({ type: "OCR_PARSED", userId: "user_001", text: "test" });
    expect(fired).toBe(true);
  });
});
