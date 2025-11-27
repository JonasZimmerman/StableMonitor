import * as fs from "fs";
import * as path from "path";

const CONTRACT_NAME = "StableMonitor";

// <root>/backend
const rel = "../backend";

// <root>/frontend/abi
const outdir = path.resolve("./abi");

if (!fs.existsSync(outdir)) {
  fs.mkdirSync(outdir);
}

const dir = path.resolve(rel);
const dirname = path.basename(dir);

const line =
  "\n===================================================================\n";

const deploymentsDir = path.join(dir, "deployments");

function isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

const wellKnownChainIds = {
  localhost: 31337,
  hardhat: 31337,
  anvil: 31337,
  sepolia: 11155111,
  homestead: 1,
  mainnet: 1,
  polygon: 137,
  mumbai: 80001,
  base: 8453,
  optimism: 10,
  arbitrum: 42161,
};

function detectChainId(chainDir, chainName, parsedDeployment) {
  const chainIdFile = path.join(chainDir, ".chainId");
  if (fs.existsSync(chainIdFile)) {
    const content = fs.readFileSync(chainIdFile, "utf-8").trim();
    const n = Number.parseInt(content, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  if (parsedDeployment && typeof parsedDeployment.chainId === "number") {
    return parsedDeployment.chainId;
  }
  if (Object.hasOwn(wellKnownChainIds, chainName)) {
    return wellKnownChainIds[chainName];
  }
  return undefined;
}

function collectDeployments() {
  const deployments = [];
  if (!fs.existsSync(deploymentsDir) || !isDirectory(deploymentsDir)) {
    console.log(
      `${line}Deployments directory not found. Skipping ABI generation.${line}`
    );
    return deployments;
  }
  const chainNames = fs
    .readdirSync(deploymentsDir)
    .filter((n) => isDirectory(path.join(deploymentsDir, n)));

  for (const chainName of chainNames) {
    const chainDir = path.join(deploymentsDir, chainName);
    const deploymentFile = path.join(chainDir, `${CONTRACT_NAME}.json`);
    if (!fs.existsSync(deploymentFile)) {
      console.log(
        `Skipping ${chainName}: ${CONTRACT_NAME}.json not found`
      );
      continue;
    }
    try {
      const jsonString = fs.readFileSync(deploymentFile, "utf-8");
      const parsed = JSON.parse(jsonString);
      const chainId = detectChainId(chainDir, chainName, parsed);
      if (typeof chainId !== "number") {
        console.log(
          `Skipping ${chainName}: unable to determine chainId`
        );
        continue;
      }
      if (!parsed.address || !parsed.abi) {
        console.log(
          `Skipping ${chainName}: invalid deployment (missing address or abi)`
        );
        continue;
      }
      deployments.push({
        chainId,
        chainName,
        address: parsed.address,
        abi: parsed.abi,
      });
    } catch (e) {
      console.log(`Skipping ${chainName}: failed to parse deployment JSON`);
      continue;
    }
  }
  return deployments;
}

const deployments = collectDeployments();

// Verify ABI consistency across all deployments
if (deployments.length > 1) {
  const firstABI = JSON.stringify(deployments[0].abi);
  for (let i = 1; i < deployments.length; i++) {
    if (JSON.stringify(deployments[i].abi) !== firstABI) {
      console.error(
        `${line}Deployments have different ABIs. Cannot use the same ABI on all networks. Consider re-deploying the contracts.${line}`
      );
      process.exit(1);
    }
  }
}

if (deployments.length === 0) {
  console.log(`${line}No deployments found. Nothing to generate.${line}`);
  process.exit(0);
}

// Use the first deployment's ABI (all should be the same after verification)
const abi = deployments[0].abi;

const tsCode = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}ABI = ${JSON.stringify({ abi: abi }, null, 2)} as const;
\n`;

// Build addresses object dynamically from available deployments
const addressesObj = {};
deployments.forEach(deploy => {
  addressesObj[deploy.chainId.toString()] = {
    address: deploy.address,
    chainId: deploy.chainId,
    chainName: deploy.chainName
  };
});

const tsAddresses = `
/*
  This file is auto-generated.
  Command: 'npm run genabi'
*/
export const ${CONTRACT_NAME}Addresses = ${JSON.stringify(addressesObj, null, 2)} as const;
`;

console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}ABI.ts`)}`);
console.log(`Generated ${path.join(outdir, `${CONTRACT_NAME}Addresses.ts`)}`);
console.log(`Addresses for chains: ${deployments.map(d => `${d.chainName} (${d.chainId})`).join(", ") || "none"}`);

fs.writeFileSync(path.join(outdir, `${CONTRACT_NAME}ABI.ts`), tsCode, "utf-8");
fs.writeFileSync(
  path.join(outdir, `${CONTRACT_NAME}Addresses.ts`),
  tsAddresses,
  "utf-8"
);

