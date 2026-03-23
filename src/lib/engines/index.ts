// =============================================================================
// ENGINE BARREL EXPORTS
// =============================================================================

// Core types & utilities
export {
  type EngineResult,
  type EngineEvent,
  zReceipt,
  zBooster,
  zAutomation,
  safeExecute,
  wait,
  logEngineEvent,
  calculateBasePoints,
  applyBooster,
} from "./core";

// Validation & Event Bus
export { ValidationEngine, EventBus, eventBus } from "./validation-bus";

// Booster & Automation
export {
  BoosterEngine,
  boosterEngine,
  AutomationEngine,
  automationEngine,
} from "./booster-automation";

// OCR
export { OCREngine, ocrEngine } from "./ocr";

// Integration
export { IntegrationEngine, integrationEngine } from "./integration";
