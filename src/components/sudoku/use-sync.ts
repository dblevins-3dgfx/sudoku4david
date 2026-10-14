"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/game";
import { loadRecords, saveRecords } from "@/lib/records";
import {
  currentEmail,
  pull,
  push,
  remoteAvailable,
  sendSignInLink,
  signOut as remoteSignOut,
  verifySignInCode,
  watchSignIn,
} from "@/lib/remote";
import { loadGameRaw, saveGame, writeGameRaw } from "@/lib/storage";
import { planSync } from "@/lib/sync";

/** off: no backend configured. The rest describe a configured backend. */
export type SyncStatus = "off" | "signed-out" | "syncing" | "synced" | "offline";

/** How often to sync while signed in and the page is visible. */
const SYNC_EVERY_MS = 30_000;

/**
 * Keeps this browser in step with the player's copy on the server (#32).
 *
 * A sync saves the game in memory, downloads the server's copy, lets
 * planSync decide, applies the result here, and uploads if the server is
 * behind. It runs after sign-in, when the page is shown or hidden, when the
 * network comes back, every 30 seconds while visible, and on request (after a
 * win, a reset, or loading a backup).
 *
 * localStorage stays the working copy, so play never waits on the network;
 * a failed sync just shows "offline" and the next one catches up.
 */
export function useSync({
  ready,
  getGame,
  adoptGame,
}: {
  /** False until the local game has loaded, so the first sync has it to compare. */
  ready: boolean;
  getGame: () => GameState | null;
  /** Shows a game that came from the server (already written to storage). */
  adoptGame: (state: GameState) => void;
}) {
  const available = remoteAvailable();
  const [email, setEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<SyncStatus>(available ? "signed-out" : "off");
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  // Refs hold the latest values for the async code below. A callback created
  // once would otherwise keep seeing the values from when it was created
  // (a "stale closure", like a lambda that captured by value).
  const emailRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const getGameRef = useRef(getGame);
  const adoptRef = useRef(adoptGame);
  const runningRef = useRef(false);
  const againRef = useRef(false);

  useEffect(() => {
    getGameRef.current = getGame;
    adoptRef.current = adoptGame;
    readyRef.current = ready;
  });

  const syncNow = useCallback(async () => {
    if (!emailRef.current || !readyRef.current) return;
    // One sync at a time. A request during a sync runs one more pass after it.
    if (runningRef.current) {
      againRef.current = true;
      return;
    }
    runningRef.current = true;
    setStatus("syncing");
    try {
      do {
        againRef.current = false;
        const remote = await pull();
        // Save the game in memory only now, after the download, so a move
        // made while waiting is part of what gets compared.
        const game = getGameRef.current();
        if (game) saveGame(game);
        const plan = planSync(loadGameRaw(), loadRecords(), remote);
        if (plan.recordsChanged) saveRecords(plan.records);
        if (plan.adoptGame) {
          writeGameRaw(plan.adoptGame.state, plan.adoptGame.savedAt);
          adoptRef.current(plan.adoptGame.state);
        }
        if (plan.upload) await push(plan.upload);
      } while (againRef.current);
      setStatus("synced");
      setLastSynced(Date.now());
    } catch {
      setStatus("offline");
    } finally {
      runningRef.current = false;
    }
  }, []);

  // Learn who is signed in, and follow sign-ins and sign-outs from then on.
  useEffect(() => {
    if (!available) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const update = (next: string | null) => {
      emailRef.current = next;
      setEmail(next);
      if (!next) setStatus("signed-out");
      else void syncNow();
    };
    void (async () => {
      try {
        const unwatch = await watchSignIn(update);
        if (cancelled) unwatch();
        else stop = unwatch;
        update(await currentEmail());
      } catch {
        if (!cancelled) setStatus("offline");
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [available, syncNow]);

  // The first sync waits for the local game to load. queueMicrotask runs it
  // just after this effect returns, so its status update is a normal state
  // change rather than one made during the effect itself.
  useEffect(() => {
    if (ready) queueMicrotask(() => void syncNow());
  }, [ready, syncNow]);

  useEffect(() => {
    if (!available) return;
    const onEvent = () => void syncNow();
    document.addEventListener("visibilitychange", onEvent);
    window.addEventListener("online", onEvent);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncNow();
    }, SYNC_EVERY_MS);
    return () => {
      document.removeEventListener("visibilitychange", onEvent);
      window.removeEventListener("online", onEvent);
      window.clearInterval(id);
    };
  }, [available, syncNow]);

  const sendLink = useCallback(async (address: string) => {
    // The link returns to this page, including the GitHub Pages base path.
    await sendSignInLink(address, window.location.origin + window.location.pathname);
  }, []);

  const verifyCode = useCallback(async (address: string, code: string) => {
    // Success fires the sign-in watcher above, which updates the email and syncs.
    await verifySignInCode(address, code);
  }, []);

  const signOut = useCallback(async () => {
    await remoteSignOut();
    emailRef.current = null;
    setEmail(null);
    setStatus("signed-out");
  }, []);

  return { status, email, lastSynced, syncNow, sendLink, verifyCode, signOut };
}
