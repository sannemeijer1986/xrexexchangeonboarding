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
  const SIGNUP_CODE_LENGTH = 6;
  const PASSWORD_RULE_KEYS = ["length", "special", "number", "case"];
  const SIGNUP_EMAIL_KEYBOARD_DELAY_MS = 350;
  const SIGNUP_EMAIL_CHAR_DELAY_MS = 20;
  const SIGNUP_CODE_LOADER_VISIBLE_MS = 1500;
  let signupEmailStep = "email";
  let signupEmailTypingTimers = [];
  let signupPasswordTypingTimers = [];
  let signupPasswordActiveField = "primary";
  let signupCodeLoaderHideTimer = null;
  let codeDigits = Array.from({ length: SIGNUP_CODE_LENGTH }, () => "");
  let codeActiveIndex = 0;

  const getPasswordFieldEl = (name) =>
    emailPage?.querySelector(`[data-auth-signup-password-field="${name}"]`);
  const getPasswordInputEl = (name) =>
    emailPage?.querySelector(`[data-auth-signup-password-input="${name}"]`);
  const getPasswordCursorEl = (name) =>
    emailPage?.querySelector(`[data-auth-signup-password-cursor="${name}"]`);

  const cancelSignupPasswordTyping = () => {
    signupPasswordTypingTimers.forEach((timer) => clearTimeout(timer));
    signupPasswordTypingTimers = [];
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

    SIGNUP_DUMMY_PASSWORD.split("").forEach((_, index) => {
      const timer = window.setTimeout(() => {
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
    }
  };

  const cancelSignupEmailTyping = () => {
    signupEmailTypingTimers.forEach((timer) => clearTimeout(timer));
    signupEmailTypingTimers = [];
  };

  const syncKeyboardStickyUi = () => {
    const isCode = signupEmailStep === "code";
    if (keyboardContinueBtn) keyboardContinueBtn.hidden = isCode;
    if (keyboardDoneBtn) keyboardDoneBtn.hidden = !isCode;
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

  const showSignupCodeLoader = () => {
    hideSignupCodeLoader();
    if (signupCodeLoader) signupCodeLoader.hidden = false;
    signupCodeLoaderHideTimer = window.setTimeout(() => {
      signupCodeLoaderHideTimer = null;
      hideSignupCodeLoader();
      advanceToPasswordStep();
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
    emailPage?.classList.remove("is-code-step", "is-password-step");
    signupEmailKeyboard?.classList.remove("is-code-mode");
    if (emailPanel) emailPanel.hidden = false;
    if (codePanel) codePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    syncActionButtons();
  };

  const showCodeStepUi = ({ resetCode = true } = {}) => {
    signupEmailStep = "code";
    emailPage?.classList.add("is-code-step");
    emailPage?.classList.remove("is-password-step");
    signupEmailKeyboard?.classList.add("is-code-mode");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = false;
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
    emailPage?.classList.remove("is-code-step");
    emailPage?.classList.add("is-password-step");
    signupEmailKeyboard?.classList.remove("is-code-mode");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    resetPasswordFields();
    hideSignupEmailKeyboard();
    window.setTimeout(() => {
      focusSignupPassword("primary");
      showSignupEmailKeyboard();
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
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
    else if (signupEmailStep === "password") unfocusAllPasswordFields();
    else unfocusSignupEmailField();
  };

  const dismissSignupEmailKeyboardUi = () => {
    hideSignupEmailKeyboard();
    if (signupEmailStep === "code") unfocusCodeEntry();
    else if (signupEmailStep === "password") unfocusAllPasswordFields();
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
      showNotInPrototype();
    }
  };

  const handleEmailBack = () => {
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
          }
        });
      });

    signupEmailKeyboard
      ?.querySelectorAll("[data-fake-keyboard-signup-email-digit]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (signupEmailStep !== "code") return;
          if (isCodeComplete()) return;
          if (!isCodeFocused()) {
            focusCodeEntry();
            showSignupEmailKeyboard();
            return;
          }
          submitSignupCode();
        });
      });

    signupEmailKeyboard
      ?.querySelector("[data-fake-keyboard-signup-email-delete]")
      ?.addEventListener("click", () => {
        deleteCodeDigit();
        showSignupEmailKeyboard();
      });

    document.addEventListener("pointerdown", (e) => {
      if (!signupEmailMq.matches || !emailPage?.classList.contains("is-open")) return;
      if (!signupEmailKeyboard?.classList.contains("is-visible")) return;
      if (e.target instanceof Element) {
        if (signupEmailKeyboard.contains(e.target)) return;
        if (e.target.closest("[data-auth-signup-email-field]")) return;
        if (e.target.closest("[data-auth-signup-password-field]")) return;
        if (e.target.closest("[data-auth-signup-password-visibility]")) return;
        if (e.target.closest("[data-auth-signup-code-grid]")) return;
        if (e.target.closest("[data-auth-signup-email-edit]")) return;
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
