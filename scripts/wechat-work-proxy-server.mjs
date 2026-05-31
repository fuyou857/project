#!/usr/bin/env node
/**
 * 企业微信 API 固定出口代理（本机 127.0.0.1 → qyapi.weixin.qq.com）
 * 供 Supabase Edge 经 https://www.ciond.com/api/wechat-work-proxy/ 调用，企微白名单只需加本站公网 IP。
 *
 * 环境变量：
 *   WECHAT_WORK_PROXY_SECRET  必填，与 Edge Secrets / 密钥中心 proxy_secret 一致
 *   WECHAT_WORK_PROXY_PORT    默认 8790
 */
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';

const PORT = Number(process.env.WECHAT_WORK_PROXY_PORT || 8790);
const SECRET = (process.env.WECHAT_WORK_PROXY_SECRET || '').trim();
const QYAPI_HOST = 'qyapi.weixin.qq.com';

const ALLOWED_PATHS = new Set([
  '/cgi-bin/gettoken',
  '/cgi-bin/auth/getuserinfo',
  '/cgi-bin/user/get',
  '/cgi-bin/message/send',
]);

function send(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

function isAllowedPath(pathname) {
  return ALLOWED_PATHS.has(pathname);
}

function forwardToQyapi(req, res, bodyBuf) {
  const incoming = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (!isAllowedPath(incoming.pathname)) {
    send(res, 404, JSON.stringify({ error: 'path not allowed' }));
    return;
  }

  const opts = {
    hostname: QYAPI_HOST,
    port: 443,
    path: `${incoming.pathname}${incoming.search}`,
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'Content-Length': bodyBuf?.length || 0,
    },
  };

  const upstream = https.request(opts, (up) => {
    const chunks = [];
    up.on('data', (c) => chunks.push(c));
    up.on('end', () => {
      const raw = Buffer.concat(chunks);
      res.writeHead(up.statusCode || 502, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(raw);
    });
  });
  upstream.on('error', (e) => {
    send(res, 502, JSON.stringify({ error: e.message || 'upstream error' }));
  });
  if (bodyBuf?.length) upstream.write(bodyBuf);
  upstream.end();
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, x-wechat-proxy-secret',
    });
    res.end();
    return;
  }

  const hdr = req.headers['x-wechat-proxy-secret'];
  const provided = Array.isArray(hdr) ? hdr[0] : hdr;
  if (!SECRET || provided !== SECRET) {
    send(res, 403, JSON.stringify({ error: 'forbidden' }));
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    send(res, 405, JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const bodyBuf = Buffer.concat(chunks);
    forwardToQyapi(req, res, bodyBuf);
  });
});

if (!SECRET) {
  console.error('[wechat-proxy] 请设置 WECHAT_WORK_PROXY_SECRET');
  process.exit(1);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[wechat-proxy] listening 127.0.0.1:${PORT} → https://${QYAPI_HOST}`);
});
