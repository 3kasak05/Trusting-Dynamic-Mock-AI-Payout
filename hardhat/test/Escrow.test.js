import { expect } from "chai";
import hre from "hardhat";
const { ethers } = hre;

// Plain-English one-line explanation: Tests the complete lifecycle of the Escrow contract from creation to fund release.
describe("Escrow Smart Contract", function () {
  let escrowContract;
  let clientSigner;
  let workerSigner;
  let verifierSigner;
  const escrowAmount = ethers.parseEther("1.0");

  beforeEach(async function () {
    // Plain-English one-line explanation: Deploys a new Escrow contract before each test case.
    const signers = await ethers.getSigners();
    clientSigner = signers[0];
    workerSigner = signers[1];
    verifierSigner = signers[2];

    const EscrowFactory = await ethers.getContractFactory("Escrow");
    escrowContract = await EscrowFactory.deploy(verifierSigner.address);
    await escrowContract.waitForDeployment();
  });

  it("should complete the happy path: create -> submit -> approve -> release", async function () {
    // 1. Create job
    console.log("--- Starting Escrow Lifecycle Test ---");
    console.log(`Deployer / Client: ${clientSigner.address}`);
    console.log(`Worker: ${workerSigner.address}`);
    console.log(`Verifier: ${verifierSigner.address}`);

    const createTx = await escrowContract.connect(clientSigner).createJob(workerSigner.address, {
      value: escrowAmount,
    });
    await createTx.wait();
    console.log("Step 1: Job created and 1.0 ETH deposited into escrow.");

    const firstJob = await escrowContract.jobs(1);
    expect(firstJob.client).to.equal(clientSigner.address);
    expect(firstJob.worker).to.equal(workerSigner.address);
    expect(firstJob.jobAmount).to.equal(escrowAmount);
    expect(firstJob.status).to.equal(0); // JobStatus.Created

    // 2. Submit result
    const resultHash = "QmSampleResultHashFromAgentA";
    const submitTx = await escrowContract.connect(workerSigner).submitResult(1, resultHash);
    await submitTx.wait();
    console.log(`Step 2: Worker submitted result hash: ${resultHash}`);

    const submittedJob = await escrowContract.jobs(1);
    expect(submittedJob.resultHash).to.equal(resultHash);
    expect(submittedJob.status).to.equal(1); // JobStatus.Submitted

    // 3. Approve job
    const approveTx = await escrowContract.connect(verifierSigner).approve(1, true);
    await approveTx.wait();
    console.log("Step 3: Verifier approved the work.");

    const approvedJob = await escrowContract.jobs(1);
    expect(approvedJob.status).to.equal(2); // JobStatus.Approved

    // 4. Release funds
    const initialWorkerBalance = await ethers.provider.getBalance(workerSigner.address);
    const releaseTx = await escrowContract.connect(verifierSigner).releaseFunds(1);
    await releaseTx.wait();
    console.log("Step 4: Funds released to worker.");

    const finalWorkerBalance = await ethers.provider.getBalance(workerSigner.address);
    const releasedJob = await escrowContract.jobs(1);
    expect(releasedJob.status).to.equal(4); // JobStatus.Released
    expect(releasedJob.jobAmount).to.equal(0n); // Job amount set to 0 in contract

    // Check that worker received the funds
    expect(finalWorkerBalance - initialWorkerBalance).to.equal(escrowAmount);
    console.log("Success: Worker received the escrowed funds!");
  });

  it("should fail to approve if not the verifier", async function () {
    // Create and submit job first
    await escrowContract.connect(clientSigner).createJob(workerSigner.address, { value: escrowAmount });
    await escrowContract.connect(workerSigner).submitResult(1, "someHash");

    // Try approving from client instead of verifier
    await expect(
      escrowContract.connect(clientSigner).approve(1, true)
    ).to.be.revertedWith("Only the designated verifier can call this");
    console.log("Verification test passed: Only the designated verifier can approve.");
  });
});
