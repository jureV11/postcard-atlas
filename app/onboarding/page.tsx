import { redirect } from "next/navigation";
import { Brand } from "@/components/Brand";
import { getSession } from "@/lib/session";
import { OnboardingForm } from "./OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { user, member } = await getSession();
  if (member) redirect("/");
  const { code } = await searchParams;

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-6">
      <header className="mb-8 flex items-center justify-between">
        <Brand />
        <form action="/auth/signout" method="post">
          <button className="text-sm text-ink-soft hover:text-ink">Sign out</button>
        </form>
      </header>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Welcome aboard</h1>
      <p className="mb-6 mt-1 text-ink-soft">
        Start a new group for your friends, or join one with an invite code.
      </p>
      <OnboardingForm userId={user.id} initialCode={(code ?? "").toUpperCase()} />
    </main>
  );
}
