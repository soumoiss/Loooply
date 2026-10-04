#!/usr/bin/env python3

"""Gera data/midia-index.json a partir da pasta midia/."""

from __future__ import annotations

import json
import re
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

    value = re.sub(
        r"[_-]+",
        " ",
        value,
    )

    value = re.sub(
        r"\s+",
        " ",
        value,
    ).strip()

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

    parts = path.relative_to(
        MEDIA_DIR
    ).parts[:-1]


    for part in parts:

        owner = USERS.get(
            part.strip().lower()
        )

        if owner:
            return owner


    return None


def item_for(
    path: Path,
    index: int
) -> dict:

    relative =
        path.relative_to(ROOT).as_posix()


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


    relative_parts =
        path.relative_to(
            MEDIA_DIR
        ).parts[:-1]


    lower_parts = {
        part.lower()
        for part in relative_parts
    }


    stem_lower =
        path.stem.lower()


    owner =
        owner_from_path(path)


    generic_exclusive = (
        "exclusive" in lower_parts
        or "exclusivo" in lower_parts
        or stem_lower.startswith(
            "[exclusive]"
        )
        or stem_lower.startswith(
            "[exclusivo]"
        )
    )


    exclusive =
        bool(
            owner
            or generic_exclusive
        )


    tags = [
        part
        for part in relative_parts
        if part.lower()
        not in {
            "exclusive",
            "exclusivo"
        }
        and part.strip().lower()
        not in USERS
    ]


    return {

        "id":
            f"media-{index:04d}",

        "title":
            title_from_stem(
                path.stem
            ),

        "type":
            media_type,

        "src":
            relative,

        "thumb":
            thumb,

        "date":
            date_from_path(path),

        "tags":
            tags,

        "owner":
            owner,

        "exclusive":
            exclusive,

        "downloadable":
            True,

        "description":
            "",
    }


def main() -> None:

    MEDIA_DIR.mkdir(
        parents=True,
        exist_ok=True
    )


    OUTPUT.parent.mkdir(
        parents=True,
        exist_ok=True
    )


    extensions =
        IMAGE | VIDEO | AUDIO


    files = sorted(

        path

        for path
        in MEDIA_DIR.rglob("*")

        if (
            path.is_file()
            and
            path.suffix.lower()
            in extensions
        )
    )


    items = [

        item_for(
            path,
            index
        )

        for index, path
        in enumerate(
            files,
            start=1
        )
    ]


    document = {

        "version": 2,

        "generatedAt": None,

        "items": items,
    }


    OUTPUT.write_text(

        json.dumps(
            document,
            ensure_ascii=False,
            indent=2
        )
        + "\n",

        encoding="utf-8",
    )


    exclusive_count =
        sum(
            1
            for item in items
            if item["exclusive"]
        )


    print(
        f"Gerado {OUTPUT.relative_to(ROOT)} "
        f"com {len(items)} mídias, "
        f"{exclusive_count} exclusivas."
    )


if __name__ == "__main__":
    main()
