import { Request } from "@paperback/types";

const SUPPORTED_DOMAINS = [
  "pastebin.com",
  "raw.githubusercontent.com",
  "gist.githubusercontent.com",
  "gitlab.com",
];

export async function fetchRawText(url: string): Promise<string> {
  try {
    // Convert pastebin URLs to raw format
    if (url.includes("pastebin.com") && !url.includes("raw")) {
      url = url.replace("pastebin.com/", "pastebin.com/raw/");
    }

    // Convert GitHub gist URLs to raw format
    if (url.includes("gist.github.com") && !url.includes("raw")) {
      url = url.replace("gist.github.com", "gist.githubusercontent.com/raw");
    }

    const request: Request = {
      url: url,
      method: "GET",
    };

    const [response, data] = await Application.scheduleRequest(request);

    if (response.status !== 200) {
      throw new Error(`Failed to fetch data: HTTP ${response.status}`);
    }

    const text = Application.arrayBufferToUTF8String(data);
    if (!text || text.trim().length === 0) {
      throw new Error("Received empty response");
    }

    return text;
  } catch (error) {
    throw new Error(
      `Failed to fetch text: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export function isValidDataUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return SUPPORTED_DOMAINS.some((domain) =>
      parsedUrl.hostname.includes(domain),
    );
  } catch {
    return false;
  }
}
