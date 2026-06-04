import { describe, it, expect } from 'vitest';
import { updateLanguageSection, LANGUAGE_PROMPTS } from '../../../../src/main/application/services/language-section.js';

describe('updateLanguageSection', () => {
  const sampleBody = '# Global instructions\n\nSome content here.\n';

  it('appends a language block when none exists', () => {
    const result = updateLanguageSection(sampleBody, 'pt-BR');
    expect(result).toBe(
      '# Global instructions\n\nSome content here.\n\n<language>\n' +
      LANGUAGE_PROMPTS['pt-BR'] +
      '\n</language>\n',
    );
  });

  it('replaces an existing language block', () => {
    const body = '# Global instructions\n\n<language>\nOld prompt\n</language>\n';
    const result = updateLanguageSection(body, 'en');
    expect(result).toBe(
      '# Global instructions\n\n<language>\n' +
      LANGUAGE_PROMPTS['en'] +
      '\n</language>\n',
    );
  });

  it('removes the block entirely when language is off', () => {
    const body = '# Global instructions\n\nContent.\n\n<language>\nSome prompt\n</language>\n';
    const result = updateLanguageSection(body, 'off');
    expect(result).toBe('# Global instructions\n\nContent.\n');
  });

  it('returns body unchanged when off and no block exists', () => {
    const result = updateLanguageSection(sampleBody, 'off');
    expect(result).toBe(sampleBody);
  });

  it('handles body with no trailing newline', () => {
    const body = '# Global instructions\n\nContent.';
    const result = updateLanguageSection(body, 'mirror');
    expect(result).toBe(
      '# Global instructions\n\nContent.\n\n<language>\n' +
      LANGUAGE_PROMPTS['mirror'] +
      '\n</language>\n',
    );
  });

  it('removes excess blank lines before block when removing', () => {
    const body = '# Global instructions\n\nContent.\n\n\n\n<language>\nPrompt\n</language>\n';
    const result = updateLanguageSection(body, 'off');
    expect(result).toBe('# Global instructions\n\nContent.\n');
  });

  it('handles mirror language correctly', () => {
    const result = updateLanguageSection(sampleBody, 'mirror');
    expect(result).toContain('Reply in the same language the user writes in.');
  });

  it('handles es language correctly', () => {
    const result = updateLanguageSection(sampleBody, 'es');
    expect(result).toContain('Reply in Spanish.');
  });
});
