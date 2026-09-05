import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStore } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const store = await getCurrentStore();
  if (store) redirect("/dashboard");

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Resin
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-neutral-900">Log in to your store</h1>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-neutral-600">
          Don&apos;t have a store yet?{" "}
          <Link href="/signup" className="font-medium text-neutral-900 underline">
            Set one up
          </Link>
        </p>
      </div>
    </div>
  );
}
