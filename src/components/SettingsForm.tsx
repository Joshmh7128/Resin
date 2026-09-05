"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateSettingsAction, type FormState } from "@/lib/actions";
import type { SafeStore } from "@/lib/auth";

const initialState: FormState = {};

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

export function SettingsForm({ store }: { store: SafeStore }) {
  const [state, formAction] = useActionState(updateSettingsAction, initialState);

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Store name" htmlFor="name">
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={store.name}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </Field>
        <Field label="Store URL" htmlFor="slug" hint="resin.app/store/your-slug">
          <input id="slug" name="slug" type="text" required defaultValue={store.slug} className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none" />
        </Field>
        <Field label="Discogs username" htmlFor="discogsUsername">
          <input
            id="discogsUsername"
            name="discogsUsername"
            type="text"
            required
            defaultValue={store.discogsUsername}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </Field>
        <Field
          label="Discogs personal access token"
          htmlFor="discogsToken"
          hint="Optional — raises API rate limits. Generate one in Discogs Settings → Developers."
        >
          <input
            id="discogsToken"
            name="discogsToken"
            type="text"
            defaultValue={store.discogsToken ?? ""}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </Field>
        <Field label="Currency code" htmlFor="currency" hint="e.g. USD, EUR, GBP">
          <input
            id="currency"
            name="currency"
            type="text"
            required
            defaultValue={store.currency}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
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
            defaultValue={store.itemsPerPage}
            className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
          />
        </Field>
        <Field label="Accent color" htmlFor="accentColor">
          <input
            id="accentColor"
            name="accentColor"
            type="color"
            defaultValue={store.accentColor}
            className="h-10 w-20 rounded-md border border-neutral-300"
          />
        </Field>
      </div>

      <Field label="Description" htmlFor="description" hint="Shown at the top of your storefront">
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={store.description ?? ""}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </Field>

      <SubmitButton />

    </form>
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
