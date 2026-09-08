"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateShopDetailsAction, type FormState } from "@/lib/actions";
import type { SafeStore } from "@/lib/auth";
import { StoreInfoPreview } from "@/components/StorefrontPreview";
import { UnsavedNotice } from "@/components/UnsavedNotice";
import { storeLinks } from "@/lib/store-links";
import { useSyncedForm } from "@/lib/use-synced-form";
import { resolvePresentation } from "@/lib/theme";

const initialState: FormState = {};

const inputClass =
  "mt-1 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none";

/** Only the fields this form owns, so the preview and the dirty check stay honest. */
type Details = {
  logoUrl: string;
  bannerUrl: string;
  aboutText: string;
  websiteUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  bandcampUrl: string;
  otherUrl: string;
  otherLabel: string;
};

function detailsOf(store: SafeStore): Details {
  return {
    logoUrl: store.logoUrl ?? "",
    bannerUrl: store.bannerUrl ?? "",
    aboutText: store.aboutText ?? "",
    websiteUrl: store.websiteUrl ?? "",
    instagramUrl: store.instagramUrl ?? "",
    facebookUrl: store.facebookUrl ?? "",
    bandcampUrl: store.bandcampUrl ?? "",
    otherUrl: store.otherUrl ?? "",
    otherLabel: store.otherLabel ?? "",
  };
}

/**
 * The pictures, the story and the links, with a preview of the panel a customer
 * actually opens.
 *
 * Fields are controlled so the preview can update as they're typed, and so a
 * half-finished URL is visible as a broken picture straight away rather than
 * after a save and a trip to the storefront.
 */
export function ShopDetailsForm({ store, meta }: { store: SafeStore; meta: string }) {
  const [state, formAction] = useActionState(updateShopDetailsAction, initialState);

  const { values, set, dirty } = useSyncedForm(detailsOf(store));
  const presentation = resolvePresentation(store);

  // Blank and half-typed URLs are skipped so the preview shows what would
  // really be rendered rather than an empty pill.
  const previewLinks = storeLinks({
    websiteUrl: usable(values.websiteUrl),
    instagramUrl: usable(values.instagramUrl),
    facebookUrl: usable(values.facebookUrl),
    bandcampUrl: usable(values.bandcampUrl),
    otherUrl: usable(values.otherUrl),
    otherLabel: values.otherLabel || null,
  });

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
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
            <Input
              id="logoUrl"
              value={values.logoUrl}
              onChange={set("logoUrl")}
              placeholder="https://example.com/logo.png"
            />
          </Field>

          <Field
            label="Banner image URL"
            htmlFor="bannerUrl"
            hint="A wide image across the top. Only shown when your title bar is set to Banner."
          >
            <Input
              id="bannerUrl"
              value={values.bannerUrl}
              onChange={set("bannerUrl")}
              placeholder="https://example.com/banner.jpg"
            />
          </Field>
        </div>

        {presentation.headerStyle !== "banner" && values.bannerUrl && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your title bar is set to Compact, so this banner won&apos;t be shown. Switch it to
            Banner under Appearance to use it.
          </p>
        )}

        <Field
          label="About your shop"
          htmlFor="aboutText"
          hint="The longer version, shown when a customer opens Shop info. The short description under Store settings is what appears in search results and link previews."
        >
          <textarea
            id="aboutText"
            name="aboutText"
            rows={5}
            value={values.aboutText}
            onChange={(event) => set("aboutText")(event.target.value)}
            placeholder="What you specialise in, how long you've been going, anything a customer should know before visiting."
            className={inputClass}
          />
        </Field>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-neutral-900">Links</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website" htmlFor="websiteUrl">
              <Input
                id="websiteUrl"
                value={values.websiteUrl}
                onChange={set("websiteUrl")}
                placeholder="https://"
              />
            </Field>
            <Field label="Instagram" htmlFor="instagramUrl">
              <Input
                id="instagramUrl"
                value={values.instagramUrl}
                onChange={set("instagramUrl")}
                placeholder="https://instagram.com/"
              />
            </Field>
            <Field label="Facebook" htmlFor="facebookUrl">
              <Input
                id="facebookUrl"
                value={values.facebookUrl}
                onChange={set("facebookUrl")}
                placeholder="https://facebook.com/"
              />
            </Field>
            <Field label="Bandcamp" htmlFor="bandcampUrl">
              <Input
                id="bandcampUrl"
                value={values.bandcampUrl}
                onChange={set("bandcampUrl")}
                placeholder="https://bandcamp.com/"
              />
            </Field>
          </div>

          <div className="grid gap-4 rounded-lg border border-neutral-200 p-3 sm:grid-cols-[1fr_10rem]">
            <Field
              label="Other link"
              htmlFor="otherUrl"
              hint="Anywhere else you sell or post: Etsy, eBay, a Linktree, your label."
            >
              <Input
                id="otherUrl"
                value={values.otherUrl}
                onChange={set("otherUrl")}
                placeholder="https://"
              />
            </Field>
            <Field
              label="Call it"
              htmlFor="otherLabel"
              hint="Optional. Defaults to the site's address."
            >
              <Input
                id="otherLabel"
                type="text"
                value={values.otherLabel}
                onChange={set("otherLabel")}
                placeholder="Our Etsy"
              />
            </Field>
          </div>
        </fieldset>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <StoreInfoPreview
          theme={presentation.theme}
          accentColor={store.accentColor}
          headerStyle={presentation.headerStyle}
          storeName={store.name}
          meta={meta}
          logoUrl={usable(values.logoUrl)}
          bannerUrl={usable(values.bannerUrl)}
          aboutText={values.aboutText || null}
          links={previewLinks}
        />
        <p className="mt-2 text-xs text-neutral-500">
          This is what your details will look like when a customer opens Shop info.
        </p>
      </div>

      <div className="lg:col-span-2">
        {state.error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
        )}
        {state.success && !dirty && (
          <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            {state.success}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton />
          <UnsavedNotice dirty={dirty} />
        </div>
      </div>
    </form>
  );
}

/**
 * Whether a URL is far enough along to preview. Rendering every keystroke as an
 * image source would fire a request per character and flash a broken image
 * while someone is still typing "https:".
 */
function usable(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\/.+\..+/i.test(trimmed)) return null;
  return trimmed;
}

function Input({
  id,
  value,
  onChange,
  placeholder,
  type = "url",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      id={id}
      name={id}
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={inputClass}
    />
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
