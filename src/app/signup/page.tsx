import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/auth";
import { SignupForm } from "@/components/SignupForm";

export default async function SignupPage() {
  const store = await getCurrentStore();
  if (store) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Resin
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Set up your store</h1>
        </div>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-neutral-600">
          Already have a store?{" "}
          <Link href="/login" className="font-medium text-neutral-900 underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
