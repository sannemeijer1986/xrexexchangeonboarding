(function () {
  const RESEND_SECONDS = 42;
  const timers = new WeakMap();

  const resolveRoot = (target) => {
    if (typeof target === "string") return document.querySelector(target);
    if (target instanceof Element) return target;
    return null;
  };

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const clearTimer = (root) => {
    const timerId = timers.get(root);
    if (timerId) {
      clearInterval(timerId);
      timers.delete(root);
    }
  };

  const showCountdown = (root) => {
    const countdownEl = root.querySelector("[data-signup-resend-countdown]");
    const actionEl = root.querySelector("[data-signup-resend-action]");
    if (countdownEl) countdownEl.hidden = false;
    if (actionEl) actionEl.hidden = true;
  };

  const showAction = (root) => {
    const countdownEl = root.querySelector("[data-signup-resend-countdown]");
    const actionEl = root.querySelector("[data-signup-resend-action]");
    if (countdownEl) countdownEl.hidden = true;
    if (actionEl) actionEl.hidden = false;
  };

  const renderCountdown = (root, remaining) => {
    const countdownEl = root.querySelector("[data-signup-resend-countdown]");
    if (countdownEl) countdownEl.textContent = `Resend in ${formatTime(remaining)}`;
  };

  const start = (target) => {
    const root = resolveRoot(target);
    if (!root) return;

    clearTimer(root);
    showCountdown(root);
    let remaining = RESEND_SECONDS;
    renderCountdown(root, remaining);

    const timerId = window.setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearTimer(root);
        showAction(root);
        return;
      }
      renderCountdown(root, remaining);
    }, 1000);

    timers.set(root, timerId);
  };

  const stop = (target) => {
    const root = resolveRoot(target);
    if (!root) return;
    clearTimer(root);
  };

  document.querySelectorAll("[data-signup-resend]").forEach((root) => {
    root.querySelector("[data-signup-resend-action]")?.addEventListener("click", () => {
      start(root);
    });
  });

  window.__signupResendCountdown = { start, stop };
})();
