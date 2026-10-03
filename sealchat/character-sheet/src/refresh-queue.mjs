// Coalesce companion Host events, and keep one follow-up when an event arrives
// during an asynchronous read. A superseded read must not eat its replacement.
export function createRefreshQueue(task) {
  let pending=false, running=null;
  function request() {
    pending=true;
    if(running) return running;
    running=Promise.resolve().then(async()=>{
      try { while(pending) {pending=false;await task();} }
      finally {running=null;}
    });
    return running;
  }
  return {request};
}
