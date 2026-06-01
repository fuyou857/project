#!/usr/bin/env python3
import http.server
import ssl

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

server_address = ('0.0.0.0', 8443)
httpd = http.server.HTTPServer(server_address, MyHTTPRequestHandler)

# 使用完整的证书链
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain(
    '/www/server/panel/vhost/cert/www.ciond.com/fullchain.pem',
    '/www/server/panel/vhost/cert/www.ciond.com/privkey.pem'
)
# 确保发送完整的证书链
context.verify_mode = ssl.CERT_NONE
httpd.socket = context.wrap_socket(httpd.socket, server_side=True)

print('HTTPS Server running on https://0.0.0.0:8443')
httpd.serve_forever()