import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { Contract } from "ethers";

/**
 * Deploys Kittens (ERC721) with configurable initial owner from env.
 * - Env: OWNER_ADDRESS (defaults to deployer)
 * - Optional post-deploy minting:
 *   - MINT_AFTER_DEPLOY=true
 *   - MINT_URIS=["ipfs://...","ipfs://..."] or comma-separated string
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  const owner = process.env.OWNER_ADDRESS && process.env.OWNER_ADDRESS !== "" ? process.env.OWNER_ADDRESS : deployer;

  const result = await deploy("Kittens", {
    from: deployer,
    args: [owner],
    log: true,
    autoMine: true,
  });

  // ethers v6 returns address on .target for some helpers; prefer deploy result
  const deployedAddress = (result as any).address || (result as any).receipt?.contractAddress;
  log(`Kittens deployed at: ${deployedAddress}`);
  if (result.newlyDeployed) {
    log(`Owner set to: ${owner}`);
  }

  // Optional: auto-mint after deploy using editions mintItem()
  // Env vars:
  // - MINT_AFTER_DEPLOY=true
  // - MINT_URIS=ipfs://.../image-kitten-01.json,ipfs://.../image-kitten-02.json
  // - MINT_KITTEN_IDS=1,2
  const shouldMint = (process.env.MINT_AFTER_DEPLOY || "").toLowerCase() === "true";
  if (shouldMint) {
    const rawUris = process.env.MINT_URIS || "";
    const rawIds = process.env.MINT_KITTEN_IDS || ""; // optional
    if (!rawUris) {
      log("MINT_AFTER_DEPLOY is true but MINT_URIS is empty. Skipping mint.");
      return;
    }

    const uris = rawUris
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    let ids: number[] = [];
    if (rawIds) {
      ids = rawIds
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => Number(s));
      if (uris.length !== ids.length) {
        log(`Mismatch in MINT_URIS (${uris.length}) and MINT_KITTEN_IDS (${ids.length}). Skipping mint.`);
        return;
      }
    } else {
      // Infer kittenId from each URI, expecting patterns like .../image-kitten-03.json
      ids = uris.map(u => {
        const m = u.match(/kitten[-_]?([0-9]{1,3})/i) || u.match(/image[-_]?([0-9]{1,3})/i);
        const n = m ? Number(m[1]) : NaN;
        return Number.isFinite(n) && n > 0 ? n : 1; // default to 1 if not found
      });
    }

    // Get contract instance and price
    const kittens = await hre.ethers.getContract<Contract>("Kittens", deployer);
    const price = await (kittens as any).MINT_PRICE();
    log(`Auto-minting ${uris.length} token(s) at price ${price.toString()} wei each...`);

    for (let i = 0; i < uris.length; i++) {
      const uri = uris[i];
      const kittenId = ids[i];
      log(`Minting kittenId=${kittenId} to ${owner} uri=${uri}`);
      const tx = await (kittens as any).mintItem(owner, BigInt(kittenId), uri, { value: price });
      const receipt = await tx.wait();
      log(`Minted [${i + 1}/${uris.length}] Tx: ${receipt?.hash ?? tx.hash}`);
    }
  }
};

export default func;
func.tags = ["Kittens"];
