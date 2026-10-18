import { StampIcon } from "@/components/Brand";
import { GreetingsCards } from "@/components/GreetingsCards";
import { safeNext } from "@/lib/utils";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="relative min-h-dvh overflow-hidden">
      <GreetingsCards />
      <div className="relative mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-12">
        <div className="mb-6 text-center">
          <StampIcon className="mx-auto mb-4 size-14 -rotate-6" />
          <h1 className="font-display text-4xl font-semibold tracking-tight">Postcard Atlas</h1>
          <p className="mt-2 font-hand text-xl leading-tight text-ink-soft">Every card we send each other, on one map.</p>
        </div>
        {/* The sign-in box is the back of a postcard, in an airmail envelope edge */}
        <div className="airmail [&_.card]:!border-0 [&_.card]:!bg-transparent [&_.card]:!shadow-none">
          <div className="paper">
            <LoginForm next={safeNext(next)} linkError={error === "link"} />
          </div>
        </div>
      </div>
    </main>
  );
}
