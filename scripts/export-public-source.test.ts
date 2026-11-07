import {afterEach, describe, expect, test} from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const {assertOutput, assertPublicFile, planExport, writeExport} = require('./export-public-source.cjs');

const allocated: string[] = [];
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
afterEach(() => {
  // Only mkdtemp-owned roots created by these fixtures are removed.
  for (const root of allocated.splice(0)) fs.rmSync(root, {recursive: true, force: true});
});
function fixture() {
  const base = fs.mkdtempSync(path.join(tmpdir(), 'morgrie-public-export-'));
  allocated.push(base);
  const projectRoot = path.join(base, 'development');
  fs.mkdirSync(projectRoot);
  const put = (relative: string, content: string | Buffer) => {
    const target = path.join(projectRoot, relative);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content);
  };
  const font = Buffer.from('restricted-fixture-font');
  const manifest = {version: 1, files: [{path: 'fonts/GothamBook.ttf', sha256: digest(font), size: font.length}]};
  const policy = {
    version: 1,
    includeDirectories: ['src', 'public', 'scripts'],
    includeFiles: ['bun.lock'],
    excludeFiles: ['src/unused.svg'],
    excludeDirectories: ['public/definitions'],
    requiredDirectories: ['src'],
    mappings: [{source: 'docs/public/README.md', destination: 'README.md'}],
  };
  put('bun.lock', '{"workspaces":{}}\n');
  put('src/app.ts', 'export const unchanged = true;\r\n');
  put('src/unused.svg', '<svg/>');
  put('public/favicon.ico', Buffer.from([0, 0, 1, 0]));
  put('public/fonts/GothamBook.ttf', font);
  put('public/definitions/hash.json', 'generated');
  put('docs/public/README.md', 'Public build instructions.\n');
  put('docs/private.md', 'Internal material');
  const files = ['bun.lock', 'src/app.ts', 'src/unused.svg', 'public/favicon.ico', 'public/fonts/GothamBook.ttf', 'public/definitions/hash.json', 'docs/public/README.md', 'docs/private.md'];
  const state = {head: 'a'.repeat(40), epoch: 1794062319, dirty: false};
  return {base, projectRoot, put, files, manifest, policy, state, font};
}

describe('explicit public-source selection', () => {
  test('preserves application/favicon bytes and only maps approved public docs', () => {
    const f = fixture(), prepared = planExport(f);
    const output = path.join(f.base, 'public');
    writeExport(prepared, output);
    expect(fs.readFileSync(path.join(output, 'src/app.ts'))).toEqual(fs.readFileSync(path.join(f.projectRoot, 'src/app.ts')));
    expect(fs.readFileSync(path.join(output, 'public/favicon.ico'))).toEqual(Buffer.from([0, 0, 1, 0]));
    expect(fs.readFileSync(path.join(output, 'README.md'), 'utf8')).toBe('Public build instructions.\n');
    for (const excluded of ['docs/private.md', 'src/unused.svg', 'public/definitions/hash.json', 'public/fonts/GothamBook.ttf', '.git']) expect(fs.existsSync(path.join(output, excluded))).toBe(false);
    const records = JSON.parse(fs.readFileSync(path.join(output, 'SOURCE-FILES.json'), 'utf8'));
    expect(records.files.find((v: any) => v.path === 'README.md').source).toBe('docs/public/README.md');
    expect(records.files.find((v: any) => v.path === 'src/app.ts').sha256).toBe(digest('export const unchanged = true;\r\n'));
  });
  test('requires explicit dirty opt-in and never calls a snapshot an approved RC', () => {
    const f = fixture();
    f.state.dirty = true;
    expect(() => planExport(f)).toThrow('--allow-dirty');
    const result = planExport({...f, allowDirty: true});
    expect(result.snapshot.originalWorkingTreeWasDirty).toBe(true);
    expect(result.snapshot.frozenRelease).toBe(false);
    expect(result.snapshot.status).toBe('WORKTREE_PREPARATION_NOT_FROZEN_RC');
    f.state.dirty = false;
    expect(planExport(f).snapshot.status).toBe('CLEAN_GIT_SOURCE_NOT_RC_APPROVAL');
  });
  test('does not silently copy required untracked files omitted by clean Git selection', () => {
    const f = fixture();
    f.files = f.files.filter((p) => p !== 'docs/public/README.md');
    expect(() => planExport(f)).toThrow('Required public-source file');
  });
  test('rejects renamed restricted font bytes and nested credential files', () => {
    const f = fixture();
    f.put('public/innocent.bin', f.font);
    expect(() => planExport({...f, files: [...f.files, 'public/innocent.bin']})).toThrow('Restricted font bytes');
    f.put('scripts/.env.local', 'unrelated');
    expect(() => planExport({...f, files: [...f.files, 'scripts/.env.local']})).toThrow('Forbidden');
  });
  test('rejects private local paths and known credential patterns but preserves public attribution', () => {
    expect(() => assertPublicFile('notice.txt', Buffer.from('Copyright Author <author@example.org>'), new Set())).not.toThrow();
    const privatePath = ['C:', 'Users', 'Private', 'project'].join('/');
    expect(() => assertPublicFile('note.txt', Buffer.from(privatePath), new Set())).toThrow('Private local path');
    const token = 'gh' + 'p_' + 'x'.repeat(30);
    expect(() => assertPublicFile('config.ts', Buffer.from(token), new Set())).toThrow('Credential pattern');
  });
  test('rejects traversal and colliding destination mappings', () => {
    const f = fixture();
    expect(() => planExport({...f, files: [...f.files, '../outside']})).toThrow('relative path');
    f.policy.mappings.push({source: 'src/app.ts', destination: 'bun.lock'});
    expect(() => planExport(f)).toThrow('Duplicate');
  });
  test('requires byte-accurate bundled GPL source archives', () => {
    const f = fixture();
    f.policy.includeDirectories.push('third_party');
    f.put('third_party/GPL-SOURCES.json', JSON.stringify([{archive: 'third_party/source-archives/sample.zip', sha256: digest('reviewed')}])) ;
    f.put('third_party/source-archives/sample.zip', 'altered');
    f.files.push('third_party/GPL-SOURCES.json', 'third_party/source-archives/sample.zip');
    expect(() => planExport(f)).toThrow('GPL source archive');
  });
});

describe('safe output and source provenance', () => {
  test('refuses output inside source, existing nonempty output and Git metadata', () => {
    const f = fixture();
    expect(() => assertOutput(f.projectRoot, path.join(f.projectRoot, 'export'))).toThrow('outside');
    const output = path.join(f.base, 'existing');
    fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'keep.txt'), 'keep');
    expect(() => writeExport(planExport(f), output)).toThrow('empty');
    expect(fs.readFileSync(path.join(output, 'keep.txt'), 'utf8')).toBe('keep');
    fs.mkdirSync(path.join(output, '.git'));
    expect(() => assertOutput(f.projectRoot, output)).toThrow('Git metadata');
  });
  test('resolves symlink parents before deciding output is external', () => {
    const f = fixture();
    const alias = path.join(f.base, 'alias');
    fs.symlinkSync(f.projectRoot, alias, process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => assertOutput(f.projectRoot, path.join(alias, 'nested', 'out'))).toThrow('outside');
    f.put('src/nested/legit.ts', 'real');
    fs.symlinkSync(path.join(f.projectRoot, 'src/nested'), path.join(f.projectRoot, 'src/alias'), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => planExport({...f, files: [...f.files, 'src/alias/legit.ts']})).toThrow('Symlink');
  });
  test('rejects concurrent source changes before creating the destination', () => {
    const f = fixture(), prepared = planExport(f), output = path.join(f.base, 'new-output');
    f.put('src/app.ts', 'changed after planning');
    expect(() => writeExport(prepared, output)).toThrow('Source changed');
    expect(fs.existsSync(output)).toBe(false);
  });
  test('produces deterministic snapshot metadata for the same selected source', () => {
    const f = fixture();
    const a = planExport(f), b = planExport(f);
    expect(a.snapshot).toEqual(b.snapshot);
    expect(a.snapshot.sourceDateEpoch).toBe(f.state.epoch);
    expect(a.snapshot.bunLockSha256).toBe(digest('{"workspaces":{}}\n'));
    expect(a.snapshot.frozenRelease).toBe(false);
  });
});
