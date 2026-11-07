// Explicit private-checkout helper. No download, source mutation, or implicit use.
const fs = require('node:fs');
const path = require('node:path');
const {readManifest, verifyPack} = require('./resource-mode.cjs');

function outside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative);
}

function resolvedDestination(destination) {
  const missing = [];
  let ancestor = path.resolve(destination);
  while (!fs.existsSync(ancestor)) {
    missing.unshift(path.basename(ancestor));
    const parent = path.dirname(ancestor);
    if (parent === ancestor) throw new Error('Resource target parent is unavailable');
    ancestor = parent;
  }
  return path.join(fs.realpathSync(ancestor), ...missing);
}

function stageLicensedFonts({projectRoot = path.resolve(__dirname, '..'), destination}) {
  if (!destination) throw new Error('Usage: node scripts/stage-licensed-fonts.cjs <outside-source-empty-directory>');
  const root = fs.realpathSync(projectRoot);
  const target = resolvedDestination(destination);
  if (!outside(root, target)) throw new Error('Licensed resource target must be outside the source directory');
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (!stat.isDirectory() || fs.readdirSync(target).length !== 0) {
      throw new Error('Licensed resource target must be an empty directory; existing files are never overwritten');
    }
  }
  // Validate and retain every byte before creating any output. A public checkout
  // without the restricted binaries fails here, rather than fetching fonts.
  const verified = verifyPack(path.join(root, 'public'), readManifest(root));
  fs.mkdirSync(target, {recursive: true});
  for (const entry of verified) {
    const file = path.join(target, ...entry.path.split('/'));
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, entry.bytes, {flag: 'wx'});
  }
  return {directory: target, files: verified.length};
}

if (require.main === module) {
  const result = stageLicensedFonts({destination: process.argv[2]});
  console.log('Verified and staged ' + result.files + ' licensed font files to ' + result.directory);
}
module.exports = {stageLicensedFonts};
