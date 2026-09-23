import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { CommandCenterClient } from "@/components/command-center/CommandCenterClient";
import { Topbar } from "@/components/layout/Topbar";

/**
 * Server Component wrapper — reads the real session (for the Topbar's user-email chip) the same
 * way a Route Handler would, but via a plain read-only cookie adapter (no request/response pair
 * available in a Server Component — `getSession`'s middleware-shaped signature doesn't fit here).
 * `CommandCenterClient` fetches its own real data client-side (see useOverview.ts).
 */
async function readEmail(): Promise<string | undefined> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url === undefined || anonKey === undefined) {
    return undefined;
  }
  const cookieStore = cookies();
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      // Server Components cannot set cookies — a no-op is the documented, safe behavior here;
      // middleware.ts remains the real session-refresh path.
      setAll: () => undefined,
    },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ?? undefined;
}

export default async function CommandCenterPage(): Promise<React.ReactElement> {
  const email = await readEmail();
  return (
    <main>
      <Topbar
        title="Samantha Command Center"
        subtitle="Your AI advertising team is operating your account."
        userEmail={email}
      />
      <CommandCenterClient />
    </main>
  );
}
