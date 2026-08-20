/**
 * Hybrid merge flow for sign-up email/mobile (Figma Onboarding-enhancement 15249:*).
 * Progressive disclosure ("Prog. discl...") stays in auth-signup / main.js unchanged.
 */
(function () {
  const SIGNUP_DUMMY_EMAIL = "mail@sanne.com";
  const SIGNUP_DUMMY_CODE = "123456";
  const SIGNUP_DUMMY_MOBILE = "0975561399";
  const SIGNUP_MOBILE_COUNTRY_CODE = "+886";
  const formatHybridMobileDisplay = (localNumber) =>
    `${SIGNUP_MOBILE_COUNTRY_CODE} ${(localNumber || SIGNUP_DUMMY_MOBILE).trim()}`;
  const SIGNUP_CODE_LENGTH = 6;
  const SIGNUP_EMAIL_KEYBOARD_DELAY_MS = 350;
  const SIGNUP_EMAIL_CHAR_DELAY_MS = 20;
  const SIGNUP_CODE_LOADER_VISIBLE_MS = 1500;
  const HYBRID_EMAIL_DESC_DEFAULT = "We'll send a code to verify it's yours";
  const HYBRID_EMAIL_DESC_SENT = "Code should arrive shortly in your email";
  const HYBRID_MOBILE_DESC_DEFAULT = "We'll send a code to confirm it's yours";
  const HYBRID_MOBILE_DESC_SENT = "Code should arrive shortly by SMS";

  const getMode = () => {
    const sel = document.querySelector("[data-prototype-merge-mail-phone]");
    return String(sel?.value || "prog") === "prog" ? "prog" : "hybrid";
  };
  const isHybrid = () => getMode() === "hybrid";

  const emailPage = document.querySelector("[data-auth-signup-email-page]");
  const phoneContainer = document.querySelector(".phone-container");
  const signupEmailKeyboard = document.querySelector('[data-fake-keyboard="signup-email"]');
  const keyboardSendCodeBar = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-send-bar]",
  );
  const keyboardCompactBar = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-compact-bar]",
  );
  const keyboardSendCodeBtn = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-continue]",
  );
  const keyboardContinueBtn = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-continue-compact]",
  );
  const keyboardDoneBtn = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-done]",
  );
  const footerBtn = emailPage?.querySelector("[data-auth-signup-email-continue]");
  const signupCodeLoader = emailPage?.querySelector("[data-auth-signup-code-loader]");
  const signupEmailMq = window.matchMedia("(min-width: 641px)");

  const progVerifyFlow = emailPage?.querySelector('[data-auth-signup-flow="prog"]');
  const hybridVerifyFlow = emailPage?.querySelector('[data-auth-signup-flow="hybrid"]');
  const progMobileFlow = emailPage?.querySelector('[data-auth-signup-flow="prog-mobile"]');
  const hybridMobileFlow = emailPage?.querySelector('[data-auth-signup-flow="hybrid-mobile"]');

  const hybridEmailField = emailPage?.querySelector("[data-auth-signup-hybrid-email-field]");
  const hybridEmailEditor = emailPage?.querySelector("[data-auth-signup-hybrid-email-editor]");
  const hybridEmailInput = emailPage?.querySelector("[data-auth-signup-hybrid-email-input]");
  const hybridEmailCursor = emailPage?.querySelector("[data-auth-signup-hybrid-email-cursor]");
  const hybridEmailClear = emailPage?.querySelector("[data-auth-signup-hybrid-email-clear]");
  const hybridEmailSubmitted = emailPage?.querySelector("[data-auth-signup-hybrid-email-submitted]");
  const hybridEmailDisplay = emailPage?.querySelector("[data-auth-signup-hybrid-email-display]");
  const hybridEmailDesc = emailPage?.querySelector("[data-auth-signup-hybrid-email-desc]");
  const hybridCodeBlock = emailPage?.querySelector("[data-auth-signup-hybrid-code-block]");
  const hybridCodePrompt = emailPage?.querySelector("[data-auth-signup-hybrid-code-prompt]");
  const hybridCodeGrid = emailPage?.querySelector("[data-auth-signup-hybrid-code-grid]");
  const hybridCodeMeta = emailPage?.querySelector("[data-auth-signup-hybrid-code-meta]");
  const hybridCodePaste = emailPage?.querySelector("[data-auth-signup-hybrid-code-paste]");
  const hybridCodeCells = emailPage
    ? Array.from(emailPage.querySelectorAll("[data-auth-signup-hybrid-code-cell]"))
    : [];

  const hybridMobileField = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-field]");
  const hybridMobileEditor = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-editor]");
  const hybridMobileInput = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-input]");
  const hybridMobileCursor = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-cursor]");
  const hybridMobileClear = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-clear]");
  const hybridMobileSubmitted = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-submitted]");
  const hybridMobileDisplayText = emailPage?.querySelector(
    "[data-auth-signup-hybrid-mobile-display-text]",
  );
  const hybridMobileDesc = emailPage?.querySelector("[data-auth-signup-hybrid-mobile-desc]");
  const hybridMobileCodeBlock = emailPage?.querySelector(
    "[data-auth-signup-hybrid-mobile-code-block]",
  );
  const hybridMobileCodePrompt = emailPage?.querySelector(
    "[data-auth-signup-hybrid-mobile-code-prompt]",
  );
  const hybridMobileCodeGrid = emailPage?.querySelector(
    "[data-auth-signup-hybrid-mobile-code-grid]",
  );
  const hybridMobileCodeMeta = emailPage?.querySelector(
    "[data-auth-signup-hybrid-mobile-code-meta]",
  );
  const hybridMobileCodePaste = emailPage?.querySelector(
    "[data-auth-signup-hybrid-mobile-code-paste]",
  );
  const hybridMobileCodeCells = emailPage
    ? Array.from(emailPage.querySelectorAll("[data-auth-signup-hybrid-mobile-code-cell]"))
    : [];

  if (!emailPage || !hybridVerifyFlow) return;

  let phase = "email"; // email | code | mobile | mobile-code
  let codeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
  let codeActiveIndex = 0;
  let mobileCodeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
  let mobileCodeActiveIndex = 0;
  let emailTypingTimers = [];
  let mobileTypingTimers = [];
  let codeLoaderTimer = null;
  let keyboardDismissTimer = null;
  let footerDismissedAfterContinue = false;

  const isKeyboardVisible = () =>
    signupEmailKeyboard?.classList.contains("is-visible") ?? false;

  // Password step reuses prog UI + main.js keyboard handlers (not hybrid phases).
  const isHybridManagedStep = () =>
    isHybrid() &&
    !emailPage?.classList.contains("is-password-step") &&
    !emailPage?.classList.contains("is-nationality-step") &&
    !emailPage?.classList.contains("is-id-details-step");

  const syncFlowVisibility = () => {
    const hybridOn = isHybrid();
    emailPage.classList.toggle("is-merge-hybrid", hybridOn);
    emailPage.classList.toggle("is-merge-prog", !hybridOn);
    if (progVerifyFlow) progVerifyFlow.hidden = hybridOn;
    if (hybridVerifyFlow) hybridVerifyFlow.hidden = !hybridOn;
    if (progMobileFlow) progMobileFlow.hidden = hybridOn;
    if (hybridMobileFlow) hybridMobileFlow.hidden = !hybridOn;
    syncChromeLabels();
    syncHybridActionUi();
  };

  const syncChromeLabels = () => {
    if (!isHybrid()) {
      window.__syncProgSignupActionLabels?.();
      return;
    }
    const setLabel = window.__authSignupCta?.setLabel || ((btn, text) => {
      if (btn) btn.textContent = text;
    });
    if (!isHybridManagedStep()) {
      if (footerBtn) setLabel(footerBtn, "Continue");
      if (keyboardSendCodeBtn) setLabel(keyboardSendCodeBtn, "Continue");
      if (keyboardContinueBtn) setLabel(keyboardContinueBtn, "Continue");
      return;
    }
    const label = phase === "email" || phase === "mobile" ? "Send code" : "Continue";
    if (keyboardSendCodeBtn) setLabel(keyboardSendCodeBtn, label);
    if (keyboardContinueBtn) setLabel(keyboardContinueBtn, label);
  };

  const syncHybridEmailPresentation = () => {
    const submitted = hybridEmailField?.classList.contains("is-submitted") ?? false;
    if (hybridEmailEditor) hybridEmailEditor.hidden = submitted;
    if (hybridEmailSubmitted) hybridEmailSubmitted.hidden = !submitted;
  };

  const syncHybridMobilePresentation = () => {
    const submitted = hybridMobileField?.classList.contains("is-submitted") ?? false;
    if (hybridMobileEditor) hybridMobileEditor.hidden = submitted;
    if (hybridMobileSubmitted) hybridMobileSubmitted.hidden = !submitted;
  };

  const syncHybridActionUi = () => {
    if (window.__authSignupCta?.isLoading?.()) return;
    if (!isHybrid()) {
      if (footerBtn) footerBtn.hidden = false;
      return;
    }
    if (!isHybridManagedStep()) {
      if (footerBtn) footerBtn.hidden = false;
      return;
    }
    syncChromeLabels();
    if (phase === "code" || phase === "mobile-code") {
      if (footerBtn) footerBtn.hidden = true;
      return;
    }
    const input = phase === "mobile" ? hybridMobileInput : hybridEmailInput;
    const dummy = phase === "mobile" ? SIGNUP_DUMMY_MOBILE : SIGNUP_DUMMY_EMAIL;
    const valid = input?.value.trim() === dummy;
    const setLabel = window.__authSignupCta?.setLabel || ((btn, text) => {
      if (btn) btn.textContent = text;
    });
    if (footerBtn) {
      footerBtn.hidden = false;
      if (isKeyboardVisible() && valid) {
        setLabel(footerBtn, "Continue");
        footerBtn.disabled = false;
      } else {
        setLabel(footerBtn, "Send code");
        footerBtn.disabled = !valid;
      }
    }
    if (keyboardSendCodeBtn && !keyboardSendCodeBtn.hidden) {
      keyboardSendCodeBtn.disabled = !valid;
    }
    if (keyboardContinueBtn && !keyboardContinueBtn.hidden) {
      keyboardContinueBtn.disabled = !valid;
    }
  };

  const syncSignupKeyboardMode = () => {
    const codeStep = phase === "code" || phase === "mobile-code";
    const sendCodeSticky = phase === "email" || phase === "mobile";
    signupEmailKeyboard?.classList.toggle("is-code-mode", codeStep);
    signupEmailKeyboard?.classList.toggle("is-mobile-numeric-mode", phase === "mobile");
    signupEmailKeyboard?.classList.toggle("is-send-code-sticky", sendCodeSticky);
    if (keyboardSendCodeBar) keyboardSendCodeBar.hidden = !sendCodeSticky;
    if (keyboardCompactBar) keyboardCompactBar.hidden = sendCodeSticky;
    if (keyboardSendCodeBtn) keyboardSendCodeBtn.hidden = !sendCodeSticky;
    if (keyboardContinueBtn) keyboardContinueBtn.hidden = codeStep || sendCodeSticky;
    if (keyboardDoneBtn) keyboardDoneBtn.hidden = !codeStep || sendCodeSticky;
    syncChromeLabels();
  };

  const hideKeyboard = () => {
    if (!signupEmailKeyboard) return;
    signupEmailKeyboard.classList.remove("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "true");
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-dismissing");
    if (keyboardDismissTimer) clearTimeout(keyboardDismissTimer);
    keyboardDismissTimer = window.setTimeout(() => {
      phoneContainer?.classList.remove(
        "is-fake-keyboard-signup-email-visible",
        "is-fake-keyboard-signup-email-dismissing",
      );
      keyboardDismissTimer = null;
    }, 360);
  };

  const showKeyboard = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return;
    if (keyboardDismissTimer) {
      clearTimeout(keyboardDismissTimer);
      keyboardDismissTimer = null;
    }
    phoneContainer?.classList.remove("is-fake-keyboard-signup-email-dismissing");
    signupEmailKeyboard.hidden = false;
    signupEmailKeyboard.classList.add("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "false");
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-visible");
    syncSignupKeyboardMode();
    syncHybridActionUi();
  };

  const cancelEmailTyping = () => {
    emailTypingTimers.forEach((t) => clearTimeout(t));
    emailTypingTimers = [];
  };

  const cancelMobileTyping = () => {
    mobileTypingTimers.forEach((t) => clearTimeout(t));
    mobileTypingTimers = [];
  };

  const syncHybridEmailClear = () => {
    if (hybridEmailClear) {
      hybridEmailClear.hidden = !hybridEmailInput?.value.trim();
    }
  };

  const syncHybridMobileClear = () => {
    if (hybridMobileClear) {
      hybridMobileClear.hidden = !hybridMobileInput?.value.trim();
    }
  };

  const unfocusHybridEmail = () => {
    hybridEmailField?.classList.remove("is-focused");
    hybridEmailCursor?.setAttribute("hidden", "");
    hybridEmailInput?.blur();
  };

  const focusHybridEmail = () => {
    hybridEmailField?.classList.add("is-focused");
    hybridEmailCursor?.removeAttribute("hidden");
    hybridEmailInput?.focus({ preventScroll: true });
    footerDismissedAfterContinue = false;
    showKeyboard();
    syncHybridActionUi();
  };

  const unfocusHybridMobile = () => {
    hybridMobileField?.classList.remove("is-focused");
    hybridMobileCursor?.setAttribute("hidden", "");
    hybridMobileInput?.blur();
  };

  const dismissHybridFromOutside = () => {
    if (!isHybridManagedStep()) return false;
    hideKeyboard();
    if (phase === "email") unfocusHybridEmail();
    else if (phase === "mobile") unfocusHybridMobile();
    else if (phase === "code") {
      hybridCodeGrid?.classList.remove("is-focused");
      syncHybridCodeUi();
    } else if (phase === "mobile-code") {
      hybridMobileCodeGrid?.classList.remove("is-focused");
      syncHybridMobileCodeUi();
    }
    syncHybridActionUi();
    return true;
  };

  const isHybridProtectedTarget = (target) => {
    if (!(target instanceof Element)) return false;
    const selectors = [
      "[data-auth-signup-hybrid-email-field]",
      "[data-auth-signup-hybrid-email-editor]",
      "[data-auth-signup-hybrid-email-submitted]",
      "[data-auth-signup-hybrid-mobile-field]",
      "[data-auth-signup-hybrid-mobile-editor]",
      "[data-auth-signup-hybrid-mobile-submitted]",
      "[data-auth-signup-hybrid-mobile-prefix]",
      "[data-auth-signup-hybrid-code-grid]",
      "[data-auth-signup-hybrid-code-cell]",
      "[data-auth-signup-hybrid-code-paste]",
      "[data-auth-signup-hybrid-code-meta]",
      "[data-auth-signup-hybrid-mobile-code-grid]",
      "[data-auth-signup-hybrid-mobile-code-cell]",
      "[data-auth-signup-hybrid-mobile-code-paste]",
      "[data-auth-signup-hybrid-mobile-code-meta]",
      "[data-auth-signup-email-continue]",
      "[data-auth-signup-email-back]",
      "[data-auth-signup-password-field]",
      "[data-auth-signup-password-visibility]",
      '[data-fake-keyboard="signup-email"]',
    ];
    return selectors.some((selector) => target.closest(selector));
  };

  const fillHybridEmail = () => {
    if (!hybridEmailInput || !hybridEmailField) return;
    if (hybridEmailInput.value === SIGNUP_DUMMY_EMAIL) {
      hybridEmailField.classList.add("is-focused", "is-filled");
      hybridEmailCursor?.removeAttribute("hidden");
      syncHybridEmailClear();
      hybridEmailInput.focus({ preventScroll: true });
      return;
    }
    cancelEmailTyping();
    hybridEmailInput.value = "";
    hybridEmailField.classList.add("is-focused");
    hybridEmailField.classList.remove("is-filled");
    hybridEmailCursor?.removeAttribute("hidden");
    syncHybridEmailClear();
    hybridEmailInput.focus({ preventScroll: true });
    SIGNUP_DUMMY_EMAIL.split("").forEach((_, i) => {
      emailTypingTimers.push(
        window.setTimeout(() => {
          hybridEmailInput.value = SIGNUP_DUMMY_EMAIL.slice(0, i + 1);
          hybridEmailField.classList.toggle("is-filled", hybridEmailInput.value.length > 0);
          syncHybridActionUi();
          if (i === SIGNUP_DUMMY_EMAIL.length - 1) syncHybridEmailClear();
        }, SIGNUP_EMAIL_CHAR_DELAY_MS * i),
      );
    });
  };

  const clearHybridEmail = () => {
    cancelEmailTyping();
    if (hybridEmailInput) hybridEmailInput.value = "";
    hybridEmailField?.classList.remove("is-filled", "is-submitted");
    hybridEmailField?.classList.add("is-focused");
    syncHybridEmailPresentation();
    hybridEmailCursor?.removeAttribute("hidden");
    syncHybridEmailClear();
    syncHybridActionUi();
    focusHybridEmail();
  };

  const submitHybridEmail = () => {
    if (!hybridEmailField) return;
    const value = hybridEmailInput?.value.trim() || SIGNUP_DUMMY_EMAIL;
    if (hybridEmailDisplay) {
      window.__authSignupEmailDisplay?.syncSentEmailDisplay(hybridEmailDisplay, value);
    }
    hybridEmailField.classList.remove("is-focused", "is-filled");
    hybridEmailField.classList.add("is-submitted");
    hybridEmailCursor?.setAttribute("hidden", "");
    if (hybridEmailClear) hybridEmailClear.hidden = true;
    syncHybridEmailPresentation();
    unfocusHybridEmail();
  };

  const editHybridEmail = () => {
    if (!hybridEmailField) return;
    hybridEmailField.classList.remove("is-submitted");
    syncHybridEmailPresentation();
    lockHybridCode();
    phase = "email";
    footerDismissedAfterContinue = false;
    emailPage?.classList.remove("is-hybrid-code-active", "is-code-step");
    syncSignupKeyboardMode();
    syncHybridActionUi();
    focusHybridEmail();
    if (hybridEmailInput?.value.trim() === SIGNUP_DUMMY_EMAIL) {
      hybridEmailField.classList.add("is-filled");
      syncHybridEmailClear();
    }
  };

  const syncHybridEmailDesc = () => {
    if (!hybridEmailDesc) return;
    const sent =
      phase === "code" || hybridEmailField?.classList.contains("is-submitted");
    hybridEmailDesc.textContent = sent ? HYBRID_EMAIL_DESC_SENT : HYBRID_EMAIL_DESC_DEFAULT;
  };

  const syncHybridCodeChrome = () => {
    const locked = hybridCodeBlock?.classList.contains("is-locked") ?? true;
    if (hybridCodeBlock) hybridCodeBlock.hidden = locked;
    syncHybridEmailDesc();
  };

  const syncHybridMobileDesc = () => {
    if (!hybridMobileDesc) return;
    const sent =
      phase === "mobile-code" || hybridMobileField?.classList.contains("is-submitted");
    hybridMobileDesc.textContent = sent ? HYBRID_MOBILE_DESC_SENT : HYBRID_MOBILE_DESC_DEFAULT;
  };

  const syncHybridMobileCodeChrome = () => {
    const locked = hybridMobileCodeBlock?.classList.contains("is-locked") ?? true;
    if (hybridMobileCodeBlock) hybridMobileCodeBlock.hidden = locked;
    syncHybridMobileDesc();
  };

  const lockHybridMobileCode = () => {
    hybridMobileCodeBlock?.classList.add("is-locked");
    hybridMobileCodeGrid?.classList.add("auth-signup-email-page__code-grid--hybrid");
    syncHybridMobileCodeChrome();
    mobileCodeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
    mobileCodeActiveIndex = 0;
    hybridMobileCodeGrid?.classList.remove("is-focused", "is-filled");
    syncHybridMobileCodeUi();
  };

  const unlockHybridCode = () => {
    submitHybridEmail();
    hybridCodeBlock?.classList.remove("is-locked");
    hybridCodeGrid?.classList.remove("auth-signup-email-page__code-grid--hybrid");
    syncHybridCodeChrome();
    window.__signupResendCountdown?.start("[data-auth-signup-hybrid-code-resend]");
    phase = "code";
    emailPage?.classList.add("is-hybrid-code-active", "is-code-step");
    codeActiveIndex = 0;
    syncSignupKeyboardMode();
    syncHybridActionUi();
    hybridCodeGrid?.classList.add("is-focused");
    syncHybridCodeUi();
    showKeyboard();
  };

  const lockHybridCode = () => {
    hybridCodeBlock?.classList.add("is-locked");
    hybridCodeGrid?.classList.add("auth-signup-email-page__code-grid--hybrid");
    syncHybridCodeChrome();
    codeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
    codeActiveIndex = 0;
    hybridCodeGrid?.classList.remove("is-focused", "is-filled");
    syncHybridCodeUi();
  };

  const isHybridCodeComplete = () => codeDigits.every((d) => d !== "");

  const syncHybridCodeUi = () => {
    const complete = isHybridCodeComplete();
    const focused = hybridCodeGrid?.classList.contains("is-focused");
    hybridCodeGrid?.classList.toggle("is-filled", complete);
    hybridCodeCells.forEach((cell, index) => {
      const digitEl = cell.querySelector("[data-auth-signup-hybrid-code-digit]");
      const cursorEl = cell.querySelector("[data-auth-signup-hybrid-code-cursor]");
      const isActive =
        phase === "code" && focused && !complete && index === codeActiveIndex;
      cell.classList.toggle("is-active", isActive);
      if (digitEl) digitEl.textContent = codeDigits[index] || "";
      if (cursorEl) {
        if (isActive && !codeDigits[index]) cursorEl.removeAttribute("hidden");
        else cursorEl.setAttribute("hidden", "");
      }
    });
  };

  const submitHybridCode = () => {
    if (phase !== "code") return;
    codeDigits = SIGNUP_DUMMY_CODE.split("").slice(0, SIGNUP_CODE_LENGTH);
    codeActiveIndex = SIGNUP_CODE_LENGTH;
    syncHybridCodeUi();
    hybridCodeGrid?.classList.remove("is-focused");
    hideKeyboard();
    if (signupCodeLoader) signupCodeLoader.hidden = false;
    if (codeLoaderTimer) clearTimeout(codeLoaderTimer);
    codeLoaderTimer = window.setTimeout(() => {
      codeLoaderTimer = null;
      if (signupCodeLoader) signupCodeLoader.hidden = true;
      window.__hybridSignupAdvanceMobile?.();
    }, SIGNUP_CODE_LOADER_VISIBLE_MS);
  };

  const hideHybridCodeLoader = () => {
    if (codeLoaderTimer) {
      clearTimeout(codeLoaderTimer);
      codeLoaderTimer = null;
    }
    if (signupCodeLoader) signupCodeLoader.hidden = true;
  };

  const resetHybridVerify = () => {
    cancelEmailTyping();
    window.__authSignupCta?.clearLoading?.();
    hideHybridCodeLoader();
    phase = "email";
    footerDismissedAfterContinue = false;
    if (hybridEmailInput) hybridEmailInput.value = "";
    hybridEmailField?.classList.remove("is-focused", "is-filled", "is-submitted");
    syncHybridEmailPresentation();
    hybridEmailCursor?.setAttribute("hidden", "");
    syncHybridEmailClear();
    lockHybridCode();
    emailPage?.classList.remove("is-hybrid-code-active", "is-code-step");
    syncSignupKeyboardMode();
    syncHybridActionUi();
  };

  const focusHybridCodeEntry = (index = 0) => {
    if (phase !== "code" || hybridCodeBlock?.classList.contains("is-locked")) return;
    unfocusHybridEmail();
    hybridMobileField?.classList.remove("is-focused");
    hybridMobileCursor?.setAttribute("hidden", "");
    codeActiveIndex = Math.max(0, Math.min(index, SIGNUP_CODE_LENGTH - 1));
    if (codeDigits[codeActiveIndex] && codeActiveIndex < SIGNUP_CODE_LENGTH - 1) {
      const nextEmpty = codeDigits.findIndex((d) => d === "");
      if (nextEmpty !== -1) codeActiveIndex = nextEmpty;
    }
    hybridCodeGrid?.classList.add("is-focused");
    syncHybridCodeUi();
    showKeyboard();
  };

  const handleHybridCodeInteraction = (cellIndex = null) => {
    if (!isHybrid() || phase !== "code" || hybridCodeBlock?.classList.contains("is-locked")) return;
    if (isHybridCodeComplete()) {
      hybridCodeGrid?.classList.remove("is-focused");
      syncHybridCodeUi();
      return;
    }
    const focused = hybridCodeGrid?.classList.contains("is-focused");
    if (!focused) {
      focusHybridCodeEntry(cellIndex ?? 0);
      return;
    }
    if (cellIndex !== null && cellIndex !== codeActiveIndex) {
      codeActiveIndex = cellIndex;
      syncHybridCodeUi();
      showKeyboard();
      return;
    }
    submitHybridCode();
  };

  const focusHybridMobile = () => {
    hybridMobileField?.classList.add("is-focused");
    hybridMobileCursor?.removeAttribute("hidden");
    hybridMobileInput?.focus({ preventScroll: true });
    footerDismissedAfterContinue = false;
    showKeyboard();
    syncHybridActionUi();
  };

  const fillHybridMobile = () => {
    if (!hybridMobileInput || !hybridMobileField) return;
    if (hybridMobileInput.value === SIGNUP_DUMMY_MOBILE) {
      hybridMobileField.classList.add("is-focused", "is-filled");
      hybridMobileCursor?.removeAttribute("hidden");
      syncHybridMobileClear();
      hybridMobileInput.focus({ preventScroll: true });
      return;
    }
    cancelMobileTyping();
    hybridMobileInput.value = "";
    hybridMobileField.classList.add("is-focused");
    hybridMobileField.classList.remove("is-filled");
    hybridMobileCursor?.removeAttribute("hidden");
    syncHybridMobileClear();
    hybridMobileInput.focus({ preventScroll: true });
    SIGNUP_DUMMY_MOBILE.split("").forEach((_, i) => {
      mobileTypingTimers.push(
        window.setTimeout(() => {
          hybridMobileInput.value = SIGNUP_DUMMY_MOBILE.slice(0, i + 1);
          hybridMobileField.classList.toggle("is-filled", hybridMobileInput.value.length > 0);
          syncHybridActionUi();
          if (i === SIGNUP_DUMMY_MOBILE.length - 1) syncHybridMobileClear();
        }, SIGNUP_EMAIL_CHAR_DELAY_MS * i),
      );
    });
  };

  const submitHybridMobile = () => {
    if (!hybridMobileField) return;
    const value = hybridMobileInput?.value.trim() || SIGNUP_DUMMY_MOBILE;
    if (hybridMobileDisplayText) hybridMobileDisplayText.textContent = formatHybridMobileDisplay(value);
    hybridMobileField.classList.remove("is-focused", "is-filled");
    hybridMobileField.classList.add("is-submitted");
    hybridMobileCursor?.setAttribute("hidden", "");
    if (hybridMobileClear) hybridMobileClear.hidden = true;
    syncHybridMobilePresentation();
    hybridMobileInput?.blur();
  };

  const editHybridMobile = () => {
    if (!hybridMobileField) return;
    hybridMobileField.classList.remove("is-submitted");
    syncHybridMobilePresentation();
    lockHybridMobileCode();
    phase = "mobile";
    footerDismissedAfterContinue = false;
    emailPage?.classList.remove("is-hybrid-mobile-code-active", "is-mobile-code-step");
    syncSignupKeyboardMode();
    syncHybridActionUi();
    focusHybridMobile();
    if (hybridMobileInput?.value.trim() === SIGNUP_DUMMY_MOBILE) {
      hybridMobileField.classList.add("is-filled");
      syncHybridMobileClear();
    }
  };

  const unlockHybridMobileCode = () => {
    submitHybridMobile();
    hybridMobileCodeBlock?.classList.remove("is-locked");
    hybridMobileCodeGrid?.classList.remove("auth-signup-email-page__code-grid--hybrid");
    syncHybridMobileCodeChrome();
    window.__signupResendCountdown?.start("[data-auth-signup-hybrid-mobile-code-resend]");
    phase = "mobile-code";
    emailPage?.classList.add("is-hybrid-mobile-code-active", "is-mobile-code-step");
    mobileCodeActiveIndex = 0;
    syncSignupKeyboardMode();
    syncHybridActionUi();
    hybridMobileCodeGrid?.classList.add("is-focused");
    syncHybridMobileCodeUi();
    showKeyboard();
  };

  const focusHybridMobileCodeEntry = (index = 0) => {
    if (phase !== "mobile-code" || hybridMobileCodeBlock?.classList.contains("is-locked")) return;
    hybridMobileField?.classList.remove("is-focused");
    hybridMobileCursor?.setAttribute("hidden", "");
    mobileCodeActiveIndex = Math.max(0, Math.min(index, SIGNUP_CODE_LENGTH - 1));
    if (mobileCodeDigits[mobileCodeActiveIndex] && mobileCodeActiveIndex < SIGNUP_CODE_LENGTH - 1) {
      const nextEmpty = mobileCodeDigits.findIndex((d) => d === "");
      if (nextEmpty !== -1) mobileCodeActiveIndex = nextEmpty;
    }
    hybridMobileCodeGrid?.classList.add("is-focused");
    syncHybridMobileCodeUi();
    showKeyboard();
  };

  const handleHybridMobileCodeInteraction = (cellIndex = null) => {
    if (!isHybrid() || phase !== "mobile-code" || hybridMobileCodeBlock?.classList.contains("is-locked")) return;
    const complete = mobileCodeDigits.every((d) => d !== "");
    if (complete) {
      hybridMobileCodeGrid?.classList.remove("is-focused");
      syncHybridMobileCodeUi();
      return;
    }
    const focused = hybridMobileCodeGrid?.classList.contains("is-focused");
    if (!focused) {
      focusHybridMobileCodeEntry(cellIndex ?? 0);
      return;
    }
    if (cellIndex !== null && cellIndex !== mobileCodeActiveIndex) {
      mobileCodeActiveIndex = cellIndex;
      syncHybridMobileCodeUi();
      showKeyboard();
      return;
    }
    submitHybridMobileCode();
  };

  const syncHybridMobileCodeUi = () => {
    const locked = hybridMobileCodeBlock?.classList.contains("is-locked") ?? true;
    const complete = mobileCodeDigits.every((d) => d !== "");
    const focused = !locked && hybridMobileCodeGrid?.classList.contains("is-focused");
    hybridMobileCodeGrid?.classList.toggle("is-filled", complete);
    hybridMobileCodeCells.forEach((cell, index) => {
      const digitEl = cell.querySelector("[data-auth-signup-hybrid-mobile-code-digit]");
      const cursorEl = cell.querySelector("[data-auth-signup-hybrid-mobile-code-cursor]");
      const isActive =
        phase === "mobile-code" && focused && !complete && index === mobileCodeActiveIndex;
      cell.classList.toggle("is-active", isActive);
      if (digitEl) digitEl.textContent = mobileCodeDigits[index] || "";
      if (cursorEl) {
        if (isActive && !mobileCodeDigits[index]) cursorEl.removeAttribute("hidden");
        else cursorEl.setAttribute("hidden", "");
      }
    });
  };

  const submitHybridMobileCode = () => {
    if (phase !== "mobile-code") return;
    mobileCodeDigits = SIGNUP_DUMMY_CODE.split("").slice(0, SIGNUP_CODE_LENGTH);
    mobileCodeActiveIndex = SIGNUP_CODE_LENGTH;
    syncHybridMobileCodeUi();
    hybridMobileCodeGrid?.classList.remove("is-focused");
    hideKeyboard();
    if (signupCodeLoader) signupCodeLoader.hidden = false;
    if (codeLoaderTimer) clearTimeout(codeLoaderTimer);
    codeLoaderTimer = window.setTimeout(() => {
      codeLoaderTimer = null;
      if (signupCodeLoader) signupCodeLoader.hidden = true;
      window.__hybridSignupAdvanceNationality?.();
    }, SIGNUP_CODE_LOADER_VISIBLE_MS);
  };

  const resetHybridMobile = () => {
    cancelMobileTyping();
    window.__authSignupCta?.clearLoading?.();
    hideHybridCodeLoader();
    footerDismissedAfterContinue = false;
    if (hybridMobileInput) hybridMobileInput.value = "";
    hybridMobileField?.classList.remove("is-focused", "is-filled", "is-submitted");
    syncHybridMobilePresentation();
    hybridMobileCursor?.setAttribute("hidden", "");
    syncHybridMobileClear();
    lockHybridMobileCode();
    emailPage?.classList.remove("is-hybrid-mobile-code-active", "is-mobile-code-step");
    syncSignupKeyboardMode();
    syncHybridActionUi();
  };

  const handleFooterClick = () => {
    if (!isHybridManagedStep()) return false;
    if (phase === "email") {
      const valid = hybridEmailInput?.value.trim() === SIGNUP_DUMMY_EMAIL;
      if (isKeyboardVisible() && valid) {
        footerDismissedAfterContinue = true;
        hideKeyboard();
        unfocusHybridEmail();
        syncHybridActionUi();
        return true;
      }
      if (!isKeyboardVisible() && valid) {
        window.__authSignupCta?.runSendCodeAction?.(unlockHybridCode);
        return true;
      }
      return true;
    }
    if (phase === "mobile") {
      const valid = hybridMobileInput?.value.trim() === SIGNUP_DUMMY_MOBILE;
      if (isKeyboardVisible() && valid) {
        footerDismissedAfterContinue = true;
        hideKeyboard();
        hybridMobileField?.classList.remove("is-focused");
        hybridMobileCursor?.setAttribute("hidden", "");
        syncHybridActionUi();
        return true;
      }
      if (!isKeyboardVisible() && valid) {
        window.__authSignupCta?.runSendCodeAction?.(unlockHybridMobileCode);
        return true;
      }
      return true;
    }
    if (phase === "code" || phase === "mobile-code") return true;
    return false;
  };

  const handleKeyboardPrimary = () => {
    if (!isHybridManagedStep()) return false;
    if (phase === "email" && hybridEmailInput?.value.trim() === SIGNUP_DUMMY_EMAIL) {
      window.__authSignupCta?.runSendCodeAction?.(() => {
        unlockHybridCode();
        hideKeyboard();
        unfocusHybridEmail();
      });
      return true;
    }
    if (phase === "mobile" && hybridMobileInput?.value.trim() === SIGNUP_DUMMY_MOBILE) {
      window.__authSignupCta?.runSendCodeAction?.(() => {
        unlockHybridMobileCode();
        hideKeyboard();
        hybridMobileField?.classList.remove("is-focused");
        hybridMobileCursor?.setAttribute("hidden", "");
      });
      return true;
    }
    return false;
  };

  const handleKeyboardDismiss = () => {
    if (!isHybridManagedStep()) return false;
    hideKeyboard();
    if (phase === "email") unfocusHybridEmail();
    else if (phase === "mobile") unfocusHybridMobile();
    else if (phase === "code") hybridCodeGrid?.classList.remove("is-focused");
    else if (phase === "mobile-code") hybridMobileCodeGrid?.classList.remove("is-focused");
    syncHybridActionUi();
    return true;
  };

  const handleHybridEmailInteraction = () => {
    if (!isHybrid() || phase !== "email") return;
    if (hybridEmailField?.classList.contains("is-submitted")) return;
    if (!hybridEmailField?.classList.contains("is-focused")) {
      focusHybridEmail();
      return;
    }
    if (hybridEmailInput?.value !== SIGNUP_DUMMY_EMAIL) fillHybridEmail();
  };

  hybridEmailField?.addEventListener("click", handleHybridEmailInteraction);
  hybridEmailEditor?.addEventListener("click", (event) => {
    event.stopPropagation();
    handleHybridEmailInteraction();
  });
  hybridEmailInput?.addEventListener("click", (event) => {
    event.stopPropagation();
    handleHybridEmailInteraction();
  });

  hybridEmailSubmitted?.addEventListener("click", (event) => {
    if (!isHybrid()) return;
    event.preventDefault();
    editHybridEmail();
  });

  hybridEmailClear?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHybrid()) clearHybridEmail();
  });

  hybridCodeGrid?.addEventListener("click", () => {
    handleHybridCodeInteraction();
  });

  hybridCodeCells.forEach((cell) => {
    cell.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = Number(cell.getAttribute("data-auth-signup-hybrid-code-cell"));
      handleHybridCodeInteraction(Number.isFinite(index) ? index : 0);
    });
  });

  hybridCodePaste?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!isHybrid() || phase !== "code") return;
    submitHybridCode();
  });

  const handleHybridMobileInteraction = () => {
    if (!isHybrid() || phase !== "mobile") return;
    if (hybridMobileField?.classList.contains("is-submitted")) return;
    if (!hybridMobileField?.classList.contains("is-focused")) {
      focusHybridMobile();
      return;
    }
    if (hybridMobileInput?.value !== SIGNUP_DUMMY_MOBILE) fillHybridMobile();
  };

  hybridMobileField?.addEventListener("click", handleHybridMobileInteraction);
  hybridMobileEditor?.addEventListener("click", (event) => {
    event.stopPropagation();
    handleHybridMobileInteraction();
  });
  hybridMobileInput?.addEventListener("click", (event) => {
    event.stopPropagation();
    handleHybridMobileInteraction();
  });

  hybridMobileSubmitted?.addEventListener("click", (event) => {
    if (!isHybrid()) return;
    event.preventDefault();
    editHybridMobile();
  });

  hybridMobileClear?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isHybrid() && hybridMobileInput) {
      hybridMobileInput.value = "";
      hybridMobileField?.classList.remove("is-filled");
      syncHybridMobileClear();
      syncHybridActionUi();
      focusHybridMobile();
    }
  });

  hybridMobileCodeGrid?.addEventListener("click", () => {
    handleHybridMobileCodeInteraction();
  });

  hybridMobileCodeCells.forEach((cell) => {
    cell.addEventListener("click", (event) => {
      event.stopPropagation();
      const index = Number(cell.getAttribute("data-auth-signup-hybrid-mobile-code-cell"));
      handleHybridMobileCodeInteraction(Number.isFinite(index) ? index : 0);
    });
  });

  hybridMobileCodePaste?.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!isHybrid() || phase !== "mobile-code") return;
    submitHybridMobileCode();
  });

  signupEmailKeyboard
    ?.querySelectorAll("[data-fake-keyboard-signup-email-key]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isHybrid() || phase !== "email") return;
        if (!hybridEmailField?.classList.contains("is-focused")) {
          focusHybridEmail();
          return;
        }
        if (hybridEmailInput?.value !== SIGNUP_DUMMY_EMAIL) fillHybridEmail();
      });
    });

  signupEmailKeyboard
    ?.querySelectorAll("[data-fake-keyboard-signup-email-digit]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isHybrid()) return;
        const digit = btn.getAttribute("data-fake-keyboard-signup-email-digit");
        if (!digit) return;
        if (phase === "code" && hybridCodeGrid?.classList.contains("is-focused")) {
          if (codeActiveIndex >= SIGNUP_CODE_LENGTH) return;
          codeDigits[codeActiveIndex] = digit;
          if (codeActiveIndex < SIGNUP_CODE_LENGTH - 1) codeActiveIndex += 1;
          syncHybridCodeUi();
          if (isHybridCodeComplete()) submitHybridCode();
          return;
        }
        if (phase === "mobile-code" && hybridMobileCodeGrid?.classList.contains("is-focused")) {
          if (mobileCodeActiveIndex >= SIGNUP_CODE_LENGTH) return;
          mobileCodeDigits[mobileCodeActiveIndex] = digit;
          if (mobileCodeActiveIndex < SIGNUP_CODE_LENGTH - 1) mobileCodeActiveIndex += 1;
          syncHybridMobileCodeUi();
          if (mobileCodeDigits.every((d) => d !== "")) submitHybridMobileCode();
          return;
        }
        if (phase === "mobile" && hybridMobileField?.classList.contains("is-focused")) {
          if (hybridMobileInput?.value !== SIGNUP_DUMMY_MOBILE) fillHybridMobile();
        }
      });
    });

  signupEmailKeyboard
    ?.querySelectorAll("[data-fake-keyboard-signup-email-delete]")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isHybrid()) return;
        if (phase === "code" && hybridCodeGrid?.classList.contains("is-focused")) {
          let index = codeActiveIndex;
          if (index >= SIGNUP_CODE_LENGTH) index = SIGNUP_CODE_LENGTH - 1;
          if (index > 0 && codeDigits[index] === "") index -= 1;
          if (codeDigits[index] !== "") {
            codeDigits[index] = "";
            codeActiveIndex = index;
            syncHybridCodeUi();
          }
        }
        if (phase === "mobile-code" && hybridMobileCodeGrid?.classList.contains("is-focused")) {
          let index = mobileCodeActiveIndex;
          if (index >= SIGNUP_CODE_LENGTH) index = SIGNUP_CODE_LENGTH - 1;
          if (index > 0 && mobileCodeDigits[index] === "") index -= 1;
          if (mobileCodeDigits[index] !== "") {
            mobileCodeDigits[index] = "";
            mobileCodeActiveIndex = index;
            syncHybridMobileCodeUi();
          }
        }
      });
    });

  document
    .querySelector("[data-prototype-merge-mail-phone]")
    ?.addEventListener("change", () => {
      window.__resetSignupFlowForMergeModeSwitch?.();
    });

  window.__hybridSignup = {
    isActive: isHybrid,
    isManagedStep: isHybridManagedStep,
    syncFlowVisibility,
    resetHybridVerify,
    resetHybridMobile,
    hideCodeLoader: hideHybridCodeLoader,
    setPhase: (next) => {
      phase = next;
      syncSignupKeyboardMode();
      syncHybridActionUi();
    },
    getPhase: () => phase,
    handleFooterClick,
    handleKeyboardPrimary,
    handleKeyboardDismiss,
    dismissFromOutside: dismissHybridFromOutside,
    isProtectedTarget: isHybridProtectedTarget,
    syncActionUi: syncHybridActionUi,
    syncSignupKeyboardMode,
    openEmailStep: () => {
      resetHybridVerify();
      window.setTimeout(() => {
        focusHybridEmail();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    },
    openMobileStep: () => {
      phase = "mobile";
      resetHybridMobile();
      syncSignupKeyboardMode();
      window.setTimeout(() => {
        focusHybridMobile();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    },
    handleBack: () => {
      if (!isHybridManagedStep()) return false;
      if (phase === "code") {
        lockHybridCode();
        phase = "email";
        emailPage?.classList.remove("is-hybrid-code-active", "is-code-step");
        hybridEmailField?.classList.remove("is-submitted");
        syncHybridEmailPresentation();
        if (hybridEmailInput?.value.trim()) {
          hybridEmailField?.classList.add("is-filled");
          syncHybridEmailClear();
        }
        focusHybridEmail();
        return true;
      }
      if (phase === "mobile-code") {
        lockHybridMobileCode();
        phase = "mobile";
        emailPage?.classList.remove("is-hybrid-mobile-code-active", "is-mobile-code-step");
        hybridMobileField?.classList.remove("is-submitted");
        syncHybridMobilePresentation();
        if (hybridMobileInput?.value.trim()) {
          hybridMobileField?.classList.add("is-filled");
          syncHybridMobileClear();
        }
        syncSignupKeyboardMode();
        syncHybridActionUi();
        focusHybridMobile();
        return true;
      }
      return false;
    },
    handleBackFromMobile: () => {
      resetHybridMobile();
      lockHybridCode();
      phase = "email";
      emailPage?.classList.remove(
        "is-mobile-step",
        "is-mobile-code-step",
        "is-hybrid-mobile-code-active",
        "is-nationality-step",
        "is-id-details-step",
        "is-password-step",
        "is-hybrid-code-active",
        "is-code-step",
      );
      hybridEmailField?.classList.remove("is-submitted");
      syncHybridEmailPresentation();
      if (hybridEmailInput?.value.trim()) {
        hybridEmailField?.classList.add("is-filled");
        syncHybridEmailClear();
      } else {
        hybridEmailField?.classList.remove("is-filled");
      }
      syncSignupKeyboardMode();
      syncHybridActionUi();
      window.setTimeout(() => {
        focusHybridEmail();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    },
    handleBackFromNationality: () => {
      lockHybridMobileCode();
      phase = "mobile";
      emailPage?.classList.remove(
        "is-nationality-step",
        "is-id-details-step",
        "is-password-step",
        "is-hybrid-mobile-code-active",
        "is-mobile-code-step",
      );
      emailPage?.classList.add("is-mobile-step");
      hybridMobileField?.classList.remove("is-submitted");
      syncHybridMobilePresentation();
      if (hybridMobileInput?.value.trim()) {
        hybridMobileField?.classList.add("is-filled");
        syncHybridMobileClear();
      } else {
        hybridMobileField?.classList.remove("is-filled");
      }
      syncSignupKeyboardMode();
      syncHybridActionUi();
      window.setTimeout(() => {
        focusHybridMobile();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    },
  };

  syncFlowVisibility();
  syncHybridEmailPresentation();
  syncHybridMobilePresentation();
  syncHybridCodeChrome();
  syncHybridMobileCodeChrome();
  syncHybridCodeUi();
  syncHybridMobileCodeUi();
  syncHybridActionUi();
})();
