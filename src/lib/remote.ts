/**
 * The sync backend adapter (#32). This is the only file that knows the
 * backend is Supabase; everything else calls the functions below. Moving to
 * another provider means rewriting this file and nothing else.
 *
 * The Supabase library is loaded on first use with a dynamic import(), which
 * the bundler splits into a separate file. Players with sync switched off
 * never download it.
 *
 * All functions here are async: they return a Promise, JavaScript's future
 * value, and callers `await` it. Network failures reject the promise (throw).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./remote-config";
import type { RemoteState } from "./sync";

const TABLE = "sync_state";

let clientPromise: Promise<SupabaseClient> | null = null;

/** True when a backend is configured, so sync can be offered at all. */
export function remoteAvailable(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function client(): Promise<SupabaseClient> {
  if (!clientPromise) {
    clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          // The sign-in link carries the session in the URL. "implicit" lets
          // that link work even when it opens in a different browser from the
          // one that asked for it (common on phones), and the client reads it
          // from the URL on load and then removes it.
          flowType: "implicit",
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      }),
    );
  }
  return clientPromise;
}

/** The signed-in player's email, or null when signed out. */
export async function currentEmail(): Promise<string | null> {
  const { data } = await (await client()).auth.getSession();
  return data.session?.user.email ?? null;
}

/**
 * Calls `onChange` with the email whenever the player signs in or out
 * (including when a sign-in link is opened). Returns a function that stops
 * listening.
 */
export async function watchSignIn(onChange: (email: string | null) => void): Promise<() => void> {
  const { data } = (await client()).auth.onAuthStateChange((_event, session) => {
    onChange(session?.user.email ?? null);
  });
  return () => data.subscription.unsubscribe();
}

/** Emails a sign-in link that brings the player back to `returnTo`. */
export async function sendSignInLink(email: string, returnTo: string): Promise<void> {
  const { error } = await (await client()).auth.signInWithOtp({
    email,
    options: { emailRedirectTo: returnTo },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const { error } = await (await client()).auth.signOut();
  if (error) throw error;
}

type Row = { game: unknown; game_saved_at: number | string | null; records: unknown };

/** The signed-in player's saved state, or null when there is none yet. */
export async function pull(): Promise<RemoteState | null> {
  const { data, error } = await (await client())
    .from(TABLE)
    .select("game, game_saved_at, records")
    .maybeSingle<Row>();
  if (error) throw error;
  if (!data) return null;
  // Postgres bigint can arrive as a string; Number() turns either into a number.
  return { game: data.game, gameSavedAt: Number(data.game_saved_at) || 0, records: data.records };
}

/** Replaces the signed-in player's saved state. */
export async function push(state: RemoteState): Promise<void> {
  const db = await client();
  const { data: session } = await db.auth.getSession();
  const userId = session.session?.user.id;
  if (!userId) throw new Error("Not signed in");
  const { error } = await db.from(TABLE).upsert({
    user_id: userId,
    game: state.game,
    game_saved_at: state.gameSavedAt,
    records: state.records,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
