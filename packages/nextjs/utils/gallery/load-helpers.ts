import type { NFTMetaData } from "../simpleNFT/nftsMetadata";
import type React from "react";
import { resolveIpfsToHttp } from "../ipfs/uri-utils";
import { fetchIpfsJsonWithFallbacks } from "../ipfs/fetch-utils";
import type { GalleryItem } from "./types";

export async function mapWithConcurrency<T, U>(
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

export const withTimeout = async <T,>(p: Promise<T>, ms = 10000, label = "operation") => {
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

export function shouldStartLoad(
  contractAddress: string | undefined,
  loadedForAddressRef: React.MutableRefObject<string | null>,
  loadingRef: React.MutableRefObject<boolean>,
): boolean {
  if (contractAddress && loadedForAddressRef.current === contractAddress) return false;
  if (loadingRef.current) return false;
  loadingRef.current = true;
  return true;
}

export function mergeAndPersist(
  fetched: GalleryItem[],
  prevItems: GalleryItem[],
  contractAddress: string | undefined,
  writeCacheFn: (addr: string, data: GalleryItem[]) => void,
): GalleryItem[] {
  const prevById = new Map(prevItems.map(p => [p.id, p] as const));
  const merged = fetched.map(it => {
    const existing = prevById.get(it.id);
    const owner = existing?.owner && existing.owner.length > 0 ? existing.owner : it.owner;
    return { ...it, owner } as GalleryItem;
  });
  for (const p of prevItems) {
    if (!prevById.has(p.id) && !merged.some(m => m.id === p.id)) merged.push(p);
  }
  const sorted = merged.sort((a, b) => a.id - b.id);
  if (contractAddress) writeCacheFn(contractAddress, sorted);
  return sorted;
}

export function runIfMounted(isMounted: () => boolean, fn: () => void) {
  if (isMounted()) fn();
}

export function hydrateFromCache(
  kc: any,
  contractAddress: string | undefined,
  isMounted: () => boolean,
  itemsLenRef: React.MutableRefObject<number>,
  readCacheFn: (addr: string) => GalleryItem[] | null,
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>,
  setLoadedOnce: (b: boolean) => void,
  ignoreRef: React.MutableRefObject<boolean>,
  hydratedRef: React.MutableRefObject<string | null>,
) {
  if (!contractAddress) return;
  if (ignoreRef.current) return;
  if (hydratedRef.current === contractAddress) return;
  const cached2 = readCacheFn(contractAddress);
  if (cached2 && isMounted()) {
    if (itemsLenRef.current === 0) {
      // Reason: hydrate cached items quickly to avoid empty UI while network fetch continues
      setItems(cached2);
      setLoadedOnce(true);
      const missingOwners = cached2.filter(it => !it.owner);
      if (missingOwners.length) {
        (async () => {
          try {
            await mapWithConcurrency(missingOwners, 6, async it => {
              try {
                const owner = await withTimeout(kc.read.ownerOf([BigInt(it.id)]), 8000, "ownerOf(cache-backfill)");
                if (!isMounted()) return null as any;
                setItems(prev => prev.map(p => (p.id === it.id ? { ...p, owner: String(owner) } : p)));
              } catch {}
              return null as any;
            });
          } catch {}
        })();
      }
    }
    hydratedRef.current = contractAddress;
  }
}

export async function quickProbe(
  kc: any,
  isMounted: () => boolean,
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>,
  setLoading: (b: boolean) => void,
  setLoadedOnce: (b: boolean) => void,
) {
  const quickBases = [1_000_000, 1_000_001];
  const maxQuick = 20;
  const probeIdx = quickBases.flatMap(base => Array.from({ length: maxQuick }, (_, i) => i + base));
  try {
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
    if (isMounted() && quick.length) {
      const quickSorted = quick.sort((a, b) => a.id - b.id);
      setItems(prev => (prev.length ? prev : quickSorted));
      setLoading(false);
      setLoadedOnce(true);
    }
  } catch {}
}

export async function readTotalSupplySafe(kc: any): Promise<number> {
  try {
    const supplyBn = await kc.read.totalSupply();
    return Number(await withTimeout(Promise.resolve(supplyBn), 10000, "totalSupply()"));
  } catch {
    return 0;
  }
}

export async function loadBySupply(
  kc: any,
  supply: number,
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>,
): Promise<GalleryItem[]> {
  const indices = Array.from({ length: supply }, (_, i) => i);
  const mapped = await mapWithConcurrency(indices, 6, async i => {
    try {
      let tokenId: bigint | null = null;
      try {
        tokenId = await withTimeout(kc.read.tokenByIndex([BigInt(i)]), 8000, "tokenByIndex()");
      } catch {
        try {
          await withTimeout(kc.read.ownerOf([BigInt(i)]), 8000, "ownerOf(0-based)");
          tokenId = BigInt(i);
        } catch {
          tokenId = BigInt(i + 1);
        }
      }
      const rawTokenURI = await withTimeout(kc.read.tokenURI([tokenId!]), 8000, "tokenURI()");
      const resolved = resolveIpfsToHttp(String(rawTokenURI));
      let meta: NFTMetaData | undefined;
      try {
        meta = await fetchIpfsJsonWithFallbacks(resolved, 12000);
      } catch {
        meta = { name: `Token #${Number(tokenId)}`, description: "Metadata unavailable", image: "" } as any;
      }
      if (meta?.image) {
        let img = String(meta.image);
        if (!/^https?:\/\//i.test(img) && !img.startsWith("ipfs://")) {
          try {
            const dir = resolved.endsWith("/") ? resolved : resolved.substring(0, resolved.lastIndexOf("/") + 1);
            img = new URL(img, dir).toString();
          } catch {}
        }
        const cleanedImg = resolveIpfsToHttp(img);
        meta.image = cleanedImg;
      }
      (async () => {
        try {
          const owner = await withTimeout(kc.read.ownerOf([tokenId!]), 8000, "ownerOf(tokenId)");
          setItems(prev => prev.map(it => (it.id === Number(tokenId) ? { ...it, owner: String(owner) } : it)));
        } catch {}
      })();
      const item = { id: Number(tokenId), uri: String(rawTokenURI), owner: "", ...meta } as GalleryItem;
      setItems(prev => {
        if (prev.some(p => p.id === item.id)) return prev;
        const next = [...prev, item].sort((a, b) => a.id - b.id);
        return next;
      });
      return item;
    } catch {
      return null as unknown as GalleryItem;
    }
  });
  return (mapped.filter(Boolean) as GalleryItem[]).sort((a, b) => a.id - b.id);
}

export async function fallbackDiscovery(
  kc: any,
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>,
): Promise<GalleryItem[]> {
  const discover = async (base: number) => {
    const maxProbe = 100;
    const probeIdx = Array.from({ length: maxProbe }, (_, i) => i + base);
    const results = await mapWithConcurrency(probeIdx, 6, async id => {
      try {
        const tokenId = BigInt(id);
        const tokenURI = await withTimeout(kc.read.tokenURI([tokenId]), 8000, "tokenURI(fallback)");
        const resolved = resolveIpfsToHttp(String(tokenURI));
        let meta: NFTMetaData | undefined;
        try {
          meta = await fetchIpfsJsonWithFallbacks(resolved, 12000);
        } catch {
          meta = { name: `Token #${id}`, description: "Metadata unavailable", image: "" } as any;
        }
        if (meta?.image) {
          meta.image = resolveIpfsToHttp(String(meta.image));
        }
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
  const discoveredLists: GalleryItem[][] = [];
  for (const b of bases) {
    const res = await discover(b);
    if (res.length) discoveredLists.push(res);
  }
  const combinedMap = discoveredLists.flat().reduce((map, item) => {
    map.set(item.id, item);
    return map;
  }, new Map<number, GalleryItem>());
  return Array.from(combinedMap.values()).sort((a, b) => a.id - b.id);
}

export async function performLoad(
  kc: any,
  contractAddress: string | undefined,
  isMounted: () => boolean,
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>,
  setLoading: (b: boolean) => void,
  setLoadedOnce: (b: boolean) => void,
  writeCacheFn: (addr: string, data: GalleryItem[]) => void,
  loadedForAddressRef: React.MutableRefObject<string | null>,
  ignoreCacheRef: React.MutableRefObject<boolean>,
) {
  await quickProbe(kc, isMounted, setItems, () => setLoading(false), () => setLoadedOnce(true));
  const supply = await readTotalSupplySafe(kc);
  let fetched: GalleryItem[] = [];
  if (supply > 0) {
    fetched = await loadBySupply(kc, supply, setItems);
  }
  if (fetched.length === 0) {
    fetched = await fallbackDiscovery(kc, setItems);
  }
  runIfMounted(isMounted, () => {
    setItems(prev => mergeAndPersist(fetched, prev, contractAddress, writeCacheFn));
  });
  loadedForAddressRef.current = contractAddress ?? loadedForAddressRef.current;
  ignoreCacheRef.current = false;
}
