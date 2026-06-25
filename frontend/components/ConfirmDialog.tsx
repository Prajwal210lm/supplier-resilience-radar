"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/* An accessible confirmation dialog: role="dialog" + aria-modal + aria-labelledby,
   focus moved in on open and restored to the trigger on close, Escape to dismiss,
   and a Tab focus-trap. Transforms auto-reduce under prefers-reduced-motion via
   the app-level MotionConfig. */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  confirmLabel?: string;
  cancelLabel?: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without re-running the open/focus effect on every
  // render (updated in an effect, never mutated during render).
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const panel = panelRef.current;
    const focusables = panel?.querySelectorAll<HTMLElement>(FOCUSABLE);
    (focusables && focusables.length ? focusables[0] : panel)?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panel) {
        const f = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
          (el) => !el.hasAttribute("disabled")
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-[var(--color-line-strong)] bg-[var(--color-panel)] p-6 shadow-2xl focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 id="confirm-dialog-title" className="font-display text-xl font-semibold text-[var(--color-ink)]">
              {title}
            </h3>
            <div className="mt-3 text-sm leading-relaxed text-[var(--color-ink-2)]">{children}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm text-[var(--color-ink-2)] transition-colors hover:bg-[var(--color-raised)]"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className="rounded-lg bg-[var(--color-btn)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--color-btn-hover)]"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
