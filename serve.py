#!/usr/bin/env python3
"""Serve the AI for Cities site (and the Heatscape app under projects/).

    python3 serve.py            # http://localhost:8000
    python3 serve.py 8080       # pick a port

Sends `Cache-Control: no-store` so an edited CSS/JS file always shows up on
reload — the same reason projects/heatscape/serve.py exists.
"""
import sys
import http.server
import socketserver
import os

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".webp": "image/webp",
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
        ".geojson": "application/json",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        if "304" not in (args[1] if len(args) > 1 else ""):
            super().log_message(fmt, *args)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("", PORT), Handler) as httpd:
        print(f"AI for Cities → http://localhost:{PORT}")
        print(f"Heatscape     → http://localhost:{PORT}/projects/heatscape/")
        print("Ctrl-C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
