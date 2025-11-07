import { Octokit } from "@octokit/rest";

let cached: Octokit | null = null;

function getClient(): Octokit {
  if (process.env.NODE_ENV === "test") {
    return new Octokit();
  }
  if (cached) return cached;
  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (!token) {
    throw new Error("GITHUB_TOKEN env not configured");
  }
  cached = new Octokit({ auth: token });
  return cached;
}

export async function createPullRequest(branchName: string, title: string, body: string) {
  if (process.env.NODE_ENV === "test") {
    return { url: `https://example.com/pr/${encodeURIComponent(branchName)}` };
  }

  const owner = (process.env.GITHUB_OWNER || "").trim();
  const repo = (process.env.GITHUB_REPO || "").trim();
  const base = (process.env.GIT_MAIN_BRANCH || "main").trim();
  if (!owner || !repo) {
    throw new Error("GITHUB_OWNER and GITHUB_REPO envs must be configured");
  }

  const client = getClient();
  const pr = await client.pulls.create({
    owner,
    repo,
    head: branchName,
    base,
    title,
    body,
  });
  return { url: pr.data.html_url }; 
}
