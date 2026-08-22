"use client";

import { useActionState, useState } from "react";
import { createAlbumAction, updateAlbumAction } from "@/app/admin/actions";
import { INITIAL_ADMIN_ACTION_STATE } from "./admin-action-state";
import { AdminSubmitButton } from "./admin-submit-button";

export interface AdminAlbumFormValues {
  id?: string;
  title: string;
  slug: string;
  description: string;
  shootingContext: string;
  status?: "DRAFT" | "PUBLISHED";
}

export function AdminAlbumForm({ values }: { values?: AdminAlbumFormValues }) {
  const action = values?.id ? updateAlbumAction : createAlbumAction;
  const [state, formAction] = useActionState(action, INITIAL_ADMIN_ACTION_STATE);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const slugLocked = values?.status === "PUBLISHED";

  async function checkSlug(event: React.FocusEvent<HTMLInputElement>) {
    if (slugLocked || !event.currentTarget.value.trim()) {
      return;
    }

    setSlugStatus("checking");
    const query = new URLSearchParams({ slug: event.currentTarget.value });

    if (values?.id) {
      query.set("excludeId", values.id);
    }

    try {
      const response = await fetch(`/api/admin/albums/slug?${query}`, { cache: "no-store" });
      const result: unknown = await response.json();
      const available =
        response.ok &&
        typeof result === "object" &&
        result !== null &&
        "available" in result &&
        result.available === true;
      setSlugStatus(available ? "available" : "taken");
    } catch {
      setSlugStatus("idle");
    }
  }

  return (
    <form className="admin-form admin-album-form" action={formAction}>
      {values?.id ? <input type="hidden" name="id" value={values.id} /> : null}

      <label className="admin-field">
        <span>相册标题</span>
        <input
          name="title"
          defaultValue={values?.title}
          maxLength={120}
          required
          aria-invalid={state.fieldErrors?.title ? true : undefined}
        />
        {state.fieldErrors?.title ? <small>{state.fieldErrors.title[0]}</small> : null}
      </label>

      <label className="admin-field">
        <span>Slug</span>
        <input
          name="slug"
          defaultValue={values?.slug}
          maxLength={120}
          required
          readOnly={slugLocked}
          onBlur={checkSlug}
          aria-describedby="admin-slug-help"
          aria-invalid={state.fieldErrors?.slug || slugStatus === "taken" ? true : undefined}
        />
        <small id="admin-slug-help">
          {slugLocked
            ? "已发布相册的 slug 已锁定。"
            : slugStatus === "checking"
              ? "正在检查…"
              : slugStatus === "available"
                ? "此 slug 可以使用。"
                : slugStatus === "taken"
                  ? "此 slug 已被使用。"
                  : "支持中文、字母和数字，其他字符会转换为连字符。"}
        </small>
        {state.fieldErrors?.slug ? <small>{state.fieldErrors.slug[0]}</small> : null}
      </label>

      <label className="admin-field">
        <span>相册简介</span>
        <textarea name="description" defaultValue={values?.description} rows={4} maxLength={1000} />
        {state.fieldErrors?.description ? <small>{state.fieldErrors.description[0]}</small> : null}
      </label>

      <label className="admin-field">
        <span>拍摄背景</span>
        <textarea
          name="shootingContext"
          defaultValue={values?.shootingContext}
          rows={8}
          maxLength={5000}
        />
        {state.fieldErrors?.shootingContext ? (
          <small>{state.fieldErrors.shootingContext[0]}</small>
        ) : null}
      </label>

      {state.message ? (
        <p
          className={`admin-form-message admin-form-message-${state.status}`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}

      <AdminSubmitButton>{values?.id ? "保存相册" : "创建草稿相册"}</AdminSubmitButton>
    </form>
  );
}
