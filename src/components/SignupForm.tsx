"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signupAction, type FormState } from "@/lib/actions";

const initialState: FormState = {};

/**
 * Host shown in front of the store slug, so the field reads as the real
 * storefront address rather than a bare path. NEXT_PUBLIC_BASE_URL is inlined
 * at build time; if it isn't set we fall back to just the path.
 */
const storefrontPrefix = (process.env.NEXT_PUBLIC_BASE_URL ?? "")
  .replace(/^https?:\/\//, "")
  .replace(/\/+$/, "");

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Creating store…" : "Create store"}
    </button>
  );
}

export function SignupForm() {
  const [state, formAction] = useActionState(signupAction, initialState);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-neutral-700">
          Store name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          onChange={(e) => {
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="slug" className="block text-sm font-medium text-neutral-700">
          Store URL
        </label>
        <div className="mt-1 flex items-center rounded-md border border-neutral-300 focus-within:border-neutral-500">
          {/* shrink-0 and nowrap stop the prefix wrapping onto its own line. */}
          <span className="shrink-0 whitespace-nowrap pl-3 text-sm text-neutral-400">
            {storefrontPrefix}/store/
          </span>
          <input
            id="slug"
            name="slug"
            type="text"
            required
            value={slug}
            placeholder="blue-note-records"
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className="w-full min-w-0 rounded-md px-2 py-2 text-sm focus:outline-none"
          />
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          This is the address customers will scan or visit.
        </p>
      </div>
      <div>
        <label htmlFor="discogsUsername" className="block text-sm font-medium text-neutral-700">
          Discogs seller username
        </label>
        <input
          id="discogsUsername"
          name="discogsUsername"
          type="text"
          required
          placeholder="waxidermy"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-neutral-500">
          The username from your Discogs seller account. We&apos;ll pull your public
          marketplace listings from it.
        </p>
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-neutral-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-neutral-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <SubmitButton />
    </form>
  );
}
