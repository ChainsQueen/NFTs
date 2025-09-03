import type { ReactNode } from "react";

export type MediaAspect = "1:1" | "3:4" | "16:9";

export interface NFTCardAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** If true, shows a spinner in the button and disables it. */
  loading?: boolean;
}

export interface NFTCardProps {
  id: string | number;
  name: string;
  imageUrl: string;
  description?: string;
  owner?: string;
  /** Optional label for the contract/collection (e.g., Kittens • Kittens (KTN)) */
  contractLabel?: string;
  /** Optional on-chain contract address */
  contractAddress?: string;
  /** Formatted amount to display (e.g., from formatEther). Unit-agnostic. */
  priceAmount?: string | number;
  /** If true, renders a small loading spinner in place of the price. */
  priceLoading?: boolean;
  /** Optional currency/unit label for price, defaults to "TTRUST" in the card if not provided */
  priceUnit?: string;
  badgeText?: string;
  mediaAspect?: MediaAspect;
  href?: string;
  onClick?: () => void;
  ctaPrimary?: NFTCardAction;
  ctaSecondary?: NFTCardAction;
  size?: "sm" | "md" | "lg";
  density?: "comfortable" | "compact";
  selectable?: boolean;
  selected?: boolean;
  className?: string;
  /** Optional custom content rendered just below the CTA buttons area. */
  belowCta?: ReactNode;
  /** Optional custom content rendered just above the CTA buttons area. */
  aboveCta?: ReactNode;
}
