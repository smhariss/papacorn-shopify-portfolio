# Standalone portfolio demo

The `docs/` directory contains a static PapaCorn homepage design demo that can be served from GitHub Pages. Its files were copied byte-for-byte from the current standalone homepage source; no Shopify theme or store data was changed while preparing it.

This demo showcases the logo and packaging, nine flavours, pointer movement, scroll-driven packet transitions, flavour controls, lifestyle carousel, story chapters and responsive presentation. It is the standalone design preview, which has an earlier navigation and FAQ layout than the latest Shopify theme in `theme/`.

The bag is an in-memory JavaScript demo. It can add, remove and change sample bag quantities, but the checkout button only displays a preview message and does not place orders. The full native storefront, products, bundle offer and checkout require Shopify.

## Contents and verification

- 41 files, 4,103,063 bytes (3.91 MiB).
- 57 static relative references resolve inside `docs/`.
- All nine dynamically referenced product-card images and all nine packet cutouts are included.
- Every copied file is byte-identical to its source.
- JavaScript syntax checks passed for all four runtime scripts.
- No external purchase request, local machine path or missing static reference was found in the runtime files.
- The Bounded and Spicy Rice font files retain their SIL Open Font License notices and provenance README.

Historical versions, source/build scripts, dependency folders, validation artifacts, store-state exports, reference website HTML, source reference artwork and absolute-path asset manifests were excluded.

To enable a standalone demo after uploading, use GitHub Pages with the repository branch and `/docs` folder as the source. Shopify Liquid files in `theme/` are not executed by GitHub Pages.
