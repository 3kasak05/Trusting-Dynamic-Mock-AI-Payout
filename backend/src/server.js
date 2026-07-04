import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { 
  createJobOnChain, 
  submitResultOnChain, 
  approveOnChain, 
  releaseFundsOnChain, 
  getJobDetailsFromChain,
  setContractAddress,
  getContractInstance,
  parseContractError
} from "./services/blockchain.js";
import { runAgentA, runAgentB } from "./services/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// In-memory data store for metadata that isn't on the blockchain
const jobMetadata = {}; 
const activityLogs = [];

// Plain-English one-line explanation: Helper to push structured activity logs to the database and print them in the terminal.
function addLog(message) {
  const time = new Date().toLocaleTimeString();
  activityLogs.unshift({ time, message });
  console.log(`[LOG] ${time}: ${message}`);
}

// Plain-English one-line explanation: Endpoint to fetch all jobs in the contract along with their metadata.
app.get("/api/jobs", async (req, res) => {
  try {
    const contract = await getContractInstance(0);
    const count = Number(await contract.jobCount());
    const jobs = [];
    
    for (let index = 1; index <= count; index++) {
      const details = await getJobDetailsFromChain(index);
      const meta = jobMetadata[index] || { requirements: "N/A", verifierNotes: "" };
      jobs.push({
        ...details,
        requirements: meta.requirements,
        verifierNotes: meta.verifierNotes
      });
    }
    
    res.json(jobs);
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

// Plain-English one-line explanation: Endpoint to retrieve the execution activity logs.
app.get("/api/logs", (req, res) => {
  res.json(activityLogs);
});

// Plain-English one-line explanation: Endpoint to create a new job, deposit funds into escrow, and log the action.
app.post("/api/jobs/create", async (req, res) => {
  const { worker, amount, requirements } = req.body;
  try {
    const jobId = await createJobOnChain(worker, amount);
    jobMetadata[jobId] = { requirements, verifierNotes: "" };
    
    addLog(`Job #${jobId} created. Escrowed ${amount} ETH. Requirements: "${requirements}"`);
    res.json({ success: true, jobId });
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

// Plain-English one-line explanation: Endpoint to trigger Agent A to perform the job and write the submission.
app.post("/api/jobs/submit", async (req, res) => {
  const { jobId } = req.body;
  try {
    const meta = jobMetadata[jobId];
    if (!meta) {
      return res.status(404).json({ error: "Job metadata not found" });
    }

    addLog(`Agent A (Worker) starting work on Job #${jobId}...`);
    const article = await runAgentA(meta.requirements);
    addLog(`Agent A completed writing article. Size: ${article.length} chars.`);

    await submitResultOnChain(jobId, article);
    addLog(`Agent A submitted work results on-chain for Job #${jobId}.`);
    
    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

// Plain-English one-line explanation: Endpoint to trigger Agent B to verify the submitted job.
app.post("/api/jobs/verify", async (req, res) => {
  const { jobId } = req.body;
  try {
    const details = await getJobDetailsFromChain(jobId);
    const meta = jobMetadata[jobId];
    
    if (!meta || !details.resultHash) {
      return res.status(400).json({ error: "Job has no submission or requirements to verify" });
    }

    addLog(`Agent B (Verifier) starting review of Job #${jobId}...`);
    const review = await runAgentB(meta.requirements, details.resultHash);
    
    jobMetadata[jobId].verifierNotes = review.reason;
    addLog(`Agent B review complete. Decision: ${review.approved ? "APPROVED" : "REJECTED"}. Reason: "${review.reason}"`);

    await approveOnChain(jobId, review.approved);

    if (review.approved) {
      addLog(`Job #${jobId} approved. Waiting for manual escrow payment release.`);
    } else {
      addLog(`Job #${jobId} was rejected. Funds remain held in escrow.`);
    }

    res.json({ success: true, approved: review.approved, reason: review.reason });
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

// Plain-English one-line explanation: Endpoint to manually release escrowed funds for an approved job.
app.post("/api/jobs/release", async (req, res) => {
  const { jobId } = req.body;
  try {
    addLog(`Escrow release requested manually for Job #${jobId}...`);
    await releaseFundsOnChain(jobId);
    addLog(`Funds successfully released to worker for Job #${jobId}!`);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: parseContractError(error) });
  }
});

// Plain-English one-line explanation: Webhook receiver that reviews GitHub Pull Requests and pays devs or comments feedback.
app.post("/api/github-webhook", async (req, res) => {
  addLog("Received GitHub webhook event.");
  const eventType = req.headers["x-github-event"];
  const payload = req.body;

  if (eventType !== "pull_request") {
    return res.status(200).json({ status: "ignored", message: "Only pull_request events are reviewed" });
  }

  const action = payload.action;
  const prNum = payload.number;
  const repoName = payload.repository?.name || "mockRepo";
  const prTitle = payload.pull_request?.title || "PR Title";
  const prBody = payload.pull_request?.body || "";
  
  let jobId = null;
  if (payload.jobId) {
    jobId = parseInt(payload.jobId, 10);
  } else {
    const matchBody = prBody.match(/Escrow Job #(\d+)/i);
    if (matchBody) {
      jobId = parseInt(matchBody[1], 10);
    } else {
      const matchTitle = prTitle.match(/Escrow Job #(\d+)/i);
      if (matchTitle) {
        jobId = parseInt(matchTitle[1], 10);
      }
    }
  }

  if (!jobId) {
    return res.status(400).json({ error: "No Escrow Job ID specified in the PR body, title, or webhook payload." });
  }

  addLog(`New PR event: "${action}" on PR #${prNum} in ${repoName} (linked to Job #${jobId}). Title: "${prTitle}"`);

  if (action !== "opened" && action !== "synchronize") {
    return res.status(200).json({ status: "ignored", message: "Webhook action ignored. Only opened/sync are processed" });
  }

  let diffContent = payload.pull_request.mockDiffContent || "";
  const githubToken = process.env.GITHUB_TOKEN;

  if (githubToken && githubToken !== "mock" && !payload.pull_request.mockDiffContent) {
    try {
      addLog(`Fetching real diff for PR #${prNum} from GitHub API...`);
      const diffRes = await fetch(
        `https://api.github.com/repos/${payload.repository.full_name}/pulls/${prNum}`,
        {
          headers: {
            Authorization: `token ${githubToken}`,
            Accept: "application.vnd.github.v3.diff",
          },
        }
      );
      if (diffRes.ok) {
        diffContent = await diffRes.text();
        addLog(`Successfully fetched PR diff (${diffContent.length} bytes).`);
      } else {
        addLog(`Failed to fetch PR diff, status: ${diffRes.status}. Using mock fallback.`);
      }
    } catch (err) {
      addLog(`GitHub API fetch failed: ${err.message}. Using mock fallback.`);
    }
  }

  if (!diffContent) {
    diffContent = `diff --git a/src/index.js b/src/index.js\n+ console.log("Trust Escrow PR Test");`;
  }

  addLog(`Invoking AI Code Reviewer for PR #${prNum}...`);
  
  const reviewerPrompt = `
PR Title: "${prTitle}"
PR Description: "${prBody}"
PR Diff Content:
${diffContent}

Please review this code for: style, obvious bugs, and improvements.
Return a valid JSON output with two fields:
{
  "approved": true or false,
  "reason": "overall summary and list of specific inline suggestions/comments if any"
}
Do not include any conversational wrappers or markdown formatting around the JSON object.
`;

  try {
    const reviewResult = await runAgentB("Verify that the code looks clean, has no syntax errors, and adds value.", reviewerPrompt);
    addLog(`AI Code Review complete for PR #${prNum}. Status: ${reviewResult.approved ? "PASSED" : "FAILED"}`);

    if (jobMetadata[jobId]) {
      jobMetadata[jobId].verifierNotes = reviewResult.reason;
    }

    if (reviewResult.approved) {
      addLog(`PR #${prNum} checks passed! Transitioning Job #${jobId} sequentially to release funds...`);
      
      const details = await getJobDetailsFromChain(jobId);
      if (details.status === "Created") {
        await submitResultOnChain(jobId, `PR #${prNum} Diff`);
      }
      
      const afterSubmitDetails = await getJobDetailsFromChain(jobId);
      if (afterSubmitDetails.status === "Submitted") {
        await approveOnChain(jobId, true);
      }
      
      const afterApproveDetails = await getJobDetailsFromChain(jobId);
      if (afterApproveDetails.status === "Approved") {
        await releaseFundsOnChain(jobId);
      }
      
      addLog(`Escrow payout completed for PR #${prNum}! Developer paid.`);
      
      if (githubToken && githubToken !== "mock") {
        await postGitHubReview(payload.repository.full_name, prNum, "APPROVE", `AI Review Passed: ${reviewResult.reason}`);
      }

      return res.json({ status: "approved", message: "PR passed checks. Escrow funds released.", review: reviewResult.reason });
    } else {
      addLog(`PR #${prNum} checks failed. Transitioning Job #${jobId} to Rejected...`);
      
      const details = await getJobDetailsFromChain(jobId);
      if (details.status === "Created") {
        await submitResultOnChain(jobId, `PR #${prNum} Diff`);
      }
      
      const afterSubmitDetails = await getJobDetailsFromChain(jobId);
      if (afterSubmitDetails.status === "Submitted") {
        await approveOnChain(jobId, false);
      }
      
      addLog(`PR #${prNum} checks failed. Review comments posted.`);

      if (githubToken && githubToken !== "mock") {
        await postGitHubReview(payload.repository.full_name, prNum, "REQUEST_CHANGES", `AI Review Failed:\n\n${reviewResult.reason}`);
      }

      return res.json({ status: "failed", message: "PR failed checks. Review comments posted.", review: reviewResult.reason });
    }
  } catch (error) {
    console.error("Error processing PR webhook review:", error);
    return res.status(500).json({ error: parseContractError(error) });
  }
});

// Helper to post a review comment back to GitHub
async function postGitHubReview(repoFullName, prNum, event, body) {
  try {
    const res = await fetch(`https://api.github.com/repos/${repoFullName}/pulls/${prNum}/reviews`, {
      method: "POST",
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application.vnd.github.v3+json",
      },
      body: JSON.stringify({ body, event }),
    });
    if (res.ok) {
      addLog(`Successfully posted review to GitHub PR #${prNum}`);
    } else {
      addLog(`GitHub review posting failed with status: ${res.status}`);
    }
  } catch (error) {
    addLog(`GitHub review posting error: ${error.message}`);
  }
}

// Plain-English one-line explanation: Start the Express server listening on the configured PORT.
app.listen(PORT, async () => {
  console.log(`AI Trust Escrow Backend Server listening on port ${PORT}`);
  
  const deployAddressPath = path.resolve(__dirname, "../../hardhat/deployed_address.txt");
  if (fs.existsSync(deployAddressPath)) {
    const address = fs.readFileSync(deployAddressPath, "utf8").trim();
    setContractAddress(address);
    addLog(`Loaded deployed contract address from file: ${address}`);
  } else {
    console.log("[Server Warning] deployed_address.txt not found. Set CONTRACT_ADDRESS in your .env");
  }
});
