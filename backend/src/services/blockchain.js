import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let contractAddress = process.env.CONTRACT_ADDRESS;

// Plain-English one-line explanation: Resolves the path to the compiled Escrow ABI file and reads it.
function getContractAbi() {
  const abiPath = path.resolve(__dirname, "../../../hardhat/artifacts/contracts/Escrow.sol/Escrow.json");
  if (!fs.existsSync(abiPath)) {
    throw new Error("Escrow contract ABI not found. Please compile the contract in the hardhat directory first.");
  }
  const contractJson = JSON.parse(fs.readFileSync(abiPath, "utf8"));
  return contractJson.abi;
}

// Plain-English one-line explanation: Connects to the local Hardhat RPC node and retrieves the account signer.
async function getSigner(index) {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "http://127.0.0.1:8545");
  // Hardhat's default accounts are pre-funded. We fetch them directly.
  const signer = await provider.getSigner(index);
  return signer;
}

// Plain-English one-line explanation: Instantiates a contract interface connected to the selected Hardhat wallet account.
export async function getContractInstance(signerIndex) {
  if (!contractAddress) {
    throw new Error("Contract address is not set. Please deploy the contract first.");
  }
  const signer = await getSigner(signerIndex);
  const abi = getContractAbi();
  return new ethers.Contract(contractAddress, abi, signer);
}

// Plain-English one-line explanation: Updates the deployed contract address dynamically in memory.
export function setContractAddress(address) {
  contractAddress = address;
  console.log(`[Blockchain] Contract address set to: ${address}`);
}

// Plain-English one-line explanation: Executes the createJob transaction on-chain as the Client (Account 0).
export async function createJobOnChain(workerAddress, amountInEth) {
  const contract = await getContractInstance(0); 
  const value = ethers.parseEther(amountInEth.toString());
  
  console.log(`[Blockchain] Client creating job with worker ${workerAddress} and amount ${amountInEth} ETH...`);
  const tx = await contract.createJob(workerAddress, { value });
  const receipt = await tx.wait();
  
  const event = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); } catch (e) { return null; }
    })
    .find((parsedLog) => parsedLog && parsedLog.name === "JobCreated");

  const jobId = event ? Number(event.args.jobId) : null;
  console.log(`[Blockchain] Job created on-chain. Job ID: ${jobId}`);
  return jobId;
}

// Plain-English one-line explanation: Executes the submitResult transaction on-chain as the Worker (Account 1).
export async function submitResultOnChain(jobId, resultHash) {
  const details = await getJobDetailsFromChain(jobId);
  if (details.status !== "Created") {
    throw new Error("Job is not in Created state");
  }
  const contract = await getContractInstance(1); 
  console.log(`[Blockchain] Worker submitting result for Job #${jobId}...`);
  const tx = await contract.submitResult(jobId, resultHash);
  await tx.wait();
  console.log(`[Blockchain] Result submitted on-chain for Job #${jobId}`);
}

// Plain-English one-line explanation: Executes the approve transaction on-chain as the Verifier (Account 2).
export async function approveOnChain(jobId, isApproved) {
  const details = await getJobDetailsFromChain(jobId);
  if (details.status !== "Submitted") {
    throw new Error("Job is not in Submitted state");
  }
  const contract = await getContractInstance(2); 
  console.log(`[Blockchain] Verifier submitting review for Job #${jobId} (Approved: ${isApproved})...`);
  const tx = await contract.approve(jobId, isApproved);
  await tx.wait();
  console.log(`[Blockchain] Review submitted on-chain for Job #${jobId}`);
}

// Plain-English one-line explanation: Executes the releaseFunds transaction on-chain to pay the worker.
export async function releaseFundsOnChain(jobId) {
  const details = await getJobDetailsFromChain(jobId);
  if (details.status !== "Approved") {
    throw new Error("Job is not in Approved state");
  }
  const contract = await getContractInstance(2); 
  console.log(`[Blockchain] Releasing funds for Job #${jobId}...`);
  const tx = await contract.releaseFunds(jobId);
  await tx.wait();
  console.log(`[Blockchain] Funds released on-chain for Job #${jobId}`);
}

// Plain-English one-line explanation: Reads job information directly from the contract state.
export async function getJobDetailsFromChain(jobId) {
  const contract = await getContractInstance(0);
  const count = Number(await contract.jobCount());
  if (jobId <= 0 || jobId > count) {
    throw new Error("Job does not exist");
  }
  const job = await contract.jobs(jobId);
  
  const statuses = ["Created", "Submitted", "Approved", "Rejected", "Released"];
  return {
    id: jobId,
    client: job.client,
    worker: job.worker,
    amount: ethers.formatEther(job.jobAmount),
    resultHash: job.resultHash,
    status: statuses[Number(job.status)]
  };
}

// Plain-English one-line explanation: Centralized helper to map Solidity raw revert strings to clean user-facing error messages.
export function parseContractError(error) {
  const message = error.message || String(error);
  
  const errorMapping = [
    { key: "Escrow amount must be greater than zero", friendly: "The escrow amount must be greater than zero." },
    { key: "Worker address cannot be zero", friendly: "Please provide a valid worker address (cannot be zero)." },
    { key: "Job is not in Created state", friendly: "This job is not in the Created state and cannot accept submissions." },
    { key: "Only the worker can submit result", friendly: "Only the designated worker address can submit results for this job." },
    { key: "Result hash cannot be empty", friendly: "The submission output cannot be empty." },
    { key: "Only the designated verifier can call this", friendly: "Only the designated verifier can perform this action." },
    { key: "Job is not in Submitted state", friendly: "This job must first be submitted before it can be approved." },
    { key: "Job funds can only be released if status is Approved", friendly: "This job funds can only be released if the status is Approved." },
    { key: "Failed to send Ether to worker", friendly: "Blockchain transaction failed to transfer escrowed funds to the worker's address." },
    { key: "Job does not exist", friendly: "The requested Job ID does not exist on-chain." }
  ];

  for (const mapping of errorMapping) {
    if (message.includes(mapping.key)) {
      return mapping.friendly;
    }
  }

  if (error.reason) {
    for (const mapping of errorMapping) {
      if (error.reason.includes(mapping.key)) {
        return mapping.friendly;
      }
    }
    return `Transaction reverted: ${error.reason}`;
  }

  return message;
}
