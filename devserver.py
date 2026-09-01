import http.server, socketserver, sys
class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma','no-cache')
        super().end_headers()
    def log_message(self,*a): pass
socketserver.TCPServer.allow_reuse_address=True
with socketserver.TCPServer(("",int(sys.argv[1] if len(sys.argv)>1 else 8123)),H) as s:
    print("dev server on",s.server_address[1]); s.serve_forever()
