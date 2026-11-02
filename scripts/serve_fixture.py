#!/usr/bin/env python3
import http.server, socketserver, os, sys
PORT = 8765
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/chapters") or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            with open("fixture_chapters.json", "rb") as f:
                self.wfile.write(f.read())
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, fmt, *args): pass
socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), H) as httpd:
    httpd.serve_forever()
