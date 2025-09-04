import { describe, it, expect, vi } from "vitest";
import {
  hasFn,
  getEligibleEntries,
  buildLabelUpdate,
  pushCollectible,
  fetchEnumerableForContract,
  fetchNonEnumerableForContract,
} from "~~/core/nft/holdings-helpers";

const owner = "0x1111111111111111111111111111111111111111";

describe("holdings-helpers: hasFn", () => {
  it("returns true when function exists", () => {
    const abi = [{ type: "function", name: "balanceOf" }];
    expect(hasFn(abi as any, "balanceOf")).toBe(true);
  });
  it("returns false when function missing or abi invalid", () => {
    expect(hasFn(undefined as any, "balanceOf")).toBe(false);
    const abi = [{ type: "event", name: "Transfer" }];
    expect(hasFn(abi as any, "balanceOf")).toBe(false);
  });
});

describe("holdings-helpers: getEligibleEntries", () => {
  it("filters entries that implement balanceOf, tokenURI and ownerOf", () => {
    const contracts = {
      A: { address: "0xA" as `0x${string}`, abi: [{ type: "function", name: "balanceOf" }, { type: "function", name: "tokenURI" }, { type: "function", name: "ownerOf" }] },
      B: { address: "0xB" as `0x${string}`, abi: [{ type: "function", name: "balanceOf" }] },
    } as any;
    const res = getEligibleEntries(contracts);
    expect(res.map(([name]) => name)).toEqual(["A"]);
  });
});

describe("holdings-helpers: buildLabelUpdate", () => {
  it("builds labels with name and symbol when available", async () => {
    const entries: any = [["A", { address: "0xA", abi: [{ type: "function", name: "name" }, { type: "function", name: "symbol" }] }]];
    const publicClient = {
      readContract: vi.fn()
        .mockImplementationOnce(async () => "MyNFT") // name
        .mockImplementationOnce(async () => "MNFT"), // symbol
    };
    const result = await buildLabelUpdate(publicClient as any, entries);
    expect(result["0xA"]).toContain("A");
    expect(result["0xA"]).toContain("MyNFT");
    expect(result["0xA"]).toContain("MNFT");
  });

  it("ignores errors per contract gracefully", async () => {
    const entries: any = [["B", { address: "0xB", abi: [{ type: "function", name: "name" }] }]];
    const publicClient = { readContract: vi.fn().mockRejectedValue(new Error("boom")) };
    const result = await buildLabelUpdate(publicClient as any, entries);
    // either undefined or no key when everything fails
    expect(result["0xB"]).toBeUndefined();
  });
});

describe("holdings-helpers: pushCollectible", () => {
  it("pushes meta-enhanced collectible and normalizes image", () => {
    const out: any[] = [];
    pushCollectible(out, 1n, owner, "Test", "0xABCDEF" as `0x${string}`, "ipfs://QmMeta", "ipfs://QmImg", {
      name: "MetaName",
      description: "Desc",
      image: "ipfs://QmHash",
    } as any);
    expect(out[0]).toMatchObject({
      id: 1,
      owner,
      contractName: "Test",
      contractAddress: "0xABCDEF",
      name: "MetaName",
    });
    expect(out[0].image).toContain("https://");
  });

  it("falls back to minimal collectible when metadata fetch fails and adds image if looks like image url", () => {
    const out: any[] = [];
    pushCollectible(out, 2n, owner, "Test", "0xABCD" as `0x${string}`, "ipfs://meta", "https://example.com/img.png");
    expect(out[0]).toMatchObject({ id: 2, owner, contractName: "Test" });
    expect(out[0].image).toBe("https://example.com/img.png");
  });
});

describe("holdings-helpers: fetchEnumerableForContract", () => {
  it("iterates balance and returns collectibles with mixed metadata success/failure", async () => {
    const publicClient = {
      readContract: vi.fn()
        .mockImplementationOnce(async () => 2n) // balanceOf
        .mockImplementationOnce(async () => 11n) // tokenOfOwnerByIndex(0)
        .mockImplementationOnce(async () => "ipfs://m1") // tokenURI(11)
        .mockImplementationOnce(async () => 22n) // tokenOfOwnerByIndex(1)
        .mockImplementationOnce(async () => "ipfs://m2"), // tokenURI(22)
    };
    const fetchMeta = vi.fn()
      .mockImplementationOnce(async () => ({ name: "T1", image: "ipfs://img1" }))
      .mockRejectedValueOnce(new Error("fail2"));
    const res = await fetchEnumerableForContract(publicClient as any, "0xABC" as `0x${string}`, [] as any, owner, "Test", fetchMeta as any);
    expect(res.length).toBe(2);
    expect(res[0].name).toBe("T1");
    expect(res[1].name).toBeDefined(); // fallback name
  });
});

describe("holdings-helpers: fetchNonEnumerableForContract", () => {
  it("scans by totalSupply/tokenByIndex and filters by owner", async () => {
    const publicClient = {
      readContract: vi.fn()
        // getScanPlan: totalSupply
        .mockImplementationOnce(async () => 3n) // totalSupply
        // loop t=0
        .mockImplementationOnce(async () => 1n) // tokenByIndex(0)
        .mockImplementationOnce(async () => owner) // ownerOf(1)
        .mockImplementationOnce(async () => "ipfs://m1") // tokenURI(1)
        // loop t=1
        .mockImplementationOnce(async () => 2n) // tokenByIndex(1)
        .mockImplementationOnce(async () => "0x2222222222222222222222222222222222222222") // ownerOf(2) - different owner (filtered)
        // loop t=2
        .mockImplementationOnce(async () => 3n) // tokenByIndex(2)
        .mockImplementationOnce(async () => owner) // ownerOf(3)
        .mockImplementationOnce(async () => "ipfs://m3"), // tokenURI(3)
    };
    const fetchMeta = vi.fn().mockResolvedValue({ name: "OK" });
    const res = await fetchNonEnumerableForContract(publicClient as any, "0xDEF" as `0x${string}`, [{ type: "function", name: "totalSupply" }, { type: "function", name: "tokenByIndex" }] as any, owner, "Coll", fetchMeta as any);
    expect(res.length).toBe(2);
  });

  it("falls back to totalMinted path and uses t+1 indexing", async () => {
    const publicClient = {
      readContract: vi.fn()
        // getScanPlan: totalSupply throws, then totalMinted works
        .mockRejectedValueOnce(new Error("no totalSupply"))
        .mockImplementationOnce(async () => 2n) // totalMinted
        // t=0 => tokenId 1
        .mockImplementationOnce(async () => owner) // ownerOf(1)
        .mockImplementationOnce(async () => "ipfs://m1") // tokenURI(1)
        // t=1 => tokenId 2
        .mockImplementationOnce(async () => owner) // ownerOf(2)
        .mockImplementationOnce(async () => "ipfs://m2"), // tokenURI(2)
    };
    const fetchMeta = vi.fn().mockResolvedValue({ name: "OK2" });
    const res = await fetchNonEnumerableForContract(publicClient as any, "0xAAA" as `0x${string}`, [{ type: "function", name: "totalMinted" }] as any, owner, "Coll2", fetchMeta as any);
    expect(res.length).toBe(2);
    expect(publicClient.readContract).toHaveBeenCalled();
  });
});
