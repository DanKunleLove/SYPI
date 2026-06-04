# spi AI — Documentation

Built with [Mintlify](https://mintlify.com).

## Setup

1. Install the Mintlify CLI: `npm i -g mintlify`
2. `cd docs && mintlify dev`
3. Open `http://localhost:3001`

## Deploy to Mintlify Cloud

1. Go to [dashboard.mintlify.com](https://dashboard.mintlify.com)
2. Connect your GitHub repo, set the **docs root** to `/docs`
3. Set a custom domain (e.g. `docs.spi.ai`) in Settings → Domain

## Structure

```
docs/
  mint.json          ← Mintlify config (navigation, colours, branding)
  guides/            ← User-facing guides (MDX)
    introduction.mdx
    quickstart.mdx
    ...
```

## Adding a page

1. Create a new `.mdx` file in `guides/`
2. Add the path to `mint.json` → `navigation`
3. Mintlify auto-rebuilds on push
