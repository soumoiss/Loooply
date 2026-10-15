#!/usr/bin/env python3
"""Restaura mídias omitidas do ZIP a partir do repositório GitHub original.

Uso: python scripts/restaurar-midias-github.py [--dry-run] [--workers N]
Baixa apenas caminhos seguros sob midia/ presentes no índice local e não sobrescreve
arquivos existentes, a menos que --overwrite seja informado.
"""
from __future__ import annotations
import argparse
import concurrent.futures
import json
import os
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "https://raw.githubusercontent.com/soumoiss/Loooply/main/"
INDEX_CANDIDATES = (ROOT / "data/midia-index.json", ROOT / "midia-index.json")


def indexed_paths(index_path: Path) -> list[str]:
    data = json.loads(index_path.read_text(encoding="utf-8"))
    result: list[str] = []
    seen: set[str] = set()
    for key in ("fotos", "audios", "videos"):
        for item in data.get(key, []):
            path = str(item.get("path", "")).replace("\\", "/")
            if path.startswith("midia/") and ".." not in Path(path).parts and path not in seen:
                seen.add(path)
                result.append(path)
    for items in (data.get("exclusivo") or {}).values():
        for item in items if isinstance(items, list) else []:
            path = str(item.get("path", "")).replace("\\", "/")
            if path.startswith("midia/") and ".." not in Path(path).parts and path not in seen:
                seen.add(path)
                result.append(path)
    return result


def download(path: str, dry_run: bool, overwrite: bool) -> tuple[str, str]:
    target = ROOT / path
    if target.exists() and not overwrite:
        return path, "já existe"
    if dry_run:
        return path, "seria baixado"
    target.parent.mkdir(parents=True, exist_ok=True)
    url = REPOSITORY + quote(path, safe="/")
    last_error = "erro desconhecido"
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "Loooply-media-restore/1.0"})
            with urlopen(request, timeout=90) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status}")
                payload = response.read()
            if not payload:
                raise RuntimeError("arquivo vazio")
            temporary = target.with_name(target.name + ".download-tmp")
            temporary.write_bytes(payload)
            temporary.replace(target)
            return path, f"restaurado ({len(payload)} bytes)"
        except (HTTPError, URLError, TimeoutError, OSError, RuntimeError) as exc:
            last_error = str(exc)
            time.sleep(1.5 * (attempt + 1))
    return path, f"FALHA: {last_error}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="lista o que seria restaurado sem baixar")
    parser.add_argument("--overwrite", action="store_true", help="substitui arquivos locais existentes")
    parser.add_argument("--workers", type=int, default=4, help="downloads simultâneos (padrão: 4)")
    args = parser.parse_args()
    index_path = next((p for p in INDEX_CANDIDATES if p.exists()), None)
    if index_path is None:
        parser.error("não foi encontrado um índice de mídia")
    paths = indexed_paths(index_path)
    missing = [p for p in paths if args.overwrite or not (ROOT / p).is_file()]
    print(f"Índice: {index_path.relative_to(ROOT)} | {len(paths)} mídias | {len(missing)} para restaurar")
    if not missing:
        return 0
    failures = 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 8))) as pool:
        futures = [pool.submit(download, path, args.dry_run, args.overwrite) for path in missing]
        for future in concurrent.futures.as_completed(futures):
            path, result = future.result()
            print(f"{result}: {path}")
            failures += result.startswith("FALHA:")
    print(f"Concluído: {len(missing) - failures}/{len(missing)} arquivos sem falha reportada.")
    return 1 if failures else 0

if __name__ == "__main__":
    raise SystemExit(main())
