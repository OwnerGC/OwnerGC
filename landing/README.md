# ownergc.app landing page

The one-page site at https://ownergc.app. Edit `public/index.html` and push to `main`:
Cloudflare picks up the change and publishes it within a minute or two.

Cloudflare settings (Workers & Pages > shrill-brook-71bf > Settings > Build):
- Git repository: OwnerGC/ownergc, branch `main`
- Root directory: `landing`
- Deploy command: `npx wrangler deploy`
- Build watch paths: include `landing/*` only, so changes to the app don't redeploy this page.
