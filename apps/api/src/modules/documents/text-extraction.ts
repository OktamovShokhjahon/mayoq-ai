import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { logger } from "../../config/logger";

export interface ExtractionResult {
  /** Empty when nothing could be read deterministically from this file. */
  text: string;
  /** How the text was obtained, so the UI can say it rather than imply OCR. */
  method: "pdf_text_layer" | "docx" | "plain_text" | "none";
  /** Present when a parser could not read the file; never a guess at content. */
  reason?: string;
}

const EMPTY: ExtractionResult = { text: "", method: "none" };

/**
 * Deterministic text extraction (spec 8.5 step 3). No model is involved here:
 * either the bytes contain readable text or they do not. A scanned image needs
 * an OCR service that this deployment does not have, and saying so is better
 * than handing the model an empty string and presenting whatever comes back.
 */
export async function extractDocumentText(mimeType: string, buffer: Buffer): Promise<ExtractionResult> {
  try {
    if (mimeType === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      const text = normalize(result.text ?? "");
      return text
        ? { text, method: "pdf_text_layer" }
        : { ...EMPTY, reason: "This PDF has no text layer, so it looks scanned. Gemini will read the pages directly when you analyze it." };
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const result = await mammoth.extractRawText({ buffer });
      const text = normalize(result.value ?? "");
      return text ? { text, method: "docx" } : { ...EMPTY, reason: "This document contains no readable text." };
    }

    if (mimeType.startsWith("text/")) {
      const text = normalize(buffer.toString("utf8"));
      return text ? { text, method: "plain_text" } : EMPTY;
    }

    return {
      ...EMPTY,
      reason: "This is an image. Gemini will read it directly when you analyze it, or you can paste the text instead.",
    };
  } catch (err) {
    logger.error({ err, mimeType }, "Deterministic text extraction failed");
    return { ...EMPTY, reason: "The file could not be read. Paste its text to analyze it." };
  }
}

function normalize(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 20000);
}
