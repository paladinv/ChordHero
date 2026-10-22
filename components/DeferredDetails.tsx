"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export default function DeferredDetails({ summary, children, className }: { summary: ReactNode; children: ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  return <details className={className} onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{summary}</summary>{open ? children : null}</details>;
}
