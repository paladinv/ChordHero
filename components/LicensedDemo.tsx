"use client";

import { FormEvent, useEffect, useState } from "react";

export type DemoSource = {
  id: string;
  technique: "strumming" | "plectrum" | "fingerpicking";
  src: string;
  title: string;
  creator: string;
  licence: string;
  attributionURL: string;
  captionsURL?: string;
  transcript?: string;
  leftHandedSrc?: string;
};

type Props = { technique: DemoSource["technique"]; source?: DemoSource };
const STORAGE_KEY = "chord-hero:right-hand:licensed-demo-registry:v1";
const httpsURL = (value: string) => /^https?:\/\//i.test(value.trim());
const emptyForm = { src: "", title: "", creator: "", licence: "", attributionURL: "", captionsURL: "", transcript: "", leftHandedSrc: "" };

function readRegistry() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as DemoSource[]; } catch { return []; } }

export default function LicensedDemo({ technique, source }: Props) {
  const [registry, setRegistry] = useState<DemoSource[]>([]);
  const [selectedId, setSelectedId] = useState(source?.id ?? "");
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("Only import footage you have permission to use.");
  const [leftHanded, setLeftHanded] = useState(false);
  useEffect(() => {
    setRegistry(readRegistry());
    try { setLeftHanded(JSON.parse(localStorage.getItem("chord-hero:practice-platform:v1") ?? "null")?.accessibility?.handedness === "left"); } catch { /* no-op */ }
  }, []);
  const available = [source, ...registry].filter((item): item is DemoSource => Boolean(item) && item!.technique === technique);
  const selected = available.find((item) => item.id === selectedId) ?? available[0];
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const importSource = (event: FormEvent) => {
    event.preventDefault();
    if (!httpsURL(form.src) || !httpsURL(form.attributionURL) || !form.title.trim() || !form.creator.trim() || !form.licence.trim()) { setMessage("Video URL, title, creator, licence, and HTTP(S) attribution URL are required."); return; }
    if (form.captionsURL && !httpsURL(form.captionsURL)) { setMessage("Captions URL must use HTTP(S)."); return; }
    if (form.leftHandedSrc && !httpsURL(form.leftHandedSrc)) { setMessage("Left-handed variant URL must use HTTP(S)."); return; }
    const next: DemoSource = { id: crypto.randomUUID(), technique, ...form, title: form.title.trim(), creator: form.creator.trim(), licence: form.licence.trim(), transcript: form.transcript.trim() || undefined, captionsURL: form.captionsURL.trim() || undefined, leftHandedSrc: form.leftHandedSrc.trim() || undefined };
    const all = [...registry, next].slice(-24); localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); setRegistry(all); setSelectedId(next.id); setForm(emptyForm); setMessage("Approved-source metadata saved on this device. Chord Hero does not verify or host the footage.");
  };
  return <div className="licensed-demo-manager">
    {available.length ? <label>Approved demonstration<select value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>{available.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.creator}</option>)}</select></label> : null}
    {selected ? <figure className={`licensed-demo ${leftHanded && !selected.leftHandedSrc ? "mirrored" : ""}`}>
      <video controls playsInline preload="metadata" src={leftHanded && selected.leftHandedSrc ? selected.leftHandedSrc : selected.src} aria-label={`${leftHanded ? "Left-handed" : "Right-handed"} ${technique} close-up demonstration`}>{selected.captionsURL ? <track kind="captions" src={selected.captionsURL} srcLang="en" label="English" default /> : null}</video>
      <figcaption>{selected.title} · {selected.creator} · {selected.licence} · <a href={selected.attributionURL} target="_blank" rel="noreferrer">Attribution</a>{leftHanded && !selected.leftHandedSrc ? " · visually mirrored" : ""}</figcaption>
      {selected.transcript ? <details><summary>Transcript</summary><p>{selected.transcript}</p></details> : null}
    </figure> : <div className="licensed-demo-placeholder" role="note"><strong>Video awaiting licensed source</strong><p>The animated close-up remains available offline. Add rights-cleared media metadata below; Chord Hero does not provide or fabricate footage.</p></div>}
    <details className="licensed-demo-import"><summary>Import approved video metadata</summary><form onSubmit={importSource}>
      <label>Video URL<input type="url" value={form.src} onChange={(event) => update("src", event.target.value)} placeholder="https://…" required /></label><label>Title<input value={form.title} onChange={(event) => update("title", event.target.value)} required /></label><label>Creator<input value={form.creator} onChange={(event) => update("creator", event.target.value)} required /></label><label>Licence<input value={form.licence} onChange={(event) => update("licence", event.target.value)} placeholder="CC BY 4.0 or permission reference" required /></label><label>Attribution URL<input type="url" value={form.attributionURL} onChange={(event) => update("attributionURL", event.target.value)} placeholder="https://…" required /></label><label>Captions URL<input type="url" value={form.captionsURL} onChange={(event) => update("captionsURL", event.target.value)} placeholder="Optional WebVTT URL" /></label><label>Left-handed variant<input type="url" value={form.leftHandedSrc} onChange={(event) => update("leftHandedSrc", event.target.value)} placeholder="Optional HTTPS video URL" /></label><label>Transcript<textarea value={form.transcript} onChange={(event) => update("transcript", event.target.value)} rows={4} placeholder="Optional accessible transcript" /></label><button type="submit">Save approved-source metadata</button>
    </form></details><p className="licensed-demo-status" role="status">{message}</p>
  </div>;
}
