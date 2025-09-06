"use client";

import { FC } from "react";

// simple local cn util to avoid pulling additional helpers
function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const NFTCardSkeleton: FC<{ className?: string; withFooter?: boolean }> = ({ className, withFooter = true }) => {
  return (
    <div
      className={clsx(
        "rounded-xl flex h-full flex-col",
        // Light: no border or surface; Dark: subtle border + surface
        "bg-transparent dark:border dark:border-white/5 dark:bg-neutral-900/60 dark:backdrop-blur-sm",
        "shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)]",
        "overflow-hidden select-none",
        className,
      )}
    >
      <div className="relative w-full aspect-square bg-neutral-800 animate-pulse rounded-t-lg" />
      <div className="p-4 space-y-2 rounded-b-xl bg-[#818cf8]/12 dark:bg-[#818cf8]/10 grow flex flex-col">
        <div className="h-5 w-2/3 rounded-md bg-neutral-800 animate-pulse" />
        <div className="h-4 w-1/2 rounded-md bg-neutral-800 animate-pulse" />
        <div className="mt-auto pt-3 flex items-center gap-2">
          {withFooter ? (
            <>
              <div className="h-9 w-28 rounded-md bg-neutral-800 animate-pulse" />
              <div className="h-9 w-28 rounded-md bg-neutral-800 animate-pulse" />
            </>
          ) : (
            <div className="h-9 w-28 rounded-md bg-neutral-800/70" />
          )}
        </div>
      </div>
    </div>
  );
};
