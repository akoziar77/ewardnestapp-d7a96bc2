import { EngineResult, safeExecute } from "./core";
import { eventBus } from "./validation-bus";

// =============================================================================
// OCR ENGINE
// =============================================================================

export class OCREngine {
  async parseImage(imageData: string): Promise<EngineResult<string>> {
    return safeExecute(async () => {
      // Simulate OCR processing
      console.log(`[OCREngine] Parsing image data (${imageData.length} chars)`);
      await new Promise((r) => setTimeout(r, 100));
      return `Parsed text from image`;
    });
  }

  async parseReceipt(
    userId: string,
    imageData: string
  ): Promise<EngineResult<string>> {
    const result = await this.parseImage(imageData);
    if (result.success && result.data) {
      await eventBus.emit({
        type: "OCR_PARSED",
        userId,
        text: result.data,
      });
    }
    return result;
  }
}

export const ocrEngine = new OCREngine();
