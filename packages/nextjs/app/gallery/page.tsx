"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
// no wallet-dependent logic here
import { useScaffoldContract } from "~~/hooks/scaffold-eth";
import { NFTCardSkeleton } from "~~/partials/nft/nft-card.skeleton";
import type { GalleryItem } from "../../utils/gallery/types";
import {
  withTimeout,
  shouldStartLoad,
  runIfMounted,
  hydrateFromCache,
  performLoad,
} from "../../utils/gallery/load-helpers";
import { GalleryCard } from "../../partials/nft/gallery-card";

// Small helper to render grid contents with low complexity
function renderGalleryGrid(items: GalleryItem[], loading: boolean, loadedOnce: boolean, isRefreshing: boolean) {
  const showSkeletons = items.length === 0 && (loading || isRefreshing || !loadedOnce);
  if (showSkeletons) {
    return Array.from({ length: 12 }).map((_, i) => <NFTCardSkeleton key={`s-${i}`} />);
  }
  const ownerFilter = "0xF4220e5c9882746f4F52FC61Dcfd1095c5D563e6".toLowerCase();
  const filtered = items.filter(it => (it.owner || "").toLowerCase() === ownerFilter);
  if (filtered.length === 0) {
    // Always show spinner if nothing to render for the owner filter
    return (
      <div className="col-span-full my-10 flex justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  const visible = filtered.slice(0, 12);
  return visible.map(nft => <GalleryCard key={nft.id} item={nft} />);
}


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

  // Track items length in a ref to avoid adding it to load effect deps
  const itemsLenRef = useRef(0);
  useEffect(() => {
    itemsLenRef.current = items.length;
  }, [items]);

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
  }, [items, items.length, loadedOnce, loading]);

  useEffect(() => {
    let isMounted = true;
    console.debug("Gallery: effect mounted", { address: contractAddress });
    const loadAll = async () => {
      const kc = kittensContractRef.current as any;
      if (!kc) {
        // If contract is not yet available, don't keep spinner forever
        runIfMounted(() => isMounted, () => {
          setLoading(false);
          setLoadedOnce(true);
        });
        console.debug("Gallery: no contract instance yet (useScaffoldContract not ready)");
        return;
      }
      const contractAddress = (kc as any).address as string | undefined;
      console.debug("Gallery: loading for contract", { address: contractAddress });
      // Try cache first (non-blocking), proceed to fresh load
      hydrateFromCache(
        kc,
        contractAddress,
        () => isMounted,
        itemsLenRef,
        readCache,
        setItems,
        setLoadedOnce,
        ignoreCacheRef,
        hydratedCacheForAddressRef,
      );
      // Start load only if not already loading and not already loaded for this address
      if (!shouldStartLoad(contractAddress, loadedForAddressRef, loadingRef)) return;
      runIfMounted(() => isMounted, () => {
        setLoading(!loadingRef.current);
        setError(null);
      });
      try {
        await performLoad(
          kc,
          contractAddress,
          () => isMounted,
          setItems,
          setLoading,
          setLoadedOnce,
          writeCache,
          loadedForAddressRef,
          ignoreCacheRef,
        );
      } catch (e: any) {
        console.error(e);
        runIfMounted(() => isMounted, () => setError(e?.message || "Failed to load gallery"));
      } finally {
        loadingRef.current = false;
        runIfMounted(() => isMounted, () => {
          setLoading(false);
          setLoadedOnce(true);
          console.debug("Gallery: loadAll finished");
        });
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
  if (loading && !loadedOnce) {
    return (
      <div className="flex justify-center items-center mt-10">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  return (
    <section className="min-h-screen">
      <div className="container mx-auto px-4">
        <div className="mt-10 mb-6 grid grid-cols-1 items-center">
          <h1 className="text-center text-3xl md:text-5xl font-bold">Gallery</h1>
          {/* No inline status badge; initial spinner handled by early return to match My NFTs */}
        </div>

        {/* Mint panel removed per request; per-card Mint remains */}

        {error && (
          <div className="alert alert-error my-4">
            <span>{error}</span>
          </div>
        )}

        {/* Always render the grid for visibility; show skeletons or items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 lg:gap-8 my-6 items-stretch mx-auto">
          {renderGalleryGrid(items, loading, loadedOnce, ignoreCacheRef.current)}
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
