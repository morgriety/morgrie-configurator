# wouter 2.10.0 — license and exact-source evidence

Verified on 2026-11-07 using the official npm registry and the upstream author's GitHub repository. No changes were made to the development repository.

## Finding

The installed and locked wouter **2.10.0** release is licensed **ISC**. Its absence of a standalone LICENSE file is deliberate and is explained by upstream maintainer **molefrog / Alexey Taktarov** in [issue #205](https://github.com/molefrog/wouter/issues/205#issuecomment-889753654). On 2021-07-30 the maintainer explicitly confirmed that wouter is licensed under ISC, declared in package.json, and that they chose not to ship LICENSE.md. This is direct upstream evidence, not an inference from a license scanner.

The official 2.10.0 npm package declares author `Alexey Taktarov <molefrog@gmail.com>` and license `ISC`. The address here is published upstream author attribution, not a private MORGRIE account. The tarball has no separate copyright-year notice. Do not invent a year or replace the exact-version license with the repository's later Unlicense.

## Version and source identity

| Item | Exact value |
| --- | --- |
| npm version | `2.10.0` |
| npm metadata | https://registry.npmjs.org/wouter/2.10.0 |
| Official artifact | https://registry.npmjs.org/wouter/-/wouter-2.10.0.tgz |
| Artifact integrity | `sha512-4IoXysBk9c8qv+rkHW65K2joZbrios3NnWbp+FjCH26S3i8v8H4btgHQO33+g1CNDrSbdKkrtmbm80SLHxnRBw==` |
| npm gitHead | `f9f7ea7b555d0017c6143aab04115549c915637e` |
| Official `v2.10.0` tag commit | `0900215042359635fea53a834495b29bf27ed2cf` |
| Exact upstream source | https://github.com/molefrog/wouter/tree/0900215042359635fea53a834495b29bf27ed2cf |
| Release | https://github.com/molefrog/wouter/releases/tag/v2.10.0 |

The fetched tarball's SHA512 equals npm metadata and the existing dependency-lock integrity. The `v2.10.0` tag is one commit after the npm gitHead. The **only changed file is package.json**, changing the version from `2.10.0-alpha.4` to `2.10.0`. Thus the alpha version string at gitHead is not evidence that different runtime code was published. The comparison is retained in `npm-githead-to-release-tag.json`.

All seven published root JavaScript files were downloaded from this exact release tag and compared by SHA256 with the npm tarball: index.js, matcher.js, react-deps.js, static-location.js, use-location.js, use-sync-external-store.js, and use-sync-external-store.native.js. **7/7 matched byte for byte.** See `published-source-match.json`. The preact and cjs folders are release-generated variants; no claim is made that their built text equals the unbuilt source tree.

## License evidence and notice treatment

- `npm-wouter-2.10.0.metadata.json`: exact official package metadata, including author, ISC declaration, gitHead, integrity and tarball URL.
- `upstream-isc-confirmation.json`: original author's dated public comments and URLs confirming ISC and the deliberate lack of LICENSE.md.
- `ISC-standard-template.txt`: ISC standard template downloaded from https://raw.githubusercontent.com/spdx/license-list-data/main/text/ISC.txt; identifier and text can also be checked at https://spdx.org/licenses/ISC.html.
- `LICENSE-NOTICE.txt`: ready-to-use dependency notice. It preserves the actual author attribution and ISC terms, explicitly says no standalone copyright-year notice was supplied, and does **not** invent a year or pretend that the standard template was an upstream LICENSE file.
- The later repository license change is [commit 31052d5623719c953f7b622c27795a8ffe23c52b](https://github.com/molefrog/wouter/commit/31052d5623719c953f7b622c27795a8ffe23c52b), dated 2024-02-03, subject `Unlicense (Public Domain).` It is not used as the 2.10.0 license evidence.

The permission/declaration evidence is complete enough to record this dependency as **ISC confirmed** rather than “unknown license because LICENSE file missing.” There is no recovered upstream copyright year to transcribe. If a downstream compliance policy insists on a year-specific original notice, it must request it from upstream; no fabricated year should be added.

## Scope

These are software provenance and license-evidence checks. They do not represent legal advice, a device test, or a new release candidate freeze. The public preparation remains a snapshot until the final source baseline is frozen.
