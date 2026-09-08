import { requireStore } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { storeMeta } from "@/lib/format";
import { SettingsForm } from "@/components/SettingsForm";
import { AppearanceSections } from "@/components/AppearanceForm";
import { ShopDetailsForm } from "@/components/ShopDetailsForm";
import { LocationsManager } from "@/components/LocationsManager";
import { PasswordForm } from "@/components/PasswordForm";

export default async function SettingsPage() {
  const store = await requireStore();

  const [locations, itemCount] = await Promise.all([
    prisma.storeLocation.findMany({
      where: { storeId: store.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.inventoryItem.count({ where: { storeId: store.id, isVisible: true } }),
  ]);

  // The line under the shop name in the previews. Built here rather than in the
  // previews themselves for two reasons: it should say what the real storefront
  // says, and `formatRelativeTime` reads the clock, which would risk a
  // hydration mismatch if it ran inside a client component.
  const previewMeta = storeMeta(itemCount, store.lastSyncAt);

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

      <div>
        <h2 className="text-xl font-bold text-neutral-900">Appearance</h2>
        <p className="mb-4 mt-1 text-sm text-neutral-600">
          How your storefront looks and how customers browse it by default. Each section saves on
          its own, and the preview beside it shows the change before you commit to it.
        </p>
        <AppearanceSections store={store} meta={previewMeta} />
      </div>

      <Panel
        title="Shop details"
        blurb="Your pictures, the story of your shop, and where to find you online."
      >
        <ShopDetailsForm store={store} meta={previewMeta} />
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
