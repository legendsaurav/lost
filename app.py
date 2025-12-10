#!/usr/bin/env python3
"""
Simple Flask endpoint to run `simple_multi_search.py` and return JSON results.

Endpoint: POST /api/alumni_search
Body: { "query": "Google", "max": 10 }

This file expects `simple_multi_search.py` to be present in the project root and
calls it with subprocess (no shell). Basic in-memory rate limiting is applied.
"""
from flask import Flask, request, jsonify, make_response
import subprocess
import sys
import json
import time
import re
from collections import defaultdict, deque
from threading import Lock

app = Flask(__name__)

# Simple in-memory sliding window rate limiter: max requests per window per IP
RATE_LIMIT = 10
RATE_WINDOW = 60.0  # seconds
_rl_store = defaultdict(lambda: deque())
_rl_lock = Lock()


def _get_client_ip():
    # Prefer X-Forwarded-For when behind a proxy; fallback to remote_addr
    forwarded = request.headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.remote_addr or 'unknown'


def _rate_limited(ip: str) -> bool:
    now = time.time()
    with _rl_lock:
        dq = _rl_store[ip]
        # drop old timestamps
        while dq and dq[0] < now - RATE_WINDOW:
            dq.popleft()
        if len(dq) >= RATE_LIMIT:
            return True
        dq.append(now)
        return False


def _sanitize_query(q: str) -> str:
    if not isinstance(q, str):
        return ''
    q = q.strip()
    if len(q) > 200:
        q = q[:200]
    # Allow basic word/space/punctuation characters; remove control and unusual chars
    q = re.sub(r"[^\w\s\-\.,&()@#:+/]", '', q)
    return q


@app.after_request
def _add_cors_headers(response):
    # Simple CORS for development; tighten for production
    response.headers['Access-Control-Allow-Origin'] = request.headers.get('Origin', '*')
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    return response


@app.route('/api/alumni_search', methods=['POST'])
def alumni_search():
    ip = _get_client_ip()
    if _rate_limited(ip):
        return make_response(jsonify({'error': 'Rate limit exceeded'}), 429)

    body = request.get_json(silent=True)
    if not body:
        return make_response(jsonify({'error': 'Invalid JSON body'}), 400)

    query = body.get('query', '')
    max_results = int(body.get('max', 10) or 10)
    max_results = max(1, min(100, max_results))

    query = _sanitize_query(query)
    if not query:
        return make_response(jsonify({'error': 'Empty or invalid query'}), 400)

    # Build subprocess args safely; do not use shell=True or format strings
    script_path = 'simple_multi_search.py'
    try:
        res = subprocess.run([sys.executable, script_path, '--query', query, '--max', str(max_results)], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False, timeout=25)
    except subprocess.TimeoutExpired:
        return make_response(jsonify({'error': 'Search timed out'}), 504)
    except Exception as e:
        return make_response(jsonify({'error': f'Failed to run search: {str(e)}'}), 500)

    if res.returncode != 0:
        # include stderr in logs but return generic message
        err = res.stderr.decode('utf-8', errors='ignore')[:500]
        return make_response(jsonify({'error': 'Search script failed', 'details': err}), 500)

    try:
        text = res.stdout.decode('utf-8', errors='ignore')
        data = json.loads(text)
        # Ensure top-level results key
        results = data if isinstance(data, list) else data.get('results') if isinstance(data, dict) else None
        if results is None:
            # attempt to coerce payload
            if isinstance(data, dict):
                results = data.get('results') or []
            else:
                results = []
        return jsonify({'results': results})
    except json.JSONDecodeError:
        return make_response(jsonify({'error': 'Invalid JSON from search script'}), 500)


if __name__ == '__main__':
    # Run on port 5000 by default. In production, use a WSGI server.
    app.run(host='127.0.0.1', port=5000, debug=True)
