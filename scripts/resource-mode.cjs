// Public source contains no Gotham binaries. Licensed resources are supplied
// separately and verified before being copied to a disposable Vite publicDir.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createHash, randomUUID} = require('node:crypto');

function resolveMode(value) {
  const mode = value === undefined ? 'public' : value;
  if (mode !== 'public' && mode !== 'licensed') {
    throw new Error('MORGRIE_RESOURCE_MODE must be public or licensed');
  }
  return mode;
}

function readManifest(projectRoot) {
  const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'resources/restricted-fonts.json'), 'utf8').replace(/^\uFEFF/, ''));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) {
    throw new Error('Invalid restricted-font resource manifest');
  }
  const seen = new Set();
  for (const file of manifest.files) {
    if (!/^fonts\/[A-Za-z0-9_-]+\.(otf|ttf|woff2?)$/.test(file.path || '') ||
        !/^[a-f0-9]{64}$/.test(file.sha256 || '') ||
        !Number.isSafeInteger(file.size) || file.size <= 0 || seen.has(file.path.toLowerCase())) {
      throw new Error('Invalid or duplicate restricted-font manifest entry');
    }
    seen.add(file.path.toLowerCase());
  }
  return manifest;
}

function regularFile(file, description) {
  let stat;
  try { stat = fs.lstatSync(file); } catch { throw new Error('Missing ' + description); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Expected regular file: ' + description);
  return stat;
}

function verifyPack(assetRoot, manifest, projectRoot) {
  if (!assetRoot) throw new Error('Licensed mode requires MORGRIE_RESTRICTED_ASSETS_DIR');
  let root;
  try { root = fs.realpathSync(assetRoot); } catch { throw new Error('Restricted resource pack directory is unavailable'); }
  if (projectRoot) {
    const relative = path.relative(fs.realpathSync(projectRoot), root);
    if (!(relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative))) {
      throw new Error('Restricted resource pack must be outside the public source directory');
    }
  }
  return manifest.files.map((entry) => {
    const file = path.join(root, ...entry.path.split('/'));
    const stat = regularFile(file, entry.path);
    const resolved = fs.realpathSync(file);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
      throw new Error('Restricted resource escapes resource pack: ' + entry.path);
    }
    const bytes = fs.readFileSync(file);
    if (stat.size !== entry.size || bytes.length !== entry.size) throw new Error('Restricted resource size mismatch: ' + entry.path);
    if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
      throw new Error('Restricted resource SHA256 mismatch: ' + entry.path);
    }
    // Retain the verified bytes: do not reread a mutable pack during assembly.
    return {path: entry.path, bytes};
  });
}

function copyTree(source, destination, skip = () => false, relative = '') {
  const stat = fs.lstatSync(source);
  if (stat.isSymbolicLink()) throw new Error('Symlink is not permitted in public resources: ' + relative);
  if (skip(relative)) return;
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, {recursive: true});
    for (const name of fs.readdirSync(source).sort()) {
      copyTree(path.join(source, name), path.join(destination, name), skip, relative ? relative + '/' + name : name);
    }
  } else if (stat.isFile()) {
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(source, destination);
  } else {
    throw new Error('Unsupported public resource: ' + relative);
  }
}

function transformPublicSource(code, id, projectRoot) {
  const normalize = (value) => {
    const normalized = value.replace(/\\/g, '/');
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
  };
  const clean = normalize(id.split('?')[0]);
  const root = normalize(path.resolve(projectRoot));
  if (clean === root + '/src/app.global.css') {
    let replacements = 0;
    const transformed = code.replace(/@font-face\s*\{[^}]*\}/g, (block) => {
      const family = block.match(/font-family:\s*['"]?(GothamRoundedBold|GothamRounded)['"]?\s*;/);
      if (!family) return block;
      replacements++;
      const local = family[1] === 'GothamRoundedBold'
        ? 'local("Arial Bold"), local("Arial-BoldMT"), local("Helvetica Bold"), local("Liberation Sans Bold")'
        : 'local("Arial"), local("ArialMT"), local("Helvetica"), local("Liberation Sans")';
      return '@font-face {\n  font-family: ' + family[1] + ';\n  src: ' + local + ';\n}';
    });
    if (replacements !== 2 || /url\([^)]*Gotham/i.test(transformed)) {
      throw new Error('Unexpected Gotham CSS declarations; public font transform requires review');
    }
    return transformed;
  }
  if (clean === root + '/src/components/panes/configure-panes/custom/satisfaction75/menu.tsx') {
    const needle = 'font-family: GothamRounded;';
    if (!code.includes(needle)) throw new Error('Unexpected Satisfaction75 font declaration; public transform requires review');
    return code.replace(needle, 'font-family: Arial, Helvetica, "Liberation Sans", sans-serif;');
  }
  return null;
}


// Reserve a unique staging path without reading a licensed pack. Vite preview
// loads the same config but only serves dist; it must not assemble resources.
function resourceSession({projectRoot, mode = process.env.MORGRIE_RESOURCE_MODE, restrictedAssetsDir = process.env.MORGRIE_RESTRICTED_ASSETS_DIR}) {
  projectRoot = path.resolve(projectRoot);
  mode = resolveMode(mode);
  const manifest = readManifest(projectRoot);
  const tempRoot = path.join(os.tmpdir(), 'morgrie-resources-' + randomUUID());
  const publicDir = path.join(tempRoot, 'public');
  let initialized = false;
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    process.removeListener('exit', cleanup);
    // This path is generated here, outside the source, never from caller input.
    if (initialized) fs.rmSync(tempRoot, {recursive: true, force: true});
  };
  const initialize = () => {
    if (initialized) return;
    if (disposed) throw new Error('Resource staging session is closed');
    regularFile(path.join(projectRoot, 'public/definitions/hash.json'), 'generated definitions/hash.json; run the definition build first');
    const verified = mode === 'licensed' ? verifyPack(restrictedAssetsDir, manifest, projectRoot) : [];
    fs.mkdirSync(tempRoot);
    initialized = true;
    try {
      const excluded = new Set(manifest.files.map((entry) => entry.path.toLowerCase()));
      copyTree(path.join(projectRoot, 'public'), publicDir, (relative) => excluded.has(relative.toLowerCase()) || /(^|\/)Gotham[^/]*\.(otf|ttf|woff2?)$/i.test(relative));
      regularFile(path.join(projectRoot, 'LICENSE'), 'LICENSE');
      regularFile(path.join(projectRoot, 'THIRD_PARTY_NOTICES.md'), 'THIRD_PARTY_NOTICES.md');
      for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md', 'licenses']) {
        copyTree(path.join(projectRoot, name), path.join(publicDir, name));
      }
      for (const entry of verified) {
        const target = path.join(publicDir, ...entry.path.split('/'));
        fs.mkdirSync(path.dirname(target), {recursive: true});
        fs.writeFileSync(target, entry.bytes);
      }
      process.once('exit', cleanup);
    } catch (error) {
      cleanup();
      throw error;
    }
  };
  const plugin = {
    name: 'morgrie-resource-mode',
    enforce: 'pre',
    config(config, environment) {
      if (environment.command === 'build') initialize();
      // Vite's root/@fs middleware can otherwise bypass publicDir filtering in
      // the private development checkout, where the original fonts remain.
      const defaults = ['.env', '.env.*', '*.{crt,pem}'];
      const restricted = manifest.files.map((entry) => path.basename(entry.path));
      return {
        publicDir,
        server: {fs: {strict: true, deny: [...(config.server?.fs?.deny || defaults), ...restricted, '**/[Gg][Oo][Tt][Hh][Aa][Mm]*.{otf,ttf,woff,woff2}']}},
      };
    },
    transform(code, id) {
      if (mode !== 'public') return null;
      const transformed = transformPublicSource(code, id, projectRoot);
      return transformed === null ? null : {code: transformed, map: null};
    },
    closeBundle: cleanup,
    configureServer(server) {
      initialize();
      if (mode === 'public') {
        const restricted = new Set(manifest.files.map((entry) => path.basename(entry.path).toLowerCase()));
        server.middlewares.use((request, response, next) => {
          let name;
          try { name = path.posix.basename(decodeURIComponent((request.url || '').split(/[?#]/)[0]).replace(/\\/g, '/')).toLowerCase(); }
          catch { return next(); }
          // Windows paths are case-insensitive, whereas Vite's fs.deny glob
          // matching is not. Also cover raw/import queries and encoded names.
          if (restricted.has(name) || /^gotham.*\.(otf|ttf|woff2?)$/.test(name)) {
            response.statusCode = 403;
            response.end('Restricted font is unavailable in public resource mode');
            return;
          }
          next();
        });
      }
      server.httpServer?.once('close', cleanup);
      server.watcher.once('close', cleanup);
    },
  };
  return {mode, publicDir, cleanup, initialize, plugin};
}

function prepareResourceMode(options) {
  const session = resourceSession(options);
  session.initialize();
  return session;
}

function createResourceModePlugin(options) {
  return resourceSession(options).plugin;
}

module.exports = {resolveMode, readManifest, verifyPack, transformPublicSource, prepareResourceMode, createResourceModePlugin};
