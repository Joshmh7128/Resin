"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSettingsAction, type FormState } from "@/lib/actions";
import type { SafeStore } from "@/lib/auth";
import { UnsavedNotice } from "@/components/UnsavedNotice";
import { useSyncedForm } from "@/lib/use-synced-form";

const initialState: FormState = {};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

function saved(store: SafeStore) {
  return {
    name: store.name,
    slug: store.slug,
    discogsUsername: store.discogsUsername,
    discogsToken: store.discogsToken ?? "",
    currency: store.currency,
    itemsPerPage: String(store.itemsPerPage),
    description: store.description ?? "",
  };
}

export function SettingsForm({ store }: { store: SafeStore }) {
  const [state, formAction] = useActionState(updateSettingsAction, initialState);
  const { values, set, dirty } = useSyncedForm(saved(store));

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && !dirty && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Store name" htmlFor="name">
          <input
            id="name"
            name="name"
            type="text"
            required
            value={values.name}
            onChange={(event) => set("name")(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Store URL" htmlFor="slug" hint={`resinrecordstore.com/store/${values.slug || "your-shop"}`}>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            value={values.slug}
            onChange={(event) => set("slug")(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Discogs username" htmlFor="discogsUsername">
          <input
            id="discogsUsername"
            name="discogsUsername"
            type="text"
            required
            value={values.discogsUsername}
            onChange={(event) => set("discogsUsername")(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Discogs personal access token"
          htmlFor="discogsToken"
          hint="Optional. Raises your Discogs API rate limit. Generate one under Settings, then Developers, on Discogs."
        >
          <input
            id="discogsToken"
            name="discogsToken"
            type="text"
            value={values.discogsToken}
            onChange={(event) => set("discogsToken")(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Currency code" htmlFor="currency" hint="e.g. USD, EUR, GBP">
          <input
            id="currency"
            name="currency"
            type="text"
            required
            value={values.currency}
            onChange={(event) => set("currency")(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Items per page" htmlFor="itemsPerPage">
          <input
            id="itemsPerPage"
            name="itemsPerPage"
            type="number"
            min={6}
            max={96}
            required
            value={values.itemsPerPage}
            onChange={(event) => set("itemsPerPage")(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Description"
        htmlFor="description"
        hint="One or two lines, used for search results and link previews. The longer story goes under Shop details."
      >
        <textarea
          id="description"
          name="description"
          rows={3}
          value={values.description}
          onChange={(event) => set("description")(event.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton />
        <UnsavedNotice dirty={dirty} />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save settings"}
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
