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
  const nationalitySelectBtn = emailPage?.querySelector("[data-auth-signup-nationality-select]");
  const nationalityPlaceholder = emailPage?.querySelector("[data-auth-signup-nationality-placeholder]");
  const nationalityValueEl = emailPage?.querySelector("[data-auth-signup-nationality-value]");
  const nationalityConsentBtn = emailPage?.querySelector("[data-auth-signup-nationality-consent]");
  const idNumberBtn = emailPage?.querySelector("[data-auth-signup-id-number]");
  const idNumberWrap = emailPage?.querySelector("[data-auth-signup-id-number-field]");
  const idNumberClearBtn = emailPage?.querySelector("[data-auth-signup-id-number-clear]");
  const idDobRoot = emailPage?.querySelector("[data-auth-signup-id-dob]");
  const idDobYearInput = idDobRoot?.querySelector('[data-auth-signup-id-dob-segment="year"]');
  const idDetailsScrollEl = emailPage?.querySelector("[data-auth-signup-id-details-scroll]");
  const idDetailsReferralRow = emailPage?.querySelector("[data-auth-signup-referral-add]");
  const signupCodeLoader = emailPage?.querySelector("[data-auth-signup-code-loader]");
  const referralSheet = document.querySelector("[data-auth-referral-sheet]");
  const referralSheetPanel = referralSheet?.querySelector(".currency-sheet__panel");
  const completePage = document.querySelector("[data-auth-signup-complete-page]");
  const stepperSteps = emailPage
    ? Array.from(emailPage.querySelectorAll(".auth-signup-email-page__step"))
    : [];
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
  const signupEmailMq = window.matchMedia("(min-width: 641px)");
  const SIGNUP_DUMMY_EMAIL = "mail@sanne.com";
  const SIGNUP_DUMMY_CODE = "123456";
  const SIGNUP_DUMMY_PASSWORD = "Passw0rd!";
  const SIGNUP_DUMMY_MOBILE = "0975561399";
  const SIGNUP_MOBILE_COUNTRY_CODE = "+886";
  const formatMobileDisplay = (localNumber) =>
    `${SIGNUP_MOBILE_COUNTRY_CODE} ${(localNumber || SIGNUP_DUMMY_MOBILE).trim()}`;
  const SIGNUP_CODE_LENGTH = 6;
  const PASSWORD_RULE_KEYS = ["length", "special", "number", "case"];
  const SIGNUP_EMAIL_KEYBOARD_DELAY_MS = 350;
  const SIGNUP_EMAIL_CHAR_DELAY_MS = 20;
  const SIGNUP_DUMMY_ID_NUMBER = "A123456789";
  const SIGNUP_CODE_LOADER_VISIBLE_MS = 1500;
  const SIGNUP_COMPLETE_TRANSITION_MS = 350;
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
  let nationalitySelected = false;
  let nationalityConsentChecked = false;
  let idNumberFilled = false;
  let idNumberPartialValue = "";
  let signupIdNumberTypingTimers = [];

  const getSignupEmailKeyboardInset = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return 0;
    return signupEmailKeyboard.offsetHeight || 0;
  };

  const getIdDetailsKeyboardOverlap = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard?.classList.contains("is-visible")) {
      return 0;
    }
    return getSignupEmailKeyboardInset();
  };

  const clearIdDetailsScrollInset = () => {
    if (!idDetailsScrollEl || idDetailsScrollTransitionLock) return;
    idDetailsScrollEl.style.paddingBottom = "";
  };

  let idDetailsScrollResetTimer = null;
  let idDetailsScrollTransitionLock = false;

  const cancelIdDetailsScrollReset = () => {
    if (idDetailsScrollResetTimer) {
      clearTimeout(idDetailsScrollResetTimer);
      idDetailsScrollResetTimer = null;
    }
    idDetailsScrollTransitionLock = false;
  };

  const resetIdDetailsScrollState = () => {
    if (!idDetailsScrollEl) return;
    idDetailsScrollEl.scrollTop = 0;
    idDetailsScrollEl.style.paddingBottom = "";
  };

  const deferIdDetailsScrollResetUntilTrackTransition = () => {
    cancelIdDetailsScrollReset();
    idDetailsScrollTransitionLock = true;
    idDetailsScrollResetTimer = window.setTimeout(() => {
      idDetailsScrollTransitionLock = false;
      resetIdDetailsScrollState();
      idDetailsScrollResetTimer = null;
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
  };

  const syncIdDetailsScrollInset = () => {
    if (!idDetailsScrollEl || idDetailsScrollTransitionLock) return;
    if (signupEmailStep !== "id-details" || !signupEmailMq.matches) {
      clearIdDetailsScrollInset();
      return;
    }
    const inset = getSignupEmailKeyboardInset();
    idDetailsScrollEl.style.paddingBottom = inset > 0 ? `${inset}px` : "";
  };

  const runIdDetailsScrollPasses = (run) => {
    requestAnimationFrame(run);
    window.setTimeout(run, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    window.setTimeout(run, SIGNUP_EMAIL_KEYBOARD_DELAY_MS + 80);
  };

  const scrollIdDetailsFieldIntoView = (targetEl, { alignTop = false, alignBottom = false } = {}) => {
    if (!idDetailsScrollEl || !targetEl || signupEmailStep !== "id-details") return;

    const run = () => {
      if (alignTop === "start") {
        idDetailsScrollEl.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const panelRect = idDetailsScrollEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const paddingTop = 16;
      const paddingBottom = 16;
      const keyboardInset = getIdDetailsKeyboardOverlap();
      const visibleBottom = panelRect.bottom - keyboardInset;
      const maxScroll = Math.max(0, idDetailsScrollEl.scrollHeight - idDetailsScrollEl.clientHeight);

      if (alignBottom) {
        const targetScrollTop =
          idDetailsScrollEl.scrollTop + (targetRect.bottom - visibleBottom + paddingBottom);
        idDetailsScrollEl.scrollTo({
          top: Math.min(maxScroll, Math.max(0, targetScrollTop)),
          behavior: "smooth",
        });
        return;
      }

      if (alignTop) {
        const nextScrollTop =
          idDetailsScrollEl.scrollTop + (targetRect.top - panelRect.top - paddingTop);
        idDetailsScrollEl.scrollTo({
          top: Math.max(0, nextScrollTop),
          behavior: "smooth",
        });
        return;
      }

      if (targetRect.bottom > visibleBottom - paddingBottom) {
        const delta = targetRect.bottom - (visibleBottom - paddingBottom);
        idDetailsScrollEl.scrollTo({
          top: Math.min(maxScroll, idDetailsScrollEl.scrollTop + delta),
          behavior: "smooth",
        });
        return;
      }

      if (targetRect.top < panelRect.top + paddingTop) {
        const nextScrollTop =
          idDetailsScrollEl.scrollTop + (targetRect.top - panelRect.top - paddingTop);
        idDetailsScrollEl.scrollTo({
          top: Math.max(0, nextScrollTop),
          behavior: "smooth",
        });
      }
    };

    runIdDetailsScrollPasses(run);
  };

  const scrollIdDetailsToTop = () => {
    scrollIdDetailsFieldIntoView(idNumberWrap, { alignTop: "start" });
  };

  const scrollIdDetailsForDob = () => {
    scrollIdDetailsFieldIntoView(idDetailsReferralRow || idDobRoot, { alignBottom: true });
  };

  const idDobApi =
    typeof window.initAuthSignupIdDob === "function"
      ? window.initAuthSignupIdDob(idDobRoot, {
          assetBase: "../assets/",
          charDelayMs: SIGNUP_EMAIL_CHAR_DELAY_MS,
          onValidityChange: () => {
            syncIdDetailsUi();
            syncActionButtons();
          },
          onFocus: () => {
            unfocusIdNumber();
            syncIdDetailsKeyboard();
            scrollIdDetailsForDob();
          },
          onBlur: () => {
            syncIdDetailsKeyboard();
          },
        })
      : { isValid: () => false, reset: () => {}, fillDummy: () => {}, getSubmitValue: () => "", unfocus: () => {}, isFocused: () => false, hasValue: () => false, clearAllAndFocusYear: () => {} };

  const isVerificationCodeStep = () =>
    signupEmailStep === "code" || signupEmailStep === "mobile-code";

  const isSendCodeKeyboardSticky = () =>
    signupEmailStep === "email" || signupEmailStep === "mobile";

  const isSignupKeyboardHugeCtaSticky = () =>
    isSendCodeKeyboardSticky() ||
    signupEmailStep === "id-details" ||
    signupEmailStep === "password";

  const setKeyboardContinueDisabled = (enabled) => {
    if (isSignupKeyboardHugeCtaSticky()) {
      if (keyboardSendCodeBtn) keyboardSendCodeBtn.disabled = !enabled;
      return;
    }
    if (keyboardContinueBtn) keyboardContinueBtn.disabled = !enabled;
  };

  const isNationalityStepComplete = () => nationalitySelected && nationalityConsentChecked;

  const isIdDetailsStepComplete = () => idNumberFilled && idDobApi.isValid();

  const syncIdNumberUi = () => {
    if (!idNumberBtn) return;
    const displayValue = idNumberFilled ? SIGNUP_DUMMY_ID_NUMBER : idNumberPartialValue;
    const hasDisplay = displayValue.length > 0;
    idNumberBtn.classList.toggle("is-filled", hasDisplay);
    if (idNumberClearBtn) idNumberClearBtn.hidden = !hasDisplay;
    const placeholder = idNumberBtn.querySelector(".auth-signup-email-page__id-input-placeholder");
    const value = idNumberBtn.querySelector(".auth-signup-email-page__id-input-value");
    if (placeholder) placeholder.hidden = hasDisplay;
    if (value) {
      value.hidden = !hasDisplay;
      value.textContent = displayValue;
    }
  };

  const syncIdDetailsUi = () => {
    syncIdNumberUi();
    if (signupEmailStep === "id-details" && emailContinueBtn) {
      emailContinueBtn.hidden = false;
      emailContinueBtn.textContent = "Continue";
      emailContinueBtn.disabled = !isIdDetailsStepComplete();
    }
  };

  const cancelSignupIdNumberTyping = () => {
    signupIdNumberTypingTimers.forEach((timer) => clearTimeout(timer));
    signupIdNumberTypingTimers = [];
  };

  const fillIdNumber = () => {
    if (idNumberFilled) {
      focusIdNumber();
      syncIdNumberUi();
      return;
    }

    cancelSignupIdNumberTyping();
    idNumberPartialValue = "";
    focusIdNumber();
    syncIdNumberUi();
    syncActionButtons();

    SIGNUP_DUMMY_ID_NUMBER.split("").forEach((_, index) => {
      const timer = window.setTimeout(() => {
        idNumberPartialValue = SIGNUP_DUMMY_ID_NUMBER.slice(0, index + 1);
        syncIdNumberUi();
        if (index === SIGNUP_DUMMY_ID_NUMBER.length - 1) {
          idNumberFilled = true;
          idNumberPartialValue = "";
          syncIdDetailsUi();
          syncActionButtons();
          return;
        }
        syncActionButtons();
      }, SIGNUP_EMAIL_CHAR_DELAY_MS * index);
      signupIdNumberTypingTimers.push(timer);
    });
  };

  const isIdNumberFocused = () => idNumberWrap?.classList.contains("is-focused");

  const focusIdNumber = () => {
    idNumberWrap?.classList.add("is-focused");
    syncIdDetailsKeyboard();
    scrollIdDetailsToTop();
  };

  const unfocusIdNumber = () => {
    idNumberWrap?.classList.remove("is-focused");
  };

  const handleIdNumberInteraction = () => {
    if (!isIdNumberFocused()) {
      idDobApi.unfocus?.();
      focusIdNumber();
      return;
    }
    if (!idNumberFilled) {
      fillIdNumber();
    }
  };

  const hasIdNumberValue = () => idNumberFilled || idNumberPartialValue.length > 0;

  const clearIdNumber = () => {
    if (!hasIdNumberValue()) return;
    cancelSignupIdNumberTyping();
    idNumberPartialValue = "";
    idNumberFilled = false;
    focusIdNumber();
    syncIdDetailsUi();
    syncActionButtons();
  };

  const handleIdDetailsBackspace = () => {
    if (signupEmailStep !== "id-details") return false;
    if (isIdNumberFocused() && hasIdNumberValue()) {
      clearIdNumber();
      return true;
    }
    if (idDobApi.isFocused?.() && idDobApi.hasValue?.()) {
      idDobApi.clearAllAndFocusYear?.();
      return true;
    }
    return false;
  };

  const dismissIdDetailsFocus = () => {
    if (signupEmailStep !== "id-details") return;
    unfocusIdNumber();
    idDobApi.unfocus?.();
    syncIdDetailsKeyboard();
  };

  const resetIdDetailsFields = () => {
    cancelSignupIdNumberTyping();
    idNumberPartialValue = "";
    idNumberFilled = false;
    unfocusIdNumber();
    idDobApi.reset();
    syncIdDetailsUi();
  };

  const syncNationalityUi = () => {
    nationalitySelectBtn?.classList.toggle("is-filled", nationalitySelected);
    if (nationalityPlaceholder) nationalityPlaceholder.hidden = nationalitySelected;
    if (nationalityValueEl) nationalityValueEl.hidden = !nationalitySelected;
    if (nationalityConsentBtn) {
      nationalityConsentBtn.setAttribute(
        "aria-pressed",
        nationalityConsentChecked ? "true" : "false",
      );
    }
    if (signupEmailStep === "nationality" && emailContinueBtn) {
      emailContinueBtn.hidden = false;
      emailContinueBtn.textContent = "Continue";
      emailContinueBtn.disabled = !isNationalityStepComplete();
    }
  };

  const fillNationality = () => {
    nationalitySelected = true;
    syncNationalityUi();
    syncActionButtons();
  };

  const toggleNationalityConsent = () => {
    nationalityConsentChecked = !nationalityConsentChecked;
    syncNationalityUi();
    syncActionButtons();
  };

  const resetNationalityFields = () => {
    nationalitySelected = false;
    nationalityConsentChecked = false;
    syncNationalityUi();
  };

  const syncSignupKeyboardMode = () => {
    signupEmailKeyboard?.classList.toggle("is-code-mode", isVerificationCodeStep());
    const numericMode =
      signupEmailStep === "mobile" ||
      (signupEmailStep === "id-details" && idDobApi.isFocused?.() && !isIdNumberFocused());
    signupEmailKeyboard?.classList.toggle("is-mobile-numeric-mode", numericMode);
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

  const syncSignupActionLabels = () => {
    const sendCodeStep = signupEmailStep === "email" || signupEmailStep === "mobile";
    const label = sendCodeStep ? "Send code" : "Continue";
    const setLabel = window.__authSignupCta?.setLabel || ((btn, text) => {
      if (btn) btn.textContent = text;
    });
    if (emailContinueBtn) setLabel(emailContinueBtn, label);
    if (keyboardSendCodeBtn) setLabel(keyboardSendCodeBtn, label);
    if (keyboardContinueBtn) setLabel(keyboardContinueBtn, label);
  };

  const syncActionButtons = () => {
    if (window.__authSignupCta?.isLoading?.()) return;
    syncSignupActionLabels();
    if (signupEmailStep === "email") {
      const enabled = emailInput?.value.trim() === SIGNUP_DUMMY_EMAIL;
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      setKeyboardContinueDisabled(enabled);
    } else if (signupEmailStep === "password") {
      const enabled = isPasswordStepComplete();
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      setKeyboardContinueDisabled(enabled);
    } else if (signupEmailStep === "mobile") {
      const enabled = mobileInput?.value.trim() === SIGNUP_DUMMY_MOBILE;
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      setKeyboardContinueDisabled(enabled);
    } else if (signupEmailStep === "nationality") {
      const enabled = isNationalityStepComplete();
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      setKeyboardContinueDisabled(enabled);
    } else if (signupEmailStep === "id-details") {
      const enabled = isIdDetailsStepComplete();
      if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
      setKeyboardContinueDisabled(enabled);
    }
  };

  const cancelSignupEmailTyping = () => {
    signupEmailTypingTimers.forEach((timer) => clearTimeout(timer));
    signupEmailTypingTimers = [];
  };

  const syncKeyboardStickyUi = () => {
    const sendCodeSticky = isSignupKeyboardHugeCtaSticky();
    const hideContinue = isVerificationCodeStep();

    if (keyboardSendCodeBar) keyboardSendCodeBar.hidden = !sendCodeSticky;
    if (keyboardCompactBar) keyboardCompactBar.hidden = sendCodeSticky;
    if (keyboardSendCodeBtn) keyboardSendCodeBtn.hidden = !sendCodeSticky;
    if (keyboardContinueBtn) keyboardContinueBtn.hidden = hideContinue || sendCodeSticky;
    if (keyboardDoneBtn) keyboardDoneBtn.hidden = !hideContinue || sendCodeSticky;
    signupEmailKeyboard?.classList.toggle("is-send-code-sticky", sendCodeSticky);
    syncSignupKeyboardMode();
  };

  const SIGNUP_FLOW_STEP_COUNT = 5;

  const getSignupFlowStepIndex = () => {
    if (emailPage?.classList.contains("is-password-step") || signupEmailStep === "password") {
      return 5;
    }
    if (emailPage?.classList.contains("is-id-details-step") || signupEmailStep === "id-details") {
      return 4;
    }
    if (emailPage?.classList.contains("is-nationality-step") || signupEmailStep === "nationality") {
      return 3;
    }
    if (
      emailPage?.classList.contains("is-mobile-step") ||
      emailPage?.classList.contains("is-mobile-code-step") ||
      signupEmailStep === "mobile" ||
      signupEmailStep === "mobile-code"
    ) {
      return 2;
    }
    return 1;
  };

  const syncStepperUi = () => {
    const flowStep = getSignupFlowStepIndex();
    const fillPercent = (flowStep / SIGNUP_FLOW_STEP_COUNT) * 100;

    stepperSteps.forEach((step, index) => {
      step.classList.toggle("is-active", index === 0);
      step.classList.remove("is-complete");

      const fill = step.querySelector(".auth-signup-email-page__step-fill");
      if (!fill) return;

      if (index === 0) {
        fill.hidden = false;
        fill.style.width = `${fillPercent}%`;
      } else {
        fill.hidden = true;
        fill.style.width = "";
      }
    });
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

  const showSignupCodeLoader = (onComplete = advanceToMobileStep) => {
    hideSignupCodeLoader();
    if (signupCodeLoader) signupCodeLoader.hidden = false;
    signupCodeLoaderHideTimer = window.setTimeout(() => {
      signupCodeLoaderHideTimer = null;
      hideSignupCodeLoader();
      onComplete();
    }, SIGNUP_CODE_LOADER_VISIBLE_MS);
  };

  const openReferralSheet = () => {
    if (!referralSheet) {
      openSignupCompletePage(dismissSignupEmailPageUnderComplete);
      return;
    }
    referralSheet.hidden = false;
    requestAnimationFrame(() => referralSheet.classList.add("is-open"));
  };

  const closeReferralSheet = (onClosed) => {
    if (!referralSheet?.classList.contains("is-open")) {
      onClosed?.();
      return;
    }
    referralSheet.classList.remove("is-open");
    const finish = () => {
      if (!referralSheet.classList.contains("is-open")) referralSheet.hidden = true;
      onClosed?.();
    };
    referralSheetPanel?.addEventListener("transitionend", finish, { once: true });
    window.setTimeout(finish, 290);
  };

  const dismissSignupEmailPageUnderComplete = () => {
    if (!emailPage) return;
    hideSignupEmailKeyboard();
    emailPage.hidden = true;
    emailPage.classList.add("is-dismiss-instant");
    emailPage.classList.remove("is-open");
    emailPage.classList.remove("is-dismiss-instant");
    resetSignupEmailPageState();
  };

  const openSignupCompletePage = (onEntered) => {
    if (!completePage) {
      onEntered?.();
      return;
    }
    window.__authSignupCompleteLottie?.reset?.();
    hideSignupEmailKeyboard();
    completePage.hidden = false;
    requestAnimationFrame(() => {
      completePage.classList.add("is-open");
      let played = false;
      const finish = () => {
        if (!played) {
          played = true;
          window.__authSignupCompleteLottie?.play?.();
        }
        onEntered?.();
      };
      completePage.addEventListener("transitionend", finish, { once: true });
      window.setTimeout(finish, SIGNUP_COMPLETE_TRANSITION_MS + 50);
    });
  };

  const dismissSignupCompletePageDown = (onClosed) => {
    if (!completePage) {
      onClosed?.();
      return;
    }
    if (!completePage.classList.contains("is-open")) {
      onClosed?.();
      return;
    }

    completePage.classList.add("is-positioned-for-down");
    void completePage.offsetWidth;
    completePage.classList.remove("is-open");
    void completePage.offsetWidth;
    completePage.classList.add("is-dismiss-down");

    let dismissFinished = false;
    const onEnd = () => {
      if (dismissFinished) return;
      dismissFinished = true;
      completePage.style.transition = "none";
      completePage.hidden = true;
      completePage.classList.remove("is-positioned-for-down", "is-dismiss-down");
      completePage.style.removeProperty("transition");
      window.__authSignupCompleteLottie?.reset?.();
      onClosed?.();
    };
    completePage.addEventListener("transitionend", onEnd, { once: true });
    window.setTimeout(onEnd, SIGNUP_COMPLETE_TRANSITION_MS + 50);
  };

  const closeSignupCompletePage = () => {
    dismissSignupCompletePageDown();
  };

  const AUTH_STATE_STORAGE_KEY = "xrexexchange.authState.v1";

  const finishSignupAndExplore = () => {
    const finish = () => {
      try {
        if (window.localStorage) {
          window.localStorage.setItem(AUTH_STATE_STORAGE_KEY, "2");
        }
      } catch (_) {
        // ignore storage errors
      }
      window.location.href = next;
    };

    dismissSignupCompletePageDown(finish);
  };

  const finishSignupFlow = () => {
    closeReferralSheet(() => {
      openSignupCompletePage(dismissSignupEmailPageUnderComplete);
    });
  };

  const submitSignupPassword = () => {
    if (signupEmailStep !== "password") return;
    if (!isPasswordStepComplete()) return;
    if (signupCodeLoaderHideTimer || (signupCodeLoader && !signupCodeLoader.hidden)) return;
    unfocusAllPasswordFields();
    dismissSignupEmailKeyboardUi();
    showSignupCodeLoader(finishSignupFlow);
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
      "is-nationality-step",
      "is-id-details-step",
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
    emailPage?.classList.remove("is-password-step", "is-mobile-step", "is-mobile-code-step", "is-nationality-step", "is-id-details-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = false;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    if (emailDisplay) {
      window.__authSignupEmailDisplay?.syncSentEmailDisplay(
        emailDisplay,
        emailInput?.value.trim() || SIGNUP_DUMMY_EMAIL,
      );
    }
    syncStepperUi();
    syncKeyboardStickyUi();
    window.__signupResendCountdown?.start("[data-auth-signup-code-resend]");
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

  const showNationalityStepUi = () => {
    signupEmailStep = "nationality";
    clearIdDetailsScrollInset();
    emailPage?.classList.remove(
      "is-code-step",
      "is-mobile-step",
      "is-mobile-code-step",
      "is-password-step",
      "is-id-details-step",
    );
    emailPage?.classList.add("is-nationality-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    hideSignupEmailKeyboard();
    syncNationalityUi();
    syncActionButtons();
  };

  const showIdDetailsStepUi = () => {
    signupEmailStep = "id-details";
    emailPage?.classList.remove(
      "is-code-step",
      "is-mobile-step",
      "is-mobile-code-step",
      "is-password-step",
      "is-nationality-step",
    );
    emailPage?.classList.add("is-id-details-step");
    cancelIdDetailsScrollReset();
    if (idDetailsScrollEl) idDetailsScrollEl.scrollTop = 0;
    syncIdDetailsScrollInset();
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    hideSignupEmailKeyboard();
    syncIdDetailsUi();
    syncActionButtons();
  };

  const showPasswordStepUi = () => {
    signupEmailStep = "password";
    emailPage?.classList.remove("is-code-step", "is-mobile-step", "is-mobile-code-step", "is-nationality-step", "is-id-details-step");
    emailPage?.classList.add("is-password-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = true;
    syncStepperUi();
    syncKeyboardStickyUi();
    resetPasswordFields();
    hideSignupEmailKeyboard();
    deferIdDetailsScrollResetUntilTrackTransition();
    window.setTimeout(() => {
      focusSignupPassword("primary");
      showSignupEmailKeyboard();
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
  };

  const showMobileStepUi = ({ resetMobile = false } = {}) => {
    signupEmailStep = "mobile";
    emailPage?.classList.remove("is-code-step", "is-password-step", "is-mobile-code-step", "is-nationality-step", "is-id-details-step");
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
    emailPage?.classList.remove("is-password-step", "is-nationality-step", "is-id-details-step");
    emailPage?.classList.add("is-mobile-step", "is-mobile-code-step");
    if (emailPanel) emailPanel.hidden = true;
    if (codePanel) codePanel.hidden = true;
    if (mobilePanel) mobilePanel.hidden = true;
    if (mobileCodePanel) mobileCodePanel.hidden = false;
    if (mobileDisplay) {
      window.__authSignupEmailDisplay?.syncSentMobileDisplay?.(
        mobileDisplay,
        mobileInput?.value.trim() || SIGNUP_DUMMY_MOBILE,
        SIGNUP_MOBILE_COUNTRY_CODE,
      );
    }
    syncStepperUi();
    syncKeyboardStickyUi();
    window.__signupResendCountdown?.start("[data-auth-signup-mobile-code-resend]");
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
    if (signupEmailStep !== "code") return;
    showMobileStepUi({ resetMobile: true });
  };

  const advanceToMobileCodeStep = () => {
    if (!mobileInput?.value.trim()) return;
    showMobileCodeStepUi();
    showSignupEmailKeyboard();
  };

  const returnFromMobileStep = () => {
    window.__authSignupCta?.clearLoading?.();
    hideSignupCodeLoader();
    resetMobileField();
    resetMobileCodeField();
    resetCodeField();
    unfocusCodeEntry();
    showEmailStepUi();
    openSignupEmailEntryKeyboard();
  };

  const returnToMobileStep = () => {
    window.__authSignupCta?.clearLoading?.();
    hideSignupCodeLoader();
    unfocusMobileCodeEntry();
    resetMobileCodeField();
    showMobileStepUi();
  };

  const advanceToNationalityStep = () => {
    if (signupEmailStep !== "mobile-code") return;
    showNationalityStepUi();
  };

  const advanceToIdDetailsStep = () => {
    if (signupEmailStep !== "nationality") return;
    if (!isNationalityStepComplete()) return;
    showIdDetailsStepUi();
  };

  const advanceToPasswordStep = () => {
    if (signupEmailStep !== "id-details") return;
    if (!isIdDetailsStepComplete()) return;
    showPasswordStepUi();
  };

  const returnFromNationalityStep = () => {
    hideSignupCodeLoader();
    resetMobileCodeField();
    unfocusMobileCodeEntry();
    showMobileStepUi();
  };

  const returnFromIdDetailsStep = () => {
    hideSignupCodeLoader();
    showNationalityStepUi();
  };

  const returnFromPasswordStep = () => {
    hideSignupCodeLoader();
    resetPasswordFields();
    showIdDetailsStepUi();
  };

  const openSignupEmailEntryKeyboard = () => {
    window.setTimeout(() => {
      focusSignupEmail();
      showSignupEmailKeyboard();
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
  };

  const openSignupMobileEntryKeyboard = () => {
    window.setTimeout(() => {
      focusSignupMobile();
      showSignupEmailKeyboard();
    }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
  };

  let signupEmailKeyboardDismissTimer = null;
  let signupFooterCtaRevealTimer = null;
  const SIGNUP_FOOTER_CTA_REVEAL_DELAY_MS = 290;

  const shouldHideSignupFooterCtaForKeyboard = () =>
    signupEmailMq.matches && isSignupKeyboardHugeCtaSticky();

  const clearSignupFooterCtaTimers = () => {
    if (signupFooterCtaRevealTimer) {
      clearTimeout(signupFooterCtaRevealTimer);
      signupFooterCtaRevealTimer = null;
    }
  };

  const resetSignupFooterCta = () => {
    clearSignupFooterCtaTimers();
    emailPage?.classList.remove("is-signup-footer-cta-hidden", "is-signup-footer-cta-revealing");
  };

  const hideSignupFooterCtaForKeyboard = () => {
    if (!emailPage) return;
    if (!shouldHideSignupFooterCtaForKeyboard()) {
      resetSignupFooterCta();
      return;
    }
    clearSignupFooterCtaTimers();
    emailPage.classList.remove("is-signup-footer-cta-revealing");
    emailPage.classList.add("is-signup-footer-cta-hidden");
  };

  const scheduleSignupFooterCtaReveal = () => {
    if (!emailPage || !shouldHideSignupFooterCtaForKeyboard()) {
      resetSignupFooterCta();
      return;
    }
    clearSignupFooterCtaTimers();
    emailPage.classList.remove("is-signup-footer-cta-revealing");
    signupFooterCtaRevealTimer = window.setTimeout(() => {
      emailPage.classList.remove("is-signup-footer-cta-hidden");
      emailPage.classList.add("is-signup-footer-cta-revealing");
      signupFooterCtaRevealTimer = null;
    }, SIGNUP_FOOTER_CTA_REVEAL_DELAY_MS);
  };

  const hideSignupEmailKeyboard = () => {
    if (!signupEmailKeyboard) return;
    const wasVisible = signupEmailKeyboard.classList.contains("is-visible");
    const shouldRevealFooterCta = wasVisible && shouldHideSignupFooterCtaForKeyboard();
    signupEmailKeyboard.classList.remove("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "true");
    if (!wasVisible) return;
    if (signupEmailKeyboardDismissTimer) {
      clearTimeout(signupEmailKeyboardDismissTimer);
      signupEmailKeyboardDismissTimer = null;
    }
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-dismissing");
    if (shouldRevealFooterCta) {
      scheduleSignupFooterCtaReveal();
    } else {
      resetSignupFooterCta();
    }
    signupEmailKeyboardDismissTimer = window.setTimeout(() => {
      phoneContainer?.classList.remove(
        "is-fake-keyboard-signup-email-visible",
        "is-fake-keyboard-signup-email-dismissing",
      );
      resetSignupFooterCta();
      signupEmailKeyboardDismissTimer = null;
    }, 360);
  };

  const syncSignupEmailKeyboardVisible = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return;
    if (signupEmailKeyboardDismissTimer) {
      clearTimeout(signupEmailKeyboardDismissTimer);
      signupEmailKeyboardDismissTimer = null;
    }
    clearSignupFooterCtaTimers();
    emailPage?.classList.remove("is-signup-footer-cta-revealing");
    phoneContainer?.classList.remove("is-fake-keyboard-signup-email-dismissing");
    signupEmailKeyboard.hidden = false;
    signupEmailKeyboard.classList.add("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "false");
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-visible");
  };

  const showSignupEmailKeyboard = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return;
    syncKeyboardStickyUi();
    syncSignupEmailKeyboardVisible();
    hideSignupFooterCtaForKeyboard();
  };

  const isIdDetailsFieldFocused = () =>
    isIdNumberFocused() || Boolean(idDobApi.isFocused?.());

  const syncIdDetailsKeyboard = () => {
    if (signupEmailStep !== "id-details") return;
    syncKeyboardStickyUi();
    syncSignupKeyboardMode();
    if (isIdDetailsFieldFocused()) {
      showSignupEmailKeyboard();
    } else {
      hideSignupEmailKeyboard();
    }
    syncIdDetailsScrollInset();
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
    resetNationalityFields();
    resetIdDetailsFields();
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
    window.__authSignupCta?.clearLoading?.();
    hideSignupCodeLoader();
    unfocusCodeEntry();
    resetCodeField();
    showEmailStepUi();
    openSignupEmailEntryKeyboard();
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
    showSignupCodeLoader(advanceToNationalityStep);
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
    else if (signupEmailStep === "id-details") dismissIdDetailsFocus();
    else unfocusSignupEmailField();
  };

  const dismissSignupEmailKeyboardUi = () => {
    hideSignupEmailKeyboard();
    if (signupEmailStep === "code") unfocusCodeEntry();
    else if (signupEmailStep === "mobile-code") unfocusMobileCodeEntry();
    else if (signupEmailStep === "password") unfocusAllPasswordFields();
    else if (signupEmailStep === "mobile") unfocusSignupMobile();
    else if (signupEmailStep === "id-details") dismissIdDetailsFocus();
    else unfocusSignupEmailField();
  };

  const handleSignupPrimaryAction = () => {
    if (signupEmailStep === "email") {
      if (!emailInput?.value.trim()) return;
      window.__authSignupCta?.runSendCodeAction?.(advanceToCodeStep);
      return;
    }
    if (signupEmailStep === "password") {
      if (!isPasswordStepComplete()) return;
      submitSignupPassword();
      return;
    }
    if (signupEmailStep === "nationality") {
      if (!isNationalityStepComplete()) return;
      advanceToIdDetailsStep();
      return;
    }
    if (signupEmailStep === "id-details") {
      if (!isIdDetailsStepComplete()) return;
      advanceToPasswordStep();
      return;
    }
    if (signupEmailStep === "mobile") {
      if (mobileInput?.value.trim() !== SIGNUP_DUMMY_MOBILE) return;
      window.__authSignupCta?.runSendCodeAction?.(advanceToMobileCodeStep);
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
    if (signupEmailStep === "id-details") {
      returnFromIdDetailsStep();
      return;
    }
    if (signupEmailStep === "nationality") {
      returnFromNationalityStep();
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
    submitSignupCode();
  };

  if (emailPage) {
    emailPage
      .querySelector("[data-auth-signup-email-back]")
      ?.addEventListener("click", handleEmailBack);
    emailField?.addEventListener("click", handleEmailFieldInteraction);
    emailContinueBtn?.addEventListener("click", handleSignupPrimaryAction);
    const bindKeyboardPrimaryButton = (btn) => {
      if (!btn) return;
      btn.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (signupEmailStep !== "id-details") return;
        if (btn.disabled) return;
        // Prevent DOB blur from hiding the keyboard (pointer-events: none) before click fires.
        e.preventDefault();
        handleSignupPrimaryAction();
      });
      btn.addEventListener("click", (e) => {
        if (signupEmailStep === "id-details") {
          e.preventDefault();
          return;
        }
        handleSignupPrimaryAction();
      });
    };
    bindKeyboardPrimaryButton(keyboardSendCodeBtn);
    bindKeyboardPrimaryButton(keyboardContinueBtn);
    emailEditBtn?.addEventListener("click", returnToEmailStep);
    mobileField?.addEventListener("click", handleMobileFieldInteraction);
    mobileEditBtn?.addEventListener("click", returnToMobileStep);
    mobileCodeGrid?.addEventListener("click", handleMobileCodeFieldInteraction);
    mobileCodePasteBtn?.addEventListener("click", handleMobileCodePaste);
    codeGrid?.addEventListener("click", handleCodeFieldInteraction);
    codePasteBtn?.addEventListener("click", handleCodePaste);
    nationalitySelectBtn?.addEventListener("click", fillNationality);
    nationalityConsentBtn?.addEventListener("click", (e) => {
      if (e.target.closest("a")) return;
      toggleNationalityConsent();
    });
    idNumberWrap?.addEventListener("click", (e) => {
      if (e.target.closest("[data-auth-signup-id-number-clear]")) return;
      handleIdNumberInteraction();
    });
    idNumberClearBtn?.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    idNumberClearBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      clearIdNumber();
    });
    emailPage
      ?.querySelector("[data-auth-signup-referral-add]")
      ?.addEventListener("click", openReferralSheet);

    referralSheet
      ?.querySelectorAll(
        "[data-auth-referral-sheet-continue], [data-auth-referral-sheet-skip], [data-auth-referral-sheet-close]",
      )
      .forEach((btn) => {
        btn.addEventListener("click", () => closeReferralSheet());
      });

    completePage
      ?.querySelector("[data-auth-signup-complete-close]")
      ?.addEventListener("click", closeSignupCompletePage);
    completePage
      ?.querySelector("[data-auth-signup-complete-verify]")
      ?.addEventListener("click", showNotInPrototype);
    completePage
      ?.querySelector("[data-auth-signup-complete-explore]")
      ?.addEventListener("click", finishSignupAndExplore);

    syncNationalityUi();

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
            return;
          }
          if (signupEmailStep === "id-details") {
            if (!isIdNumberFocused()) {
              idDobApi.unfocus?.();
              focusIdNumber();
              return;
            }
            if (!idNumberFilled) {
              fillIdNumber();
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
            return;
          }
          if (signupEmailStep === "id-details") {
            if (!idDobApi.isFocused?.()) {
              idDobApi.focus?.(idDobYearInput);
              syncIdDetailsKeyboard();
              return;
            }
            if (!idDobApi.isValid?.() && !idDobApi.hasValue?.()) {
              idDobApi.fillDummy?.();
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
          if (signupEmailStep === "id-details") {
            handleIdDetailsBackspace();
            return;
          }
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

    document.addEventListener("keydown", (e) => {
      if (signupEmailStep !== "id-details") return;
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (!emailPage?.classList.contains("is-open")) return;
      if (handleIdDetailsBackspace()) {
        e.preventDefault();
      }
    });

    document.addEventListener("pointerdown", (e) => {
      if (!signupEmailMq.matches || !emailPage?.classList.contains("is-open")) return;
      if (!(e.target instanceof Element)) return;

      if (signupEmailStep === "id-details") {
        if (e.target.closest("[data-auth-signup-id-number-field]")) return;
        if (e.target.closest("[data-auth-signup-id-dob]")) return;
        if (signupEmailKeyboard?.contains(e.target)) return;
        dismissIdDetailsFocus();
      }

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
        if (e.target.closest("[data-auth-signup-code-paste]")) return;
        if (e.target.closest("[data-auth-signup-mobile-code-paste]")) return;
        if (e.target.closest("[data-auth-signup-code-meta]")) return;
        if (e.target.closest("[data-auth-signup-email-edit]")) return;
        if (e.target.closest("[data-auth-signup-mobile-edit]")) return;
        if (e.target.closest("[data-auth-signup-email-back]")) return;
        if (e.target.closest("[data-auth-signup-id-number-field]")) return;
        if (e.target.closest("[data-auth-signup-id-dob]")) return;
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
