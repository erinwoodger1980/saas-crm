import fetch from "node-fetch";

const USER_AGENT = "JoineryAI-AssetBot/1.0 (+contact: support@joineryai.app)";
const DEFAULT_TIMEOUT = 8000;
const MAX_RETRIES = 2;

export interface FetchOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
}

export async function fetchText(
  url: string,
  options: FetchOptions = {}
): Promise<string> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, headers = {} } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          ...headers,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error: any) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error("Failed to fetch text");
}

export async function fetchBuffer(
  url: string,
  options: FetchOptions = {}
): Promise<Buffer> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES, headers = {} } = options;
  
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          ...headers,
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      lastError = error;
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error("Failed to fetch buffer");
}

export async function headRequest(
  url: string,
  options: FetchOptions = {}
): Promise<{ contentType?: string; contentLength?: number }> {
  const { timeout = DEFAULT_TIMEOUT, headers = {} } = options;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": USER_AGENT,
        ...headers,
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return {
      contentType: response.headers.get("content-type") || undefined,
      contentLength: parseInt(response.headers.get("content-length") || "0", 10) || undefined,
    };
  } catch (error: any) {
    console.warn(`HEAD request failed for ${url}: ${error.message}`);
    return {};
  }
}
