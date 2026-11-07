import {afterEach, describe, expect, it} from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
const {resolveMode, prepareResourceMode, transformPublicSource, createResourceModePlugin} = require('./resource-mode.cjs');

const {stageLicensedFonts} = require('./stage-licensed-fonts.cjs');
const {createServer, preview, build} = require('vite');

const allocated: string[] = [];
const prepared: {cleanup: () => void}[] = [];
const bytes = Buffer.from('isolated-test-font');
const manifestFiles = ['fonts/GothamRoundedBold_21016.ttf', 'fonts/GothamRoundedBook_21018.ttf'].map((name) => ({
  path: name, size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
}));
function write(root: string, name: string, data: string | Buffer) {
  const file = path.join(root, name);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, data);
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'morgrie-resource-test-'));
  allocated.push(root);
  const projectRoot = path.join(root, 'source');
  const pack = path.join(root, 'separate-pack');
  write(projectRoot, 'resources/restricted-fonts.json', JSON.stringify({version: 1, files: manifestFiles}));
  write(projectRoot, 'public/definitions/hash.json', '{"test":"preserved"}');
  write(projectRoot, 'public/fonts/Inter.woff2', 'open-test-font');
  write(projectRoot, 'LICENSE', 'test GPL terms');
  write(projectRoot, 'THIRD_PARTY_NOTICES.md', 'test notices');
  write(projectRoot, 'licenses/ISC.txt', 'test ISC terms');
  for (const entry of manifestFiles) write(pack, entry.path, bytes);
  return {projectRoot, pack};
}
function prepare(options: object) {
  const result = prepareResourceMode(options);
  prepared.push(result);
  return result;
}
afterEach(() => {
  for (const item of prepared.splice(0)) item.cleanup();
  for (const root of allocated.splice(0)) fs.rmSync(root, {recursive: true, force: true});
});

describe('isolated resource assembly', () => {
  it('defaults to public, rejects typo/empty modes', () => {
    expect(resolveMode(undefined)).toBe('public');
    for (const mode of ['', 'private', 'Licensed']) expect(() => resolveMode(mode)).toThrow();
  });
  it('public excludes restricted binaries even if accidentally present and preserves open resources/notices', () => {
    const {projectRoot, pack} = fixture();
    write(projectRoot, manifestFiles[0].path.replace(/^fonts\//, 'public/fonts/'), bytes);
    write(projectRoot, 'public/fonts/GothamUnexpected.otf', bytes);
    const result = prepare({projectRoot, mode: 'public', restrictedAssetsDir: pack});
    expect(fs.existsSync(path.join(result.publicDir, manifestFiles[0].path))).toBe(false);
    expect(fs.existsSync(path.join(result.publicDir, 'fonts/GothamUnexpected.otf'))).toBe(false);
    for (const name of ['fonts/Inter.woff2', 'definitions/hash.json', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses/ISC.txt']) {
      expect(fs.existsSync(path.join(result.publicDir, name))).toBe(true);
    }
    expect(fs.readFileSync(path.join(projectRoot, 'public', manifestFiles[0].path))).toEqual(bytes);
  });
  it('licensed verifies every declared file, assembles outside source, leaves source untouched, and cleans up', () => {
    const {projectRoot, pack} = fixture();
    const result = prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: pack});
    expect(path.relative(projectRoot, result.publicDir).startsWith('..')).toBe(true);
    for (const entry of manifestFiles) {
      expect(fs.readFileSync(path.join(result.publicDir, entry.path))).toEqual(bytes);
      expect(fs.existsSync(path.join(projectRoot, 'public', entry.path))).toBe(false);
    }
    result.cleanup();
    result.cleanup();
    expect(fs.existsSync(result.publicDir)).toBe(false);
  });
  it('fails when licensed pack is unspecified or a required file is absent', () => {
    const {projectRoot, pack} = fixture();
    expect(() => prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: ''})).toThrow('requires');
    fs.unlinkSync(path.join(pack, manifestFiles[1].path));
    expect(() => prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: pack})).toThrow('Missing');
  });
  it('fails on size or hash mismatch instead of silently falling back', () => {
    const {projectRoot, pack} = fixture();
    write(pack, manifestFiles[0].path, 'wrong');
    expect(() => prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: pack})).toThrow('size mismatch');
    write(pack, manifestFiles[0].path, Buffer.alloc(bytes.length, 1));
    expect(() => prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: pack})).toThrow('SHA256 mismatch');
  });
  it('rejects a restricted pack inside the public source directory', () => {
    const {projectRoot} = fixture();
    const internalPack = path.join(projectRoot, 'private');
    for (const entry of manifestFiles) write(internalPack, entry.path, bytes);
    expect(() => prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: internalPack})).toThrow('outside the public source');
  });
  it('rejects escaping or duplicate manifest destinations', () => {
    const {projectRoot} = fixture();
    for (const files of [[{...manifestFiles[0], path: '../secret.ttf'}], [manifestFiles[0], manifestFiles[0]]]) {
      write(projectRoot, 'resources/restricted-fonts.json', JSON.stringify({version: 1, files}));
      expect(() => prepare({projectRoot, mode: 'public'})).toThrow('manifest entry');
    }
  });
  it('requires generated definitions for a new build, without silently staging stale defaults', () => {
    const {projectRoot} = fixture();
    fs.unlinkSync(path.join(projectRoot, 'public/definitions/hash.json'));
    expect(() => prepare({projectRoot, mode: 'public'})).toThrow('definition build first');
  });
  it('does not emit a build missing license notices', () => {
    const {projectRoot} = fixture();
    fs.unlinkSync(path.join(projectRoot, 'THIRD_PARTY_NOTICES.md'));
    expect(() => prepare({projectRoot, mode: 'public'})).toThrow('THIRD_PARTY_NOTICES');
  });
});

describe('in-memory public font fallback', () => {
  const css = 'body {color: red;}\n@font-face { font-family: GothamRoundedBold; src: url(/fonts/GothamRoundedBold_21016.ttf); }\n@font-face { font-family: GothamRounded; src: url(/fonts/GothamRoundedBook_21018.ttf); }\n@font-face {font-family: Symbola; src: url(/fonts/Symbola.ttf);}';
  it('changes only two font faces, preserves other CSS, and never requests Gotham files', () => {
    const {projectRoot} = fixture();
    const id = path.join(projectRoot, 'src/app.global.css');
    write(projectRoot, 'src/app.global.css', css);
    const result = prepare({projectRoot, mode: 'public'});
    const output = result.plugin.transform(css, id).code;
    expect(output).toContain('local("Arial")');
    expect(output).toContain('local("Arial Bold")');
    expect(output).toContain('local("Liberation Sans")');
    expect(output).toContain('body {color: red;}');
    expect(output).toContain('@font-face {font-family: Symbola; src: url(/fonts/Symbola.ttf);}');
    expect(output).not.toContain('url(/fonts/Gotham');
    expect(fs.readFileSync(id, 'utf8')).toBe(css);
    if (process.platform === 'win32') expect(result.plugin.transform(css, id.toUpperCase()).code).toBe(output);
  });
  it('licensed CSS/JS is untouched; public transforms cannot reach unrelated files', () => {
    const {projectRoot, pack} = fixture();
    const licensed = prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: pack});
    expect(licensed.plugin.transform(css, path.join(projectRoot, 'src/app.global.css'))).toBeNull();
    expect(transformPublicSource(css, path.join(projectRoot, 'src/other.css'), projectRoot)).toBeNull();
    expect(transformPublicSource('font-family: GothamRounded;', path.join(projectRoot, 'src/components/panes/configure-panes/custom/satisfaction75/menu.tsx'), projectRoot)).toBe('font-family: Arial, Helvetica, "Liberation Sans", sans-serif;');
  });
  it('fails closed if upstream font declarations no longer match the reviewed transform', () => {
    const {projectRoot} = fixture();
    expect(() => transformPublicSource('body {}', path.join(projectRoot, 'src/app.global.css'), projectRoot)).toThrow('requires review');
  });
});


describe('explicit licensed-pack staging from a private checkout', () => {
  function privateFixture() {
    const state = fixture();
    for (const entry of manifestFiles) write(state.projectRoot, 'public/' + entry.path, bytes);
    return state;
  }
  it('copies all validated files to an external empty directory without changing originals', () => {
    const {projectRoot} = privateFixture();
    const destination = path.join(path.dirname(projectRoot), 'new-pack');
    const result = stageLicensedFonts({projectRoot, destination});
    expect(result.files).toBe(manifestFiles.length);
    for (const entry of manifestFiles) {
      expect(fs.readFileSync(path.join(destination, entry.path))).toEqual(bytes);
      expect(fs.readFileSync(path.join(projectRoot, 'public', entry.path))).toEqual(bytes);
    }
    const ready = prepare({projectRoot, mode: 'licensed', restrictedAssetsDir: destination});
    expect(fs.readFileSync(path.join(ready.publicDir, manifestFiles[0].path))).toEqual(bytes);
  });
  it('rejects targets inside source, nonempty targets, and absent targets without overwriting files', () => {
    const {projectRoot, pack} = privateFixture();
    expect(() => stageLicensedFonts({projectRoot})).toThrow('Usage:');
    expect(() => stageLicensedFonts({projectRoot, destination: path.join(projectRoot, 'pack')})).toThrow('outside');
    expect(() => stageLicensedFonts({projectRoot, destination: pack})).toThrow('empty');
    expect(fs.readFileSync(path.join(pack, manifestFiles[0].path))).toEqual(bytes);
  });
  it('fails before output for missing public-checkout fonts or incorrect size/hash', () => {
    const {projectRoot} = fixture();
    const destination = path.join(path.dirname(projectRoot), 'new-pack');
    expect(() => stageLicensedFonts({projectRoot, destination})).toThrow('Missing');
    expect(fs.existsSync(destination)).toBe(false);
    for (const entry of manifestFiles) write(projectRoot, 'public/' + entry.path, bytes);
    write(projectRoot, 'public/' + manifestFiles[0].path, 'bad');
    expect(() => stageLicensedFonts({projectRoot, destination})).toThrow('size mismatch');
    expect(fs.existsSync(destination)).toBe(false);
    write(projectRoot, 'public/' + manifestFiles[0].path, Buffer.alloc(bytes.length, 1));
    expect(() => stageLicensedFonts({projectRoot, destination})).toThrow('SHA256 mismatch');
    expect(fs.existsSync(destination)).toBe(false);
  });
});

describe('Vite resource lifecycle and restricted-font exposure', () => {
  function appFixture() {
    const state = fixture();
    write(state.projectRoot, 'index.html', '<!doctype html><html><body>isolated fixture<script type="module" src="/src/main.js"></script></body></html>');
    write(state.projectRoot, 'src/main.js', 'import "./app.global.css"; console.log("isolated");');
    write(state.projectRoot, 'src/app.global.css', '@font-face{font-family:GothamRoundedBold;src:url(/fonts/GothamRoundedBold_21016.ttf);}\n@font-face{font-family:GothamRounded;src:url(/fonts/GothamRoundedBook_21018.ttf);}\nbody{font-family:GothamRounded;color:#212121;}');
    for (const entry of manifestFiles) write(state.projectRoot, 'public/' + entry.path, bytes);
    return state;
  }
  function origin(server: any) {
    return 'http://127.0.0.1:' + server.httpServer.address().port;
  }
  it('public dev serves safe assets but denies restricted fonts through public/root/@fs routes', async () => {
    const {projectRoot} = appFixture();
    const server = await createServer({
      configFile: false, root: projectRoot, logLevel: 'silent',
      plugins: [createResourceModePlugin({projectRoot, mode: 'public'})],
      server: {host: '127.0.0.1', port: 0, open: false}, optimizeDeps: {disabled: true},
    });
    try {
      await server.listen();
      const base = origin(server);
      expect(await (await fetch(base + '/fonts/Inter.woff2')).text()).toBe('open-test-font');
      const original = path.join(projectRoot, 'public', manifestFiles[0].path).replace(/\\/g, '/');
      for (const url of ['/fonts/' + path.basename(original), '/public/fonts/' + path.basename(original), '/@fs/' + original, '/public/fonts/' + path.basename(original).toUpperCase() + '?raw', '/public/fonts/%47othamRoundedBold_21016.ttf?url']) {
        const response = await fetch(base + url);
        expect(await response.text()).not.toBe(bytes.toString());
        expect([403, 404]).toContain(response.status);
      }
      const css = await (await fetch(base + '/src/app.global.css')).text();
      expect(css).toContain('local(');
      expect(css).not.toContain('url(/fonts/Gotham');
    } finally { await server.close(); }
  });
  it('licensed dev serves only the verified staged font URL and preserves font source declarations', async () => {
    const {projectRoot, pack} = appFixture();
    const server = await createServer({
      configFile: false, root: projectRoot, logLevel: 'silent',
      plugins: [createResourceModePlugin({projectRoot, mode: 'licensed', restrictedAssetsDir: pack})],
      server: {host: '127.0.0.1', port: 0, open: false}, optimizeDeps: {disabled: true},
    });
    try {
      await server.listen();
      expect(await (await fetch(origin(server) + '/' + manifestFiles[0].path)).text()).toBe(bytes.toString());
      expect(await (await fetch(origin(server) + '/src/app.global.css')).text()).toContain('url(/fonts/Gotham');
    } finally { await server.close(); }
  });
  it('preview serves existing dist without a licensed pack or generated source public directory', async () => {
    const {projectRoot} = fixture();
    fs.rmSync(path.join(projectRoot, 'public'), {recursive: true});
    write(projectRoot, 'dist/index.html', '<!doctype html>existing licensed build');
    const server = await preview({
      configFile: false, root: projectRoot, logLevel: 'silent',
      plugins: [createResourceModePlugin({projectRoot, mode: 'licensed', restrictedAssetsDir: ''})],
      preview: {host: '127.0.0.1', port: 0, open: false},
    });
    try { expect(await (await fetch(origin(server) + '/')).text()).toBe('<!doctype html>existing licensed build'); }
    finally { await new Promise<void>((resolve) => server.httpServer.close(() => resolve())); }
  });
  it('minimal production builds include current resources/notices, public fallback, and exact licensed fonts', async () => {
    const {projectRoot, pack} = appFixture();
    for (const mode of ['public', 'licensed']) {
      const outDir = path.join(projectRoot, 'test-dist-' + mode);
      // Change the source immediately before build: staging must not freeze it
      // at a prior config/preview load.
      write(projectRoot, 'public/definitions/hash.json', '{"mode":"' + mode + '"}');
      await build({configFile: false, root: projectRoot, logLevel: 'silent',
        plugins: [createResourceModePlugin({projectRoot, mode, restrictedAssetsDir: pack})],
        build: {outDir, emptyOutDir: true, minify: false},
      });
      expect(fs.readFileSync(path.join(outDir, 'definitions/hash.json'), 'utf8')).toBe('{"mode":"' + mode + '"}');
      expect(fs.existsSync(path.join(outDir, 'LICENSE'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'THIRD_PARTY_NOTICES.md'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, manifestFiles[0].path))).toBe(mode === 'licensed');
      const cssName = fs.readdirSync(path.join(outDir, 'assets')).find((name) => name.endsWith('.css'))!;
      const css = fs.readFileSync(path.join(outDir, 'assets', cssName), 'utf8');
      expect(css.includes('url(/fonts/Gotham')).toBe(mode === 'licensed');
      expect(css.includes('local("Arial")')).toBe(mode === 'public');
      if (mode === 'licensed') expect(fs.readFileSync(path.join(outDir, manifestFiles[0].path))).toEqual(bytes);
    }
  });
});
