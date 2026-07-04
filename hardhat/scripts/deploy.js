import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Plain-English one-line explanation: Deploys the Escrow contract to the current network and saves the address to a text file.
async function main() {
  const signers = await hre.ethers.getSigners();
  // We designate the 3rd account (index 2) as the verifier in local Hardhat node
  const verifierAddress = signers[2].address;

  console.log("Deploying Escrow contract...");
  console.log(`Designating verifier: ${verifierAddress}`);

  const EscrowContract = await hre.ethers.deployContract("Escrow", [verifierAddress]);
  await EscrowContract.waitForDeployment();

  const contractAddress = await EscrowContract.getAddress();
  console.log(`Escrow contract deployed to: ${contractAddress}`);

  // Save the address to a file so backend can read it automatically
  const addressPath = path.resolve(__dirname, "../deployed_address.txt");
  fs.writeFileSync(addressPath, contractAddress, "utf8");
  console.log(`Saved deployed contract address to: ${addressPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
