import type { ReactNode } from "react";

type BadgeTone = "success" | "danger" | "info" | "warning" | "neutral";

/**
 * Status label in the same style as the clients screen: a small rounded pill
 * with a tinted background and colored text. The color is decorative only —
 * the text always states the meaning, so no extra aria is needed.
 */
const TONE_CLASSES: Record<BadgeTone, string> = {
  success: "bg-tp-green-500/10 text-tp-green-600",
  danger: "bg-tp-danger/10 text-tp-danger",
  info: "bg-tp-blue-500/10 text-tp-blue-900",
  warning: "bg-tp-warning/10 text-tp-warning",
  neutral: "bg-tp-neutral-500/10 text-tp-neutral-700",
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}