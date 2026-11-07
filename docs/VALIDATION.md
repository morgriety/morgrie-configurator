# Source identity and validation history

## Identity of this export

The current export's identity is recorded by the exporter in [SOURCE_SNAPSHOT.json](../SOURCE_SNAPSHOT.json) and [SOURCE-FILES.json](../SOURCE-FILES.json). This document does not hard-code a current commit, worktree status or release approval. Read the generated fields for this particular copy:

| Field | Meaning |
| --- | --- |
| `originalDevelopmentHead` | The latest development Git commit at the time of export. |
| `originalWorkingTreeWasDirty` / `status` | Whether the export includes uncommitted changes. `false` and `CLEAN_GIT_SOURCE_NOT_RC_APPROVAL` identify a clean committed source export. `true` and `WORKTREE_PREPARATION_NOT_FROZEN_RC` identify an explicitly requested preparation copy; its HEAD alone does not identify all exported changes. |
| `sourceDateEpoch` | The originating commit timestamp used for reproducible definition generation. |
| `bunLockSha256` | The exported frozen dependency lock hash. |
| `sourceFingerprint` and file records | Source/destination paths and hashes for the exported files. |
| `frozenRelease` | Release-approval metadata; a clean export does not automatically approve an RC. |

The exporter refreshes these records on every export. Its default requires a clean development worktree. Do not describe an `--allow-dirty` preparation as the exact source of a committed release. Application and build files are copied unchanged; explicit public documentation mappings and generated provenance are recorded separately.

## Dated software validation history

The results below apply **only to the stated historical source and environment**. They are not automatically renewed when this document is exported again. Exporting itself does not install dependencies, run tests, build the application or verify a physical keyboard.

| Historical check | Source and scope | Result |
| --- | --- | --- |
| Stage 03 closeout, 2026-11-07 | Windows preparation based on `ebd59fe131124ec47798d4e4816a3c16dd3a14dc` plus the then-uncommitted build integration. This was a preparation, not a frozen RC. | Node 24.19.0 / Bun 1.4.2; both locations passed 22 suites / 387 software tests and 46 definition tests per build mode. Public outputs (3,648 files) and licensed outputs (3,660 files) matched between the development and exported validation trees. The licensed result preserved the 3,550 pre-change artifact files and added 110 license/notice files. |
| Stage 04 source check, 2026-11-07 | Clean committed source `616e29a39fcd048b42862512a02cdbb2868c6564`, validated in a separate Windows directory. | Fresh frozen installation, 22 suites / 387 software tests, public production build and 46 production-definition tests passed. No Gotham binaries were present in the public output; the three committed teal favicons matched. Licensed build, cloud CI and physical-device acceptance were not repeated in this check. |

These records do not assert that later exports have passed the same checks. Follow [BUILDING.md](../BUILDING.md) to validate a new release candidate against its exact exported source identity, and record new results with that identity. Keep software and physical-device results separate under [TESTING_RULES.md](TESTING_RULES.md).

Public builds intentionally use installed-system-font fallbacks in place of Gotham; they are not a claim of pixel-identical licensed website appearance. Local Windows results do not establish Linux/cloud CI execution or cross-platform byte equality. Existing device limitations remain documented in [ISSUES.md](ISSUES.md); this source preparation does not resume those investigations.
