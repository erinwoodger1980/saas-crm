import { fetchText } from "./http";

interface RobotsRules {
  allowed: string[];
  disallowed: string[];
}

export async function checkRobotsTxt(baseUrl: string, path: string): Promise<boolean> {
  try {
    const robotsUrl = new URL("/robots.txt", baseUrl).toString();
    const robotsTxt = await fetchText(robotsUrl, { timeout: 5000, retries: 1 });
    
    const rules = parseRobotsTxt(robotsTxt);
    
    // Check if path is explicitly disallowed
    for (const disallowRule of rules.disallowed) {
      if (path.startsWith(disallowRule)) {
        // Check if there's a more specific allow rule
        for (const allowRule of rules.allowed) {
          if (path.startsWith(allowRule) && allowRule.startsWith(disallowRule)) {
            return true;
          }
        }
        return false;
      }
    }
    
    // If not disallowed, allow
    return true;
  } catch (error: any) {
    console.warn(`Could not fetch robots.txt for ${baseUrl}: ${error.message}`);
    // If robots.txt doesn't exist or is inaccessible, default to allowing
    return true;
  }
}

function parseRobotsTxt(content: string): RobotsRules {
  const lines = content.split("\n");
  const rules: RobotsRules = { allowed: [], disallowed: [] };
  
  let isRelevantSection = false;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check for User-agent
    if (trimmed.toLowerCase().startsWith("user-agent:")) {
      const agent = trimmed.substring(11).trim();
      isRelevantSection = agent === "*" || agent.toLowerCase().includes("bot");
      continue;
    }
    
    if (!isRelevantSection) continue;
    
    // Parse Disallow
    if (trimmed.toLowerCase().startsWith("disallow:")) {
      const path = trimmed.substring(9).trim();
      if (path && path !== "/") {
        rules.disallowed.push(path);
      }
    }
    
    // Parse Allow
    if (trimmed.toLowerCase().startsWith("allow:")) {
      const path = trimmed.substring(6).trim();
      if (path) {
        rules.allowed.push(path);
      }
    }
  }
  
  return rules;
}
