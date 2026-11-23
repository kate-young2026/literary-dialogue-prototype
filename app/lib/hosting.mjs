import { isIP } from 'node:net';

export function hostingSettings(env = process.env) {
  const port = Number(env.PORT || 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT는 1~65535의 정수여야 합니다.');
  const host = env.HOST || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0'].includes(host)) throw Error('HOST는 127.0.0.1 또는 0.0.0.0이어야 합니다.');
  const publicOrigin = (env.ALLOWED_ORIGIN || '').trim();
  if (publicOrigin) {
    let parsed;
    try { parsed = new URL(publicOrigin); } catch { throw Error('ALLOWED_ORIGIN은 https 출처여야 합니다.'); }
    if (parsed.protocol !== 'https:' || parsed.origin !== publicOrigin || parsed.username || parsed.password || !parsed.hostname || isIP(parsed.hostname)) {
      throw Error('ALLOWED_ORIGIN에는 경로와 IP 주소가 없는 정확한 https 출처를 입력하세요.');
    }
  }
  if (host === '0.0.0.0' && !publicOrigin) throw Error('외부 접속을 허용하려면 ALLOWED_ORIGIN을 설정해야 합니다.');
  return { port, host, publicOrigin, allowedOrigins: host === '127.0.0.1' ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`, ...(publicOrigin ? [publicOrigin] : [])] : [publicOrigin] };
}

export function allowsOrigin(origin, settings) {
  return !origin || settings.allowedOrigins.includes(origin);
}

