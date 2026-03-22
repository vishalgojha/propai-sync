$ErrorActionPreference = "Stop"

# Deploy the website service from the apps/website folder
npx @railway/cli up -s website "apps\\website" --path-as-root
