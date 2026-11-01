import { test } from "node:test";
import assert from "node:assert/strict";
import {
  startLiveRefresh,
  REFRESH_INTERVAL_MS,
} from "../../client/src/live-refresh.js";
const flush = () => new Promise((resolve) => setImmediate(resolve));
function environment() {
  const windowTarget = new EventTarget(),
    documentTarget = new EventTarget(),
    timers = new Map();
  documentTarget.visibilityState = "visible";
  let id = 0;
  const channel = {
    close() {
      this.closed = true;
    },
  };
  return {
    timers,
    channel,
    windowTarget,
    documentTarget,
    options: {
      windowTarget,
      documentTarget,
      schedule: (fn, ms) => {
        assert.equal(ms, REFRESH_INTERVAL_MS);
        timers.set(++id, fn);
        return id;
      },
      cancel: (key) => timers.delete(key),
      createChannel: () => channel,
    },
  };
}
test("consultas: actualiza al entrar, cada 10 s, foco, reconexión y aviso entre pestañas", async () => {
  const env = environment();
  let calls = 0;
  const stop = startLiveRefresh(async () => {
    calls++;
  }, env.options);
  await flush();
  assert.equal(calls, 1);
  await [...env.timers.values()][0]();
  assert.equal(calls, 2);
  env.windowTarget.dispatchEvent(new Event("focus"));
  await flush();
  assert.equal(calls, 3);
  env.windowTarget.dispatchEvent(new Event("online"));
  await flush();
  assert.equal(calls, 4);
  env.channel.onmessage({ data: { type: "changed" } });
  await flush();
  assert.equal(calls, 5);
  env.documentTarget.visibilityState = "hidden";
  env.windowTarget.dispatchEvent(new Event("focus"));
  await flush();
  assert.equal(calls, 5);
  env.documentTarget.visibilityState = "visible";
  env.documentTarget.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(calls, 6);
  stop();
  assert.equal(env.timers.size, 0);
  assert.equal(env.channel.closed, true);
  env.windowTarget.dispatchEvent(new Event("focus"));
  await flush();
  assert.equal(calls, 6);
});
test("no solapa sondeos y descarta la cola al cerrar la sesión", async () => {
  const env = environment();
  let resolve,
    calls = 0;
  const stop = startLiveRefresh(() => {
    calls++;
    return new Promise((r) => {
      resolve = r;
    });
  }, env.options);
  env.windowTarget.dispatchEvent(new Event("focus"));
  env.windowTarget.dispatchEvent(new Event("online"));
  assert.equal(calls, 1);
  resolve();
  await flush();
  assert.equal(calls, 2);
  stop();
  resolve();
  await flush();
  assert.equal(calls, 2);
  assert.equal(env.timers.size, 0);
});
test("un fallo temporal no detiene el sondeo y no depende de BroadcastChannel", async () => {
  const env = environment();
  let calls = 0,
    errors = 0;
  const stop = startLiveRefresh(
    async () => {
      calls++;
      if (calls === 1) throw new Error("offline");
    },
    {
      ...env.options,
      createChannel: () => {
        throw new Error("Navegador bloqueado");
      },
      onError: () => errors++,
    },
  );
  await flush();
  assert.equal(errors, 1);
  assert.equal(env.timers.size, 1);
  await [...env.timers.values()][0]();
  assert.equal(calls, 2);
  stop();
});
