import Anthropic from "@anthropic-ai/sdk";

// Initialize Anthropic client if key is provided
const apiKey = process.env.ANTHROPIC_API_KEY;
let anthropic = null;
if (apiKey && apiKey !== "mock" && apiKey !== "YOUR_ANTHROPIC_API_KEY") {
  anthropic = new Anthropic({ apiKey });
}

// Helper to extract the clean topic from job requirements
function extractCleanTopic(requirements) {
  let topic = requirements;
  const prefixes = [
    /^\s*write\s+an\s+article\s+about\s+/i,
    /^\s*write\s+about\s+/i,
    /^\s*explain\s+why\s+/i,
    /^\s*explain\s+/i,
    /^\s*write\s+a\s+beginner-friendly\s+explanation\s+of\s+/i,
    /^\s*write\s+a\s+beginner\s+friendly\s+explanation\s+of\s+/i,
    /^\s*write\s+a\s+150-word\s+article\s+about\s+/i,
    /^\s*write\s+a\s+300-word\s+article\s+about\s+/i,
    /^\s*write\s+/i,
  ];
  for (const prefix of prefixes) {
    topic = topic.replace(prefix, "");
  }
  return topic.trim().replace(/[\.\?\!]+$/, "").trim();
}

// Plain-English one-line explanation: Agent A acts as the freelance writer to perform the work based on requirements.
export async function runAgentA(requirements) {
  console.log(`[Agent A] Performing work for requirements: "${requirements}"`);
  
  if (!anthropic) {
    console.log("[Agent A] No API key detected. Running in mock mode...");
    
    const topic = extractCleanTopic(requirements);
    const capitalizedTopic = topic.charAt(0).toUpperCase() + topic.slice(1);

    let baseText = `Understanding ${topic} has become increasingly essential in modern technology. This domain represents a significant area of development, offering robust solutions for scalability, integration, and operational efficiency. By exploring ${topic}, practitioners can leverage advanced concepts to optimize their workflows and implement best practices. Whether used in small-scale applications or large enterprise systems, ${topic} provides the structural foundation needed to solve complex technical challenges. As the industry moves forward, continuous innovations surrounding ${topic} are expected to play a vital role in shaping future software architectures and digital standards.`;
    
    // Extract word count
    let minWordCount = 50;
    const wordCountMatch = requirements.match(/(\d+)\s*[- ]?word/i);
    if (wordCountMatch) {
      minWordCount = parseInt(wordCountMatch[1], 10);
    }
    
    let resultText = `MOCK ARTICLE ON ${capitalizedTopic.toUpperCase()}:\n${baseText}`;
    let currentWords = resultText.trim().split(/\s+/).filter(Boolean).length;
    
    // Expand text if needed to satisfy word count
    while (currentWords < minWordCount) {
      resultText += `\n\nIn addition, ${topic} continues to evolve rapidly. Researchers and developers worldwide are finding new ways to apply ${topic} to solve everyday problems and enhance user experiences. By staying informed about the latest trends in ${topic}, organizations can maintain a competitive edge and build more resilient systems.`;
      currentWords = resultText.trim().split(/\s+/).filter(Boolean).length;
    }
    
    resultText += `\n\n(Word count: ${currentWords})`;
    return resultText;
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      system: "You are a professional freelance content writer. Write an article that precisely meets the user's requirements.",
      messages: [{ role: "user", content: `Please perform this work task: ${requirements}` }],
    });
    return response.content[0].text;
  } catch (error) {
    console.error("[Agent A] Claude API call failed, falling back to mock:", error.message);
    return `FALLBACK MOCK ARTICLE: Renewable energy technologies like solar and wind power are key to cutting carbon emissions. By replacing coal and gas, they provide cleaner electricity and create local green jobs. (Word count: 28)`;
  }
}

// Plain-English one-line explanation: Agent B acts as the verifier to audit Agent A's output against the original requirements.
export async function runAgentB(requirements, workOutput) {
  console.log(`[Agent B] Verifying work output against requirements...`);
  
  // 1. Check if submission exists
  if (!workOutput || typeof workOutput !== "string" || workOutput.trim() === "") {
    return {
      approved: false,
      reason: "Verification failed: Submission is empty or does not exist."
    };
  }

  // 2. Minimum word count validation
  const actualWordCount = workOutput.trim().split(/\s+/).filter(Boolean).length;
  let minWordCount = 50; // Default minimum word count
  
  const wordCountMatch = requirements.match(/(\d+)\s*[- ]?word/i);
  if (wordCountMatch) {
    minWordCount = parseInt(wordCountMatch[1], 10);
  }

  if (actualWordCount < minWordCount) {
    return {
      approved: false,
      reason: `Verification failed: Work contains ${actualWordCount} words, which does not meet the minimum requirement of ${minWordCount} words.`
    };
  }

  // 3. Required topic check
  const topic = extractCleanTopic(requirements).toLowerCase();
  const outputLower = workOutput.toLowerCase();
  
  // Clean topic logic: filter out stop words and require all core words to be in the submission
  const stopWords = new Set(["of", "the", "a", "an", "on", "in", "to", "for", "and", "about", "why", "how", "with", "benefits", "article", "write", "explain"]);
  const topicWords = topic.split(/\s+/).filter(w => w && !stopWords.has(w) && w.length >= 3);
  
  const missingWords = topicWords.filter(word => !outputLower.includes(word));
  if (missingWords.length > 0) {
    return {
      approved: false,
      reason: `Verification failed: The submission does not cover the required topic "${topic}". Missing keywords: ${missingWords.join(", ")}.`
    };
  }

  // 4. Basic quality checks (placeholder texts)
  const placeholders = ["lorem ipsum", "todo", "insert text here", "placeholder"];
  for (const placeholder of placeholders) {
    if (outputLower.includes(placeholder)) {
      return {
        approved: false,
        reason: `Verification failed: The submission contains placeholder text: "${placeholder}".`
      };
    }
  }

  // Sentence structure check (must end with punctuation)
  const cleanedOutput = workOutput.replace(/\s*\(\s*word\s*count\s*:\s*\d+\s*\)\s*$/i, "").trim();
  if (!/[.!?]\s*$/.test(cleanedOutput)) {
    return {
      approved: false,
      reason: "Verification failed: The submission lacks proper sentence structure (must end with punctuation)."
    };
  }

  // If programmatic checks passed, proceed to API or Mock review
  if (!anthropic) {
    console.log("[Agent B] No API key detected. Running in mock mode...");
    return {
      approved: true,
      reason: `MOCK REVIEW: The submitted text successfully discusses the requested topic "${topic}" and meets the quality standards (${actualWordCount} words).`
    };
  }

  try {
    const prompt = `
Original Job Requirements: "${requirements}"
Submitted Worker Output: "${workOutput}"

Analyze if the worker's output satisfies the original job requirements (e.g. topic, tone, length).
You must respond in a valid JSON format with exactly two fields:
{
  "approved": true or false,
  "reason": "a brief explanation of your decision"
}
Do not include any other conversational text or markdown formatting (like \`\`\`json) outside the JSON object.
`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 500,
      system: "You are a strict quality control auditor. Assess the work and return your decision only in JSON format.",
      messages: [{ role: "user", content: prompt }],
    });

    const textResult = response.content[0].text.trim();
    const jsonString = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("[Agent B] Claude API call failed, falling back to mock verification:", error.message);
    return {
      approved: true,
      reason: `FALLBACK MOCK REVIEW: Fallback approval due to API failure. Programmatic validation succeeded (${actualWordCount} words).`
    };
  }
}
