export const REFRESH_INTERVAL_MS = 10000;
export const UPDATE_CHANNEL = "legaltriage-workspace";

export function announceWorkspaceChange() {
  try {
    const channel = new BroadcastChannel(UPDATE_CHANNEL);
    channel.postMessage({ type: "changed" });
    channel.close();
  } catch {
    /* El sondeo sigue funcionando si el navegador bloquea el canal. */
  }
}

export function startLiveRefresh(
  refresh,
  {
    windowTarget = window,
    documentTarget = document,
    schedule = setTimeout,
    cancel = clearTimeout,
    createChannel = () => new BroadcastChannel(UPDATE_CHANNEL),
    intervalMs = REFRESH_INTERVAL_MS,
    onError = () => {},
  } = {},
) {
  let stopped = false,
    running = false,
    queued = false,
    timer,
    channel;
  async function run() {
    if (stopped || documentTarget.visibilityState === "hidden") return;
    if (running) {
      queued = true;
      return;
    }
    cancel(timer);
    running = true;
    try {
      await refresh();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (!stopped) {
        if (queued) {
          queued = false;
          void run();
        } else timer = schedule(run, intervalMs);
      }
    }
  }
  windowTarget.addEventListener("focus", run);
  windowTarget.addEventListener("online", run);
  documentTarget.addEventListener("visibilitychange", run);
  try {
    channel = createChannel();
    channel.onmessage = (e) => {
      if (e.data?.type === "changed") void run();
    };
  } catch {
    /* Canal opcional; sin datos personales ni tokens. */
  }
  void run();
  return () => {
    stopped = true;
    cancel(timer);
    windowTarget.removeEventListener("focus", run);
    windowTarget.removeEventListener("online", run);
    documentTarget.removeEventListener("visibilitychange", run);
    channel?.close();
  };
}
