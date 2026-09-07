import { requireStore } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/SettingsForm";
import { AppearanceForm } from "@/components/AppearanceForm";
import { ShopDetailsForm } from "@/components/ShopDetailsForm";
import { LocationsManager } from "@/components/LocationsManager";
import { PasswordForm } from "@/components/PasswordForm";

export default async function SettingsPage() {
  const store = await requireStore();
  const locations = await prisma.storeLocation.findMany({
    where: { storeId: store.id },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Store settings</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Manage your storefront profile and Discogs connection.
        </p>
      </div>

      <Panel title="Store settings">
        <SettingsForm store={store} />
      </Panel>

      <Panel
        title="Appearance"
        blurb="Choose how your storefront looks and how customers browse it by default."
      >
        <AppearanceForm store={store} />
      </Panel>

      <Panel
        title="Shop details"
        blurb="Your pictures, the story of your shop, and where to find you online."
      >
        <ShopDetailsForm store={store} />
      </Panel>

      <Panel title="Locations">
        <LocationsManager locations={locations} />
      </Panel>

      <Panel title="Change password">
        <PasswordForm />
      </Panel>
    </div>
  );
}

function Panel({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      {blurb && <p className="mb-4 mt-1 text-sm text-neutral-600">{blurb}</p>}
      <div className={blurb ? "" : "mt-4"}>{children}</div>
    </section>
  );
}
