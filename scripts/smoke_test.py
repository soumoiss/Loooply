#!/usr/bin/env python3
from __future__ import annotations

import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PORT = 0

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

os.chdir(ROOT)
server = socketserver.TCPServer(("localhost", PORT), QuietHandler)
PORT = server.server_address[1]
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, executable_path="/usr/bin/chromium", args=["--no-sandbox"])
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}/index.html", wait_until="domcontentloaded")
        assert page.locator("#splashTitle").inner_text() == "Looply"
        page.goto(f"http://localhost:{PORT}/login.html", wait_until="domcontentloaded")
        page.fill("#username", "Patati")
        page.fill("#password", "patati@123")
        page.click("#loginButton")
        page.wait_for_url("**/home.html")
        assert "Patati" in page.locator("#welcomeMessage").inner_text()
        assert page.locator(".card-row").count() == 50
        page.click('.card-row[data-number="1"]')
        page.wait_for_selector("#modal.is-open")
        assert page.locator("#modalTitulo").inner_text() in {"Carregando título...", "Carta indisponível", "Erro ao carregar carta"}
        page.click("#modalClose")
        page.goto(f"http://localhost:{PORT}/galeria.html", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        assert page.locator("#galleryStatus").count() == 1
        page.goto(f"http://localhost:{PORT}/musicas.html", wait_until="domcontentloaded")
        page.wait_for_load_state("networkidle")
        assert page.locator("#musicStatus").count() == 1
        page.goto(f"http://localhost:{PORT}/perfil.html", wait_until="domcontentloaded")
        assert page.locator("#profileName").inner_text() == "Patati"
        page.click("#profileLogout")
        page.wait_for_url("**/login.html")
        browser.close()
    print("OK: smoke test do fluxo principal concluído.")
finally:
    server.shutdown()
    server.server_close()
