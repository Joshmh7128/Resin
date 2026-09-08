"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateAppearanceAction, type FormState } from "@/lib/actions";
import type { SafeStore } from "@/lib/auth";
import { StorefrontPreview, type PreviewOptions } from "@/components/StorefrontPreview";
import { UnsavedNotice } from "@/components/UnsavedNotice";
import {
  FEATURED_LAYOUTS,
  HEADER_STYLES,
  LAYOUTS,
  THEMES,
  accentForeground,
  resolvePresentation,
  themeOption,
} from "@/lib/theme";

/**
 * How a shop's storefront looks.
 *
 * Split into one section per decision, each with its own save button, because
 * they are decisions people make at different times: a shop settles on a theme
 * once and then comes back months later to try cover flow. One big form would
 * mean re-saving everything to change one thing, and would make the preview
 * ambiguous about which change it was showing.
 *
 * Every control is deliberately controlled rather than left uncontrolled with a
 * `defaultChecked`. React resets a form's uncontrolled fields once its action
 * finishes, and the fresh values only arrive a moment later when the page
 * revalidates, so the selection would visibly snap back to the old option
 * before correcting itself.
 */
export function AppearanceSections({ store, meta }: { store: SafeStore; meta: string }) {
  const saved = resolvePresentation(store);

  const base = {
    theme: saved.theme,
    headerStyle: saved.headerStyle,
    defaultLayout: saved.defaultLayout,
    featuredLayout: saved.featuredLayout,
    accentColor: store.accentColor,
    storeName: store.name,
    meta,
    logoUrl: store.logoUrl,
    bannerUrl: store.bannerUrl,
  } satisfies PreviewOptions;

  return (
    <div className="space-y-8">
      <ThemeSection store={store} base={base} />

      <ChoiceSection
        name="headerStyle"
        title="Title bar"
        blurb="How the top of your storefront is laid out. A banner needs a banner image, which you set under Shop details."
        options={HEADER_STYLES}
        savedValue={saved.headerStyle}
        base={base}
      />

      <ChoiceSection
        name="defaultLayout"
        title="Default layout"
        blurb="What customers see first. They can switch layouts themselves, and their choice travels in the link they share."
        options={LAYOUTS}
        savedValue={saved.defaultLayout}
        base={base}
      />

      <ChoiceSection
        name="featuredLayout"
        title="Featured section"
        blurb="How your featured picks are shown above the catalogue."
        options={FEATURED_LAYOUTS}
        savedValue={saved.featuredLayout}
        base={base}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ThemeSection({ store, base }: { store: SafeStore; base: PreviewOptions }) {
  const savedTheme = base.theme;
  const savedAccent = store.accentColor;

  const [theme, setTheme] = useState(savedTheme);
  const [accent, setAccent] = useState(savedAccent);

  // Re-sync once a save lands and new values arrive from the server, which is
  // also what clears the unsaved-changes notice.
  const [seen, setSeen] = useState(`${savedTheme}|${savedAccent}`);
  if (seen !== `${savedTheme}|${savedAccent}`) {
    setSeen(`${savedTheme}|${savedAccent}`);
    setTheme(savedTheme);
    setAccent(savedAccent);
  }

  const chosen = themeOption(theme);
  const previewAccent = chosen.forcedAccent ?? accent;
  const dirty = theme !== savedTheme || accent !== savedAccent;

  return (
    <Section
      title="Colour theme"
      blurb="Applies to your storefront only. Your dashboard stays as it is."
      dirty={dirty}
      preview={{ ...base, theme, accentColor: accent }}
    >
      <input type="hidden" name="theme" value={theme} />
      <input type="hidden" name="accentColor" value={accent} />

      <div className="grid gap-2 sm:grid-cols-2">
        {THEMES.map((option) => (
          <OptionCard
            key={option.id}
            selected={theme === option.id}
            onSelect={() => setTheme(option.id)}
            title={option.label}
            description={option.description}
            swatch={
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-neutral-300"
                style={{ backgroundColor: option.swatch.bg }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
                  style={{ backgroundColor: option.swatch.surface, color: option.swatch.fg }}
                >
                  Aa
                </span>
              </span>
            }
          />
        ))}
      </div>

      <div className="mt-4">
        <label htmlFor="accentPicker" className="block text-sm font-medium text-neutral-700">
          Accent colour
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <input
            id="accentPicker"
            type="color"
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            className="h-10 w-16 rounded-md border border-neutral-300"
          />
          <span
            className="rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: previewAccent, color: accentForeground(previewAccent) }}
          >
            Buttons look like this
          </span>
        </div>
        {chosen.forcedAccent && (
          <p className="mt-1 text-xs text-neutral-500">
            Monochrome ignores the accent colour. Yours is kept for when you switch back.
          </p>
        )}
      </div>
    </Section>
  );
}

function ChoiceSection<T extends string>({
  name,
  title,
  blurb,
  options,
  savedValue,
  base,
}: {
  name: "headerStyle" | "defaultLayout" | "featuredLayout";
  title: string;
  blurb: string;
  options: { id: T; label: string; description: string }[];
  savedValue: T;
  base: PreviewOptions;
}) {
  const [value, setValue] = useState<T>(savedValue);

  const [seen, setSeen] = useState<T>(savedValue);
  if (seen !== savedValue) {
    setSeen(savedValue);
    setValue(savedValue);
  }

  return (
    <Section
      title={title}
      blurb={blurb}
      dirty={value !== savedValue}
      preview={{ ...base, [name]: value }}
    >
      <input type="hidden" name={name} value={value} />

      <div className="space-y-2">
        {options.map((option) => (
          <OptionCard
            key={option.id}
            selected={value === option.id}
            onSelect={() => setValue(option.id)}
            title={option.label}
            description={option.description}
          />
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------- */

const initialState: FormState = {};

/**
 * The shell each appearance section shares: its own form and action, the
 * preview beside the controls, and the reminder that a choice isn't live until
 * it's saved.
 */
function Section({
  title,
  blurb,
  dirty,
  preview,
  children,
}: {
  title: string;
  blurb: string;
  dirty: boolean;
  preview: PreviewOptions;
  children: React.ReactNode;
}) {
  const [state, formAction] = useActionState(updateAppearanceAction, initialState);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
      <p className="mt-1 text-sm text-neutral-600">{blurb}</p>

      <form action={formAction} className="mt-4 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div>{children}</div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <StorefrontPreview options={preview} label="Preview of your storefront" />
        </div>

        <div className="lg:col-span-2">
          {state.error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}
          {/* The saved message is dropped the moment something changes again,
              so it can't sit there implying an unsaved choice is live. */}
          {state.success && !dirty && (
            <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              {state.success}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <SaveButton />
            <UnsavedNotice dirty={dirty} />
          </div>
        </div>
      </form>
    </section>
  );
}

function OptionCard({
  selected,
  onSelect,
  title,
  description,
  swatch,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  swatch?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
        selected
          ? "border-neutral-900 ring-1 ring-neutral-900"
          : "border-neutral-200 hover:border-neutral-400"
      }`}
    >
      {swatch}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-neutral-900">{title}</span>
        <span className="block text-xs text-neutral-500">{description}</span>
      </span>
    </button>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
    >
      {pending ? "Saving…" : "Save"}
    </button>
  );
}
