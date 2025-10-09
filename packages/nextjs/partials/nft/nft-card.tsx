"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { IPFS_GATEWAYS, nextIpfsGatewayUrl, normalizeIpfsUrl, resolveToHttp, withImageFallback } from "./ipfs-utils";
import { cardVariants, computeTilt, motionProps, sheenVariants } from "./nft-card.motion";
import { NFTCardProps } from "./nft-card.types";
import * as Tooltip from "@radix-ui/react-tooltip";
import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink } from "lucide-react";

function clsx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function shortenAddress(addr?: string, left = 6, right = 4) {
  if (!addr) return "";
  if (addr.length <= left + right + 2) return addr;
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}

const aspectClass = (aspect?: NFTCardProps["mediaAspect"]) => {
  switch (aspect) {
    case "3:4":
      return "aspect-[3/4]";
    case "16:9":
      return "aspect-video";
    default:
      return "aspect-square";
  }
};

const sizeClass = (size: NonNullable<NFTCardProps["size"]> = "md") => {
  switch (size) {
    case "sm":
      return { title: "text-sm", text: "text-xs", pad: "p-3", btn: "h-8 px-3 text-xs" };
    case "lg":
      return { title: "text-xl", text: "text-sm", pad: "p-5", btn: "h-10 px-5 text-sm" };
    default:
      return { title: "text-base md:text-lg", text: "text-sm", pad: "p-4", btn: "h-9 px-4 text-sm" };
  }
};

// eslint-disable-next-line complexity
export function NFTCard(props: NFTCardProps) {
  const {
    id,
    name,
    imageUrl,
    description,
    owner,
    badgeText,
    mediaAspect = "1:1",
    href,
    onClick,
    ctaPrimary,
    ctaSecondary,
    size = "md",
    selectable,
    selected,
    className,
    aboveCta,
    belowCta,
    contractLabel,
    contractAddress,
  } = props;

  const reduceMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const sizes = sizeClass(size);

  const resolvedImage = useMemo(() => {
    const normalized = normalizeIpfsUrl(imageUrl);
    return withImageFallback(resolveToHttp(normalized));
  }, [imageUrl]);
  const [imageSrc, setImageSrc] = useState(resolvedImage);
  const watchdogRef = useRef<number | null>(null);
  const hadEventRef = useRef(false);
  const attemptsRef = useRef(0);
  const MAX_ATTEMPTS = IPFS_GATEWAYS.length;
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (imageSrc !== resolvedImage) {
      setImageSrc(resolvedImage);
      setIsLoading(true);
      attemptsRef.current = 0;
      console.debug("NFTCard: resolved image URL", { id, resolvedImage });
    }
  }, [resolvedImage, id, imageSrc]);

  // Determine if the description is rendered on a single line to add a tiny spacing only in that case
  const descRef = useRef<HTMLParagraphElement | null>(null);
  const [isSingleLineDesc, setIsSingleLineDesc] = useState(false);
  useEffect(() => {
    const el = descRef.current;
    if (!el) return;
    const compute = () => {
      const style = window.getComputedStyle(el);
      const lineHeight = parseFloat(style.lineHeight || "0");
      // Use clientHeight for rendered height; compare with line height to infer number of lines
      const lines = lineHeight > 0 ? Math.round(el.clientHeight / lineHeight) : 0;
      const isClamped = el.scrollHeight > el.clientHeight + 1; // allow minor rounding
      setIsSingleLineDesc(!isClamped && lines <= 1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [description, sizes.text]);

  // Watchdog: if no load/error within timeout, rotate gateway
  useEffect(() => {
    hadEventRef.current = false;
    if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    watchdogRef.current = window.setTimeout(() => {
      if (hadEventRef.current) return;
      const next = nextIpfsGatewayUrl(imageSrc);
      console.warn("NFTCard: watchdog rotating gateway (no events)", {
        id,
        current: imageSrc,
        next,
        attempts: attemptsRef.current,
      });
      if (next && next !== imageSrc && attemptsRef.current < MAX_ATTEMPTS) {
        attemptsRef.current += 1;
        setImageSrc(next);
      } else {
        console.warn("NFTCard: watchdog exhausted gateways, using placeholder", { id });
        setImageSrc(withImageFallback(""));
        setIsLoading(false);
      }
    }, 7000);
    return () => {
      if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
    };
  }, [imageSrc, id, MAX_ATTEMPTS]);

  const CardInner = (
    <motion.div
      className={clsx(
        "group relative rounded-xl",
        // Light mode: no border, transparent bg; Dark mode: subtle border + surface
        "bg-transparent dark:border dark:border-white/5 dark:bg-neutral-900/60 dark:backdrop-blur-sm",
        "shadow-[0_10px_20px_-10px_rgba(0,0,0,0.35)] transition-all duration-200",
        "overflow-hidden focus:outline-none hover:shadow-[0_18px_28px_-12px_rgba(0,0,0,0.5)] hover:-translate-y-0.5",
        // Make the card fill available height and layout vertically
        "flex h-full flex-col",
        selectable && selected && "ring-2 ring-indigo-500",
        className,
      )}
      onMouseMove={e => !reduceMotion && setTilt(computeTilt(e, 12))}
      variants={cardVariants}
      custom={tilt}
      {...(!reduceMotion ? motionProps : {})}
    >
      {/* Sheen */}
      {!reduceMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
          variants={sheenVariants}
        />
      )}

      {/* Media */}
      <figure
        className={clsx(
          "relative w-full overflow-hidden rounded-t-lg bg-white flex-shrink-0",
          aspectClass(mediaAspect),
        )}
      >
        {/* Spinner while loading */}
        {isLoading && (
          <div className="absolute inset-0 grid place-items-center bg-neutral-100" aria-hidden="true">
            <span className="loading loading-spinner" aria-label="Loading image" />
          </div>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={name || `NFT #${id}`}
          className={clsx(
            "absolute inset-0 h-full w-full object-contain object-center select-none",
            "transition-opacity duration-500",
            isLoading ? "opacity-0" : "opacity-100",
          )}
          loading="lazy"
          decoding="async"
          onLoad={() => {
            console.debug("NFTCard: image loaded", { id, src: imageSrc });
            hadEventRef.current = true;
            if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
            setIsLoading(false);
          }}
          onError={() => {
            const next = nextIpfsGatewayUrl(imageSrc);
            console.warn("NFTCard: image failed, rotating gateway", { id, failed: imageSrc, next });
            hadEventRef.current = true;
            if (watchdogRef.current) window.clearTimeout(watchdogRef.current);
            if (next && next !== imageSrc) {
              attemptsRef.current += 1;
              setIsLoading(true);
              setImageSrc(next);
            } else {
              console.warn("NFTCard: all gateways failed, using placeholder", { id });
              setImageSrc(withImageFallback(""));
              setIsLoading(false);
            }
          }}
        />
        {badgeText && (
          <figcaption className="absolute left-3 top-3 rounded-md border border-white/10 bg-neutral-900/70 px-2 py-1 text-xs text-neutral-200 backdrop-blur">
            {badgeText}
          </figcaption>
        )}
        <figcaption className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200 backdrop-blur">
          #{id}
        </figcaption>
      </figure>

      {/* Body */}
      <div
        className={clsx(
          "gap-3",
          /* lighter in light mode, richer in dark mode */
          "bg-[#818cf8]/12 dark:bg-[#818cf8]/10",
          "rounded-b-xl",
          // Fill remaining vertical space so background color covers full card height
          "grow flex flex-col",
          sizes.pad,
        )}
      >
        <div className="flex-1 flex flex-col gap-2 min-h-[1px]">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={clsx("font-semibold tracking-[-0.01em] text-neutral-800 dark:text-neutral-100", sizes.title)}
              title={name}
            >
              <span className="line-clamp-2 leading-snug">{name}</span>
            </h3>
            {href && (
              <Tooltip.Provider delayDuration={150}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <a
                      href={href}
                      target={href.startsWith("http") ? "_blank" : undefined}
                      rel={href.startsWith("http") ? "noreferrer" : undefined}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-neutral-900/70 text-neutral-300 transition-colors hover:text-white"
                      aria-label="Open link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={6}
                      className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 shadow-xl"
                    >
                      Open link
                      <Tooltip.Arrow className="fill-neutral-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            )}
          </div>

          {description && (
            <p
              ref={descRef}
              className={clsx(
                "line-clamp-3 text-neutral-700 dark:text-neutral-300 leading-relaxed",
                isSingleLineDesc ? "mb-1" : "mb-0",
                sizes.text,
              )}
              title={description}
            >
              {description}
            </p>
          )}
        </div>

        <div className="h-px w-full bg-gradient-to-r from-black/5 via-black/10 to-black/5 dark:from-white/5 dark:via-white/10 dark:to-white/5" />

        <div className="flex flex-col items-start gap-1 text-neutral-500 dark:text-neutral-400">
          {owner && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-neutral-600/80 dark:text-neutral-500/80">
                Owner
              </span>
              <Tooltip.Provider delayDuration={150}>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild>
                    <span className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300 tabular-nums tracking-tight">
                      {shortenAddress(owner)}
                    </span>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={6}
                      className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 shadow-xl"
                    >
                      {owner}
                      <Tooltip.Arrow className="fill-neutral-900" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            </div>
          )}
          {(contractAddress || contractLabel) && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] uppercase tracking-wide text-neutral-600/80 dark:text-neutral-500/80">
                Contract
              </span>
              {contractAddress ? (
                <Tooltip.Provider delayDuration={150}>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild>
                      <span className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300 tabular-nums tracking-tight">
                        {shortenAddress(contractAddress)}
                      </span>
                    </Tooltip.Trigger>
                    <Tooltip.Portal>
                      <Tooltip.Content
                        sideOffset={6}
                        className="rounded-md border border-white/10 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 shadow-xl"
                      >
                        {contractAddress}
                        <Tooltip.Arrow className="fill-neutral-900" />
                      </Tooltip.Content>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                </Tooltip.Provider>
              ) : (
                <span className="truncate text-xs font-medium text-neutral-700 dark:text-neutral-300 tracking-tight">
                  {contractLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* {(priceLoading || priceAmount != null) && (
          <div className="mt-1 text-xs text-neutral-400 min-h-[1.25rem] flex items-center gap-2">
            <span className="opacity-80">Price:</span>
            {priceLoading ? (
              <span className="loading loading-spinner loading-xs" aria-label="Loading price" />
            ) : (
              <span className="tabular-nums">{String(priceAmount)}</span>
            )}
            <span>{priceUnit || "TTRUST"}</span>
          </div>
        )} */}

        {aboveCta && <div className="pb-2">{aboveCta}</div>}

        {(ctaPrimary || ctaSecondary || onClick) && (
          <div className="pt-1.5 flex items-center justify-center gap-2">
            {ctaPrimary && (
              <button
                className={clsx(
                  "inline-flex items-center justify-center gap-2 rounded-md border border-transparent bg-[#818cf8] text-white hover:opacity-90 dark:bg-[var(--color-primary)] dark:text-[var(--color-primary-content)]",
                  "transition-all duration-150 transform active:scale-95 will-change-transform",
                  sizes.btn,
                  (ctaPrimary.loading || ctaPrimary.disabled) && "opacity-80 cursor-not-allowed",
                )}
                onClick={ctaPrimary.onClick}
                disabled={!!ctaPrimary.loading || !!ctaPrimary.disabled}
              >
                {ctaPrimary.loading && <span className="loading loading-spinner loading-xs" aria-hidden="true"></span>}
                <span>{ctaPrimary.label}</span>
              </button>
            )}
            {ctaSecondary && (
              <button
                className={clsx(
                  "rounded-md border border-white/10 bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
                  "transition-all duration-150 transform active:scale-95 will-change-transform",
                  sizes.btn,
                )}
                onClick={ctaSecondary.onClick}
                disabled={ctaSecondary.disabled}
              >
                {ctaSecondary.label}
              </button>
            )}
            {onClick && !ctaPrimary && !ctaSecondary && (
              <button
                className={clsx(
                  "rounded-md border border-white/10 bg-neutral-800 text-neutral-100 hover:bg-neutral-700",
                  "transition-transform transform active:scale-95 will-change-transform",
                  sizes.btn,
                )}
                onClick={onClick}
              >
                View
              </button>
            )}
          </div>
        )}

        {belowCta && <div className="pt-2">{belowCta}</div>}
      </div>
    </motion.div>
  );

  if (href && !href.startsWith("http")) {
    return (
      <Link href={href} className="block h-full focus:outline-none">
        {CardInner}
      </Link>
    );
  }

  return CardInner;
}
