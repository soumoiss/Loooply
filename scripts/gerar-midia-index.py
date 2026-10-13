#!/usr/bin/env python3

"""Gera data/midia-index.json a partir da pasta midia/."""

from __future__ import annotations

import json
import re
import subprocess
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
    ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp",
    ".svg", ".heic", ".heif", ".jfif", ".tif", ".tiff",
}

VIDEO = {
    ".mp4", ".webm", ".mov", ".m4v", ".ogv", ".avi", ".mkv",
}

AUDIO = {
    ".mp3", ".m4a", ".wav", ".ogg", ".oga", ".aac", ".flac", ".opus",
}

EXTENSIONS = IMAGE | VIDEO | AUDIO

DATE_YMD = re.compile(r"(?<!\d)(\d{4})[-_](\d{2})[-_](\d{2})(?!\d)")
DATE_DMY = re.compile(r"(?<!\d)(\d{2})[-_](\d{2})[-_](\d{4})(?!\d)")


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
    match = DATE_YMD.search(path.stem)
    if match:
        return "-".join(match.groups())

    match = DATE_DMY.search(path.stem)
    if match:
        day, month, year = match.groups()
        return f"{year}-{month}-{day}"

    return None


def owner_from_path(path: Path) -> str | None:
    relative = path.relative_to(MEDIA_DIR)
    parts = relative.parts

    if len(parts) < 2:
        return None

    return USERS.get(parts[0].strip().lower())


def is_allowed_shared_path(path: Path) -> bool:
    relative = path.relative_to(MEDIA_DIR)
    parts = relative.parts

    # Arquivo diretamente em /midia/ é compartilhado.
    if len(parts) == 1:
        return True

    # Arquivo dentro de uma pasta de usuário reconhecida é exclusivo.
    return parts[0].strip().lower() in USERS


def media_type_for(path: Path) -> str:
    extension = path.suffix.lower()

    if extension in IMAGE:
        return "foto"
    if extension in VIDEO:
        return "video"
    if extension in AUDIO:
        return "audio"

    raise ValueError(f"Extensão não suportada: {extension}")


def git_first_added_at(path: Path) -> str | None:
    """Data do commit que introduziu o arquivo; não usa mtime do checkout."""
    relative = path.relative_to(ROOT).as_posix()
    try:
        result = subprocess.run(
            ["git", "log", "--follow", "--diff-filter=A", "--format=%aI", "--", relative],
            cwd=ROOT, check=False, capture_output=True, text=True, timeout=10,
        )
        values = [line.strip() for line in result.stdout.splitlines() if line.strip()]
        # git log apresenta o commit de adição mais recente primeiro; a primeira adição é a última linha.
        return values[-1] if result.returncode == 0 and values else None
    except (OSError, subprocess.SubprocessError):
        return None


def build_item(path: Path, previous_dates: dict[str, str]) -> dict:
    relative = path.relative_to(ROOT).as_posix()
    stat = path.stat()
    # A data já publicada nunca é substituída por uma nova data de geração.
    uploaded_at = previous_dates.get(relative) or git_first_added_at(path) or date_from_path(path)
    if uploaded_at and re.fullmatch(r"\d{4}-\d{2}-\d{2}", uploaded_at):
        uploaded_at = f"{uploaded_at}T12:00:00+00:00"
    if not uploaded_at:
        uploaded_at = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
    return {
        "path": relative,
        "name": path.name,
        "extension": path.suffix.lower(),
        "type": media_type_for(path),
        "width": 0,
        "height": 0,
        "ratio": 0.0,
        "bytes": stat.st_size,
        "mtime": stat.st_mtime,
        "uploadedAt": uploaded_at,
        "modified": uploaded_at,
    }


def sort_items(items: list[dict]) -> list[dict]:
    return sorted(items, key=lambda item: item["path"].lower())


def main() -> None:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    previous_dates: dict[str, str] = {}
    if OUTPUT.exists():
        try:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            collections = [previous.get("fotos", []), previous.get("audios", []), previous.get("videos", [])]
            collections.extend((previous.get("exclusivo") or {}).values())
            for collection in collections:
                for item in collection if isinstance(collection, list) else []:
                    if isinstance(item, dict) and item.get("path") and item.get("uploadedAt"):
                        previous_dates[str(item["path"])] = str(item["uploadedAt"])
        except (OSError, ValueError, TypeError):
            pass

    files = sorted(
        (path for path in MEDIA_DIR.rglob("*") if path.is_file() and path.suffix.lower() in EXTENSIONS),
        key=lambda path: path.as_posix().lower(),
    )

    fotos: list[dict] = []
    audios: list[dict] = []
    videos: list[dict] = []
    exclusivo = {name: [] for name in USERS.values()}
    ignored: list[str] = []

    for path in files:
        if not is_allowed_shared_path(path):
            ignored.append(path.relative_to(ROOT).as_posix())
            continue

        item = build_item(path, previous_dates)
        owner = owner_from_path(path)

        if owner:
            exclusivo[owner].append(item)
            continue

        if item["type"] == "foto":
            fotos.append(item)
        elif item["type"] == "audio":
            audios.append(item)
        else:
            videos.append(item)

    fotos = sort_items(fotos)
    audios = sort_items(audios)
    videos = sort_items(videos)

    for username in exclusivo:
        exclusivo[username] = sort_items(exclusivo[username])

    document = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
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
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    shared_total = len(fotos) + len(audios) + len(videos)
    exclusive_total = sum(len(items) for items in exclusivo.values())

    print(f"Índice gerado: {OUTPUT.relative_to(ROOT)}")
    print(f"Compartilhadas: {shared_total}")
    print(f"Exclusivas: {exclusive_total}")
    for username, items in exclusivo.items():
        print(f"Exclusivas de {username}: {len(items)}")

    if ignored:
        print("Arquivos em subpastas não reconhecidas foram ignorados:")
        for path in ignored:
            print(f"  - {path}")


if __name__ == "__main__":
    main()
