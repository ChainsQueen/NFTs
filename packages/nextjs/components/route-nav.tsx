"use client";

import Link from "next/link";
import React from "react";

type RouteNavProps = {
  leftHref?: string;
  leftLabel?: string;
  rightHref?: string;
  rightLabel?: string;
  className?: string;
};

/**
 * Bottom navigation used on Gallery/My NFTs to keep a consistent UX.
 * Renders optional left and right actions. Keep it lightweight and non-intrusive.
 */
export function RouteNav({ leftHref, leftLabel, rightHref, rightLabel, className }: RouteNavProps) {
  return (
    <div className={"sticky bottom-4 mt-6 mb-0 flex items-center justify-between w-full " + (className || "")}> 
      <div>
        {leftHref && leftLabel ? (
          <Link href={leftHref} className="btn btn-ghost">
            {leftLabel}
          </Link>
        ) : (
          <span />
        )}
      </div>
      <div>
        {rightHref && rightLabel ? (
          <Link href={rightHref} className="btn btn-outline">
            {rightLabel}
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
