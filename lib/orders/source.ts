/** Which AI assistant an order came through, from the tags placeOrderCore sets. Null for storefront orders. */
export function aiOrderSource(tags: readonly string[]): string | null {
  if (!tags.includes("ai-order")) return null;
  if (tags.includes("ai-claude")) return "Claude";
  if (tags.includes("ai-chatgpt")) return "ChatGPT";
  return "AI";
}
