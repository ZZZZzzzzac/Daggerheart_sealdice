import test from 'node:test';
import assert from 'node:assert/strict';
import {createRefreshQueue} from '../src/refresh-queue.mjs';

test('the Host context/connection event pair coalesces into one fresh read',async()=>{
  let count=0;const q=createRefreshQueue(async()=>count++);
  await Promise.all([q.request(),q.request()]);assert.equal(count,1);
});

test('a context change during a read keeps its follow-up rather than staying loading',async()=>{
  let count=0, release, state='loading';
  const q=createRefreshQueue(async()=>{if(++count===1){await new Promise(resolve=>release=resolve);return;}state='ready';});
  const first=q.request();await Promise.resolve();
  const next=q.request();release();await Promise.all([first,next]);
  assert.equal(count,2);assert.equal(state,'ready');
});

test('failed reads release the queue so explicit retry can succeed',async()=>{
  let count=0;const q=createRefreshQueue(async()=>{if(++count===1)throw Error('read failed');});
  await assert.rejects(q.request());await q.request();assert.equal(count,2);
});
