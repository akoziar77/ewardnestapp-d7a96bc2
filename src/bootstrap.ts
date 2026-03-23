import {
  boosterEngine,
  automationEngine,
  integrationEngine,
  eventBus,
} from "@/lib/engines";

export function bootstrapRewardsNest() {
  // --- Boosters -------------------------------------------------------------
  boosterEngine.registerBooster({
    id: "boost_starbucks",
    brand: "Starbucks",
    multiplier: 2,
  });

  // --- Automations -----------------------------------------------------------
  automationEngine.registerAutomation({
    id: "auto_receipt_uploaded",
    trigger: "RECEIPT_UPLOADED",
    action: "SEND_NOTIFICATION",
    active: true,
  });

  // --- Integrations ----------------------------------------------------------
  integrationEngine.registerProvider("Shopify", async (payload) => {
    console.log("Shopify webhook received:", payload);
    return { success: true, data: true };
  });

  // --- Event Bus -------------------------------------------------------------
  eventBus.on("RECEIPT_UPLOADED", async (event) => {
    console.log("EventBus: Receipt uploaded", event);
  });

  console.log("RewardsNest engines bootstrapped.");
}
