import Link from "next/link";
import { resetPasswordAction } from "@/lib/actions";
import { resolvePasswordResetToken } from "@/lib/password-reset";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // Checked before the form is drawn, so a dead link says so straight away
  // rather than after someone has typed a new password twice.
  const target = token ? await resolvePasswordResetToken(token) : null;

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Resin
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Choose a new password</h1>
        </div>

        {!target ? (
          <div className="space-y-4 text-center">
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              This reset link is invalid, already used, or expired.
            </p>
            <Link href="/forgot-password" className="text-sm underline">
              Send a new one
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-4 text-center text-sm text-neutral-600">
              Setting a new password for {target.email}.
            </p>
            <ActionForm
              action={resetPasswordAction}
              submitLabel="Set password"
              pendingLabel="Saving…"
            >
              <input type="hidden" name="token" value={token} />
              <div>
                <label htmlFor="newPassword" className={labelClass}>
                  New password
                </label>
                <input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={fieldClass}
                />
              </div>
            </ActionForm>
          </>
        )}
      </div>
    </div>
  );
}
