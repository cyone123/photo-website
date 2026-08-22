"use client";

import { useActionState } from "react";
import { loginAdmin } from "@/app/admin/actions";
import { INITIAL_ADMIN_ACTION_STATE } from "./admin-action-state";
import { AdminSubmitButton } from "./admin-submit-button";

export function AdminLoginForm({ nextPath }: { nextPath?: string }) {
  const [state, action] = useActionState(loginAdmin, INITIAL_ADMIN_ACTION_STATE);

  return (
    <form className="admin-form admin-login-form" action={action}>
      <input type="hidden" name="next" value={nextPath ?? "/admin"} />

      <label className="admin-field">
        <span>管理员邮箱</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          aria-invalid={state.fieldErrors?.email ? true : undefined}
        />
        {state.fieldErrors?.email ? <small>{state.fieldErrors.email[0]}</small> : null}
      </label>

      <label className="admin-field">
        <span>密码</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.fieldErrors?.password ? true : undefined}
        />
        {state.fieldErrors?.password ? <small>{state.fieldErrors.password[0]}</small> : null}
      </label>

      {state.status === "error" ? (
        <p className="admin-form-message admin-form-message-error" role="alert">
          {state.message}
        </p>
      ) : null}

      <AdminSubmitButton pendingLabel="正在验证…">登录后台</AdminSubmitButton>
    </form>
  );
}
