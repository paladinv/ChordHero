export type ParticipantValidationSample = {
  participantId: string;
  sessionId: string;
  split: "calibration" | "validation" | "held-out";
  file: string;
  device: string;
  guitar: string;
  microphone: string;
  environment: string;
  tuning: string;
  capo: number;
  consent: { granted: true; scope: "local-participant-validation"; source: string; date: string };
};
const VALID_SPLITS = ["calibration", "validation", "held-out"] as const;
type ValidationSplit = (typeof VALID_SPLITS)[number];

export function parseParticipantValidationManifest(value: unknown): ParticipantValidationSample[] {
  const manifest = value as { version?: number; samples?: ParticipantValidationSample[] };
  if (manifest?.version !== 1 || !Array.isArray(manifest.samples) || manifest.samples.length < 3 || manifest.samples.length > 120) throw new Error("Participant validation manifest v1 must contain 3–120 samples.");
  const samples = manifest.samples.map((sample) => {
    const split = sample?.split;
    const consent = sample?.consent;
    if (!sample || typeof sample.participantId !== "string" || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(sample.participantId) || typeof sample.sessionId !== "string" || !/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(sample.sessionId) || !VALID_SPLITS.includes(split as ValidationSplit) || typeof sample.file !== "string" || !sample.file.trim() || typeof sample.device !== "string" || !sample.device.trim() || typeof sample.guitar !== "string" || !sample.guitar.trim() || typeof sample.microphone !== "string" || !sample.microphone.trim() || typeof sample.environment !== "string" || !sample.environment.trim() || typeof sample.tuning !== "string" || !sample.tuning.trim() || !Number.isFinite(sample.capo) || sample.capo < 0 || sample.capo > 24 || !consent || consent.granted !== true || consent.scope !== "local-participant-validation" || typeof consent.source !== "string" || !consent.source.trim() || !Number.isFinite(Date.parse(consent.date))) throw new Error("Each participant sample needs pseudonymous IDs, a split, device/guitar/microphone/environment setup and explicit local validation consent.");
    const normalized: ParticipantValidationSample = { participantId: sample.participantId, sessionId: sample.sessionId, split: split as ValidationSplit, file: sample.file.trim(), device: sample.device.trim().slice(0, 120), guitar: sample.guitar.trim().slice(0, 120), microphone: sample.microphone.trim().slice(0, 120), environment: sample.environment.trim().slice(0, 120), tuning: sample.tuning.trim().slice(0, 40), capo: Math.round(sample.capo), consent: { granted: true, scope: "local-participant-validation", source: consent.source.trim().slice(0, 120), date: new Date(consent.date).toISOString().slice(0, 10) } };
    return normalized;
  });
  if (new Set(samples.map((sample) => sample.file)).size !== samples.length) throw new Error("Participant validation filenames must be unique.");
  return samples;
}

export function validateParticipantValidationProtocol(samples: readonly ParticipantValidationSample[]) {
  const participants = [...new Set(samples.map((sample) => sample.participantId))];
  const sessions = [...new Set(samples.map((sample) => sample.sessionId))];
  const heldOutParticipants = new Set(samples.filter((sample) => sample.split === "held-out").map((sample) => sample.participantId));
  const participantSplits = new Map<string, Set<ParticipantValidationSample["split"]>>();
  const sessionSplits = new Map<string, Set<ParticipantValidationSample["split"]>>();
  const sessionParticipants = new Map<string, Set<string>>();
  samples.forEach((sample) => participantSplits.set(sample.participantId, new Set([...(participantSplits.get(sample.participantId) ?? []), sample.split])));
  samples.forEach((sample) => {
    sessionSplits.set(sample.sessionId, new Set([...(sessionSplits.get(sample.sessionId) ?? []), sample.split]));
    sessionParticipants.set(sample.sessionId, new Set([...(sessionParticipants.get(sample.sessionId) ?? []), sample.participantId]));
  });
  const splitDisjoint = [...participantSplits.values()].every((splits) => splits.size === 1);
  const sessionDisjoint = [...sessionSplits.values()].every((splits) => splits.size === 1) && [...sessionParticipants.values()].every((participants) => participants.size === 1);
  const splitCounts = { calibration: samples.filter((sample) => sample.split === "calibration").length, validation: samples.filter((sample) => sample.split === "validation").length, "held-out": samples.filter((sample) => sample.split === "held-out").length };
  const setupCoverage = { devices: new Set(samples.map((sample) => sample.device)).size, guitars: new Set(samples.map((sample) => sample.guitar)).size, microphones: new Set(samples.map((sample) => sample.microphone)).size, environments: new Set(samples.map((sample) => sample.environment)).size, tunings: new Set(samples.map((sample) => sample.tuning)).size };
  return {
    participantCount: participants.length,
    sessionCount: sessions.length,
    heldOutParticipantCount: heldOutParticipants.size,
    valid: samples.length >= 3 && sessions.length >= 2 && Object.values(splitCounts).every((count) => count > 0) && heldOutParticipants.size > 0 && splitDisjoint && sessionDisjoint,
    participantIds: participants,
    splitCounts,
    splitDisjoint,
    sessionDisjoint,
    setupCoverage
  };
}
