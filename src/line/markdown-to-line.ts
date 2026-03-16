const CODE_FENCE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`([^`]+)`/g;
const IMAGE_RE = /!\[([^\]]*)\]\([^)]+\)/g;
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g;
const HEADING_RE = /^\s{0,3}#{1,6}\s+/gm;
const BLOCKQUOTE_RE = /^\s{0,3}>\s?/gm;
const LIST_BULLET_RE = /^\s{0,3}[-*+]\s+/gm;
const LIST_NUMBER_RE = /^\s{0,3}\d+[.)]\s+/gm;
const HR_RE = /^\s{0,3}([-*_])\1\1+\s*$/gm;
const HTML_TAG_RE = /<[^>]+>/g;
const EMPHASIS_RE = /(\*\*|__|\*|_|~~)/g;

function stripCodeFences(text: string): string {
  return text.replace(CODE_FENCE_RE, (match) => {
    const inner = match.replace(/^```[^\n]*\n?/, "").replace(/```$/, "");
    return inner;
  });
}

export function stripMarkdown(text: string): string {
  let result = text;
  result = stripCodeFences(result);
  result = result.replace(INLINE_CODE_RE, "$1");
  result = result.replace(IMAGE_RE, "$1");
  result = result.replace(LINK_RE, "$1");
  result = result.replace(HEADING_RE, "");
  result = result.replace(BLOCKQUOTE_RE, "");
  result = result.replace(LIST_BULLET_RE, "");
  result = result.replace(LIST_NUMBER_RE, "");
  result = result.replace(HR_RE, "");
  result = result.replace(HTML_TAG_RE, "");
  result = result.replace(EMPHASIS_RE, "");
  result = result.replace(/\s{2,}/g, " ");
  return result.trim();
}
