import type { BigNumberish } from "ethers";
import { ethers, deployments, network, run } from "hardhat";

async function main() {
  // 1) Environment checks
  const rpc = process.env.SEPOLIA_RPC_URL;
  const mnemonic = process.env.MNEMONIC;

  if (!rpc || rpc.trim().length === 0) {
    console.error("SEPOLIA_RPC_URL is not set. Please set it via your shell env before running.");
    console.error("Example (PowerShell):  $env:SEPOLIA_RPC_URL = \"https://<your-sepolia-rpc>\"");
    process.exit(1);
    return;
  }
  if (!mnemonic || mnemonic.trim().length === 0) {
    console.error("MNEMONIC is not set. Please set it via your shell env before running.");
    console.error("Example (PowerShell):  $env:MNEMONIC = \"word1 word2 ... word12\"");
    process.exit(1);
    return;
  }

  if (network.name !== "sepolia") {
    console.warn(`Warning: current Hardhat network is "${network.name}". This script is intended for "sepolia".`);
  }

  // 2) Resolve deployer and balance
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balanceWei: BigNumberish = await ethers.provider.getBalance(deployerAddress);
  const balanceEth = Number(ethers.formatEther(balanceWei));

  console.log("Network:", network.name);
  console.log("RPC URL (from env):", rpc);
  console.log("Deployer:", deployerAddress);
  console.log("Deployer balance (ETH):", balanceEth.toFixed(6));

  // 3) Pre-flight balance guard (simple heuristic)
  // Typical small contracts on Sepolia may require ~0.002-0.01 ETH depending on gas price.
  const MIN_REQUIRED_ETH = 0.003;
  if (balanceEth < MIN_REQUIRED_ETH) {
    console.error(
      `Insufficient funds: need at least ~${MIN_REQUIRED_ETH} ETH on Sepolia to deploy. Current: ${balanceEth} ETH.`
    );
    console.error("Please fund the first account derived from MNEMONIC, then re-run this script.");
    process.exit(1);
    return;
  }

  // 4) Optionally ensure FHEVM env is initialized (deploy script also does this)
  if ("fhevm" in (ethers as unknown as Record<string, unknown>) === false) {
    // In case the plugin typing is not visible here, we keep runtime approach in deploy script itself.
  }

  // 5) Run the standard hardhat-deploy pipeline (reuses backend/deploy/deploy.ts)
  //    You can pass tags if you want to target a subset, e.g.: await run("deploy", { tags: "StableMonitor" });
  console.log("Running hardhat-deploy task...");
  await run("deploy");

  // 6) Print resulting address if available
  try {
    const deployed = await deployments.get("StableMonitor");
    console.log("StableMonitor deployed at:", deployed.address);
  } catch (_e) {
    console.log("Deployment finished. If you used tags or custom flow, check the deployments folder for outputs.");
  }

  console.log("Done.");
}

main().catch((err) => {
  // Friendly hint for common provider errors
  const msg = String(err?.message ?? err);
  if (msg.includes("INSUFFICIENT_FUNDS")) {
    console.error("Deploy failed: insufficient funds for gas. Please fund your deployer account and try again.");
  }
  console.error(err);
  process.exit(1);
});


