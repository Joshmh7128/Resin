"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteLocationAction, saveLocationAction, type FormState } from "@/lib/actions";
import { UnsavedNotice } from "@/components/UnsavedNotice";
import { useSyncedForm } from "@/lib/use-synced-form";
import type { StoreLocation } from "@prisma/client";

const initialState: FormState = {};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

/**
 * A shop's trading addresses.
 *
 * Plenty of shops run more than one shopfront, or a shop plus a warehouse, so
 * each address is its own record with its own opening hours rather than a single
 * set of fields. Each one is an independent form, so saving one address can't
 * disturb another that is half edited.
 */
export function LocationsManager({ locations }: { locations: StoreLocation[] }) {
  const [adding, setAdding] = useState(locations.length === 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Shown to customers under Shop info on your storefront. An online-only shop can leave
        this empty.
      </p>

      {locations.map((location) => (
        <LocationForm key={location.id} location={location} />
      ))}

      {adding ? (
        <LocationForm onCancel={locations.length > 0 ? () => setAdding(false) : undefined} />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Add another location
        </button>
      )}
    </div>
  );
}

function savedFields(location?: StoreLocation) {
  return {
    label: location?.label ?? "",
    addressLine: location?.addressLine ?? "",
    city: location?.city ?? "",
    postcode: location?.postcode ?? "",
    country: location?.country ?? "",
    phone: location?.phone ?? "",
    openingHours: location?.openingHours ?? "",
  };
}

function LocationForm({
  location,
  onCancel,
}: {
  location?: StoreLocation;
  onCancel?: () => void;
}) {
  const [state, formAction] = useActionState(saveLocationAction, initialState);
  const [deleting, setDeleting] = useState(false);
  const { values, set, dirty } = useSyncedForm(savedFields(location));
  const id = location?.id ?? "new";

  return (
    <form action={formAction} className="rounded-lg border border-neutral-200 p-4">
      {location && <input type="hidden" name="locationId" value={location.id} />}

      {state.error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && !dirty && (
        <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name for this location"
          htmlFor={`label-${id}`}
          hint="Only needed if you have more than one, e.g. Camden."
        >
          <input
            id={`label-${id}`}
            name="label"
            type="text"
            value={values.label}
            onChange={(event) => set("label")(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Street address" htmlFor={`addressLine-${id}`}>
          <input
            id={`addressLine-${id}`}
            name="addressLine"
            type="text"
            placeholder="12 Bleecker Street"
            value={values.addressLine}
            onChange={(event) => set("addressLine")(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Town or city" htmlFor={`city-${id}`}>
          <input
            id={`city-${id}`}
            name="city"
            type="text"
            placeholder="New York"
            value={values.city}
            onChange={(event) => set("city")(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Postcode or ZIP" htmlFor={`postcode-${id}`}>
          <input
            id={`postcode-${id}`}
            name="postcode"
            type="text"
            value={values.postcode}
            onChange={(event) => set("postcode")(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Country" htmlFor={`country-${id}`}>
          <input
            id={`country-${id}`}
            name="country"
            type="text"
            value={values.country}
            onChange={(event) => set("country")(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Phone" htmlFor={`phone-${id}`}>
          <input
            id={`phone-${id}`}
            name="phone"
            type="tel"
            value={values.phone}
            onChange={(event) => set("phone")(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Opening hours"
          htmlFor={`openingHours-${id}`}
          hint="One line per day. Write it however you like, for example “Closed Mondays”."
        >
          <textarea
            id={`openingHours-${id}`}
            name="openingHours"
            rows={4}
            placeholder={"Mon: Closed\nTue to Sat: 11am to 7pm\nSun: 12pm to 5pm"}
            value={values.openingHours}
            onChange={(event) => set("openingHours")(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SaveButton isNew={!location} />
        <UnsavedNotice dirty={dirty} />

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-neutral-600 underline"
          >
            Cancel
          </button>
        )}

        {location && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              try {
                await deleteLocationAction(location.id);
              } finally {
                setDeleting(false);
              }
            }}
            className="ml-auto text-sm text-red-700 underline disabled:opacity-50"
          >
            {deleting ? "Removing…" : "Remove location"}
          </button>
        )}
      </div>
    </form>
  );
}

function SaveButton({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : isNew ? "Add location" : "Save location"}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}
