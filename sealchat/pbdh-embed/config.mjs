export const capabilities = ['context.read', 'characterCard.read', 'messages.send'];

export function createIFormArtifacts(playerUrl = 'https://daggerheart.cn/pbdh/player/daggerheart-core') {
  const url = new URL(playerUrl);
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((!local && url.protocol !== 'https:') || url.username || url.password || url.hash
      || url.searchParams.has('hostOrigin') || url.searchParams.has('sdkUrl')) {
    throw Error('Use an HTTPS Player URL (loopback HTTP is allowed for local preview), without credentials or host configuration.');
  }
  url.searchParams.set('sealchat', '1');
  const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return {
    // 固定 Chat 的单 iframe 容器为 auto 尺寸，百分比会落回 300×150；声明实际尺寸并限制在视口内。
    iframe: `<iframe src="${escape(url.href)}" title="PbDH 匕首之心人物卡" width="1100" height="760" sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups" referrerpolicy="no-referrer" style="display:block;width:1100px;height:760px;max-width:calc(100vw - 48px);max-height:calc(100vh - 96px);border:0"></iframe>\n`,
    bridgePolicy: { enabled: true, allowedOrigins: [url.origin], capabilities: [...capabilities] },
  };
}
