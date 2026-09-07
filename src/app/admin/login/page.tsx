import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin/auth";
import { adminLoginAction } from "@/lib/admin/actions";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";

export const metadata = {
  title: "Admin sign in",
  // Nothing here should be indexed, and the backend is not linked from
  // anywhere public, so this is the only place the crawler could find it.
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect("/admin");

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold text-neutral-900">Resin admin</h1>
      <p className="mt-1 mb-6 text-sm text-neutral-600">
        Operator access. Store owners sign in at <code>/login</code>.
      </p>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <ActionForm action={adminLoginAction} submitLabel="Sign in" pendingLabel="Signing in…">
          <div>
            <label htmlFor="email" className={labelClass}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={fieldClass}
            />
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
