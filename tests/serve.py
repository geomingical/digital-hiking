#!/usr/bin/env python3
"""測試用靜態伺服器。內建 http.server 的排隊長度只有 5，連續開頁會偶爾斷線，讓腳本載不到。"""
import http.server
import sys


class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 256


if __name__ == "__main__":
    Server(("127.0.0.1", int(sys.argv[1])), http.server.SimpleHTTPRequestHandler).serve_forever()
