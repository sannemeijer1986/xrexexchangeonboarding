/**
 * Sign-up CTA loading state — spinner in Send code buttons (Figma 15268:50585).
 */
(function () {
  const SIGNUP_SEND_CODE_LOADING_MS = 1200;
  const LOADER_SRC = "assets/icon_loading.svg";

  let sendCodeLoadingTimer = null;
  let isSendCodeLoading = false;

  const resolveLoaderSrc = (btn) => {
    const src = btn?.querySelector(".auth-signup-cta__loader")?.getAttribute("src") || "";
    if (src.startsWith("../")) return src;
    if (btn?.closest(".auth-signup-email-page") && window.location.pathname.includes("/auth/")) {
      return "../assets/icon_loading.svg";
    }
    return LOADER_SRC;
  };

  const ensureCtaStructure = (btn) => {
    if (!btn || btn.querySelector(".auth-signup-cta__label")) return;

    btn.classList.add("auth-signup-cta");
    const labelText = btn.textContent.trim() || "Continue";
    btn.textContent = "";

    const label = document.createElement("span");
    label.className = "auth-signup-cta__label";
    label.textContent = labelText;

    const loader = document.createElement("img");
    loader.className = "auth-signup-cta__loader";
    loader.src = resolveLoaderSrc(btn);
    loader.alt = "";
    loader.width = 24;
    loader.height = 24;
    loader.setAttribute("aria-hidden", "true");
    loader.hidden = true;

    btn.append(label, loader);
  };

  const getSendCodeButtons = () => {
    const footer = document.querySelector("[data-auth-signup-email-continue]");
    const keyboard = document.querySelector("[data-fake-keyboard-signup-email-continue]");
    return [footer, keyboard].filter(Boolean);
  };

  const setLabel = (btn, text) => {
    if (!btn) return;
    ensureCtaStructure(btn);
    const labelEl = btn.querySelector(".auth-signup-cta__label");
    if (labelEl) labelEl.textContent = text;
    else btn.textContent = text;
  };

  const setLoading = (loading) => {
    isSendCodeLoading = loading;
    getSendCodeButtons().forEach((btn) => {
      ensureCtaStructure(btn);
      btn.classList.toggle("is-loading", loading);
      const loader = btn.querySelector(".auth-signup-cta__loader");
      if (loader) loader.hidden = !loading;
      if (loading) {
        btn.disabled = true;
        btn.setAttribute("aria-busy", "true");
      } else {
        btn.removeAttribute("aria-busy");
      }
    });
  };

  const clearLoading = () => {
    if (sendCodeLoadingTimer) {
      clearTimeout(sendCodeLoadingTimer);
      sendCodeLoadingTimer = null;
    }
    setLoading(false);
  };

  const runSendCodeAction = (action) => {
    if (isSendCodeLoading) return;
    setLoading(true);
    sendCodeLoadingTimer = window.setTimeout(() => {
      sendCodeLoadingTimer = null;
      setLoading(false);
      action?.();
    }, SIGNUP_SEND_CODE_LOADING_MS);
  };

  const boot = () => {
    getSendCodeButtons().forEach(ensureCtaStructure);
  };

  window.__authSignupCta = {
    SIGNUP_SEND_CODE_LOADING_MS,
    ensureCtaStructure,
    setLabel,
    isLoading: () => isSendCodeLoading,
    setLoading,
    clearLoading,
    runSendCodeAction,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
