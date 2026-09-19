/**
 * A stable code for each error message the console can show a user.
 *
 * The messages themselves are written in English, in the service that throws
 * them, and that is the right place for them: they are read in logs and tests
 * too. But a doctor working in Uzbek should not be told "Patient not found" in
 * English, so every response also carries a code, and the console says it in
 * the language it is running in. The English travels with it as the fallback,
 * which is what an unmapped message gets.
 *
 * Keyed by the message so nothing has to be threaded through forty call sites.
 * The cost is that editing a message here means editing it there: the paired
 * test keeps the two honest.
 */
export const ERROR_CODES: Record<string, string> = {
  "Patient not found": "patientNotFound",
  "Patient profile not found": "patientProfileNotFound",
  "Treatment scenario not found": "scenarioNotFound",
  "Diagnosis not found": "diagnosisNotFound",
  "Document not found": "documentNotFound",
  "Doctor not found": "doctorNotFound",
  "User not found": "userNotFound",
  "Record not found": "recordNotFound",
  "Conversation not found": "conversationNotFound",
  "Subscription not found for tenant": "subscriptionNotFound",

  "Invalid credentials": "invalidCredentials",
  "Account is deactivated": "accountDeactivated",
  "Invalid refresh token": "invalidRefreshToken",
  "Refresh token no longer valid": "refreshTokenExpired",
  "Current password is incorrect": "wrongPassword",

  "A clinic with a similar name is already registered": "clinicExists",
  "A user with this email already exists": "emailExists",
  "A user with this email already exists in this clinic": "emailExistsInClinic",

  "At least one diagnosis and one medication are required for an analysis": "analysisNeedsBoth",
  "The projection end date must be after the start date": "projectionOrder",
  "Write the summary text before approving it": "summaryEmpty",
  "This diagnosis has no AI detail to review": "noDetailToReview",

  "No file uploaded": "noFile",
  "Unsupported file type. Allowed: PDF, DOCX, JPG, PNG, TXT.": "unsupportedFileType",
  "File exceeds the 15MB upload limit.": "fileTooLarge",
  "The stored file could not be opened. Upload it again or paste its text.": "fileUnreadable",
  "Analyze this document before exporting its results": "analyzeBeforeExport",
};

export function errorCodeFor(message: string): string | undefined {
  return ERROR_CODES[message];
}
