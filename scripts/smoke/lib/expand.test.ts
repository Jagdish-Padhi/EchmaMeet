import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { expandString, expandValue } from './expand';

describe('expandString', () => {
  const directories: string[] = [];
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('inserts environment variables', () => {
    expect(expandString('Bearer ${ENV:TOKEN}', { TOKEN: 'abc' })).toBe('Bearer abc');
  });

  it('fails loudly and names a missing variable', () => {
    expect(() => expandString('${ENV:MISSING}', {})).toThrow(/MISSING/);
  });

  it('inlines text and base64 file content', () => {
    const directory = mkdtempSync(join(tmpdir(), 'chaosboard-expand-'));
    directories.push(directory);
    const file = join(directory, 'sample.txt');
    writeFileSync(file, 'hello');
    expect(expandString(`\${FILE_TEXT:${file}}`, {})).toBe('hello');
    expect(expandString(`\${FILE_BASE64:${file}}`, {})).toBe(
      Buffer.from('hello').toString('base64'),
    );
  });

  it('expands nested structures and leaves other values untouched', () => {
    const result = expandValue(
      { headers: { auth: '${ENV:T}' }, list: ['${ENV:T}', 3, true, null] },
      { T: 'x' },
    );
    expect(result).toEqual({ headers: { auth: 'x' }, list: ['x', 3, true, null] });
  });
});
