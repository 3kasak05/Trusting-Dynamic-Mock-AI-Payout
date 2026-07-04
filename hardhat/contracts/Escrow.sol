// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Escrow {
    // Plain-English one-line explanation: The address of the verifier who approves or rejects jobs.
    address public verifier;

    // Plain-English one-line explanation: Tracks the total number of jobs created.
    uint256 public jobCount;

    enum JobStatus { Created, Submitted, Approved, Rejected, Released }

    struct Job {
        address payable client;
        address payable worker;
        uint256 jobAmount;
        string resultHash;
        JobStatus status;
    }

    // Plain-English one-line explanation: Maps job IDs to their respective Job details.
    mapping(uint256 => Job) public jobs;

    // Events for activity logging
    event JobCreated(uint256 indexed jobId, address indexed client, address indexed worker, uint256 jobAmount);
    event JobSubmitted(uint256 indexed jobId, string resultHash);
    event JobReviewed(uint256 indexed jobId, bool isApproved);
    event FundsReleased(uint256 indexed jobId, address indexed worker, uint256 jobAmount);

    // Plain-English one-line explanation: Initializes the contract and sets the verifier address.
    constructor(address _verifier) {
        verifier = _verifier;
    }

    // Plain-English one-line explanation: Creates a new job and escrow deposits the payment.
    function createJob(address payable _worker) external payable returns (uint256) {
        require(msg.value > 0, "Escrow amount must be greater than zero");
        require(_worker != address(0), "Worker address cannot be zero");

        jobCount++;
        jobs[jobCount] = Job({
            client: payable(msg.sender),
            worker: _worker,
            jobAmount: msg.value,
            resultHash: "",
            status: JobStatus.Created
        });

        emit JobCreated(jobCount, msg.sender, _worker, msg.value);
        return jobCount;
    }

    // Plain-English one-line explanation: Workers use this to submit their work results.
    function submitResult(uint256 _jobId, string calldata _resultHash) external {
        Job storage job = jobs[_jobId];
        require(job.status == JobStatus.Created, "Job is not in Created state");
        require(msg.sender == job.worker, "Only the worker can submit result");
        require(bytes(_resultHash).length > 0, "Result hash cannot be empty");

        job.resultHash = _resultHash;
        job.status = JobStatus.Submitted;

        emit JobSubmitted(_jobId, _resultHash);
    }

    // Plain-English one-line explanation: The verifier reviews the result and sets approval or rejection.
    function approve(uint256 _jobId, bool _isApproved) external {
        require(msg.sender == verifier, "Only the designated verifier can call this");
        Job storage job = jobs[_jobId];
        require(job.status == JobStatus.Submitted, "Job is not in Submitted state");

        if (_isApproved) {
            job.status = JobStatus.Approved;
        } else {
            job.status = JobStatus.Rejected;
        }

        emit JobReviewed(_jobId, _isApproved);
    }

    // Plain-English one-line explanation: Releases the escrowed funds to the worker's wallet address.
    function releaseFunds(uint256 _jobId) external {
        Job storage job = jobs[_jobId];
        require(job.status == JobStatus.Approved, "Job funds can only be released if status is Approved");

        job.status = JobStatus.Released;
        uint256 amountToRelease = job.jobAmount;
        job.jobAmount = 0; // Prevent re-entrancy

        (bool success, ) = job.worker.call{value: amountToRelease}("");
        require(success, "Failed to send Ether to worker");

        emit FundsReleased(_jobId, job.worker, amountToRelease);
    }
}
