# PapaCorn custom Shopify components

These are the original PapaCorn sections, snippets, templates, translations, styles, scripts and bundled fonts from the storefront project. This folder is not a complete standalone Shopify theme and does not contain Horizon's base source.

## Files

- `assets/`: PapaCorn animation controllers, component CSS/JavaScript, original SVG artwork and fonts with licence notices.
- `sections/`: homepage, product, cart, catalog, About, Contact and bundle sections.
- `snippets/`: left homepage flyout and shared navigation/footer components.
- `templates/`: page, product, cart, collection and homepage configuration for the PapaCorn sections.
- `locales/en.default.json`: PapaCorn's own translation strings only.

## Integrating into a Shopify store

Work in an unpublished copy of a compatible Shopify theme. Add the custom assets, sections and snippets, merge the `papacorn` translation keys into the host theme's existing locale file, and review the templates before replacing any existing page configuration.

The host layout must render its native page content and include PapaCorn's shared navigation/footer where appropriate. Homepage and component assets are loaded by the custom sections. Section settings provide the branding, artwork and product selection; the included homepage settings refer to the original PapaCorn Shopify-hosted imagery and flavour handles. Upload your own artwork and select your own products when using another store.

Product prices, variants and availability come from Shopify Liquid. Product and cart forms use Shopify's native routes. The contact section uses Shopify's native contact form. The bundle JavaScript sends only selected native variant IDs and quantities; final pricing and discounts are confirmed by Shopify. Configure the corresponding automatic discount in Shopify Admin if using the five-bag offer in another store.

Shopify renders these Liquid components. GitHub Pages runs the separate static demo under `docs/`.
