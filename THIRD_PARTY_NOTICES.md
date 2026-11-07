# Third-party notices — MORGRIE Configurator

Maintained with the formal MORGRIE source (license evidence collected 2026-11-07). This notice is not a claim of final-release approval. Full license texts and original copyright attributions are retained in licenses/. The original application GPL is in LICENSE. Component metadata and notice hashes are in licenses/COMPONENTS.json.

## VIA and exact GPL sources

The application is based on the-via/app commit 935106a990af39bdd1ade881c02366eac486240d, with MORGRIE modifications identified by the development Git version; generated public exports additionally record SOURCE_SNAPSHOT.json and docs/SNAPSHOT.md. Original VIA copyright and license headers are preserved. Upstream package metadata declares GPL-3.0; this document does not invent an “or later” grant. Applicable GPL-2.0-or-later notices already embedded in upstream keycode files are also preserved.

Exact corresponding dependency source archives, hashes and download origins are recorded in third_party/GPL-SOURCES.json and included in third_party/source-archives/:

- @the-via/reader 1.14.4: c26009992a7a2e9776720ebf5644a50f8e92c7a5 (browser).
- @the-via/reader 1.14.3: 12d1e5fbbfbb1e68bc154a7109e352a6e23d845e (definition build).
- @the-via/pelpi 0.0.3: 1a239b5c316a33f9f7b95db66b403e471afeb338.
- via-keyboards 0.1.0: 79ae8d2f8799fb526afe38a1400f0ecc0712aed2, with the separately retained local patch in patches/.

The four archives retain upstream files, copyright, build metadata and licenses. They are original public source archives, not original MORGRIE development history.

## Browser and build components

The baseline Rollup analysis found 85 package/version identities with rendered browser code, including transitive dependencies. Another 26 module-graph roots were entirely tree-shaken and are not claimed as shipped code. This table additionally preserves eight directly relevant build-component notices. Full dependency resolution remains in bun.lock; installing a package does not prove its code ships to browsers. Build-tool bundles may contain additional upstream notices within their license files; those files are retained whole.

| Component | Declared license | Scope | Full notice |
| --- | --- | --- | --- |
| @babel/runtime@7.20.1 | MIT | rendered-browser-code | [notice](licenses/packages/babel--runtime-7.20.1/LICENSE) |
| @babel/runtime@7.28.6 | MIT | rendered-browser-code | [notice](licenses/packages/babel--runtime-7.28.6/LICENSE) |
| @emotion/cache@11.10.5 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--cache-11.10.5/LICENSE) |
| @emotion/hash@0.9.0 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--hash-0.9.0/LICENSE) |
| @emotion/memoize@0.8.0 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--memoize-0.8.0/LICENSE) |
| @emotion/react@11.10.5 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--react-11.10.5/LICENSE) |
| @emotion/serialize@1.1.1 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--serialize-1.1.1/LICENSE) |
| @emotion/sheet@1.2.1 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--sheet-1.2.1/LICENSE) |
| @emotion/unitless@0.7.5 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--unitless-0.7.5/LICENSE) |
| @emotion/unitless@0.8.0 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--unitless-0.8.0/LICENSE) |
| @emotion/use-insertion-effect-with-fallbacks@1.0.0 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--use-insertion-effect-with-fallbacks-1.0.0/LICENSE) |
| @emotion/utils@1.2.0 | MIT | rendered-browser-code | [notice](licenses/packages/emotion--utils-1.2.0/LICENSE) |
| @floating-ui/dom@1.0.7 | MIT | rendered-browser-code | [notice](licenses/packages/floating-ui--dom-1.0.7/LICENSE) |
| @fortawesome/fontawesome-svg-core@6.3.0 | MIT | rendered-browser-code | [notice](licenses/packages/fortawesome--fontawesome-svg-core-6.3.0/LICENSE.txt) |
| @fortawesome/free-solid-svg-icons@6.3.0 | (CC-BY-4.0 AND MIT) | rendered-browser-code | [notice](licenses/packages/fortawesome--free-solid-svg-icons-6.3.0/LICENSE.txt) |
| @fortawesome/react-fontawesome@0.2.0 | MIT | rendered-browser-code | [notice](licenses/packages/fortawesome--react-fontawesome-0.2.0/LICENSE.txt) |
| @juggle/resize-observer@3.4.0 | Apache-2.0 | rendered-browser-code | [notice](licenses/packages/juggle--resize-observer-3.4.0/LICENSE) |
| @react-hook/latest@1.0.3 | MIT | rendered-browser-code | [notice](licenses/packages/react-hook--latest-1.0.3/LICENSE) |
| @react-hook/passive-layout-effect@1.2.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-hook--passive-layout-effect-1.2.1/LICENSE) |
| @react-hook/resize-observer@1.2.6 | MIT | rendered-browser-code | [notice](licenses/packages/react-hook--resize-observer-1.2.6/LICENSE) |
| @react-spring/animated@9.6.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--animated-9.6.1/LICENSE) |
| @react-spring/animated@9.7.5 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--animated-9.7.5/LICENSE) |
| @react-spring/core@9.6.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--core-9.6.1/LICENSE) |
| @react-spring/core@9.7.5 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--core-9.7.5/LICENSE) |
| @react-spring/rafz@9.6.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--rafz-9.6.1/LICENSE) |
| @react-spring/rafz@9.7.5 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--rafz-9.7.5/LICENSE) |
| @react-spring/shared@9.6.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--shared-9.6.1/LICENSE) |
| @react-spring/shared@9.7.5 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--shared-9.7.5/LICENSE) |
| @react-spring/three@9.6.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--three-9.6.1/LICENSE) |
| @react-spring/three@9.7.5 | MIT | rendered-browser-code | [notice](licenses/packages/react-spring--three-9.7.5/LICENSE) |
| @react-three/drei@9.114.2 | MIT | rendered-browser-code | [notice](licenses/packages/react-three--drei-9.114.2/LICENSE) |
| @react-three/fiber@8.17.9 | MIT | rendered-browser-code | [notice](licenses/packages/react-three--fiber-8.17.9/LICENSE) |
| @reduxjs/toolkit@2.3.0 | MIT | rendered-browser-code | [notice](licenses/packages/reduxjs--toolkit-2.3.0/LICENSE) |
| @the-via/pelpi@0.0.3 | GPL-3.0 | rendered-browser-code | [notice](licenses/packages/the-via--pelpi-0.0.3/LICENSE) |
| @the-via/reader@1.14.4 | GPL-3.0 | rendered-browser-code | [notice](licenses/packages/the-via--reader-1.14.4/LICENSE) |
| @use-gesture/core@10.2.24 | MIT | rendered-browser-code | [notice](licenses/packages/use-gesture--core-10.2.24/LICENSE) |
| @use-gesture/react@10.2.24 | MIT | rendered-browser-code | [notice](licenses/packages/use-gesture--react-10.2.24/LICENSE) |
| @webscopeio/react-textarea-autocomplete@4.9.2 | MIT | rendered-browser-code | [notice](licenses/packages/webscopeio--react-textarea-autocomplete-4.9.2/LICENSE) |
| ajv@8.20.0 | MIT | rendered-browser-code | [notice](licenses/packages/ajv-8.20.0/LICENSE) |
| ajv-formats@3.0.1 | MIT | rendered-browser-code | [notice](licenses/packages/ajv-formats-3.0.1/LICENSE) |
| compute-scroll-into-view@2.0.4 | MIT | rendered-browser-code | [notice](licenses/packages/compute-scroll-into-view-2.0.4/LICENSE) |
| custom-event@1.0.1 | MIT | rendered-browser-code | [notice](licenses/packages/custom-event-1.0.1/LICENSE) |
| debounce@1.2.1 | MIT | rendered-browser-code | [notice](licenses/packages/debounce-1.2.1/LICENSE) |
| downshift@7.2.1 | MIT | rendered-browser-code | [notice](licenses/packages/downshift-7.2.1/LICENSE) |
| fast-deep-equal@3.1.3 | MIT | rendered-browser-code | [notice](licenses/packages/fast-deep-equal-3.1.3/LICENSE) |
| fast-uri@3.1.3 | BSD-3-Clause | rendered-browser-code | [notice](licenses/packages/fast-uri-3.1.3/LICENSE) |
| hoist-non-react-statics@3.3.2 | BSD-3-Clause | rendered-browser-code | [notice](licenses/packages/hoist-non-react-statics-3.3.2/LICENSE.md) |
| i18next@23.16.8 | MIT | rendered-browser-code | [notice](licenses/packages/i18next-23.16.8/LICENSE) |
| i18next-browser-languagedetector@7.2.2 | MIT | rendered-browser-code | [notice](licenses/packages/i18next-browser-languagedetector-7.2.2/LICENSE) |
| i18next-resources-to-backend@1.2.1 | MIT | rendered-browser-code | [notice](licenses/packages/i18next-resources-to-backend-1.2.1/licence) |
| idb-keyval@6.2.0 | Apache-2.0 | rendered-browser-code | [notice](licenses/packages/idb-keyval-6.2.0/LICENCE) |
| immer@10.1.1 | MIT | rendered-browser-code | [notice](licenses/packages/immer-10.1.1/LICENSE) |
| invariant@2.2.4 | MIT | rendered-browser-code | [notice](licenses/packages/invariant-2.2.4/LICENSE) |
| its-fine@1.0.8 | MIT | rendered-browser-code | [notice](licenses/packages/its-fine-1.0.8/LICENSE) |
| json-schema-traverse@1.0.0 | MIT | rendered-browser-code | [notice](licenses/packages/json-schema-traverse-1.0.0/LICENSE) |
| json-stringify-pretty-compact@4.0.0 | MIT | rendered-browser-code | [notice](licenses/packages/json-stringify-pretty-compact-4.0.0/LICENSE) |
| lodash.defaultsdeep@4.6.1 | MIT | rendered-browser-code | [notice](licenses/packages/lodash.defaultsdeep-4.6.1/LICENSE) |
| lodash.partition@4.6.0 | MIT | rendered-browser-code | [notice](licenses/packages/lodash.partition-4.6.0/LICENSE) |
| memoize-one@6.0.0 | MIT | rendered-browser-code | [notice](licenses/packages/memoize-one-6.0.0/LICENSE) |
| prop-types@15.8.1 | MIT | rendered-browser-code | [notice](licenses/packages/prop-types-15.8.1/LICENSE) |
| react@18.3.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-18.3.1/LICENSE) |
| react-dom@18.3.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-dom-18.3.1/LICENSE) |
| react-i18next@14.1.3 | MIT | rendered-browser-code | [notice](licenses/packages/react-i18next-14.1.3/LICENSE) |
| react-is@16.13.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-is-16.13.1/LICENSE) |
| react-is@17.0.2 | MIT | rendered-browser-code | [notice](licenses/packages/react-is-17.0.2/LICENSE) |
| react-reconciler@0.27.0 | MIT | rendered-browser-code | [notice](licenses/packages/react-reconciler-0.27.0/LICENSE) |
| react-redux@9.1.2 | MIT | rendered-browser-code | [notice](licenses/packages/react-redux-9.1.2/LICENSE.md) |
| react-select@5.8.1 | MIT | rendered-browser-code | [notice](licenses/packages/react-select-5.8.1/LICENSE) |
| redux@5.0.1 | MIT | rendered-browser-code | [notice](licenses/packages/redux-5.0.1/LICENSE.md) |
| redux-thunk@3.1.0 | MIT | rendered-browser-code | [notice](licenses/packages/redux-thunk-3.1.0/LICENSE.md) |
| reselect@5.1.1 | MIT | rendered-browser-code | [notice](licenses/packages/reselect-5.1.1/LICENSE) |
| scheduler@0.21.0 | MIT | rendered-browser-code | [notice](licenses/packages/scheduler-0.21.0/LICENSE) |
| scheduler@0.23.2 | MIT | rendered-browser-code | [notice](licenses/packages/scheduler-0.23.2/LICENSE) |
| styled-components@6.0.0-beta.6 | MIT | rendered-browser-code | [notice](licenses/packages/styled-components-6.0.0-beta.6/LICENSE) |
| stylis@4.1.3 | MIT | rendered-browser-code | [notice](licenses/packages/stylis-4.1.3/LICENSE) |
| suspend-react@0.1.3 | MIT | rendered-browser-code | [notice](licenses/packages/suspend-react-0.1.3/LICENSE) |
| textarea-caret@3.0.2 | MIT | rendered-browser-code | [notice](licenses/packages/textarea-caret-3.0.2/LICENSE) |
| three@0.169.0 | MIT | rendered-browser-code | [notice](licenses/packages/three-0.169.0/LICENSE) |
| three-stdlib@2.33.0 | MIT | rendered-browser-code | [notice](licenses/packages/three-stdlib-2.33.0/LICENSE) |
| tslib@2.4.1 | 0BSD | rendered-browser-code | [notice](licenses/packages/tslib-2.4.1/LICENSE.txt) |
| use-isomorphic-layout-effect@1.1.2 | MIT | rendered-browser-code | [notice](licenses/packages/use-isomorphic-layout-effect-1.1.2/LICENSE) |
| use-sync-external-store@1.2.0 | MIT | rendered-browser-code | [notice](licenses/packages/use-sync-external-store-1.2.0/LICENSE) |
| use-sync-external-store@1.2.2 | MIT | rendered-browser-code | [notice](licenses/packages/use-sync-external-store-1.2.2/LICENSE) |
| wouter@2.10.0 | ISC | rendered-browser-code | [notice](licenses/packages/wouter-2.10.0/LICENSE-NOTICE.txt) |
| zustand@3.7.2 | MIT | rendered-browser-code | [notice](licenses/packages/zustand-3.7.2/LICENSE) |
| vite@4.1.4 | MIT | BUILD_TOOL | [notice](licenses/packages/vite-4.1.4/LICENSE.md) |
| rollup@3.17.3 | MIT | BUILD_TOOL | [notice](licenses/packages/rollup-3.17.3/LICENSE.md) |
| typescript@5.6.2 | Apache-2.0 | BUILD_TOOL | [notice](licenses/packages/typescript-5.6.2/LICENSE.txt), [notice](licenses/packages/typescript-5.6.2/ThirdPartyNoticeText.txt) |
| tsx@4.23.1 | MIT | BUILD_TOOL | [notice](licenses/packages/tsx-4.23.1/LICENSE) |
| via-keyboards@0.1.0 | GPL-3.0 | DEFINITION_SOURCE_AND_BUILD | [notice](licenses/packages/via-keyboards-0.1.0/LICENSE) |
| esbuild@0.16.17 | MIT | USED_BY_vite | [notice](licenses/packages/esbuild-0.16.17/LICENSE.md) |
| esbuild@0.28.1 | MIT | USED_BY_tsx | [notice](licenses/packages/esbuild-0.28.1/LICENSE.md) |
| @the-via/reader@1.14.3 | GPL-3.0 | USED_BY_via-keyboards | [notice](licenses/packages/the-via--reader-1.14.3/LICENSE) |

## Special attribution and resource notices

- **wouter 2.10.0:** ISC, author Alexey Taktarov. The original author expressly explained that the release carries its license declaration in package.json rather than a separate LICENSE file. The packaged JavaScript matches the official v2.10.0 tag. The ISC text, author statement and version evidence are in licenses/packages/wouter-2.10.0/. No copyright year is invented and later wouter Unlicense releases are not substituted.
- **MeshoptDecoder:** three-stdlib embeds MeshoptDecoder with Copyright (C) 2016–2020 Arseny Kapoulkine, MIT. Its original notice and a complete official matching-year MIT license are in licenses/embedded/meshopt-decoder/. This is additional to three-stdlib's Poimandres MIT notice. The matching-year license source does not establish an exact embedded decoder release version.
- **Font Awesome:** JavaScript and SVG material retain their actual package licenses (MIT code and CC BY 4.0 icons where declared). No OFL font binary is claimed as shipped merely because a broader dependency is installed. Font Awesome icons originate from https://fontawesome.com/; source license files retain the author attribution and terms.
- **Symbola 7.07:** Unicode Fonts for Ancient Scripts; George Douros; 2013. Its embedded redistribution grant is reproduced verbatim in licenses/fonts/Symbola-NOTICE.txt. It is not labeled OFL or public domain.
- **Inter, Fira Sans and Fira Sans Condensed:** existing Google Fonts stylesheet references remain. No binary copy was added by this preparation. Family license references/texts are in licenses/fonts/; the live CDN delivery version is not pinned by bun.lock.
- **Gotham Rounded:** twelve website-authorized files are excluded from public source/public output. They are not covered by a new redistribution grant here. Website-authorized builds assemble a separately controlled, integrity-checked resource pack. See BUILDING.md and resources/restricted-fonts.json.
- **VIA models, GIFs and icons:** exact upstream GPL-declared resources are retained under the upstream project declaration, with per-file provenance in resources/ and docs/ASSET-PROVENANCE.md. No independent all-contributor chain-of-title guarantee is asserted. No restricted asset with a known contrary notice is included.
- **MORGRIE favicon:** the reviewed teal PNG/ICO derives from the official simplified logo without changing its silhouette. See resources/morgrie-resource-overrides.json; historical VIA favicon provenance does not describe these replacement bytes.
- **MORGRIE logo and definitions:** user-provided project resources retained for this authorized source preparation. Trademark identification does not imply VIA endorsement or grant third-party trademark rights.

No private source location, deployment token or licensed font binary is required to use the public fallback build. Before a final deployment, publish a source location matching the frozen build, retain the resource mode and hashes, and make these notices available with the application.
