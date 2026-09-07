"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

/**
 * The shape every server action in the account and admin backends returns.
 * `link` is only used by the one action that produces something to copy (a
 * password reset URL).
 */
export interface ActionFormState {
  error?: string;
  success?: string;
  link?: string;
}

export type FormAction = (
  state: ActionFormState,
  formData: FormData,
) => Promise<ActionFormState>;

/**
 * A form wrapped around a server action, with its pending state, error, and
 * success message handled once.
 *
 * The admin backend is mostly forms: a dozen of them on the store detail page
 * alone. Each one only differs by its action, its fields, and its button, so
 * they are passed in and everything else is shared. Fields come through
 * `children` as server-rendered nodes, which keeps the pages themselves plain
 * server components.
 */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  confirm,
  danger = false,
  children,
  className = "",
}: {
  action: FormAction;
  submitLabel: string;
  pendingLabel?: string;
  /** Shown in a browser confirm dialog before an irreversible submit. */
  confirm?: string;
  danger?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className={`space-y-3 ${className}`}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}
      {state.link && (
        <p className="rounded-md bg-neutral-100 px-3 py-2 font-mono text-xs break-all text-neutral-700">
          {state.link}
        </p>
      )}
      {children}
      <SubmitButton label={submitLabel} pendingLabel={pendingLabel} danger={danger} />
    </form>
  );
}

function SubmitButton({
  label,
  pendingLabel,
  danger,
}: {
  label: string;
  pendingLabel?: string;
  danger: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
        danger
          ? "border border-red-300 text-red-700 hover:bg-red-50"
          : "border border-neutral-300 text-neutral-900 hover:bg-neutral-100"
      }`}
    >
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </button>
  );
}

export const fieldClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

export const labelClass = "block text-sm font-medium text-neutral-700";
