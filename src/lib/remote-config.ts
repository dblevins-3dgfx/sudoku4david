// Where sync (#32) keeps its data: a Supabase project's URL and its public
// ("anon" or "publishable") key. Both are meant to be public: every browser
// receives them, and the database's row-level security is what keeps each
// player's data private. While either is empty, sync is switched off and the
// app works exactly as before.
export const SUPABASE_URL = "https://goeergiwxisrajutteln.supabase.co";
export const SUPABASE_KEY = "sb_publishable_BfDTIX0ru3zCui_UZnJkag_7OQR3Gv5";

/** The origin the browser may connect to for sync, for the CSP. Empty when off. */
export function syncOrigin(url: string = SUPABASE_URL): string {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
}
