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
        Everything here is optional and appears on your public storefront. Leave a field blank
        and it simply won&apos;t be shown.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Profile picture URL"
          htmlFor="logoUrl"
          hint="A link to a hosted square image. Shown beside your store name."
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

        <Field
          label="Banner image URL"
          htmlFor="bannerUrl"
          hint="A wide image across the top. Only shown if your title bar is set to Banner."
        >
          <input
            id="bannerUrl"
            name="bannerUrl"
            type="url"
            placeholder="https://example.com/banner.jpg"
            defaultValue={store.bannerUrl ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="About your shop"
        htmlFor="aboutText"
        hint="The longer version, shown when a customer opens Shop info. The short description under Store settings is what appears in search results and link previews."
      >
        <textarea
          id="aboutText"
          name="aboutText"
          rows={5}
          placeholder="What you specialise in, how long you've been going, anything a customer should know before visiting."
          defaultValue={store.aboutText ?? ""}
          className={inputClass}
        />
      </Field>

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
