# TwinRx Digital Twin

AI-assisted chronic-care and medication-safety decision-support platform for type 2 diabetes and arterial
hypertension, built per [techmission.md](./techmission.md). **Clinical decision support only — final decisions
remain with a qualified healthcare professional.**

## Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion, React Three Fiber — [apps/web](./apps/web)
- **Backend**: Node.js, Express, TypeScript, Mongoose — [apps/api](./apps/api)
- **Database**: MongoDB
- **AI**: Google Gemini (`gemini-2.5-flash`, free tier) for structured extraction, vision, and explanation, gated behind a deterministic clinical rule engine

## Local development

```bash
cp .env.example .env      # fill in MONGODB_URI / GEMINI_API_KEY (free key: aistudio.google.com/apikey), or use docker-compose's defaults
npm install
docker compose up -d mongodb   # or point MONGODB_URI at your own instance
npm run dev:api            # http://localhost:4000
npm run dev:web            # http://localhost:3000
```

Seed three synthetic demo patients (type 2 diabetes, hypertension, and combined) into a fresh demo clinic:

```bash
npm run seed            # refuses to run if the demo clinic already exists
npm run seed -- --reset # deletes the existing demo clinic first
```

This prints the admin/doctor/patient credentials for the demo clinic to the console. All seeded data is
fictional. The seeded clinic covers a green, a yellow and a red analysis, one allergy, one already-published
patient scenario, and a fortnight of backdated activity so the clinic dashboard has a trend to draw.

On a local API the sign-in page offers one-click access to those three accounts; it hides itself as soon as
`NEXT_PUBLIC_API_URL` points anywhere else.

Run the unit tests (clinical rule evaluation and the deterministic extraction fallback):

```bash
npm test -w @twinrx/api
```

## Full stack via Docker Compose

```bash
docker compose up --build
```

## How a result is produced

1. A document is uploaded. Its text is read deterministically — the PDF text layer, the DOCX body, or plain
   text. A scan or a photo has no text layer, and the UI says so rather than guessing.
2. Candidate facts come back with the source line each one was taken from and land in the doctor's
   verification queue as `AI_UNVERIFIED`. They are not part of the patient snapshot and no rule reads them.
3. The doctor approves or rejects each candidate. Approved lab values are stored under the canonical field
   names the rule catalog asks for, so an approved eGFR immediately stops being reported as missing.
4. The rule catalog runs against the verified snapshot: threshold checks, medication-to-medication
   interactions, duplicate therapy and allergy conflicts, each with the values it read attached.
5. The model explains that result, and never produces it. If Gemini is unreachable, the analysis still stands
   and the explanation falls back to a restatement of the rule findings, labelled as such.
6. The doctor records a decision (approve / reject / discontinue) and separately chooses whether to publish
   the scenario to the patient. Nothing reaches the patient without that second, explicit tick.

## Architecture notes

- Every tenant-owned Mongo collection is scoped by `tenantId`, which is always taken from the authenticated JWT —
  never from the request body (see [middleware/tenant.ts](./apps/api/src/middleware/tenant.ts)).
- Deterministic clinical rules ([modules/ai-analysis/rule-catalog.ts](./apps/api/src/modules/ai-analysis/rule-catalog.ts))
  run before any AI call. The Gemini model only explains rule output — it never invents thresholds or contraindications.
- AI calls are the backend's responsibility only; the browser never talks to Gemini directly.
- Audit events ([modules/audit](./apps/api/src/modules/audit)) are append-only from the application layer.
- The 3D digital twin ([components/digital-twin](./apps/web/components/digital-twin)) falls back to an accessible
  2D organ-card view on unsupported WebGL/mobile environments.
- Plan entitlements ([modules/subscriptions/entitlements.service.ts](./apps/api/src/modules/subscriptions/entitlements.service.ts))
  are derived from live counts rather than accumulated counters, and a clinic over its limit is blocked from
  creating new records only — nothing already recorded is deleted, hidden or made unreadable.
- Access tokens are short-lived; the browser client refreshes them transparently on a 401 and only ends the
  session when the refresh itself fails.

## Known gaps for a production deployment

- Object storage for uploaded documents currently writes to local disk (`apps/api/storage/`) as a stand-in for a
  private S3/MinIO-compatible bucket.
- Virus scanning is stubbed as always-clean; wire a real AV scanner before production use.
- The billing provider is a mock; the interface in `modules/subscriptions/billing.service.ts` is designed to be
  swapped for a real provider (Stripe, PayMe, Click, etc.) without touching calling code.
- Refresh tokens are currently returned to the client and stored in browser storage; production should move to
  httpOnly cookies per the spec.
- OCR is not wired up, so an uploaded scan or photo has to have its text pasted in by a clinician.
- The clinical rule catalog restates ordinary prescribing guidance for the two MVP conditions and carries a
  version string on every analysis. It must be reviewed and signed off by a clinician before real use.
# hackathon-2026-2
# mayoq-ai
