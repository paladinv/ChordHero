import type { PracticeArea, PracticeAssignment, PracticeFeedbackAttachment, PracticeResult } from "./practicePlatform";

export function normalizePracticeAssignment(value: unknown): PracticeAssignment | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PracticeAssignment>;
  if (typeof input.id !== "string" || typeof input.title !== "string" || typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) return null;
  const area: PracticeArea = input.area === "chords" || input.area === "songs" || input.area === "rightHand" ? input.area : "rightHand";
  const attachments = Array.isArray(input.feedbackAttachments) ? input.feedbackAttachments.map(normalizeFeedbackAttachment).filter((attachment): attachment is PracticeFeedbackAttachment => Boolean(attachment)).slice(-20) : [];
  const feedbackNotes = Array.isArray(input.feedbackNotes) ? input.feedbackNotes.filter((note): note is { id: string; body: string; createdAt: string } => Boolean(note && typeof note === "object" && typeof note.id === "string" && typeof note.body === "string" && note.body.trim() && typeof note.createdAt === "string" && Number.isFinite(Date.parse(note.createdAt)))).slice(-20).map((note) => ({ id: note.id.slice(0, 120), body: note.body.trim().slice(0, 1000), createdAt: new Date(note.createdAt).toISOString() })) : [];
  return { id: input.id.slice(0, 120), studentName: typeof input.studentName === "string" ? input.studentName.slice(0, 120) : "Local learner", title: input.title.slice(0, 240), instructions: typeof input.instructions === "string" ? input.instructions.slice(0, 1500) : "", area, itemId: typeof input.itemId === "string" ? input.itemId.slice(0, 120) : undefined, targetMinutes: typeof input.targetMinutes === "number" && Number.isFinite(input.targetMinutes) ? Math.max(0, Math.min(480, input.targetMinutes)) : 0, targetTempo: typeof input.targetTempo === "number" && Number.isFinite(input.targetTempo) ? Math.max(40, Math.min(300, input.targetTempo)) : undefined, targetScore: typeof input.targetScore === "number" && Number.isFinite(input.targetScore) ? Math.max(0, Math.min(100, input.targetScore)) : undefined, dueAt: typeof input.dueAt === "string" && Number.isFinite(Date.parse(input.dueAt)) ? new Date(input.dueAt).toISOString() : undefined, createdAt: new Date(input.createdAt).toISOString(), updatedAt: typeof input.updatedAt === "string" && Number.isFinite(Date.parse(input.updatedAt)) ? new Date(input.updatedAt).toISOString() : new Date(input.createdAt).toISOString(), completedAt: typeof input.completedAt === "string" && Number.isFinite(Date.parse(input.completedAt)) ? new Date(input.completedAt).toISOString() : undefined, feedbackAttachments: attachments, feedbackNotes };
}

function normalizeFeedbackAttachment(value: unknown): PracticeFeedbackAttachment | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PracticeFeedbackAttachment>;
  if (typeof input.id !== "string" || typeof input.label !== "string" || !input.label.trim() || typeof input.createdAt !== "string" || !Number.isFinite(Date.parse(input.createdAt))) return null;
  if (input.kind !== "audioLink" && input.kind !== "videoLink" && input.kind !== "recordingReference") return null;
  const timestamp = input.timestampSeconds;
  if (timestamp !== undefined && (!Number.isFinite(timestamp) || timestamp < 0 || timestamp > 86_400)) return null;
  const url = typeof input.url === "string" && /^https:\/\//i.test(input.url.trim()) ? input.url.trim().slice(0, 2000) : undefined;
  const recordingId = typeof input.recordingId === "string" && input.recordingId.trim() ? input.recordingId.slice(0, 160) : undefined;
  if (input.kind !== "recordingReference" && !url) return null;
  if (input.kind === "recordingReference" && !recordingId) return null;
  return { id: input.id.slice(0, 120), kind: input.kind, label: input.label.trim().slice(0, 160), url, recordingId, createdAt: new Date(input.createdAt).toISOString(), consentNote: typeof input.consentNote === "string" ? input.consentNote.trim().slice(0, 300) : "", timestampSeconds: timestamp, consent: input.consent === "shared" ? "shared" : "redacted" };
}

export function normalizePracticeResult(value: unknown): PracticeResult | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Partial<PracticeResult>;
  const seconds = input.seconds;
  if (typeof input.id !== "string" || (input.area !== "chords" && input.area !== "songs" && input.area !== "rightHand") || typeof input.itemId !== "string" || typeof input.title !== "string" || typeof input.practisedAt !== "string" || !Number.isFinite(Date.parse(input.practisedAt)) || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return null;
  const result: PracticeResult = { id: input.id.slice(0, 120), area: input.area, itemId: input.itemId.slice(0, 120), title: input.title.slice(0, 240), practisedAt: new Date(input.practisedAt).toISOString(), seconds: Math.min(86_400, seconds) };
  for (const key of ["score", "misses", "tempo", "timingEvidenceCount", "expectedTimingCount"] as const) { const candidate = input[key]; if (candidate !== undefined && Number.isFinite(candidate)) (result as unknown as Record<string, unknown>)[key] = Math.max(0, candidate); }
  if (typeof input.note === "string") result.note = input.note.slice(0, 500);
  if (typeof input.recordingId === "string" && input.recordingId.trim()) result.recordingId = input.recordingId.slice(0, 160);
  if (typeof input.reviewAccepted === "boolean") result.reviewAccepted = input.reviewAccepted;
  if (input.scoreReliability === "reliable" || input.scoreReliability === "limited" || input.scoreReliability === "insufficient") result.scoreReliability = input.scoreReliability;
  const context = input.rightHandContext;
  if (context && typeof context === "object" && Number.isFinite(context.tempo) && context.tempo >= 20 && context.tempo <= 300 && Array.isArray(context.pattern) && context.pattern.length > 0 && context.pattern.length <= 128 && context.pattern.every((token) => typeof token === "string" && token.length <= 32) && Array.isArray(context.chordProgression) && context.chordProgression.length <= 16 && context.chordProgression.every((chord) => typeof chord === "string" && chord.length <= 24) && (context.scoringMode === "timing" || context.scoringMode === "root" || context.scoringMode === "quality") && (context.instrumentProfile === "acoustic" || context.instrumentProfile === "electric") && typeof context.retained === "boolean") {
    result.rightHandContext = {
      tempo: Math.round(context.tempo),
      pattern: context.pattern.map((token) => token.slice(0, 32)),
      chordProgression: context.chordProgression.map((chord) => chord.slice(0, 24)),
      scoringMode: context.scoringMode,
      instrumentProfile: context.instrumentProfile,
      retained: context.retained
    };
  }
  return result;
}
