#!/usr/bin/env python3
"""Gate for the future PUBLIC publishing repository.

Validates the Pages *artifact* directory (site/) only:
  - no forbidden engineering prefixes inside site/
  - no nested .github / controls / proposed inside site/
  - optional SHA-256 lock against controls/site-file-manifest.json
  - optional repo-layout check that workflow uploads path: site

Repo-level controls (.github/, controls/) are allowed beside site/ and must
never be passed to actions/upload-pages-artifact.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

FORBIDDEN_PARTS = {
    ".git",
    ".github",
    "docs",
    "platform",
    "bridge",
    "config",
    "scripts",
    "tests",
    "includes",
    "content",
    "node_modules",
    "__pycache__",
    "tmp",
    "review",
    "source-extract",
    "controls",
    "proposed",
}
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"(?i)(api[_-]?key|client_secret|password)\s*[:=]\s*['\"][^'\"]{8,}"),
    re.compile(r"drive\.google\.com/(?:drive/folders|file/d)/[a-zA-Z0-9_-]{10,}"),
    re.compile(r"docs\.google\.com/document/d/[a-zA-Z0-9_-]{10,}"),
)


def iter_files(root: Path) -> list[Path]:
    return sorted(p for p in root.rglob("*") if p.is_file())


def check_site_tree(site: Path) -> list[str]:
    errors: list[str] = []
    for path in iter_files(site):
        rel = path.relative_to(site)
        parts = set(rel.parts)
        if parts & FORBIDDEN_PARTS and rel.as_posix() != ".nojekyll":
            errors.append(f"forbidden path in site artifact: {rel.as_posix()}")
        if path.suffix.lower() in {".html", ".js", ".css", ".json", ".txt", ".xml", ".md", ".yml", ".yaml"}:
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for pat in SECRET_PATTERNS:
                if pat.search(text):
                    errors.append(f"secret-like pattern in {rel.as_posix()}")
                    break
    return errors


def check_manifest(site: Path, manifest: Path) -> list[str]:
    data = json.loads(manifest.read_text(encoding="utf-8"))
    expected_raw = data.get("files") or {}
    expected = {
        k: (v["sha256"] if isinstance(v, dict) else v) for k, v in expected_raw.items()
    }
    actual = {
        p.relative_to(site).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in iter_files(site)
    }
    errors: list[str] = []
    if set(actual) != set(expected):
        missing = sorted(set(expected) - set(actual))
        extra = sorted(set(actual) - set(expected))
        if missing:
            errors.append("missing files: " + ", ".join(missing[:20]))
        if extra:
            errors.append("unexpected files: " + ", ".join(extra[:20]))
    for rel, want in expected.items():
        if rel in actual and actual[rel] != want:
            errors.append(f"hash mismatch: {rel}")
    return errors


def check_repo_layout(repo: Path, site_rel: str = "site") -> list[str]:
    """Ensure publish-repo controls exist outside the artifact and workflow scopes site/."""
    errors: list[str] = []
    site = repo / site_rel
    if not site.is_dir():
        return [f"missing artifact directory: {site_rel}/"]
    workflow = repo / ".github" / "workflows" / "pages.yml"
    if not workflow.is_file():
        errors.append("missing .github/workflows/pages.yml at repo root (not inside site/)")
    else:
        text = workflow.read_text(encoding="utf-8")
        if "path: site" not in text and "path: ./site" not in text:
            errors.append("pages.yml must upload-pages-artifact path: site (artifact isolation)")
        if re.search(r"path:\s*\.\s*$", text, re.M):
            errors.append("pages.yml must not upload repository root as Pages artifact")
    for name in ("controls", ".github"):
        if (site / name).exists():
            errors.append(f"{name}/ must not exist inside site/ artifact")
    if not (repo / "controls" / "check_publishing_manifest.py").is_file():
        errors.append("missing controls/check_publishing_manifest.py")
    # Simulate artifact file set: only site/
    leaked = []
    for p in iter_files(site):
        rel = p.relative_to(site).as_posix()
        if rel.startswith("controls/") or rel.startswith(".github/") or rel.startswith("proposed/"):
            leaked.append(rel)
    if leaked:
        errors.append("controls leaked into site/: " + ", ".join(leaked[:10]))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-root", type=Path, required=True, help="Pages artifact directory (site/)")
    parser.add_argument("--manifest", type=Path, help="Frozen controls/site-file-manifest.json")
    parser.add_argument(
        "--repo-root",
        type=Path,
        help="Optional publish-repo root containing site/, .github/, controls/",
    )
    args = parser.parse_args()
    site = args.site_root.resolve()
    if not site.is_dir():
        print("site-root missing", file=sys.stderr)
        return 2
    errors = check_site_tree(site)
    if args.manifest:
        errors.extend(check_manifest(site, args.manifest.resolve()))
    if args.repo_root:
        errors.extend(check_repo_layout(args.repo_root.resolve(), site_rel=site.name))
    if errors:
        print("FAIL")
        for err in errors:
            print("-", err)
        return 1
    print("PASS", sum(1 for _ in iter_files(site)), "artifact files")
    if args.repo_root:
        print("PASS repo layout: controls outside artifact; workflow path: site")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
