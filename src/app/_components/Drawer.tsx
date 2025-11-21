"use client";
import { useEffect, useRef } from "react";
import styles from "./drawer.module.css";

export default function Drawer({
  open,
  onClose,
  children,
  ariaLabel = "Details",
  side = "right",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
  side?: "right" | "left";
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        className={`${styles.overlay} ${open ? styles.open : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <div
        className={[
          styles.panel,
          open ? styles.open : "",
          side === "left" ? styles.left : styles.right,
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        ref={ref}
      >
        {children}
      </div>
    </>
  );
}
