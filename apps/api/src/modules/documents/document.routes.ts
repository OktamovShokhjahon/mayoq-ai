import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { HttpError } from "../../middleware/errorHandler";
import { analyzeDocument, uploadDocument } from "./document.service";
import { DocumentModel } from "./document.model";
import { recordAuditEvent } from "../audit/audit.service";
import { buildExtractionReport } from "./extraction-report";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export const documentUploadRouter = Router({ mergeParams: true });
documentUploadRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

documentUploadRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "No file uploaded");
    const document = await uploadDocument({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
      uploadedBy: req.auth!.userId,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      buffer: req.file.buffer,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "document.upload",
      targetType: "Document",
      targetId: String(document._id),
    });

    res.status(201).json(document);
  } catch (err) {
    next(err);
  }
});

documentUploadRouter.get("/", async (req, res, next) => {
  try {
    const documents = await DocumentModel.find({
      tenantId: req.auth!.tenantId,
      patientId: (req.params as { patientId: string }).patientId,
    })
      // The stored text can be long and is not what a list needs.
      .select("-extractedText")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(documents);
  } catch (err) {
    next(err);
  }
});

export const documentAnalyzeRouter = Router();
documentAnalyzeRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

// Optional: the server parses PDFs and DOCX itself, and a doctor only pastes
// text when the file has none (a scan or a photo).
const analyzeSchema = z.object({ extractedText: z.string().min(1).optional() });

documentAnalyzeRouter.post("/:documentId/analyze", async (req, res, next) => {
  try {
    const input = analyzeSchema.parse(req.body);
    const result = await analyzeDocument({
      tenantId: req.auth!.tenantId,
      documentId: req.params.documentId,
      extractedText: input.extractedText,
      createdBy: req.auth!.userId,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "document.analyze",
      targetType: "Document",
      targetId: req.params.documentId,
      afterSummary: { candidates: result.createdRecordIds.length, aiAvailable: result.aiAvailable },
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

documentAnalyzeRouter.get("/:documentId/export.pdf", async (req, res, next) => {
  try {
    const report = await buildExtractionReport({
      tenantId: req.auth!.tenantId,
      documentId: req.params.documentId,
    });

    await recordAuditEvent({
      tenantId: req.auth!.tenantId,
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      action: "document.export_pdf",
      targetType: "Document",
      targetId: req.params.documentId,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${report.fileName}"`);
    report.stream.pipe(res);
  } catch (err) {
    next(err);
  }
});
