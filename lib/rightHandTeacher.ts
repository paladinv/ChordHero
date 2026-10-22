import type { PracticeAssignment, PracticeFeedbackAttachment, PracticeResult } from "./practicePlatform";

export type TeacherExportOptions = { redactIdentity?: boolean; includeSharedAttachments?: boolean };

/** A safe, portable teacher packet. Audio/video bytes are never included. */
export function rightHandTeacherExport(assignments: readonly PracticeAssignment[], events: readonly PracticeResult[], options: TeacherExportOptions = {}) {
  const redactIdentity = options.redactIdentity !== false;
  const includeSharedAttachments = options.includeSharedAttachments === true;
  return {
    schema: "chord-hero:right-hand-teacher:v2",
    exportedAt: new Date().toISOString(),
    identity: redactIdentity ? { student: "redacted" } : undefined,
    assignments: assignments.filter((assignment) => assignment.area === "rightHand").map((assignment) => ({
      id: assignment.id,
      student: redactIdentity ? "redacted" : assignment.studentName,
      title: assignment.title,
      instructions: assignment.instructions,
      itemId: assignment.itemId,
      targetMinutes: assignment.targetMinutes,
      targetTempo: assignment.targetTempo,
      targetScore: assignment.targetScore,
      dueAt: assignment.dueAt,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      feedbackAttachments: (assignment.feedbackAttachments ?? []).map((attachment) => redactAttachment(attachment, includeSharedAttachments)),
      feedbackNotes: assignment.feedbackNotes ?? []
    })),
    results: events.filter((event) => event.area === "rightHand" && event.recordingId && event.reviewAccepted === true && Number.isFinite(event.score)).map((event) => ({
      itemId: event.itemId, title: event.title, practisedAt: event.practisedAt, seconds: event.seconds, score: event.score, misses: event.misses, tempo: event.tempo,
      evidence: event.scoreReliability ?? "recorded", timingEvidenceCount: event.timingEvidenceCount, expectedTimingCount: event.expectedTimingCount
    }))
  };
}

function redactAttachment(attachment: PracticeFeedbackAttachment, includeShared: boolean) {
  const base = { id: attachment.id, kind: attachment.kind, label: attachment.label, createdAt: attachment.createdAt, timestampSeconds: attachment.timestampSeconds, consent: attachment.consent === "shared" && includeShared ? "shared" as const : "redacted" as const, consentNote: attachment.consentNote };
  if (base.consent !== "shared") return base;
  return { ...base, url: attachment.url, recordingId: attachment.recordingId };
}

export function feedbackAttachmentFromInput(input: { kind: PracticeFeedbackAttachment["kind"]; label: string; url?: string; recordingId?: string; timestampSeconds?: number; consentNote?: string; consent: "shared" | "redacted" }): PracticeFeedbackAttachment | null {
  const label = input.label.trim();
  if (!label || !Number.isFinite(input.timestampSeconds ?? 0) || (input.timestampSeconds ?? 0) < 0 || (input.timestampSeconds ?? 0) > 86_400) return null;
  if (input.kind === "recordingReference" ? !input.recordingId?.trim() : !/^https:\/\//i.test(input.url?.trim() ?? "")) return null;
  return { id: globalThis.crypto?.randomUUID?.() ?? `attachment-${Date.now()}`, kind: input.kind, label: label.slice(0, 160), url: input.kind === "recordingReference" ? undefined : input.url!.trim().slice(0, 2000), recordingId: input.kind === "recordingReference" ? input.recordingId!.trim().slice(0, 160) : undefined, createdAt: new Date().toISOString(), timestampSeconds: input.timestampSeconds ?? 0, consentNote: input.consentNote?.trim().slice(0, 300) ?? "", consent: input.consent };
}
