/**
 * Sign-up email "code sent" display — middle truncation after @ + prototype demo email.
 */
(function () {
  const TRUNCATED_DEMO_EMAIL = "chia.hui.wu@bigexampleco.com.tw";
  const ELLIPSIS = "...";
  const MIN_DOMAIN_SUFFIX = 4;
  const FALLBACK_TEXT_WIDTH = 270;

  let measureCanvas;

  const getShowTruncatedEmailPrototype = () =>
    Boolean(document.querySelector("[data-prototype-show-truncated-email]")?.checked);

  const resolveSentEmailValue = (rawEmail) => {
    const value = String(rawEmail || "").trim();
    if (getShowTruncatedEmailPrototype()) return TRUNCATED_DEMO_EMAIL;
    return value || "mail@sanne.com";
  };

  const measureTextWidth = (text, font) => {
    measureCanvas = measureCanvas || document.createElement("canvas");
    const ctx = measureCanvas.getContext("2d");
    if (!ctx) return text.length * 8;
    ctx.font = font;
    return ctx.measureText(text).width;
  };

  const formatMiddleTruncateAfterAt = (email) => {
    const at = email.indexOf("@");
    if (at === -1) return email;
    return email.slice(0, at + 1) + ELLIPSIS + email.slice(at + 1);
  };

  const truncateEmailAfterAt = (email, maxWidth, font) => {
    if (!email || maxWidth <= 0) return email;
    if (measureTextWidth(email, font) <= maxWidth) return email;

    const at = email.indexOf("@");
    if (at === -1) return email;

    const prefix = email.slice(0, at + 1);
    const domain = email.slice(at + 1);
    if (!domain) return email;

    for (let suffixLen = domain.length; suffixLen >= MIN_DOMAIN_SUFFIX; suffixLen -= 1) {
      const candidate = prefix + ELLIPSIS + domain.slice(domain.length - suffixLen);
      if (measureTextWidth(candidate, font) <= maxWidth) return candidate;
    }

    return prefix + ELLIPSIS;
  };

  const getMaxTextWidth = (displayEl) => {
    const row =
      displayEl.closest("[data-auth-signup-email-edit]") ||
      displayEl.closest("[data-auth-signup-hybrid-email-submitted]");
    const copy = displayEl.closest(".auth-signup-email-page__copy");
    const containerWidth = copy?.clientWidth || row?.clientWidth || 0;

    if (!row) return containerWidth || FALLBACK_TEXT_WIDTH;

    const style = window.getComputedStyle(row);
    const gap = parseFloat(style.columnGap || style.gap || "3") || 3;
    let reserved = 0;

    row.querySelectorAll("img").forEach((icon) => {
      reserved += icon.getBoundingClientRect().width + gap;
    });

    const measured = Math.max(0, containerWidth - reserved);
    return measured > 0 ? measured : FALLBACK_TEXT_WIDTH;
  };

  const syncSentEmailDisplay = (displayEl, rawEmail) => {
    if (!displayEl) return;

    const fullEmail = resolveSentEmailValue(rawEmail);
    displayEl.dataset.authSignupEmailFull = fullEmail;

    let display;
    if (getShowTruncatedEmailPrototype()) {
      display = formatMiddleTruncateAfterAt(fullEmail);
    } else {
      const font = window.getComputedStyle(displayEl).font;
      const maxWidth = getMaxTextWidth(displayEl);
      display = truncateEmailAfterAt(fullEmail, maxWidth, font);
    }

    displayEl.textContent = display;
    displayEl.title = fullEmail;
  };

  const syncAllSentEmailDisplays = (rawEmail) => {
    document
      .querySelectorAll("[data-auth-signup-email-display], [data-auth-signup-hybrid-email-display]")
      .forEach((el) => syncSentEmailDisplay(el, rawEmail));
  };

  const refreshAllSentEmailDisplays = () => {
    const emailInput = document.querySelector("[data-auth-signup-email-input]");
    const hybridInput = document.querySelector("[data-auth-signup-hybrid-email-input]");
    const stored =
      document.querySelector("[data-auth-signup-email-display]")?.dataset.authSignupEmailFull ||
      document.querySelector("[data-auth-signup-hybrid-email-display]")?.dataset.authSignupEmailFull ||
      "";
    const raw = emailInput?.value.trim() || hybridInput?.value.trim() || stored || "mail@sanne.com";
    syncAllSentEmailDisplays(raw);
  };

  let resizeObserver;

  const installSentEmailDisplayObserver = () => {
    if (resizeObserver || typeof ResizeObserver === "undefined") return;

    resizeObserver = new ResizeObserver(() => {
      refreshAllSentEmailDisplays();
    });

    document
      .querySelectorAll(
        "[data-auth-signup-email-edit], [data-auth-signup-hybrid-email-submitted], .auth-signup-email-page__copy--code",
      )
      .forEach((el) => resizeObserver.observe(el));
  };

  const installPrototypeControl = () => {
    document
      .querySelector("[data-prototype-show-truncated-email]")
      ?.addEventListener("change", refreshAllSentEmailDisplays);
  };

  window.__authSignupEmailDisplay = {
    TRUNCATED_DEMO_EMAIL,
    getShowTruncatedEmailPrototype,
    resolveSentEmailValue,
    syncSentEmailDisplay,
    syncAllSentEmailDisplays,
    refreshAllSentEmailDisplays,
    installSentEmailDisplayObserver,
  };

  const boot = () => {
    installSentEmailDisplayObserver();
    installPrototypeControl();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
