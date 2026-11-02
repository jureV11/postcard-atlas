"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Win = Window & { __installPrompt?: InstallPrompt | null };
const READY = "postcard-atlas:install-ready";

/**
 * On every page: registers the service worker (what makes the site installable and
 * lets notifications arrive with the app closed), and keeps the browser's "you can
 * install this" moment for the Install button, which may be on a later page.
 */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const keep = (e: Event) => {
      e.preventDefault(); // our own button instead of the browser's mini bar
      (window as Win).__installPrompt = e as InstallPrompt;
      window.dispatchEvent(new Event(READY));
    };
    const installed = () => ((window as Win).__installPrompt = null);
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", keep);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  return null;
}

type State = "checking" | "installed" | "ready" | "ios" | "other";

/** "Install the app": a button where the browser allows it, otherwise how to do it by hand. */
export function InstallApp() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const check = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      setState(standalone ? "installed" : (window as Win).__installPrompt ? "ready" : ios ? "ios" : "other");
    };
    check();
    window.addEventListener(READY, check);
    window.addEventListener("appinstalled", check);
    return () => {
      window.removeEventListener(READY, check);
      window.removeEventListener("appinstalled", check);
    };
  }, []);

  async function install() {
    const prompt = (window as Win).__installPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    (window as Win).__installPrompt = null;
    setState(outcome === "accepted" ? "installed" : "other");
  }

  if (state === "checking") return null;
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-xl font-semibold">The app</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Install Postcard Atlas on your phone or computer: it opens full screen from its own icon, and notifications reach you
          even when it&apos;s closed.
        </p>
      </div>
      {state === "installed" && <p className="text-sm font-medium text-ink">✓ You&apos;re using the installed app.</p>}
      {state === "ready" && (
        <button type="button" className="btn" onClick={install}>
          Install the app
        </button>
      )}
      {state === "ios" && (
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Tap <strong>Share</strong> (the square with an arrow) at the bottom of Safari
          </li>
          <li>
            Choose <strong>Add to Home Screen</strong>
          </li>
          <li>Open Postcards from your Home Screen</li>
        </ol>
      )}
      {state === "other" && (
        <p className="text-sm">
          Open your browser&apos;s menu (<strong>⋮</strong>) and choose <strong>Install app</strong> or{" "}
          <strong>Add to Home screen</strong>. In Chrome on a computer there&apos;s also a small install icon at the right of
          the address bar.
        </p>
      )}
    </div>
  );
}
