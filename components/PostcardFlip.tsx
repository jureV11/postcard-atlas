"use client";

import { useState } from "react";
import { Postmark } from "@/components/Postmark";

type PostmarkInfo = { city: string; country: string; date: string };

/** The postcard as an object: tap to turn it over and read the back. */
export function PostcardFlip({
  frontUrl,
  backUrl,
  alt,
  size = "lg",
  postmark,
}: {
  frontUrl: string | null;
  backUrl: string | null;
  alt: string;
  size?: "sm" | "lg";
  postmark?: PostmarkInfo;
}) {
  const [flipped, setFlipped] = useState(false);
  const canFlip = !!frontUrl && !!backUrl;
  const only = frontUrl ?? backUrl;

  if (!only) return null;

  if (!canFlip) {
    return (
      <div className="card-bump">
        <Face
          url={only}
          alt={`${alt} — ${frontUrl ? "front" : "back"}`}
          label={frontUrl ? "Front" : "Back"}
          size={size}
          postmark={postmark}
          static
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Not a <button>: Firefox flattens 3D transforms inside buttons, which breaks the flip. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        aria-label={flipped ? "Turn to the front" : "Turn over to the back"}
        aria-pressed={flipped}
        className="card-bump block w-full cursor-pointer select-none rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink/40"
      >
        <div className="[perspective:1800px]">
          <div
            className={`relative aspect-[3/2] w-full transition-transform duration-700 ease-[cubic-bezier(.3,.7,.2,1)] [transform-style:preserve-3d] motion-reduce:duration-0 ${
              flipped ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
            }`}
          >
            <Face url={frontUrl} alt={`${alt} — front`} label="Front" size={size} postmark={postmark} />
            <Face url={backUrl} alt={`${alt} — back`} label="Back" size={size} back />
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-ink-soft">
        Tap the card to turn it over <span aria-hidden="true">↻</span>
      </p>
    </div>
  );
}

function Face({
  url,
  alt,
  label,
  size,
  back,
  postmark,
  static: isStatic,
}: {
  url: string;
  alt: string;
  label: string;
  size: "sm" | "lg";
  back?: boolean;
  postmark?: PostmarkInfo;
  static?: boolean;
}) {
  return (
    <div
      className={`${isStatic ? "relative aspect-[3/2]" : "absolute inset-0"} overflow-hidden ${
        size === "lg" ? "rounded-xl" : "rounded-lg"
      } border border-ink/10 bg-paper-deep shadow-[0_2px_6px_rgb(42_38_34/0.08),0_12px_32px_-12px_rgb(42_38_34/0.35)] [backface-visibility:hidden] ${
        back ? "[transform:rotateY(180deg)]" : ""
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="size-full object-contain" draggable={false} />
      <span className="absolute left-2 top-2 rounded-full bg-ink/65 px-2 py-0.5 text-[11px] font-medium text-paper">
        {label}
      </span>
      {postmark && (
        <Postmark
          {...postmark}
          className={`postmark pointer-events-none absolute ${
            size === "lg" ? "-right-2 top-3 w-[42%] max-w-[260px]" : "-right-1 top-2 w-[48%]"
          }`}
        />
      )}
    </div>
  );
}
