# Handoff (2026-03-17)

## Completed
- Replaced most CLI mentions in docs with Control Console or Gateway API guidance across automation, channels, diagnostics, logging, and install docs.
- Swapped all non-zh-CN docs references from `propai.ai` / `docs.propai.ai` / `trust.propai.ai` / `security@propai.ai` (and `proapi.ai`) to `propai.live` equivalents.
- Set `docs/CNAME` to `docs.propai.live`.
- Updated Railway doc copy to use PropAi Sync product naming.

## Pending
- Create DNS for `docs.propai.live` in GoDaddy and complete domain verification in the docs host (Mintlify).
- Run docs i18n pipeline for `docs/zh-CN/**` once Pi CLI is installed.

## i18n Blocker
- `go run` for `scripts/docs-i18n` failed because `pi` CLI was not installed.
- Install command (if approved): `npm install -g @mariozechner/pi-coding-agent`

## i18n Command (after install)
```powershell
cd scripts\docs-i18n
$docsRoot = (Resolve-Path ..\..\docs).Path
$files = Get-ChildItem -Path $docsRoot -Recurse -File -Include *.md,*.mdx |
  Where-Object { $_.FullName -notmatch "\\docs\\\\zh-CN\\\\" -and $_.FullName -notmatch "\\docs\\\\.i18n\\\\" } |
  ForEach-Object { $_.FullName }

go run . -mode doc -parallel 6 -docs $docsRoot $files
```

## Notes
- Docs-only changes should not affect Tauri build.
- Repo has many unrelated unstaged changes; only the handoff file is intended for commit/push in this step.
