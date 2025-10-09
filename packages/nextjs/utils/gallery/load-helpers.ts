import type { NFTMetaData } from "../simpleNFT/nftsMetadata";
import type React from "react";
import { resolveIpfsToHttp } from "../ipfs/uri-utils";
import { fetchIpfsJsonWithFallbacks } from "../ipfs/fetch-utils";
import type { GalleryItem } from "./types";

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

/**
 * Builds a strict 12-item catalog using baseURI only (kittenIds 1..12),
 * ignoring any discovered per-token entries. Owners are left empty; UI will
 * still read on-chain counters (minted/cap) by kittenId.
 */
async function buildCatalog12(kc: any): Promise<GalleryItem[]> {
  try {
    let base = "";
    try {
      base = String(await withTimeout(kc.read.baseURI(), 8000, "baseURI()"));
    } catch {
      try {
        const t1 = String(await withTimeout(kc.read.tokenURI([1n]), 8000, "tokenURI(1)"));
        const idx = t1.lastIndexOf("/");
        base = idx > 0 ? t1.substring(0, idx + 1) : t1;
      } catch {}
    }
    if (!base) return [];
    const targets = Array.from({ length: 12 }, (_, i) => i + 1);
    const items = await mapWithConcurrency(targets, 6, async id => {
      try {
        const uri = `${base}${id}.json`;
        const resolved = resolveIpfsToHttp(uri);
        let meta: NFTMetaData | undefined;
        try {
          meta = await fetchIpfsJsonWithFallbacks(resolved, 30000);
          console.debug(`Gallery: fetched metadata for kitten #${id}`, { meta });
        } catch (err) {
          console.warn(`Gallery: failed to fetch metadata for kitten #${id}`, { uri, resolved, err });
          // Retry once with a different gateway
          try {
            const altResolved = resolved.replace('ipfs.io', 'cloudflare-ipfs.com');
            console.debug(`Gallery: retrying kitten #${id} with alternate gateway`, { altResolved });
            meta = await fetchIpfsJsonWithFallbacks(altResolved, 30000);
            console.debug(`Gallery: retry succeeded for kitten #${id}`, { meta });
          } catch (retryErr) {
            console.warn(`Gallery: retry also failed for kitten #${id}`, { retryErr });
            // Create fallback with a placeholder image so it won't be filtered out
            meta = { 
              name: `Kitten #${id}`, 
              description: "Metadata loading...", 
              image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23262626'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='24' fill='%23888'%3EKitten %23" + id + "%3C/text%3E%3C/svg%3E"
            } as any;
          }
        }
        if (meta?.image && !meta.image.startsWith('data:')) {
          meta.image = resolveIpfsToHttp(String(meta.image));
        }
        return { id, uri, owner: "", ...meta } as GalleryItem;
      } catch (err) {
        console.error(`Gallery: error building catalog item #${id}`, err);
        return null as unknown as GalleryItem;
      }
    });
    const filtered = items.filter(Boolean) as GalleryItem[];
    console.debug(`Gallery: buildCatalog12 complete`, { total: filtered.length, items: filtered.map(i => i.id) });
    return filtered.sort((a, b) => a.id - b.id);
  } catch {
    return [];
  }
}
// Removed: ensureCatalog12 - unused helper function

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

function mergeAndPersist(
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

  // Deduplicate by kittenId: prefer catalog entries (id < 1_000_000) over per-token entries
  const byKitten = new Map<number, GalleryItem>();
  const getKittenId = (id: number) => (id >= 1_000_000 ? Math.floor(id / 1_000_000) : id);
  for (const item of sorted) {
    const kid = getKittenId(item.id);
    const existing = byKitten.get(kid);
    if (!existing) {
      byKitten.set(kid, item);
      continue;
    }
    // Prefer catalog entry (smaller id) or otherwise keep the first encountered
    const prefer = item.id < existing.id ? item : existing;
    byKitten.set(kid, prefer);
  }
  const deduped = Array.from(byKitten.values()).sort((a, b) => getKittenId(a.id) - getKittenId(b.id));

  if (contractAddress) writeCacheFn(contractAddress, deduped);
  return deduped;
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

// Removed unused helper functions: quickProbe, readTotalSupplySafe, loadBySupply, fallbackDiscovery

export async function performLoad(
  kc: any,
  contractAddress: string | undefined,
  isMounted: () => boolean,
  setItems: React.Dispatch<React.SetStateAction<GalleryItem[]>>,
  writeCacheFn: (addr: string, data: GalleryItem[]) => void,
  loadedForAddressRef: React.MutableRefObject<string | null>,
  ignoreCacheRef: React.MutableRefObject<boolean>,
) {
  // Catalog-only: build 12 items from baseURI and ignore per-token entries
  const fetched: GalleryItem[] = await buildCatalog12(kc);
  runIfMounted(isMounted, () => {
    setItems(prev => mergeAndPersist(fetched, prev, contractAddress, writeCacheFn));
  });
  loadedForAddressRef.current = contractAddress ?? loadedForAddressRef.current;
  ignoreCacheRef.current = false;
}
