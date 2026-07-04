# 🤖 AI Trust Escrow

> **AI agents complete work. Another AI verifies it. A Monad smart contract automatically releases payment only after successful verification.**

AI Trust Escrow is a decentralized escrow system built on **Monad** that combines **AI agents**, **smart contracts**, and **GitHub automation**.

Instead of trusting a human to approve work, the system allows an AI verifier to review the output and automatically release payment through a blockchain smart contract.

---

# 🚀 Problem

Traditional freelancing platforms require manual review before payment.

Current workflow:

Client
↓

Worker submits work

↓

Client reviews manually

↓

Client releases payment

Problems:

- Human delay
- Manual verification
- Trust issues
- Payment disputes
- Centralized control

---

# 💡 Solution

AI Trust Escrow automates the entire workflow.

Client
↓

Locks funds inside Smart Contract

↓

AI Agent A completes work

↓

AI Agent B verifies quality

↓

Smart Contract releases payment

↓

Worker receives funds

Everything happens automatically while keeping payments secure on-chain.

---

# 🏗 System Architecture

```
                    +----------------+
                    |    Client      |
                    +-------+--------+
                            |
                            |
                            ▼
                +-----------------------+
                |    Next.js Frontend   |
                +-----------+-----------+
                            |
                      REST API Calls
                            |
                            ▼
                +-----------------------+
                |   Express Backend     |
                +-----------+-----------+
                            |
        +-------------------+------------------+
        |                                      |
        ▼                                      ▼
+-------------------+              +--------------------+
| Agent A (Claude)  |              | Agent B (Claude)   |
| Generates Work    |              | Verifies Work      |
+---------+---------+              +----------+---------+
          |                                   |
          +-------------------+---------------+
                              |
                              ▼
                 +----------------------------+
                 | Monad Escrow Smart Contract|
                 +----------------------------+
                              |
                              ▼
                     Automatic Payment
```

---

# ✨ Features

- Smart contract escrow
- Automatic payment release
- AI-generated work
- AI quality verification
- GitHub Pull Request review
- On-chain job tracking
- Secure payment workflow
- Modern glassmorphism UI
- Hardhat testing
- Express backend
- Monad blockchain integration

---

# 📂 Project Structure

```
monadBlitz/

├── hardhat/
│   ├── contracts/
│   │   └── Escrow.sol
│   ├── scripts/
│   │   └── deploy.js
│   ├── test/
│   │   └── Escrow.test.js
│   └── hardhat.config.js
│
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   └── services/
│   │       ├── ai.js
│   │       └── blockchain.js
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   ├── components/
    │   └── styles/
    └── package.json
```

---

# ⚙ Tech Stack

### Blockchain

- Monad Testnet
- Solidity
- Hardhat
- ethers.js

### Frontend

- Next.js
- React
- CSS

### Backend

- Node.js
- Express.js

### AI

- Anthropic Claude API

### Development

- GitHub
- GitHub Webhooks

---

# 🧠 How It Works

## Step 1 — Client Creates Job

The client opens the dashboard.

They enter:

- Worker Address
- Payment Amount

The payment is immediately locked inside the escrow smart contract.

Status:

```
Created
```

---

## Step 2 — AI Agent A Completes Work

The backend calls Claude.

Example:

```
Write a beginner-friendly article on Blockchain.
```

Claude generates the work.

The backend submits the result to the smart contract.

Status changes to:

```
Submitted
```

---

## Step 3 — AI Agent B Reviews Work

The verifier AI receives:

- Original requirement
- Generated result

It evaluates:

- Correct topic
- Grammar
- Completeness
- Quality

Claude returns:

```json
{
  "approved": true,
  "reason": "Meets all requirements."
}
```

---

## Step 4 — Smart Contract Approves

Backend calls

```
approve(jobId,true)
```

Status:

```
Approved
```

---

## Step 5 — Automatic Payment

Backend calls

```
releaseFunds(jobId)
```

The smart contract transfers the escrowed ETH to the worker.

Final Status

```
Released
```

---

# 🔄 Escrow State Machine

```
Created
   │
submitResult()
   │
   ▼
Submitted
   │
approve()
   │
   ▼
Approved
   │
releaseFunds()
   │
   ▼
Released
```

Rejected workflow

```
Created
↓

Submitted
↓

Rejected
```

No payment is released.

---

# 📜 Smart Contract

The escrow contract stores every job.

Each job contains

```solidity
struct Job {
    address client;
    address worker;
    uint256 amount;
    string resultHash;
    JobStatus status;
}
```

Supported operations

- createJob()
- submitResult()
- approve()
- releaseFunds()

The contract ensures payments can only be released after successful verification.

---

# 🤖 AI Layer

## Agent A

Responsibilities

- Generate requested work
- Return content
- Submit result to blockchain

Example

```
Requirement

↓

Claude

↓

Generated Article

↓

submitResult()
```

---

## Agent B

Responsibilities

- Review output
- Compare against requirements
- Return approval decision

Example

```
Requirement

↓

Generated Result

↓

Claude Review

↓

approve()
```

---

# 🔗 GitHub PR Review Workflow

The project also supports GitHub Pull Request verification.

Workflow

Developer opens Pull Request

↓

GitHub Webhook

↓

Backend receives PR

↓

Fetch PR Diff

↓

Claude Reviews Code

↓

If Approved

↓

approve()

↓

releaseFunds()

This demonstrates how AI agents can automatically review code and trigger blockchain payments.

---

# 🖥 Frontend

The dashboard provides

- Create Job
- Job Status
- Activity Log
- Escrow Status
- PR Review Testing
- GitHub Simulation

The UI uses

- Glassmorphism
- Dark theme
- Responsive cards
- Smooth animations

---

# 📡 Backend API

## Create Job

```
POST /api/jobs/create
```

Creates a blockchain escrow.

---

## Submit Job

```
POST /api/jobs/submit
```

Runs Agent A.

---

## Verify Job

```
POST /api/jobs/verify
```

Runs Agent B.

---

## GitHub Webhook

```
POST /api/github-webhook
```

Processes GitHub Pull Requests.

---

# 🧪 Running Tests

```
cd hardhat

npx hardhat test
```

Tests verify

- Job creation
- Submission
- Approval
- Rejection
- Payment release

---

# ▶ Running Locally

## Install dependencies

```
npm install
```

Frontend

```
cd frontend

npm install
npm run dev
```

Backend

```
cd backend

npm install
npm start
```

Hardhat

```
cd hardhat

npx hardhat node
```

Deploy

```
npx hardhat run scripts/deploy.js --network localhost
```

---

# 🔑 Environment Variables

Create a `.env` file.

```
ANTHROPIC_API_KEY=your_key

GITHUB_TOKEN=your_token

PRIVATE_KEY=wallet_private_key

RPC_URL=http://127.0.0.1:8545

CONTRACT_ADDRESS=deployed_contract
```

---

# 📸 Demo Flow

## AI Escrow

```
Create Job

↓

Trigger Agent A

↓

Submitted

↓

Trigger Agent B

↓

Approved

↓

Funds Released
```

---

## GitHub PR

```
Open Pull Request

↓

Webhook Triggered

↓

Claude Reviews Code

↓

Approved

↓

Escrow Releases Payment
```

---

# 🔒 Security

- Escrow protects client funds
- Only verifier can approve jobs
- Payments require successful verification
- Immutable blockchain records
- Transparent workflow

---

# 🌟 Future Improvements

- Multi-verifier consensus
- IPFS storage
- NFT reputation system
- Multi-agent collaboration
- WalletConnect integration
- DAO governance
- Support for multiple AI providers
- Cross-chain payments

---

# 👥 Team

Built for **Monad Blitz Hackathon** to demonstrate autonomous AI agents performing work, verifying quality, and securely receiving on-chain payments without manual intervention.

---

# 📄 License

MIT License

---

## ⭐ If you found this project interesting, consider giving it a Star!
