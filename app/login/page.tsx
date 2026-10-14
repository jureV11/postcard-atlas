import { StampIcon } from "@/components/Brand";
import { safeNext } from "@/lib/utils";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
      <div className="mb-8 text-center">
        <StampIcon className="mx-auto mb-4 size-14 -rotate-6" />
        <h1 className="font-display text-4xl font-semibold tracking-tight">Postcard Atlas</h1>
        <p className="mt-2 text-ink-soft">Every card we send each other, on one map.</p>
      </div>
      <LoginForm next={safeNext(next)} linkError={error === "link"} />
    </main>
  );
}
