# One source tree, two resource builds

## Toolchain and locked dependencies

Use Node **24.19.0** and Bun **1.4.2**, pinned by .node-version and .bun-version. Put both on PATH. Run `bun install --frozen-lockfile`; do not update dependencies or regenerate bun.lock for a release. The lock pins via-keyboards to commit 79ae8d2f8799fb526afe38a1400f0ecc0712aed2 and Bun applies the registered patch in patches/. The existing environment guard rejects other tool versions.

`bun run build:public` builds definitions, TypeScript and Vite, then verifies dist definitions. `bun run test` runs each test file in its own process. Definition tests also accept VIA_DEFINITIONS_ROOT=dist/definitions to check the produced artifact.

## Public build (default)

`bun run build:public` explicitly selects public resources. `bun run build` defaults to public unless MORGRIE_RESOURCE_MODE explicitly selects licensed. Public mode excludes the twelve Gotham binaries, even when running in the private development tree where the originals are retained. It transforms the existing Gotham CSS font faces into aliases to installed Arial, Helvetica or Liberation Sans, and makes the Satisfaction75 font fallback explicit. These transformations occur in memory: there is no separate application source fork and no font download. Public fallback metrics may differ from the licensed website.

Existing Inter, Fira Sans and Fira Sans Condensed external stylesheet references are retained; this work does not claim identical offline font availability. Other VIA themes, 3D resources and device definitions are preserved.

## Licensed website build

`bun run build:licensed` requires MORGRIE_RESTRICTED_ASSETS_DIR to point to a separately controlled resource pack **outside this source tree**. The pack contains fonts/ with the twelve exact files in resources/restricted-fonts.json. Missing files, changed sizes or SHA-256 mismatches fail the build. There is no automatic network fetch and no silent public fallback.

PowerShell:

`$env:MORGRIE_RESTRICTED_ASSETS_DIR = Read-Host 'Authorized external resource pack'`

`bun run build:licensed`

The private development repository retains its existing authorized public/fonts originals. Where these originals are available, the explicit `node scripts/stage-licensed-fonts.cjs <empty-external-directory>` helper validates them and copies only the twelve declared files into an external pack. It does not download, delete or alter originals. It fails in a public source checkout that has no licensed originals. Existing private website CI uses this explicit step in runner temporary storage; public-source CI only builds public mode and receives no deployment credentials.

Both modes assemble a temporary public directory and add LICENSE, THIRD_PARTY_NOTICES.md and licenses/. Licensed output contains the existing website font bytes. **Licensed dist and external font packs are not public source artifacts.** Website authorization is not a grant to redistribute proprietary font binaries in GitHub source.

On Windows, `scripts/via.ps1 build -ResourceMode public` or `scripts/via.ps1 build -ResourceMode licensed` uses a project-local or installed, exact-version Bun. Existing task names are retained. Set the external pack variable first for licensed mode. No dependency version or application default setting is changed by choosing resources.

## Deterministic definitions and preview

Definition timestamps use SOURCE_DATE_EPOCH when provided; otherwise an exported SOURCE_SNAPSHOT.json supplies the originating Git commit epoch, or a development checkout uses its Git commit. The formal repository must not inherit stale snapshot metadata. Compare builds with the same source and epoch. Same-platform output verification does not establish cross-OS/Linux CI equivalence.

`bun run preview --host 127.0.0.1 --port 4173 --strictPort` serves the last built dist; preview does not rebuild or require the font pack used to make dist. Reuse an existing preview instead of starting duplicate instances. Build licensed last when the local preview is intended to represent the official website. Confirm asset hashes before using it for acceptance.

## Exporting public corresponding source

Maintain application/build code only in the development repository. The export command is executed there: exported snapshots omit private Git history and map docs/public templates to their public destinations, so a snapshot is not an export-authoring checkout. Run:

`bun run source:export --output <empty-directory-outside-repository>`

The exporter requires clean Git by default, never copies .git, never commits, and never overwrites a populated destination. Explicit `--allow-dirty` is for preparation only and records WORKTREE_PREPARATION_NOT_FROZEN_RC. Do not identify such a snapshot as the corresponding source of a future frozen release.

resources/public-source-policy.json allowlists source, definitions, types, scripts, pins, lock, patches, licenses and public assets. Restricted fonts are excluded by declared paths and byte hashes. Caches, dist, credentials, internal evidence and deployment workflows are excluded. docs/public/ supplies sanitized README and documentation mapped to their public paths. These are documentation templates, not another application implementation. Historical upstream copyright contacts remain intact.

SOURCE-FILES.json records each development path, public destination and SHA-256; SOURCE_SNAPSHOT.json records the originating HEAD, dirty status, epoch, lock hash and source fingerprint. These generated records supplement the GPL source and attribution, and do not make a dirty tree a release. To refresh an existing public preparation, preserve the prior directory separately, export into a new empty directory, validate, then use the new copy. No original history is rewritten. The public favicon guide is mapped from docs/public/FAVICON.md; the private development acceptance history is not exported. Do not maintain favicon or build changes separately in the public copy.

Before publishing, review and commit the intended development baseline, export again without --allow-dirty, install frozen dependencies and validate both modes from that same export. Preserve artifact manifests, source identity and resource hashes with the release. Provide the actual complete corresponding-source location with deployed JavaScript. This workflow does not create GitHub repositories, upload, publish or deploy automatically.
