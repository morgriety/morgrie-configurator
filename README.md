# MORGRIE Configurator

MORGRIE Configurator is a modified version of VIA with MORGRIE interface work, the shared MORGRIE_LIGHT theme and built-in AIR68, DOS68 and Spacetime65 support. Real layouts remain device-defined.

This tree is exported from the single development source. See [SOURCE_SNAPSHOT.json](SOURCE_SNAPSHOT.json) for exact source identity and dirty/frozen status, [snapshot notes](docs/SNAPSHOT.md), and [validation](docs/VALIDATION.md). A preparation snapshot is not a released V1.0 or approved RC. No original private Git history is included.

## Build

Use Node **24.19.0** and Bun **1.4.2**.

`bun install --frozen-lockfile`

`bun run build:public`

`bun run test`

`bun run preview --host 127.0.0.1 --port 4173 --strictPort`

The default public build uses installed system-font fallbacks for Gotham. No Gotham binary is included or downloaded. [BUILDING.md](BUILDING.md) documents the same-source licensed website build, external resource checks and export procedure. Public fallback appearance is not claimed to be pixel-identical to the licensed website.

WebHID requires a supporting browser, a secure context (HTTPS or localhost) and explicit device permission. Read [testing rules](docs/TESTING_RULES.md) before acceptance; software tests do not establish hardware acceptance. Five Key Tester limitations remain unresolved or deferred in [the issue summary](docs/ISSUES.md).

## License and upstream

Based on [VIA](https://github.com/the-via/app), with upstream GPL-3.0 declaration preserved and complete [LICENSE](LICENSE). MORGRIE modifications remain subject to applicable GPL terms. Existing copyrights and separately licensed resources remain attributed in [UPSTREAM.json](UPSTREAM.json), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [licenses/](licenses/) and [third_party/GPL-SOURCES.json](third_party/GPL-SOURCES.json).

The [public favicon guide](docs/FAVICON.md) documents its source and generation. Use BUILDING.md and the maintained-source exporter for future synchronization. The official MORGRIE teal favicon is retained as a local resource; its source and generator are included. MORGRIE names and logo identify the project, and software licensing does not grant trademark endorsement rights. VIA authors are not represented as endorsing this modification.
