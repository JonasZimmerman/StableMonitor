import { execSync } from "child_process";
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

if (!fs.existsSync(dir)) {
  console.error(
    `${line}Unable to locate ${rel}. Expecting <root>/backend${line}`
  );
  process.exit(1);
}

if (!fs.existsSync(outdir)) {
  console.error(`${line}Unable to locate ${outdir}.${line}`);
  process.exit(1);
}

const deploymentsDir = path.join(dir, "deployments");

function readDeployment(chainName, chainId, contractName, optional) {
  const chainDeploymentDir = path.join(deploymentsDir, chainName);

  if (!fs.existsSync(chainDeploymentDir)) {
    if (!optional) {
      console.error(
        `${line}Unable to locate '${chainDeploymentDir}' directory.\n\n1. Goto '${dirname}' directory\n2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
      );
      process.exit(1);
    }
    console.log(`Skipping ${chainName} (${chainId}): deployment not found`);
    return undefined;
  }

  const deploymentFile = path.join(chainDeploymentDir, `${contractName}.json`);
  if (!fs.existsSync(deploymentFile)) {
    if (!optional) {
      console.error(
        `${line}Unable to locate '${deploymentFile}' file.\n\n1. Goto '${dirname}' directory\n2. Run 'npx hardhat deploy --network ${chainName}'.${line}`
      );
      process.exit(1);
    }
    console.log(`Skipping ${chainName} (${chainId}): contract deployment not found`);
    return undefined;
  }

  const jsonString = fs.readFileSync(deploymentFile, "utf-8");
  const obj = JSON.parse(jsonString);
  obj.chainId = chainId;

  return obj;
}

// Auto deployed on localhost
const deployLocalhost = readDeployment("localhost", 31337, CONTRACT_NAME, false /* optional */);

// Sepolia is optional - automatically skip if not deployed
const deploySepolia = readDeployment("sepolia", 11155111, CONTRACT_NAME, true /* optional */);

// Collect all deployments
const deployments = [];
if (deployLocalhost) {
  deployments.push({
    chainId: 31337,
    chainName: "hardhat",
    address: deployLocalhost.address,
    abi: deployLocalhost.abi
  });
}
if (deploySepolia) {
  deployments.push({
    chainId: 11155111,
    chainName: "sepolia",
    address: deploySepolia.address,
    abi: deploySepolia.abi
  });
}

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


// Use the first deployment's ABI (all should be the same after verification)
const abi = deployments.length > 0 ? deployments[0].abi : deployLocalhost.abi;

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

