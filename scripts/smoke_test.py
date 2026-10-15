#!/usr/bin/env python3
"""Teste de navegador para comentários da Galeria e do player musical integrado."""

from __future__ import annotations
import json
import re
import threading
import shutil
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial

ROOT = Path(__file__).resolve().parents[1]

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("SKIP: instale playwright e Chromium para executar o teste de navegador.")
    raise SystemExit(2)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

handler = partial(QuietHandler, directory=str(ROOT))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
base_url = f"http://127.0.0.1:{server.server_port}/"

# Um PNG válido mínimo para simular uma mídia da galeria sem depender do ZIP reduzido.
PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
    "0000000b49444154789c636000020000050001a5f645400000000049454e44ae426082"
)
gallery_index = {
    "schemaVersion": 3,
    "fotos": [{
        "path": "midia/foto-teste.jpg", "name": "foto-teste.jpg", "type": "foto",
        "width": 1200, "height": 1800, "ratio": 0.666667, "uploadedAt": "2026-10-14T12:00:00Z"
    }],
    "videos": [], "audios": [],
    "exclusivo": {"Patati": [], "Misol": [], "Lilika": [], "YARA": []}
}
youtube_response = {
    "items": [{
        "snippet": {
            "resourceId": {"videoId": "abc123XYZ"},
            "title": "Música de teste",
            "description": "Descrição de teste",
            "position": 0,
            "thumbnails": {"medium": {"url": "https://img.youtube.com/vi/abc123XYZ/mqdefault.jpg"}}
        },
        "status": {"privacyStatus": "public"}
    }]
}

try:
    with sync_playwright() as playwright:
        try:
            browser = playwright.chromium.launch(headless=True, executable_path=shutil.which('chromium') or None)
        except Exception as error:
            print(f"SKIP: Chromium não está instalado/disponível neste ambiente ({error}).")
            raise SystemExit(2)
        context = browser.new_context(viewport={"width": 1280, "height": 900})
        context.add_init_script("""
          localStorage.setItem('isLoggedIn','true');
          localStorage.setItem('username','Patati');
          localStorage.setItem('profilePic','user1_perf.png');
          localStorage.setItem('looply_session_v2', JSON.stringify({authenticated:true, username:'Patati', profilePic:'user1_perf.png', role:'user', cloudAuthenticated:false, createdAt:new Date().toISOString()}));
          localStorage.setItem('looply_theme','noite');
        """)
        page = context.new_page()
        page.route("**/data/midia-index.json*", lambda route: route.fulfill(
            status=200, content_type="application/json", body=json.dumps(gallery_index)
        ))
        def media_route(route):
            url = route.request.url
            if re.search(r"/MSG_.*\.txt", url):
                route.fulfill(status=200, content_type="text/plain; charset=utf-8",
                              body="Comentário completo da fotografia: primeira linha.\nSegunda linha preservada.")
            elif "/midia/" in url:
                route.fulfill(status=200, content_type="image/png", body=PNG)
            else:
                route.continue_()
        page.route(re.compile(r".*/midia/.*"), media_route)
        page.route(re.compile(r"https://www\.googleapis\.com/youtube/v3/playlistItems.*"),
                   lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(youtube_response)))
        page.route(re.compile(r"https://www\.youtube-nocookie\.com/.*"), lambda route: route.abort())

        # Galeria: comentário integral em janela e controle no visualizador.
        page.goto(base_url + "galeria.html", wait_until="domcontentloaded")
        page.wait_for_selector("#galleryGrid .media-card")
        page.wait_for_selector(".media-comment-toggle")
        page.locator(".media-comment-toggle").first.click()
        page.wait_for_selector(".media-comment-overlay")
        assert "Segunda linha preservada." in page.locator(".media-comment-window-content").inner_text()
        page.locator(".media-comment-window-head button").click()
        page.locator("#galleryGrid .media-visual").first.click()
        page.wait_for_selector('#lightbox[aria-hidden="false"]')
        page.wait_for_selector("#lightboxCommentButton")
        page.locator("#lightboxCommentButton").click()
        page.wait_for_selector(".media-comment-overlay")
        page.locator(".media-comment-window-head button").click()
        assert page.locator('#lightbox[aria-hidden="false"]').count() == 1, "Fechar comentário fechou indevidamente o visualizador."
        page.locator("#lightboxClose").click()

        # Música: player incorporado, comentário com anexo persistido ao reabrir.
        page.goto(base_url + "musicas.html", wait_until="domcontentloaded")
        page.wait_for_selector("#musicList .track-card", timeout=15000)
        page.locator("#musicList .track-card").first.click()
        page.wait_for_selector('#musicPlayerOverlay[aria-hidden="false"]')
        assert "/embed/abc123XYZ" in page.locator("#musicPlayerFrame iframe").get_attribute("src")
        page.locator("#musicCommentText").fill("Comentário persistente de teste")
        page.locator("#musicCommentPhotos").set_input_files(str(ROOT / "icon.png"))
        page.locator("#musicCommentForm button[type='submit']").click()
        page.wait_for_selector(".music-thread-comment-text")
        assert "Comentário persistente de teste" in page.locator(".music-thread-comment-text").inner_text()
        assert page.locator(".music-thread-attachments img").count() == 1
        page.locator("#musicPlayerClose").click()
        page.locator("#musicList .track-card").first.click()
        page.wait_for_selector(".music-thread-comment-text")
        assert "Comentário persistente de teste" in page.locator(".music-thread-comment-text").inner_text()
        assert page.locator(".music-thread-attachments img").count() == 1
        assert page.locator("html").get_attribute("data-theme") == "noite"
        print("OK: comentários da galeria, botão no visualizador, player YouTube, anexos persistentes e tema testados.")
        context.close()
        browser.close()
finally:
    server.shutdown()
    server.server_close()
