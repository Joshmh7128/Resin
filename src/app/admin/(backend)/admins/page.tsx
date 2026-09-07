import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/admin/auth";
import { createAdminUserAction, setAdminActiveAction } from "@/lib/admin/actions";
import { ActionForm, fieldClass, labelClass } from "@/components/ActionForm";
import { formatRelativeTime } from "@/lib/format";

export default async function AdminUsersPage() {
  const owner = await requireOwner();
  const admins = await prisma.adminUser.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Admins</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Operators who can sign in to this backend. Owners can manage this list; admins can
          manage stores only. Deactivating takes effect on the next request, not when the
          session expires.
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 text-xs tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Last sign-in</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {admins.map((admin) => (
              <tr key={admin.id} className={admin.isActive ? "" : "opacity-50"}>
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{admin.name}</p>
                  <p className="text-xs text-neutral-500">{admin.email}</p>
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {admin.role}
                  {!admin.isActive && " · deactivated"}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {admin.lastLoginAt ? formatRelativeTime(admin.lastLoginAt) : "Never"}
                </td>
                <td className="px-4 py-3">
                  {admin.id !== owner.id && (
                    <ActionForm
                      action={setAdminActiveAction}
                      submitLabel={admin.isActive ? "Deactivate" : "Reactivate"}
                      danger={admin.isActive}
                      confirm={
                        admin.isActive
                          ? `Deactivate ${admin.email}? They lose access immediately.`
                          : undefined
                      }
                    >
                      <input type="hidden" name="adminUserId" value={admin.id} />
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Add an admin</h2>
        <p className="mt-1 mb-4 text-sm text-neutral-600">
          Choose the password here and pass it on over something you trust. They can change it
          from My account.
        </p>
        <div className="max-w-sm">
          <ActionForm action={createAdminUserAction} submitLabel="Create admin">
            <div>
              <label htmlFor="name" className={labelClass}>
                Name
              </label>
              <input id="name" name="name" type="text" required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>
                Email
              </label>
              <input id="email" name="email" type="email" required className={fieldClass} />
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="text"
                required
                minLength={12}
                autoComplete="off"
                placeholder="At least 12 characters"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="role" className={labelClass}>
                Role
              </label>
              <select id="role" name="role" defaultValue="admin" className={fieldClass}>
                <option value="admin">Admin: manage stores</option>
                <option value="owner">Owner: manage stores and admins</option>
              </select>
            </div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
