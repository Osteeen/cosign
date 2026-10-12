import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// The signed-in owner, from the database-backed session. Every owner-facing
// page and action gets the owner ID only from here, never from a form or URL.
export async function requireOwner(): Promise<{ id: string; email: string; name: string | null }> {
  const session = await auth();
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) redirect("/sign-in");
  return { id, email, name: session.user?.name ?? null };
}
