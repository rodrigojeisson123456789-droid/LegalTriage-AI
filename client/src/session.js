// Cada transición de cuenta invalida sus peticiones, incluso si una respuesta ya venía en camino.
export class SessionRequests {
  version = 0;
  controllers = new Set();
  start() {
    const version = this.version;
    const controller = new AbortController();
    this.controllers.add(controller);
    return {
      signal: controller.signal,
      isCurrent: () => version === this.version && !controller.signal.aborted,
      finish: () => this.controllers.delete(controller),
      cancel: () => {
        controller.abort();
        this.controllers.delete(controller);
      },
    };
  }
  invalidate() {
    this.version += 1;
    for (const controller of this.controllers) controller.abort();
    this.controllers.clear();
  }
}
