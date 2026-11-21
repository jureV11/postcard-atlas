import "server-only";
import { PostgrestClient } from "@supabase/postgrest-js";
import { getIdentity, internalToken } from "@/lib/identity";

export async function createClient(): Promise<PostgrestClient> {
  const identity = await getIdentity();
  const token = await internalToken(identity.id);
  return new PostgrestClient(process.env.POSTGREST_URL!, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
