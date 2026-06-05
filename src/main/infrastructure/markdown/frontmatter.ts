import { parse, stringify } from 'yaml';

const DELIMITER = '---';

export interface FrontmatterDocument<T = Record<string, unknown>> {
  frontmatter: T;
  body: string;
}

export function parseMarkdown<T = Record<string, unknown>>(raw: string): FrontmatterDocument<T> {
  const lines = raw.split(/\r?\n/);
  if (lines[0] !== DELIMITER) {
    return { frontmatter: {} as T, body: raw };
  }
  const closingIndex = lines.findIndex((line, idx) => idx > 0 && line === DELIMITER);
  if (closingIndex === -1) {
    return { frontmatter: {} as T, body: raw };
  }
  const fmText = lines.slice(1, closingIndex).join('\n');
  const body = lines
    .slice(closingIndex + 1)
    .join('\n')
    .replace(/^\n/, '');
  const parsed = (parse(fmText) ?? {}) as T;
  return { frontmatter: parsed, body };
}

export function serializeMarkdown(frontmatter: Record<string, unknown>, body: string): string {
  const fmText = stringify(frontmatter).trimEnd();
  const normalizedBody = body.endsWith('\n') ? body : `${body}\n`;
  return `${DELIMITER}\n${fmText}\n${DELIMITER}\n${normalizedBody}`;
}
