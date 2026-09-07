import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/actions";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Resin
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Reset your password</h1>
          <p className="mt-2 text-sm text-neutral-600">
            We&apos;ll email you a link to choose a new one. It works once and expires in an hour.
          </p>
        </div>

        <ActionForm
          action={requestPasswordResetAction}
          submitLabel="Send reset link"
          pendingLabel="Sending…"
        >
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className={fieldClass}
            />
          </div>
        </ActionForm>

        <p className="mt-6 text-center text-sm text-neutral-600">
          <Link href="/login" className="underline">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
}
