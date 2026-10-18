"use client";

import { useEffect, useState } from "react";
import {
  deletePushSubscription,
  hasPushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/app/(app)/push-actions";
import { errorMessage } from "@/lib/utils";

type State =
  | "checking"
  | "unavailable" // the server isn't set up for notifications
  | "unsupported" // this browser can't do them
  | "ios-install" // iPhone/iPad: only works from the Home Screen app
  | "blocked" // the user said no in the browser's prompt
  | "off"
  | "on";

/** The VAPID public key as the bytes PushManager wants. */
function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js");
}

/** Settings: turn phone notifications on/off for this device, and send a test. */
export function NotificationsSettings({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!publicKey) return setState("unavailable");
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        return setState(ios && !standalone ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      setState(sub && (await hasPushSubscription(sub.endpoint)) ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, [publicKey]);

  async function turnOn() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(publicKey!) as BufferSource,
        }));
      const r = await savePushSubscription(sub.toJSON());
      if (r.error) throw new Error(r.error);
      setState("on");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    const r = await sendTestPush();
    setBusy(false);
    if (r.error) setError(r.error);
    else setNote("Sent — it should pop up in a few seconds.");
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-ink-soft">
          Get a ping on this device when your postcard arrives, and when a new card is revealed on the map. Nothing ever
          gives away a card that&apos;s still on its way.
        </p>
      </div>

      {state === "checking" && <p className="text-sm text-ink-soft">Checking this device…</p>}
      {state === "unavailable" && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">Notifications aren&apos;t set up on this site yet.</p>
      )}
      {state === "unsupported" && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">This browser can&apos;t show notifications.</p>
      )}
      {state === "ios-install" && (
        <div className="rounded-xl bg-paper-deep px-4 py-3 text-sm">
          <p className="font-medium">On iPhone, add the app to your Home Screen first:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>
              Tap the <strong>Share</strong> button in Safari
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>
            </li>
            <li>Open Postcards from your Home Screen and come back here</li>
          </ol>
          <p className="mt-1 text-xs text-ink-soft">Needs iOS 16.4 or newer.</p>
        </div>
      )}
      {state === "blocked" && (
        <p className="rounded-xl bg-paper-deep px-4 py-3 text-sm">
          Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload.
        </p>
      )}
      {(state === "off" || state === "on") && (
        <div className="flex flex-wrap items-center gap-2">
          {state === "off" ? (
            <button type="button" onClick={turnOn} disabled={busy} className="btn">
              {busy ? "Turning on…" : "Turn on notifications"}
            </button>
          ) : (
            <>
              <span className="rounded-full bg-[#3b8b5a]/12 px-3 py-1 text-sm font-medium text-[#2f6f48]">On for this device ✓</span>
              <button type="button" onClick={test} disabled={busy} className="btn-ghost">
                Send me a test
              </button>
              <button type="button" onClick={turnOff} disabled={busy} className="btn-ghost">
                Turn off
              </button>
            </>
          )}
        </div>
      )}
      {note && <p className="text-sm text-ink-soft">{note}</p>}
      {error && <p className="error text-sm">{error}</p>}
    </div>
  );
}
