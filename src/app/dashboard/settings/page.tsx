import { requireStore } from "@/lib/auth";
import { SettingsForm } from "@/components/SettingsForm";
import { PasswordForm } from "@/components/PasswordForm";

export default async function SettingsPage() {
  const store = await requireStore();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Store settings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Manage your storefront profile and Discogs connection.
        </p>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <SettingsForm store={store} />
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Change password</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
