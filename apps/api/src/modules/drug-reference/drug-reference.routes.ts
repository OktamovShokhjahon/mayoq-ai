import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { getDrugReference } from "./drug-reference.service";

export const drugReferenceRouter = Router();

// Clinicians only: this is prescribing reference material, not patient-facing.
drugReferenceRouter.use(requireAuth, requireRole("DOCTOR", "ADMIN"));

const querySchema = z.object({
  name: z.string().min(2).max(120),
  /** The console's language, for the condensed summary. */
  lang: z.enum(["en", "ru", "uz"]).optional(),
});

drugReferenceRouter.get("/", async (req, res, next) => {
  try {
    const { name, lang } = querySchema.parse(req.query);
    const reference = await getDrugReference(name, lang);
    res.json(reference);
  } catch (err) {
    next(err);
  }
});
