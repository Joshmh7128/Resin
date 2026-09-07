import { requireAdmin } from "@/lib/admin/auth";
import { changeAdminPasswordAction } from "@/lib/admin/actions";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { formatRelativeTime } from "@/lib/format";

export default async function AdminAccountPage() {
  const admin = await requireAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">My account</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {admin.name} · {admin.email} · {admin.role}
          {admin.lastLoginAt && <> · last signed in {formatRelativeTime(admin.lastLoginAt)}</>}
        </p>
      </div>

      <section className="max-w-sm rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Change password</h2>
        <ActionForm action={changeAdminPasswordAction} submitLabel="Update password">
          <div>
            <label htmlFor="currentPassword" className={labelClass}>
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="newPassword" className={labelClass}>
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={12}
              autoComplete="new-password"
              className={fieldClass}
            />
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
