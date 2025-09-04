// Fetch helpers for IPFS/HTTP JSON
// Reason: Reuse across pages and reduce complexity in components

import type { NFTMetaData } from "../../utils/simpleNFT/nftsMetadata";
import { normalizeUri, resolveIpfsToHttp } from "./uri-utils";

export const fetchJsonWithTimeout = async (url: string, timeoutMs = 12000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let finalUrl = url;
    try {
      const u = new URL(url);
      u.searchParams.set("_", String(Date.now()));
      finalUrl = u.toString();
    } catch {}
    const res = await fetch(finalUrl, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return (await res.json()) as NFTMetaData;
    }
    const txt = await res.text();
    try {
      return JSON.parse(txt) as NFTMetaData;
    } catch {
      throw new Error("Non-JSON metadata response");
    }
  } finally {
    clearTimeout(id);
  }
};

// eslint-disable-next-line complexity
export const fetchIpfsJsonWithFallbacks = async (rawUri: string, timeoutMs = 12000): Promise<NFTMetaData> => {
  const gateways = ["nftstorage.link", "cloudflare-ipfs.com", "ipfs.io", "gateway.pinata.cloud", "dweb.link"];
  const s = normalizeUri(rawUri);
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      return JSON.parse(s) as NFTMetaData;
    } catch {}
  }
  if (s.startsWith("data:application/json")) {
    try {
      const match = s.match(/^data:application\/json(?:;charset=[^;,]+)?(;base64)?,(.*)$/i);
      if (match) {
        const isB64 = !!match[1];
        const payload = match[2] || "";
        const jsonStr = isB64 ? atob(payload) : decodeURIComponent(payload);
        return JSON.parse(jsonStr) as NFTMetaData;
      }
    } catch {}
  }
  const isIpfs = s.startsWith("ipfs://");
  const looksLikeCid = /^(bafy[\w]+|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/.*)?$/.test(s);
  const baseUrls = isIpfs || looksLikeCid ? gateways.map(g => resolveIpfsToHttp(s, g)) : [s];
  const urls: string[] = [];
  for (const b of baseUrls) {
    urls.push(b);
    try {
      const u = new URL(b);
      const withName = new URL(u.toString());
      if (!withName.searchParams.has("filename")) {
        withName.searchParams.set("filename", "metadata.json");
        urls.push(withName.toString());
      }
      if (u.pathname.endsWith("/")) {
        const noSlash = new URL(u.toString());
        noSlash.pathname = noSlash.pathname.replace(/\/+$/, "");
        urls.push(noSlash.toString());
      }
    } catch {}
  }
  let lastErr: any;
  for (const u of urls) {
    try {
       
      console.debug("Gallery: fetching metadata", { url: u, attempt: 1 });
      return await fetchJsonWithTimeout(u, timeoutMs);
    } catch (e) {
      lastErr = e;
    }
  }
  if (isIpfs || looksLikeCid) {
    const m = s.replace(/ipfs:\/\//, "").match(/^([A-Za-z0-9]+)(?:\/.*)?$/);
    const cid = m?.[1];
    if (cid) {
      for (const g of gateways) {
        const rootBase = `https://${g}/ipfs/${cid}`;
        const rootCandidates = [rootBase, `${rootBase}?filename=metadata.json`];
        for (const rootUrl of rootCandidates) {
          try {
            console.debug("Gallery: fetching metadata (CID root)", { url: rootUrl, attempt: 1 });
            return await fetchJsonWithTimeout(rootUrl, timeoutMs);
          } catch (e) {
            lastErr = e;
          }
        }
      }
    }
  }
  throw lastErr || new Error("Failed to fetch metadata");
};
