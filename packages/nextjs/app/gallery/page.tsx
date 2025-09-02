"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseEther } from "viem";
import { useAccount, useReadContract } from "wagmi";
// no wallet-dependent logic here
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useScaffoldWriteContract } from "~~/hooks/scaffold-eth/useScaffoldWriteContract";
import { NFTCard } from "~~/partials/nft/nft-card";
import { NFTCardSkeleton } from "~~/partials/nft/nft-card.skeleton";
import { NFTMetaData } from "~~/utils/simpleNFT/nftsMetadata";

export interface GalleryItem extends Partial<NFTMetaData> {
  id: number;
  uri: string;
  owner: string;
}

const normalizeUri = (input: any): string => {
  let s = String(input ?? "").trim();
  // Attempt to decode percent-encoded wrappers like %22...%22
  try {
    // Only attempt when we see common encoded quote markers to avoid over-decoding
    if (/%22|%27/.test(s)) {
      const dec = decodeURIComponent(s);
      if (dec) s = dec.trim();
    }
  } catch {
    // ignore decode errors
  }
  // peel quoted layers up to 3 times
  for (let i = 0; i < 3; i++) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    } else {
      break;
    }
  }
  // unescape common escaped quotes
  if (s.includes('\\"')) s = s.replace(/\\"/g, '"');
  if (s.includes("\\'")) s = s.replace(/\\'/g, "'");
  // strip encoded quote wrappers if present after decode step
  if (s.startsWith("%22") && s.endsWith("%22")) s = s.slice(3, -3).trim();
  if (s.startsWith("%27") && s.endsWith("%27")) s = s.slice(3, -3).trim();
  // strip outer brackets if it looks like [value]
  if (s.startsWith("[") && s.endsWith("]")) {
    s = s.slice(1, -1).trim();
  }
  // try JSON.parse up to 2 times if it looks like JSON
  for (let i = 0; i < 2; i++) {
    if (s.startsWith("[") || s.startsWith("{")) {
      try {
        const parsed: any = JSON.parse(s);
        if (Array.isArray(parsed)) {
          s = String(parsed[0] ?? "");
        } else if (parsed && typeof parsed === "object") {
          s = String(parsed.uri ?? parsed.url ?? parsed.image ?? "");
        } else {
          s = String(parsed);
        }
        s = s.trim();
        continue;
      } catch {
        // not valid JSON, fall through
      }
    }
    break;
  }
  // peel quotes again after JSON parsing
  for (let i = 0; i < 2; i++) {
    if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
      s = s.slice(1, -1).trim();
    }
  }
  // strip any stray leading wrapping characters until we reach plausible start
  while (s && (s[0] === '"' || s[0] === "'" || s[0] === "[" || s[0] === "{" || s[0] === "(")) {
    s = s.slice(1).trim();
  }
  while (s && (s.endsWith('"') || s.endsWith("'") || s.endsWith("]") || s.endsWith(")"))) {
    s = s.slice(0, -1).trim();
  }
  // If string contains an ipfs:// URL, extract it (handles stray brackets/quotes)
  if (s.includes("ipfs://") || s.includes("ipfs:/")) {
    // normalize single slash to double slash first
    s = s.replace(/ipfs:\/(?!\/)/g, "ipfs://");
    const m = s.match(/ipfs:\/\/[A-Za-z0-9._\-\/]+/);
    if (m && m[0]) {
      s = m[0];
    }
  }
  // remove stray trailing characters that commonly remain
  while (s.endsWith(")") || s.endsWith("]") || s.endsWith("}") || s.endsWith('"') || s.endsWith("'")) {
    s = s.slice(0, -1).trim();
  }
  return s;
};

const resolveIpfsToHttp = (uri: string, gatewayHost = "nftstorage.link"): string => {
  const s = normalizeUri(uri);
  if (!s) return s;
  // bare CID support (bafy... or Qm...)
  if (/^(bafy[\w]+|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/.*)?$/.test(s)) {
    const path = s.replace(/^\/+/, "");
    return `https://${gatewayHost}/ipfs/${path}`;
  }
  // normalize single slash to double slash in ipfs protocol
  const normalizedIpfs = s.replace(/ipfs:\/(?!\/)/g, "ipfs://");
  if (normalizedIpfs.startsWith("ipfs://")) {
    const path = normalizedIpfs.replace(/^ipfs:\/\//, "").replace(/^\/+/, "");
    return `https://${gatewayHost}/ipfs/${path}`;
  }
  // If already an HTTP URL, collapse duplicate slashes in the pathname (keep protocol intact)
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      u.pathname = u.pathname.replace(/\/{2,}/g, "/");
      return u.toString();
    } catch {
      return s;
    }
  }
  return normalizedIpfs;
};

const fetchJsonWithTimeout = async (url: string, timeoutMs = 12000) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let finalUrl = url;
    try {
      const u = new URL(url);
      u.searchParams.set("_", String(Date.now()));
      finalUrl = u.toString();
    } catch {
      // if not a valid URL, just attempt fetch; some gateways still accept it
    }
    const res = await fetch(finalUrl, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return (await res.json()) as NFTMetaData;
    }
    // Fallback: try text and parse as JSON
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

const fetchIpfsJsonWithFallbacks = async (rawUri: string, timeoutMs = 12000): Promise<NFTMetaData> => {
  const gateways = ["nftstorage.link", "cloudflare-ipfs.com", "ipfs.io", "gateway.pinata.cloud", "dweb.link"];
  const s = normalizeUri(rawUri);
  // Inline JSON support
  if (s.startsWith("{") && s.endsWith("}")) {
    try {
      return JSON.parse(s) as NFTMetaData;
    } catch {
      // fall through to gateways
    }
  }
  // data:application/json[;base64],... support
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
  // Also support bare CID strings
  const looksLikeCid = /^(bafy[\w]+|Qm[1-9A-HJ-NP-Za-km-z]{44})(\/.*)?$/.test(s);
  const baseUrls = isIpfs || looksLikeCid ? gateways.map(g => resolveIpfsToHttp(s, g)) : [s];
  const urls: string[] = [];
  // generate URL variants per base (some gateways need a filename hint for raw blocks)
  for (const b of baseUrls) {
    urls.push(b);
    try {
      const u = new URL(b);
      // add filename hint
      const withName = new URL(u.toString());
      if (!withName.searchParams.has("filename")) {
        withName.searchParams.set("filename", "metadata.json");
        urls.push(withName.toString());
      }
      // if ends with '/', also try without
      if (u.pathname.endsWith("/")) {
        const noSlash = new URL(u.toString());
        noSlash.pathname = noSlash.pathname.replace(/\/+$/, "");
        urls.push(noSlash.toString());
      }
    } catch {
      // if not a valid URL, just keep base string
    }
  }
  let lastErr: any;
  for (const u of urls) {
    // single attempt per URL to move quickly to a working gateway
    try {
      console.debug("Gallery: fetching metadata", { url: u, attempt: 1 });
      return await fetchJsonWithTimeout(u, timeoutMs);
    } catch (e) {
      lastErr = e;
    }
  }
  // Fallback: try CID root if original path failed
  if (isIpfs || looksLikeCid) {
    // extract CID from ipfs://<cid>/... or from bare CID with optional path
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

async function mapWithConcurrency<T, U>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results: U[] = new Array(items.length) as any;
  let i = 0;
  const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
    while (true) {
      const current = i++;
      if (current >= items.length) break;
      results[current] = await mapper(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
}

const withTimeout = async <T,>(p: Promise<T>, ms = 10000, label = "operation") => {
  let t: any;
  const timeout = new Promise<never>((_, rej) => {
    t = setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(t);
  }
};

const GalleryPage = () => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  // refreshKey removed; use on-mount load only

  // Mint UI removed for Kittens; reads only

  const { data: kittensContract } = useScaffoldContract({ contractName: "Kittens" });
  const kittensContractRef = useRef<typeof kittensContract>(undefined);
  const [contractAddress, setContractAddress] = useState<string | undefined>(undefined);
  const loadedForAddressRef = useRef<string | null>(null);
  const contractAddressRef = useRef<string | undefined>(undefined);
  const hydratedCacheForAddressRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const ignoreCacheRef = useRef(false);
  // no writes in gallery

  const readCache = (addr: string): GalleryItem[] | null => {
    try {
      const raw = localStorage.getItem(`gallery:${addr}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { ts?: number; items?: GalleryItem[] };
      if (!parsed || !Array.isArray(parsed.items)) return null;
      const items = parsed.items
        .filter(Boolean)
        // require some metadata to avoid blank cards after refresh
        .filter(it => Boolean((it as any).image || (it as any).name))
        .sort((a, b) => a.id - b.id);
      return items.length ? items : null;
    } catch {
      return null;
    }
  };

  // Mint action removed for Kittens to avoid signature mismatch; gallery is read-only

  const writeCache = (addr: string, data: GalleryItem[]) => {
    try {
      // only persist items that have some metadata to avoid poisoning cache
      const prunable = data.filter(it => Boolean((it as any).image || (it as any).name));
      localStorage.setItem(`gallery:${addr}`, JSON.stringify({ ts: Date.now(), items: prunable }));
    } catch {
      // ignore
    }
  };

  // Track contract instance in a ref and a stable address in state
  useEffect(() => {
    kittensContractRef.current = kittensContract;
    const addr = (kittensContract as any)?.address as string | undefined;
    if (addr !== contractAddressRef.current) {
      contractAddressRef.current = addr;
    }
    setContractAddress(addr);
  }, [kittensContract]);

  // Persist cache and flip UI out of loading when we have items
  useEffect(() => {
    if (items.length === 0) return;
    if (!loadedOnce) {
      setLoadedOnce(true);
    }
    if (loading) {
      setLoading(false);
    }
    const addr = contractAddressRef.current;
    if (addr) writeCache(addr, items);
    // No further action; if we changed state, this effect may run once more with updated flags, but will no-op
  }, [items, loadedOnce, loading]);

  useEffect(() => {
    let isMounted = true;
    console.debug("Gallery: effect mounted", { address: contractAddress });
    const loadAll = async () => {
      const kc = kittensContractRef.current as any;
      if (!kc) {
        // If contract is not yet available, don't keep spinner forever
        if (isMounted) {
          setLoading(false);
          setLoadedOnce(true);
        }
        console.debug("Gallery: no contract instance yet (useScaffoldContract not ready)");
        return;
      }
      const contractAddress = (kc as any).address as string | undefined;
      console.debug("Gallery: loading for contract", { address: contractAddress });
      // Try cache first (unless refresh requested) — but do NOT return; proceed to fresh load
      if (contractAddress && !ignoreCacheRef.current && hydratedCacheForAddressRef.current !== contractAddress) {
        const cached2 = readCache(contractAddress);
        if (cached2 && isMounted) {
          // Only hydrate once per address and only if we don't already have items
          if (items.length === 0) {
            console.debug("Gallery: using cache before fresh load", { count: cached2.length });
            setItems(cached2);
            setLoadedOnce(true);
            // Backfill owners in background so card owner appears without refresh
            const missingOwners = cached2.filter(it => !it.owner);
            if (missingOwners.length) {
              (async () => {
                try {
                  await mapWithConcurrency(missingOwners, 6, async it => {
                    try {
                      const owner = await withTimeout(
                        kc.read.ownerOf([BigInt(it.id)]),
                        8000,
                        "ownerOf(cache-backfill)",
                      );
                      if (!isMounted) return;
                      setItems(prev => prev.map(p => (p.id === it.id ? { ...p, owner: String(owner) } : p)));
                    } catch {
                      /* ignore owner failures */
                    }
                    return null as any;
                  });
                } catch {
                  /* ignore */
                }
              })();
            }
          }
          hydratedCacheForAddressRef.current = contractAddress;
        }
      }
      if (contractAddress && loadedForAddressRef.current === contractAddress) return; // already loaded for this address
      if (loadingRef.current) return; // avoid concurrent loads
      loadingRef.current = true;
      if (isMounted) {
        if (!loadingRef.current) setLoading(true);
        setError(null);
      }
      try {
        // removed duplicate cache hydration (done earlier before try)

        // Kick off a bootstrap quick probe so something renders fast if IDs are offset
        // This runs in parallel and updates items if it finds anything
        (async () => {
          const quickBases = [1_000_000, 1_000_001];
          const maxQuick = 20;
          const probeIdx = quickBases.flatMap(base => Array.from({ length: maxQuick }, (_, i) => i + base));
          try {
            console.debug("Gallery: quick probe start", { ranges: quickBases.map(b => `${b}-${b + maxQuick - 1}`) });
            const results = await mapWithConcurrency(probeIdx, 6, async id => {
              try {
                const tokenId = BigInt(id);
                const tokenURI = await withTimeout(kc.read.tokenURI([tokenId]), 8000, "tokenURI(quick)");
                const resolved = resolveIpfsToHttp(String(tokenURI));
                let meta: NFTMetaData | undefined;
                try {
                  meta = await fetchIpfsJsonWithFallbacks(resolved, 12000);
                } catch {
                  meta = { name: `Token #${id}`, description: "Metadata unavailable", image: "" } as any;
                }
                if (meta?.image) meta.image = resolveIpfsToHttp(String(meta.image));
                // Fire-and-forget owner fetch; update state when it arrives
                (async () => {
                  try {
                    const owner = await withTimeout(kc.read.ownerOf([tokenId]), 8000, "ownerOf(quick)");
                    setItems(prev => prev.map(it => (it.id === id ? { ...it, owner: String(owner) } : it)));
                  } catch {}
                })();
                return { id, uri: tokenURI, owner: "", ...meta } as GalleryItem;
              } catch {
                return null as unknown as GalleryItem;
              }
            });
            const quick = results.filter(Boolean) as GalleryItem[];
            console.debug("Gallery: quick probe results", { found: quick.length });
            if (isMounted && quick.length) {
              const quickSorted = quick.sort((a, b) => a.id - b.id);
              // Only set if we don't already have items, to avoid flicker
              setItems(prev => (prev.length ? prev : quickSorted));
              // Make UI show cards immediately while main load continues
              setLoading(false);
              setLoadedOnce(true);
            }
          } catch {
            // ignore quick probe failures
          }
        })();

        let supply = 0;
        try {
          console.debug("Gallery: reading totalSupply()");
          const supplyBn = await kc.read.totalSupply();
          supply = Number(await withTimeout(Promise.resolve(supplyBn), 10000, "totalSupply()"));
          console.debug("Gallery: totalSupply read", { supply });
        } catch {
          // Contracts without ERC721Enumerable won't have totalSupply(); keep supply = 0 and try fallbacks below
          supply = 0;
          console.debug("Gallery: totalSupply not available (non-enumerable or failed), using discovery fallbacks");
        }

        // Load with controlled concurrency (pool size = 6)
        const indices = Array.from({ length: supply }, (_, i) => i);
        const mapped = await mapWithConcurrency(indices, 6, async i => {
          try {
            let tokenId: bigint | null = null;
            // Primary: ERC721Enumerable
            try {
              tokenId = await withTimeout(kc.read.tokenByIndex([BigInt(i)]), 8000, "tokenByIndex()");
            } catch {
              // Fallback A: assume 0-based sequential IDs
              try {
                await withTimeout(kc.read.ownerOf([BigInt(i)]), 8000, "ownerOf(0-based)");
                tokenId = BigInt(i);
                // debug: fallback 0-based tokenId
              } catch {
                // Fallback B: assume 1-based sequential IDs
                tokenId = BigInt(i + 1);
                // debug: fallback 1-based tokenId
              }
            }

            const rawTokenURI = await withTimeout(kc.read.tokenURI([tokenId!]), 8000, "tokenURI()");
            const resolved = resolveIpfsToHttp(String(rawTokenURI));
            console.debug("Gallery: tokenURI", {
              tokenId: Number(tokenId),
              rawTokenURI: String(rawTokenURI),
              normalized: normalizeUri(String(rawTokenURI)),
              resolved,
            });
            let meta: NFTMetaData | undefined;
            try {
              meta = await fetchIpfsJsonWithFallbacks(resolved, 12000);
            } catch (e) {
              console.warn("Gallery: metadata fetch failed", {
                tokenId: Number(tokenId),
                url: JSON.stringify(resolved),
                normalizedUri: normalizeUri(String(rawTokenURI)),
                error: String(e),
              });
              meta = { name: `Token #${Number(tokenId)}`, description: "Metadata unavailable", image: "" } as any;
            }
            if (meta?.image) {
              let img = String(meta.image);
              // If image is relative, resolve against tokenURI directory
              if (!/^https?:\/\//i.test(img) && !img.startsWith("ipfs://")) {
                try {
                  const dir = resolved.endsWith("/") ? resolved : resolved.substring(0, resolved.lastIndexOf("/") + 1);
                  img = new URL(img, dir).toString();
                } catch {
                  // ignore URL resolution errors
                }
              }
              const cleanedImg = resolveIpfsToHttp(img);
              meta.image = cleanedImg;
              console.debug("Gallery: image resolved", {
                tokenId: Number(tokenId),
                imageRaw: String(meta.image),
                imageFinal: cleanedImg,
              });
            }
            // Fetch owner in background; don't block rendering
            (async () => {
              try {
                const owner = await withTimeout(kc.read.ownerOf([tokenId!]), 8000, "ownerOf(tokenId)");
                setItems(prev => prev.map(it => (it.id === Number(tokenId) ? { ...it, owner: String(owner) } : it)));
              } catch {}
            })();
            const item = { id: Number(tokenId), uri: String(rawTokenURI), owner: "", ...meta } as GalleryItem;
            // Incremental append so UI shows real cards ASAP
            console.debug("Gallery: append item", { id: item.id });
            setItems(prev => {
              if (prev.some(p => p.id === item.id)) return prev;
              const next = [...prev, item].sort((a, b) => a.id - b.id);
              if (prev.length === 0) {
                setLoading(false);
                setLoadedOnce(true);
              }
              return next;
            });
            return item;
          } catch (e) {
            console.error("Gallery token load failed", e);
            return null as unknown as GalleryItem;
          }
        });

        let fetched: GalleryItem[] = mapped.filter(Boolean).sort((a, b) => a!.id - b!.id);
        console.debug("Gallery: main load mapped", { count: fetched.length });

        // Fallback discovery when no Enumerable and supply read is 0
        if (supply === 0 && fetched.length === 0) {
          console.debug("Gallery: fallback discovery start");
          const discover = async (base: number) => {
            const maxProbe = 100; // expanded cap per base
            const probeIdx = Array.from({ length: maxProbe }, (_, i) => i + base);
            const results = await mapWithConcurrency(probeIdx, 6, async id => {
              try {
                const tokenId = BigInt(id);
                const tokenURI = await withTimeout(kc.read.tokenURI([tokenId]), 8000, "tokenURI(fallback)");
                const resolved = resolveIpfsToHttp(String(tokenURI));
                let meta: NFTMetaData | undefined;
                try {
                  meta = await fetchIpfsJsonWithFallbacks(resolved, 12000);
                  console.debug("Gallery: metadata fetched (fallback)", { tokenId: id });
                } catch {
                  console.warn("Gallery: metadata fetch failed (fallback)", { tokenId: id, url: resolved });
                  meta = { name: `Token #${id}`, description: "Metadata unavailable", image: "" } as any;
                }
                if (meta?.image) {
                  meta.image = resolveIpfsToHttp(String(meta.image));
                }
                // Background owner fetch
                (async () => {
                  try {
                    const owner = await withTimeout(kc.read.ownerOf([tokenId]), 8000, "ownerOf(fallback)");
                    setItems(prev => prev.map(it => (it.id === id ? { ...it, owner: String(owner) } : it)));
                  } catch {}
                })();
                return { id, uri: tokenURI, owner: "", ...meta } as GalleryItem;
              } catch {
                return null as unknown as GalleryItem;
              }
            });
            return results.filter(Boolean) as GalleryItem[];
          };

          const bases = [0, 1, 999_999, 1_000_000, 1_000_001, 1_000_010];
          console.debug("Gallery: fallback bases", { bases });
          const discoveredLists: GalleryItem[][] = [];
          for (const b of bases) {
            const res = await discover(b);
            console.debug("Gallery: fallback base result", { base: b, found: res.length });
            if (res.length) discoveredLists.push(res);
          }
          const combinedMap = discoveredLists.flat().reduce((map, item) => {
            map.set(item.id, item);
            return map;
          }, new Map<number, GalleryItem>());
          fetched = Array.from(combinedMap.values()).sort((a, b) => a.id - b.id);
          console.debug("Gallery: fallback discovery combined", { count: fetched.length });
        }

        // Update state and cache (merge to preserve any already-fetched owners)
        if (isMounted) {
          console.debug("Gallery: setting fetched items", { count: fetched.length });
          setItems(prev => {
            const prevById = new Map(prev.map(p => [p.id, p] as const));
            const merged = fetched.map(it => {
              const existing = prevById.get(it.id);
              // preserve existing owner if present
              const owner = existing?.owner && existing.owner.length > 0 ? existing.owner : it.owner;
              return { ...it, owner } as GalleryItem;
            });
            // Carry over any extra prev items not in fetched (unlikely, but safe)
            for (const p of prev) {
              if (!prevById.has(p.id) && !merged.some(m => m.id === p.id)) merged.push(p);
            }
            const sorted = merged.sort((a, b) => a.id - b.id);
            if (contractAddress) writeCache(contractAddress, sorted);
            return sorted;
          });
        }
        if (contractAddress) loadedForAddressRef.current = contractAddress;
        ignoreCacheRef.current = false;
      } catch (e: any) {
        console.error(e);
        if (isMounted) setError(e?.message || "Failed to load gallery");
      } finally {
        loadingRef.current = false;
        if (isMounted) {
          setLoading(false);
          setLoadedOnce(true);
          console.debug("Gallery: loadAll finished");
        }
      }
    };

    // Ensure timeouts flip UI state rather than leaving spinner indefinitely
    withTimeout(loadAll(), 60000, "load gallery").catch(err => {
      console.warn("Gallery load timeout", err);
      if (isMounted) {
        setLoading(false);
        setLoadedOnce(true);
        setError(prev => prev || (err?.message ?? "Load timed out"));
      }
      loadingRef.current = false;
    });
    return () => {
      isMounted = false;
    };
  }, [contractAddress]);

  // Render
  return (
    <section className="min-h-screen">
      <div className="container mx-auto px-4">
        <div className="mt-10 mb-6 grid grid-cols-1 items-center">
          <h1 className="text-center text-3xl md:text-5xl font-bold">Gallery</h1>
          {/* Small status badge: show only while loading */}
          {loading && (
            <div className="mt-3 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-neutral-900/70 px-3 py-1 text-xs text-neutral-200 backdrop-blur">
                <span className="loading loading-spinner loading-sm" aria-label="Loading" />
              </span>
            </div>
          )}
        </div>

        {/* Mint panel removed per request; per-card Mint remains */}

        {error && (
          <div className="alert alert-error my-4">
            <span>{error}</span>
          </div>
        )}

        {/* Always render the grid for visibility; show skeletons or items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
          {(() => {
            const showSkeletons = items.length === 0 && (loading || ignoreCacheRef.current || !loadedOnce);
            if (showSkeletons) {
              return Array.from({ length: 12 }).map((_, i) => <NFTCardSkeleton key={`s-${i}`} />);
            }
            const ownerFilter = "0xF4220e5c9882746f4F52FC61Dcfd1095c5D563e6".toLowerCase();
            const filtered = items.filter(it => (it.owner || "").toLowerCase() === ownerFilter);
            if (filtered.length === 0) {
              return (
                <div className="col-span-full my-10 text-center text-neutral-700 dark:text-neutral-200">
                  <p>No NFTs found for this owner.</p>
                </div>
              );
            }
            const visible = filtered.slice(0, 12);
            return visible.map(nft => <GalleryCard key={nft.id} item={nft} />);
          })()}
        </div>

        {/* Refresh status only when active */}
        {ignoreCacheRef.current && (
          <div className="mt-8 flex items-center justify-start text-xs text-neutral-500">
            <span>Refreshing…</span>
          </div>
        )}

        {/* Footer navigation */}
        <div className="mt-6 mb-10 flex items-center justify-between">
          <Link href="/" className="btn btn-ghost">
            ← Back: Home
          </Link>
          <Link href="/myNFTs" className="btn btn-ghost">
            Next: My NFTs →
          </Link>
        </div>
      </div>
    </section>
  );
};

export default GalleryPage;

// --- Per-card wrapper to add Mint CTA with sold-out state ---
const GalleryCard: React.FC<{ item: GalleryItem }> = ({ item }) => {
  const { address } = useAccount();
  const kittenId = Math.floor(item.id / 1_000_000);

  const { data: deployed } = useDeployedContractInfo({ contractName: "Kittens" as any });
  const { data: saleActive } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "saleActive",
  });
  const { data: mintedBn } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "mintedPerKitten",
    args: [BigInt(kittenId)],
  });
  const { data: maxPerBn } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "maxPerKitten",
    args: [BigInt(kittenId)],
  });
  const { data: defaultMaxBn } = useReadContract({
    address: deployed?.address,
    abi: deployed?.abi as any,
    functionName: "defaultMaxPerKitten",
  });

  const cap = (maxPerBn && maxPerBn !== 0n ? maxPerBn : defaultMaxBn) ?? 0n;
  const minted = mintedBn ?? 0n;
  const isSoldOut = cap !== 0n && minted >= cap;

  const { writeContractAsync, isMining } = useScaffoldWriteContract({ contractName: "Kittens" });

  const onMint = async () => {
    if (!address || !saleActive || isSoldOut) return;
    await writeContractAsync({
      functionName: "mintItem",
      args: [address, BigInt(kittenId), item.uri],
      value: parseEther("0.05"),
    });
  };

  const cta = {
    label: isSoldOut ? "Sold out" : "Mint 0.05 TTRUST",
    disabled: !saleActive || isSoldOut || !address,
    loading: isMining,
    onClick: onMint,
  } as const;

  const mintedNum = Number(minted);
  const capNum = cap !== 0n ? Number(cap) : undefined;
  const belowCta = (
    <div className="w-full text-center text-xs text-neutral-500 tabular-nums">
      {capNum ? `Minted ${mintedNum}/${capNum}` : `Minted ${mintedNum}`}
    </div>
  );

  return (
    <NFTCard
      id={item.id}
      name={item.name || `Token #${item.id}`}
      imageUrl={item.image || ""}
      description={item.description || ""}
      owner={item.owner || undefined}
      mediaAspect="1:1"
      ctaPrimary={cta}
      belowCta={belowCta}
    />
  );
};
