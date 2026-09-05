"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateShopDetailsAction, type FormState } from "@/lib/actions";
import type { SafeStore } from "@/lib/auth";

const initialState: FormState = {};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save shop details"}
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

export function ShopDetailsForm({ store }: { store: SafeStore }) {
  const [state, formAction] = useActionState(updateShopDetailsAction, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <p className="text-sm text-neutral-600">
        Everything here is optional and appears on your public storefront. Leave a field
        blank and it simply won&apos;t be shown.
      </p>

      <Field
        label="Logo image URL"
        htmlFor="logoUrl"
        hint="A link to a hosted image. Shown beside your store name."
      >
        <input
          id="logoUrl"
          name="logoUrl"
          type="url"
          placeholder="https://example.com/logo.png"
          defaultValue={store.logoUrl ?? ""}
          className={inputClass}
        />
      </Field>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-neutral-900">Where to find you</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Street address" htmlFor="addressLine">
            <input
              id="addressLine"
              name="addressLine"
              type="text"
              placeholder="12 Bleecker Street"
              defaultValue={store.addressLine ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Town or city" htmlFor="city">
            <input
              id="city"
              name="city"
              type="text"
              placeholder="New York"
              defaultValue={store.city ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Postcode or ZIP" htmlFor="postcode">
            <input
              id="postcode"
              name="postcode"
              type="text"
              defaultValue={store.postcode ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Country" htmlFor="country">
            <input
              id="country"
              name="country"
              type="text"
              defaultValue={store.country ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={store.phone ?? ""}
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Opening hours"
          htmlFor="openingHours"
          hint="One line per day. Write it however you like, for example “Closed Mondays”."
        >
          <textarea
            id="openingHours"
            name="openingHours"
            rows={4}
            placeholder={"Mon: Closed\nTue to Sat: 11am to 7pm\nSun: 12pm to 5pm"}
            defaultValue={store.openingHours ?? ""}
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-neutral-900">Links</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Website" htmlFor="websiteUrl">
            <input
              id="websiteUrl"
              name="websiteUrl"
              type="url"
              placeholder="https://"
              defaultValue={store.websiteUrl ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Instagram" htmlFor="instagramUrl">
            <input
              id="instagramUrl"
              name="instagramUrl"
              type="url"
              placeholder="https://instagram.com/"
              defaultValue={store.instagramUrl ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Facebook" htmlFor="facebookUrl">
            <input
              id="facebookUrl"
              name="facebookUrl"
              type="url"
              placeholder="https://facebook.com/"
              defaultValue={store.facebookUrl ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Bandcamp" htmlFor="bandcampUrl">
            <input
              id="bandcampUrl"
              name="bandcampUrl"
              type="url"
              placeholder="https://bandcamp.com/"
              defaultValue={store.bandcampUrl ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <SubmitButton />
    </form>
  );
}
