"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { Address } from "~~/components/scaffold-eth";
import { createLogger } from "~~/utils/debug";

const Home: NextPage = () => {
  const { address: connectedAddress } = useAccount();
  const log = createLogger("home");

  useEffect(() => {
    log.info("Home mounted");
  }, []);

  useEffect(() => {
    log.debug("Account changed", { connectedAddress });
  }, [connectedAddress]);

  return (
    <section className="flex items-center justify-center grow pt-14 pb-24 px-6">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
        {/* Copy & CTAs */}
        <div className="text-center md:text-left">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-4">Kitten NFT Gallery</h1>
          <p className="text-lg md:text-xl text-base-content/70 mb-6">
            Browse a playful kitten collection and view the NFTs you own.
          </p>
          {connectedAddress && (
            <div className="inline-flex flex-col md:flex-row md:items-center gap-2 mb-6 rounded-xl bg-base-100/70 dark:bg-base-200/60 border border-base-300/60 px-4 py-3">
              <span className="text-sm text-base-content/70">Connected</span>
              <Address address={connectedAddress} />
            </div>
          )}
          {!connectedAddress && (
            <p className="text-sm text-base-content/60 mb-4">
              Use the Connect button in the header to link your wallet.
            </p>
          )}
          <div className="flex justify-center md:justify-start gap-3">
            <Link href="/gallery" className="btn btn-secondary">
              Open Gallery
            </Link>
            <Link href="/myNFTs" className="btn btn-outline">
              View My NFTs
            </Link>
          </div>
        </div>

        {/* Image */}
        <div className="order-first md:order-none">
          <div className="relative w-full aspect-square rounded-3xl p-3 shadow-lg bg-gradient-to-br from-base-100/70 to-base-200/70">
            <div className="absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center">
              <Image
                src="/img/image-kitten.png"
                alt="Kitten NFT"
                width={800}
                height={800}
                className="max-h-full max-w-full object-contain"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
