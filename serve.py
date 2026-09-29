#!/usr/bin/env python3
"""
Vienkāršs HTTP serveris frontend testēšanai.
Palaišana: python3 serve.py
Piekļuve: http://localhost:8080
"""

import http.server
import socketserver
import os

PORT = 8080
DIRECTORY = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Atspējo kešošanu, lai testētu ar jauniem failiem
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        # Formatēti logi
        print(f"[{self.log_date_time_string()}] {args[0]}")


with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"=" * 50)
    print(f"Serveris darbojas: http://localhost:{PORT}")
    print(f"Faili no: {DIRECTORY}")
    print(f"Aizvērt: Ctrl+C")
    print(f"=" * 50)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServeris apstādināts.")
