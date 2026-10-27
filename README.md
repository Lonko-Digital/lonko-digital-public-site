# Lonko Digital — public marketing site (publish repo)

Public, allowlisted static website for Lonko Digital.

## Layout

```text
.
├── site/                         # ONLY directory uploaded to GitHub Pages
├── controls/                     # validation + frozen hashes (not published)
├── .github/workflows/pages.yml   # validate + deploy (path: site)
└── README.md
```

## Local gate

```bash
python -B controls/check_publishing_manifest.py \
  --site-root site \
  --manifest controls/site-file-manifest.json \
  --repo-root .
```

## A1 scope

- Preview on `*.github.io` only.
- `CNAME` / custom domain intentionally omitted until a separate A2 authorization.
- Do not place engineering docs, credentials, or private product code in this repository.
