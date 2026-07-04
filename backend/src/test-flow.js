// Plain-English one-line explanation: Simulates the AI job escrow flow with multiple custom requirement inputs.
const backendUrl = "http://localhost:3001";

async function runSingleEscrowTest(requirements) {
  console.log(`\n--- Testing escrows for: "${requirements}" ---`);

  // 1. Create Escrow Job
  const createRes = await fetch(`${backendUrl}/api/jobs/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      worker: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", 
      amount: "0.01",
      requirements
    })
  });
  const createData = await createRes.json();
  const jobId = createData.jobId;
  console.log(`[Flow] Created Job #${jobId}`);

  // 2. Submit Work (Agent A)
  const submitRes = await fetch(`${backendUrl}/api/jobs/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId })
  });
  const submitData = await submitRes.json();
  console.log(`[Agent A] Generated Article:`);
  console.log(submitData.article);

  // 3. Verify (Agent B)
  const verifyRes = await fetch(`${backendUrl}/api/jobs/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobId })
  });
  const verifyData = await verifyRes.json();
  console.log(`[Agent B] Decision: Approved = ${verifyData.approved}. Reason: ${verifyData.reason}`);

  // 4. Release Escrow Funds (if approved)
  if (verifyData.approved) {
    const releaseRes = await fetch(`${backendUrl}/api/jobs/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId })
    });
    const releaseData = await releaseRes.json();
    if (releaseRes.ok) {
      console.log(`[Flow] Payout released for Job #${jobId}.`);
    } else {
      console.log(`[Flow] Payout release failed: ${releaseData.error}`);
    }
  }
}

async function runTest() {
  console.log("=== STARTING DYNAMIC MOCK GENERATION INTEGRATION SIMULATION ===");

  await runSingleEscrowTest("Write a beginner-friendly explanation of AI agents.");
  await runSingleEscrowTest("Write about blockchain.");
  await runSingleEscrowTest("Explain REST APIs.");

  console.log("\n=== SIMULATION COMPLETED SUCCESSFULLY ===");
}

runTest().catch(console.error);

