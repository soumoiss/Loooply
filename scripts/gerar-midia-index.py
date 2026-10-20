#!/usr/bin/env python3
"""Gera data/midia-index.json sem apagar referências ausentes do checkout recebido."""

from __future__ import annotations
import json
import re
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MEDIA = ROOT / "midia"
OUTPUT = ROOT / "data" / "midia-index.json"
USERS = {"patati": "Patati", "misol": "Misol", "lilika": "Lilika", "yara": "YARA"}
IMAGES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".bmp", ".svg", ".heic", ".heif", ".jfif", ".tif", ".tiff"}
VIDEOS = {".mp4", ".webm", ".mov", ".m4v", ".ogv", ".avi", ".mkv"}
AUDIOS = {".mp3", ".m4a", ".wav", ".ogg", ".oga", ".aac", ".flac", ".opus"}
SUPPORTED = IMAGES | VIDEOS | AUDIOS
DATE_YMD = re.compile(r"(?<!\d)(\d{4})[-_]?(\d{2})[-_]?(\d{2})(?!\d)")

def get_previous():
    try:
        doc = json.loads(OUTPUT.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}, {}
    previous = {}
    for category in ("fotos", "videos", "audios"):
        for item in doc.get(category, []) if isinstance(doc.get(category), list) else []:
            if isinstance(item, dict) and item.get("path"):
                previous[str(item["path"])] = (category, "", item)
    for owner, items in (doc.get("exclusivo") or {}).items():
        for item in items if isinstance(items, list) else []:
            if isinstance(item, dict) and item.get("path"):
                previous[str(item["path"])] = ("exclusivo", owner, item)
    dates = {p: str(rec[2].get("uploadedAt")) for p, rec in previous.items() if rec[2].get("uploadedAt")}
    return previous, dates

def media_type(path: Path):
    ext = path.suffix.lower()
    if ext in IMAGES: return "foto"
    if ext in VIDEOS: return "video"
    return "audio"

def owner_for(path: Path):
    relative = path.relative_to(MEDIA)
    if len(relative.parts) < 2: return None
    return USERS.get(relative.parts[0].strip().lower())

def dimensions(path: Path):
    """Obtém dimensões reais quando Pillow está disponível; falha sem bloquear o índice."""
    if path.suffix.lower() not in IMAGES:
        if path.suffix.lower() in VIDEOS and shutil.which("ffprobe"):
            try:
                result = subprocess.run(
                    ["ffprobe", "-v", "error", "-select_streams", "v:0",
                     "-show_entries", "stream=width,height", "-of", "csv=s=x:p=0", str(path)],
                    capture_output=True, text=True, timeout=8, check=False,
                )
                match = re.search(r"(\d+)x(\d+)", result.stdout)
                if match: return int(match.group(1)), int(match.group(2))
            except (OSError, subprocess.SubprocessError):
                pass
        return 0, 0
    try:
        from PIL import Image, ImageOps
        with Image.open(path) as image:
            image = ImageOps.exif_transpose(image)
            return int(image.width), int(image.height)
    except Exception:
        return 0, 0

def stable_upload_date(path: Path, previous_dates):
    rel = path.relative_to(ROOT).as_posix()
    if rel in previous_dates:
        return previous_dates[rel]
    match = DATE_YMD.search(path.stem)
    if match:
        y, m, d = match.groups()
        try:
            return datetime(int(y), int(m), int(d), 12, tzinfo=timezone.utc).isoformat()
        except ValueError:
            pass
    return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()

def build_item(path: Path, previous_dates, previous):
    rel = path.relative_to(ROOT).as_posix()
    stat = path.stat()
    width, height = dimensions(path)
    old = previous.get(rel)
    old_item = old[2] if old else {}
    uploaded = stable_upload_date(path, previous_dates)
    if not width or not height:
        width = int(old_item.get("width") or 0)
        height = int(old_item.get("height") or 0)
    ratio = round(width / height, 6) if width and height else float(old_item.get("ratio") or 0)
    item = {
        **old_item,
        "path": rel,
        "name": path.name,
        "extension": path.suffix.lower(),
        "type": media_type(path),
        "width": width,
        "height": height,
        "ratio": ratio,
        "bytes": stat.st_size,
        "mtime": stat.st_mtime,
        "uploadedAt": uploaded,
        "modified": uploaded,
    }
    return item

def main():
    MEDIA.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    previous, previous_dates = get_previous()
    files = sorted((p for p in MEDIA.rglob("*") if p.is_file() and p.suffix.lower() in SUPPORTED), key=lambda p: p.as_posix().casefold())
    fotos, videos, audios = [], [], []
    exclusivo = {name: [] for name in USERS.values()}
    current_paths = set()
    for path in files:
        relative = path.relative_to(MEDIA)
        if len(relative.parts) > 1 and relative.parts[0].casefold() not in USERS:
            continue
        item = build_item(path, previous_dates, previous)
        current_paths.add(item["path"])
        owner = owner_for(path)
        if owner:
            exclusivo[owner].append(item)
        elif item["type"] == "foto":
            fotos.append(item)
        elif item["type"] == "video":
            videos.append(item)
        else:
            audios.append(item)

    missing = []
    # Preserva referências antigas ausentes no checkout, exceto caminhos com mojibake
    # que apontem para um arquivo já existente após reparar a codificação do nome.
    def repaired_existing_path(rel):
        try:
            repaired = rel.encode("cp437").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return False
        return repaired != rel and repaired in current_paths

    for rel, (category, owner, item) in previous.items():
        if rel in current_paths or not rel.startswith("midia/"):
            continue
        if repaired_existing_path(rel):
            print(f"AVISO: referência duplicada com codificação inválida removida: {rel}")
            continue
        missing.append(rel)
        if category == "exclusivo" and owner in exclusivo:
            exclusivo[owner].append(item)
        elif category == "fotos" or str(item.get("type", "")).lower() in {"foto", "image", "imagem"}:
            fotos.append(item)
        elif category == "audios" or str(item.get("type", "")).lower() in {"audio", "áudio"}:
            audios.append(item)
        else:
            videos.append(item)

    sort_items = lambda items: sorted(items, key=lambda item: str(item.get("path", "")).casefold())
    document = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "repository": {"owner": "soumoiss", "repo": "Loooply", "branch": "main"},
        "schemaVersion": 3,
        "fotos": sort_items(fotos),
        "audios": sort_items(audios),
        "videos": sort_items(videos),
        "exclusivo": {name: sort_items(items) for name, items in exclusivo.items()},
    }
    OUTPUT.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Índice gerado: {OUTPUT.relative_to(ROOT)}")
    print(f"Fotos: {len(fotos)} | Vídeos: {len(videos)} | Áudios: {len(audios)}")
    print(f"Referências antigas sem arquivo físico preservadas: {len(missing)}")
    if missing:
        for rel in missing[:12]: print(f"AVISO: arquivo ausente no checkout: {rel}")
        if len(missing) > 12: print(f"... e mais {len(missing)-12} referências.")
if __name__ == "__main__":
    main()
