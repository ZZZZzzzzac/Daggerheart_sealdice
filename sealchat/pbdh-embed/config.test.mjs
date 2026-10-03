import test from 'node:test';
import assert from 'node:assert/strict';
import { createIFormArtifacts } from './config.mjs';

test('single direct iframe with only required capabilities, no nested srcdoc or credentials', () => {
  const result = createIFormArtifacts('https://daggerheart.cn/pbdh/player/daggerheart-core?theme=a&label=%22');
  assert.match(result.iframe, /^<iframe src=/);
  assert.match(result.iframe, /&amp;sealchat=1/);
  assert.match(result.iframe, /width="840" height="760"/);
  assert.match(result.iframe, /position:absolute;inset:0;display:block;width:100%;height:100%/);
  assert.doesNotMatch(result.iframe, /width:1100px|max-width:/);
  assert.deepEqual(result.presentation, { defaultWidth: 840, defaultHeight: 790, defaultFloating: true });
  assert.doesNotMatch(result.iframe, /srcdoc|<script|token|UPDATE_ATTRS/);
  assert.deepEqual(result.bridgePolicy, { enabled: true, allowedOrigins: ['https://daggerheart.cn'], capabilities: ['context.read', 'characterCard.read', 'messages.send'] });
});

test('unsafe locations and preconfigured SDK are rejected', () => {
  for (const url of ['http://example.com/player', 'https://user:secret@example.com/player', 'javascript:alert(1)', 'https://example.com/player?sdkUrl=https://other.example/sdk.js']) {
    assert.throws(() => createIFormArtifacts(url));
  }
  assert.match(createIFormArtifacts('http://127.0.0.1:18752/player').iframe, /sealchat=1/);
});
