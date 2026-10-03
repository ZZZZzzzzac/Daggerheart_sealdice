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
    iframe: `<iframe src="${escape(url.href)}" title="PbDH 匕首之心人物卡" sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups" referrerpolicy="no-referrer" style="width:100%;height:100%;border:0"></iframe>\n`,
    bridgePolicy: { enabled: true, allowedOrigins: [url.origin], capabilities: [...capabilities] },
  };
}
