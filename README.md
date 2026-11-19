# Deploy to shipsite.sh

A GitHub Action that deploys a folder of static files to [shipsite.sh](https://shipsite.sh) and gives you its URL. It runs the [`shipsite`](https://www.npmjs.com/package/shipsite) CLI, so there is nothing to install.

```yaml
- uses: coolsoftwaretyler/shipsite-deploy-action@v1
  with:
    folder: ./dist
    api-key: ${{ secrets.SHIPSITE_API_KEY }}
```

## Setup

1. **Get an API key.** If you have no account yet, create one. The response contains your key and a link to set up payment:

   ```bash
   curl -X POST https://api.shipsite.sh/v1/accounts -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'
   ```

2. **Make a key for CI.** A deploy-scoped key can create, update and delete sites, but cannot buy domains or manage keys:

   ```bash
   curl -X POST https://api.shipsite.sh/v1/accounts/me/keys -H "Authorization: Bearer $SHIPSITE_API_KEY" -H 'Content-Type: application/json' -d '{"scope":"deploy"}'
   ```

3. **Store it as a secret.** In your repository: Settings → Secrets and variables → Actions → New repository secret, named `SHIPSITE_API_KEY`.

Each active site costs $0.10 per day. A new site expires after 24 hours unless you set `ttl` or `pin`.

## Examples

### Deploy the same site on every push to main

Create the site once (run the action without `site`, or use `npx shipsite ./dist --pin`), then pass its ID so each run updates it:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: coolsoftwaretyler/shipsite-deploy-action@v1
        with:
          folder: ./dist
          site: site_a7x9k2
          api-key: ${{ secrets.SHIPSITE_API_KEY }}
```

Files that are no longer in the folder are removed from the site. Set `keep: true` to leave them.

### A preview for every pull request

Each run creates a new site that expires by itself, and comments its URL on the pull request:

```yaml
name: Preview
on: pull_request

permissions:
  contents: read
  pull-requests: write

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - id: deploy
        uses: coolsoftwaretyler/shipsite-deploy-action@v1
        with:
          folder: ./dist
          ttl: 3d
          api-key: ${{ secrets.SHIPSITE_API_KEY }}
      - env:
          GH_TOKEN: ${{ github.token }}
          URL: ${{ steps.deploy.outputs.url }}
        run: gh pr comment "${{ github.event.pull_request.number }}" --repo "${{ github.repository }}" --body "Preview: $URL"
```

Every push to the pull request makes another site, each billed until it expires, so keep `ttl` short. Secrets are not available to pull requests from forks, so this works for branches in your own repository.

### A named, password-protected site

```yaml
- uses: coolsoftwaretyler/shipsite-deploy-action@v1
  with:
    folder: ./site
    name: team-docs
    pin: true
    password: ${{ secrets.SITE_PASSWORD }}
    api-key: ${{ secrets.SHIPSITE_API_KEY }}
```

## Inputs

| Input | Required | Description |
|---|---|---|
| `folder` | yes | The folder to deploy, for example `./dist`. It should have an `index.html` at its top level. |
| `api-key` | yes | Your shipsite.sh API key, from a secret. |
| `site` | no | The ID of an existing site to update (`site_...`). Without it, every run creates a new site. |
| `name` | no | Serve the site at `https://<name>.shipsite.sh`. |
| `ttl` | no | How long the site lives: seconds, or `30m`, `12h`, `7d`. Default `24h`, minimum `5m`, maximum `365d`. Not allowed with `pin`. |
| `pin` | no | `true` keeps the site until you delete it. |
| `password` | no | Visitors must enter this password to view the site (6 to 128 characters). |
| `keep` | no | With `site`: `true` leaves files on the site that are no longer in the folder. |
| `cli-version` | no | The version of the `shipsite` npm package to run. Default `latest`. |

## Outputs

| Output | Description |
|---|---|
| `url` | The URL of the deployed site. |
| `site-id` | The site's ID. Pass it as `site` to update the same site later. |
| `permanent-url` | The URL by site ID, which keeps working if the site is renamed. |
| `expires-at` | When the site expires (ISO 8601). Empty for a pinned site. |

The URL is also written to the job summary.

## Good to know

- **Redirects, headers and clean URLs:** put a `shipsite.json` in the folder. See the [docs](https://shipsite.sh/llms.txt).
- **Limits:** 1,000 files, 10 MB per file and 100 MB per site.
- **Runners:** the action needs Node.js 18 or later, which GitHub-hosted runners include. On a self-hosted runner, add `actions/setup-node` first.
- **Failures:** if a deploy fails, the step fails and the log says what went wrong and how to fix it.
- **Rolling back:** every update is kept as a version. `npx shipsite rollback <site>` puts the previous one back.

## License

MIT
