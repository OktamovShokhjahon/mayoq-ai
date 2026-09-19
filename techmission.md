# TwinRx Digital Twin — Technical Specification

## 1. Document Information

| Field | Value |
|---|---|
| Product type | AI-assisted chronic-care and medication-safety web platform |
| Working name | TwinRx Digital Twin |
| Primary users | Clinic administrators, doctors, patients |
| MVP clinical scope | Type 2 diabetes mellitus and arterial hypertension |
| Future scope | Heart failure, chronic kidney disease, additional chronic conditions |
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, React Three Fiber |
| Backend | Node.js, Express.js, TypeScript |
| Database | MongoDB with Mongoose |
| AI | Google Gemini API (`gemini-2.5-flash`, free tier), structured-output pipelines, deterministic clinical rules |
| Deployment target | Docker-compatible cloud deployment |

## 2. Product Vision

TwinRx is a clinical decision-support platform that creates a patient-specific digital twin from longitudinal medical history, diagnoses, laboratory results, symptoms, medications, allergies, lifestyle data, and follow-up observations.

The platform helps a doctor answer:

1. What is the patient's current clinical profile?
2. Could a proposed medication or treatment create a relevant interaction or risk?
3. Which organs or physiological systems may be affected?
4. How might the patient's risk profile change over a selected future time period?
5. What information is missing and must be verified before a clinical decision?

TwinRx is an AI-assisted decision-support system. It must not independently prescribe medication, replace a doctor, or present a prediction as a confirmed diagnosis.

## 3. Problem Statement

Patients with chronic diseases often have fragmented medical histories. A doctor may need to review paper documents, previous diagnoses, laboratory results, prescriptions, and patient-reported symptoms before deciding whether a new treatment is appropriate. This makes medication safety checks slow and increases the risk of overlooked contraindications, interactions, duplicate therapy, or insufficient monitoring.

TwinRx converts the available history into a structured patient timeline, analyzes the proposed treatment against the known history, and presents an explainable visual simulation of potential changes.

## 4. Goals and Non-Goals

### 4.1 Goals

- Create a secure multi-tenant platform for clinics.
- Support three roles: `ADMIN`, `DOCTOR`, and `PATIENT`.
- Allow doctors to build a patient profile incrementally.
- Store diagnoses, medications, allergies, laboratory results, symptoms, procedures, and documents as a chronological history.
- Analyze uploaded medical text, images, and documents using Gemini (`gemini-2.5-flash`).
- Detect possible medication-related risks and missing information.
- Generate an explainable risk summary for doctor review.
- Show a 3D patient visualization before and after a proposed treatment scenario.
- Use red, yellow, and green states to communicate risk and expected change.
- Let users select a future time point and view a model-based scenario.
- Provide dashboards, statistics, audit logs, and subscription management.
- Support a 7-day clinic demo after registration.

### 4.2 Non-goals for the MVP

- Autonomous diagnosis or autonomous prescription.
- Guaranteed prediction of a patient's future health.
- Replacement of a licensed clinician.
- Real-time hospital-device integration.
- Training a new medical foundation model.
- Full coverage of every disease and medication.

## 5. Clinical Safety Boundary

The system must clearly distinguish among:

- **Verified facts:** explicitly entered or extracted from a source document and approved by a doctor.
- **AI-extracted facts:** detected by the AI but awaiting doctor confirmation.
- **Clinical rules:** deterministic checks from a versioned, medically reviewed rule catalog.
- **AI interpretation:** a probabilistic explanation or risk summary.
- **Scenario projection:** an illustrative model-based estimate, not a medical guarantee.

The AI must never invent clinical thresholds, drug choices, contraindications, or treatment formulas. If required data is missing, the result must say that the analysis is incomplete and list the missing fields.

Every clinical analysis must show:

- analysis timestamp;
- model name and version;
- clinical rule-set version;
- source records used;
- missing or uncertain data;
- confidence or evidence level;
- doctor review status;
- whether recalculation is required because the patient data changed.

The product must include visible safety text: `For clinical decision support only. Final decisions remain with a qualified healthcare professional.`

## 6. User Roles and Permissions

### 6.1 Clinic Admin

The clinic admin is created when a clinic starts registration.

Permissions:

- View clinic-level dashboard and statistics.
- Create, activate, deactivate, and reset doctor accounts.
- View doctor list and doctor activity.
- View patient list within the clinic.
- View recent diagnoses and treatment analyses.
- View audit logs.
- View subscription plan, trial status, invoices, and usage limits.
- Configure clinic profile and notification preferences.

The admin must not edit a doctor's clinical note without an explicit audited workflow.

### 6.2 Doctor

Permissions:

- Create patient accounts and credentials.
- View and edit assigned patients.
- Deactivate or archive patient accounts.
- Change patient status.
- Add, edit, verify, and archive medical-history records.
- Add a new diagnosis or select an existing diagnosis from the patient's history.
- Add medications, dosage, route, frequency, duration, and treatment purpose.
- Record allergies, symptoms, observations, laboratory results, and vital signs.
- Upload documents and review AI-extracted information.
- Run medication-safety and treatment-impact analyses.
- Review, approve, reject, or edit AI-extracted facts.
- View 3D before/after scenarios and time-based projections.
- Add a final clinical note and follow-up plan.

### 6.3 Patient

Permissions:

- View personal profile and approved medical history.
- View diagnoses and treatment records approved for patient visibility.
- View current medications and instructions entered by a doctor.
- View AI-generated educational summaries and scenario visualizations.
- Select a time horizon and inspect projected changes.
- Report symptoms and submit follow-up observations.
- Use the AI chatbot for educational questions with clear safety boundaries.

The patient must not see internal physician notes, hidden audit data, unapproved AI extraction, or another patient's data.

## 7. Core User Journeys

### 7.1 Clinic Registration and Trial

1. Clinic admin submits clinic name, contact information, email, and password.
2. The system creates a tenant and admin account.
3. A 7-day demo subscription is activated automatically.
4. The admin is shown remaining trial days and demo usage limits.
5. The admin creates doctor accounts.
6. The system sends or displays initial credentials through a secure one-time flow.

### 7.2 Doctor Creates a Patient

1. Doctor opens `New Patient`.
2. Doctor enters the minimum required information.
3. The system generates a patient account and temporary password.
4. Doctor adds the patient's first diagnosis, medication, allergy, laboratory result, or document.
5. Patient remains in `Incomplete` status until required fields are reviewed.

### 7.3 Medical History Entry

The form must be simple and progressive. The doctor can add records one by one using a stepper or modal:

- Record type: diagnosis, medication, allergy, symptom, laboratory result, vital sign, procedure, document, lifestyle observation.
- Date or date range.
- Short description.
- Source: doctor entry, external document, patient report, laboratory, other.
- Status: unverified, verified, historical, resolved, active.
- Optional attachment.
- Optional note.

The form must support saving a draft and adding the next record without leaving the patient page.

### 7.4 Treatment Analysis

1. Doctor selects an existing diagnosis or adds a new diagnosis.
2. Doctor enters the proposed medication and treatment plan.
3. The backend validates required fields and retrieves the relevant patient snapshot.
4. The system runs deterministic rules first.
5. The AI pipeline extracts and summarizes supporting evidence.
6. The system checks medication-to-condition, medication-to-medication, allergy, organ-risk, and missing-data signals.
7. The system generates a versioned analysis.
8. The frontend displays a risk summary, affected organs, evidence, missing information, and 3D before/after scenario.
9. The doctor reviews and records a clinical decision.
10. The system writes all actions to the audit log.

### 7.5 Patient Projection

1. Patient opens the approved treatment scenario.
2. Patient selects a time horizon such as 7 days, 30 days, 90 days, or 1 year.
3. The system displays an educational projection based on the approved scenario.
4. The interface distinguishes current measured data from projected data.
5. The patient can submit a symptom or follow-up observation.

## 8. Functional Requirements

### 8.1 Authentication and Account Management

- Email/username and password login.
- JWT access token with refresh-token rotation.
- Password hashing with Argon2id or bcrypt.
- Role-based and tenant-based authorization on every protected endpoint.
- Temporary-password flow for newly created doctor and patient accounts.
- Password reset and account deactivation.
- Optional two-factor authentication as a post-MVP feature.
- Session revocation after password reset or account deactivation.

### 8.2 Patient Management

- Patient search by name, patient code, phone, diagnosis, and status.
- Patient statuses: `INCOMPLETE`, `ACTIVE`, `NEEDS_REVIEW`, `FOLLOW_UP`, `ARCHIVED`.
- Demographic information with minimum necessary data.
- Emergency contact as optional data.
- Consent and data-processing status.
- Timeline view of all medical records.
- Soft deletion and archival only; no hard deletion from the normal UI.

### 8.3 Medical History

- Add/edit/verify/archive history records.
- Chronological timeline with filters.
- Source-document linking.
- Doctor approval workflow for AI-extracted facts.
- Record-level provenance and timestamps.
- Version history for edited clinical records.

### 8.4 Diagnoses and Treatment

- Diagnosis catalog with ICD-compatible code field where available.
- Custom diagnosis label with mandatory doctor note.
- Active and historical diagnosis state.
- Medication record with generic name, brand name, dosage, unit, route, frequency, start date, end date, status, and purpose.
- Treatment plan containing one or more medications and non-drug interventions.
- Doctor decision state: `DRAFT`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `DISCONTINUED`.

### 8.5 Document and Data Analysis

Supported MVP inputs:

- PDF;
- DOCX;
- JPG, PNG, and phone-camera images;
- pasted text;
- manually entered structured values.

Pipeline requirements:

1. Validate file type, size, and virus-scan status.
2. Store the original file in private object storage.
3. Extract text with a deterministic parser or OCR service.
4. Send only the required extracted content to the AI service.
5. Request strict JSON output using a predefined schema.
6. Validate the AI output with Zod or JSON Schema.
7. Mark extracted facts as `AI_UNVERIFIED`.
8. Require a doctor to confirm clinical facts before they enter the verified patient snapshot.
9. Preserve the source span or page reference for every extracted fact.

### 8.6 AI Chatbot

The chatbot must:

- answer general educational questions;
- explain a patient's approved results in plain language;
- explain medication instructions already entered by a doctor;
- refuse diagnosis and prescription requests;
- identify emergency symptoms and advise contacting emergency services;
- avoid revealing another patient's information;
- use the patient's approved context only when the user is authorized;
- show that it is AI-generated and not a substitute for a clinician.

The chatbot must not silently change medical records or treatment plans.

### 8.7 3D Digital Twin

The 3D module must provide:

- a rotatable human-body model;
- front, back, and side views;
- selectable organs and systems;
- organ status overlays;
- a `Before` state based on the current approved patient snapshot;
- an `After` state based on the selected treatment scenario;
- a side-by-side and slider comparison mode;
- an animation between states;
- a time-horizon selector;
- a legend for measured, inferred, and projected values.

Color semantics:

| Color | Meaning | UI behavior |
|---|---|---|
| Green | No significant risk identified or expected improvement | Positive status badge and low-intensity organ glow |
| Yellow | Monitoring required, uncertain data, or moderate concern | Warning badge, pulse animation, follow-up indicator |
| Red | High-priority risk, contraindication signal, or deterioration signal | High-visibility alert, organ highlight, doctor-review requirement |

Color must never be the only signal. Every state must also use text, an icon, and an accessible label.

Affected organs and systems for the MVP may include:

- heart and cardiovascular system;
- kidneys;
- liver;
- pancreas;
- blood vessels;
- eyes;
- nervous system;
- medication-relevant systems defined by the reviewed rule catalog.

The 3D scene must not imply anatomical certainty when the input is uncertain. It should label a visual result as `Potential impact` or `Scenario projection`.

Recommended frontend libraries:

- `three`;
- `@react-three/fiber`;
- `@react-three/drei`;
- `@react-three/postprocessing` only where performance permits.

The app must provide a low-performance fallback: a 2D body diagram or organ cards for mobile devices and unsupported WebGL environments.

### 8.8 Analytics and Statistics

Admin dashboard:

- active doctors;
- active patients;
- patients by status;
- diagnoses by category;
- recent analyses;
- high-risk alerts;
- follow-up compliance;
- AI analysis volume and failure rate;
- subscription status and usage;
- audit activity.

Doctor dashboard:

- assigned patients;
- patients needing review;
- new alerts;
- follow-ups due;
- recent treatment analyses;
- missing-data tasks.

Patient dashboard:

- current approved diagnoses;
- current medications;
- upcoming follow-up;
- approved risk summary;
- trend charts;
- projected scenario timeline.

All statistics must be tenant-scoped and must never mix clinics.

### 8.9 Audit and Compliance Features

Audit events must record:

- actor ID and role;
- tenant ID;
- action;
- target type and target ID;
- timestamp;
- IP/device metadata where legally appropriate;
- before/after summary for updates;
- analysis ID and model/rule versions when applicable.

Audit records must be append-only from the application UI. Admins can filter and export audit logs but cannot edit them.

### 8.10 Subscription and Billing

Plans:

- `DEMO`: 7 days, automatically activated for a new clinic;
- `MONTHLY`: recurring monthly subscription;
- `YEARLY`: recurring annual subscription.

Requirements:

- subscription state: trialing, active, past_due, canceled, expired;
- plan limits and feature entitlements;
- billing-provider abstraction in the backend;
- webhook endpoint with signature verification;
- idempotent payment-event handling;
- subscription and payment audit records;
- read-only access to historical patient records after subscription expiry, subject to clinic policy and legal requirements;
- graceful feature lock instead of destructive deletion.

For the hackathon demo, payment can use a mock provider while preserving the same service interface required for production integration.

## 9. AI Architecture

### 9.1 AI Service Strategy

Gemini is the model gateway. `gemini-2.5-flash` is used for structured extraction, normalization, explanation, and scenario summarization and, for scanned pages and photos, direct document reading.

The platform must not call the model directly from the browser. All AI requests go through the Express backend.

### 9.2 AI Pipeline

```text
Input document / form data
        ↓
Text extraction and normalization
        ↓
PII-aware preprocessing and prompt construction
        ↓
Gemini structured extraction
        ↓
JSON Schema / Zod validation
        ↓
Doctor verification queue
        ↓
Verified patient snapshot
        ↓
Deterministic clinical rules
        ↓
AI explanation and missing-data summary
        ↓
Versioned treatment scenario
        ↓
Dashboard, chatbot, and 3D visualization
```

### 9.3 AI Tasks

| Task | AI output | Must be verified by doctor? |
|---|---|---|
| Document understanding | Document type, dates, candidate facts, source spans | Yes |
| Medical entity normalization | Candidate diagnoses, medications, lab names, units | Yes |
| Timeline construction | Ordered events and uncertainty markers | Yes |
| Treatment summary | Plain-language explanation of entered plan | Yes before patient visibility |
| Missing-data detection | Required or useful fields not found | Yes |
| Interaction explanation | Human-readable explanation of rule result | Yes |
| Scenario narrative | Possible change over selected time horizon | Yes |
| Chatbot response | Educational response from approved context | No automatic record change; safety guard required |

### 9.4 Prompt and Output Rules

- Use task-specific prompts instead of one general prompt.
- Include the patient's data only when necessary.
- Include explicit instructions to return `unknown` rather than guessing.
- Require citations to source record IDs or document page references.
- Use low temperature for extraction.
- Validate every response against a strict schema.
- Store prompt version, model ID, response ID, latency, token usage, and error status.
- Never place API keys in frontend code, Git, logs, or exported demo files.

Example treatment-analysis output:

```json
{
  "analysisStatus": "needs_doctor_review",
  "overallRisk": "yellow",
  "signals": [
    {
      "type": "organ_risk",
      "organ": "kidney",
      "severity": "moderate",
      "color": "yellow",
      "explanation": "The available history contains an incomplete renal function record.",
      "evidenceRecordIds": ["record_123"],
      "missingData": ["latest eGFR", "latest creatinine"]
    }
  ],
  "affectedOrgans": ["kidney", "cardiovascular_system"],
  "projection": {
    "horizonDays": 30,
    "label": "scenario_projection",
    "confidence": "limited"
  },
  "disclaimer": "This is decision support and not a diagnosis or prescription."
}
```

### 9.5 Failure and Fallback Mode

If Gemini or the AI model is unavailable:

- preserve all manually entered data;
- run deterministic checks that do not require the model;
- show `AI unavailable` clearly;
- do not fabricate a result;
- allow the doctor to continue with manual review;
- show a demo fallback dataset only when explicitly enabled for a hackathon presentation.

## 10. Technical Architecture

### 10.1 Frontend

- Next.js App Router with TypeScript.
- Server-side rendering for public pages and authenticated client components for dashboards.
- Tailwind CSS for layout and design tokens.
- shadcn/ui or Radix UI for accessible primitives.
- Framer Motion for page transitions, cards, drawers, stepper transitions, and alert emphasis.
- React Query or SWR for server state and cache invalidation.
- React Hook Form + Zod for forms.
- React Three Fiber for the digital twin.
- Recharts or Visx for clinical trends and statistics.
- i18n-ready architecture; Uzbek and English can be added without changing data structures.

### 10.2 Backend

- Express.js with TypeScript.
- Layered architecture: routes → controllers → services → repositories → models.
- Mongoose schemas and indexes.
- JWT authentication middleware.
- RBAC and tenant isolation middleware.
- Zod or Joi request validation.
- Central error handler with safe public messages.
- Pino or equivalent structured logging with sensitive-field redaction.
- Background job queue for document extraction and AI analysis.
- Rate limiting for authentication, uploads, AI, and chatbot endpoints.

### 10.3 Data and Infrastructure

- MongoDB Atlas or a self-hosted MongoDB deployment.
- Private object storage for uploaded documents.
- Redis-compatible queue/cache for long-running AI jobs.
- HTTPS everywhere.
- Secrets supplied through environment variables or a managed secret store.
- Docker Compose for local development.
- Separate development, staging, and production environments.

## 11. Suggested Project Structure

```text
twinrx/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── admin/
│   │   │   ├── doctor/
│   │   │   ├── patient/
│   │   │   └── api-proxy/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── charts/
│   │   │   ├── digital-twin/
│   │   │   └── medical-records/
│   │   ├── lib/
│   │   └── public/
│   └── api/
│       └── src/
│           ├── config/
│           ├── middleware/
│           ├── modules/
│           │   ├── auth/
│           │   ├── tenants/
│           │   ├── users/
│           │   ├── patients/
│           │   ├── medical-records/
│           │   ├── diagnoses/
│           │   ├── medications/
│           │   ├── documents/
│           │   ├── ai-analysis/
│           │   ├── chatbot/
│           │   ├── subscriptions/
│           │   ├── analytics/
│           │   └── audit/
│           ├── jobs/
│           ├── shared/
│           └── server.ts
├── packages/
│   ├── shared-types/
│   ├── validation/
│   └── clinical-rules/
├── docker-compose.yml
├── .env.example
└── README.md
```

## 12. MongoDB Data Model

All tenant-owned collections must include `tenantId` and an index beginning with `tenantId`.

### 12.1 Tenant

```text
Tenant {
  _id,
  name,
  slug,
  contactEmail,
  status,
  subscriptionId,
  trialEndsAt,
  createdAt,
  updatedAt
}
```

### 12.2 User

```text
User {
  _id,
  tenantId,
  role: ADMIN | DOCTOR | PATIENT,
  fullName,
  email,
  phone,
  passwordHash,
  status,
  lastLoginAt,
  createdBy,
  createdAt,
  updatedAt
}
```

### 12.3 PatientProfile

```text
PatientProfile {
  _id,
  tenantId,
  userId,
  patientCode,
  dateOfBirth,
  sex,
  bloodGroup,
  heightCm,
  weightKg,
  smokingStatus,
  consentStatus,
  status,
  assignedDoctorIds,
  createdAt,
  updatedAt,
  archivedAt
}
```

### 12.4 MedicalRecord

```text
MedicalRecord {
  _id,
  tenantId,
  patientId,
  type,
  eventDate,
  data,
  sourceType,
  sourceDocumentId,
  verificationStatus,
  verifiedBy,
  verifiedAt,
  sourceReferences,
  version,
  createdBy,
  createdAt,
  updatedAt
}
```

### 12.5 TreatmentScenario

```text
TreatmentScenario {
  _id,
  tenantId,
  patientId,
  diagnosisIds,
  medicationIds,
  baselineSnapshotHash,
  analysisResult,
  organImpacts,
  horizonDays,
  modelId,
  promptVersion,
  ruleSetVersion,
  status,
  doctorReview,
  createdBy,
  createdAt,
  recalculationRequired
}
```

### 12.6 Supporting Collections

- `Diagnosis`
- `Medication`
- `Allergy`
- `Document`
- `AIJob`
- `ClinicalRule`
- `Subscription`
- `AuditEvent`
- `ChatConversation`
- `Notification`

## 13. REST API Requirements

Base URL: `/api/v1`

### 13.1 Auth

```text
POST   /auth/register-clinic
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout
POST   /auth/change-password
POST   /auth/forgot-password
```

### 13.2 Admin

```text
GET    /admin/dashboard
GET    /admin/doctors
POST   /admin/doctors
PATCH  /admin/doctors/:doctorId
POST   /admin/doctors/:doctorId/reset-password
GET    /admin/patients
GET    /admin/diagnoses/recent
GET    /admin/audit-events
GET    /admin/subscription
```

### 13.3 Doctor and Patients

```text
GET    /doctor/dashboard
GET    /patients
POST   /patients
GET    /patients/:patientId
PATCH  /patients/:patientId
POST   /patients/:patientId/archive
POST   /patients/:patientId/records
GET    /patients/:patientId/records
PATCH  /records/:recordId
POST   /patients/:patientId/documents
POST   /documents/:documentId/analyze
POST   /patients/:patientId/diagnoses
POST   /patients/:patientId/treatment-scenarios
GET    /patients/:patientId/treatment-scenarios
POST   /treatment-scenarios/:scenarioId/review
POST   /treatment-scenarios/:scenarioId/recalculate
```

### 13.4 Patient

```text
GET    /me/profile
GET    /me/medical-history
GET    /me/diagnoses
GET    /me/medications
GET    /me/approved-scenarios
POST   /me/follow-up-observations
```

### 13.5 Chatbot and Analytics

```text
POST   /chat/conversations
POST   /chat/conversations/:conversationId/messages
GET    /analytics/overview
GET    /analytics/trends
```

### 13.6 Subscription Webhooks

```text
POST   /billing/checkout-session
POST   /billing/webhooks/provider
GET    /billing/subscription
```

## 14. Frontend Page Requirements

### Public Pages

- Landing page with product value proposition.
- How it works.
- Clinical safety and limitations.
- Pricing: demo, monthly, yearly.
- Clinic registration and login.

### Shared Authenticated UI

- Responsive sidebar.
- Top bar with role, clinic, notifications, and account menu.
- Breadcrumbs.
- Global search where permitted.
- AI safety notice.
- Accessible loading, empty, error, and offline states.

### Admin Pages

- `/admin/dashboard`
- `/admin/doctors`
- `/admin/patients`
- `/admin/diagnoses`
- `/admin/audit`
- `/admin/subscription`
- `/admin/settings`

### Doctor Pages

- `/doctor/dashboard`
- `/doctor/patients`
- `/doctor/patients/new`
- `/doctor/patients/[id]`
- `/doctor/patients/[id]/history`
- `/doctor/patients/[id]/analysis/new`
- `/doctor/alerts`

### Patient Pages

- `/patient/dashboard`
- `/patient/history`
- `/patient/diagnoses`
- `/patient/medications`
- `/patient/digital-twin`
- `/patient/chat`

## 15. UI, Animation, and Visual Design

The interface should feel modern, trustworthy, and clinically calm rather than playful.

Visual direction:

- deep navy base;
- electric blue and cyan accents;
- subtle green/yellow/red clinical state colors;
- restrained purple or blue gradients for AI surfaces;
- glassmorphism only for non-critical decorative panels;
- high-contrast white content surfaces;
- soft blurred background shapes;
- rounded cards with clear hierarchy;
- readable typography and generous spacing.

Required interactions:

- animated page transitions;
- smooth dashboard card entrance;
- timeline expansion and collapse;
- medication-analysis progress states;
- organ hover and selection effects;
- before/after slider animation;
- alert pulse for red and yellow states;
- skeleton loaders instead of abrupt layout shifts;
- reduced-motion mode using `prefers-reduced-motion`.

Do not use animation to hide loading, uncertainty, or clinical risk. Critical alerts must remain readable without animation.

## 16. Security and Privacy Requirements

- Enforce tenant isolation in every query.
- Never trust a `tenantId` supplied by the browser.
- Use secure, httpOnly cookies for refresh tokens where possible.
- Use short-lived access tokens.
- Hash passwords with Argon2id or bcrypt.
- Validate and sanitize every request.
- Limit upload size and file types.
- Virus-scan uploaded files.
- Encrypt data in transit and at rest where supported.
- Redact medical data and tokens from logs.
- Apply rate limiting and brute-force protection.
- Use strict CORS configuration.
- Set security headers with Helmet.
- Protect against CSRF where cookie authentication is used.
- Use soft deletion for clinical records.
- Keep an immutable audit trail.
- Provide data export and account deactivation workflows.
- Do not use real patient data in the hackathon repository or demo.
- Use synthetic patients for testing and public presentation.
- Document applicable Uzbek personal-data and healthcare compliance requirements before production deployment.

## 17. Non-Functional Requirements

### Performance

- Initial dashboard load target: under 3 seconds on a normal broadband connection.
- API response target for ordinary CRUD operations: p95 under 500 ms.
- AI jobs must be asynchronous and show progress.
- 3D scene must target 30 FPS on a supported desktop device.
- Provide 2D fallback for unsupported or low-power devices.

### Availability and Reliability

- AI failure must not corrupt medical records.
- Every long-running job must be retryable and idempotent.
- Every analysis must have a status: queued, processing, completed, failed, stale.
- An analysis must become stale when its source patient snapshot changes.

### Accessibility

- WCAG 2.2 AA target for core workflows.
- Keyboard navigation for forms and dashboards.
- Screen-reader labels for all charts, 3D controls, and risk states.
- Color must not be the sole communication method.

## 18. Testing Strategy

### Unit Tests

- authorization policies;
- tenant filters;
- form schemas;
- clinical-rule evaluation;
- risk-color mapping;
- scenario time-horizon calculations;
- AI-output validation;
- subscription entitlement logic.

### Integration Tests

- registration and trial activation;
- admin creates doctor;
- doctor creates patient;
- doctor adds medical records;
- document analysis and doctor verification;
- treatment scenario creation;
- patient visibility restrictions;
- webhook idempotency;
- audit-event creation.

### Security Tests

- cross-tenant access attempts;
- role escalation;
- invalid JWT and refresh-token reuse;
- upload abuse;
- prompt injection in uploaded documents;
- sensitive data leakage in chatbot responses.

### Clinical Safety Tests

- missing data is shown rather than guessed;
- unverified AI facts do not enter the verified snapshot;
- the same profile and rule version produce comparable A/B results;
- stale analyses are clearly marked;
- red flags require doctor review;
- no AI response is presented as a confirmed diagnosis or prescription.

## 19. Hackathon MVP Scope

The live demo should be optimized around three synthetic patients and a two-minute end-to-end flow:

1. Admin opens the clinic dashboard.
2. Doctor selects a patient with type 2 diabetes and hypertension.
3. Doctor uploads or pastes one medical document.
4. AI extracts candidate history with source references.
5. Doctor verifies the extracted facts.
6. Doctor adds a proposed medication scenario.
7. The system runs deterministic checks plus Gemini analysis.
8. The dashboard shows red, yellow, and green organ signals.
9. The 3D twin transitions from before to after.
10. Doctor reviews and approves the patient-visible summary.
11. Patient opens the same approved scenario and selects a future time horizon.

The demo must include an explicit AI-unavailable fallback mode and must clearly distinguish live model output from pre-recorded or synthetic data.

## 20. Delivery Phases

### Phase 1 — Foundation

- repository and environment setup;
- authentication;
- tenant model;
- role-based routing;
- basic design system;
- MongoDB connection;
- audit foundation.

### Phase 2 — Clinical Records

- patient CRUD;
- progressive history form;
- diagnosis and medication records;
- document upload;
- verification workflow.

### Phase 3 — AI and Safety

- Gemini integration;
- Gemini structured extraction;
- output validation;
- deterministic rule engine;
- treatment scenario storage;
- missing-data and stale-analysis handling.

### Phase 4 — Visualization

- 3D human model;
- organ mapping;
- red/yellow/green overlays;
- before/after comparison;
- time-horizon projection UI;
- 2D fallback.

### Phase 5 — Dashboards and Monetization

- admin statistics;
- doctor alerts;
- patient portal;
- chatbot;
- 7-day demo;
- monthly/yearly subscription abstraction;
- mock payment flow.

### Phase 6 — Hardening and Demo

- security tests;
- clinical safety review;
- synthetic-data seed scripts;
- error and fallback states;
- performance pass;
- deployment;
- two-minute demo rehearsal and backup video.

## 21. Environment Variables

```env
NODE_ENV=development
WEB_URL=http://localhost:3000
API_URL=http://localhost:4000
MONGODB_URI=mongodb://localhost:27017/twinrx
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
GEMINI_API_KEY=replace_me
GEMINI_MODEL=gemini-2.5-flash
OBJECT_STORAGE_ENDPOINT=replace_me
OBJECT_STORAGE_BUCKET=replace_me
OBJECT_STORAGE_ACCESS_KEY=replace_me
OBJECT_STORAGE_SECRET_KEY=replace_me
BILLING_PROVIDER=mock
BILLING_WEBHOOK_SECRET=replace_me
```

Secrets must be stored outside the repository. `.env.example` may contain names and placeholders only.

## 22. Definition of Done

The MVP is complete when:

- all three roles can log in and see only permitted data;
- an admin can create a doctor;
- a doctor can create a patient and add history records one by one;
- a doctor can upload a document and review AI-extracted facts;
- the system can run a versioned treatment analysis using Gemini (`gemini-2.5-flash`);
- deterministic rule checks run before AI explanation;
- missing data and uncertainty are displayed;
- the system produces a red/yellow/green risk summary;
- affected organs are mapped to the 3D patient visualization;
- before/after and time-horizon scenarios work for seeded synthetic patients;
- the patient sees only doctor-approved information;
- admin statistics, doctor alerts, and audit logs are available;
- the 7-day demo subscription is activated on clinic registration;
- monthly and yearly subscription states are represented;
- AI failure has a safe fallback;
- no real patient data or API key is committed;
- core flows pass unit, integration, security, and clinical-safety tests;
- the product visibly states that it is clinical decision support, not autonomous medical advice.

## 23. Recommended Demo Seed Data

Create three synthetic patients:

1. Type 2 diabetes with incomplete renal laboratory data and a yellow kidney monitoring signal.
2. Hypertension with a medication-related cardiovascular monitoring signal.
3. Combined diabetes and hypertension with an improved projected scenario and green/yellow mixed organ states.

Each seed patient must include clearly marked fictional data and must never resemble a real identifiable person.

## 24. Final Product Principle

TwinRx should make a doctor's reasoning faster, more visible, and more consistent. It must expose uncertainty instead of hiding it, preserve the source of every important fact, and use the 3D digital twin as an understandable visualization of a clinical scenario—not as proof of a guaranteed future outcome.
