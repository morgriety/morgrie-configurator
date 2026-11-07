# MORGRIE favicon

## Official source and appearance

The favicon uses the [official MORGRIE simplified logo](https://cdn.shopify.com/s/files/1/0277/2831/4428/files/3.png?v=1613728006). The original PNG is retained locally as `resources/branding/morgrie-favicon-source.png` (4176 × 1990, RGBA). Its SHA-256 is `156364aaf78a044b84fe8423345fed1a1a346fb8340eba4d1058ab78d6e99197`.

The generated icon has a subtle teal gradient: `#16D9C0 → #00C9AE → #00B8A0`, at CSS 135° from upper left to lower right. It preserves the official silhouette, original aspect ratio and transparent background, without cropping, stretching, glow or shadow. The source master is retained unchanged; the gradient is applied only to the generated favicon.

## Files and use

| File | Purpose | SHA-256 |
| --- | --- | --- |
| `public/favicon-16x16.png` | 16 × 16 browser-tab PNG | `0d6f9aec50160925a2b7d82936e80f07588668372a3056095709ff2c2624c884` |
| `public/favicon-32x32.png` | 32 × 32 browser-tab PNG | `740b65b46b49182ae919893d9ad454fe40a584ffb070b5c80001c168adc69065` |
| `public/favicon.ico` | ICO containing 16/32/48px PNG frames | `10f573f20aaf9be61d3863c6d86efbb5d386e6d221786ca99060941adc9f48dc` |

`index.html` references these local assets with cache version `morgrie-740b65b4`. The browser title is **MORGRIE Configurator**. The site does not need Shopify CDN access to load the favicon. Other application logos, Apple/PWA/tile and social-sharing images are separate resources.

## Generation

From the repository root on Windows:

```powershell
.\scripts\generate-favicon.ps1
```

The script uses System.Drawing, verifies the source PNG hash, resamples proportionally and replaces RGB with the specified gradient while preserving transparency. Ordinary production builds use the committed PNG/ICO files and do not run this Windows-only conversion script. They can therefore use the same favicon on other build platforms.

When intentionally changing generated assets, update their hashes and the matching HTML cache version together, then use the shared source-export workflow in [BUILDING.md](../BUILDING.md). Do not independently edit a public copy.

If a browser retains an old tab icon, verify the referenced local PNG URL, reload the page or reopen the tab. Clearing keyboard authorization, settings or backups is unnecessary.
