import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  // Skip deployment on selected local dev chains to avoid FHEVM dependency issues
  // Allow localhost deployment; keep skipping pure in-memory dev networks
  if (hre.network.name === "hardhat" || hre.network.name === "anvil") {
    console.log(`Skipping StableMonitor deployment on dev network: ${hre.network.name}`);
    return;
  }

  // Ensure FHEVM core is initialized for localhost/sepolia before deploying contracts
  // This sets up mock engine or connects to deployed core so FHE.* calls won't revert.
  await hre.fhevm.initializeCLIApi();
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Note: The initial risk threshold must be encrypted using FHEVM
  // For deployment, we use a zero value (encrypted zero)
  // The threshold should be updated after deployment using updateRiskThreshold function
  // Zero value in FHEVM format: all zeros with proper encoding
  const zeroEuint32 = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const zeroProof = "0x";
  
  const deployedStableMonitor = await deploy("StableMonitor", {
    from: deployer,
    args: [
      deployer, // issuer
      zeroEuint32, // initialRiskThreshold (encrypted zero, should be updated after deployment)
      zeroProof // initialRiskThresholdProof
    ],
    log: true,
  });

  console.log(`StableMonitor contract deployed at: ${deployedStableMonitor.address}`);
  console.log(`Issuer address: ${deployer}`);
  console.log(`Note: Update risk threshold after deployment using updateRiskThreshold function`);
};
export default func;
func.id = "deploy_stableMonitor"; // id required to prevent reexecution
func.tags = ["StableMonitor"];

