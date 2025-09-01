/**
 * Helper utilities for providers
 */

export function extractCodeOrText(s: string): { code?: string; text?: string } {
  if (!s) return { text: "" };

  // Try to extract code from markdown code blocks
  const codeBlockMatch = s.match(/```[\w]*\n?([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return { code: codeBlockMatch[1].trim() };
  }

  // Return as plain text if no code blocks found
  return { text: s.trim() };
}

export async function pingJson(
  url: string,
  ms = 1200,
  signal?: AbortSignal,
): Promise<boolean> {
  let timeoutId: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("timeout")), ms);
  });

  try {
    const response = await Promise.race([
      fetch(url, { signal, method: "GET" }),
      timeoutPromise,
    ]);
    clearTimeout(timeoutId);

    if (!("ok" in response)) return false;
    return (response as Response).ok;
  } catch {
    clearTimeout(timeoutId);
    return false;
  }
}
