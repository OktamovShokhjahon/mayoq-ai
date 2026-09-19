import path from "node:path";
import PDFDocument from "pdfkit";
import { HttpError } from "../../middleware/errorHandler";
import { DocumentModel } from "./document.model";
import { AIJob } from "../ai-analysis/ai-job.model";
import { MedicalRecord } from "../medical-records/medical-record.model";

// PDFKit's built-in fonts cannot draw Cyrillic or the Uzbek apostrophes, and
// the documents in scope are in Russian, Uzbek and English. DejaVu covers all
// three.
const FONT_DIR = path.join(path.dirname(require.resolve("dejavu-fonts-ttf/package.json")), "ttf");
const REGULAR = path.join(FONT_DIR, "DejaVuSans.ttf");
const BOLD = path.join(FONT_DIR, "DejaVuSans-Bold.ttf");

const SAFETY_TEXT =
  "For clinical decision support only. Final decisions remain with a qualified healthcare professional.";

interface JobOutput {
  timeline?: Array<{ date?: string; event: string; uncertain?: boolean }>;
  missingOrUnclear?: string[];
}

/**
 * A PDF of what was read from one document: every candidate fact with its
 * standard name, verification status and the quoted source line, the timeline
 * and what the reader could not resolve. It states who produced the content and
 * that unverified items are unverified, the same as the screen does.
 */
export async function buildExtractionReport(params: { tenantId: string; documentId: string }): Promise<{
  fileName: string;
  stream: PDFKit.PDFDocument;
}> {
  const document = await DocumentModel.findOne({ _id: params.documentId, tenantId: params.tenantId });
  if (!document) throw new HttpError(404, "Document not found");
  if (!document.analyzedAt) throw new HttpError(409, "Analyze this document before exporting its results");

  const [records, job] = await Promise.all([
    MedicalRecord.find({ tenantId: params.tenantId, sourceDocumentId: document._id }).sort({ eventDate: 1 }).lean(),
    document.aiJobId ? AIJob.findOne({ _id: document.aiJobId, tenantId: params.tenantId }).lean() : null,
  ]);
  const output = (job?.output ?? {}) as JobOutput;
  const producedBy = job?.status === "completed" ? job.modelId : "Deterministic parser (the AI model was unavailable)";

  const pdf = new PDFDocument({ size: "A4", margin: 48, info: { Title: `Extraction report — ${document.fileName}` } });
  pdf.registerFont("Body", REGULAR);
  pdf.registerFont("Bold", BOLD);

  pdf.font("Bold").fontSize(16).text("Document extraction report");
  pdf.moveDown(0.3).font("Body").fontSize(9).fillColor("#555555");
  pdf.text(`File: ${document.fileName}`);
  pdf.text(`Read by: ${producedBy}`);
  pdf.text(`Text source: ${document.extractionMethod ?? "unknown"}`);
  pdf.text(`Analyzed: ${document.analyzedAt.toISOString()}`);
  pdf.text(`Generated: ${new Date().toISOString()}`);
  pdf.moveDown(0.4).fillColor("#111111").fontSize(9).text(SAFETY_TEXT);
  pdf.moveDown();

  pdf.font("Bold").fontSize(12).text(`Candidate facts (${records.length})`);
  pdf.moveDown(0.3);
  if (records.length === 0) pdf.font("Body").fontSize(10).text("No facts were extracted from this document.");

  for (const record of records) {
    const data = record.data as Record<string, unknown>;
    const name = String(data.name ?? data.description ?? record.type);
    const original = data.description && data.description !== name ? String(data.description) : undefined;
    const value = data.value !== undefined ? `${data.value}${data.unit ? " " + data.unit : ""}` : undefined;
    const status = record.verificationStatus === "ai_unverified" ? "AI-extracted, NOT yet verified" : record.verificationStatus;

    if (pdf.y > 730) pdf.addPage();
    pdf.font("Bold").fontSize(10).fillColor("#111111").text(`${record.type.replace(/_/g, " ")} · ${name}`);
    pdf.font("Body").fontSize(9).fillColor("#333333");
    if (original) pdf.text(`As written: ${original}`);
    if (value) pdf.text(`Value: ${value}`);
    pdf.text(`Date: ${record.eventDate.toISOString().slice(0, 10)}${data.uncertain ? " (partial or unclear)" : ""}`);
    pdf.text(`Status: ${status}${data.confidence ? " · confidence " + data.confidence : ""}`);
    const span = record.sourceReferences?.[0]?.span;
    if (span) pdf.fillColor("#555555").text(`Source: “${span}”`);
    pdf.moveDown(0.5);
  }

  if (output.timeline?.length) {
    pdf.moveDown(0.5).font("Bold").fontSize(12).fillColor("#111111").text("Timeline");
    pdf.moveDown(0.3).font("Body").fontSize(9);
    for (const entry of output.timeline) {
      if (pdf.y > 760) pdf.addPage();
      pdf.text(`${entry.date ?? "undated"}${entry.uncertain ? " (uncertain)" : ""} — ${entry.event}`);
    }
  }

  if (output.missingOrUnclear?.length) {
    pdf.moveDown(0.8).font("Bold").fontSize(12).text("Missing or unclear");
    pdf.moveDown(0.3).font("Body").fontSize(9);
    for (const item of output.missingOrUnclear) pdf.text(`• ${item}`);
  }

  pdf.end();
  return { fileName: `extraction-${document._id}.pdf`, stream: pdf };
}
