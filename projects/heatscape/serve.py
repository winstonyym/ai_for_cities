#!/usr/bin/env python3
"""Static server for the Heatscape app, with caching turned off.

`python3 -m http.server` sends no Cache-Control header. Browsers are then free
to apply *heuristic freshness* — reusing a response for a fraction of its age
without revalidating — which means an edited app.js, styles.css or
data/diagram.json can keep serving the previous version until a hard reload.
That is a genuinely confusing failure mode: the file on disk is right, the
server is right, and the page is wrong.

This sends `Cache-Control: no-store` on everything, so every reload sees what is
actually on disk. It is slightly wasteful (grid_data.json is ~9 MB and gets
re-sent each time) and is meant for development, not for deployment. Serve the
folder from any ordinary static host in production, ideally with hashed asset
names so caching can be turned back on safely.

Usage:
    python3 serve.py [port]        # default 8000
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Quieter than the default: one line per request, no client address.
        sys.stderr.write("%s\n" % (fmt % args))


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = partial(NoCacheHandler, directory=str(ROOT))
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Heatscape on http://localhost:{port}  (caching disabled)")
        print("Ctrl-C to stop.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
