"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { updateAppearanceAction, type FormState } from "@/lib/actions";
import type { SafeStore } from "@/lib/auth";
import {
  FEATURED_LAYOUTS,
  HEADER_STYLES,
  LAYOUTS,
  THEMES,
  accentForeground,
  themeOption,
} from "@/lib/theme";

const initialState: FormState = {};

/**
 * How a shop's storefront looks.
 *
 * Kept apart from the rest of settings because these are the choices a shop
 * will come back and fiddle with, and because they are worth previewing: the
 * swatch beside each theme shows what it does without making the owner save and
 * go and look.
 */
export function AppearanceForm({ store }: { store: SafeStore }) {
  const [state, formAction] = useActionState(updateAppearanceAction, initialState);
  const [theme, setTheme] = useState(store.theme);
  const [accent, setAccent] = useState(store.accentColor);

  const chosen = themeOption(theme);
  // Monochrome deliberately ignores the accent, so the preview has to as well
  // rather than showing a colour the storefront won't use.
  const previewAccent = chosen.forcedAccent ?? accent;

  return (
    <form action={formAction} className="space-y-8">
      {state.error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">{state.success}</p>
      )}

      <fieldset>
        <legend className="text-sm font-semibold text-neutral-900">Colour theme</legend>
        <p className="mt-1 text-sm text-neutral-600">
          Applies to your storefront only. Your dashboard stays as it is.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {THEMES.map((option) => (
            <label
              key={option.id}
              className="flex cursor-pointer gap-3 rounded-lg border border-neutral-200 p-3 transition has-[:checked]:border-neutral-900 has-[:checked]:ring-1 has-[:checked]:ring-neutral-900"
            >
              <input
                type="radio"
                name="theme"
                value={option.id}
                checked={theme === option.id}
                onChange={() => setTheme(option.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-neutral-300"
                style={{ backgroundColor: option.swatch.bg }}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded text-[10px] font-bold"
                  style={{ backgroundColor: option.swatch.surface, color: option.swatch.fg }}
                >
                  Aa
                </span>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-neutral-900">{option.label}</span>
                <span className="block text-xs text-neutral-500">{option.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="accentColor" className="block text-sm font-medium text-neutral-700">
            Accent colour
          </label>
          <div className="mt-1 flex items-center gap-3">
            <input
              id="accentColor"
              name="accentColor"
              type="color"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              className="h-10 w-16 rounded-md border border-neutral-300"
            />
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                backgroundColor: previewAccent,
                color: accentForeground(previewAccent),
              }}
            >
              Buttons look like this
            </span>
          </div>
          {chosen.forcedAccent && (
            <p className="mt-1 text-xs text-neutral-500">
              Monochrome ignores the accent colour. Your choice is kept for when you switch back.
            </p>
          )}
        </div>
      </div>

      <RadioGroup
        name="headerStyle"
        legend="Title bar"
        hint="A banner needs a banner image, set under Shop details."
        options={HEADER_STYLES}
        defaultValue={store.headerStyle}
      />

      <RadioGroup
        name="defaultLayout"
        legend="Default layout"
        hint="What customers see first. They can switch, and their choice sticks in the link they share."
        options={LAYOUTS}
        defaultValue={store.defaultLayout}
      />

      <RadioGroup
        name="featuredLayout"
        legend="Featured section"
        hint="How your featured picks are shown at the top of the storefront."
        options={FEATURED_LAYOUTS}
        defaultValue={store.featuredLayout}
      />

      <SubmitButton />
    </form>
  );
}

function RadioGroup({
  name,
  legend,
  hint,
  options,
  defaultValue,
}: {
  name: string;
  legend: string;
  hint?: string;
  options: { id: string; label: string; description: string }[];
  defaultValue: string;
}) {
  // Falls back to the first option so an unrecognised stored value still shows
  // something selected rather than an empty group.
  const selected = options.some((option) => option.id === defaultValue)
    ? defaultValue
    : options[0].id;

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-neutral-900">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-neutral-600">{hint}</p>}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {options.map((option) => (
          <label
            key={option.id}
            className="cursor-pointer rounded-lg border border-neutral-200 p-3 transition has-[:checked]:border-neutral-900 has-[:checked]:ring-1 has-[:checked]:ring-neutral-900"
          >
            <input
              type="radio"
              name={name}
              value={option.id}
              defaultChecked={option.id === selected}
              className="sr-only"
            />
            <span className="block text-sm font-medium text-neutral-900">{option.label}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">{option.description}</span>
          </label>
        ))}
      </div>
    </fieldset>
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
      {pending ? "Saving…" : "Save appearance"}
    </button>
  );
}
