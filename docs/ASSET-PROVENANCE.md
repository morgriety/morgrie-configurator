# Asset provenance and current MORGRIE overrides

The historical stage 03 provenance inspection is retained below. The source is now exported from the maintained development tree. Approved binaries are in src/ and public/; evidence is in resources/. Current favicon overrides are separately recorded in resources/morgrie-resource-overrides.json and resources/public-assets.json. Historical upstream equality counts do not describe those newer MORGRIE favicon bytes.

## What was established

- The upstream fixed tree is `the-via/app@935106a990af39bdd1ade881c02366eac486240d`.
- Its package metadata expressly declares `GPL-3.0`. Its root contains the complete GPL version 3 text. The recursive tree has no nested LICENSE, LICENCE, COPYING or NOTICE file granting a different asset license or declaring an asset exception.
- Of 50 local resource files in the preceding asset audit, 48 have exactly the same Git blob as that official fixed tree. The two exceptions are the MORGRIE logo and MORGRIE-modified webmanifest. Per-file hashes are in [resources/upstream-resource-provenance.json](../resources/upstream-resource-provenance.json).
- The three GLB files and Chippy source image were introduced by the VIA Fiber implementation commit `cbb32d7b90e46c42879554e751b88024ea95ba2c`. The `_0.gif` history leads to `e6095f392eee461f21b9507951f60bb913c356ff`, moving static application assets. The saved history records only commit identifiers, titles and URLs, not contributor addresses.
- The GLB generator strings identify the exporter, not the creator or copyright owner. They must not be described as a separate license grant.
- No `.blend`, `.fbx`, `.obj`, `.psd` or `.xcf` authoring source was found in this fixed tree. The GLB files are the exact model resources provided by upstream; this review does not claim to have recovered any private authoring project.

Primary evidence:

- [Fixed upstream tree](https://github.com/the-via/app/tree/935106a990af39bdd1ade881c02366eac486240d)
- [Upstream package license declaration](https://raw.githubusercontent.com/the-via/app/935106a990af39bdd1ade881c02366eac486240d/package.json)
- [Upstream GPL text](https://raw.githubusercontent.com/the-via/app/935106a990af39bdd1ade881c02366eac486240d/LICENSE)
- [Fiber asset introduction](https://github.com/the-via/app/commit/cbb32d7b90e46c42879554e751b88024ea95ba2c)
- [Static asset import](https://github.com/the-via/app/commit/e6095f392eee461f21b9507951f60bb913c356ff)

## Public-copy resource policy

| Resource | Available redistribution evidence | Public-copy treatment |
| --- | --- | --- |
| `src/assets/models/keyboard_components.glb`, `src/assets/models/cubey.glb` | Exact bytes in official GPL-declared VIA project, introduced together with the corresponding 3D application implementation; no contradictory notice found | Retain unchanged with VIA attribution, root GPL and exact provenance. This relies on upstream's project license declaration, not an assertion of independently verified chain of title. |
| `public/fonts/blenderspacecap.glb` | Same official project provenance and no contradictory notice | May retain on the same basis. No current business-code import was found; excluding this unused copied resource is also possible but should be recorded. |
| Chippy, Squarey, retained VIA tile images, public GIF assets and VIA SVG assets | Exact bytes in official GPL-declared VIA tree; no contradictory notice in inspected files/tree | Retain with the same explicit upstream-project attribution. Do not relabel them MORGRIE originals or claim a new proprietary license. |
| `public/fonts/Symbola.ttf` version 7.07 | Embedded George Douros 2013 license expressly permits redistribution and modification | Retain with the complete embedded notice reproduced in third-party notices. Do not call it OFL or public domain. |
| MORGRIE logo and three MORGRIE definitions | User-provided project resources authorized for the public-source work | Retain; preserve existing content and provenance. |
| Modified `public/site.webmanifest` | MORGRIE modification of the VIA file | Retain as project source. |
| 12 `public/fonts/Gotham*` OTF/TTF binaries | Their embedded proprietary notices differ from the project GPL; website authorization is confirmed, public binary redistribution is not | Exclude from the public source and public build. Keep authorized originals in the private development repository; never export them. Licensed build may obtain them from the user's separately controlled location with integrity checks. |

The root GPL declaration is positive license evidence for the upstream application assets; absence of a separate license beside each asset is not by itself a prohibition. Conversely, a root GPL cannot override a known distinct proprietary font notice. The review therefore does not use one blanket license claim for all binaries.

`src/assets/react.svg` and `src/logo.svg` are unused React template marks, not MORGRIE or VIA product branding. Their presence in the upstream tree is established, but a minimal public snapshot can omit these unused template assets and document the omission. Copyright licensing does not grant trademark endorsement rights.

The later MORGRIE favicon replaces the three former VIA favicon files, using the official master and committed generator; it has separate recorded provenance. No external font or model was added by this closeout. If an exact asset is later shown to have a distinct restrictive notice or third-party origin inconsistent with the project declaration, remove it from the public allowlist until that notice is resolved. That potential future evidence is not presented as a presently established infringement.

## Actual 3D dependencies and exclusion impact

| Resource | Actual source references | Impact of simply deleting it |
| --- | --- | --- |
| `keyboard_components.glb` | `src/components/three-fiber/canvas-router.tsx:14`, `key-group.tsx:4`, `update-uv-maps.ts:2`; used by `useGLTF` | Breaks static import resolution/build or the existing 3D keyboard and UV paths. Must not be silently omitted or replaced with a fake model. |
| `cubey.glb` | `canvas-router.tsx:13` and `loader-cubey.tsx:3`; preloaded and rendered by `LoaderCubey` | Breaks import resolution/build or the existing 3D loading scene. |
| `blenderspacecap.glb` | No matching application reference found | Copied from `public` into output, but no confirmed runtime dependency. |
| `chippy_600.png` | `src/components/chippy-loader.tsx:2` | Removing it breaks the static import of that existing component. |

The user requires the existing 3D feature to remain. The minimally disruptive approach is to preserve exact upstream GLB bytes with their GPL-declared provenance. If the project instead demands a separate explicit asset-owner grant beyond that declaration, public 3D preparation becomes a documented pending-evidence item; removing these imports or inventing replacement visuals is not an equivalent completion.

## Scope and limits

This is source/provenance inspection, not a build or device test. The historical inspection changed no original resources. The later closeout integrates build and attribution support without changing model/font bytes, device definitions, UI or settings. No claim is made that the unpublished dirty snapshot is final RC corresponding source. No global legal guarantee of every contributor's original ownership is asserted. The evidence supports a documented upstream-license-based inclusion decision and explicitly separates the known proprietary font exception.
