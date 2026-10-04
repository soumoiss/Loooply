#!/usr/bin/env python3
"""Gera data/midia-index.json de forma determinística a partir da pasta midia/."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA_DIR = ROOT / "midia"
OUTPUT = ROOT / "data" / "midia-index.json"

IMAGE = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"}
VIDEO = {".mp4", ".webm", ".mov", ".m4v", ".ogv"}
AUDIO = {".mp3", ".ogg", ".wav", ".m4a", ".flac", ".aac"}
DATE_YMD = re.compile(r"(?<!\d)(\d{4})[-_](\d{2})[-_](\d{2})(?!\d)")
DATE_DMY = re.compile(r"(?<!\d)(\d{2})[-_](\d{2})[-_](\d{4})(?!\d)")


def title_from_stem(stem: str) -> str:
    value = re.sub(r"^\[exclusive\][ _-]*", "", stem, flags=re.I)
    value = re.sub(r"[_-]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value or "Mídia sem título"


def date_from_path(path: Path) -> str | None:
    text = path.stem
    match = DATE_YMD.search(text)
    if match:
        return "-".join(match.groups())
    match = DATE_DMY.search(text)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"
    return None


def item_for(path: Path, index: int) -> dict:
    relative = path.relative_to(ROOT).as_posix()
    ext = path.suffix.lower()
    if ext in IMAGE:
        media_type = "image"
        thumb = relative
    elif ext in VIDEO:
        media_type = "video"
        thumb = ""
    elif ext in AUDIO:
        media_type = "audio"
        thumb = ""
    else:
        raise ValueError(ext)

    parts = [part.lower() for part in path.relative_to(MEDIA_DIR).parts[:-1]]
    exclusive = "exclusive" in parts or path.stem.lower().startswith("[exclusive]")
    tags = [part for part in parts if part and part != "exclusive"]
    date = date_from_path(path)
    return {
        "id": f"media-{index:04d}",
        "title": title_from_stem(path.stem),
        "type": media_type,
        "src": relative,
        "thumb": thumb,
        "date": date,
        "tags": tags,
        "exclusive": exclusive,
        "downloadable": True,
        "description": ""
    }


def main() -> None:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    files = sorted(p for p in MEDIA_DIR.rglob("*") if p.is_file() and p.suffix.lower() in IMAGE | VIDEO | AUDIO)
    items = [item_for(path, index) for index, path in enumerate(files, start=1)]
    document = {"version": 1, "generatedAt": None, "items": items}
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Gerado {OUTPUT.relative_to(ROOT)} com {len(items)} mídias.")


if __name__ == "__main__":
    main()
