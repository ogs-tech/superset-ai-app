import type { LanguagePreference } from '../../../shared/settings.js';

export const LANGUAGE_PROMPTS: Record<Exclude<LanguagePreference, 'off'>, string> = {
  mirror:
    'Reply in the same language the user writes in. Write all code, comments, test descriptions, and technical identifiers in English.',
  'pt-BR':
    'Reply in pt-BR. Write all code, comments, test descriptions, and technical identifiers in English.',
  en: 'Reply in English. Write all code, comments, test descriptions, and technical identifiers in English.',
  es: 'Reply in Spanish. Write all code, comments, test descriptions, and technical identifiers in English.',
};

const LANGUAGE_BLOCK_RE = /\n*<language>[\s\S]*?<\/language>\n?/;

export function updateLanguageSection(body: string, language: LanguagePreference): string {
  if (language === 'off') {
    const cleaned = body.replace(LANGUAGE_BLOCK_RE, '');
    const trimmed = cleaned.replace(/\s+$/, '');
    return trimmed.length === 0 ? '' : trimmed + '\n';
  }

  const block = `<language>\n${LANGUAGE_PROMPTS[language]}\n</language>`;
  const normalized = body.replace(/\s+$/, '');

  if (LANGUAGE_BLOCK_RE.test(body)) {
    const replaced = body.replace(LANGUAGE_BLOCK_RE, '\n\n' + block + '\n');
    return replaced.replace(/\s+$/, '') + '\n';
  }

  return normalized + '\n\n' + block + '\n';
}
