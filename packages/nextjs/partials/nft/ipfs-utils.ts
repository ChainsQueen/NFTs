export // Reason: ipfs.io is most reliable, prioritize it first
const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
  "https://nftstorage.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
] as const;

export const resolveToHttp = (uri: string): string => {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const path = uri.replace("ipfs://", "");
    return `${IPFS_GATEWAYS[0]}${path}`;
  }
  // Supports ar:// and data URLs passthrough if needed in future
  if (uri.startsWith("ar://")) {
    return `https://arweave.net/${uri.replace("ar://", "")}`;
  }
  return uri;
};

export const nextIpfsGatewayUrl = (currentUrl: string): string | null => {
  // If currentUrl matches one of our gateways, rotate to the next gateway for the same path
  for (let i = 0; i < IPFS_GATEWAYS.length; i++) {
    const gw = IPFS_GATEWAYS[i];
    if (currentUrl.startsWith(gw)) {
      const path = currentUrl.slice(gw.length);
      const nextGw = IPFS_GATEWAYS[(i + 1) % IPFS_GATEWAYS.length];
      if (nextGw === gw) return null;
      return `${nextGw}${path}`;
    }
  }
  return null;
};

export const normalizeIpfsUrl = (url: string): string => {
  if (!url) return url;
  // If the URL already uses ipfs://, resolve normally
  if (url.startsWith("ipfs://")) return resolveToHttp(url);
  // Rewrite known path-style gateways to our primary gateway
  for (const gw of IPFS_GATEWAYS) {
    if (url.startsWith(gw)) {
      const path = url.slice(gw.length);
      return `${IPFS_GATEWAYS[0]}${path}`;
    }
  }
  // Normalize common subdomain-style gateways: https://<cid>.ipfs.<host>/<path>
  try {
    const u = new URL(url);
    const m = u.hostname.match(/^([a-z0-9]{46,})\.ipfs\./i);
    if (m) {
      const cid = m[1];
      const rest = u.pathname.replace(/^\//, "");
      return `${IPFS_GATEWAYS[0]}${cid}/${rest}`;
    }
  } catch {
    // ignore parse errors
  }
  return url;
};

// Simple inline SVG placeholder to avoid external asset dependency
const INLINE_SVG_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' fill='%2318181b'/%3E%3Cpath d='M4 16l3.5-4.5 3 3.5 2-2L20 16' stroke='%235a5a5a' stroke-width='1.5' fill='none'/%3E%3Crect x='6' y='6' width='6' height='6' rx='1.5' fill='%23262626' stroke='%233a3a3a'/%3E%3C/svg%3E";

export const withImageFallback = (src: string | undefined, fallback = INLINE_SVG_PLACEHOLDER): string => {
  if (!src) return fallback;
  try {
    new URL(src, "http://_");
    return src;
  } catch {
    // Not a valid absolute/relative URL, return fallback
    return fallback;
  }
};
