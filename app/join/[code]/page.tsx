import { redirect } from "next/navigation";

// Invite links: /join/ABC123 → onboarding with the code pre-filled.
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/onboarding?code=${encodeURIComponent(code.toUpperCase())}`);
}
