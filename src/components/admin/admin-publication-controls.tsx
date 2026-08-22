"use client";

import { useActionState } from "react";
import { publishAlbumAction, unpublishAlbumAction } from "@/app/admin/actions";
import { INITIAL_ADMIN_ACTION_STATE } from "./admin-action-state";
import { AdminSubmitButton } from "./admin-submit-button";

export function AdminPublicationControls({
  id,
  status,
}: {
  id: string;
  status: "DRAFT" | "PUBLISHED";
}) {
  const action = status === "PUBLISHED" ? unpublishAlbumAction : publishAlbumAction;
  const [state, formAction] = useActionState(action, INITIAL_ADMIN_ACTION_STATE);

  return (
    <form className="admin-publication-form" action={formAction}>
      <input type="hidden" name="id" value={id} />
      <AdminSubmitButton
        variant={status === "PUBLISHED" ? "danger" : "primary"}
        pendingLabel={status === "PUBLISHED" ? "正在取消发布…" : "正在发布…"}
      >
        {status === "PUBLISHED" ? "取消发布" : "发布相册"}
      </AdminSubmitButton>
      {state.message ? (
        <p
          className={`admin-form-message admin-form-message-${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
