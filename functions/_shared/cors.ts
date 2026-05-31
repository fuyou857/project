const ALLOWED_ORIGINS = [
  'https://www.ciond.com',
  'https://ciond.com',
  'http://localhost:3000',
  'http://localhost:8080',
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

export const defaultCorsHeaders = getCorsHeaders(ALLOWED_ORIGINS[0]);

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}

export function addCorsHeaders(response: Response, origin: string | null = null): Response {
  const headers = new Headers(response.headers);
  Object.entries(getCorsHeaders(origin)).forEach(([key, value]) => {
    headers.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}