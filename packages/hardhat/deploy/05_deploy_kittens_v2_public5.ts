import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// Deploy a fresh KittensV2 with cap=5 per kitten and NO auto-mint (public-only minting)
// Env required:
// - ORDERED_BASE_URI (ipfs://<CID>/)
// - OWNER_ADDRESS (optional; defaults to deployer)
// After deploy, script enables sale and sets defaultMaxPerKitten(5)

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy, log } = deployments;

  const { deployer } = await getNamedAccounts();
  const signer = await ethers.getSigner(deployer);

  const OWNER_ADDRESS = process.env.OWNER_ADDRESS || deployer;
  const ORDERED_BASE_URI = process.env.ORDERED_BASE_URI;

  if (!ORDERED_BASE_URI) throw new Error("ORDERED_BASE_URI is required (e.g. ipfs://<CID>/)");

  log(`\n=== Deploying KittensV2_Public5 to network: ${network.name} ===`);

  const res = await deploy("KittensV2_Public5", {
    from: deployer,
    log: true,
    contract: "KittensV2",
    args: [OWNER_ADDRESS, ORDERED_BASE_URI],
    waitConfirmations: 1,
  });

  log(`KittensV2_Public5 deployed at: ${res.address}`);

  const c = await ethers.getContractAt("KittensV2", res.address, signer);

  // Enable sale
  const active = await c.saleActive();
  if (!active) {
    const tx = await c.setSaleActive(true);
    await tx.wait();
    log("Sale activated");
  }

  // Set global cap to 5 per kitten
  const tx2 = await c.setDefaultMaxPerKitten(5);
  await tx2.wait();
  log("Default max per kitten set to 5");

  log("Public-only mint setup complete. No tokens auto-minted.\n");
};

export default func;
func.tags = ["KittensV2_Public5"];
