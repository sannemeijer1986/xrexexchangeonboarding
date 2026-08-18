/**
 * Auth Sign up – visitor sign-up page (Figma 13256:20205) + email step (15230:25023).
 */
(function () {
  const signupHeroRows = [
    ["icon_currency_render.svg", "icon_solana.svg", "icon_currency_near.svg"],
    [
      "icon_currency_ondo.svg",
      "icon_currency_link.svg",
      "icon_currency_aave.svg",
      "icon_digitalgold.svg",
    ],
    ["icon_currency_xrp.svg", "icon_currency_matic.svg", "icon_currency_usdt.svg"],
    [
      "icon_currency_eth.svg",
      "icon_currency_btc.svg",
      "icon_currency_xaut.svg",
      "icon_currency_USD.svg",
    ],
    ["icon_currency_eth.svg", "icon_currency_btc.svg", "icon_solana.svg"],
    [
      "icon_currency_eth.svg",
      "icon_currency_xaut.svg",
      "icon_currency_usdt.svg",
      "icon_currency_USD.svg",
    ],
    ["icon_currency_USD.svg", "icon_currency_TWD.svg", "icon_currency_near.svg"],
    [
      "icon_currency_link.svg",
      "icon_currency_aave.svg",
      "icon_currency_render.svg",
      "icon_currency_ondo.svg",
    ],
    ["icon_currency_xrp.svg", "icon_currency_matic.svg", "icon_currency_eth.svg"],
    [
      "icon_currency_btc.svg",
      "icon_solana.svg",
      "icon_currency_usdt.svg",
      "icon_currency_xrp.svg",
    ],
  ];

  const heroTrack = document.querySelector("[data-auth-signup-hero-track]");
  if (heroTrack && !heroTrack.childElementCount) {
    const buildLoop = () => {
      const loop = document.createElement("div");
      loop.className = "auth-signup__hero-loop";
      signupHeroRows.forEach((rowIcons) => {
        const row = document.createElement("div");
        row.className = "auth-signup__hero-row";
        rowIcons.forEach((icon) => {
          const coin = document.createElement("div");
          coin.className = "auth-signup__hero-coin";
          const img = document.createElement("img");
          img.src = `../assets/${icon}`;
          img.alt = "";
          coin.appendChild(img);
          row.appendChild(coin);
        });
        loop.appendChild(row);
      });
      return loop;
    };
    heroTrack.appendChild(buildLoop());
    heroTrack.appendChild(buildLoop());
  }

  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "../index.html";
  const phoneContainer = document.querySelector(".phone-container");

  const emailPage = document.querySelector("[data-auth-signup-email-page]");
  const emailPanel = emailPage?.querySelector('[data-auth-signup-email-panel="email"]');
  const codePanel = emailPage?.querySelector('[data-auth-signup-email-panel="code"]');
  const emailField = emailPage?.querySelector("[data-auth-signup-email-field]");
  const emailInput = emailPage?.querySelector("[data-auth-signup-email-input]");
  const emailCursor = emailPage?.querySelector("[data-auth-signup-email-cursor]");
  const emailClearBtn = emailPage?.querySelector("[data-auth-signup-email-clear]");
  const emailDisplay = emailPage?.querySelector("[data-auth-signup-email-display]");
  const emailEditBtn = emailPage?.querySelector("[data-auth-signup-email-edit]");
  const emailContinueBtn = emailPage?.querySelector("[data-auth-signup-email-continue]");
  const codeGrid = emailPage?.querySelector("[data-auth-signup-code-grid]");
  const codeCells = emailPage
    ? Array.from(emailPage.querySelectorAll("[data-auth-signup-code-cell]"))
    : [];
  const codePasteBtn = emailPage?.querySelector("[data-auth-signup-code-paste]");
  const mobilePanel = emailPage?.querySelector('[data-auth-signup-email-panel="mobile"]');
  const mobileCodePanel = emailPage?.querySelector('[data-auth-signup-email-panel="mobile-code"]');
  const mobileField = emailPage?.querySelector("[data-auth-signup-mobile-field]");
  const mobileInput = emailPage?.querySelector("[data-auth-signup-mobile-input]");
  const mobileCursor = emailPage?.querySelector("[data-auth-signup-mobile-cursor]");
  const mobileClearBtn = emailPage?.querySelector("[data-auth-signup-mobile-clear]");
  const mobileDisplay = emailPage?.querySelector("[data-auth-signup-mobile-display]");
  const mobileEditBtn = emailPage?.querySelector("[data-auth-signup-mobile-edit]");
  const mobileCodeGrid = emailPage?.querySelector("[data-auth-signup-mobile-code-grid]");
  const mobileCodeCells = emailPage
    ? Array.from(emailPage.querySelectorAll("[data-auth-signup-mobile-code-cell]"))
    : [];
  const mobileCodePasteBtn = emailPage?.querySelector("[data-auth-signup-mobile-code-paste]");
  const signupCodeLoader = emailPage?.querySelector("[data-auth-signup-code-loader]");
  const stepperSteps = emailPage
    ? Array.from(emailPage.querySelectorAll(".auth-signup-email-page__step"))
    : [];
  const signupEmailKeyboard = document.querySelector('[data-fake-keyboard="signup-email"]');
  const keyboardContinueBtn = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-continue]",
  );
  const keyboardDoneBtn = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-done]",
  );
  const signupEmailMq = window.matchMedia("(min-width: 641px)");
  const SIGNUP_DUMMY_EMAIL = "mail@sanne.com";
  const SIGNUP_DUMMY_CODE = "123456";
  const SIGNUP_DUMMY_PASSWORD = "Passw0rd!";
  const SIGNUP_DUMMY_MOBILE = "0975561399";
  const SIGNUP_CODE_LENGTH = 6;
  const PASSWORD_RULE_KEYS = ["length", "special", "number", "case"];
  const SIGNUP_EMAIL_KEYBOARD_DELAY_MS = 350;
  const SIGNUP_EMAIL_CHAR_DELAY_MS = 20;
  const SIGNUP_CODE_LOADER_VISIBLE_MS = 1500;
  let signupEmailStep = "email";
  let signupEmailTypingTimers = [];
  let signupMobileTypingTimers = [];
  let signupPasswordTypingTimers = [];
  let signupPasswordTypingGeneration = 0;
  let signupPasswordActiveField = "primary";
  let signupCodeLoaderHideTimer = null;
  let codeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
  let codeActiveIndex = 0;
  let mobileCodeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
  let mobileCodeActiveIndex = 0;

  const isVerificationCodeStep = () =>
    signupEmailStep === "code" || signupEmailStep === "mobile-code";

  const syncSignupKeyboardMode = () => {
    signupEmailKeyboard?.classList.toggle("is-code-mode", isVerificationCodeStep());
    signupEmailKeyboard?.classList.toggle(
      "is-mobile-numeric-mode",
      signupEmailStep === "mobile",
    );
  };

  const getPasswordFieldEl = (name) =>
    emailPage?.querySelector(`[data-auth-signup-password-field="${name}"]`);
  const getPasswordInputEl = (name) =>
    emailPage?.querySelector(`[data-auth-signup-password-input="${name}"]`);
  const getPasswordCursorEl = (name) =>
    emailPage?.querySelector(`[data-auth-signup-password-cursor="${name}"]`);

  const cancelSignupPasswordTyping = () => {
    signupPasswordTypingTimers.forEach((timer) => clearTimeout(timer));
    signupPasswordTypingTimers = [];
    signupPasswordTypingGeneration += 1;
  };

  const getActiveSignupPasswordField = () => {
    const focusedEl = emailPage?.querySelector('[data-auth-signup-password-field].is-focused');
    const name = focusedEl?.getAttribute("data-auth-signup-password-field");
    if (name === "primary" || name === "confirm") return name;
    return signupPasswordActiveField;
  };

  const syncPasswordVisibilityUi = (name) => {
    const inputEl = getPasswordInputEl(name);
    const btn = emailPage?.querySelector(`[data-auth-signup-password-visibility="${name}"]`);
    const iconEl = btn?.querySelector("img");
    if (!inputEl || !iconEl) return;
    const isVisible = inputEl.type === "text";
    iconEl.src = iconEl.src.replace(
      /icon_eye(?:_on|_off)?\.svg$/,
      isVisible ? "icon_eye_off.svg" : "icon_eye_on.svg",
    );
    btn?.setAttribute("aria-label", isVisible ? "Hide password" : "Show password");
  };

  const getPasswordValidation = (value) => ({
    length: value.length >= 8,
    special: /[^A-Za-z0-9]/.test(value),
    number: /\d/.test(value),
    case: /[a-z]/.test(value) && /[A-Z]/.test(value),
  });

  const isPasswordValid = (value) => {
    const rules = getPasswordValidation(value);
    return PASSWORD_RULE_KEYS.every((key) => rules[key]);
  };

  const syncPasswordRulesUi = (value = getPasswordInputEl("primary")?.value || "") => {
    const rules = getPasswordValidation(value);
    PASSWORD_RULE_KEYS.forEach((key) => {
      const ruleEl = emailPage?.querySelector(`[data-auth-signup-password-rule="${key}"]`);
      ruleEl?.classList.toggle("is-valid", rules[key]);
      const iconEl = ruleEl?.querySelector(".auth-signup-email-page__password-rule-icon");
      if (iconEl) {
        iconEl.src = iconEl.src.replace(
          /icon_check_(gray|green)_s\.svg$/,
          rules[key] ? "icon_check_green_s.svg" : "icon_check_gray_s.svg",
        );
      }
    });
  };

  const isPasswordFieldFocused = (name) =>
    getPasswordFieldEl(name)?.classList.contains("is-focused");

  const syncPasswordFieldUi = (name) => {
    const fieldEl = getPasswordFieldEl(name);
    const inputEl = getPasswordInputEl(name);
    if (!fieldEl || !inputEl) return;
    fieldEl.classList.toggle("is-filled", Boolean(inputEl.value));
  };

  const syncPasswordUi = () => {
    syncPasswordFieldUi("primary");
    syncPasswordFieldUi("confirm");
    syncPasswordRulesUi(getPasswordInputEl("primary")?.value || "");
    syncActionButtons();
  };

  const isPasswordStepComplete = () => {
    const primary = getPasswordInputEl("primary")?.value || "";
    const confirm = getPasswordInputEl("confirm")?.value || "";
    return (
      primary === SIGNUP_DUMMY_PASSWORD &&
      confirm === SIGNUP_DUMMY_PASSWORD &&
      isPasswordValid(primary)
    );
  };

  const focusSignupPassword = (name) => {
    signupPasswordActiveField = name;
    ["primary", "confirm"].forEach((fieldName) => {
      const fieldEl = getPasswordFieldEl(fieldName);
      const cursorEl = getPasswordCursorEl(fieldName);
      const isActive = fieldName === name;
      fieldEl?.classList.toggle("is-focused", isActive);
      if (isActive) cursorEl?.removeAttribute("hidden");
      else cursorEl?.setAttribute("hidden", "");
    });
    getPasswordInputEl(name)?.focus({ preventScroll: true });
    syncPasswordUi();
  };

  const unfocusSignupPassword = (name) => {
    const fieldEl = getPasswordFieldEl(name);
    const cursorEl = getPasswordCursorEl(name);
    const inputEl = getPasswordInputEl(name);
    fieldEl?.classList.remove("is-focused");
    cursorEl?.setAttribute("hidden", "");
    if (document.activeElement === inputEl) {
      inputEl?.blur();
    }
  };

  const unfocusAllPasswordFields = () => {
    unfocusSignupPassword("primary");
    unfocusSignupPassword("confirm");
    syncPasswordUi();
  };

  const resetPasswordFields = () => {
    cancelSignupPasswordTyping();
    ["primary", "confirm"].forEach((name) => {
      const inputEl = getPasswordInputEl(name);
      const fieldEl = getPasswordFieldEl(name);
      if (inputEl) {
        inputEl.value = "";
        inputEl.type = "password";
      }
      fieldEl?.classList.remove("is-focused", "is-filled");
      getPasswordCursorEl(name)?.setAttribute("hidden", "");
      syncPasswordVisibilityUi(name);
    });
    signupPasswordActiveField = "primary";
    syncPasswordRulesUi("");
    syncPasswordUi();
  };

  const fillSignupPassword = (name) => {
    const inputEl = getPasswordInputEl(name);
    const fieldEl = getPasswordFieldEl(name);
    if (!inputEl || !fieldEl) return;

    if (inputEl.value === SIGNUP_DUMMY_PASSWORD) {
      fieldEl.classList.add("is-focused", "is-filled");
      getPasswordCursorEl(name)?.removeAttribute("hidden");
      inputEl.focus({ preventScroll: true });
      syncPasswordUi();
      return;
    }

    cancelSignupPasswordTyping();
    inputEl.value = "";
    fieldEl.classList.add("is-focused");
    fieldEl.classList.remove("is-filled");
    getPasswordCursorEl(name)?.removeAttribute("hidden");
    inputEl.focus({ preventScroll: true });

    const typingGeneration = signupPasswordTypingGeneration;
    SIGNUP_DUMMY_PASSWORD.split("").forEach((_, index) => {
      const timer = window.setTimeout(() => {
        if (typingGeneration !== signupPasswordTypingGeneration) return;
        inputEl.value = SIGNUP_DUMMY_PASSWORD.slice(0, index + 1);
        fieldEl.classList.toggle("is-filled", inputEl.value.length > 0);
        if (name === "primary") {
          syncPasswordRulesUi(inputEl.value);
        }
        syncActionButtons();
        if (index === SIGNUP_DUMMY_PASSWORD.length - 1) {
          syncPasswordUi();
        }
      }, SIGNUP_EMAIL_CHAR_DELAY_MS * index);
      signupPasswordTypingTimers.push(timer);
    });
  };

  const togglePasswordVisibility = (name) => {
    const inputEl = getPasswordInputEl(name);
    if (!inputEl) return;
    const isVisible = inputEl.type === "text";
    inputEl.type = isVisible ? "password" : "text";
    syncPasswordVisibilityUi(name);
  };

  const handleSignupPasswordDelete = (name = getActiveSignupPasswordField()) => {
    if (signupEmailStep !== "password") return;
    const inputEl = getPasswordInputEl(name);
    const fieldEl = getPasswordFieldEl(name);
    const typingInProgress = signupPasswordTypingTimers.length > 0;
    if (!inputEl || !fieldEl) return;
    if (!inputEl.value && !typingInProgress) return;

    cancelSignupPasswordTyping();
    inputEl.value = "";
    inputEl.type = "password";
    syncPasswordVisibilityUi(name);
    fieldEl.classList.remove("is-filled");
    fieldEl.classList.add("is-focused");
    getPasswordCursorEl(name)?.removeAttribute("hidden");
    if (name === "primary") {
      syncPasswordRulesUi("");
    }
    syncPasswordUi();
    focusSignupPassword(name);
    showSignupEmailKeyboard();
  };

  const handlePasswordFieldInteraction = (name) => {
    signupPasswordActiveField = name;
    if (!isPasswordFieldFocused(name)) {
      focusSignupPassword(name);
      showSignupEmailKeyboard();
      return;
    }
    if (getPasswordInputEl(name)?.value !== SIGNUP_DUMMY_PASSWORD) {
      fillSignupPassword(name);
    }
    showSignupEmailKeyboard();
  };

  const goBack = () => {
    if (emailPage?.classList.contains("is-open")) {
      closeEmailPage();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.location.href = next;
  };

  const goLogin = () => {
    const loginNext = encodeURIComponent(next);
    window.location.href = `login.html?next=${loginNext}`;
  };

  let snackbarTimeout = null;
  const showSnackbar = (message) => {
    const snackbar = document.querySelector("[data-snackbar]");
    if (!snackbar) return;
    const text = snackbar.querySelector("[data-snackbar-text]");
    if (text) text.textContent = message;
    if (snackbarTimeout) {
      clearTimeout(snackbarTimeout);
      snackbarTimeout = null;
    }
    snackbar.hidden = false;
    snackbar.classList.remove("is-visible");
    void snackbar.offsetWidth;
    requestAnimationFrame(() => snackbar.classList.add("is-visible"));
    snackbarTimeout = setTimeout(() => {
      snackbar.classList.remove("is-visible");
      snackbarTimeout = setTimeout(() => {
        if (!snackbar.classList.contains("is-visible")) snackbar.hidden = true;
      }, 320);
    }, 2200);
  };

  const showNotInPrototype = () => showSnackbar("Not in prototype");

  const syncActionButtons = () => {
    if (signupEmailStep === "email") {
      const enabled = emailInput?.value.trim() === SIGNUP_DUMMY_EMAIL;
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      if (keyboardContinueBtn) keyboardContinueBtn.disabled = !enabled;
    } else if (signupEmailStep === "password") {
      const enabled = isPasswordStepComplete();
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      if (keyboardContinueBtn) keyboardContinueBtn.disabled = !enabled;
    } else if (signupEmailStep === "mobile") {
      const enabled = mobileInput?.value.trim() === SIGNUP_DUMMY_MOBILE;
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      if (keyboardContinueBtn) keyboardContinueBtn.disabled = !enabled;
    }
  };

  const cancelSignupEmailTyping = () => {
    signupEmailTypingTimers.forEach((timer) => clearTimeout(timer));
    signupEmailTypingTimers = [];
  };

  const syncKeyboardStickyUi = () => {
    const hideContinue = isVerificationCodeStep();
    if (keyboardContinueBtn) keyboardContinueBtn.hidden = hideContinue;
    if (keyboardDoneBtn) keyboardDoneBtn.hidden = !hideContinue;
    syncSignupKeyboardMode();
  };

  const syncStepperUi = () => {
    stepperSteps.forEach((step, index) => {
      step.classList.toggle("is-active", index === 0);
      step.classList.remove("is-complete");
    });
    const firstFill = stepperSteps[0]?.querySelector(".auth-signup-email-page__step-fill");
    if (firstFill) firstFill.hidden = false;
  };

  const syncEmailClearUi = () => {
    const hasValue = Boolean(emailInput?.value.trim());
    if (emailClearBtn) emailClearBtn.hidden = !hasValue;
  };

  const isCodeComplete = () => codeDigits.every((digit) => digit !== "");

  const isEmailFocused = () => emailField?.classList.contains("is-focused");

  const isCodeFocused = () => codeGrid?.classList.contains("is-focused");

  const syncCodeUi = () => {
    const complete = isCodeComplete();
    const focused = codeGrid?.classList.contains("is-focused");
    codeGrid?.classList.toggle("is-filled", complete);

    codeCells.forEach((cell, index) => {
      const digitEl = cell.querySelector("[data-auth-signup-code-digit]");
      const cursorEl = cell.querySelector("[data-auth-signup-code-cursor]");
      const isActive =
        signupEmailStep === "code" &&
        focused &&
        !complete &&
        index === codeActiveIndex;
      cell.classList.toggle("is-active", isActive);
      if (digitEl) digitEl.textContent = codeDigits[index] || "";
      if (cursorEl) {
        if (isActive && !codeDigits[index]) cursorEl.removeAttribute("hidden");
        else cursorEl.setAttribute("hidden", "");
      }
    });
    syncActionButtons();
  };

  const resetCodeField = () => {
    codeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
    codeActiveIndex = 0;
    codeGrid?.classList.remove("is-focused", "is-filled");
    syncCodeUi();
  };

  const fillSignupCode = () => {
    if (signupEmailStep !== "code") return;
    codeDigits = SIGNUP_DUMMY_CODE.split("").slice(0, SIGNUP_CODE_LENGTH);
    codeActiveIndex = SIGNUP_CODE_LENGTH;
    syncCodeUi();
  };

  const fillSignupCodeAndUnfocus = () => {
    fillSignupCode();
    unfocusCodeEntry();
  };

  const hideSignupCodeLoader = () => {
    if (signupCodeLoaderHideTimer) {
      clearTimeout(signupCodeLoaderHideTimer);
      signupCodeLoaderHideTimer = null;
    }
    if (signupCodeLoader) signupCodeLoader.hidden = true;
  };

  const showSignupCodeLoader = (onComplete = advanceToPasswordStep) => {
    hideSignupCodeLoader();
    if (signupCodeLoader) signupCodeLoader.hidden = false;
    signupCodeLoaderHideTimer = window.setTimeout(() => {
      signupCodeLoaderHideTimer = null;
      hideSignupCodeLoader();
      onComplete();
    }, SIGNUP_CODE_LOADER_VISIBLE_MS);
  };

  const submitSignupCode = () => {
    if (signupEmailStep !== "code") return;
    if (signupCodeLoaderHideTimer || (signupCodeLoader && !signupCodeLoader.hidden)) return;
    fillSignupCodeAndUnfocus();
    dismissSignupEmailKeyboardUi();
    showSignupCodeLoader();
  };

  const showEmailStepUi = () => {
    signupEmailStep = "email";
    emailPage?.classList.remove(
      "is-code-step",
      "is-password-step",
      "is-mobile-step",
      "is-mobile-code-step",
    );
    if (emailPanel) emailPanel.hidden = false;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    syncActionButtons();
  };

  const showCodeStepUi = ({ resetCode = true } = {}) => {
    signupEmailStep = "code";
    emailPage?.classList.add("is-code-step");
    emailPage?.classList.remove("is-password-step", "is-mobile-step", "is-mobile-code-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = false;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    if (emailDisplay) {
      emailDisplay.textContent = emailInput?.value.trim() || SIGNUP_DUMMY_EMAIL;
    }
    syncStepperUi();
    syncKeyboardStickyUi();
    if (resetCode) {
      resetCodeField();
      requestAnimationFrame(() => focusCodeEntry());
    } else {
      if (!isCodeComplete()) {
        fillSignupCode();
      }
      unfocusCodeEntry();
      syncCodeUi();
    }
  };

  const showPasswordStepUi = () => {
    signupEmailStep = "password";
    emailPage?.classList.remove("is-code-step", "is-mobile-step", "is-mobile-code-step");
    emailPage?.classList.add("is-password-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    resetPasswordFields();
    hideSignupEmailKeyboard();
    window.setTimeout(() => {
      focusSignupPassword("primary");
      showSignupEmailKeyboard();
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
  };

  const showMobileStepUi = ({ resetMobile = false } = {}) => {
    signupEmailStep = "mobile";
    emailPage?.classList.remove("is-code-step", "is-password-step", "is-mobile-code-step");
    emailPage?.classList.add("is-mobile-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = false;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    if (resetMobile) resetMobileField();
    syncStepperUi();
    syncKeyboardStickyUi();
    syncActionButtons();
    hideSignupEmailKeyboard();
    window.setTimeout(() => {
      focusSignupMobile();
      showSignupEmailKeyboard();
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
  };

  const showMobileCodeStepUi = ({ resetCode = true } = {}) => {
    signupEmailStep = "mobile-code";
    emailPage?.classList.remove("is-password-step");
    emailPage?.classList.add("is-mobile-step", "is-mobile-code-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = false;
    if (mobileDisplay) {
      mobileDisplay.textContent = mobileInput?.value.trim() || SIGNUP_DUMMY_MOBILE;
    }
    syncStepperUi();
    syncKeyboardStickyUi();
    if (resetCode) {
      resetMobileCodeField();
      requestAnimationFrame(() => focusMobileCodeEntry());
    } else {
      if (!isMobileCodeComplete()) {
        fillSignupMobileCode();
      }
      unfocusMobileCodeEntry();
      syncMobileCodeUi();
    }
  };

  const advanceToMobileStep = () => {
    if (signupEmailStep !== "password") return;
    showMobileStepUi({ resetMobile: true });
  };

  const advanceToMobileCodeStep = () => {
    if (!mobileInput?.value.trim()) return;
    showMobileCodeStepUi();
    showSignupEmailKeyboard();
  };

  const returnFromMobileStep = () => {
    hideSignupCodeLoader();
    resetMobileField();
    resetMobileCodeField();
    showPasswordStepUi();
  };

  const returnToMobileStep = () => {
    hideSignupCodeLoader();
    unfocusMobileCodeEntry();
    showMobileStepUi();
    focusSignupMobile();
    syncSignupEmailKeyboardVisible();
  };

  const advanceToPasswordStep = () => {
    if (signupEmailStep !== "code") return;
    showPasswordStepUi();
  };

  const returnFromPasswordStep = () => {
    hideSignupCodeLoader();
    resetPasswordFields();
    resetCodeField();
    showEmailStepUi();
  };

  let signupEmailKeyboardDismissTimer = null;

  const hideSignupEmailKeyboard = () => {
    if (!signupEmailKeyboard) return;
    const wasVisible = signupEmailKeyboard.classList.contains("is-visible");
    signupEmailKeyboard.classList.remove("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "true");
    if (!wasVisible) return;
    if (signupEmailKeyboardDismissTimer) {
      clearTimeout(signupEmailKeyboardDismissTimer);
      signupEmailKeyboardDismissTimer = null;
    }
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-dismissing");
    signupEmailKeyboardDismissTimer = window.setTimeout(() => {
      phoneContainer?.classList.remove(
        "is-fake-keyboard-signup-email-visible",
        "is-fake-keyboard-signup-email-dismissing",
      );
      signupEmailKeyboardDismissTimer = null;
    }, 360);
  };

  const syncSignupEmailKeyboardVisible = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return;
    if (signupEmailKeyboardDismissTimer) {
      clearTimeout(signupEmailKeyboardDismissTimer);
      signupEmailKeyboardDismissTimer = null;
    }
    phoneContainer?.classList.remove("is-fake-keyboard-signup-email-dismissing");
    signupEmailKeyboard.hidden = false;
    signupEmailKeyboard.classList.add("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "false");
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-visible");
  };

  const showSignupEmailKeyboard = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return;
    syncSignupEmailKeyboardVisible();
  };

  const resetEmailField = () => {
    cancelSignupEmailTyping();
    if (emailInput) emailInput.value = "";
    emailField?.classList.remove("is-focused", "is-filled");
    emailCursor?.setAttribute("hidden", "");
    syncEmailClearUi();
    syncActionButtons();
  };

  const resetSignupEmailPageState = () => {
    hideSignupCodeLoader();
    showEmailStepUi();
    resetEmailField();
    resetCodeField();
    resetPasswordFields();
    resetMobileField();
    resetMobileCodeField();
  };

  const focusSignupEmail = () => {
    emailField?.classList.add("is-focused");
    emailInput?.focus({ preventScroll: true });
  };

  const focusCodeEntry = () => {
    codeGrid?.classList.add("is-focused");
    syncCodeUi();
  };

  const unfocusCodeEntry = () => {
    codeGrid?.classList.remove("is-focused");
    syncCodeUi();
  };

  const fillSignupEmail = () => {
    if (!emailInput || !emailField) return;
    if (emailInput.value === SIGNUP_DUMMY_EMAIL) {
      emailField.classList.add("is-focused", "is-filled");
      emailCursor?.removeAttribute("hidden");
      syncEmailClearUi();
      syncActionButtons();
      emailInput.focus({ preventScroll: true });
      return;
    }

    cancelSignupEmailTyping();
    emailInput.value = "";
    emailField.classList.add("is-focused");
    emailField.classList.remove("is-filled");
    emailCursor?.removeAttribute("hidden");
    syncEmailClearUi();
    syncActionButtons();
    emailInput.focus({ preventScroll: true });

    SIGNUP_DUMMY_EMAIL.split("").forEach((_, index) => {
      const timer = window.setTimeout(() => {
        emailInput.value = SIGNUP_DUMMY_EMAIL.slice(0, index + 1);
        emailField.classList.toggle("is-filled", emailInput.value.length > 0);
        syncActionButtons();
        if (index === SIGNUP_DUMMY_EMAIL.length - 1) {
          syncEmailClearUi();
        }
      }, SIGNUP_EMAIL_CHAR_DELAY_MS * index);
      signupEmailTypingTimers.push(timer);
    });
  };

  const clearSignupPassword = (name = getActiveSignupPasswordField()) => {
    handleSignupPasswordDelete(name);
  };

  const deleteCodeDigit = () => {
    if (signupEmailStep !== "code") return;
    let index = codeActiveIndex;
    if (index >= SIGNUP_CODE_LENGTH) index = SIGNUP_CODE_LENGTH - 1;
    if (index > 0 && codeDigits[index] === "") index -= 1;
    if (codeDigits[index] !== "") {
      codeDigits[index] = "";
      codeActiveIndex = index;
      syncCodeUi();
      focusCodeEntry();
    }
  };

  const advanceToCodeStep = () => {
    if (!emailInput?.value.trim()) return;
    showCodeStepUi();
    showSignupEmailKeyboard();
  };

  const returnToEmailStep = () => {
    hideSignupCodeLoader();
    unfocusCodeEntry();
    showEmailStepUi();
    focusSignupEmail();
    syncSignupEmailKeyboardVisible();
  };

  const clearSignupEmail = () => {
    if (!emailInput || !emailField) return;
    cancelSignupEmailTyping();
    emailInput.value = "";
    emailField.classList.remove("is-filled");
    emailField.classList.add("is-focused");
    emailCursor?.setAttribute("hidden", "");
    syncEmailClearUi();
    syncActionButtons();
    focusSignupEmail();
    showSignupEmailKeyboard();
  };

  const cancelSignupMobileTyping = () => {
    signupMobileTypingTimers.forEach((timer) => clearTimeout(timer));
    signupMobileTypingTimers = [];
  };

  const syncMobileClearUi = () => {
    const hasValue = Boolean(mobileInput?.value.trim());
    if (mobileClearBtn) mobileClearBtn.hidden = !hasValue;
  };

  const isMobileFocused = () => mobileField?.classList.contains("is-focused");

  const resetMobileField = () => {
    cancelSignupMobileTyping();
    if (mobileInput) mobileInput.value = "";
    mobileField?.classList.remove("is-focused", "is-filled");
    mobileCursor?.setAttribute("hidden", "");
    syncMobileClearUi();
    syncActionButtons();
  };

  const focusSignupMobile = () => {
    mobileField?.classList.add("is-focused");
    mobileInput?.focus({ preventScroll: true });
  };

  const unfocusSignupMobile = () => {
    mobileField?.classList.remove("is-focused");
    mobileCursor?.setAttribute("hidden", "");
    if (document.activeElement === mobileInput) {
      mobileInput?.blur();
    }
  };

  const fillSignupMobile = () => {
    if (!mobileInput || !mobileField) return;
    if (mobileInput.value === SIGNUP_DUMMY_MOBILE) {
      mobileField.classList.add("is-focused", "is-filled");
      mobileCursor?.removeAttribute("hidden");
      syncMobileClearUi();
      syncActionButtons();
      mobileInput.focus({ preventScroll: true });
      return;
    }

    cancelSignupMobileTyping();
    mobileInput.value = "";
    mobileField.classList.add("is-focused");
    mobileField.classList.remove("is-filled");
    mobileCursor?.removeAttribute("hidden");
    syncMobileClearUi();
    syncActionButtons();
    mobileInput.focus({ preventScroll: true });

    SIGNUP_DUMMY_MOBILE.split("").forEach((_, index) => {
      const timer = window.setTimeout(() => {
        mobileInput.value = SIGNUP_DUMMY_MOBILE.slice(0, index + 1);
        mobileField.classList.toggle("is-filled", mobileInput.value.length > 0);
        syncActionButtons();
        if (index === SIGNUP_DUMMY_MOBILE.length - 1) {
          syncMobileClearUi();
        }
      }, SIGNUP_EMAIL_CHAR_DELAY_MS * index);
      signupMobileTypingTimers.push(timer);
    });
  };

  const clearSignupMobile = () => {
    if (!mobileInput || !mobileField) return;
    cancelSignupMobileTyping();
    mobileInput.value = "";
    mobileField.classList.remove("is-filled");
    mobileField.classList.add("is-focused");
    mobileCursor?.removeAttribute("hidden");
    syncMobileClearUi();
    syncActionButtons();
    focusSignupMobile();
    showSignupEmailKeyboard();
  };

  const handleMobileFieldInteraction = () => {
    if (!isMobileFocused()) {
      focusSignupMobile();
      showSignupEmailKeyboard();
      return;
    }
    if (mobileInput?.value !== SIGNUP_DUMMY_MOBILE) {
      fillSignupMobile();
    }
    showSignupEmailKeyboard();
  };

  const isMobileCodeComplete = () => mobileCodeDigits.every((digit) => digit !== "");

  const isMobileCodeFocused = () => mobileCodeGrid?.classList.contains("is-focused");

  const syncMobileCodeUi = () => {
    const complete = isMobileCodeComplete();
    const focused = mobileCodeGrid?.classList.contains("is-focused");
    mobileCodeGrid?.classList.toggle("is-filled", complete);

    mobileCodeCells.forEach((cell, index) => {
      const digitEl = cell.querySelector("[data-auth-signup-mobile-code-digit]");
      const cursorEl = cell.querySelector("[data-auth-signup-mobile-code-cursor]");
      const isActive =
        signupEmailStep === "mobile-code" &&
        focused &&
        !complete &&
        index === mobileCodeActiveIndex;
      cell.classList.toggle("is-active", isActive);
      if (digitEl) digitEl.textContent = mobileCodeDigits[index] || "";
      if (cursorEl) {
        if (isActive && !mobileCodeDigits[index]) cursorEl.removeAttribute("hidden");
        else cursorEl.setAttribute("hidden", "");
      }
    });
  };

  const resetMobileCodeField = () => {
    mobileCodeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
    mobileCodeActiveIndex = 0;
    mobileCodeGrid?.classList.remove("is-focused", "is-filled");
    syncMobileCodeUi();
  };

  const fillSignupMobileCode = () => {
    if (signupEmailStep !== "mobile-code") return;
    mobileCodeDigits = SIGNUP_DUMMY_CODE.split("").slice(0, SIGNUP_CODE_LENGTH);
    mobileCodeActiveIndex = SIGNUP_CODE_LENGTH;
    syncMobileCodeUi();
  };

  const fillSignupMobileCodeAndUnfocus = () => {
    fillSignupMobileCode();
    unfocusMobileCodeEntry();
  };

  const focusMobileCodeEntry = () => {
    mobileCodeGrid?.classList.add("is-focused");
    syncMobileCodeUi();
  };

  const unfocusMobileCodeEntry = () => {
    mobileCodeGrid?.classList.remove("is-focused");
    syncMobileCodeUi();
  };

  const submitSignupMobileCode = () => {
    if (signupEmailStep !== "mobile-code") return;
    if (signupCodeLoaderHideTimer || (signupCodeLoader && !signupCodeLoader.hidden)) return;
    fillSignupMobileCodeAndUnfocus();
    dismissSignupEmailKeyboardUi();
    showSignupCodeLoader(showNotInPrototype);
  };

  const deleteMobileCodeDigit = () => {
    if (signupEmailStep !== "mobile-code") return;
    let index = mobileCodeActiveIndex;
    if (index >= SIGNUP_CODE_LENGTH) index = SIGNUP_CODE_LENGTH - 1;
    if (index > 0 && mobileCodeDigits[index] === "") index -= 1;
    if (mobileCodeDigits[index] !== "") {
      mobileCodeDigits[index] = "";
      mobileCodeActiveIndex = index;
      syncMobileCodeUi();
      focusMobileCodeEntry();
    }
  };

  const handleMobileCodeFieldInteraction = () => {
    if (isMobileCodeComplete()) {
      unfocusMobileCodeEntry();
      return;
    }
    if (!isMobileCodeFocused()) {
      focusMobileCodeEntry();
      showSignupEmailKeyboard();
      return;
    }
    submitSignupMobileCode();
  };

  const handleMobileCodePaste = () => {
    if (isMobileCodeComplete()) return;
    if (!isMobileCodeFocused()) {
      focusMobileCodeEntry();
      showSignupEmailKeyboard();
      return;
    }
    submitSignupMobileCode();
  };

  const unfocusSignupEmailField = () => {
    emailField?.classList.remove("is-focused");
    emailCursor?.setAttribute("hidden", "");
    if (document.activeElement === emailInput) {
      emailInput.blur();
    }
  };

  const dismissSignupEmailKeyboardFromOutside = () => {
    if (!signupEmailKeyboard?.classList.contains("is-visible")) return;
    hideSignupEmailKeyboard();
    if (signupEmailStep === "code") unfocusCodeEntry();
    else if (signupEmailStep === "mobile-code") unfocusMobileCodeEntry();
    else if (signupEmailStep === "password") unfocusAllPasswordFields();
    else if (signupEmailStep === "mobile") unfocusSignupMobile();
    else unfocusSignupEmailField();
  };

  const dismissSignupEmailKeyboardUi = () => {
    hideSignupEmailKeyboard();
    if (signupEmailStep === "code") unfocusCodeEntry();
    else if (signupEmailStep === "mobile-code") unfocusMobileCodeEntry();
    else if (signupEmailStep === "password") unfocusAllPasswordFields();
    else if (signupEmailStep === "mobile") unfocusSignupMobile();
    else unfocusSignupEmailField();
  };

  const handleSignupPrimaryAction = () => {
    if (signupEmailStep === "email") {
      if (!emailInput?.value.trim()) return;
      advanceToCodeStep();
      return;
    }
    if (signupEmailStep === "password") {
      if (!isPasswordStepComplete()) return;
      advanceToMobileStep();
      return;
    }
    if (signupEmailStep === "mobile") {
      if (mobileInput?.value.trim() !== SIGNUP_DUMMY_MOBILE) return;
      advanceToMobileCodeStep();
    }
  };

  const handleEmailBack = () => {
    if (signupEmailStep === "mobile-code") {
      returnToMobileStep();
      return;
    }
    if (signupEmailStep === "mobile") {
      returnFromMobileStep();
      return;
    }
    if (signupEmailStep === "password") {
      returnFromPasswordStep();
      return;
    }
    if (signupEmailStep === "code") {
      returnToEmailStep();
      return;
    }
    closeEmailPage();
  };

  const closeEmailPage = () => {
    if (!emailPage || (!emailPage.classList.contains("is-open") && emailPage.hidden)) return;
    hideSignupEmailKeyboard();
    emailPage.classList.remove("is-open");
    const onEnd = () => {
      if (!emailPage.classList.contains("is-open")) {
        emailPage.hidden = true;
        resetSignupEmailPageState();
      }
      emailPage.removeEventListener("transitionend", onEnd);
    };
    emailPage.addEventListener("transitionend", onEnd);
    setTimeout(onEnd, 360);
  };

  const openEmailPage = () => {
    if (!emailPage) return;
    resetSignupEmailPageState();
    emailPage.hidden = false;
    requestAnimationFrame(() => {
      emailPage.classList.add("is-open");
      window.setTimeout(() => {
        focusSignupEmail();
        showSignupEmailKeyboard();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    });
  };

  const handleEmailFieldInteraction = () => {
    if (!isEmailFocused()) {
      focusSignupEmail();
      showSignupEmailKeyboard();
      return;
    }
    if (emailInput?.value !== SIGNUP_DUMMY_EMAIL) {
      fillSignupEmail();
    }
    showSignupEmailKeyboard();
  };

  const handleCodeFieldInteraction = () => {
    if (isCodeComplete()) {
      unfocusCodeEntry();
      return;
    }
    if (!isCodeFocused()) {
      focusCodeEntry();
      showSignupEmailKeyboard();
      return;
    }
    submitSignupCode();
  };

  const handleCodePaste = () => {
    if (isCodeComplete()) return;
    if (!isCodeFocused()) {
      focusCodeEntry();
      showSignupEmailKeyboard();
      return;
    }
    submitSignupCode();
  };

  if (emailPage) {
    emailPage
      .querySelector("[data-auth-signup-email-back]")
      ?.addEventListener("click", handleEmailBack);
    emailField?.addEventListener("click", handleEmailFieldInteraction);
    emailContinueBtn?.addEventListener("click", handleSignupPrimaryAction);
    keyboardContinueBtn?.addEventListener("click", handleSignupPrimaryAction);
    emailEditBtn?.addEventListener("click", returnToEmailStep);
    mobileField?.addEventListener("click", handleMobileFieldInteraction);
    mobileEditBtn?.addEventListener("click", returnToMobileStep);
    mobileCodeGrid?.addEventListener("click", handleMobileCodeFieldInteraction);
    mobileCodePasteBtn?.addEventListener("click", handleMobileCodePaste);
    codeGrid?.addEventListener("click", handleCodeFieldInteraction);
    codePasteBtn?.addEventListener("click", handleCodePaste);

    emailPage.querySelectorAll("[data-auth-signup-password-field]").forEach((fieldEl) => {
      fieldEl.addEventListener("click", () => {
        const name = fieldEl.getAttribute("data-auth-signup-password-field");
        if (name === "primary" || name === "confirm") {
          handlePasswordFieldInteraction(name);
        }
      });
    });

    emailPage.querySelectorAll("[data-auth-signup-password-visibility]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const name = btn.getAttribute("data-auth-signup-password-visibility");
        if (name === "primary" || name === "confirm") {
          togglePasswordVisibility(name);
        }
      });
    });

    emailClearBtn?.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    emailClearBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSignupEmail();
    });

    mobileClearBtn?.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    mobileClearBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearSignupMobile();
    });

    signupEmailKeyboard
      ?.querySelector("[data-fake-keyboard-signup-email-close]")
      ?.addEventListener("click", dismissSignupEmailKeyboardUi);

    keyboardDoneBtn?.addEventListener("click", dismissSignupEmailKeyboardUi);

    signupEmailKeyboard
      ?.querySelectorAll("[data-fake-keyboard-signup-email-key]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (signupEmailStep === "email") {
            if (!isEmailFocused()) {
              focusSignupEmail();
              showSignupEmailKeyboard();
              return;
            }
            if (emailInput?.value !== SIGNUP_DUMMY_EMAIL) {
              fillSignupEmail();
            }
            showSignupEmailKeyboard();
            return;
          }
          if (signupEmailStep === "password") {
            const name = signupPasswordActiveField;
            if (!isPasswordFieldFocused(name)) {
              focusSignupPassword(name);
              showSignupEmailKeyboard();
              return;
            }
            if (getPasswordInputEl(name)?.value !== SIGNUP_DUMMY_PASSWORD) {
              fillSignupPassword(name);
            }
            showSignupEmailKeyboard();
            return;
          }
          if (signupEmailStep === "mobile") {
            if (!isMobileFocused()) {
              focusSignupMobile();
              showSignupEmailKeyboard();
              return;
            }
            if (mobileInput?.value !== SIGNUP_DUMMY_MOBILE) {
              fillSignupMobile();
            }
            showSignupEmailKeyboard();
          }
        });
      });

    signupEmailKeyboard
      ?.querySelectorAll("[data-fake-keyboard-signup-email-digit]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (signupEmailStep === "code") {
            if (isCodeComplete()) return;
            if (!isCodeFocused()) {
              focusCodeEntry();
              showSignupEmailKeyboard();
              return;
            }
            submitSignupCode();
            return;
          }
          if (signupEmailStep === "mobile-code") {
            if (isMobileCodeComplete()) return;
            if (!isMobileCodeFocused()) {
              focusMobileCodeEntry();
              showSignupEmailKeyboard();
              return;
            }
            submitSignupMobileCode();
            return;
          }
          if (signupEmailStep === "mobile") {
            if (!isMobileFocused()) {
              focusSignupMobile();
              showSignupEmailKeyboard();
              return;
            }
            if (mobileInput?.value !== SIGNUP_DUMMY_MOBILE) {
              fillSignupMobile();
            }
            showSignupEmailKeyboard();
          }
        });
      });

    signupEmailKeyboard
      ?.querySelectorAll("[data-fake-keyboard-signup-email-delete]")
      ?.forEach((btn) => {
        btn.addEventListener("mousedown", (e) => {
          e.preventDefault();
        });
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (signupEmailStep === "password") {
            handleSignupPasswordDelete();
            return;
          }
          if (signupEmailStep === "mobile") {
            clearSignupMobile();
            return;
          }
          if (signupEmailStep === "mobile-code") {
            deleteMobileCodeDigit();
            showSignupEmailKeyboard();
            return;
          }
          deleteCodeDigit();
          showSignupEmailKeyboard();
        });
      });

    emailPage.querySelectorAll("[data-auth-signup-password-input]").forEach((inputEl) => {
      inputEl.addEventListener("keydown", (e) => {
        if (signupEmailStep !== "password" || e.key !== "Backspace") return;
        e.preventDefault();
        const name = inputEl.getAttribute("data-auth-signup-password-input");
        if (name === "primary" || name === "confirm") {
          handleSignupPasswordDelete(name);
        }
      });
    });

    document.addEventListener("pointerdown", (e) => {
      if (!signupEmailMq.matches || !emailPage?.classList.contains("is-open")) return;
      if (!signupEmailKeyboard?.classList.contains("is-visible")) return;
      if (e.target instanceof Element) {
        if (signupEmailKeyboard.contains(e.target)) return;
        if (e.target.closest("[data-auth-signup-email-field]")) return;
        if (e.target.closest("[data-auth-signup-mobile-field]")) return;
        if (e.target.closest("[data-auth-signup-mobile-prefix]")) return;
        if (e.target.closest("[data-auth-signup-password-field]")) return;
        if (e.target.closest("[data-auth-signup-password-visibility]")) return;
        if (e.target.closest("[data-auth-signup-code-grid]")) return;
        if (e.target.closest("[data-auth-signup-mobile-code-grid]")) return;
        if (e.target.closest("[data-auth-signup-email-edit]")) return;
        if (e.target.closest("[data-auth-signup-mobile-edit]")) return;
        if (e.target.closest("[data-auth-signup-email-back]")) return;
      }
      dismissSignupEmailKeyboardFromOutside();
    });
  }

  document.querySelector("[data-auth-signup-back]")?.addEventListener("click", goBack);
  document.querySelector("[data-auth-signup-login]")?.addEventListener("click", goLogin);
  document
    .querySelector("[data-auth-signup-corporate]")
    ?.addEventListener("click", showNotInPrototype);
  document
    .querySelector("[data-auth-signup-continue]")
    ?.addEventListener("click", openEmailPage);
})();
