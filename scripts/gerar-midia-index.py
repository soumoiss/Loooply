#!/usr/bin/env python3

"""Gera data/midia-index.json a partir da pasta midia/."""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MEDIA_DIR = ROOT / "midia"
OUTPUT = ROOT / "data" / "midia-index.json"


USERS = {
    "patati": "Patati",
    "misol": "Misol",
    "lilika": "Lilika",
    "yara": "YARA",
}


IMAGE = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".avif",
    ".bmp",
    ".svg",
    ".heic",
    ".heif",
    ".jfif",
    ".tif",
    ".tiff",
}


VIDEO = {
    ".mp4",
    ".webm",
    ".mov",
    ".m4v",
    ".ogv",
    ".avi",
    ".mkv",
}


AUDIO = {
    ".mp3",
    ".m4a",
    ".wav",
    ".ogg",
    ".oga",
    ".aac",
    ".flac",
    ".opus",
}


EXTENSIONS = IMAGE | VIDEO | AUDIO


DATE_YMD = re.compile(
    r"(?<!\d)(\d{4})[-_](\d{2})[-_](\d{2})(?!\d)"
)

DATE_DMY = re.compile(
    r"(?<!\d)(\d{2})[-_](\d{2})[-_](\d{4})(?!\d)"
)


def title_from_stem(stem: str) -> str:
    value = re.sub(
        r"^\[(?:exclusive|exclusivo)\][ _-]*",
        "",
        stem,
        flags=re.I,
    )

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


def owner_from_path(path: Path) -> str | None:
    relative_parts = path.relative_to(MEDIA_DIR).parts[:-1]

    for part in relative_parts:
        owner = USERS.get(part.strip().lower())

        if owner:
            return owner

    return None


def media_type_for(path: Path) -> str:
    extension = path.suffix.lower()

    if extension in IMAGE:
        return "foto"

    if extension in VIDEO:
        return "video"

    if extension in AUDIO:
        return "audio"

    raise ValueError(f"Extensão não suportada: {extension}")


def image_dimensions(path: Path) -> tuple[int, int]:
    try:
        from PIL import Image

        with Image.open(path) as image:
            width, height = image.size

        return int(width), int(height)

    except Exception:
        return 0, 0


def build_item(path: Path) -> dict:
    relative = path.relative_to(ROOT).as_posix()

    media_type = media_type_for(path)

    owner = owner_from_path(path)

    relative_parts = path.relative_to(MEDIA_DIR).parts[:-1]

    lower_parts = {
        part.strip().lower()
        for part in relative_parts
    }

    stem_lower = path.stem.lower()

    generic_exclusive = (
        "exclusive" in lower_parts
        or "exclusivo" in lower_parts
        or stem_lower.startswith("[exclusive]")
        or stem_lower.startswith("[exclusivo]")
    )

    exclusive = bool(owner or generic_exclusive)

    width = 0
    height = 0

    if media_type == "foto":
        width, height = image_dimensions(path)

    ratio = 0.0

    if width > 0 and height > 0:
        ratio = round(width / height, 6)

    stat = path.stat()

    modified = datetime.fromtimestamp(
        stat.st_mtime,
        tz=timezone.utc,
    ).isoformat()

    item = {
        "path": relative,
        "name": path.name,
        "extension": path.suffix.lower(),
        "type": media_type,
        "width": width,
        "height": height,
        "ratio": ratio,
        "bytes": stat.st_size,
        "mtime": stat.st_mtime,
        "modified": modified,
    }

    return item


def sort_items(items: list[dict]) -> list[dict]:
    return sorted(
        items,
        key=lambda item: (
            item["path"].lower(),
            item["name"].lower(),
        ),
    )


def main() -> None:
    MEDIA_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    files = sorted(
        (
            path
            for path in MEDIA_DIR.rglob("*")
            if (
                path.is_file()
                and path.suffix.lower() in EXTENSIONS
            )
        ),
        key=lambda path: path.as_posix().lower(),
    )

    fotos = []
    audios = []
    videos = []

    exclusivo = {
        "Patati": [],
        "Misol": [],
        "Lilika": [],
        "YARA": [],
    }

    for path in files:
        item = build_item(path)

        owner = owner_from_path(path)

        if owner:
            exclusivo[owner].append(item)
            continue

        media_type = item["type"]

        if media_type == "foto":
            fotos.append(item)

        elif media_type == "audio":
            audios.append(item)

        elif media_type == "video":
            videos.append(item)

    fotos = sort_items(fotos)
    audios = sort_items(audios)
    videos = sort_items(videos)

    for user in exclusivo:
        exclusivo[user] = sort_items(exclusivo[user])

    document = {
        "generatedAt": datetime.now(
            timezone.utc
        ).isoformat(),

        "repository": {
            "owner": "soumoiss",
            "repo": "Loooply",
            "branch": "main",
        },

        "schemaVersion": 3,

        "fotos": fotos,
        "audios": audios,
        "videos": videos,

        "exclusivo": exclusivo,
    }

    OUTPUT.write_text(
        json.dumps(
            document,
            ensure_ascii=False,
            indent=2,
        ) + "\n",
        encoding="utf-8",
    )

    total = (
        len(fotos)
        + len(audios)
        + len(videos)
        + sum(
            len(items)
            for items in exclusivo.values()
        )
    )

    exclusive_total = sum(
        len(items)
        for items in exclusivo.values()
    )

    print(
        f"Índice gerado: {OUTPUT.relative_to(ROOT)}"
    )

    print(
        f"Mídias compartilhadas: "
        f"{len(fotos) + len(audios) + len(videos)}"
    )

    print(
        f"Mídias exclusivas: "
        f"{exclusive_total}"
    )

    print(
        f"Total: {total}"
    )

    for username, items in exclusivo.items():
        print(
            f"Exclusivas de {username}: "
            f"{len(items)}"
        )


if __name__ == "__main__":
    main()
