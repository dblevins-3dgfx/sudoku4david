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

/** What the player typed or pasted to finish signing in, once understood. */
export type SignInProof =
  | { kind: "code"; code: string }
  | { kind: "link"; tokenHash: string; type: "magiclink" | "signup" | "email" };

const LINK_TYPES = ["magiclink", "signup", "email"] as const;

/**
 * Reads either the numeric code from the sign-in email or the email's whole
 * link, copied from Mail (press and hold the link, then Copy Link).
 *
 * Supabase's link looks like
 *   https://<project>.supabase.co/auth/v1/verify?token=<hash>&type=magiclink&redirect_to=...
 * and the `token` there is a hash that can be redeemed directly. Some mail
 * apps wrap links in their own redirect (Gmail's google.com/url?q=<link>), so
 * a link found inside another link's query string is unwrapped first.
 * Returns null for anything else.
 */
export function parseSignInProof(input: string): SignInProof | null {
  const text = input.trim();
  if (/^\d{6,10}$/.test(text)) return { kind: "code", code: text };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  for (let depth = 0; depth < 3; depth++) {
    const token = url.searchParams.get("token");
    const type = url.searchParams.get("type") ?? "magiclink";
    if (token && url.pathname.endsWith("/auth/v1/verify")) {
      return (LINK_TYPES as readonly string[]).includes(type)
        ? { kind: "link", tokenHash: token, type: type as (typeof LINK_TYPES)[number] }
        : null;
    }
    // Not the link itself: look for it inside a query value (a mail redirect).
    let inner: URL | null = null;
    for (const value of url.searchParams.values()) {
      try {
        inner = new URL(value);
        break;
      } catch {}
    }
    if (!inner) return null;
    url = inner;
  }
  return null;
}

/**
 * Finishes signing in with the code or link from the email.
 *
 * This exists for an app added to the iPhone home screen. Such an app keeps
 * its own storage, separate from Safari's, and a link tapped in Mail always
 * opens in Safari. So tapping the link signs in Safari, never the home-screen
 * app; handing the code or the copied link to the app itself is the only way
 * to sign it in.
 */
export async function verifySignIn(email: string, proof: SignInProof): Promise<void> {
  const auth = (await client()).auth;
  const { error } =
    proof.kind === "code"
      ? await auth.verifyOtp({ email, token: proof.code, type: "email" })
      : await auth.verifyOtp({ token_hash: proof.tokenHash, type: proof.type });
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
