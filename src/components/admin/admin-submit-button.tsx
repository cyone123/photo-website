"use client";

import { useFormStatus } from "react-dom";

export function AdminSubmitButton({
  children,
  pendingLabel = "正在保存…",
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "danger" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <button className={`admin-button admin-button-${variant}`} type="submit" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
