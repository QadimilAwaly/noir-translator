#!/usr/bin/env python3
import http.server, socketserver
PORT = 8765
socketserver.TCPServer.allow_reuse_address = True
class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/chapters/") and len(self.path.split('/')) >= 3:
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            with open("fixture_chapter_content.json", "rb") as f:
                self.wfile.write(f.read())
        elif self.path.startswith("/chapters") or self.path == "/":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            if "gzip" in self.headers.get("Accept-Encoding",""):
                self.send_header("Content-Encoding","gzip")
                self.end_headers()
                with open("fixture_trimmed.json.gz","rb") as f:
                    self.wfile.write(f.read())
            else:
                with open("fixture_chapters.json","rb") as f:
                    self.wfile.write(f.read())
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, fmt, *args): pass
with socketserver.TCPServer(("", PORT), H) as httpd:
    httpd.serve_forever()
