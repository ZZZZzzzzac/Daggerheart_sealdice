export const capabilities = ['context.read', 'characterCard.read', 'messages.send'];
// 210mm ≈ 794 CSS px，加两侧留白和滚动条；保持在 PbDH 1080px 窄屏断点内。
export const presentation = { defaultWidth: 840, defaultHeight: 790, defaultFloating: true };

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
    // 官方容器 position:relative，内层 HTML 为 auto。绝对定位避开其百分比塌缩，并跟随外层拖动缩放。
    iframe: `<iframe src="${escape(url.href)}" title="PbDH 匕首之心人物卡" width="840" height="760" sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-popups" referrerpolicy="no-referrer" style="position:absolute;inset:0;display:block;width:100%;height:100%;border:0"></iframe>\n`,
    presentation: { ...presentation },
    bridgePolicy: { enabled: true, allowedOrigins: [url.origin], capabilities: [...capabilities] },
  };
}
