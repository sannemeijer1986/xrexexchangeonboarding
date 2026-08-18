(() => {
  const STATE_CONFIGS = {
    flow: {
      storageKey: "xrexexchange.dcaFlowState.v1",
      min: 1,
      max: 5,
      labels: {
        1: "State 1",
        2: "State 2",
        3: "State 3",
        4: "State 4",
        5: "State 5",
      },
    },
    financeIntro: {
      storageKey: "xrexexchange.financeIntroState.v1",
      min: 1,
      max: 2,
      /** Default on load (build badge can still switch to state 1). */
      initial: 1,
      labels: {
        1: "First view",
        2: "Compact view",
      },
    },
    funding: {
      storageKey: "xrexexchange.fundingState.v1",
      min: 1,
      max: 5,
      labels: {
        1: "Default: Bal Ok",
        2: "Default: Bal 0",
        3: "Pre-fund: Funds Ok",
        4: "Pre-fund: Funds Low",
        5: "Pre-fund: Funds 0",
      },
    },
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const states = {};

  /** Prototype wallet balances — single source of truth (finance, plan detail, convert, …). */
  const PROTOTYPE_BALANCES = { TWD: 75000, USDT: 2750, BTC: 0 };

  /** Exposes flow progress on `<html>` so prototype-only SCSS can key off it. */
  const syncPrototypeFlowToDocument = () => {
    document.documentElement.dataset.prototypeFlow = String(states.flow ?? 1);
  };

  /** Exposes funding state on `<html>` for prototype-only logic/styles. */
  const syncPrototypeFundingToDocument = () => {
    document.documentElement.dataset.prototypeFunding = String(
      states.funding ?? 1,
    );
  };

  /** Set by initMyPlansPanel — refreshes plan cards when Flow progress changes */
  let syncMyPlansFlowUi = () => {};

  const syncTopChromeHeight = () => {
    const topChrome = document.querySelector(".top-chrome");
    if (!topChrome) return;
    document.documentElement.style.setProperty(
      "--top-chrome-height",
      `${topChrome.offsetHeight}px`,
    );
  };

  const syncFinanceSummaryVisibility = () => {
    const flowState = states.flow ?? 1;
    const shouldHide = flowState <= 1;
    document
      .querySelectorAll(".finance-summary__pnl, .finance-summary__meta-row")
      .forEach((el) => {
        el.classList.toggle("is-hidden", shouldHide);
        el.hidden = shouldHide;
      });

    const isFlowOne = flowState === 1;
    const topEl = document.querySelector(".finance-summary__top");
    if (topEl) {
      topEl.hidden = isFlowOne;
      topEl.classList.toggle("is-hidden", isFlowOne);
    }
    const actionsEl = document.querySelector(".finance-summary__actions");
    if (actionsEl) {
      actionsEl.classList.toggle(
        "finance-summary__actions--full-radius",
        isFlowOne,
      );
    }
  };

  const syncFinanceIntroState = () => {
    const fiCfg = STATE_CONFIGS.financeIntro;
    const introState =
      states.financeIntro ??
      (typeof fiCfg?.initial === "number" ? fiCfg.initial : fiCfg.min);
    const first = document.querySelector('[data-finance-intro-state="1"]');
    const compact = document.querySelector('[data-finance-intro-state="2"]');
    if (first) first.hidden = introState !== 1;
    if (compact) compact.hidden = introState !== 2;
  };

  const getLabel = (group, value) => {
    const config = STATE_CONFIGS[group];
    if (!config) return "";
    return config.labels[value] || "";
  };

  const updateGroupUI = (group) => {
    const config = STATE_CONFIGS[group];
    const groupEl = document.querySelector(`[data-state-group="${group}"]`);
    if (!config || !groupEl) return;

    const valueEl = groupEl.querySelector("[data-state-value]");
    const nameEl = groupEl.querySelector("[data-state-name]");
    const downBtn = groupEl.querySelector('[data-state-action="down"]');
    const upBtn = groupEl.querySelector('[data-state-action="up"]');
    const value = states[group];

    if (valueEl) valueEl.textContent = value;
    if (nameEl) {
      const label = getLabel(group, value);
      nameEl.textContent = label;
      nameEl.dataset.stateLabel = label;
    }
    if (downBtn) downBtn.disabled = value <= config.min;
    if (upBtn) upBtn.disabled = value >= config.max;
  };

  const setState = (group, next, opts = {}) => {
    const config = STATE_CONFIGS[group];
    if (!config) return config?.min ?? 1;
    const clamped = clamp(parseInt(next, 10), config.min, config.max);
    if (!opts.force && states[group] === clamped) return clamped;

    states[group] = clamped;
    try {
      if (window.localStorage) {
        window.localStorage.setItem(config.storageKey, String(clamped));
      }
    } catch (_) {
      // ignore storage errors
    }
    updateGroupUI(group);
    if (group === "flow") {
      syncPrototypeFlowToDocument();
      const fiCfg = STATE_CONFIGS.financeIntro;
      const introEffective =
        states.financeIntro ??
        (typeof fiCfg?.initial === "number" ? fiCfg.initial : fiCfg.min);
      if (clamped > 1 && introEffective !== 2) {
        setState("financeIntro", 2, { force: true });
      }
      syncFinanceSummaryVisibility();
      syncMyPlansFlowUi();
      applyFinanceSummaryMeta();
    }
    if (group === "financeIntro") {
      syncFinanceIntroState();
    }
    if (group === "funding") {
      if (clamped < 3) {
        const clearPrefundFromRecord = (rec) => {
          if (!rec || typeof rec !== "object") return rec;
          return {
            ...rec,
            isReserved: false,
            fundingMethod: "Pay as you go",
          };
        };
        if (myPlansSubmittedPlan)
          myPlansSubmittedPlan = clearPrefundFromRecord(myPlansSubmittedPlan);
        if (myPlansPrefillPlan)
          myPlansPrefillPlan = clearPrefundFromRecord(myPlansPrefillPlan);
      }
      syncPrototypeFundingToDocument();
      syncMyPlansFlowUi();
      applyFinanceSummaryMeta();
    }
    return clamped;
  };

  const changeState = (group, delta) =>
    setState(group, states[group] + (delta || 0));

  const initStates = () => {
    Object.keys(STATE_CONFIGS).forEach((group) => {
      const config = STATE_CONFIGS[group];
      const rawInitial =
        typeof config.initial === "number" ? config.initial : config.min;
      const clamped = clamp(rawInitial, config.min, config.max);
      states[group] = clamped;
      try {
        if (window.localStorage) {
          window.localStorage.setItem(config.storageKey, String(clamped));
        }
      } catch (_) {
        // ignore storage errors
      }
      updateGroupUI(group);
    });
    syncPrototypeFlowToDocument();
    syncPrototypeFundingToDocument();
    syncFinanceSummaryVisibility();
    syncFinanceIntroState();
  };

  const initAuthSignup = () => {
    const page = document.querySelector("[data-auth-signup-page]");
    if (!page) return;

    const phoneContainer = document.querySelector(".phone-container");
    const scrollEl = page.querySelector(".auth-signup-page__scroll");
    const heroTrack = page.querySelector("[data-auth-signup-hero-track]");

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

    const buildSignupHeroLoop = () => {
      const loop = document.createElement("div");
      loop.className = "auth-signup__hero-loop";
      signupHeroRows.forEach((rowIcons) => {
        const row = document.createElement("div");
        row.className = "auth-signup__hero-row";
        rowIcons.forEach((icon) => {
          const coin = document.createElement("div");
          coin.className = "auth-signup__hero-coin";
          const img = document.createElement("img");
          img.src = `assets/${icon}`;
          img.alt = "";
          coin.appendChild(img);
          row.appendChild(coin);
        });
        loop.appendChild(row);
      });
      return loop;
    };

    if (heroTrack && !heroTrack.childElementCount) {
      heroTrack.appendChild(buildSignupHeroLoop());
      heroTrack.appendChild(buildSignupHeroLoop());
    }

    const open = (opts = {}) => {
      if (!opts.skipMenuClose) {
        phoneContainer?.classList.remove("is-menu-open");
      }
      page.hidden = false;
      if (scrollEl) scrollEl.scrollTop = 0;
      requestAnimationFrame(() => page.classList.add("is-open"));
    };

    const openFromSideMenu = () => {
      phoneContainer?.classList.remove("is-menu-open");
      window.setTimeout(() => open({ skipMenuClose: true }), 280);
    };

    let snackbarTimeout = null;
    const showSnackbar = (message) => {
      const snackbar = phoneContainer?.querySelector("[data-snackbar]");
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
    const SIGNUP_MOBILE_COUNTRY_CODE = "+886";
    const formatMobileDisplay = (localNumber) =>
      `${SIGNUP_MOBILE_COUNTRY_CODE} ${(localNumber || SIGNUP_DUMMY_MOBILE).trim()}`;
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
      const focusedEl = emailPage?.querySelector(
        '[data-auth-signup-password-field].is-focused',
      );
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

    const syncSignupActionLabels = () => {
      if (
        window.__hybridSignup?.isActive?.() &&
        window.__hybridSignup?.isManagedStep?.()
      ) {
        return;
      }
      const sendCodeStep = signupEmailStep === "email" || signupEmailStep === "mobile";
      const label = sendCodeStep ? "Send code" : "Continue";
      if (emailContinueBtn) emailContinueBtn.textContent = label;
      if (keyboardContinueBtn) keyboardContinueBtn.textContent = label;
    };

    const syncActionButtons = () => {
      if (
        window.__hybridSignup?.isActive?.() &&
        window.__hybridSignup?.isManagedStep?.()
      ) {
        window.__hybridSignup.syncActionUi?.();
        return;
      }
      syncSignupActionLabels();
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

    const showSignupCodeLoader = (onComplete = advanceToMobileStep) => {
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
      window.__hybridSignup?.syncFlowVisibility?.();
      if (window.__hybridSignup?.isActive?.()) {
        window.__hybridSignup.resetHybridVerify?.();
        syncStepperUi();
        return;
      }
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

    const showPasswordStepUi = () => {
      signupEmailStep = "password";
      emailPage?.classList.remove(
        "is-code-step",
        "is-mobile-step",
        "is-mobile-code-step",
        "is-hybrid-code-active",
        "is-hybrid-mobile-code-active",
      );
      emailPage?.classList.add("is-password-step");
      if (emailPanel) emailPanel.hidden = true;
      if (codePanel) codePanel.hidden = true;
      if (mobilePanel) mobilePanel.hidden = true;
      if (mobileCodePanel) mobileCodePanel.hidden = true;
      syncStepperUi();
      syncKeyboardStickyUi();
      resetPasswordFields();
      if (emailContinueBtn) emailContinueBtn.hidden = false;
      syncActionButtons();
      hideSignupEmailKeyboard();
      window.setTimeout(() => {
        focusSignupPassword("primary");
        showSignupEmailKeyboard();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    };

    const showMobileStepUi = ({ resetMobile = false } = {}) => {
      if (window.__hybridSignup?.isActive?.()) {
        signupEmailStep = "mobile";
        emailPage?.classList.remove("is-code-step", "is-password-step", "is-mobile-code-step");
        emailPage?.classList.add("is-mobile-step");
        if (emailPanel) emailPanel.hidden = true;
        if (codePanel) codePanel.hidden = true;
        if (mobilePanel) mobilePanel.hidden = true;
        if (mobileCodePanel) mobileCodePanel.hidden = true;
        syncStepperUi();
        window.__hybridSignup.setPhase?.("mobile");
        window.__hybridSignup.openMobileStep?.();
        return;
      }
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
        mobileDisplay.textContent = formatMobileDisplay(mobileInput?.value.trim());
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
      hideSignupCodeLoader();
      resetMobileField();
      resetMobileCodeField();
      if (window.__hybridSignup?.isActive?.()) {
        signupEmailStep = "code";
        window.__hybridSignup.handleBackFromMobile?.();
        return;
      }
      showCodeStepUi({ resetCode: false });
    };

    const returnToMobileStep = () => {
      hideSignupCodeLoader();
      unfocusMobileCodeEntry();
      showMobileStepUi();
      focusSignupMobile();
      syncSignupEmailKeyboardVisible();
    };

    const advanceToPasswordStep = () => {
      if (signupEmailStep !== "mobile-code") return;
      showPasswordStepUi();
    };

    const returnFromPasswordStep = () => {
      hideSignupCodeLoader();
      resetPasswordFields();
      if (mobileInput?.value.trim()) {
        showMobileCodeStepUi({ resetCode: false });
        return;
      }
      showMobileStepUi();
    };

    const resetSignupEmailPageState = () => {
      hideSignupCodeLoader();
      window.__hybridSignup?.resetHybridMobile?.();
      window.__hybridSignup?.resetHybridVerify?.();
      showEmailStepUi();
      resetEmailField();
      resetCodeField();
      resetPasswordFields();
      resetMobileField();
      resetMobileCodeField();
    };

    const resetSignupFlowForMergeModeSwitch = () => {
      window.__hybridSignup?.syncFlowVisibility?.();

      if (!emailPage?.classList.contains("is-open")) return;

      hideSignupCodeLoader();
      window.__hybridSignup?.hideCodeLoader?.();
      hideSignupEmailKeyboard();
      phoneContainer?.classList.remove(
        "is-fake-keyboard-signup-email-visible",
        "is-fake-keyboard-signup-email-dismissing",
      );

      let slide = "verify";
      if (
        signupEmailStep === "password" ||
        emailPage.classList.contains("is-password-step")
      ) {
        slide = "password";
      } else if (
        signupEmailStep === "mobile" ||
        signupEmailStep === "mobile-code" ||
        emailPage.classList.contains("is-mobile-step")
      ) {
        slide = "mobile";
      }

      resetEmailField();
      resetCodeField();
      resetPasswordFields();
      resetMobileField();
      resetMobileCodeField();
      window.__hybridSignup?.resetHybridMobile?.();
      window.__hybridSignup?.resetHybridVerify?.();

      emailPage.classList.remove(
        "is-code-step",
        "is-hybrid-code-active",
        "is-hybrid-mobile-code-active",
        "is-mobile-code-step",
        "is-password-step",
        "is-mobile-step",
      );

      if (slide === "password") {
        showPasswordStepUi();
        return;
      }

      if (slide === "mobile") {
        showMobileStepUi({ resetMobile: true });
        return;
      }

      showEmailStepUi();
      if (window.__hybridSignup?.isActive?.()) {
        window.__hybridSignup.openEmailStep?.();
        return;
      }

      window.setTimeout(() => {
        focusSignupEmail();
        showSignupEmailKeyboard();
      }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
    };

    window.__resetSignupFlowForMergeModeSwitch = resetSignupFlowForMergeModeSwitch;
    window.__syncProgSignupActionLabels = syncSignupActionLabels;

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
      document.dispatchEvent(new CustomEvent("fake-keyboard-hide"));
      document.dispatchEvent(new CustomEvent("fake-keyboard-alloc-hide"));
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
      showSignupCodeLoader(advanceToPasswordStep);
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
      if (window.__hybridSignup?.dismissFromOutside?.()) return;
      if (!signupEmailKeyboard?.classList.contains("is-visible")) return;
      hideSignupEmailKeyboard();
      if (signupEmailStep === "code") unfocusCodeEntry();
      else if (signupEmailStep === "mobile-code") unfocusMobileCodeEntry();
      else if (signupEmailStep === "password") unfocusAllPasswordFields();
      else if (signupEmailStep === "mobile") unfocusSignupMobile();
      else unfocusSignupEmailField();
    };

    const dismissSignupEmailKeyboardUi = () => {
      if (window.__hybridSignup?.handleKeyboardDismiss?.()) return;
      hideSignupEmailKeyboard();
      if (signupEmailStep === "code") unfocusCodeEntry();
      else if (signupEmailStep === "mobile-code") unfocusMobileCodeEntry();
      else if (signupEmailStep === "password") unfocusAllPasswordFields();
      else if (signupEmailStep === "mobile") unfocusSignupMobile();
      else unfocusSignupEmailField();
    };

    const handleSignupPrimaryAction = () => {
      if (window.__hybridSignup?.handleFooterClick?.()) return;
      if (signupEmailStep === "email") {
        if (!emailInput?.value.trim()) return;
        advanceToCodeStep();
        return;
      }
      if (signupEmailStep === "password") {
        if (!isPasswordStepComplete()) return;
        showNotInPrototype();
        return;
      }
      if (signupEmailStep === "mobile") {
        if (mobileInput?.value.trim() !== SIGNUP_DUMMY_MOBILE) return;
        advanceToMobileCodeStep();
      }
    };

    const handleEmailBack = () => {
      if (window.__hybridSignup?.handleBack?.()) return;
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

    const closeEmailPage = (opts = {}) => {
      if (!emailPage || (!emailPage.classList.contains("is-open") && emailPage.hidden)) return;
      hideSignupEmailKeyboard();
      if (opts.instant) {
        emailPage.classList.remove("is-open");
        emailPage.hidden = true;
        resetSignupEmailPageState();
        return;
      }
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
      window.__hybridSignup?.syncFlowVisibility?.();
      resetSignupEmailPageState();
      emailPage.hidden = false;
      requestAnimationFrame(() => {
        emailPage.classList.add("is-open");
        if (window.__hybridSignup?.isActive?.()) {
          window.__hybridSignup.openEmailStep?.();
          return;
        }
        window.setTimeout(() => {
          focusSignupEmail();
          showSignupEmailKeyboard();
        }, SIGNUP_EMAIL_KEYBOARD_DELAY_MS);
      });
    };

    const close = (opts = {}) => {
      closeEmailPage({ instant: true });
      if (!page.classList.contains("is-open") && page.hidden) return;
      if (opts.instant) {
        page.classList.remove("is-open");
        page.hidden = true;
        return;
      }
      page.classList.remove("is-open");
      const onEnd = () => {
        if (!page.classList.contains("is-open")) page.hidden = true;
        page.removeEventListener("transitionend", onEnd);
      };
      page.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 320);
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
      window.__hybridSignupAdvanceMobile = () => showMobileStepUi({ resetMobile: true });
      window.__hybridSignupAdvancePassword = () => showPasswordStepUi();
      window.__hybridSignupShowNotInPrototype = () => showNotInPrototype();
      emailPage
        .querySelector("[data-auth-signup-email-back]")
        ?.addEventListener("click", handleEmailBack);
      emailField?.addEventListener("click", handleEmailFieldInteraction);
      emailContinueBtn?.addEventListener("click", handleSignupPrimaryAction);
      keyboardContinueBtn?.addEventListener("click", () => {
        if (window.__hybridSignup?.handleKeyboardPrimary?.()) return;
        handleSignupPrimaryAction();
      });
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
        if (!(e.target instanceof Element)) return;

        if (window.__hybridSignup?.isActive?.()) {
          if (window.__hybridSignup.isProtectedTarget?.(e.target)) return;
          if (window.__hybridSignup.dismissFromOutside?.()) return;
        }

        if (!signupEmailKeyboard?.classList.contains("is-visible")) return;
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
        dismissSignupEmailKeyboardFromOutside();
      });
    }

    document
      .querySelectorAll("[data-home-visitor-cta], [data-visitor-login-cta]")
      .forEach((cta) => {
        cta.addEventListener("click", () => {
          if (cta.closest(".side-menu")) {
            openFromSideMenu();
            return;
          }
          open();
        });
      });

    document.addEventListener("auth-signup-open", () => open());

    page
      .querySelector("[data-auth-signup-close]")
      ?.addEventListener("click", () => close());

    page
      .querySelector("[data-auth-signup-login]")
      ?.addEventListener("click", showNotInPrototype);
    page
      .querySelector("[data-auth-signup-corporate]")
      ?.addEventListener("click", showNotInPrototype);
    page
      .querySelector("[data-auth-signup-continue]")
      ?.addEventListener("click", openEmailPage);
  };

  const initBadgeControls = () => {
    const badge = document.querySelector(".build-badge");
    if (!badge) return;
    const header = badge.querySelector(".build-badge__header");
    const body = badge.querySelector(".build-badge__body");
    const toggleCollapse = () => {
      const isCollapsed = badge.classList.toggle("is-collapsed");
      if (header) header.setAttribute("aria-expanded", String(!isCollapsed));
      if (body) body.hidden = false;
    };

    if (header) {
      header.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleCollapse();
      });
    }

    badge.addEventListener("click", (event) => {
      if (!badge.classList.contains("is-collapsed")) return;
      if (event.target.closest("[data-state-action]")) return;
      toggleCollapse();
    });

    badge.addEventListener("click", (event) => {
      const button = event.target.closest("[data-state-action]");
      if (!button) return;
      const groupEl = button.closest("[data-state-group]");
      if (!groupEl) return;
      const group = groupEl.getAttribute("data-state-group");
      if (!STATE_CONFIGS[group]) return;

      const action = button.getAttribute("data-state-action");
      if (action === "down") changeState(group, -1);
      if (action === "up") changeState(group, 1);
    });
  };

  const syncContentShellClass = () => {
    const el = document.querySelector("[data-content]");
    if (!el) return;
    const main = String(
      document.documentElement.dataset.activeTab || "home",
    ).toLowerCase();
    Array.from(el.classList).forEach((c) => {
      if (c.startsWith("content--")) el.classList.remove(c);
    });
    el.classList.add(`content--${main}`);
    if (main === "finance") {
      const sub = String(
        document.documentElement.dataset.financePage || "",
      ).toLowerCase();
      if (sub) el.classList.add(`content--finance--${sub}`);
    } else if (main === "trade") {
      const sub = String(
        document.documentElement.dataset.tradePage || "",
      ).toLowerCase();
      if (sub) el.classList.add(`content--trade--${sub}`);
    }
  };

  const initTabs = () => {
    const content = document.querySelector("[data-content]");
    const tabButtons = Array.from(
      document.querySelectorAll("[data-tab-target]"),
    );
    const tabViews = Array.from(document.querySelectorAll("[data-tab-view]"));
    const openTabTriggers = Array.from(
      document.querySelectorAll("[data-open-tab]"),
    );
    const tradeQuickMenuSheet = document.querySelector(
      "[data-trade-quick-menu-sheet]",
    );
    const tradeQuickMenuPanel = tradeQuickMenuSheet?.querySelector(
      ".currency-sheet__panel",
    );
    const phoneContainer = document.querySelector(".phone-container");
    const tabbarEl = document.querySelector(".tabbar");
    const tradeFabBtn = document.querySelector(
      '.tabbar__fab[data-tab-target="trade"]',
    );
    const tradeFabIcon = tradeFabBtn?.querySelector(
      "img[data-src-active][data-src-inactive]",
    );
    const triggerTabIconPulse = (btn) => {
      if (!btn || btn.classList.contains("tabbar__item--trade")) return;
      const icon = btn.querySelector("img");
      if (!icon) return;
      icon.classList.remove("is-press-pulse");
      void icon.offsetWidth;
      icon.classList.add("is-press-pulse");
      window.setTimeout(() => {
        icon.classList.remove("is-press-pulse");
      }, 230);
    };
    let tradeFabRestoreTimer = null;
    const attachTradeFabFloating = () => {
      if (!tradeFabBtn || !phoneContainer) return;
      if (tradeFabRestoreTimer) {
        clearTimeout(tradeFabRestoreTimer);
        tradeFabRestoreTimer = null;
      }
      tradeFabBtn.classList.add("tabbar__fab--floating");
      phoneContainer.appendChild(tradeFabBtn);
    };
    const restoreTradeFabInlineDelayed = (delayMs = 500) => {
      if (!tradeFabBtn || !tabbarEl) return;
      if (tradeFabRestoreTimer) clearTimeout(tradeFabRestoreTimer);
      tradeFabRestoreTimer = setTimeout(() => {
        tradeFabRestoreTimer = null;
        tradeFabBtn.classList.remove("tabbar__fab--floating");
        tabbarEl.appendChild(tradeFabBtn);
      }, delayMs);
    };
    const animateTradeIconSwap = (icon, nextSrc) => {
      if (!icon || !nextSrc) return;
      const currentSrc = String(icon.getAttribute("src") || "").trim();
      if (!currentSrc || currentSrc === nextSrc) {
        icon.setAttribute("src", nextSrc);
        return;
      }
      const token = String((Number(icon.dataset.tradeAnimToken || "0") || 0) + 1);
      icon.dataset.tradeAnimToken = token;
      try {
        const parent = icon.parentElement;
        if (!parent) {
          icon.setAttribute("src", nextSrc);
          return;
        }
        icon.getAnimations?.().forEach((anim) => anim.cancel());
        Array.from(parent.querySelectorAll(".tabbar__icon-swap-outgoing")).forEach(
          (el) => el.remove(),
        );
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.position === "static") parent.style.position = "relative";

        const outgoing = icon.cloneNode(true);
        outgoing.classList.add("tabbar__icon-swap-outgoing");
        outgoing.style.position = "absolute";
        outgoing.style.left = "50%";
        outgoing.style.top = "50%";
        outgoing.style.transform = "translate(-50%, -50%) rotate(0deg)";
        outgoing.style.opacity = "1";
        outgoing.style.pointerEvents = "none";
        outgoing.style.zIndex = "1";
        parent.appendChild(outgoing);

        icon.setAttribute("src", nextSrc);
        icon.style.opacity = "0";
        icon.style.transform = "rotate(-45deg)";

        const transformDuration = 200;
        const opacityDuration = 150;
        const shortDelay = 40;
        const longDelay = 100;
        const easing = "ease";
        const outTransformAnim = outgoing.animate(
          [
            { transform: "translate(-50%, -50%) rotate(0deg)" },
            { transform: "translate(-50%, -50%) rotate(-45deg)" },
          ],
          { duration: transformDuration, easing, fill: "forwards" },
        );
        const outOpacityAnim = outgoing.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: opacityDuration, easing, fill: "forwards", delay: shortDelay },
        );
        const inTransformAnim = icon.animate(
          [{ transform: "rotate(-45deg)" }, { transform: "rotate(0deg)" }],
          {
            duration: transformDuration,
            easing,
            fill: "both"
          },
        );
        const inOpacityAnim = icon.animate(
          [
            { opacity: 0 },
            { opacity: 1 },
          ],
          { duration: opacityDuration, easing, fill: "both", delay: shortDelay },
        );
        const cleanup = () => {
          if (icon.dataset.tradeAnimToken !== token) return;
          outgoing.remove();
          icon.style.opacity = "";
          icon.style.transform = "";
        };
        outTransformAnim.addEventListener("finish", cleanup, { once: true });
        outOpacityAnim.addEventListener("finish", cleanup, { once: true });
        inTransformAnim.addEventListener("finish", cleanup, { once: true });
        inOpacityAnim.addEventListener("finish", cleanup, { once: true });
      } catch {
        icon.setAttribute("src", nextSrc);
      }
    };
    const syncTradeQuickMenuSelection = () => {
      const activeTradePage = String(
        document.documentElement.dataset.tradePage || "spot",
      )
        .trim()
        .toLowerCase();
      Array.from(
        tradeQuickMenuSheet?.querySelectorAll("[data-trade-quick-menu-action]") ||
          [],
      ).forEach((row) => {
        const action = String(
          row.getAttribute("data-trade-quick-menu-action") || "",
        )
          .trim()
          .toLowerCase();
        const isActive = action === activeTradePage;
        const radio = row.querySelector(".trade-qm-sheet__radio");
        if (radio) radio.hidden = !isActive;
      });
    };
    const setTradeFabQuickMenuMode = (isOpen) => {
      if (!tradeFabBtn || !tradeFabIcon) return;
      tradeFabBtn.classList.toggle("is-qm-open", !!isOpen);
      const activeTabNow = String(
        document.documentElement.dataset.activeTab || "",
      ).toLowerCase();
      const nextSrc = isOpen
        ? "assets/icon_qm_close.svg"
        : activeTabNow === "trade"
          ? String(tradeFabIcon.dataset.srcActive || "")
          : String(tradeFabIcon.dataset.srcInactive || "");
      if (nextSrc) animateTradeIconSwap(tradeFabIcon, nextSrc);
    };

    if (!content || tabViews.length === 0) {
      return { setActiveTab: () => {} };
    }

    const openTradeQuickMenu = () => {
      if (!tradeQuickMenuSheet || tradeQuickMenuSheet.classList.contains("is-open"))
        return;
      attachTradeFabFloating();
      syncTradeQuickMenuSelection();
      phoneContainer?.classList.add("is-trade-qm-open");
      setTradeFabQuickMenuMode(true);
      tradeQuickMenuSheet.hidden = false;
      requestAnimationFrame(() => {
        tradeQuickMenuSheet.classList.add("is-open");
      });
    };

    const closeTradeQuickMenu = () => {
      if (!tradeQuickMenuSheet) return;
      setTradeFabQuickMenuMode(false);
      if (!tradeQuickMenuSheet.classList.contains("is-open")) {
        tradeQuickMenuSheet.hidden = true;
        phoneContainer?.classList.remove("is-trade-qm-open");
        restoreTradeFabInlineDelayed(0);
        return;
      }
      tradeQuickMenuSheet.classList.remove("is-open");
      const onEnd = () => {
        if (!tradeQuickMenuSheet.classList.contains("is-open")) {
          tradeQuickMenuSheet.hidden = true;
          phoneContainer?.classList.remove("is-trade-qm-open");
          restoreTradeFabInlineDelayed(0);
        }
        tradeQuickMenuPanel?.removeEventListener("transitionend", onEnd);
      };
      tradeQuickMenuPanel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    tradeQuickMenuSheet
      ?.querySelectorAll("[data-trade-quick-menu-close]")
      .forEach((btn) => btn.addEventListener("click", closeTradeQuickMenu));
    tradeQuickMenuSheet
      ?.querySelectorAll("[data-trade-quick-menu-action]")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const action = String(
            btn.getAttribute("data-trade-quick-menu-action") || "",
          )
            .trim()
            .toLowerCase();
          closeTradeQuickMenu();
          if (
            action === "spot" ||
            action === "margin" ||
            action === "grid" ||
            action === "convert"
          ) {
            document.dispatchEvent(
              new CustomEvent("trade-qm-select", { detail: { action } }),
            );
          }
        }),
      );
    document.addEventListener("trade-page-changed", syncTradeQuickMenuSelection);

    const setActiveTab = (tabId) => {
      const prevActiveTab = String(
        document.documentElement.dataset.activeTab || "",
      );
      document.documentElement.dataset.activeTab = tabId;
      const pageTitleEl = document.querySelector("[data-app-header-page-title]");
      const financeTabsEl = document.querySelector("[data-app-header-tabs-finance]");
      const tradeTabsEl = document.querySelector("[data-app-header-tabs-trade]");
      const normalizedTabId = String(tabId || "").toLowerCase();
      const pageTitles = {
        finance: "Finance",
        trade: "Trade",
        markets: "Markets",
        wallet: "Wallet",
      };
      const isFinance = normalizedTabId === "finance";
      const isTrade = String(tabId || "") === "trade";
      if (pageTitleEl)
        pageTitleEl.textContent = pageTitles[normalizedTabId] || "Finance";
      if (financeTabsEl) financeTabsEl.hidden = !isFinance;
      if (tradeTabsEl) tradeTabsEl.hidden = !isTrade;
      if (!isTrade) closeTradeQuickMenu();
      tabViews.forEach((view) => {
        const isActive = view.getAttribute("data-tab-view") === tabId;
        view.hidden = !isActive;
      });
      tabButtons.forEach((btn) => {
        const isActive = btn.getAttribute("data-tab-target") === tabId;
        btn.classList.toggle("is-active", isActive);

        const icon = btn.querySelector(
          "img[data-src-active][data-src-inactive]",
        );
        if (icon) {
          const nextSrc = isActive
            ? icon.dataset.srcActive
            : icon.dataset.srcInactive;
          const currentSrc = String(icon.getAttribute("src") || "").trim();
          const isTradeTabButton =
            btn.getAttribute("data-tab-target") === "trade";
          const isTradeTransition =
            (tabId === "trade") !== (prevActiveTab === "trade");
          const shouldAnimateTradeIcon =
            isTradeTabButton &&
            isTradeTransition &&
            !!nextSrc &&
            currentSrc !== nextSrc;
          if (nextSrc && shouldAnimateTradeIcon) {
            animateTradeIconSwap(icon, nextSrc);
          } else if (nextSrc && currentSrc !== nextSrc) {
            icon.src = nextSrc;
          }
        }
      });
      content.scrollTop = 0;
      syncContentShellClass();
      requestAnimationFrame(syncTopChromeHeight);
      if (normalizedTabId === "finance") ensureFinanceModulesInited();
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const next = btn.getAttribute("data-tab-target");
        const active = String(document.documentElement.dataset.activeTab || "");
        if (
          btn.classList.contains("tabbar__item") &&
          next !== "trade" &&
          next !== active
        ) {
          triggerTabIconPulse(btn);
        }
        if (
          next === "trade" &&
          active === "trade" &&
          btn.classList.contains("tabbar__fab") &&
          tradeQuickMenuSheet?.classList.contains("is-open")
        ) {
          closeTradeQuickMenu();
          return;
        }
        if (next === "trade" && active === "trade") {
          openTradeQuickMenu();
          return;
        }
        if (next === "wallet") {
          document.dispatchEvent(new CustomEvent("auth-signup-open"));
          return;
        }
        setActiveTab(next);
      });
    });
    Array.from(
      document.querySelectorAll(
        '.tabbar__item:not(.tabbar__item--trade):not([data-tab-target])',
      ),
    ).forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.classList.contains("is-active")) return;
        triggerTabIconPulse(btn);
      });
    });

    const openFinance = () => setActiveTab("finance");
    openTabTriggers.forEach((el) => {
      el.addEventListener("click", openFinance);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFinance();
        }
      });
    });

    setActiveTab("home");
    syncTopChromeHeight();
    window.addEventListener("resize", () => syncTopChromeHeight(), {
      passive: true,
    });
    return { setActiveTab };
  };

  const initFinanceHeaderTabs = () => {
    const wrap = document.querySelector("[data-app-header-tabs-finance]");
    const tabButtons = Array.from(
      wrap?.querySelectorAll?.("[data-finance-header-tab]") || [],
    );
    const allPages = Array.from(document.querySelectorAll("[data-finance-page]"));
    if (tabButtons.length === 0 || allPages.length === 0) {
      return { setFinancePage: () => {} };
    }

    const setPage = (pageId) => {
      document.documentElement.dataset.financePage = pageId;
      tabButtons.forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-finance-header-tab") === pageId,
        );
      });
      const activeTab = String(
        document.documentElement.dataset.activeTab || "home",
      );
      const activeView = document.querySelector(
        `[data-tab-view="${CSS.escape(activeTab)}"]`,
      );
      const scopedPages = activeView
        ? Array.from(activeView.querySelectorAll("[data-finance-page]"))
        : allPages;
      scopedPages.forEach((page) => {
        page.hidden = page.getAttribute("data-finance-page") !== pageId;
      });
      const content = document.querySelector("[data-content]");
      if (content) content.scrollTop = 0;
      syncContentShellClass();
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () =>
        setPage(btn.getAttribute("data-finance-header-tab")),
      );
    });

    wrap
      ?.querySelector("[data-finance-header-discover]")
      ?.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("auth-signup-open"));
      });

    setPage("auto");
    return { setFinancePage: setPage };
  };

  const initTradeHeaderTabs = () => {
    const wrap = document.querySelector("[data-app-header-tabs-trade]");
    const tabButtons = Array.from(
      wrap?.querySelectorAll?.("[data-trade-header-tab]") || [],
    );
    const pages = Array.from(document.querySelectorAll("[data-trade-page]"));
    if (tabButtons.length === 0 || pages.length === 0) {
      return { setTradePage: () => {} };
    }

    const setPage = (pageId) => {
      document.documentElement.dataset.tradePage = pageId;
      tabButtons.forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-trade-header-tab") === pageId,
        );
      });
      const tradeView = document.querySelector('[data-tab-view="trade"]');
      const scopedPages = tradeView
        ? Array.from(tradeView.querySelectorAll("[data-trade-page]"))
        : pages;
      scopedPages.forEach((page) => {
        page.hidden = page.getAttribute("data-trade-page") !== pageId;
      });
      document.dispatchEvent(
        new CustomEvent("trade-page-changed", { detail: { pageId } }),
      );
      if (pageId === "convert") ensureConvertModulesInited();
      const content = document.querySelector("[data-content]");
      if (content) content.scrollTop = 0;
      syncContentShellClass();
    };

    tabButtons.forEach((btn) => {
      btn.addEventListener("click", () =>
        setPage(btn.getAttribute("data-trade-header-tab")),
      );
    });

    setPage("spot");
    return { setTradePage: setPage };
  };

  const initMarketsPage = () => {
    const noopApi = { openMarketsCategory: () => {} };
    const categories = document.querySelector("[data-markets-categories]");
    const track = document.querySelector("[data-markets-categories-track]");
    const marketContent = document.querySelector("[data-markets-market-content]");
    const favoritesEmpty = document.querySelector("[data-markets-favorites-empty]");
    if (!categories || !track) return noopApi;

    let pendingMarketsCategory = null;

    const MARKETS_CATEGORIES = [
      { key: "all", label: "All" },
      { key: "favorite", label: "Favorites" },
      { key: "spotlight", label: "Spotlight" },
      { key: "gainers", label: "Gainers" },
      { key: "losers", label: "Losers" },
      { key: "new", label: "New" },
      { key: "ai", label: "AI" },
      { key: "gold", label: "Gold" },
      { key: "rwa", label: "RWA" },
      { key: "layer_1", label: "L1" },
      { key: "layer_2", label: "L2" },
      { key: "meme", label: "Meme" },
      { key: "stablecoin", label: "Stablecoin" },
      { key: "defi", label: "DeFi" },
      { key: "gaming", label: "Gaming" },
      { key: "restaking", label: "Restaking" },
      { key: "nft", label: "NFT" },
      { key: "metaverse", label: "Metaverse" },
      { key: "storage", label: "Storage" },
    ];

    const categoryIconSrc = (key, active) =>
      `assets/icon_coincategories_${key}_${active ? "active" : "inactive"}.svg`;

    const scrollMarketsCategoryIntoView = (btn) => {
      if (!categories || !btn) return;
      const maxScroll = categories.scrollWidth - categories.clientWidth;
      if (maxScroll <= 0) return;
      const scrollerRect = categories.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const btnLeft = btnRect.left - scrollerRect.left + categories.scrollLeft;
      const btnCenter = btnLeft + btnRect.width / 2;
      const targetLeft = btnCenter - categories.clientWidth / 2;
      categories.scrollTo({
        left: Math.min(maxScroll, Math.max(0, targetLeft)),
        behavior: "smooth",
      });
    };

    const syncCategoryIcons = () => {
      track.querySelectorAll("[data-markets-cat]").forEach((btn) => {
        const key = btn.getAttribute("data-markets-cat");
        const img = btn.querySelector(".markets-page__cat-icon img");
        if (!key || !img) return;
        img.src = categoryIconSrc(key, btn.classList.contains("is-active"));
      });
    };

    if (!track.childElementCount) {
      MARKETS_CATEGORIES.forEach(({ key, label }, index) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `markets-page__cat${index === 0 ? " is-active" : ""}`;
        btn.setAttribute("data-markets-cat", key);
        btn.innerHTML = `
          <span class="markets-page__cat-icon">
            <img src="${categoryIconSrc(key, index === 0)}" alt="" />
          </span>
          <span class="markets-page__cat-label">${label}</span>
        `;
        track.appendChild(btn);
      });
    }

    const setCategoryView = (key) => {
      const isFavorites = key === "favorite";
      if (marketContent) marketContent.hidden = isFavorites;
      if (favoritesEmpty) favoritesEmpty.hidden = !isFavorites;
    };

    const activateCategory = (key, { scrollIntoView = true } = {}) => {
      if (key === "favorite") {
        document.dispatchEvent(new CustomEvent("auth-signup-open"));
        return;
      }
      track.querySelectorAll("[data-markets-cat]").forEach((item) => {
        item.classList.toggle("is-active", item.getAttribute("data-markets-cat") === key);
      });
      syncCategoryIcons();
      setCategoryView(key);
      applyCategoryFilter(key);
      if (scrollIntoView) {
        const btn = track.querySelector(`[data-markets-cat="${CSS.escape(key)}"]`);
        if (key === "all") {
          categories.scrollTo({ left: 0, behavior: "smooth" });
        } else if (btn) {
          scrollMarketsCategoryIntoView(btn);
        }
      }
    };

    const marketsList = document.querySelector(".markets-page__list");
    const marketRows = marketsList
      ? [...marketsList.querySelectorAll(".markets-page__row")]
      : [];
    const defaultRowOrder = [...marketRows];
    const FILTERED_CATEGORY_SYMBOLS = new Set(["BTC", "ETH", "XRP"]);
    let activeCategory = "all";

    const sortDirectionBtn = document.querySelector("[data-markets-sort-direction]");
    const sortDirectionIcon = sortDirectionBtn?.querySelector("[data-markets-sort-direction-icon]");
    const sortIcons = {
      desc: "assets/icon_sort_1.svg",
      asc: "assets/icon_sort_2.svg",
    };
    let sortDirection = "desc";

    const getRowSymbol = (row) =>
      row.querySelector(".markets-page__row-symbol")?.textContent?.trim() || "";

    const applyFullListOrder = () => {
      if (!marketsList) return;
      const ordered = sortDirection === "asc" ? [...defaultRowOrder].reverse() : defaultRowOrder;
      ordered.forEach((row) => marketsList.appendChild(row));
    };

    const applyCategoryFilter = (key) => {
      const wasAll = activeCategory === "all";
      activeCategory = key;
      const isAll = key === "all";
      const filterToThree = !isAll;

      if (isAll && !wasAll) {
        applyFullListOrder();
      }

      marketRows.forEach((row) => {
        row.hidden = filterToThree && !FILTERED_CATEGORY_SYMBOLS.has(getRowSymbol(row));
      });
    };

    const reverseMarketListOrder = () => {
      if (!marketsList) return;
      const rows = [...marketsList.querySelectorAll(".markets-page__row")];
      const visible = rows.filter((row) => !row.hidden);
      const hidden = rows.filter((row) => row.hidden);
      const ordered = activeCategory === "all" ? rows.reverse() : [...visible.reverse(), ...hidden];
      ordered.forEach((row) => marketsList.appendChild(row));
    };

    const resetMarketsPage = () => {
      sortDirection = "desc";
      if (sortDirectionIcon && sortDirectionBtn) {
        sortDirectionIcon.src = sortIcons.desc;
        sortDirectionBtn.setAttribute("aria-pressed", "false");
        sortDirectionBtn.setAttribute("aria-label", "Sort descending");
      }

      if (marketsList) {
        defaultRowOrder.forEach((row) => marketsList.appendChild(row));
      }
      marketRows.forEach((row) => {
        row.hidden = false;
      });

      const category = pendingMarketsCategory || "all";
      pendingMarketsCategory = null;

      track.querySelectorAll("[data-markets-cat]").forEach((item) => {
        item.classList.toggle("is-active", item.getAttribute("data-markets-cat") === category);
      });
      syncCategoryIcons();
      setCategoryView(category);
      applyCategoryFilter(category);
      const categoryBtn = track.querySelector(
        `[data-markets-cat="${CSS.escape(category)}"]`,
      );
      if (category === "all") {
        categories.scrollTo({ left: 0, behavior: "smooth" });
      } else if (categoryBtn) {
        requestAnimationFrame(() => scrollMarketsCategoryIntoView(categoryBtn));
      }

      const contentScroller = document.querySelector(".content");
      if (contentScroller) contentScroller.scrollTop = 0;

      const stickyDivider = document.querySelector(".markets-page__sticky-divider");
      if (stickyDivider) stickyDivider.style.opacity = "0";
    };

    syncCategoryIcons();
    setCategoryView("all");
    applyCategoryFilter("all");

    track.querySelectorAll("[data-markets-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activateCategory(btn.getAttribute("data-markets-cat") || "all");
      });
    });

    if (sortDirectionBtn && sortDirectionIcon && marketsList) {
      sortDirectionBtn.addEventListener("click", () => {
        sortDirection = sortDirection === "desc" ? "asc" : "desc";
        sortDirectionIcon.src = sortIcons[sortDirection];
        sortDirectionBtn.setAttribute("aria-pressed", sortDirection === "asc" ? "true" : "false");
        sortDirectionBtn.setAttribute(
          "aria-label",
          sortDirection === "asc" ? "Sort ascending" : "Sort descending",
        );
        reverseMarketListOrder();
      });
    }

    const phoneContainer = document.querySelector(".phone-container");
    let marketsSnackbarTimeout = null;
    const showMarketsSnackbar = (message) => {
      const snackbar = phoneContainer?.querySelector("[data-snackbar]");
      if (!snackbar) return;
      const text = snackbar.querySelector("[data-snackbar-text]");
      if (text) text.textContent = message;
      if (marketsSnackbarTimeout) {
        clearTimeout(marketsSnackbarTimeout);
        marketsSnackbarTimeout = null;
      }
      snackbar.hidden = false;
      snackbar.classList.remove("is-visible");
      void snackbar.offsetWidth;
      requestAnimationFrame(() => snackbar.classList.add("is-visible"));
      marketsSnackbarTimeout = setTimeout(() => {
        snackbar.classList.remove("is-visible");
        marketsSnackbarTimeout = setTimeout(() => {
          if (!snackbar.classList.contains("is-visible")) snackbar.hidden = true;
        }, 320);
      }, 2200);
    };

    document.querySelectorAll("[data-markets-not-in-prototype]").forEach((btn) => {
      btn.addEventListener("click", () => showMarketsSnackbar("Not in prototype"));
    });

    const sticky = document.querySelector("[data-markets-sticky]");
    const filters = document.querySelector("[data-markets-filters]");
    const divider = sticky?.querySelector(".markets-page__sticky-divider");
    const scroller = document.querySelector(".content");

    let stickyDividerTicking = false;
    const syncStickyDivider = () => {
      if (!sticky || !filters || !divider) return;
      stickyDividerTicking = false;
      if (document.documentElement.getAttribute("data-active-tab") !== "markets") {
        divider.style.opacity = "0";
        return;
      }
      const stickyBottom = sticky.getBoundingClientRect().bottom;
      const filtersBottom = filters.getBoundingClientRect().bottom;
      const fadeDistance = filters.offsetHeight || 28;
      const progress = Math.min(
        1,
        Math.max(0, (stickyBottom - filtersBottom) / fadeDistance),
      );
      divider.style.opacity = String(progress);
    };

    let wasMarketsTab =
      document.documentElement.getAttribute("data-active-tab") === "markets";
    new MutationObserver(() => {
      const isMarketsTab =
        document.documentElement.getAttribute("data-active-tab") === "markets";
      if (isMarketsTab && !wasMarketsTab) {
        resetMarketsPage();
        syncStickyDivider();
      }
      wasMarketsTab = isMarketsTab;
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-active-tab"],
    });

    if (!sticky || !filters || !divider || !scroller) {
      return {
        openMarketsCategory: (key) => {
          pendingMarketsCategory = key;
          if (document.documentElement.getAttribute("data-active-tab") === "markets") {
            resetMarketsPage();
          }
        },
      };
    }

    const onStickyDividerScroll = () => {
      if (stickyDividerTicking) return;
      stickyDividerTicking = true;
      requestAnimationFrame(syncStickyDivider);
    };

    scroller.addEventListener("scroll", onStickyDividerScroll, { passive: true });
    window.addEventListener("resize", onStickyDividerScroll, { passive: true });
    new MutationObserver(onStickyDividerScroll).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-active-tab"],
    });
    syncStickyDivider();

    return {
      openMarketsCategory: (key) => {
        pendingMarketsCategory = key;
        if (document.documentElement.getAttribute("data-active-tab") === "markets") {
          resetMarketsPage();
        }
      },
    };
  };

  const initMarketDetailPage = () => {
    const page = document.querySelector("[data-market-detail-page]");
    if (!page) return;

    const container = document.querySelector(".phone-container");
    const scrollEl = page.querySelector(".market-detail-page__scroll");
    const rows = document.querySelectorAll(".markets-page__row");
    if (!rows.length) return;

    let snackbarTimeout = null;

    const showSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
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

    const symbolEl = page.querySelector("[data-market-detail-symbol]");
    const quoteEl = page.querySelector("[data-market-detail-quote]");
    const iconEl = page.querySelector("[data-market-detail-icon]");
    const priceEl = page.querySelector("[data-market-detail-price]");
    const usdEl = page.querySelector("[data-market-detail-usd]");
    const changeWrapEl = page.querySelector("[data-market-detail-change-wrap]");
    const changeIconEl = page.querySelector("[data-market-detail-change-icon]");
    const changeValEl = page.querySelector("[data-market-detail-change]");
    const navMainEl = page.querySelector(".market-detail-page__nav-main");
    const navSymbolEl = page.querySelector("[data-market-detail-nav-symbol]");
    const navQuoteEl = page.querySelector("[data-market-detail-nav-quote]");
    const navPriceEl = page.querySelector("[data-market-detail-nav-price]");
    const navChangeWrapEl = page.querySelector("[data-market-detail-nav-change-wrap]");
    const navChangeIconEl = page.querySelector("[data-market-detail-nav-change-icon]");
    const navChangeValEl = page.querySelector("[data-market-detail-nav-change]");
    const aboutTitleEl = page.querySelector("[data-market-detail-about-title]");
    const aboutIconEl = page.querySelector("[data-market-detail-about-icon]");
    const aboutTextEl = page.querySelector("[data-market-detail-about-text]");
    const tradeNameEl = page.querySelector("[data-market-detail-trade-name]");
    const balanceIconEl = page.querySelector("[data-market-detail-balance-icon]");
    const balanceSymbolEl = page.querySelector("[data-market-detail-balance-symbol]");
    const balanceNameEl = page.querySelector("[data-market-detail-balance-name]");
    const volBaseLabelEl = page.querySelector("[data-market-detail-vol-base-label]");
    const supplyEl = page.querySelector("[data-market-detail-supply]");
    const athSupplyEl = page.querySelector("[data-market-detail-ath-supply]");

    const ABOUT_COPY = {
      BTC: "Launched on {launchdate}. Bitcoin is one of the most popular cryptocurrencies in the market. First introduced in 2009 by Satoshi Nakamoto...",
      ETH: "Ethereum is a decentralized, open-source blockchain with smart contract functionality. Ether is the native cryptocurrency of the platform.",
      XRP: "XRP is the native digital asset on the XRP Ledger—an open-source, permissionless decentralized blockchain technology.",
    };

    const close = () => {
      page.classList.remove("is-open", "is-nav-compact");
      if (navMainEl) navMainEl.setAttribute("aria-hidden", "true");
      const onEnd = () => {
        if (!page.classList.contains("is-open")) page.hidden = true;
        page.removeEventListener("transitionend", onEnd);
      };
      page.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    const openFromRow = (row) => {
      const symbol =
        row.querySelector(".markets-page__row-symbol")?.textContent?.trim() || "BTC";
      const quote =
        row.querySelector(".markets-page__row-quote")?.textContent?.trim() || "/USDT";
      const name =
        row.querySelector(".markets-page__row-name")?.textContent?.trim() || "Bitcoin";
      const price =
        row.querySelector(".markets-page__row-price")?.textContent?.trim() || "0";
      const usd =
        row.querySelector(".markets-page__row-usd")?.textContent?.trim() || "";
      const icon =
        row.querySelector(".markets-page__row-icon")?.getAttribute("src") || "";
      const changeWrap = row.querySelector(".markets-page__row-change");
      const isUp = changeWrap?.classList.contains("is-up");
      const changePct =
        changeWrap?.querySelector(".markets-page__row-percent span")?.textContent?.trim() ||
        "0%";

      if (symbolEl) symbolEl.textContent = symbol;
      if (quoteEl) quoteEl.textContent = quote;
      if (navSymbolEl) navSymbolEl.textContent = symbol;
      if (navQuoteEl) navQuoteEl.textContent = quote;
      if (iconEl) iconEl.src = icon;
      if (aboutIconEl) aboutIconEl.src = icon;
      if (balanceIconEl) balanceIconEl.src = icon;
      if (priceEl) priceEl.textContent = `${price} USDT`;
      if (navPriceEl) navPriceEl.textContent = `${price} USDT`;
      if (usdEl) usdEl.textContent = usd.replace(/^≈\s*/, "≈");
      if (changeWrapEl) {
        changeWrapEl.classList.toggle("is-up", !!isUp);
        changeWrapEl.classList.toggle("is-down", !isUp);
      }
      if (navChangeWrapEl) {
        navChangeWrapEl.classList.toggle("is-up", !!isUp);
        navChangeWrapEl.classList.toggle("is-down", !isUp);
      }
      if (changeIconEl) {
        changeIconEl.src = isUp
          ? "assets/icon_chart_performance_up.svg"
          : "assets/icon_chart_performance_down.svg";
      }
      if (navChangeIconEl) {
        navChangeIconEl.src = isUp
          ? "assets/icon_chart_performance_up.svg"
          : "assets/icon_chart_performance_down.svg";
      }
      if (changeValEl) changeValEl.textContent = changePct;
      if (navChangeValEl) navChangeValEl.textContent = changePct;
      if (aboutTitleEl) aboutTitleEl.textContent = `About ${name}`;
      if (aboutTextEl) {
        aboutTextEl.textContent =
          ABOUT_COPY[symbol] ||
          `${name} is available to trade on XREX. View market data and place orders after signing up.`;
      }
      if (tradeNameEl) tradeNameEl.textContent = name;
      if (balanceSymbolEl) balanceSymbolEl.textContent = symbol;
      if (balanceNameEl) balanceNameEl.textContent = name;
      if (volBaseLabelEl) volBaseLabelEl.textContent = `Volume (${symbol})`;
      if (supplyEl) supplyEl.textContent = `20.04 M ${symbol}`;
      if (athSupplyEl) athSupplyEl.textContent = `20.04 M ${symbol}`;

      if (scrollEl) scrollEl.scrollTop = 0;
      page.classList.remove("is-nav-compact");
      if (navMainEl) navMainEl.setAttribute("aria-hidden", "true");
      page.hidden = false;
      requestAnimationFrame(() => page.classList.add("is-open"));
    };

    let navCompactTicking = false;
    const syncNavCompact = () => {
      navCompactTicking = false;
      const compact = (scrollEl?.scrollTop || 0) > 48;
      page.classList.toggle("is-nav-compact", compact);
      if (navMainEl) navMainEl.setAttribute("aria-hidden", compact ? "false" : "true");
    };

    const onDetailScroll = () => {
      if (navCompactTicking) return;
      navCompactTicking = true;
      requestAnimationFrame(syncNavCompact);
    };

    scrollEl?.addEventListener("scroll", onDetailScroll, { passive: true });

    rows.forEach((row) => {
      row.addEventListener("click", () => openFromRow(row));
    });

    const showNotInPrototype = () => showSnackbar("Not in prototype");

    page
      .querySelectorAll("[data-market-detail-close]")
      .forEach((btn) => btn.addEventListener("click", close));

    page
      .querySelector("[data-market-detail-favorite]")
      ?.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("auth-signup-open"));
      });

    page.querySelectorAll(".market-detail-page__segment-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        if (!pill.classList.contains("is-active")) showNotInPrototype();
      });
    });

    page.querySelectorAll(".market-detail-page__segment-btn").forEach((btn) => {
      btn.addEventListener("click", showNotInPrototype);
    });

    page
      .querySelector(".market-detail-page__ref-info")
      ?.addEventListener("click", showNotInPrototype);

    page
      .querySelector(".market-detail-page__pair-main")
      ?.addEventListener("click", showNotInPrototype);

    page
      .querySelector(".market-detail-page__pair-main")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showNotInPrototype();
        }
      });

    page
      .querySelector(".market-detail-page__nav-pair")
      ?.addEventListener("click", showNotInPrototype);

    page
      .querySelector(".market-detail-page__nav-pair")
      ?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          showNotInPrototype();
        }
      });

    page.querySelectorAll(".market-detail-page__chip-btn").forEach((btn) => {
      btn.addEventListener("click", showNotInPrototype);
    });

    page.querySelectorAll(".market-detail-page__guide-link").forEach((btn) => {
      btn.addEventListener("click", showNotInPrototype);
    });

    page.querySelectorAll(".market-detail-page__link-btn").forEach((btn) => {
      btn.addEventListener("click", showNotInPrototype);
    });

    page.querySelectorAll(".market-detail-page__quote-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        if (!chip.classList.contains("is-active")) showNotInPrototype();
      });
    });

    page.querySelectorAll(".market-detail-page__tag").forEach((tag) => {
      tag.addEventListener("click", showNotInPrototype);
    });

    page.querySelectorAll("[data-market-detail-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.getAttribute("data-market-detail-tab") || "info";
        if (key !== "info") {
          showSnackbar("Not in prototype");
          return;
        }
        page.querySelectorAll("[data-market-detail-tab]").forEach((item) => {
          const isActive =
            item.getAttribute("data-market-detail-tab") === key;
          item.classList.toggle("is-active", isActive);
          item.setAttribute("aria-selected", isActive ? "true" : "false");
        });
      });
    });

    const tradeSheet = document.querySelector("[data-market-detail-trade-sheet]");
    const tradeSheetPanel = tradeSheet?.querySelector(".currency-sheet__panel");
    const tradeSheetIconEl = tradeSheet?.querySelector(
      "[data-market-detail-trade-sheet-icon]",
    );
    const tradeSheetSymbolEl = tradeSheet?.querySelector(
      "[data-market-detail-trade-sheet-symbol]",
    );
    const tradeSheetQuoteEl = tradeSheet?.querySelector(
      "[data-market-detail-trade-sheet-quote]",
    );

    const syncTradeSheet = () => {
      if (tradeSheetSymbolEl) {
        tradeSheetSymbolEl.textContent = symbolEl?.textContent?.trim() || "BTC";
      }
      if (tradeSheetQuoteEl) {
        tradeSheetQuoteEl.textContent = quoteEl?.textContent?.trim() || "/USDT";
      }
      if (tradeSheetIconEl && iconEl?.getAttribute("src")) {
        tradeSheetIconEl.src = iconEl.getAttribute("src");
      }
    };

    const closeTradeSheet = () => {
      if (!tradeSheet) return;
      tradeSheet.classList.remove("is-open");
      const onEnd = () => {
        if (!tradeSheet.classList.contains("is-open")) tradeSheet.hidden = true;
        tradeSheetPanel?.removeEventListener("transitionend", onEnd);
      };
      tradeSheetPanel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const openTradeSheet = () => {
      if (!tradeSheet || tradeSheet.classList.contains("is-open")) return;
      syncTradeSheet();
      tradeSheet.hidden = false;
      requestAnimationFrame(() => tradeSheet.classList.add("is-open"));
    };

    page
      .querySelector("[data-market-detail-trade-open]")
      ?.addEventListener("click", openTradeSheet);

    tradeSheet
      ?.querySelectorAll("[data-market-detail-trade-sheet-close]")
      .forEach((btn) => btn.addEventListener("click", closeTradeSheet));

    tradeSheet
      ?.querySelectorAll("[data-market-detail-trade-action]")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          const action = String(
            btn.getAttribute("data-market-detail-trade-action") || "",
          )
            .trim()
            .toLowerCase();
          closeTradeSheet();
          close();
          if (
            action === "spot" ||
            action === "margin" ||
            action === "grid" ||
            action === "convert"
          ) {
            document.dispatchEvent(
              new CustomEvent("trade-qm-select", { detail: { action } }),
            );
          }
        }),
      );
  };

  const initTradeCandlesButtons = () => {
    const container = document.querySelector(".phone-container");
    if (!container) return;

    let snackbarTimeout = null;
    const showSnackbar = (message) => {
      const snackbar = container.querySelector("[data-snackbar]");
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

    document
      .querySelectorAll('.trade-spot-page__icon-btn[aria-label="Candles"]')
      .forEach((btn) => {
        btn.addEventListener("click", () => showSnackbar("Not in prototype"));
      });
  };

  const initTradeSpotNotInPrototypeControls = () => {
    const spotPage = document.querySelector('[data-trade-page="spot"]');
    const container = document.querySelector(".phone-container");
    if (!spotPage || !container) return;

    let snackbarTimeout = null;
    const showSnackbar = (message) => {
      const snackbar = container.querySelector("[data-snackbar]");
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

    spotPage
      .querySelectorAll(".trade-spot-page__pair")
      .forEach((btn) => btn.addEventListener("click", showNotInPrototype));

    spotPage
      .querySelectorAll(".trade-spot-page__order-type")
      .forEach((btn) => btn.addEventListener("click", showNotInPrototype));

    spotPage
      .querySelectorAll(".trade-spot-page__input-unit-wrap")
      .forEach((el) => el.addEventListener("click", showNotInPrototype));

    spotPage
      .querySelector(
        '.trade-spot-page__mid-price-main img[src*="icon_info_circle_white"]',
      )
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        showNotInPrototype();
      });
  };

  const initTradeMarginNotInPrototypeControls = () => {
    const marginPage = document.querySelector('[data-trade-page="margin"]');
    const container = document.querySelector(".phone-container");
    if (!marginPage || !container) return;

    let snackbarTimeout = null;
    const showSnackbar = (message) => {
      const snackbar = container.querySelector("[data-snackbar]");
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

    marginPage
      .querySelectorAll(".trade-margin-page__info-icon")
      .forEach((el) => el.addEventListener("click", showNotInPrototype));

    marginPage
      .querySelectorAll(".trade-margin-page__leverage")
      .forEach((btn) => btn.addEventListener("click", showNotInPrototype));

    marginPage
      .querySelector(
        '.trade-spot-page__mid-price-main img[src*="icon_info_circle_white"]',
      )
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        showNotInPrototype();
      });

    marginPage
      .querySelectorAll(".trade-margin-page__stat-label img")
      .forEach((el) => el.addEventListener("click", (e) => {
        e.stopPropagation();
        showNotInPrototype();
      }));
  };

  const initTradeSpotSideToggle = () => {
    const toggle = document.querySelector("[data-trade-spot-side-toggle]");
    if (!toggle) return;

    const buttons = Array.from(
      toggle.querySelectorAll("[data-trade-spot-side]"),
    );
    const cta = document.querySelector(
      '[data-trade-page="spot"] .trade-spot-page__buy-cta',
    );
    if (buttons.length === 0) return;

    const setSide = (side) => {
      buttons.forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-trade-spot-side") === side,
        );
      });
      cta?.classList.toggle("is-sell-mode", side === "sell");
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setSide(btn.getAttribute("data-trade-spot-side") || "buy");
      });
    });
  };

  const initTradeMarginPage = () => {
    const marginPage = document.querySelector('[data-trade-page="margin"]');
    if (!marginPage) return;

    const sideToggle = marginPage.querySelector("[data-trade-margin-side-toggle]");
    const sideButtons = Array.from(
      sideToggle?.querySelectorAll("[data-trade-margin-side]") || [],
    );
    const cta = marginPage.querySelector(".trade-spot-page__buy-cta");
    const amountLabel = marginPage.querySelector(
      ".trade-spot-page__input--amount .trade-spot-page__input-label",
    );

    const setSide = (side) => {
      sideButtons.forEach((btn) => {
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-trade-margin-side") === side,
        );
      });
      cta?.classList.toggle("is-sell-mode", side === "short");
      if (amountLabel) {
        amountLabel.textContent =
          side === "short" ? "Amount to sell" : "Amount to buy";
      }
    };

    sideButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        setSide(btn.getAttribute("data-trade-margin-side") || "long");
      });
    });

    const ordersTabs = marginPage.querySelector("[data-trade-margin-orders-tabs]");
    const orderPanels = Array.from(
      marginPage.querySelectorAll("[data-trade-margin-panel]"),
    );
    ordersTabs
      ?.querySelectorAll("[data-trade-margin-orders-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const tab = btn.getAttribute("data-trade-margin-orders-tab") || "open";
          ordersTabs
            .querySelectorAll("[data-trade-margin-orders-tab]")
            .forEach((item) => {
              item.classList.toggle("is-active", item === btn);
            });
          orderPanels.forEach((panel) => {
            panel.hidden =
              panel.getAttribute("data-trade-margin-panel") !== tab;
          });
        });
      });

    const optionsSheet = document.querySelector(
      "[data-trade-margin-options-sheet]",
    );
    const optionsPanel = optionsSheet?.querySelector(".currency-sheet__panel");
    const container = document.querySelector(".phone-container");
    let optionsSnackbarTimeout = null;

    const showOptionsSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
      if (!snackbar) return;
      const text = snackbar.querySelector("[data-snackbar-text]");
      if (text) text.textContent = message;
      if (optionsSnackbarTimeout) {
        clearTimeout(optionsSnackbarTimeout);
        optionsSnackbarTimeout = null;
      }
      snackbar.hidden = false;
      snackbar.classList.remove("is-visible");
      void snackbar.offsetWidth;
      requestAnimationFrame(() => snackbar.classList.add("is-visible"));
      optionsSnackbarTimeout = setTimeout(() => {
        snackbar.classList.remove("is-visible");
        optionsSnackbarTimeout = setTimeout(() => {
          if (!snackbar.classList.contains("is-visible")) snackbar.hidden = true;
        }, 320);
      }, 2200);
    };

    const closeOptionsSheet = () => {
      if (!optionsSheet) return;
      optionsSheet.classList.remove("is-open");
      const onEnd = () => {
        if (!optionsSheet.classList.contains("is-open")) optionsSheet.hidden = true;
        optionsPanel?.removeEventListener("transitionend", onEnd);
      };
      optionsPanel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const openOptionsSheet = () => {
      if (!optionsSheet || optionsSheet.classList.contains("is-open")) return;
      optionsSheet.hidden = false;
      requestAnimationFrame(() => optionsSheet.classList.add("is-open"));
    };

    marginPage
      .querySelector("[data-trade-margin-options-open]")
      ?.addEventListener("click", openOptionsSheet);

    optionsSheet
      ?.querySelectorAll("[data-trade-margin-options-sheet-close]")
      .forEach((btn) => btn.addEventListener("click", closeOptionsSheet));

    optionsSheet
      ?.querySelector("[data-trade-margin-options-cooling-off]")
      ?.addEventListener("click", () => {
        closeOptionsSheet();
        document.dispatchEvent(new CustomEvent("auth-signup-open"));
      });

    optionsSheet
      ?.querySelectorAll("[data-trade-margin-options-action]")
      .forEach((btn) =>
        btn.addEventListener("click", () => {
          closeOptionsSheet();
          showOptionsSnackbar("Not in prototype");
        }),
      );
  };

  const initTradeGridPage = () => {
    const guidePage = document.querySelector("[data-trade-grid-guide-page]");
    const openButtons = document.querySelectorAll("[data-trade-grid-guide-open]");
    if (!guidePage || !openButtons.length) return;

    const stepCurrentEl = guidePage.querySelector(
      "[data-trade-grid-guide-step-current]",
    );
    const headingEl = guidePage.querySelector("[data-trade-grid-guide-heading]");
    const descEl = guidePage.querySelector("[data-trade-grid-guide-desc]");
    const visualEl = guidePage.querySelector("[data-trade-grid-guide-visual]");
    const footerEl = guidePage.querySelector("[data-trade-grid-guide-footer]");
    const prevBtn = guidePage.querySelector("[data-trade-grid-guide-prev]");
    const nextBtn = guidePage.querySelector("[data-trade-grid-guide-next]");
    const closeButtons = guidePage.querySelectorAll(
      "[data-trade-grid-guide-close]",
    );
    const bodyEl = guidePage.querySelector(".trade-grid-guide-page__body");

    const slides = [
      {
        title: "Set a price range",
        desc: "To profit from grid trading, you'll set buy and sell orders within a price range you select. Using backtesting or AI suggestions can provide guidance on an effective range to target.",
        visual: "assets/illu_gb_tut_1.png",
      },
      {
        title: "Create the grid",
        desc: "A grid helps to place orders at specific price levels within a set range. For example, with a price range of 20 to 80 and using 6 grids, orders will be placed every 10 units (calculated as (80 - 20) divided by 6) within this range.",
        visual: "assets/illu_gb_tut_2.png",
      },
      {
        title: "Place orders",
        desc: "The bot will automatically place buy and sell orders at set intervals within your chosen price range.\n\nFor example, the bot buys at $30 and sets a sell order at $40. When the sell order executes, it nets a $10 profit. This buy-sell cycle repeats across each $10 interval, collecting profits as the price moves within the range",
        visual: "assets/illu_gb_tut_3.png",
      },
      {
        title: "Margin grid",
        desc: "Activating leverage or using short and neutral strategies triggers margin trading with a grid bot. Using leverage above 1x magnifies both potential profits and losses. Margin grid trading also incurs margin costs.",
        visual: "assets/illu_gb_tut_4.png",
      },
    ];

    let activeStep = 0;

    const renderStep = () => {
      const safe = Math.max(0, Math.min(slides.length - 1, activeStep));
      activeStep = safe;
      const slide = slides[safe];
      if (stepCurrentEl) stepCurrentEl.textContent = String(safe + 1);
      if (headingEl) headingEl.textContent = slide.title;
      if (descEl) descEl.textContent = slide.desc;
      if (visualEl) visualEl.setAttribute("src", slide.visual);
      if (prevBtn) prevBtn.hidden = safe === 0;
      if (footerEl) {
        footerEl.classList.toggle(
          "trade-grid-guide-page__footer--single",
          safe === 0,
        );
      }
      if (nextBtn) {
        nextBtn.textContent =
          safe === slides.length - 1 ? "Get started" : "Next";
      }
      if (bodyEl) bodyEl.scrollTop = 0;
    };

    const close = (opts = {}) => {
      if (opts.instant) {
        guidePage.style.transition = "none";
        guidePage.classList.remove("is-open");
        guidePage.hidden = true;
        requestAnimationFrame(() => {
          guidePage.style.transition = "";
        });
        return;
      }
      guidePage.classList.remove("is-open");
      const onEnd = () => {
        if (!guidePage.classList.contains("is-open")) guidePage.hidden = true;
        guidePage.removeEventListener("transitionend", onEnd);
      };
      guidePage.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    const openSignupThenCloseGuide = () => {
      document.dispatchEvent(new CustomEvent("auth-signup-open"));
      const signupPage = document.querySelector("[data-auth-signup-page]");
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        signupPage?.removeEventListener("transitionend", onSignupRevealed);
        close({ instant: true });
      };
      const onSignupRevealed = (event) => {
        if (event.target !== signupPage || event.propertyName !== "transform") {
          return;
        }
        finish();
      };
      signupPage?.addEventListener("transitionend", onSignupRevealed);
      setTimeout(finish, 320);
    };

    const open = () => {
      activeStep = 0;
      renderStep();
      guidePage.hidden = false;
      requestAnimationFrame(() => guidePage.classList.add("is-open"));
    };

    openButtons.forEach((btn) => btn.addEventListener("click", open));
    closeButtons.forEach((btn) => btn.addEventListener("click", close));
    prevBtn?.addEventListener("click", () => {
      if (activeStep <= 0) return;
      activeStep -= 1;
      renderStep();
    });
    nextBtn?.addEventListener("click", () => {
      if (activeStep >= slides.length - 1) {
        openSignupThenCloseGuide();
        return;
      }
      activeStep += 1;
      renderStep();
    });
  };

  /** Trade · Convert tab — RFQ layout; reuses plan-detail amount row styling. */
  const initTradeConvertPage = () => {
    const root = document.querySelector("[data-trade-convert-root]");
    const payInp = root?.querySelector("[data-trade-convert-pay-input]");
    const recvInp = root?.querySelector("[data-trade-convert-recv-input]");
    if (!root || !payInp || !recvInp) return;

    const pairFromEl = root.querySelector("[data-trade-convert-pair-from]");
    const pairToEl = root.querySelector("[data-trade-convert-pair-to]");
    const rateEl = root.querySelector("[data-trade-convert-rate]");
    const payAvailEl = root.querySelector("[data-trade-convert-pay-avail]");
    const recvAvailEl = root.querySelector("[data-trade-convert-recv-avail]");
    const payIcon = root.querySelector("[data-trade-convert-pay-icon]");
    const recvIcon = root.querySelector("[data-trade-convert-recv-icon]");
    const payCurEl = root.querySelector("[data-trade-convert-pay-currency]");
    const recvCurEl = root.querySelector("[data-trade-convert-recv-currency]");
    const maxBtn = root.querySelector("[data-trade-convert-max]");
    const swapBtn = root.querySelector("[data-trade-convert-swap]");
    const previewBtn = root.querySelector("[data-trade-convert-preview]");

    const readRate = () => {
      const n = parseFloat(String(root.getAttribute("data-convert-rate") || ""));
      return Number.isFinite(n) && n > 0 ? n : 2438104.61;
    };

    let rateTwdPerBtc = readRate();
    let payCurrency = "TWD";
    let receiveCurrency = "BTC";

    const availForCurrency = (code) => {
      const c = String(code || "").toUpperCase();
      const n = Number(PROTOTYPE_BALANCES[c]);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    };

    let availPay = availForCurrency(payCurrency);
    let availReceive = availForCurrency(receiveCurrency);

    /** Max value for either amount field on the convert form. */
    const CONVERT_AMOUNT_MAX = 999999.99;

    const CONVERT_BTC_DECIMALS = 6;
    const roundConvertBtc = (n) => {
      if (!Number.isFinite(n)) return NaN;
      const f = 10 ** CONVERT_BTC_DECIMALS;
      return Math.round(n * f) / f;
    };

    const fmtConvertBtc = (n) => {
      if (!Number.isFinite(n) || n < 0) return "";
      return roundConvertBtc(n).toFixed(CONVERT_BTC_DECIMALS);
    };

    const CONVERT_FIAT_DECIMALS = 2;
    const roundConvertFiat = (n) => {
      if (!Number.isFinite(n)) return NaN;
      const f = 10 ** CONVERT_FIAT_DECIMALS;
      return Math.round(n * f) / f;
    };

    const iconFor = (code) => {
      if (code === "BTC") return "assets/icon_currency_btc.svg";
      if (code === "TWD") return "assets/icon_currency_TWD.svg";
      return "assets/icon_currency_usdt.svg";
    };

    const fmtTwd = (n) =>
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        Math.round(n),
      );

    const fmtBtcAvail = (n) =>
      Number.isFinite(n)
        ? roundConvertBtc(n).toFixed(CONVERT_BTC_DECIMALS)
        : "0." + "0".repeat(CONVERT_BTC_DECIMALS);

    /** TWD (and other fiat on this screen) — up to 2 decimals so cap 999,999.99 renders correctly. */
    const fmtConvertFiat = (n) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number.isFinite(n) ? n : 0);

    const parsePay = () => {
      const raw = String(payInp.value || "").replace(/,/g, "").trim();
      const x = parseFloat(raw);
      if (!Number.isFinite(x)) return NaN;
      if (payCurrency === "BTC") return roundConvertBtc(x);
      if (payCurrency === "TWD") return roundConvertFiat(x);
      return x;
    };

    const formatPayField = (n) => {
      if (!Number.isFinite(n) || n < 0) return "";
      if (payCurrency === "TWD")
        return fmtConvertFiat(roundConvertFiat(n));
      return fmtConvertBtc(n);
    };

    const formatReceiveField = (n) => {
      if (!Number.isFinite(n) || n < 0) return "";
      if (receiveCurrency === "BTC") return fmtConvertBtc(n);
      if (receiveCurrency === "TWD")
        return fmtConvertFiat(roundConvertFiat(n));
      return fmtConvertFiat(n);
    };

    const parseRecv = () => {
      const raw = String(recvInp.value || "").replace(/,/g, "").trim();
      const x = parseFloat(raw);
      if (!Number.isFinite(x)) return NaN;
      if (receiveCurrency === "BTC") return roundConvertBtc(x);
      if (receiveCurrency === "TWD") return roundConvertFiat(x);
      return x;
    };

    const convertForward = (payAmt) => {
      if (!Number.isFinite(payAmt) || payAmt <= 0) return NaN;
      if (payCurrency === "TWD" && receiveCurrency === "BTC")
        return payAmt / rateTwdPerBtc;
      if (payCurrency === "BTC" && receiveCurrency === "TWD")
        return payAmt * rateTwdPerBtc;
      return NaN;
    };

    const convertFromReceive = (recvAmt) => {
      if (!Number.isFinite(recvAmt) || recvAmt <= 0) return NaN;
      if (payCurrency === "TWD" && receiveCurrency === "BTC")
        return recvAmt * rateTwdPerBtc;
      if (payCurrency === "BTC" && receiveCurrency === "TWD")
        return recvAmt / rateTwdPerBtc;
      return NaN;
    };

    const CONVERT_PLACEHOLDER_BTC = "0";
    const CONVERT_PLACEHOLDER_TWD = "0";
    const CONVERT_TWD_AMOUNT_HINT = "≈ Min 5\nMax 100K";

    const renderAmountPlaceholders = () => {
      const ph = (code) =>
        code === "BTC" ? CONVERT_PLACEHOLDER_BTC : CONVERT_PLACEHOLDER_TWD;
      if (payInp) payInp.placeholder = ph(payCurrency);
      if (recvInp) recvInp.placeholder = ph(receiveCurrency);
    };

    const payHintEl = root.querySelector("[data-trade-convert-pay-hint]");
    const recvHintEl = root.querySelector("[data-trade-convert-recv-hint]");

    const syncTwdAmountHints = () => {
      const empty = (inp) => !String(inp?.value || "").trim();
      if (payHintEl) {
        const show = payCurrency === "TWD" && empty(payInp);
        payHintEl.hidden = !show;
        if (show) payHintEl.textContent = CONVERT_TWD_AMOUNT_HINT;
      }
      if (recvHintEl) {
        const show = receiveCurrency === "TWD" && empty(recvInp);
        recvHintEl.hidden = !show;
        if (show) recvHintEl.textContent = CONVERT_TWD_AMOUNT_HINT;
      }
    };

    const syncConvertPreviewCta = () => {
      // Visitor mode: CTA opens sign-up; no disabled Preview state.
    };

    const syncReceiveFromPay = () => {
      try {
        let payAmt = parsePay();
        if (!Number.isFinite(payAmt) || payAmt <= 0) {
          recvInp.value = "";
          return;
        }
        if (payAmt > CONVERT_AMOUNT_MAX) {
          payAmt = CONVERT_AMOUNT_MAX;
          payInp.value = formatPayField(payAmt);
        }
        if (payCurrency === "BTC") {
          payAmt = roundConvertBtc(payAmt);
          payInp.value = formatPayField(payAmt);
        } else if (payCurrency === "TWD") {
          payAmt = roundConvertFiat(payAmt);
          payInp.value = formatPayField(payAmt);
        }
        let out = convertForward(payAmt);
        if (!Number.isFinite(out)) {
          recvInp.value = "";
          return;
        }
        if (out > CONVERT_AMOUNT_MAX) {
          recvInp.value = formatReceiveField(CONVERT_AMOUNT_MAX);
          const payIdeal = convertFromReceive(CONVERT_AMOUNT_MAX);
          if (!Number.isFinite(payIdeal) || payIdeal <= 0) return;
          if (payIdeal > CONVERT_AMOUNT_MAX) {
            payInp.value = formatPayField(CONVERT_AMOUNT_MAX);
            const outCapped = convertForward(CONVERT_AMOUNT_MAX);
            recvInp.value = Number.isFinite(outCapped)
              ? formatReceiveField(outCapped)
              : formatReceiveField(CONVERT_AMOUNT_MAX);
          } else {
            payInp.value = formatPayField(payIdeal);
          }
          return;
        }
        if (receiveCurrency === "BTC") out = roundConvertBtc(out);
        else if (receiveCurrency === "TWD") out = roundConvertFiat(out);
        recvInp.value = formatReceiveField(out);
      } finally {
        syncTwdAmountHints();
        syncConvertPreviewCta();
      }
    };

    const syncPayFromReceive = () => {
      try {
        let recvAmt = parseRecv();
        if (!Number.isFinite(recvAmt) || recvAmt <= 0) {
          payInp.value = "";
          return;
        }
        if (recvAmt > CONVERT_AMOUNT_MAX) {
          recvAmt = CONVERT_AMOUNT_MAX;
          recvInp.value = formatReceiveField(recvAmt);
        }
        if (receiveCurrency === "BTC") {
          recvAmt = roundConvertBtc(recvAmt);
          recvInp.value = formatReceiveField(recvAmt);
        } else if (receiveCurrency === "TWD") {
          recvAmt = roundConvertFiat(recvAmt);
          recvInp.value = formatReceiveField(recvAmt);
        }
        let pay = convertFromReceive(recvAmt);
        if (!Number.isFinite(pay)) {
          payInp.value = "";
          return;
        }
        if (pay > CONVERT_AMOUNT_MAX) {
          payInp.value = formatPayField(CONVERT_AMOUNT_MAX);
          const outCapped = convertForward(CONVERT_AMOUNT_MAX);
          recvInp.value = Number.isFinite(outCapped)
            ? formatReceiveField(outCapped)
            : formatReceiveField(CONVERT_AMOUNT_MAX);
          return;
        }
        payInp.value = formatPayField(pay);
      } finally {
        syncTwdAmountHints();
        syncConvertPreviewCta();
      }
    };

    const renderAvails = () => {
      if (payAvailEl) {
        payAvailEl.textContent = `Avail. - - ${payCurrency}`;
      }
      if (recvAvailEl) {
        recvAvailEl.textContent = `Avail. - - ${receiveCurrency}`;
      }
    };

    const renderRate = () => {
      if (!rateEl) return;
      rateEl.textContent = `1 BTC = ${fmtTwd(rateTwdPerBtc)} TWD`;
    };

    const renderPair = () => {
      if (pairFromEl) pairFromEl.textContent = payCurrency;
      if (pairToEl) pairToEl.textContent = receiveCurrency;
    };

    const renderIcons = () => {
      if (payIcon) payIcon.src = iconFor(payCurrency);
      if (recvIcon) recvIcon.src = iconFor(receiveCurrency);
      if (payCurEl) payCurEl.textContent = payCurrency;
      if (recvCurEl) recvCurEl.textContent = receiveCurrency;
    };

    const payCurBtn = root.querySelector("[data-trade-convert-pay-currency-btn]");
    const recvCurBtn = root.querySelector("[data-trade-convert-recv-currency-btn]");
    const phoneContainer = document.querySelector(".phone-container");
    let convertSnackbarTimeout = null;

    const showConvertSnackbar = (message) => {
      const snackbar = phoneContainer?.querySelector("[data-snackbar]");
      if (!snackbar) return;
      const text = snackbar.querySelector("[data-snackbar-text]");
      if (text) text.textContent = message;
      if (convertSnackbarTimeout) {
        clearTimeout(convertSnackbarTimeout);
        convertSnackbarTimeout = null;
      }
      snackbar.hidden = false;
      snackbar.classList.remove("is-visible");
      void snackbar.offsetWidth;
      requestAnimationFrame(() => snackbar.classList.add("is-visible"));
      convertSnackbarTimeout = setTimeout(() => {
        snackbar.classList.remove("is-visible");
        convertSnackbarTimeout = setTimeout(() => {
          if (!snackbar.classList.contains("is-visible")) snackbar.hidden = true;
        }, 320);
      }, 2200);
    };

    const showConvertNotInPrototype = () =>
      showConvertSnackbar("Not in prototype");

    [payCurBtn, recvCurBtn].forEach((btn) => {
      btn?.addEventListener("click", (e) => {
        e.stopPropagation();
        showConvertNotInPrototype();
      });
    });

    payInp.addEventListener("input", syncReceiveFromPay);
    recvInp.addEventListener("input", syncPayFromReceive);

    const payAmountRow = payInp.closest(".plan-detail-panel__amount-row");
    const recvAmountRow = recvInp.closest(".plan-detail-panel__amount-row");
    const payFieldLabel = payAmountRow
      ?.closest(".trade-convert-page__field")
      ?.querySelector(".plan-detail-panel__section-label");
    const scrollConvertContentTo = (el, topOffsetPx = 24) => {
      const scroller = document.querySelector("[data-content]");
      if (!scroller || !el) return;
      const sr = scroller.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const nextTop = scroller.scrollTop + (er.top - sr.top) - topOffsetPx;
      scroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    };
    const bindConvertAmountRowFocus = (row, inp) => {
      if (!row || !inp) return;
      row.addEventListener("click", (e) => {
        if (e.target.closest(".plan-detail-panel__currency-pill")) return;
        if (e.target.closest("input")) return;
        inp.focus();
        document.dispatchEvent(new CustomEvent("fake-keyboard-show"));
      });
    };
    bindConvertAmountRowFocus(payAmountRow, payInp);
    bindConvertAmountRowFocus(recvAmountRow, recvInp);

    payInp.addEventListener("focus", () => {
      document.dispatchEvent(new CustomEvent("fake-keyboard-show"));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollConvertContentTo(payFieldLabel));
      });
    });

    recvInp.addEventListener("focus", () => {
      document.dispatchEvent(new CustomEvent("fake-keyboard-show"));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollConvertContentTo(payFieldLabel));
      });
    });

    const bindKeyboardGestureFocus = (inp, triggerEl) => {
      if (!inp || !triggerEl) return;
      const LONG_PRESS_MS = 320;
      let holdTimer = null;
      let longPressTriggered = false;

      const showFakeKeyboard = () => {
        inp.focus();
        // Ensure the desktop fake keyboard can be re-shown even if this field is already focused.
        document.dispatchEvent(new CustomEvent("fake-keyboard-show"));
      };

      triggerEl.addEventListener("dblclick", () => {
        showFakeKeyboard();
      });

      triggerEl.addEventListener("pointerdown", (e) => {
        if (e.target.closest(".plan-detail-panel__currency-pill")) return;
        longPressTriggered = false;
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = setTimeout(() => {
          longPressTriggered = true;
          showFakeKeyboard();
        }, LONG_PRESS_MS);
      });

      const clearHold = () => {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      };

      triggerEl.addEventListener("pointerup", clearHold);
      triggerEl.addEventListener("pointerleave", clearHold);
      triggerEl.addEventListener("pointercancel", clearHold);
      triggerEl.addEventListener("contextmenu", (e) => {
        if (!longPressTriggered) return;
        e.preventDefault();
      });
    };
    bindKeyboardGestureFocus(payInp, payAmountRow || payInp);
    bindKeyboardGestureFocus(recvInp, recvAmountRow || recvInp);

    if (maxBtn) maxBtn.disabled = true;

    swapBtn?.addEventListener("click", () => {
      const pc = payCurrency;
      payCurrency = receiveCurrency;
      receiveCurrency = pc;
      availPay = availForCurrency(payCurrency);
      availReceive = availForCurrency(receiveCurrency);
      const pv = payInp.value;
      payInp.value = recvInp.value;
      recvInp.value = pv;
      renderPair();
      renderIcons();
      renderAmountPlaceholders();
      renderAvails();
      syncReceiveFromPay();
    });

    rateTwdPerBtc = readRate();
    renderPair();
    renderIcons();
    renderAmountPlaceholders();
    renderRate();
    renderAvails();

    const resetConvertAmountsToEmpty = () => {
      payInp.value = "";
      recvInp.value = "";
      syncReceiveFromPay();
    };

    resetConvertAmountsToEmpty();

    document.addEventListener("trade-page-changed", (e) => {
      if (e?.detail?.pageId === "convert") resetConvertAmountsToEmpty();
    });
  };

  /** Trade · Convert — sync “About the conversion price” bottom sheet copy. */
  const syncTradeConvertRateInfoSheet = () => {
    const descEl = document.querySelector("[data-trade-convert-rate-info-desc]");
    if (!descEl) return;
    const root = document.querySelector("[data-trade-convert-root]");
    const payInp = root?.querySelector("[data-trade-convert-pay-input]");
    const payCode = (
      root?.querySelector("[data-trade-convert-pay-currency]")?.textContent ||
      "TWD"
    )
      .trim()
      .toUpperCase();
    const raw = String(payInp?.value || "").replace(/,/g, "").trim();
    let payAmt = raw ? Number(raw) : 0;
    if (!Number.isFinite(payAmt)) payAmt = 0;
    let fee = payAmt * 0.001;
    if (payCode === "BTC") {
      fee = Math.round(fee * 1e6) / 1e6;
    } else {
      fee = Math.round(fee * 100) / 100;
    }
    const feeStr =
      payCode === "BTC"
        ? fee.toFixed(6)
        : new Intl.NumberFormat("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(fee);
    descEl.textContent = `A 0.1% fee (${feeStr} ${payCode}) is already included in your conversion price. No extra fees apply.`;
  };

  /** Trade · Convert — rate row opens “About the conversion price” bottom sheet. */
  const initTradeConvertRatePanel = () => {
    const openBtn = document.querySelector("[data-trade-convert-rate-open]");
    const rateInfoSheet = document.querySelector(
      "[data-trade-convert-rate-info-sheet]",
    );
    const rateInfoPanel = rateInfoSheet?.querySelector(".currency-sheet__panel");
    if (!rateInfoSheet || !rateInfoPanel) return;

    const closeRateInfoSheet = () => {
      const confirmSheet = document.querySelector(
        "[data-trade-convert-confirm-sheet]",
      );
      const reopenConfirm = rateInfoSheet.dataset.returnTo === "confirm";
      delete rateInfoSheet.dataset.returnTo;
      if (getBottomSheetStacking()) {
        sheetCloseWithBackdropHandoff(rateInfoSheet, rateInfoPanel, null, {
          suppressNestedScrim: true,
        });
        return;
      }
      sheetCloseWithBackdropHandoff(
        rateInfoSheet,
        rateInfoPanel,
        reopenConfirm && confirmSheet
          ? () => {
              sheetOpenWithInstantBackdrop(confirmSheet);
            }
          : null,
        { suppressNestedScrim: true },
      );
    };

    openBtn?.addEventListener("click", () => {
      syncTradeConvertRateInfoSheet();
      delete rateInfoSheet.dataset.returnTo;
      sheetOpenWithInstantBackdrop(rateInfoSheet);
    });

    rateInfoSheet
      .querySelectorAll("[data-trade-convert-rate-info-close]")
      .forEach((btn) => btn.addEventListener("click", closeRateInfoSheet));
  };

  /** Trade · Convert — confirm quote bottom sheet (Figma 11243:5682). */
  const initTradeConvertConfirmSheet = () => {
    const sheet = document.querySelector("[data-trade-convert-confirm-sheet]");
    const previewBtn = document.querySelector("[data-trade-convert-preview]");
    if (!sheet || !previewBtn) return;

    const panel = sheet.querySelector(".currency-sheet__panel");
    const payHeroEl = sheet.querySelector("[data-trade-convert-confirm-pay-hero]");
    const recvHeroEl = sheet.querySelector("[data-trade-convert-confirm-recv-hero]");
    const payCodeEl = sheet.querySelector("[data-trade-convert-confirm-pay-code]");
    const recvCodeEl = sheet.querySelector("[data-trade-convert-confirm-recv-code]");
    const payIconEl = sheet.querySelector("[data-trade-convert-confirm-pay-icon]");
    const recvIconEl = sheet.querySelector("[data-trade-convert-confirm-recv-icon]");
    const fromEl = sheet.querySelector("[data-trade-convert-confirm-from]");
    const feeEl = sheet.querySelector("[data-trade-convert-confirm-fee]");
    const netEl = sheet.querySelector("[data-trade-convert-confirm-net]");
    const rateEl = sheet.querySelector("[data-trade-convert-confirm-rate]");
    const timerEl = sheet.querySelector("[data-trade-convert-confirm-timer]");
    const rateProgressEl = sheet.querySelector(
      "[data-trade-convert-confirm-progress]",
    );
    const recvLineEl = sheet.querySelector("[data-trade-convert-confirm-receive-line]");
    const confirmBtn = sheet.querySelector("[data-trade-convert-confirm-ok]");
    const updateRateBtn = sheet.querySelector("[data-trade-convert-confirm-update-rate]");
    const rateInfoOpenBtn = sheet.querySelector("[data-trade-convert-rate-info-open]");
    const rateInfoSheet = document.querySelector(
      "[data-trade-convert-rate-info-sheet]",
    );
    const rateInfoPanel = rateInfoSheet?.querySelector(".currency-sheet__panel");
    const submitLoaderEl = document.querySelector(
      "[data-trade-convert-submit-loader]",
    );
    const postSheetEl = document.querySelector("[data-trade-convert-post-sheet]");
    const postSheetPanelEl = postSheetEl?.querySelector(".currency-sheet__panel");
    const postPayHeroEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-pay-hero]",
    );
    const postRecvHeroEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-recv-hero]",
    );
    const postPayCodeEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-pay-code]",
    );
    const postRecvCodeEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-recv-code]",
    );
    const postPayIconEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-pay-icon]",
    );
    const postRecvIconEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-recv-icon]",
    );
    const postBalanceTwdEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-balance-twd]",
    );
    const postBalanceBtcEl = postSheetEl?.querySelector(
      "[data-trade-convert-post-balance-btc]",
    );

    const FEE_PCT = 0.001;
    const COUNTDOWN_START = 15;
    const SUBMIT_LOADER_MS = 2200;
    let countdownTimerId = null;
    let submitTimerId = null;

    const roundBtc = (n) => {
      if (!Number.isFinite(n)) return NaN;
      return Math.round(n * 1e6) / 1e6;
    };

    const roundFiat = (n) => {
      if (!Number.isFinite(n)) return NaN;
      return Math.round(n * 1e2) / 1e2;
    };

    const fmtFiat = (n) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(Number.isFinite(n) ? n : 0);

    const fmtFiatFull = (n) =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number.isFinite(n) ? n : 0);

    const fmtBtc = (n) =>
      Number.isFinite(n) ? roundBtc(n).toFixed(6) : "";

    const fmtTwdRate = (n) =>
      new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
        Math.round(Number.isFinite(n) ? n : 0),
      );

    const iconFor = (code) => {
      const c = String(code || "").toUpperCase();
      if (c === "BTC") return "assets/icon_currency_btc.svg";
      if (c === "TWD") return "assets/icon_currency_TWD.svg";
      return "assets/icon_currency_usdt.svg";
    };

    const parseField = (raw, code) => {
      const x = parseFloat(String(raw || "").replace(/,/g, "").trim());
      if (!Number.isFinite(x)) return NaN;
      if (code === "BTC") return roundBtc(x);
      if (code === "TWD") return roundFiat(x);
      return roundFiat(x);
    };

    const formatCountdown = (sec) => {
      const s = Math.max(0, Math.floor(sec));
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `Rate guaranteed for ${m}:${String(r).padStart(2, "0")}s`;
    };

    const stopCountdown = () => {
      if (countdownTimerId) {
        clearInterval(countdownTimerId);
        countdownTimerId = null;
      }
    };

    const hideSubmitLoader = () => {
      if (submitLoaderEl) submitLoaderEl.hidden = true;
    };

    const clearSubmitTimer = () => {
      if (submitTimerId) {
        clearTimeout(submitTimerId);
        submitTimerId = null;
      }
    };

    const closePostSheet = () => {
      if (!postSheetEl) return;
      postSheetEl.classList.remove("is-open");
      const onEnd = () => {
        if (!postSheetEl.classList.contains("is-open")) postSheetEl.hidden = true;
        postSheetPanelEl?.removeEventListener("transitionend", onEnd);
      };
      postSheetPanelEl?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const openPostSheet = () => {
      if (!postSheetEl) return;
      postSheetEl.hidden = false;
      requestAnimationFrame(() => postSheetEl.classList.add("is-open"));
    };

    const clearRateExpired = () => {
      sheet.classList.remove("convert-confirm-sheet--rate-expired");
      if (confirmBtn) confirmBtn.disabled = false;
    };

    const applyRateExpired = () => {
      stopCountdown();
      sheet.classList.add("convert-confirm-sheet--rate-expired");
      if (rateEl) rateEl.textContent = "- -";
      if (recvHeroEl) recvHeroEl.textContent = "- -";
      const rc = recvCodeEl?.textContent?.trim() || "BTC";
      if (recvLineEl) recvLineEl.textContent = `- - ${rc}`;
      if (rateProgressEl) {
        // Snap to 0% at expiry (no trailing animation after 0:00).
        rateProgressEl.style.transition = "none";
        rateProgressEl.style.width = "0%";
      }
      if (confirmBtn) confirmBtn.disabled = true;
    };

    const startCountdown = () => {
      stopCountdown();
      clearRateExpired();
      let left = COUNTDOWN_START;
      if (timerEl) timerEl.textContent = formatCountdown(left);
      if (rateProgressEl) {
        // Refill instantly when a new quote starts.
        rateProgressEl.style.transition = "none";
        rateProgressEl.style.width = "100%";
        // Force style flush so subsequent countdown ticks animate normally.
        void rateProgressEl.offsetWidth;
        rateProgressEl.style.transition = "width 1s linear";
      }
      countdownTimerId = window.setInterval(() => {
        left -= 1;
        if (timerEl) timerEl.textContent = formatCountdown(Math.max(0, left));
        if (rateProgressEl) {
          const pct = (Math.max(0, left) / COUNTDOWN_START) * 100;
          rateProgressEl.style.width = `${pct}%`;
        }
        if (left <= 0) applyRateExpired();
      }, 1000);
    };

    const readRateTwdPerBtc = (root) => {
      const n = parseFloat(String(root?.getAttribute("data-convert-rate") || ""));
      return Number.isFinite(n) && n > 0 ? n : 2438104.61;
    };

    const syncFromConvert = () => {
      const root = document.querySelector("[data-trade-convert-root]");
      const payInp = root?.querySelector("[data-trade-convert-pay-input]");
      const recvInp = root?.querySelector("[data-trade-convert-recv-input]");
      const payCode =
        root
          ?.querySelector("[data-trade-convert-pay-currency]")
          ?.textContent?.trim() || "TWD";
      const recvCode =
        root
          ?.querySelector("[data-trade-convert-recv-currency]")
          ?.textContent?.trim() || "BTC";

      if (payIconEl) payIconEl.src = iconFor(payCode);
      if (recvIconEl) recvIconEl.src = iconFor(recvCode);
      if (payCodeEl) payCodeEl.textContent = payCode;
      if (recvCodeEl) recvCodeEl.textContent = recvCode;

      const payAmt = parseField(payInp?.value, payCode);
      const recvAmt = parseField(recvInp?.value, recvCode);

      if (payHeroEl)
        payHeroEl.textContent =
          payCode === "BTC" ? fmtBtc(payAmt) : fmtFiat(payAmt);
      if (recvHeroEl)
        recvHeroEl.textContent =
          recvCode === "BTC" ? fmtBtc(recvAmt) : fmtFiat(recvAmt);

      const fromStr =
        payCode === "BTC"
          ? `${fmtBtc(payAmt)} ${payCode}`
          : `${fmtFiatFull(payAmt)} ${payCode}`;
      if (fromEl) fromEl.textContent = fromStr;

      let fee = Number.isFinite(payAmt) ? payAmt * FEE_PCT : NaN;
      if (payCode === "BTC") fee = roundBtc(fee);
      else fee = roundFiat(fee);

      const net = Number.isFinite(payAmt) && Number.isFinite(fee)
        ? payCode === "BTC"
          ? roundBtc(payAmt - fee)
          : roundFiat(payAmt - fee)
        : NaN;

      if (feeEl)
        feeEl.textContent =
          payCode === "BTC"
            ? `${fmtBtc(fee)} ${payCode}`
            : `${fmtFiatFull(fee)} ${payCode}`;
      if (netEl)
        netEl.textContent =
          payCode === "BTC"
            ? `${fmtBtc(net)} ${payCode}`
            : `${fmtFiatFull(net)} ${payCode}`;

      const rate = readRateTwdPerBtc(root);
      if (rateEl)
        rateEl.textContent = `1 BTC = ${fmtTwdRate(rate)} TWD`;

      if (recvLineEl)
        recvLineEl.textContent =
          recvCode === "BTC"
            ? `${fmtBtc(recvAmt)} ${recvCode}`
            : `${fmtFiatFull(recvAmt)} ${recvCode}`;
    };

    const syncPostSheetFromConvert = () => {
      const root = document.querySelector("[data-trade-convert-root]");
      const payInp = root?.querySelector("[data-trade-convert-pay-input]");
      const recvInp = root?.querySelector("[data-trade-convert-recv-input]");
      const payCode =
        root
          ?.querySelector("[data-trade-convert-pay-currency]")
          ?.textContent?.trim() || "TWD";
      const recvCode =
        root
          ?.querySelector("[data-trade-convert-recv-currency]")
          ?.textContent?.trim() || "BTC";
      const payAmt = parseField(payInp?.value, payCode);
      const recvAmt = parseField(recvInp?.value, recvCode);

      if (postPayIconEl) postPayIconEl.src = iconFor(payCode);
      if (postRecvIconEl) postRecvIconEl.src = iconFor(recvCode);
      if (postPayCodeEl) postPayCodeEl.textContent = payCode;
      if (postRecvCodeEl) postRecvCodeEl.textContent = recvCode;
      if (postPayHeroEl)
        postPayHeroEl.textContent =
          payCode === "BTC" ? fmtBtc(payAmt) : fmtFiat(payAmt);
      if (postRecvHeroEl)
        postRecvHeroEl.textContent =
          recvCode === "BTC" ? fmtBtc(recvAmt) : fmtFiat(recvAmt);

      const nextBalances = {
        TWD: Number(PROTOTYPE_BALANCES.TWD) || 0,
        BTC: Number(PROTOTYPE_BALANCES.BTC) || 0,
      };
      if (Number.isFinite(payAmt) && payAmt > 0 && nextBalances[payCode] != null) {
        nextBalances[payCode] = Math.max(0, nextBalances[payCode] - payAmt);
      }
      if (
        Number.isFinite(recvAmt) &&
        recvAmt > 0 &&
        nextBalances[recvCode] != null
      ) {
        nextBalances[recvCode] += recvAmt;
      }

      if (postBalanceTwdEl)
        postBalanceTwdEl.textContent = `${fmtFiatFull(nextBalances.TWD)} TWD`;
      if (postBalanceBtcEl)
        postBalanceBtcEl.textContent = `${fmtBtc(nextBalances.BTC)} BTC`;
    };

    const close = (opts = {}) => {
      clearSubmitTimer();
      hideSubmitLoader();
      stopCountdown();
      clearRateExpired();
      if (rateInfoSheet) {
        rateInfoSheet.classList.remove("is-open");
        rateInfoSheet.hidden = true;
      }
      if (opts.instant) {
        sheet.hidden = true;
        sheet.classList.remove("is-open");
        return;
      }
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel?.removeEventListener("transitionend", onEnd);
      };
      panel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const open = () => {
      if (previewBtn.disabled) return;
      clearRateExpired();
      syncFromConvert();
      startCountdown();
      if (rateInfoSheet) {
        rateInfoSheet.classList.remove("is-open");
        rateInfoSheet.hidden = true;
      }
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    previewBtn.addEventListener("click", open);
    sheet.querySelectorAll("[data-trade-convert-confirm-close]").forEach((btn) => {
      btn.addEventListener("click", close);
    });
    confirmBtn?.addEventListener("click", () => {
      if (confirmBtn.disabled) return;
      clearSubmitTimer();
      stopCountdown();
      hideSubmitLoader();
      if (submitLoaderEl) submitLoaderEl.hidden = false;
      submitTimerId = window.setTimeout(() => {
        submitTimerId = null;
        hideSubmitLoader();
        close({ instant: true });
        syncPostSheetFromConvert();
        openPostSheet();

        // Reset convert form back to empty after submitting.
        const convertRoot = document.querySelector("[data-trade-convert-root]");
        const payInp = convertRoot?.querySelector("[data-trade-convert-pay-input]");
        const recvInp = convertRoot?.querySelector(
          "[data-trade-convert-recv-input]",
        );
        if (payInp) payInp.value = "";
        if (recvInp) recvInp.value = "";
        // Trigger normal UI sync (hints, disabled Preview, etc.)
        payInp?.dispatchEvent(new Event("input", { bubbles: true }));
      }, SUBMIT_LOADER_MS);
    });
    updateRateBtn?.addEventListener("click", () => {
      clearRateExpired();
      syncFromConvert();
      startCountdown();
    });
    rateInfoOpenBtn?.addEventListener("click", () => {
      if (!rateInfoSheet || !rateInfoPanel) return;
      syncTradeConvertRateInfoSheet();
      rateInfoSheet.dataset.returnTo = "confirm";
      if (getBottomSheetStacking()) {
        sheetOpenWithInstantBackdrop(rateInfoSheet);
        return;
      }
      sheetCloseWithBackdropHandoff(
        sheet,
        panel,
        () => {
          sheetOpenWithInstantBackdrop(rateInfoSheet);
        },
        { suppressNestedScrim: true },
      );
    });
    postSheetEl
      ?.querySelectorAll("[data-trade-convert-post-close]")
      .forEach((btn) => btn.addEventListener("click", closePostSheet));
  };

  const initTradeConvertHistoryPage = () => {
    const page = document.querySelector("[data-trade-convert-history-page]");
    const openBtn = document.querySelector("[data-trade-convert-history-open]");
    if (!page || !openBtn) return;
    const tabBtns = Array.from(
      page.querySelectorAll("[data-trade-convert-history-tab]"),
    );
    const panelsViewport = page.querySelector(
      "[data-trade-convert-history-panels-viewport]",
    );
    const panelsTrack = page.querySelector(
      "[data-trade-convert-history-panels-track]",
    );
    const panels = Array.from(
      panelsTrack?.querySelectorAll("[data-trade-convert-history-panel]") || [],
    );
    const activityDetailPanel = document.querySelector(
      "[data-my-plans-activity-detail-panel]",
    );
    const tabsScroll = page.querySelector("[data-trade-convert-history-tabs-scroll]");
    const tabsIndicator = page.querySelector("[data-trade-convert-history-tabs-indicator]");
    const tabCount = tabBtns.length;

    if (panelsViewport && tabCount > 0) {
      panelsViewport.style.setProperty("--history-tab-count", String(tabCount));
    }

    const syncHistoryTabsIndicator = () => {
      if (!tabsScroll || !tabsIndicator) return;
      const active = tabsScroll.querySelector(".app-header__tab.is-active");
      if (!active) return;
      const tabLeft = active.offsetLeft;
      const tabW = active.offsetWidth;
      const indicatorW = Math.min(24, Math.max(16, tabW - 8));
      const x = tabLeft + (tabW - indicatorW) / 2;
      tabsIndicator.style.width = `${indicatorW}px`;
      tabsIndicator.style.transform = `translateX(${x}px)`;
    };

    const applyHistoryPanelsOffset = (index, instant) => {
      if (!panelsTrack || tabCount <= 0) return;
      const pct = (index / tabCount) * 100;
      if (instant) panelsTrack.classList.add("is-instant");
      panelsTrack.style.transform = `translateX(-${pct}%)`;
      if (instant) {
        requestAnimationFrame(() => {
          panelsTrack.classList.remove("is-instant");
        });
      }
    };

    const setHistoryTab = (tabId, opts = {}) => {
      const { scrollTab = true, instant = false } = opts;
      const idx = tabBtns.findIndex(
        (b) => b.getAttribute("data-trade-convert-history-tab") === tabId,
      );
      if (idx < 0) return;

      tabBtns.forEach((btn, i) => {
        btn.classList.toggle("is-active", i === idx);
      });

      applyHistoryPanelsOffset(idx, instant);

      const activeBtn = tabBtns[idx];
      if (scrollTab && activeBtn && tabsScroll) {
        activeBtn.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
      requestAnimationFrame(() => {
        syncHistoryTabsIndicator();
        requestAnimationFrame(() => syncHistoryTabsIndicator());
      });
    };

    const close = (opts = {}) => {
      if (!page.classList.contains("is-open") && page.hidden) return;
      if (opts.instant) {
        page.classList.remove("is-open");
        page.hidden = true;
        return;
      }
      page.classList.remove("is-open");
      const onEnd = () => {
        if (!page.classList.contains("is-open")) page.hidden = true;
        page.removeEventListener("transitionend", onEnd);
      };
      page.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 320);
    };

    const open = () => {
      document.dispatchEvent(new CustomEvent("fake-keyboard-hide"));
      setHistoryTab("convert", {
        scrollTab: false,
        instant: true,
      });
      page.hidden = false;
      panels.forEach((p) => {
        if (p.getAttribute("data-trade-convert-history-panel") === "convert") {
          p.scrollTop = 0;
        }
      });
      requestAnimationFrame(() => {
        page.classList.add("is-open");
        const activeBtn = tabBtns.find((b) =>
          b.classList.contains("is-active"),
        );
        if (activeBtn && tabsScroll) {
          activeBtn.scrollIntoView({
            behavior: "instant",
            inline: "center",
            block: "nearest",
          });
        }
        syncHistoryTabsIndicator();
        requestAnimationFrame(() => {
          syncHistoryTabsIndicator();
        });
      });
    };

    const setActivityDetailRowVisibility = (visibleKeys = []) => {
      if (!activityDetailPanel) return;
      const visibleSet = new Set(visibleKeys);
      const metaList = activityDetailPanel.querySelector(
        ".my-plans-activity-detail-panel__meta-list",
      );
      const rows = Array.from(
        metaList?.querySelectorAll("[data-my-plans-activity-detail-row]") || [],
      );
      rows.forEach((row) => {
        const key = row.getAttribute("data-my-plans-activity-detail-row");
        if (key === "fee") {
          row.hidden = true;
          return;
        }
        row.hidden = !visibleSet.has(String(key || ""));
      });
      const dividers = Array.from(
        metaList?.querySelectorAll(".my-plans-activity-detail-panel__divider") || [],
      );
      dividers.forEach((divider, idx) => {
        const prev = rows[idx];
        const next = rows[idx + 1];
        divider.hidden =
          !prev ||
          !next ||
          prev.hidden ||
          (next.hidden &&
            next.getAttribute("data-my-plans-activity-detail-row") !== "fee");
      });
    };

    const extractAmountAndCurrency = (rawText) => {
      const text = String(rawText || "").replace(/\s+/g, " ").trim();
      const m = text.match(/([+-]?\s*[\d,]*\.?\d+)\s*([A-Z]{2,8})/);
      if (!m) return { amount: NaN, currency: "" };
      const amount = parseFloat(String(m[1]).replace(/[,\s]/g, ""));
      const currency = String(m[2] || "").trim().toUpperCase();
      return { amount, currency };
    };

    const openConvertHistoryDetail = (row) => {
      if (!activityDetailPanel || !row) return;
      const setText = (selector, value) => {
        const el = activityDetailPanel.querySelector(selector);
        if (!el) return;
        el.textContent = String(value ?? "");
      };
      const titleEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-title]",
      );
      if (titleEl) titleEl.textContent = "Convert order";
      const toLabelEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-to-label]",
      );
      if (toLabelEl) toLabelEl.textContent = "You received";
      const heroDateEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-hero-date]",
      );
      if (heroDateEl) heroDateEl.hidden = false;

      const pairText = String(
        row.querySelector(".trade-convert-history-item__pair")?.textContent || "",
      ).trim();
      const dateText = String(
        row.querySelector(".trade-convert-history-item__date")?.textContent || "",
      ).trim();
      const receiveText = String(
        row.querySelector(".trade-convert-history-item__receive")?.textContent || "",
      ).trim();
      const payText = String(
        row.querySelector(".trade-convert-history-item__pay")?.textContent || "",
      ).trim();
      setText("[data-my-plans-activity-detail-convert-pair]", pairText || "TWD → BTC");
      setText("[data-my-plans-activity-detail-hero-date]", dateText || "18/12/2025, 08:38:29");
      setText("[data-my-plans-activity-detail-from]", payText || "- 5,000.00 TWD");
      setText("[data-my-plans-activity-detail-to]", receiveText || "+ 0.0453 BTC");

      const fromIcon = row.querySelector(".trade-convert-history-item__coin--from");
      const toIcon = row.querySelector(".trade-convert-history-item__coin--to");
      const detailFromIcon = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-icon-from]",
      );
      const detailToIcon = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-icon-to]",
      );
      if (detailFromIcon && fromIcon?.getAttribute("src")) {
        detailFromIcon.setAttribute("src", fromIcon.getAttribute("src"));
      }
      if (detailToIcon && toIcon?.getAttribute("src")) {
        detailToIcon.setAttribute("src", toIcon.getAttribute("src"));
      }

      const payParsed = extractAmountAndCurrency(payText);
      const recvParsed = extractAmountAndCurrency(receiveText);
      let priceText = "1 BTC = 594,004.23 TWD";
      if (
        Number.isFinite(payParsed.amount) &&
        Number.isFinite(recvParsed.amount) &&
        Math.abs(recvParsed.amount) > 0 &&
        payParsed.currency &&
        recvParsed.currency
      ) {
        const unitPrice = Math.abs(payParsed.amount) / Math.abs(recvParsed.amount);
        priceText = `1 ${recvParsed.currency} = ${unitPrice.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${payParsed.currency}`;
      }
      setText("[data-my-plans-activity-detail-avg-price]", priceText);
      setText(
        "[data-my-plans-activity-detail-fee]",
        `3.25159 ${payParsed.currency || "TWD"}`,
      );
      setText("[data-my-plans-activity-detail-order-id]", "1219286689");

      setActivityDetailRowVisibility(["price", "order-id"]);

      // Convert order detail (Figma 11282:7063) does not show auto-invest specific rows.
      ["status", "via-plan", "paid-with"].forEach((k) => {
        const rowEl = activityDetailPanel.querySelector(
          `[data-my-plans-activity-detail-row="${k}"]`,
        );
        if (rowEl) rowEl.hidden = true;
      });

      activityDetailPanel.hidden = false;
      requestAnimationFrame(() => {
        activityDetailPanel.classList.add("is-open");
      });
    };

    const openAutoInvestHistoryDetail = (row) => {
      if (!activityDetailPanel || !row) return;
      const setText = (selector, value) => {
        const el = activityDetailPanel.querySelector(selector);
        if (!el) return;
        el.textContent = String(value ?? "");
      };
      const titleEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-title]",
      );
      if (titleEl) titleEl.textContent = "DCA order";
      const toLabelEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-to-label]",
      );
      if (toLabelEl) toLabelEl.textContent = "To";
      const heroDateEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-hero-date]",
      );
      if (heroDateEl) heroDateEl.hidden = false;

      const pairText = String(
        row.querySelector(".trade-convert-history-item__pair")?.textContent || "",
      ).trim();
      const dateText = String(
        row.querySelector(".trade-convert-history-item__date")?.textContent || "",
      ).trim();
      const receiveText = String(
        row.querySelector(".trade-convert-history-item__receive")?.textContent || "",
      ).trim();
      const payText = String(
        row.querySelector(".trade-convert-history-item__pay")?.textContent || "",
      ).trim();
      setText("[data-my-plans-activity-detail-convert-pair]", pairText || "TWD → BTC");
      setText(
        "[data-my-plans-activity-detail-hero-date]",
        dateText || "18/12/2025, 08:38:29",
      );
      setText("[data-my-plans-activity-detail-from]", payText || "- 5,000.00 TWD");
      setText("[data-my-plans-activity-detail-to]", receiveText || "+ 0.0453 BTC");

      const fromIcon = row.querySelector(".trade-convert-history-item__coin--from");
      const toIcon = row.querySelector(".trade-convert-history-item__coin--to");
      const detailFromIcon = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-icon-from]",
      );
      const detailToIcon = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-icon-to]",
      );
      if (detailFromIcon && fromIcon?.getAttribute("src")) {
        detailFromIcon.setAttribute("src", fromIcon.getAttribute("src"));
      }
      if (detailToIcon && toIcon?.getAttribute("src")) {
        detailToIcon.setAttribute("src", toIcon.getAttribute("src"));
      }

      const payParsed = extractAmountAndCurrency(payText);
      const recvParsed = extractAmountAndCurrency(receiveText);
      let priceText = "1 BTC = 594,004.23 TWD";
      if (
        Number.isFinite(payParsed.amount) &&
        Number.isFinite(recvParsed.amount) &&
        Math.abs(recvParsed.amount) > 0 &&
        payParsed.currency &&
        recvParsed.currency
      ) {
        const unitPrice = Math.abs(payParsed.amount) / Math.abs(recvParsed.amount);
        priceText = `1 ${recvParsed.currency} = ${unitPrice.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${payParsed.currency}`;
      }
      setText("[data-my-plans-activity-detail-avg-price]", priceText);
      setText(
        "[data-my-plans-activity-detail-fee]",
        `3.25159 ${payParsed.currency || "TWD"}`,
      );
      setText("[data-my-plans-activity-detail-order-id]", "1453537");
      setText("[data-my-plans-activity-detail-plan-id]", "5419286689");
      setText(
        "[data-my-plans-activity-detail-paid-with]",
        `pre-funded ${payParsed.currency || "TWD"}`,
      );

      setActivityDetailRowVisibility([
        "price",
        "order-id",
        "via-plan",
        "paid-with",
      ]);
      ["status", "date"].forEach((k) => {
        const rowEl = activityDetailPanel.querySelector(
          `[data-my-plans-activity-detail-row="${k}"]`,
        );
        if (rowEl) rowEl.hidden = true;
      });
      const metaList = activityDetailPanel.querySelector(
        ".my-plans-activity-detail-panel__meta-list",
      );
      const rows = Array.from(
        metaList?.querySelectorAll("[data-my-plans-activity-detail-row]") || [],
      );
      const dividers = Array.from(
        metaList?.querySelectorAll(".my-plans-activity-detail-panel__divider") || [],
      );
      dividers.forEach((divider, idx) => {
        const prev = rows[idx];
        const next = rows[idx + 1];
        divider.hidden =
          !prev ||
          !next ||
          prev.hidden ||
          (next.hidden &&
            next.getAttribute("data-my-plans-activity-detail-row") !== "fee");
      });

      activityDetailPanel.hidden = false;
      requestAnimationFrame(() => {
        activityDetailPanel.classList.add("is-open");
      });
    };

    openBtn.addEventListener("click", open);
    tabsScroll?.addEventListener("scroll", () => syncHistoryTabsIndicator(), {
      passive: true,
    });
    window.addEventListener("resize", () => {
      if (page.classList.contains("is-open")) syncHistoryTabsIndicator();
    });
    tabBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        setHistoryTab(btn.getAttribute("data-trade-convert-history-tab"));
      });
    });
    page
      .querySelectorAll("[data-trade-convert-history-open-detail]")
      .forEach((rowBtn) => {
        rowBtn.addEventListener("click", () => openConvertHistoryDetail(rowBtn));
      });
    page
      .querySelectorAll("[data-trade-convert-history-open-auto-invest-detail]")
      .forEach((rowBtn) => {
        rowBtn.addEventListener("click", () =>
          openAutoInvestHistoryDetail(rowBtn),
        );
      });
    page
      .querySelectorAll("[data-trade-convert-history-close]")
      .forEach((btn) => {
        btn.addEventListener("click", close);
      });
    setHistoryTab("convert", { scrollTab: false, instant: true });
  };

  const initTradeConvertHistoryCurrencySheet = () => {
    const sheet = document.querySelector(
      "[data-trade-convert-history-currency-sheet]",
    );
    if (!sheet) return;
    const searchInput = sheet.querySelector(
      "[data-trade-convert-history-currency-search]",
    );
    const options = Array.from(
      sheet.querySelectorAll("[data-trade-convert-history-currency-option]"),
    );
    const allOption = sheet.querySelector(
      '[data-trade-convert-history-currency-option="all"]',
    );
    const triggers = Array.from(
      document.querySelectorAll(
        "[data-trade-convert-history-filter-currency-trigger]",
      ),
    );
    let selectedValue = "all";
    let currencySheetScope = "default";
    const RADIO_OFF_ICON = "assets/icon_radio_off.svg";
    const RADIO_ON_ICON = "assets/icon_radio_on.svg";
    const ALL_CURRENCIES_LABEL = "All currencies";
    const ALL_PAIRS_LABEL = "All pairs";

    const getHistoryPanelId = (el) =>
      String(
        el?.closest?.("[data-trade-convert-history-panel]")?.getAttribute(
          "data-trade-convert-history-panel",
        ) || "",
      );

    const getAllFilterLabel = (scope) =>
      scope === "convert" ? ALL_PAIRS_LABEL : ALL_CURRENCIES_LABEL;

    const syncHistoryCurrencyFilterLabels = () => {
      document
        .querySelectorAll("[data-trade-convert-history-panel]")
        .forEach((panel) => {
          const label = panel.querySelector(
            "[data-trade-convert-history-filter-currency-label]",
          );
          if (!label) return;
          const panelId = panel.getAttribute("data-trade-convert-history-panel");
          label.textContent = getAllFilterLabel(
            panelId === "convert" ? "convert" : "default",
          );
        });
    };

    const syncSheetAllOptionLabel = (scope) => {
      if (!allOption) return;
      const label = getAllFilterLabel(scope);
      allOption.setAttribute(
        "data-trade-convert-history-currency-option-label",
        label,
      );
      const nameEl = allOption.querySelector(
        ".trade-convert-history-currency-sheet__name",
      );
      if (nameEl) nameEl.textContent = label;
    };

    const applySelected = (value) => {
      selectedValue = value;
      options.forEach((opt) => {
        const isSelected =
          opt.getAttribute("data-trade-convert-history-currency-option") === value;
        opt.classList.toggle("is-selected", isSelected);
        const radioImg = opt.querySelector(
          ".trade-convert-history-currency-sheet__radio",
        );
        if (radioImg) radioImg.setAttribute("src", isSelected ? RADIO_ON_ICON : RADIO_OFF_ICON);
      });
      syncHistoryCurrencyFilterLabels();
      syncSheetAllOptionLabel(currencySheetScope);
    };

    const close = (opts = {}) => {
      const finish = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
      };
      if (opts.instant) {
        sheet.style.transition = "none";
        sheet.classList.remove("is-open");
        void sheet.offsetHeight;
        sheet.style.transition = "";
        finish();
        return;
      }
      sheet.classList.remove("is-open");
      const onEnd = () => {
        sheet.removeEventListener("transitionend", onEnd);
        finish();
      };
      sheet.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 360);
    };

    const open = () => {
      if (searchInput) searchInput.value = "";
      options.forEach((opt) => {
        opt.hidden = false;
      });
      applySelected(selectedValue);
      sheet.hidden = false;
      requestAnimationFrame(() => {
        sheet.classList.add("is-open");
      });
      requestAnimationFrame(() => {
        searchInput?.focus();
      });
    };

    triggers.forEach((btn) => {
      btn.addEventListener("click", () => {
        const panelId = getHistoryPanelId(btn);
        currencySheetScope = panelId === "convert" ? "convert" : "default";
        syncSheetAllOptionLabel(currencySheetScope);
        open();
      });
    });
    sheet
      .querySelectorAll("[data-trade-convert-history-currency-close]")
      .forEach((btn) => {
        btn.addEventListener("click", close);
      });
    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        applySelected("all");
        close();
      });
    });
    searchInput?.addEventListener("input", () => {
      const q = String(searchInput.value || "")
        .trim()
        .toLowerCase();
      options.forEach((opt) => {
        const label = String(
          opt.getAttribute("data-trade-convert-history-currency-option-label") ||
            "",
        ).toLowerCase();
        opt.hidden = !!q && !label.includes(q);
      });
    });

    syncHistoryCurrencyFilterLabels();
    applySelected(selectedValue);
  };

  const initTradeConvertHistoryTimeSheet = () => {
    const sheet = document.querySelector("[data-trade-convert-history-time-sheet]");
    if (!sheet) return;
    const panel = sheet.querySelector(".currency-sheet__panel");
    if (!panel) return;
    const options = Array.from(
      sheet.querySelectorAll("[data-trade-convert-history-time-option]"),
    );
    const triggers = Array.from(
      document.querySelectorAll("[data-trade-convert-history-filter-time-trigger]"),
    );
    const triggerLabels = Array.from(
      document.querySelectorAll("[data-trade-convert-history-filter-time-label]"),
    );
    const RADIO_OFF_ICON = "assets/icon_radio_off.svg";
    const RADIO_ON_ICON = "assets/icon_radio_on.svg";
    let selectedValue = "All time";

    const applySelected = (value) => {
      selectedValue = value;
      options.forEach((opt) => {
        const optionValue =
          opt.getAttribute("data-trade-convert-history-time-option") || "";
        const isSelected = optionValue === value;
        opt.classList.toggle("is-selected", isSelected);
        const radioEl = opt.querySelector(
          ".trade-convert-history-time-sheet__item-radio",
        );
        if (radioEl) radioEl.setAttribute("src", isSelected ? RADIO_ON_ICON : RADIO_OFF_ICON);
      });
      triggerLabels.forEach((el) => {
        el.textContent = selectedValue;
      });
    };

    const open = () => {
      applySelected(selectedValue);
      sheetOpenWithInstantBackdrop(sheet);
    };

    const close = () => {
      sheetCloseWithBackdropHandoff(sheet, panel);
    };

    triggers.forEach((btn) => {
      btn.addEventListener("click", open);
    });
    sheet
      .querySelectorAll("[data-trade-convert-history-time-close]")
      .forEach((btn) => {
        btn.addEventListener("click", close);
      });
    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        const value =
          opt.getAttribute("data-trade-convert-history-time-option") || "All time";
        applySelected(value);
        close();
      });
    });

    applySelected(selectedValue);
  };

  let ensureFinanceModulesInited = () => {};
  let ensureConvertModulesInited = () => {};

  let convertModulesInited = false;
  ensureConvertModulesInited = () => {
    if (convertModulesInited) return;
    convertModulesInited = true;
    initTradeConvertPage();
    initTradeConvertRatePanel();
    initTradeConvertConfirmSheet();
    initTradeConvertHistoryPage();
    initTradeConvertHistoryCurrencySheet();
    initTradeConvertHistoryTimeSheet();
  };

  const initFinanceSectionNav = () => {
    const loanPage = document.querySelector('[data-finance-page="loan"]');
    const nav = loanPage?.querySelector("[data-finance-section-nav]");
    if (!nav) return;

    const buttons = Array.from(nav.querySelectorAll("[data-finance-section]"));
    const views = Array.from(loanPage.querySelectorAll("[data-finance-view]"));

    const setSection = (sectionId) => {
      buttons.forEach((btn) =>
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-finance-section") === sectionId,
        ),
      );
      views.forEach((view) => {
        view.hidden = view.getAttribute("data-finance-view") !== sectionId;
      });
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sectionId = btn.getAttribute("data-finance-section");
        if (sectionId === "ongoing") {
          document.dispatchEvent(new CustomEvent("auth-signup-open"));
          return;
        }
        setSection(sectionId);
      });
    });

    setSection("explore");

    const loanHowItWorks = loanPage?.querySelector(".finance-loan-hero__link");
    const container = document.querySelector(".phone-container");
    let loanSnackbarTimeout = null;
    const showLoanSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
      if (!snackbar) return;
      const text = snackbar.querySelector("[data-snackbar-text]");
      if (text) text.textContent = message;
      if (loanSnackbarTimeout) {
        clearTimeout(loanSnackbarTimeout);
        loanSnackbarTimeout = null;
      }
      snackbar.hidden = false;
      snackbar.classList.remove("is-visible");
      void snackbar.offsetWidth;
      requestAnimationFrame(() => snackbar.classList.add("is-visible"));
      loanSnackbarTimeout = setTimeout(() => {
        snackbar.classList.remove("is-visible");
        loanSnackbarTimeout = setTimeout(() => {
          if (!snackbar.classList.contains("is-visible")) snackbar.hidden = true;
        }, 320);
      }, 2200);
    };

    loanHowItWorks?.addEventListener("click", () =>
      showLoanSnackbar("Not in prototype"),
    );
  };

  const initFinanceEarnPage = () => {
    if (initFinanceEarnPage._inited) return;
    const earnPage = document.querySelector('[data-finance-page="earn"]');
    const nav = earnPage?.querySelector("[data-finance-earn-nav]");
    if (!nav || !earnPage) return;
    initFinanceEarnPage._inited = true;

    const buttons = Array.from(nav.querySelectorAll("[data-finance-earn-section]"));
    const views = Array.from(earnPage.querySelectorAll("[data-finance-earn-view]"));

    const setSection = (sectionId) => {
      buttons.forEach((btn) =>
        btn.classList.toggle(
          "is-active",
          btn.getAttribute("data-finance-earn-section") === sectionId,
        ),
      );
      views.forEach((view) => {
        view.hidden = view.getAttribute("data-finance-earn-view") !== sectionId;
      });
    };

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const sectionId = btn.getAttribute("data-finance-earn-section");
        if (!sectionId) return;
        if (sectionId === "portfolio") {
          document.dispatchEvent(new CustomEvent("auth-signup-open"));
          return;
        }
        setSection(sectionId);
      });
    });

    const container = document.querySelector(".phone-container");
    earnPage.querySelectorAll("[data-finance-not-in-prototype]").forEach((el) => {
      el.addEventListener("click", () => {
        const snackbar = container?.querySelector("[data-snackbar]");
        const text = snackbar?.querySelector("[data-snackbar-text]");
        if (!snackbar || !text) return;
        text.textContent = "Not in prototype";
        snackbar.hidden = false;
        snackbar.classList.remove("is-visible");
        void snackbar.offsetWidth;
        requestAnimationFrame(() => snackbar.classList.add("is-visible"));
        setTimeout(() => snackbar.classList.remove("is-visible"), 2200);
      });
    });

    setSection("products");
  };

  /** Carousel / widget keys → tickers + icons for “historic performance” column (matches plan detail baskets). */
  const PLAN_DISPLAY_ASSETS_BY_KEY = {
    bitcoin: [
      { name: "Bitcoin", ticker: "BTC", icon: "assets/icon_currency_btc.svg" },
    ],
    ethereum: [
      { name: "Ethereum", ticker: "ETH", icon: "assets/icon_currency_eth.svg" },
    ],
    solana: [{ name: "Solana", ticker: "SOL", icon: "assets/icon_solana.svg" }],
    bigthree: [
      { name: "Bitcoin", ticker: "BTC", icon: "assets/icon_currency_btc.svg" },
      { name: "Ethereum", ticker: "ETH", icon: "assets/icon_currency_eth.svg" },
      { name: "Solana", ticker: "SOL", icon: "assets/icon_solana.svg" },
    ],
    digitalgold: [
      { name: "Bitcoin", ticker: "BTC", icon: "assets/icon_currency_btc.svg" },
      {
        name: "Tether Gold",
        ticker: "XAUT",
        icon: "assets/icon_currency_xaut.svg",
      },
    ],
    aiessentials: [
      {
        name: "Render",
        ticker: "RENDER",
        icon: "assets/icon_currency_render.svg",
      },
      { name: "NEAR", ticker: "NEAR", icon: "assets/icon_currency_near.svg" },
      { name: "Solana", ticker: "SOL", icon: "assets/icon_solana.svg" },
    ],
  };
  Object.assign(PLAN_DISPLAY_ASSETS_BY_KEY, {
    btc: PLAN_DISPLAY_ASSETS_BY_KEY.bitcoin,
    eth: PLAN_DISPLAY_ASSETS_BY_KEY.ethereum,
    sol: PLAN_DISPLAY_ASSETS_BY_KEY.solana,
    xaut: [
      {
        name: "Tether Gold",
        ticker: "XAUT",
        icon: "assets/icon_currency_xaut.svg",
      },
    ],
    render: [
      {
        name: "Render",
        ticker: "RENDER",
        icon: "assets/icon_currency_render.svg",
      },
    ],
    near: [
      { name: "NEAR", ticker: "NEAR", icon: "assets/icon_currency_near.svg" },
    ],
    link: [
      {
        name: "Chainlink",
        ticker: "LINK",
        icon: "assets/icon_currency_link.svg",
      },
    ],
    xrp: [{ name: "XRP", ticker: "XRP", icon: "assets/icon_currency_xrp.svg" }],
    ondo: [
      { name: "Ondo", ticker: "ONDO", icon: "assets/icon_currency_btc.svg" },
    ],
    pol: [
      { name: "Polkadot", ticker: "POL", icon: "assets/icon_currency_btc.svg" },
    ],
    ada: [
      { name: "Cardano", ticker: "ADA", icon: "assets/icon_currency_btc.svg" },
    ],
    aave: [
      { name: "Aave", ticker: "AAVE", icon: "assets/icon_currency_btc.svg" },
    ],
  });

  /** Historic column caption: one asset → "BTC performance"; 2+ → "Comb. performance". */
  const buildHistoricPerformanceCaption = (assets) => {
    const tickers = (assets || [])
      .map((it) => String(it?.ticker || "").trim())
      .filter(Boolean)
      .slice(0, 3);
    if (!tickers.length) return "Price change";
    if (tickers.length === 1) return `Price change`;
    return "Price change";
  };

  const escReturnMetricAttr = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");

  /**
   * Expand [monthIndex, usd] knots into 60 monthly USD levels (~Jan 2020 → month 59 ≈ late 2024).
   * Piecewise linear; rough crypto / gold shapes for the plan DCA prototype (not live or exact data).
   */
  const expandPrototypeHistoricKnotsToMonthly60 = (knots) => {
    const sorted = [...knots].sort((a, b) => a[0] - b[0]);
    const last = sorted.length - 1;
    const out = new Array(60);
    for (let m = 0; m < 60; m += 1) {
      if (m <= sorted[0][0]) {
        out[m] = sorted[0][1];
        continue;
      }
      if (m >= sorted[last][0]) {
        out[m] = sorted[last][1];
        continue;
      }
      let i = 0;
      while (i < last && m > sorted[i + 1][0]) i += 1;
      const [m0, p0] = sorted[i];
      const [m1, p1] = sorted[i + 1];
      const t = (m - m0) / (m1 - m0);
      out[m] = p0 + t * (p1 - p0);
    }
    return out;
  };

  /** Monthly USD reference series for `updatePlanStrategyHistoricalReturn` (indices 0…59). */
  const PROTOTYPE_HISTORIC_MONTHLY_USD = {
    bitcoin: expandPrototypeHistoricKnotsToMonthly60([
      [0, 8300],
      [2, 5200],
      [5, 9800],
      [10, 13200],
      [14, 29500],
      [18, 58000],
      [22, 33500],
      [26, 47500],
      [28, 59000],
      [32, 36500],
      [36, 16800],
      [40, 23200],
      [44, 30500],
      [48, 42800],
      [52, 53500],
      [56, 62800],
      [59, 69800],
    ]),
    ethereum: expandPrototypeHistoricKnotsToMonthly60([
      [0, 145],
      [2, 88],
      [6, 245],
      [12, 390],
      [16, 1850],
      [20, 4150],
      [24, 2250],
      [28, 3050],
      [32, 1080],
      [36, 1180],
      [40, 1580],
      [44, 1880],
      [48, 2380],
      [52, 2520],
      [56, 2620],
      [59, 2720],
    ]),
    solana: expandPrototypeHistoricKnotsToMonthly60([
      [0, 1.12],
      [4, 1.55],
      [8, 4.5],
      [12, 18],
      [16, 155],
      [20, 218],
      [24, 34],
      [28, 12],
      [32, 8.5],
      [36, 12.5],
      [40, 24],
      [44, 62],
      [48, 108],
      [52, 142],
      [56, 175],
      [59, 198],
    ]),
    digitalgold: expandPrototypeHistoricKnotsToMonthly60([
      [0, 1540],
      [10, 1690],
      [20, 1840],
      [30, 1920],
      [40, 1990],
      [50, 2320],
      [59, 2650],
    ]),
    /** Prototype S&P-style index (same 60-month grid as crypto) for breakdown chart benchmark line. */
    sp500: expandPrototypeHistoricKnotsToMonthly60([
      [0, 100],
      [2, 78], // early drawdown
      [10, 138], // strong recovery + melt-up
      [18, 172],
      [24, 186],
      [31, 132], // 2022-style pullback
      [38, 158],
      [45, 195],
      [52, 223],
      [59, 246],
    ]),
  };

  const HISTORIC_SIM_MONTHS = 60;

  /** USD index price at integer month — shared by `updatePlanStrategyHistoricalReturn` and breakdown chart. */
  const historicIndexUsdAtMonth = (planKey, m) => {
    const months = HISTORIC_SIM_MONTHS;
    const mm = clamp(m, 0, months - 1);
    const usdAt = (series, idx) => {
      const arr =
        PROTOTYPE_HISTORIC_MONTHLY_USD[series] ||
        PROTOTYPE_HISTORIC_MONTHLY_USD.bitcoin;
      return arr[idx];
    };
    const pk = String(planKey || "bitcoin").toLowerCase();
    if (pk === "bigthree") {
      const btc = usdAt("bitcoin", mm);
      const eth = usdAt("ethereum", mm);
      const sol = usdAt("solana", mm);
      const btc0 = usdAt("bitcoin", 0);
      const eth0 = usdAt("ethereum", 0);
      const sol0 = usdAt("solana", 0);
      return (
        100 * ((btc / btc0) * 0.45 + (eth / eth0) * 0.35 + (sol / sol0) * 0.2)
      );
    }
    if (pk === "aiessentials") {
      const btc = usdAt("bitcoin", mm);
      const eth = usdAt("ethereum", mm);
      const sol = usdAt("solana", mm);
      const btc0 = usdAt("bitcoin", 0);
      const eth0 = usdAt("ethereum", 0);
      const sol0 = usdAt("solana", 0);
      return (
        100 * ((btc / btc0) * 0.2 + (eth / eth0) * 0.3 + (sol / sol0) * 0.5)
      );
    }
    if (pk === "sp500") return usdAt("sp500", mm);
    const seriesKey = PROTOTYPE_HISTORIC_MONTHLY_USD[pk] ? pk : "bitcoin";
    return usdAt(seriesKey, mm);
  };

  const historicIndexUsdAtFractionalMonth = (planKey, t) => {
    const months = HISTORIC_SIM_MONTHS;
    const tt = clamp(t, 0, months - 1);
    const m0 = Math.floor(tt);
    const u = tt - m0;
    if (m0 >= months - 1) {
      return historicIndexUsdAtMonth(planKey, months - 1);
    }
    const p0 = historicIndexUsdAtMonth(planKey, m0);
    const p1 = historicIndexUsdAtMonth(planKey, m0 + 1);
    return p0 + u * (p1 - p0);
  };

  const planHistoricFxMultiplier = () => {
    const fxTwdPerUsd = 32;
    const isUsdt =
      (typeof currencyState !== "undefined" ? currencyState.plan : "TWD") ===
      "USDT";
    return isUsdt ? 1 : fxTwdPerUsd;
  };

  const activeAnchorPlanFromCarouselKey = (activePlan) => {
    const map = {
      btc: "bitcoin",
      eth: "ethereum",
      xaut: "digitalgold",
      sol: "solana",
      render: "solana",
      near: "solana",
      link: "solana",
      ondo: "solana",
      pol: "solana",
      xrp: "solana",
      aave: "solana",
      ada: "solana",
    };
    const key = String(activePlan || "bitcoin").toLowerCase();
    return map[key] || key;
  };

  /**
   * Month-end DCA series for the breakdown chart: strategy portfolio value, cumulative invested (same as stats row),
   * and S&P prototype DCA portfolio value — all in plan currency (TWD / USDT after fx).
   * @returns {{ strategyValue: number[], sp500Value: number[], investedValue: number[], xYears: string[], yTicks: number[], yMax: number }}
   */
  const computePlanBreakdownChartSeries = ({
    amount,
    planKey,
    freq,
    historicalRangeKey,
  }) => {
    const months = HISTORIC_SIM_MONTHS;
    const rangeMonthsMap = { "5Y": 60, "3Y": 36, "1Y": 12 };
    const simRangeKey =
      historicalRangeKey ||
      (typeof rangeState !== "undefined" ? rangeState.plan : "5Y") ||
      "5Y";
    const periodMonths = rangeMonthsMap[simRangeKey] || 60;
    const startMonth = months - periodMonths;
    const fx = planHistoricFxMultiplier();
    const pkLower = String(planKey || "bitcoin").toLowerCase();
    const activeAnchorPlan = activeAnchorPlanFromCarouselKey(pkLower);

    const occurrencesPerMonth = (() => {
      if (freq === "daily") return 365.0 / 12.0;
      if (freq === "weekly") return 52.0 / 12.0;
      return 1.0;
    })();

    const runDcaMonthSeries = (pricePlanKey) => {
      let assetAccum = 0;
      let totalInvested = 0;
      const out = [];
      if (freq === "monthly") {
        for (let m = startMonth; m < months; m += 1) {
          const priceLocal = historicIndexUsdAtMonth(pricePlanKey, m) * fx;
          if (priceLocal > 0) {
            assetAccum += amount / priceLocal;
            totalInvested += amount;
          }
          const endPrice = historicIndexUsdAtMonth(pricePlanKey, m) * fx;
          const value = assetAccum * endPrice;
          out.push({
            cumInv: totalInvested,
            value,
          });
        }
        return out;
      }
      const numBuys = Math.max(
        1,
        Math.round(periodMonths * occurrencesPerMonth),
      );
      const span = months - 1 - startMonth;
      const states = [];
      for (let k = 0; k < numBuys; k += 1) {
        const tt =
          numBuys === 1 ? startMonth : startMonth + (k / (numBuys - 1)) * span;
        const priceLocal =
          historicIndexUsdAtFractionalMonth(pricePlanKey, tt) * fx;
        if (priceLocal <= 0) continue;
        assetAccum += amount / priceLocal;
        totalInvested += amount;
        const mark = historicIndexUsdAtFractionalMonth(pricePlanKey, tt) * fx;
        states.push({ t: tt, cumInv: totalInvested, value: assetAccum * mark });
      }
      for (let m = startMonth; m < months; m += 1) {
        const cutoff = m + 1 - 1e-9;
        const last = [...states].filter((s) => s.t <= cutoff).pop() || {
          cumInv: 0,
          value: 0,
        };
        out.push({
          cumInv: last.cumInv,
          value: last.value,
        });
      }
      return out;
    };

    const stratRows = runDcaMonthSeries(activeAnchorPlan);
    const spRows = runDcaMonthSeries("sp500");
    const n = stratRows.length;
    if (!n) {
      return {
        strategyValue: [0],
        sp500Value: [0],
        investedValue: [0],
        xYears: [String(2020)],
        yTicks: [0, 1, 2, 3],
        yMax: 3,
      };
    }
    const strategyValue = stratRows.map((r) => r.value);
    const sp500Value = spRows.map((r) => r.value);
    const investedValue = stratRows.map((r) => r.cumInv);

    const baseYear = 2020;
    const xYears = stratRows.map((_, i) =>
      String(baseYear + Math.floor((startMonth + i) / 12)),
    );

    const rawPeak = Math.max(
      1,
      ...strategyValue,
      ...sp500Value,
      ...investedValue,
    );
    // Keep top headroom tight while still using readable "nice" axis steps.
    const padded = rawPeak * 1.02;
    const exp = Math.floor(Math.log10(Math.max(padded, 1)));
    const unit = 10 ** exp;
    const niceSteps = [1, 1.2, 1.5, 1.8, 2, 2.5, 3, 4, 5, 6, 7.5, 8, 10];
    const yMax =
      niceSteps.map((s) => s * unit).find((v) => v >= padded) || 12 * unit;
    const yTicks = [0, Math.round(yMax / 3), Math.round((2 * yMax) / 3), yMax];

    return { strategyValue, sp500Value, investedValue, xYears, yTicks, yMax };
  };

  const BREAKDOWN_CHART_VIEW = {
    w: 299,
    h: 177,
    left: 2.5,
    right: 262,
    top: 18,
    bottom: 150,
  };

  const formatBreakdownChartYTick = (n) => {
    const abs = Math.abs(n);
    const round1 = (x) => {
      const r = Math.round(x * 10) / 10;
      return Number.isInteger(r) ? r.toString() : r.toString();
    };
    if (abs < 1) return "0";
    if (abs < 10000)
      return abs.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (abs < 1000000) return `${round1(abs / 1000)}K`;
    return `${round1(abs / 1000000)}M`;
  };

  const renderPlanBreakdownChartSvg = (svgEl, series) => {
    if (!svgEl || !series) return;
    const { strategyValue, sp500Value, investedValue, xYears, yTicks, yMax } =
      series;
    const showSp500 = getPrototypeBreakdownSp500Visible();
    const n = strategyValue.length;
    const { w, h, left, right, top, bottom } = BREAKDOWN_CHART_VIEW;
    const xAt = (i) => (n <= 1 ? left : left + (i / (n - 1)) * (right - left));
    const yScaleMax = yMax > 0 ? yMax : 1;
    const yAt = (v) =>
      bottom - (clamp(v, 0, yScaleMax) / yScaleMax) * (bottom - top);

    const pathFrom = (arr) => {
      if (!arr.length) return "";
      return arr
        .map(
          (v, i) =>
            `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(2)} ${yAt(v).toFixed(2)}`,
        )
        .join(" ");
    };
    const circlesFor = (arr, color) => {
      if (!arr.length) return "";
      const firstX = xAt(0);
      const firstY = yAt(arr[0]);
      if (arr.length === 1) {
        return `<circle cx="${firstX.toFixed(2)}" cy="${firstY.toFixed(2)}" r="2.5" fill="${color}" />`;
      }
      const lastX = xAt(arr.length - 1);
      const lastY = yAt(arr[arr.length - 1]);
      return [
        `<circle cx="${firstX.toFixed(2)}" cy="${firstY.toFixed(2)}" r="2.5" fill="${color}" />`,
        `<circle cx="${lastX.toFixed(2)}" cy="${lastY.toFixed(2)}" r="2.5" fill="${color}" />`,
      ].join("");
    };

    const yearLabels = [];
    const seenY = new Set();
    for (let i = 0; i < n; i += 1) {
      const y = xYears[i];
      if (!seenY.has(y)) {
        seenY.add(y);
        yearLabels.push({ text: y, x: xAt(i) });
      }
    }

    const yLabelX = right + 4;
    const yLabelsHtml = yTicks
      .map((tick) => {
        const yy = yAt(tick);
        const label = tick <= 0 ? "0" : formatBreakdownChartYTick(tick);
        return `<text x="${yLabelX}" y="${yy + 4}" fill="#58595A" font-size="10" font-weight="600">${label}</text>`;
      })
      .join("");

    const xLabelsHtml = yearLabels
      .map(({ text }, idx) => {
        const nLabels = yearLabels.length;
        const isFirst = idx === 0;
        const isLast = idx === nLabels - 1;
        const anchor = isFirst ? "start" : isLast ? "end" : "middle";
        const xx =
          nLabels <= 1 ? left : left + (idx / (nLabels - 1)) * (right - left);
        return `<text x="${xx}" y="${bottom + 14}" fill="#58595A" font-size="11" font-weight="600" text-anchor="${anchor}">${text}</text>`;
      })
      .join("");

    const gridHtml = yTicks
      .map((tick) => {
        const yy = yAt(tick);
        return `<path d="M${left} ${yy}H${right}" stroke="#3C4248" />`;
      })
      .join("");

    svgEl.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svgEl.innerHTML = `
      <path d="M${left} ${bottom}H${right}" stroke="#3C4248" />
      <path d="M${right} ${top}V${bottom}" stroke="#3C4248" />
      ${gridHtml}
      <path d="${pathFrom(investedValue)}" stroke="#ffffff" stroke-width="2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      ${showSp500 ? `<path d="${pathFrom(sp500Value)}" stroke="#275CFD" stroke-width="2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />` : ""}
      <path d="${pathFrom(strategyValue)}" stroke="#8FB8FF" stroke-width="2" fill="none" stroke-linecap="round" vector-effect="non-scaling-stroke" />
      ${circlesFor(investedValue, "#ffffff")}
      ${showSp500 ? circlesFor(sp500Value, "#275CFD") : ""}
      ${circlesFor(strategyValue, "#8FB8FF")}
      ${xLabelsHtml}
      ${yLabelsHtml}
    `;
  };

  /**
   * Same pyramid stack as `plan-detail-panel__product-icon-wrap` (single / 2 / 3 assets), compact size via CSS.
   */
  /**
   * Builds historic return icon markup plus a stable signature. Prefer the signature over
   * `innerHTML` string compare — browsers normalize serialized HTML (attribute order, etc.),
   * so `el.innerHTML !== template` is almost always true after first paint and caused icon flicker
   * on every slider tick.
   */
  const buildReturnMetricProductIconWrap = (assets, fallbackIcon) => {
    const items = (assets || []).slice(0, 3).filter((a) => a && a.icon);
    const fb = fallbackIcon || "assets/icon_currency_btc.svg";
    const singleClass =
      "plan-detail-panel__product-icon plan-return-metric__product-icon";
    let inner;
    let sig;
    if (items.length >= 2) {
      const twoOnly = items.length === 2;
      const mod = twoOnly ? " plan-detail-panel__icon-stack--two" : "";
      const baseClass = `plan-detail-panel__icon-stack${mod}`;
      const [a, b, c] = [items[0], items[1], items[2]];
      const br = c?.icon
        ? `<img src="${escReturnMetricAttr(c.icon)}" alt="" />`
        : '<span class="plan-detail-panel__icon-stack-placeholder" aria-hidden="true"></span>';
      inner = `<div class="${baseClass}" aria-hidden="true"><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--top"><img src="${escReturnMetricAttr(a.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--bl"><img src="${escReturnMetricAttr(b.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--br">${br}</div></div>`;
      sig = `m${items.length}:${items.map((it) => it.icon).join(":")}`;
    } else {
      const src = items.length === 1 ? items[0].icon : fb;
      inner = `<img class="${singleClass}" src="${escReturnMetricAttr(src)}" alt="" />`;
      sig = `s:${src}`;
    }
    const html = `<div class="plan-detail-panel__product-icon-wrap plan-return-metric__product-icon-wrap" aria-hidden="true">${inner}</div>`;
    return { html, sig };
  };

  const buildReturnMetricProductIconWrapHtml = (assets, fallbackIcon) =>
    buildReturnMetricProductIconWrap(assets, fallbackIcon).html;

  /** Avoid replacing markup when layout is unchanged (prevents icon flicker on slider/input updates). */
  const setReturnMetricIconWrapHtml = (el, html, opts = {}) => {
    if (!el) return;
    const { layoutSig } = opts;
    if (layoutSig !== undefined) {
      if (el.dataset.returnMetricIconSig === layoutSig) return;
      if (layoutSig === "") delete el.dataset.returnMetricIconSig;
      else el.dataset.returnMetricIconSig = layoutSig;
      if (el.innerHTML !== html) el.innerHTML = html;
      return;
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  };

  const RETURN_METRIC_ARROW_HIST_POS = "assets/icon_northeast_arrow.svg";
  const RETURN_METRIC_ARROW_HIST_NEG = "assets/icon_dark_negativearrow.svg";

  const setReturnMetricTone = (root, value) => {
    if (!root) return;
    const pos = Number(value) >= 0;
    root.classList.toggle("plan-return-metric__group--loss", !pos);
    const histArrow = root.querySelector(
      ".plan-return-metric__arrow--historic",
    );
    if (histArrow) {
      histArrow.src = pos
        ? RETURN_METRIC_ARROW_HIST_POS
        : RETURN_METRIC_ARROW_HIST_NEG;
      histArrow.classList.remove("plan-return-metric__arrow--down");
      return;
    }
    const simArrow = root.querySelector(
      ".plan-return-metric__arrow--simulated",
    );
    if (simArrow) {
      simArrow.classList.toggle("plan-return-metric__arrow--down", !pos);
      return;
    }
    const arrow = root.querySelector(".plan-return-metric__arrow");
    if (arrow) arrow.classList.toggle("plan-return-metric__arrow--down", !pos);
  };

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.detailPanel] — write to plan-detail footer only (do not change main widget)
   * @param {number} [opts.amount] — override slider amount
   * @param {string} [opts.planKey] — override carousel plan (e.g. curated basket)
   * @param {string} [opts.freq] — 'daily' | 'weekly' | 'monthly' (override active freq chip)
   * @param {'1Y'|'3Y'|'5Y'} [opts.historicalRangeKey] — simulation window (defaults to rangeState.plan)
   * @param {{ ticker?: string, icon?: string }[]} [opts.displayAssets] — icons/labels for historic column (plan detail)
   * @param {boolean} [opts.domWrite=true] — when false, only compute and return { returnPct, historicReturnPct, profit, totalInvested }
   */
  const updatePlanStrategyHistoricalReturn = (opts = {}) => {
    const detailPanel = !!opts.detailPanel;
    const domWrite = opts.domWrite !== false;
    const pctEl = detailPanel
      ? document.querySelector("[data-plan-detail-return-pct]")
      : document.querySelector(
          ".plan-strategy__return-metrics-col--strategy.plan-strategy__return-metrics-col--values .plan-strategy__return-pct",
        );
    const absEl = detailPanel
      ? document.querySelector("[data-plan-detail-return-abs]")
      : document.querySelector(".plan-strategy__return-abs");
    const slider = document.querySelector("[data-plan-slider]");
    const freqActive = document.querySelector(
      "[data-plan-freq-item].is-active",
    );
    const carousel = document.querySelector("[data-plan-carousel]");
    if (domWrite && !detailPanel) {
      if (!pctEl || !absEl || !slider || !freqActive) return;
    } else if (!domWrite && opts.amount === undefined) {
      return null;
    }

    const amount =
      opts.amount !== undefined
        ? opts.amount
        : parseInt(slider.getAttribute("aria-valuenow") || "0", 10);
    const freqRaw = (
      opts.freq ||
      freqActive?.getAttribute("data-plan-freq-item") ||
      "monthly"
    ).toLowerCase();
    const freq = freqRaw === "flexible" ? "monthly" : freqRaw;
    const activePlan = opts.planKey
      ? String(opts.planKey).toLowerCase()
      : (carousel?.getAttribute("data-active-plan") || "bitcoin").toLowerCase();

    const activeAnchorPlan = activeAnchorPlanFromCarouselKey(activePlan);

    // Rough offline DCA estimate: 60 monthly USD levels (prototype historic shapes, Jan 2020 → late 2024).
    // Shorter ranges (3Y / 1Y) start later into the same dataset.
    const rangeMonthsMap = { "5Y": 60, "3Y": 36, "1Y": 12 };
    const simRangeKey =
      opts.historicalRangeKey ||
      (typeof rangeState !== "undefined" ? rangeState.plan : "5Y") ||
      "5Y";
    const periodMonths = rangeMonthsMap[simRangeKey] || 60;
    const startMonth = HISTORIC_SIM_MONTHS - periodMonths;
    const months = HISTORIC_SIM_MONTHS;

    const formatPct = (n) =>
      `${(isFinite(n) ? n : 0).toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
    const formatTwdNumber = (n) => {
      const abs = Math.abs(n);
      const round1 = (x) => {
        const r = Math.round(x * 10) / 10;
        return Number.isInteger(r) ? r.toString() : r.toString();
      };
      if (abs < 10000) return abs.toLocaleString("en-US");
      if (abs < 1000000) return `${round1(abs / 1000)}K`;
      return `${round1(abs / 1000000)}M`;
    };

    const fxMultiplier = planHistoricFxMultiplier();

    const occurrencesPerMonth = (() => {
      if (freq === "daily") return 365.0 / 12.0; // ≈ 30.42
      if (freq === "weekly") return 52.0 / 12.0; // ≈ 4.33
      return 1.0; // monthly
    })();

    // Return % is independent of `amount` when the set of buy-weights × (1/P) scales together; it is not
    // independent of frequency once buys fall on different prices. Weekly/daily: `amount` per buy, many
    // timestamps across the window. Monthly: one buy per month at month-end closes (integer months).
    let assetAccum = 0;
    let totalInvested = 0;
    if (freq === "monthly") {
      for (let m = startMonth; m < months; m += 1) {
        const priceLocal =
          historicIndexUsdAtMonth(activeAnchorPlan, m) * fxMultiplier;
        if (priceLocal <= 0) continue;
        assetAccum += amount / priceLocal;
        totalInvested += amount;
      }
    } else {
      const numBuys = Math.max(
        1,
        Math.round(periodMonths * occurrencesPerMonth),
      );
      const span = months - 1 - startMonth;
      for (let k = 0; k < numBuys; k += 1) {
        const t =
          numBuys === 1 ? startMonth : startMonth + (k / (numBuys - 1)) * span;
        const priceLocal =
          historicIndexUsdAtFractionalMonth(activeAnchorPlan, t) * fxMultiplier;
        if (priceLocal <= 0) continue;
        assetAccum += amount / priceLocal;
        totalInvested += amount;
      }
    }

    const endPriceLocal =
      historicIndexUsdAtMonth(activeAnchorPlan, months - 1) * fxMultiplier;
    const startPriceLocal =
      historicIndexUsdAtMonth(activeAnchorPlan, startMonth) * fxMultiplier;
    const finalValue = assetAccum * endPriceLocal;
    const profit = finalValue - totalInvested;

    const returnPct = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
    const historicReturnPct =
      startPriceLocal > 0
        ? ((endPriceLocal - startPriceLocal) / startPriceLocal) * 100
        : 0;

    if (!domWrite) {
      return { returnPct, historicReturnPct, profit, totalInvested };
    }

    const displayAssets =
      Array.isArray(opts.displayAssets) && opts.displayAssets.length
        ? opts.displayAssets
        : PLAN_DISPLAY_ASSETS_BY_KEY[activePlan] ||
          PLAN_DISPLAY_ASSETS_BY_KEY[activeAnchorPlan] ||
          PLAN_DISPLAY_ASSETS_BY_KEY.bitcoin;
    const historicCaption = buildHistoricPerformanceCaption(displayAssets);
    const { html: iconsHtml, sig: iconsSig } = buildReturnMetricProductIconWrap(
      displayAssets,
      "assets/icon_currency_btc.svg",
    );

    if (absEl)
      absEl.textContent = `${profit >= 0 ? "+" : "-"}${formatTwdNumber(profit)}`;
    if (pctEl) pctEl.textContent = `${formatPct(returnPct)}`;

    const strategyGroup = detailPanel
      ? document.querySelector(
          ".plan-detail-panel__return-metrics-col--strategy.plan-detail-panel__return-metrics-col--values",
        )
      : document.querySelector(
          ".plan-strategy__return-metrics-col--strategy.plan-strategy__return-metrics-col--values",
        );
    const historicGroup = detailPanel
      ? document.querySelector("[data-plan-detail-historic-performance-tone]")
      : document.querySelector(
          ".plan-strategy__return-metrics-col--historic.plan-strategy__return-metrics-col--values",
        );
    setReturnMetricTone(strategyGroup, profit);
    setReturnMetricTone(historicGroup, historicReturnPct);

    if (detailPanel) {
      const histPctEl = document.querySelector(
        "[data-plan-detail-return-historic-pct]",
      );
      const autoHistPctEl = document.querySelector(
        "[data-plan-detail-alloc-auto-historic-pct]",
      );
      const iconWrap = document.querySelector(
        "[data-plan-detail-return-asset-icons]",
      );
      const capHist = document.querySelector(
        "[data-plan-detail-return-historic-caption]",
      );
      const capStrat = document.querySelector(
        "[data-plan-detail-return-strategy-caption]",
      );
      const histText = formatPct(historicReturnPct);
      if (histPctEl) histPctEl.textContent = histText;
      if (autoHistPctEl) autoHistPctEl.textContent = histText;
      setReturnMetricIconWrapHtml(iconWrap, iconsHtml, { layoutSig: iconsSig });
      if (capHist) capHist.textContent = historicCaption;
      if (capStrat) capStrat.textContent = "Return";
    } else {
      const histPctEl = document.querySelector(
        "[data-plan-return-historic-pct]",
      );
      const iconWrap = document.querySelector("[data-plan-return-asset-icons]");
      const capHist = document.querySelector(
        "[data-plan-return-historic-caption]",
      );
      const capStrat = document.querySelector(
        "[data-plan-return-strategy-caption]",
      );
      if (histPctEl) histPctEl.textContent = formatPct(historicReturnPct);
      setReturnMetricIconWrapHtml(iconWrap, iconsHtml, { layoutSig: iconsSig });
      if (capHist) capHist.textContent = historicCaption;
      if (capStrat) capStrat.textContent = "Return";
    }
  };

  const initPlanStrategySlider = () => {
    const slider = document.querySelector("[data-plan-slider]");
    const fill = document.querySelector("[data-plan-slider-fill]");
    const thumb = document.querySelector("[data-plan-slider-thumb]");
    const amountEl = document.querySelector("[data-plan-amount]");
    if (!slider || !fill || !thumb || !amountEl) return;

    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const formatNumber = (n) => n.toLocaleString("en-US");

    // Read bounds live from DOM so currency switches take effect immediately
    const getMin = () => parseInt(slider.getAttribute("data-min") || "500", 10);
    const getMax = () =>
      parseInt(slider.getAttribute("data-max") || "100000", 10);

    let value = clamp(
      parseInt(slider.getAttribute("aria-valuenow") || "10000", 10),
      getMin(),
      getMax(),
    );

    const pctFromValue = (v) => {
      const mn = getMin();
      const mx = getMax();
      if (mx === mn) return 0;
      if (v <= mn) return 0;
      return (v - mn) / (mx - mn);
    };
    const stepForPct = (pct) => {
      const isUsdt =
        (typeof currencyState !== "undefined" ? currencyState.plan : "TWD") ===
        "USDT";
      if (isUsdt) {
        if (pct < 1 / 3) return 5;
        if (pct < 2 / 3) return 25;
        return 100;
      }
      if (pct < 1 / 3) return 500;
      if (pct < 2 / 3) return 1000;
      return 5000;
    };
    const roundToStep = (v, step) => Math.round(v / step) * step;

    const setValue = (next, pctHint) => {
      const mn = getMin();
      const mx = getMax();
      const pctRaw = typeof pctHint === "number" ? pctHint : pctFromValue(next);
      const step = stepForPct(pctRaw);
      value = clamp(roundToStep(next, step), mn, mx);
      const pct = pctFromValue(value);
      fill.style.width = `${pct * 100}%`;
      thumb.style.left = `calc(${pct * 100}% - ${pct * 24}px)`;
      amountEl.textContent = formatNumber(value);
      slider.setAttribute("aria-valuenow", String(value));
      updatePlanStrategyHistoricalReturn();
    };

    const setFromClientX = (clientX) => {
      const mn = getMin();
      const mx = getMax();
      const rect = slider.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const pct = rect.width === 0 ? 0 : x / rect.width;
      const raw = mn + pct * (mx - mn);
      setValue(raw, pct);
    };

    const onPointerDown = (e) => {
      slider.setPointerCapture(e.pointerId);
      setFromClientX(e.clientX);
    };
    const onPointerMove = (e) => {
      if (!slider.hasPointerCapture(e.pointerId)) return;
      setFromClientX(e.clientX);
    };
    const onPointerUp = (e) => {
      if (slider.hasPointerCapture(e.pointerId))
        slider.releasePointerCapture(e.pointerId);
    };

    slider.addEventListener("pointerdown", onPointerDown);
    slider.addEventListener("pointermove", onPointerMove);
    slider.addEventListener("pointerup", onPointerUp);
    slider.addEventListener("pointercancel", onPointerUp);

    // Keyboard support
    slider.tabIndex = 0;
    slider.addEventListener("keydown", (e) => {
      const mn = getMin();
      const mx = getMax();
      const step = stepForPct(pctFromValue(value));
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        setValue(value - step);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        setValue(value + step);
      } else if (e.key === "Home") {
        e.preventDefault();
        setValue(mn);
      } else if (e.key === "End") {
        e.preventDefault();
        setValue(mx);
      }
    });

    setValue(value);

    // Expose a re-render function for currency switches
    slider._planSliderSetValue = setValue;
  };

  const initPlanStrategyFreq = () => {
    const container = document.querySelector("[data-plan-freq]");
    const items = container?.querySelectorAll("[data-plan-freq-item]");
    if (!container || !items?.length) return;

    items.forEach((btn) => {
      btn.addEventListener("click", () => {
        items.forEach((b) => {
          b.classList.remove("is-active");
          b.setAttribute("aria-selected", "false");
        });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        updatePlanStrategyHistoricalReturn();
      });
    });

    updatePlanStrategyHistoricalReturn();
  };

  let swiperAssetsLoading = null;
  const loadSwiperAssets = () => {
    if (window.Swiper) return Promise.resolve();
    if (swiperAssetsLoading) return swiperAssetsLoading;
    swiperAssetsLoading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-swiper-css]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href =
          "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";
        link.setAttribute("data-swiper-css", "");
        document.head.appendChild(link);
      }
      const existing = document.querySelector('script[data-swiper-js]');
      if (existing) {
        if (window.Swiper) resolve();
        else existing.addEventListener("load", () => resolve(), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
      script.defer = true;
      script.setAttribute("data-swiper-js", "");
      script.onload = () => resolve();
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return swiperAssetsLoading;
  };

  const initPlanStrategyCarousel = async () => {
    const carousel = document.querySelector("[data-plan-carousel]");
    const prevBtn = document.querySelector("[data-plan-carousel-prev]");
    const nextBtn = document.querySelector("[data-plan-carousel-next]");
    const titleEl = document.querySelector("[data-plan-hero-title]");
    const subEl = document.querySelector("[data-plan-hero-sub]");
    const slides = carousel?.querySelectorAll("[data-plan-carousel-item]");
    if (!carousel || !slides?.length || !titleEl || !subEl) return;
    try {
      await loadSwiperAssets();
    } catch (_) {
      return;
    }
    if (typeof window.Swiper === "undefined") return;

    const updateHeroFromIndex = (index) => {
      const slide = slides[index];
      if (!slide) return;
      titleEl.textContent = slide.getAttribute("data-title") || "";
      subEl.textContent = slide.getAttribute("data-subtitle") || "";
      carousel.setAttribute(
        "data-active-plan",
        (slide.getAttribute("data-plan-key") || "bitcoin").toLowerCase(),
      );
      updatePlanStrategyHistoricalReturn();
    };

    const initialIndex = Math.max(
      0,
      Array.from(slides).findIndex(
        (s) => (s.getAttribute("data-title") || "").toLowerCase() === "bitcoin",
      ),
    );

    const swiper = new window.Swiper(carousel, {
      slidesPerView: "auto",
      centeredSlides: true,
      spaceBetween: 12,
      loop: false,
      rewind: true,
      watchOverflow: false,
      speed: 280,
      grabCursor: true,
      initialSlide: initialIndex,
      navigation: {
        prevEl: prevBtn || undefined,
        nextEl: nextBtn || undefined,
      },
      on: {
        init() {
          updateHeroFromIndex(this.realIndex);
        },
        slideChange() {
          updateHeroFromIndex(this.realIndex);
        },
      },
    });

    updateHeroFromIndex(swiper.realIndex || initialIndex);
  };

  const scrollEntryContentToTop = () => {
    const scroller = document.querySelector("[data-content]");
    if (scroller) scroller.scrollTop = 0;
  };

  let limitsVariantSync = null;

  const initLimitsPanel = () => {
    const panel = document.querySelector("[data-limits-panel]");
    const container = document.querySelector(".phone-container");
    if (!panel) return;
    const openButtons = document.querySelectorAll("[data-limits-open]");
    const closeButtons = panel.querySelectorAll("[data-limits-close]");

    const setOpen = (nextOpen) => {
      if (nextOpen) {
        panel.hidden = false;
        if (container) {
          container.classList.remove("is-limits-open");
          container.classList.remove("is-limits-fading");
        }
        const scrollBody = panel.querySelector(".limits-panel__body");
        if (scrollBody) scrollBody.scrollTop = 0;
        requestAnimationFrame(() => {
          panel.classList.add("is-open");
        });
        setTimeout(() => {
          if (container && panel.classList.contains("is-open")) {
            container.classList.add("is-limits-fading");
          }
        }, 80);
        setTimeout(() => {
          if (container && panel.classList.contains("is-open")) {
            container.classList.add("is-limits-open");
          }
        }, 350);
      } else {
        panel.classList.remove("is-open");
        scrollEntryContentToTop();
        if (container) {
          container.classList.add("is-limits-fading");
          container.classList.remove("is-limits-open");
          requestAnimationFrame(() => {
            container.classList.remove("is-limits-fading");
          });
        }
        const onEnd = () => {
          if (!panel.classList.contains("is-open")) {
            panel.hidden = true;
          }
          panel.removeEventListener("transitionend", onEnd);
        };
        panel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 400);
      }
    };

    const LIMITS_TAB_DATA = {
      crypto: {
        unit: "USD",
        showAnnually: false,
        showSpecialQuota: false,
        withdrawalAsterisk: true,
        deposit: {
          single: { basic: "No limit", premium: "No limit" },
          daily: { basic: "No limit", premium: "No limit" },
          monthly: { basic: "No limit", premium: "No limit" },
        },
        withdrawal: {
          single: { basic: "250,000", premium: "500,000" },
          daily: { basic: "250,000", premium: "500,000" },
          monthly: { basic: "2,500,000", premium: "5,000,000" },
        },
      },
      twd: {
        unit: "TWD",
        showAnnually: true,
        showSpecialQuota: true,
        withdrawalAsterisk: false,
        deposit: {
          single: { basic: "2,000,000", premium: "2,000,000" },
          daily: { basic: "2,000,000", premium: "2,000,000" },
          monthly: { basic: "3,000,000", premium: "6,000,000" },
          annually: { basic: "3,000,000", premium: "6,000,000" },
        },
        withdrawal: {
          single: { basic: "2,000,000", premium: "2,000,000" },
          daily: { basic: "2,000,000", premium: "2,000,000" },
          monthly: { basic: "60,000,000", premium: "60,000,000" },
          annually: { basic: "60,000,000", premium: "180,000,000" },
        },
      },
      usd: {
        unit: "USD",
        showAnnually: false,
        showSpecialQuota: false,
        withdrawalAsterisk: false,
        deposit: {
          single: { basic: "100,000", premium: "100,000" },
          daily: { basic: "100,000", premium: "200,000" },
          monthly: { basic: "300,000", premium: "500,000" },
        },
        withdrawal: {
          single: { basic: "100,000", premium: "100,000" },
          daily: { basic: "100,000", premium: "200,000" },
          monthly: { basic: "300,000", premium: "500,000" },
        },
      },
    };

    const syncLimitsVariant = (variant) => {
      const next = variant === "concept" ? "concept" : "mvp";
      panel.querySelectorAll("[data-limits-variant]").forEach((el) => {
        const isActive = el.getAttribute("data-limits-variant") === next;
        el.hidden = !isActive;
      });
      document.documentElement.dataset.limitsVariant = next;
    };

    const setLimitsTab = (tabKey) => {
      const data = LIMITS_TAB_DATA[tabKey] || LIMITS_TAB_DATA.crypto;
      panel.querySelectorAll("[data-limits-tab]").forEach((btn) => {
        const isActive = btn.getAttribute("data-limits-tab") === tabKey;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      panel.querySelectorAll("[data-limits-values-label]").forEach((el) => {
        el.textContent = `(values in ${data.unit})`;
      });
      panel
        .querySelector(".limits-panel__section--withdrawal")
        ?.classList.toggle("is-crypto", data.withdrawalAsterisk);
      panel.querySelectorAll("[data-limits-row='annually']").forEach((row) => {
        row.hidden = !data.showAnnually;
      });
      const specialQuota = panel.querySelector("[data-limits-special-quota]");
      if (specialQuota) specialQuota.hidden = !data.showSpecialQuota;
      panel.querySelectorAll("[data-limits-basic]").forEach((el) => {
        const key = el.getAttribute("data-limits-basic") || "";
        const [section, period] = key.split("-");
        const values = data[section]?.[period];
        if (!values) return;
        el.textContent = values.basic;
      });
      panel.querySelectorAll("[data-limits-premium]").forEach((el) => {
        const key = el.getAttribute("data-limits-premium") || "";
        const [section, period] = key.split("-");
        const values = data[section]?.[period];
        if (!values) return;
        el.textContent = values.premium;
      });
    };

    let limitsSnackbarTimeout = null;
    const showLimitsSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
      if (!snackbar) return;
      const text = snackbar.querySelector("[data-snackbar-text]");
      if (text) text.textContent = message;
      if (limitsSnackbarTimeout) {
        clearTimeout(limitsSnackbarTimeout);
        limitsSnackbarTimeout = null;
      }
      snackbar.hidden = false;
      snackbar.classList.remove("is-visible");
      void snackbar.offsetWidth;
      requestAnimationFrame(() => snackbar.classList.add("is-visible"));
      limitsSnackbarTimeout = setTimeout(() => {
        snackbar.classList.remove("is-visible");
        limitsSnackbarTimeout = setTimeout(() => {
          if (!snackbar.classList.contains("is-visible")) snackbar.hidden = true;
        }, 320);
      }, 2200);
    };

    panel.querySelectorAll("[data-limits-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setLimitsTab(btn.getAttribute("data-limits-tab") || "crypto");
      });
    });
    panel
      .querySelectorAll("[data-limits-not-in-prototype], [data-limits-view-all], [data-limits-learn-more]")
      .forEach((el) => {
        el.addEventListener("click", () => showLimitsSnackbar("Not in prototype"));
      });
    panel
      .querySelector("[data-limits-support]")
      ?.addEventListener("click", () => showLimitsSnackbar("Not in prototype"));
    setLimitsTab("crypto");

    limitsVariantSync = syncLimitsVariant;

    openButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (container && container.classList.contains("is-menu-open")) {
          container.classList.remove("is-menu-open");
          setTimeout(() => setOpen(true), 220);
        } else {
          setOpen(true);
        }
      });
    });
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => setOpen(false));
    });
  };

  const initSettingsPage = () => {
    const page = document.querySelector("[data-settings-page]");
    const container = document.querySelector(".phone-container");
    if (!page) return;

    const openButtons = document.querySelectorAll("[data-settings-open]");
    const closeButtons = page.querySelectorAll("[data-settings-close]");
    const languageValueEl = page.querySelector("[data-settings-language-value]");
    let snackbarTimeout = null;

    const showSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
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

    const syncLanguageValue = () => {
      if (!languageValueEl) return;
      const locale = window.I18N?.getLocale?.() || "en";
      languageValueEl.textContent = locale === "zh" ? "中文" : "English";
    };

    const setOpen = (nextOpen) => {
      if (nextOpen) {
        syncLanguageValue();
        page.hidden = false;
        if (container) {
          container.classList.remove("is-settings-open");
          container.classList.remove("is-settings-fading");
        }
        const scrollBody = page.querySelector(".settings-page__body");
        if (scrollBody) scrollBody.scrollTop = 0;
        requestAnimationFrame(() => page.classList.add("is-open"));
        setTimeout(() => {
          if (container && page.classList.contains("is-open")) {
            container.classList.add("is-settings-fading");
          }
        }, 80);
        setTimeout(() => {
          if (container && page.classList.contains("is-open")) {
            container.classList.add("is-settings-open");
          }
        }, 350);
      } else {
        page.classList.remove("is-open");
        scrollEntryContentToTop();
        if (container) {
          container.classList.add("is-settings-fading");
          container.classList.remove("is-settings-open");
          requestAnimationFrame(() => {
            container.classList.remove("is-settings-fading");
          });
        }
        const onEnd = () => {
          if (!page.classList.contains("is-open")) page.hidden = true;
          page.removeEventListener("transitionend", onEnd);
        };
        page.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 400);
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (container && container.classList.contains("is-menu-open")) {
          container.classList.remove("is-menu-open");
          setTimeout(() => setOpen(true), 220);
        } else {
          setOpen(true);
        }
      });
    });
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => setOpen(false));
    });
    page.querySelector("[data-settings-support]")?.addEventListener("click", showNotInPrototype);
    page.querySelectorAll("[data-settings-row]").forEach((row) => {
      row.addEventListener("click", showNotInPrototype);
    });
    document.addEventListener("prototype-locale-changed", syncLanguageValue);
    syncLanguageValue();
  };

  const initSectionTitleLinks = () => {
    const container = document.querySelector(".phone-container");
    if (!container) return;

    let snackbarTimeout = null;
    const showSnackbar = (message) => {
      const snackbar = container.querySelector("[data-snackbar]");
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

    document.querySelectorAll("[data-section-title-link]").forEach((btn) => {
      btn.addEventListener("click", () => showSnackbar("Not in prototype"));
    });
  };

  const initHomeMarketsToday = (opts = {}) => {
    const marketsPageApi =
      typeof opts.marketsPageApi === "object" && opts.marketsPageApi
        ? opts.marketsPageApi
        : { openMarketsCategory: () => {} };
    const setActiveTab =
      typeof opts.setActiveTab === "function" ? opts.setActiveTab : () => {};

    const section = document.querySelector("[data-home-markets]");
    if (!section) return;

    const container = document.querySelector(".phone-container");
    const tabs = section.querySelectorAll("[data-home-markets-tab]");
    const favoritesPanel = section.querySelector('[data-home-markets-panel="favorites"]');
    const listPanel = section.querySelector('[data-home-markets-panel="list"]');
    const categoriesPanel = section.querySelector('[data-home-markets-panel="categories"]');
    const categoriesList = section.querySelector("[data-home-markets-categories-list]");
    const cta = section.querySelector("[data-home-markets-cta]");

    const HOME_MARKETS_CATEGORIES = [
      { key: "rwa", title: "RWA", subtitle: "Real World Assets" },
      { key: "layer_1", title: "L1", subtitle: "L1 solutions" },
      { key: "layer_2", title: "L2", subtitle: "L2 solutions" },
      { key: "defi", title: "DeFi", subtitle: "Decentralized Finance" },
      { key: "ai", title: "AI", subtitle: "Artificial Intelligence" },
      { key: "gold", title: "Gold", subtitle: "Tokenized gold" },
      { key: "stablecoin", title: "Stablecoins", subtitle: "Stablecoins" },
      { key: "gaming", title: "Gaming", subtitle: "Play to Earn & more" },
      { key: "restaking", title: "Restaking", subtitle: "Reuse of staked asset innovations" },
      { key: "meme", title: "Meme", subtitle: "Cultural coins" },
      { key: "nft", title: "NFT", subtitle: "Non-fungible tokens" },
      { key: "metaverse", title: "Metaverse", subtitle: "VR, digital estate & more" },
    ];

    const homeCategoryIconSrc = (key) =>
      `assets/icon_coincategories_${key}_active.svg`;

    const renderHomeMarketsCategories = () => {
      if (!categoriesList || categoriesList.childElementCount) return;
      const coinStack = `
        <span class="markets__category-coins" aria-hidden="true">
          <img src="assets/icon_currency_btc.svg" alt="" />
          <img src="assets/icon_currency_eth.svg" alt="" />
          <img src="assets/icon_currency_xrp.svg" alt="" />
        </span>
      `;
      HOME_MARKETS_CATEGORIES.forEach(({ key, title, subtitle }) => {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "markets__category-row";
        row.setAttribute("data-home-markets-category", key);
        row.innerHTML = `
          <span class="markets__category-icon">
            <img src="${homeCategoryIconSrc(key)}" alt="" />
          </span>
          <span class="markets__category-copy">
            <span class="markets__category-title">${title}</span>
            <span class="markets__category-subtitle">${subtitle}</span>
          </span>
          ${coinStack}
        `;
        row.addEventListener("click", () => {
          marketsPageApi.openMarketsCategory(key);
          setActiveTab("markets");
          const content = document.querySelector("[data-content]");
          if (content) content.scrollTop = 0;
        });
        categoriesList.appendChild(row);
      });
    };

    renderHomeMarketsCategories();

    const HOME_MARKETS_TAB_LABELS = {
      spotlight: "Spotlight",
      gainers: "Gainers",
      losers: "Losers",
      new: "New",
    };

    const MARKETS_PAGE_CATEGORY_BY_TAB = {
      spotlight: "spotlight",
      gainers: "gainers",
      losers: "losers",
      new: "new",
    };

    const tabsScroller = section.querySelector(".markets__tabs");

    const scrollHomeMarketsTabIntoView = (btn) => {
      if (!tabsScroller || !btn) return;
      const maxScroll = tabsScroller.scrollWidth - tabsScroller.clientWidth;
      if (maxScroll <= 0) return;
      const scrollerRect = tabsScroller.getBoundingClientRect();
      const tabRect = btn.getBoundingClientRect();
      const tabLeft = tabRect.left - scrollerRect.left + tabsScroller.scrollLeft;
      const tabCenter = tabLeft + tabRect.width / 2;
      const targetLeft = tabCenter - tabsScroller.clientWidth / 2;
      tabsScroller.scrollTo({
        left: Math.min(maxScroll, Math.max(0, targetLeft)),
        behavior: "smooth",
      });
    };

    let activeTabKey = "spotlight";

    const setTab = (tabKey) => {
      activeTabKey = tabKey;
      const isFavorites = tabKey === "favorites";
      const isCategories = tabKey === "categories";
      const isListTab = Boolean(HOME_MARKETS_TAB_LABELS[tabKey]);

      tabs.forEach((btn) => {
        const isActive = btn.getAttribute("data-home-markets-tab") === tabKey;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
        if (isActive) scrollHomeMarketsTabIntoView(btn);
      });

      if (favoritesPanel) favoritesPanel.hidden = !isFavorites;
      if (listPanel) listPanel.hidden = !isListTab;
      if (categoriesPanel) categoriesPanel.hidden = !isCategories;

      if (cta) {
        if (isListTab) {
          cta.hidden = false;
          const label = HOME_MARKETS_TAB_LABELS[tabKey] || "Spotlight";
          cta.textContent = `Show all ${label}`;
        } else {
          cta.hidden = true;
        }
      }
    };

    tabs.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabKey = btn.getAttribute("data-home-markets-tab") || "spotlight";
        if (tabKey === "favorites") {
          document.dispatchEvent(new CustomEvent("auth-signup-open"));
          return;
        }
        if (
          tabKey === "spotlight" ||
          tabKey === "gainers" ||
          tabKey === "losers" ||
          tabKey === "new" ||
          tabKey === "categories"
        ) {
          setTab(tabKey);
        }
      });
    });

    cta?.addEventListener("click", () => {
      const category = MARKETS_PAGE_CATEGORY_BY_TAB[activeTabKey];
      if (!category) return;
      marketsPageApi.openMarketsCategory(category);
      setActiveTab("markets");
      const content = document.querySelector("[data-content]");
      if (content) content.scrollTop = 0;
    });

    setTab("spotlight");
  };

  const initSupportGuidePage = () => {
    const page = document.querySelector("[data-support-guide-page]");
    const container = document.querySelector(".phone-container");
    if (!page) return;

    const openButtons = document.querySelectorAll("[data-support-guide-open]");
    const closeButtons = page.querySelectorAll("[data-support-guide-close]");
    const sectionTitleEl = page.querySelector("[data-support-guide-section-title]");
    let snackbarTimeout = null;

    const SUPPORT_GUIDE_TAB_DATA = {
      deposits: { sectionTitle: "Section title" },
      identity: { sectionTitle: "Identity verification" },
      trading: { sectionTitle: "Trading" },
    };

    const showSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
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

    const setTab = (tabKey) => {
      const data = SUPPORT_GUIDE_TAB_DATA[tabKey] || SUPPORT_GUIDE_TAB_DATA.deposits;
      page.querySelectorAll("[data-support-guide-tab]").forEach((btn) => {
        const isActive = btn.getAttribute("data-support-guide-tab") === tabKey;
        btn.classList.toggle("is-active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      if (sectionTitleEl) sectionTitleEl.textContent = data.sectionTitle;
    };

    const setOpen = (nextOpen) => {
      if (nextOpen) {
        page.hidden = false;
        if (container) {
          container.classList.remove("is-support-guide-open");
          container.classList.remove("is-support-guide-fading");
        }
        const scrollBody = page.querySelector(".support-guide-page__body");
        if (scrollBody) scrollBody.scrollTop = 0;
        setTab("deposits");
        requestAnimationFrame(() => page.classList.add("is-open"));
        setTimeout(() => {
          if (container && page.classList.contains("is-open")) {
            container.classList.add("is-support-guide-fading");
          }
        }, 80);
        setTimeout(() => {
          if (container && page.classList.contains("is-open")) {
            container.classList.add("is-support-guide-open");
          }
        }, 350);
      } else {
        page.classList.remove("is-open");
        scrollEntryContentToTop();
        if (container) {
          container.classList.add("is-support-guide-fading");
          container.classList.remove("is-support-guide-open");
          requestAnimationFrame(() => {
            container.classList.remove("is-support-guide-fading");
          });
        }
        const onEnd = () => {
          if (!page.classList.contains("is-open")) page.hidden = true;
          page.removeEventListener("transitionend", onEnd);
        };
        page.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 400);
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener("click", () => {
        if (container && container.classList.contains("is-menu-open")) {
          container.classList.remove("is-menu-open");
          setTimeout(() => setOpen(true), 220);
        } else {
          setOpen(true);
        }
      });
    });
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => setOpen(false));
    });
    page.querySelectorAll("[data-support-guide-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tabKey = btn.getAttribute("data-support-guide-tab") || "deposits";
        if (tabKey === "identity" || tabKey === "trading") {
          showNotInPrototype();
          return;
        }
        setTab(tabKey);
      });
    });
    page
      .querySelector("[data-support-guide-support]")
      ?.addEventListener("click", showNotInPrototype);
    page
      .querySelector("[data-support-guide-view-more]")
      ?.addEventListener("click", showNotInPrototype);
    page.querySelectorAll("[data-support-guide-article]").forEach((row) => {
      row.addEventListener("click", showNotInPrototype);
    });
    page
      .querySelector("[data-support-guide-contact]")
      ?.addEventListener("click", showNotInPrototype);
    page
      .querySelector("[data-support-guide-community]")
      ?.addEventListener("click", () => {
        setOpen(false);
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent("community-page-open"));
        }, 220);
      });
  };

  const initCommunityPage = () => {
    const page = document.querySelector("[data-community-page]");
    const container = document.querySelector(".phone-container");
    if (!page) return;

    const openButtons = document.querySelectorAll("[data-community-open]");
    const closeButtons = page.querySelectorAll("[data-community-close]");
    let snackbarTimeout = null;

    const showSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
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

    const setOpen = (nextOpen) => {
      if (nextOpen) {
        page.hidden = false;
        if (container) {
          container.classList.remove("is-community-open");
          container.classList.remove("is-community-fading");
        }
        const scrollBody = page.querySelector(".community-page__body");
        if (scrollBody) scrollBody.scrollTop = 0;
        requestAnimationFrame(() => page.classList.add("is-open"));
        setTimeout(() => {
          if (container && page.classList.contains("is-open")) {
            container.classList.add("is-community-fading");
          }
        }, 80);
        setTimeout(() => {
          if (container && page.classList.contains("is-open")) {
            container.classList.add("is-community-open");
          }
        }, 350);
      } else {
        page.classList.remove("is-open");
        scrollEntryContentToTop();
        if (container) {
          container.classList.add("is-community-fading");
          container.classList.remove("is-community-open");
          requestAnimationFrame(() => {
            container.classList.remove("is-community-fading");
          });
        }
        const onEnd = () => {
          if (!page.classList.contains("is-open")) page.hidden = true;
          page.removeEventListener("transitionend", onEnd);
        };
        page.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 400);
      }
    };

    const openFromMenu = () => {
      if (container && container.classList.contains("is-menu-open")) {
        container.classList.remove("is-menu-open");
        setTimeout(() => setOpen(true), 220);
      } else {
        setOpen(true);
      }
    };

    openButtons.forEach((button) => {
      button.addEventListener("click", openFromMenu);
    });
    closeButtons.forEach((button) => {
      button.addEventListener("click", () => setOpen(false));
    });
    page
      .querySelector("[data-community-support]")
      ?.addEventListener("click", showNotInPrototype);
    page.querySelectorAll("[data-community-not-in-prototype]").forEach((btn) => {
      btn.addEventListener("click", showNotInPrototype);
    });
    document.addEventListener("community-page-open", () => setOpen(true));
  };

  // ─── Currency + range state ───────────────────────────────────────────────────
  const currencyState = { summary: "TWD", plan: "TWD" };
  if (currencyState.summary === "USDT") currencyState.summary = "USD";
  const rangeState = {
    plan: "5Y",
    curated: "5Y",
    spotlight: "5Y",
    breakdown: "5Y",
    widgetBreakdown: "5Y",
  };

  // Feature flag: keep the "Set end condition" step implemented but bypass it for this prototype iteration.
  // Flip to true to restore flow: Plan -> Set end condition -> Funding.
  const ENABLE_PLAN_END_CONDITION_STEP = false;
  // Temporary flag: disable "Not enough ... for one buy" amount-input error messaging.
  const ENABLE_PLAN_AMOUNT_ONE_BUY_ERROR = false;

  const FINANCE_SUMMARY_NEXT_BUY_FALLBACK = "Wed, Apr 15";

  /** "Wednesday, Apr 15" → "Wed, Apr 15" for summary + My plans (3-letter weekday). */
  const shortenWeekdayLabel = (s) => {
    const t = String(s || "").trim();
    if (!t || t.toLowerCase() === "today") return t;
    const m = t.match(/^([A-Za-z]+),\s*(.+)$/);
    if (!m) return t;
    const wk = m[1] || "";
    const rest = m[2] || "";
    return `${wk.slice(0, 3)}, ${rest}`;
  };

  /** Set when user confirms plan overview; cleared on prototype Reset */
  let financeSummaryConfirmedNextBuy = "";
  /** Set when user confirms plan overview; cleared on prototype Reset */
  let financeSummaryConfirmedReserved = null;
  /** Snapshot of the latest submitted plan used by "My plans". */
  let myPlansSubmittedPlan = null;
  /** Frozen pre-submit snapshot used by "My plans" until a plan is submitted. */
  let myPlansPrefillPlan = null;
  /** One-shot handoff: "Re-create this plan" -> open Plan with prefill. */
  let recreatePlanPrefillRecord = null;
  /** One-shot UI override: skip amount autofocus when entering Plan via Re-create. */
  let skipPlanAmountAutofocusOnce = false;

  // Static FX for prototype: 1 USD ≈ 32 TWD
  const FX_USD_TWD = 32;

  const normalizeFxCurrency = (cur) => {
    const c = String(cur || "")
      .trim()
      .toUpperCase();
    if (c === "USDT") return "USD";
    return c || "USD";
  };

  const parseMoneyWithCurrency = (text) => {
    const t = String(text || "").trim();
    if (!t || t === "—" || t === "- -") return null;
    const m = t.match(/(-?\d[\d,]*)(?:\.(\d+))?\s*([A-Za-z]{3,5})\s*$/);
    if (!m) return null;
    const intPart = (m[1] || "").replace(/,/g, "");
    const fracPart = m[2] ? `.${m[2]}` : "";
    const amount = parseFloat(`${intPart}${fracPart}`);
    if (!Number.isFinite(amount)) return null;
    const currency = normalizeFxCurrency(m[3]);
    return { amount, currency };
  };

  const convertFx = (amount, from, to) => {
    const f = normalizeFxCurrency(from);
    const t = normalizeFxCurrency(to);
    if (!Number.isFinite(amount)) return 0;
    if (f === t) return amount;
    if (f === "USD" && t === "TWD") return amount * FX_USD_TWD;
    if (f === "TWD" && t === "USD") return amount / FX_USD_TWD;
    return amount;
  };

  const formatMoney = (amount, cur) => {
    const n = Number.isFinite(amount) ? amount : 0;
    const c = normalizeFxCurrency(cur);
    return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
  };

  /** Compact "Mar 15 · ~12:00" / "Mon · ~12:00" from plan-detail schedule line */
  const formatFinanceNextBuyCompact = (schedText) => {
    const sched = String(schedText || "").trim();
    if (!sched) return "";
    const parts = sched
      .split("·")
      .map((t) => t.trim())
      .filter(Boolean);
    const tail = parts.length > 1 ? parts.slice(1).join(" · ") : parts[0] || "";
    const timeMatch = tail.match(/at\s+~?\s*(\d{1,2}:\d{2})/i);
    const timeStr = timeMatch ? `~${timeMatch[1]}` : "~12:00";
    const dayMatch = tail.match(/(\d{1,2})(?:st|nd|rd|th)/i);
    if (!dayMatch && tail) {
      return tail
        .replace(/\s+at\s+/i, " · ")
        .replace(/\s+/g, " ")
        .trim();
    }
    const day = dayMatch ? parseInt(dayMatch[1], 10) : 15;
    const t = new Date();
    if (t.getDate() >= day) t.setMonth(t.getMonth() + 1);
    t.setDate(day);
    const mon = t.toLocaleString("en-US", { month: "short" });
    return `${mon} ${day} · ${timeStr}`;
  };

  /** "Monthly · 15th at ~12:00" -> "every month on the 15th"; Flexible (1 day) -> same; Flexible (2+) -> "every 6th, 8th, …" */
  const formatScheduleNaturalLine = (schedText) => {
    const sched = String(schedText || "").trim();
    if (!sched) return "";
    const clean = sched.replace(/\s+at\s+~?\d{1,2}:\d{2}\s*$/i, "").trim();
    const parts = clean
      .split("·")
      .map((t) => t.trim())
      .filter(Boolean);
    const head = (parts[0] || "").toLowerCase();
    const tail = parts.length > 1 ? parts.slice(1).join(" · ").trim() : "";

    if (head.startsWith("daily")) return "every day";

    if (head.startsWith("weekly")) {
      let detail = tail || clean.replace(/^weekly\b/i, "").trim();
      detail = detail.replace(/\s*·\s*~?\d{1,2}:\d{2}\s*$/i, "").trim();
      detail = detail.replace(/\s+at\s+~?\d{1,2}:\d{2}\s*$/i, "").trim();
      return detail ? `every week on ${detail}` : "every week";
    }

    if (head.startsWith("flexible")) {
      const tailJoined = parts.slice(1).join(" ");
      const ordinals = [];
      const ordRe = /(\d{1,2}(?:st|nd|rd|th))/gi;
      let om;
      while ((om = ordRe.exec(tailJoined))) ordinals.push(om[1]);
      if (!ordinals.length) return "every month";
      if (ordinals.length === 1) return `every month on the ${ordinals[0]}`;
      return `every ${ordinals.join(", ")}`;
    }

    if (head.startsWith("monthly")) {
      let detail = tail || clean.replace(/^monthly\b/i, "").trim();
      if (detail && /^\d/.test(detail)) detail = `the ${detail}`;
      return detail ? `every month on ${detail}` : "every month";
    }

    return clean;
  };

  /** Normalize "Flexible" schedule detail delimiters to commas for plan-detail schedule line. */
  const normalizeFlexibleScheduleText = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return raw;
    const parts = raw
      .split("·")
      .map((t) => t.trim())
      .filter(Boolean);
    if (!parts.length) return raw;
    const head = (parts[0] || "").toLowerCase();
    if (!head.startsWith("flexible")) return raw;
    const tailJoined = parts.slice(1).join(" ");
    const ordinals = [];
    const ordRe = /(\d{1,2}(?:st|nd|rd|th))/gi;
    let m;
    while ((m = ordRe.exec(tailJoined))) ordinals.push(m[1]);
    if (!ordinals.length) return "Flexible";
    return `Flexible · ${ordinals.join(", ")}`;
  };

  /** Full schedule string for parsing; visible flexible row omits the "Flexible · " prefix. */
  const PLAN_DETAIL_SCHEDULE_FULL_ATTR = "data-plan-detail-schedule-full";

  const getPlanDetailScheduleFullTextFromEl = (el) => {
    if (!el) return "";
    const attr = el.getAttribute(PLAN_DETAIL_SCHEDULE_FULL_ATTR)?.trim();
    if (attr) return attr;
    return String(el.textContent || "").trim();
  };

  const getPlanDetailScheduleFullText = () =>
    getPlanDetailScheduleFullTextFromEl(
      document.querySelector("[data-plan-detail-schedule]"),
    );

  const setPlanDetailScheduleElement = (el, fullText) => {
    if (!el) return;
    const raw = String(fullText || "").trim();
    const canonical = normalizeFlexibleScheduleText(raw) || raw;
    const tr = (s) => (window.I18N?.t ? window.I18N.t(s) : s);
    const locale = window.I18N?.getLocale?.() || "en";
    el.setAttribute(PLAN_DETAIL_SCHEDULE_FULL_ATTR, canonical);
    const parts = canonical
      .split("·")
      .map((t) => t.trim())
      .filter(Boolean);
    const head = (parts[0] || "").toLowerCase();
    if (head.startsWith("flexible")) {
      const tailJoined = parts.slice(1).join(" ");
      const ordinals = [];
      const ordRe = /(\d{1,2}(?:st|nd|rd|th))/gi;
      let m;
      while ((m = ordRe.exec(tailJoined))) ordinals.push(m[1]);
      el.textContent = ordinals.length
        ? tr(ordinals.join(", "))
        : tr("Select days");
    } else {
      if (locale === "zh") {
        let localized = tr(canonical);
        // Fallback localization for dynamic schedule values like "Monthly · 16th" or "Weekly · Tuesday".
        if (localized === canonical) {
          const weekdayMap = {
            Monday: "週一",
            Tuesday: "週二",
            Wednesday: "週三",
            Thursday: "週四",
            Friday: "週五",
            Saturday: "週六",
            Sunday: "週日",
          };
          localized = localized.replace(
            /\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/g,
            (m) => weekdayMap[m] || m,
          );
          localized = localized
            .replace(/^Daily\b/i, "每日")
            .replace(/^Weekly\b/i, "每週")
            .replace(/^Monthly\b/i, "每月")
            .replace(/^Flexible\b/i, "自訂");
          localized = localized.replace(/(\d{1,2})(st|nd|rd|th)\b/gi, "$1 日");
          localized = localized.replace(/\s+at\s+~?\s*/gi, " 約 ");
        }
        el.textContent = localized;
      } else {
        el.textContent = tr(canonical);
      }
    }
  };

  /** "daily" -> "Each daily buy =", flexible/empty -> "Each buy =" */
  const formatEachBuyPrefix = (cadenceWord) => {
    const c = String(cadenceWord || "")
      .trim()
      .toLowerCase();
    return c ? `Each ${c} buy = ` : "Each buy = ";
  };

  /**
   * Allocation chips: same DOM + classes as `plan-overview-panel__chips` (Plan overview).
   * Same rules as syncFromPlanDetail: show pct when > 0; single-asset row uses 100% when pct missing.
   */
  const appendPlanOverviewStyleAllocChip = (
    container,
    { icon, ticker, pct },
    opts = {},
  ) => {
    if (!container) return;
    const t = String(ticker || "").trim();
    if (!t) return;
    const pctNum = Number.isFinite(Number(pct))
      ? Math.max(0, Math.round(Number(pct)))
      : 0;
    const pctPart = pctNum > 0 ? `${pctNum}` : "";
    const singleFallback = Boolean(opts.singleAssetFallback);

    const chip = document.createElement("div");
    chip.className = "plan-overview-panel__chip";

    const iconEl = document.createElement("img");
    iconEl.className = "plan-overview-panel__chip-icon";
    iconEl.src = String(icon || "").trim() || "assets/icon_currency_btc.svg";
    iconEl.alt = "";

    const meta = document.createElement("div");
    meta.className = "plan-overview-panel__chip-meta";

    const tickerEl = document.createElement("span");
    tickerEl.className = "plan-overview-panel__chip-ticker";
    tickerEl.textContent = t;

    meta.appendChild(tickerEl);
    if (pctPart) {
      const pctEl = document.createElement("span");
      pctEl.className = "plan-overview-panel__chip-pct";
      pctEl.textContent = `${pctPart}%`;
      meta.appendChild(pctEl);
    } else if (singleFallback) {
      const pctEl = document.createElement("span");
      pctEl.className = "plan-overview-panel__chip-pct";
      pctEl.textContent = "100%";
      meta.appendChild(pctEl);
    }

    chip.appendChild(iconEl);
    chip.appendChild(meta);
    container.appendChild(chip);
  };

  const applyFinanceSummaryMeta = () => {
    const suf = currencyState.summary;
    const fallbackAmt = formatMoney(0, suf);
    const deriveCompletedBuysForSummary = (rawCompletedBuys) => {
      const parsed = parseInt(String(rawCompletedBuys || "0"), 10) || 0;
      const flowState = states.flow ?? 1;
      return flowState >= 3 ? Math.max(5, parsed) : Math.max(0, parsed);
    };
    const parseInvestedFromPlanRecords = () => {
      if ((states.flow ?? 1) < 3) return null;
      const recs = [myPlansSubmittedPlan, myPlansPrefillPlan];
      for (const rec of recs) {
        const investedParsed = parseMoneyWithCurrency(rec?.totalInvested || "");
        if (
          investedParsed &&
          Number.isFinite(investedParsed.amount) &&
          investedParsed.amount > 0
        ) {
          return investedParsed;
        }
        const perBuyMatch = String(rec?.investLine || "").match(
          /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})\s+each\b/i,
        );
        const inferredCompleted = deriveCompletedBuysForSummary(
          rec?.completedBuys,
        );
        if (!perBuyMatch || inferredCompleted <= 0) continue;
        const amount = parseFloat(
          String(perBuyMatch[1] || "").replace(/,/g, ""),
        );
        const currency = normalizeFxCurrency(perBuyMatch[2]);
        if (Number.isFinite(amount) && amount > 0 && currency) {
          return { amount: amount * inferredCompleted, currency };
        }
      }
      return null;
    };
    const parseInvestedFromPlanUi = () => {
      if ((states.flow ?? 1) < 3) return null;
      const detailAmount =
        parseInt(
          String(
            document.querySelector("[data-plan-detail-amount-input]")?.value ||
              "",
          ).replace(/[^0-9]/g, ""),
          10,
        ) || 0;
      const mainAmount =
        parseInt(
          String(
            document.querySelector("[data-plan-amount]")?.textContent || "",
          ).replace(/[^0-9]/g, ""),
          10,
        ) || 0;
      const amount = detailAmount > 0 ? detailAmount : mainAmount;
      if (amount <= 0) return null;
      const completed = deriveCompletedBuysForSummary(0);
      if (completed <= 0) return null;
      const currency =
        normalizeFxCurrency(
          document.querySelector("[data-plan-detail-currency]")?.textContent,
        ) ||
        normalizeFxCurrency(
          document.querySelector("[data-plan-currency-label]")?.textContent,
        ) ||
        suf;
      return { amount: amount * completed, currency };
    };
    const parseFundingReservedFromPlanRecords = () => {
      // In pre-fund prototype states, summary reserved should mirror pre-funded amount.
      if ((states.funding ?? 1) < 3) return null;
      const recs = [myPlansSubmittedPlan, myPlansPrefillPlan];
      for (const rec of recs) {
        const parsed = parseMoneyWithCurrency(rec?.reservedFunds || "");
        if (parsed && Number.isFinite(parsed.amount) && parsed.amount > 0)
          return parsed;
      }
      return null;
    };
    const parseFundingDefaultFromPlanRecords = () => {
      const recs = [myPlansSubmittedPlan, myPlansPrefillPlan];
      for (const rec of recs) {
        const m = String(rec?.investLine || "").match(
          /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})\s+each\b/i,
        );
        if (!m) continue;
        const amount = parseFloat(String(m[1] || "").replace(/,/g, ""));
        const currency = String(m[2] || "")
          .trim()
          .toUpperCase();
        if (Number.isFinite(amount) && amount > 0 && currency) {
          return { amount: amount * 4, currency };
        }
      }
      return null;
    };
    const fundingState = states.funding ?? 1;
    const reservedSource =
      fundingState >= 3
        ? parseFundingReservedFromPlanRecords() ||
          financeSummaryConfirmedReserved ||
          parseFundingDefaultFromPlanRecords() || {
            amount: 40000,
            currency: suf,
          }
        : financeSummaryConfirmedReserved;
    const reservedAmt = reservedSource
      ? formatMoney(
          convertFx(reservedSource.amount, reservedSource.currency, suf),
          suf,
        )
      : fallbackAmt;
    const investedSource =
      parseInvestedFromPlanRecords() || parseInvestedFromPlanUi();
    const investedAmt = investedSource
      ? formatMoney(
          convertFx(investedSource.amount, investedSource.currency, suf),
          suf,
        )
      : fallbackAmt;
    document
      .querySelectorAll("[data-finance-summary-reserved]")
      .forEach((el) => {
        const t = el.querySelector(".finance-summary__stat-value-text");
        if (t) t.textContent = reservedAmt;
        else el.textContent = reservedAmt;
      });
    document
      .querySelectorAll("[data-finance-summary-invested]")
      .forEach((el) => {
        const t = el.querySelector(".finance-summary__stat-value-text");
        if (t) t.textContent = investedAmt;
        else el.textContent = investedAmt;
      });

    // Keep "My plans" summary strip in sync with Finance summary.
    document
      .querySelectorAll("[data-my-plans-summary-reserved-text]")
      .forEach((el) => {
        el.textContent = reservedAmt;
      });
    document
      .querySelectorAll("[data-my-plans-summary-invested-text]")
      .forEach((el) => {
        el.textContent = investedAmt;
      });

    const nbRaw =
      financeSummaryConfirmedNextBuy.trim() ||
      FINANCE_SUMMARY_NEXT_BUY_FALLBACK;
    const nb = shortenWeekdayLabel(nbRaw);
    document
      .querySelectorAll("[data-finance-summary-next-buy]")
      .forEach((el) => {
        el.textContent = nb;
      });
  };

  const initPrototypeVersionControls = () => {
    const normalizeVersion = (value) =>
      value === "concepts" ? "concepts" : "lite-mvp";

    const syncFinanceTabsForVersion = (version) => {
      const isLiteMvp = version === "lite-mvp";
      const earnTab = document.querySelector('[data-finance-header-tab="earn"]');
      const loanTab = document.querySelector('[data-finance-header-tab="loan"]');
      const discoverTab = document.querySelector("[data-finance-header-discover]");
      if (earnTab) earnTab.hidden = isLiteMvp;
      if (loanTab) loanTab.hidden = isLiteMvp;
      if (discoverTab) discoverTab.hidden = !isLiteMvp;

      if (isLiteMvp) {
        const activeFinancePage = String(
          document.documentElement.dataset.financePage || "",
        );
        if (activeFinancePage === "earn" || activeFinancePage === "loan") {
          financeHeaderApi.setFinancePage("auto");
        }
      }
    };

    const syncPrototypeVersion = (rawValue) => {
      const version = normalizeVersion(rawValue);
      document.documentElement.dataset.prototypeVersion = version;

      const select = document.querySelector("[data-prototype-version]");
      if (select && select.value !== version) select.value = version;

      limitsVariantSync?.(version === "concepts" ? "concept" : "mvp");
      syncFinanceTabsForVersion(version);
    };

    document
      .querySelector("[data-prototype-version]")
      ?.addEventListener("change", (event) => {
        syncPrototypeVersion(event.target?.value);
      });

    syncPrototypeVersion("lite-mvp");
  };

  const initPrototypeReset = () => {
    const resetBtn = document.querySelector("[data-prototype-reset]");
    if (!resetBtn) return;
    resetBtn.addEventListener("click", () => {
      Object.keys(STATE_CONFIGS).forEach((group) => {
        setState(group, STATE_CONFIGS[group].min, { force: true });
      });
      financeSummaryConfirmedNextBuy = "";
      financeSummaryConfirmedReserved = null;
      myPlansSubmittedPlan = null;
      myPlansPrefillPlan = null;
      applyFinanceSummaryMeta();
      syncPrototypePrefundLogToDocument();
      const versionSelect = document.querySelector("[data-prototype-version]");
      if (versionSelect) {
        versionSelect.value = "lite-mvp";
        versionSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
  };

  const curatedReturns = {
    bigthree: { "5Y": "45.23%", "3Y": "28.15%", "1Y": "18.42%" },
    digitalgold: { "5Y": "35.23%", "3Y": "22.10%", "1Y": "12.35%" },
    aiessentials: { "5Y": "52.23%", "3Y": "31.45%", "1Y": "22.18%" },
  };

  const spotlightReturns = {
    btc: { "5Y": "121.23%", "3Y": "82.40%", "1Y": "52.10%" },
    eth: { "5Y": "121.23%", "3Y": "51.30%", "1Y": "38.50%" },
    xaut: { "5Y": "121.23%", "3Y": "44.20%", "1Y": "28.30%" },
    link: { "5Y": "121.23%", "3Y": "71.40%", "1Y": "35.60%" },
    render: { "5Y": "121.23%", "3Y": "92.50%", "1Y": "65.20%" },
    near: { "5Y": "121.23%", "3Y": "63.10%", "1Y": "41.80%" },
    ondo: { "5Y": "121.23%", "3Y": "58.30%", "1Y": "32.40%" },
    pol: { "5Y": "121.23%", "3Y": "39.70%", "1Y": "22.10%" },
    xrp: { "5Y": "121.23%", "3Y": "55.80%", "1Y": "44.20%" },
    sol: { "5Y": "121.23%", "3Y": "91.20%", "1Y": "62.30%" },
    aave: { "5Y": "121.23%", "3Y": "67.40%", "1Y": "38.90%" },
    ada: { "5Y": "121.23%", "3Y": "41.30%", "1Y": "19.50%" },
  };

  const updateCuratedReturnsUI = () => {
    const range = rangeState.curated;
    document.querySelectorAll("[data-curated-key]").forEach((card) => {
      const key = card.getAttribute("data-curated-key");
      const pctEl = card.querySelector(".curated-portfolios__return-pct");
      if (pctEl && curatedReturns[key])
        pctEl.textContent = curatedReturns[key][range] || "";
    });
  };

  const updateSpotlightReturnsUI = () => {
    const range = rangeState.spotlight;
    document.querySelectorAll("[data-spotlight-key]").forEach((pill) => {
      const key = pill.getAttribute("data-spotlight-key");
      const pctEl = pill.querySelector(".crypto-pill__pct");
      if (pctEl && spotlightReturns[key])
        pctEl.textContent = spotlightReturns[key][range] || "";
    });
  };

  const updateSummaryCurrencyUI = () => {
    const cur = currencyState.summary;
    document.querySelectorAll("[data-summary-currency-label]").forEach((el) => {
      el.textContent = cur;
    });
    document.querySelectorAll("[data-summary-selector-label]").forEach((el) => {
      el.textContent = cur;
    });
    applyFinanceSummaryMeta();
  };

  /**
   * @param {object} [opts]
   * @param {boolean} [opts.fromPlanDetailPanel] — currency sheet opened from plan *detail* pill:
   *   clear that panel’s Auto-invest only (0 / empty); main Finance slider stays (clamped to new min/max).
   *   When false (Finance → Auto-invest page): main slider → currency defaults (300 USDT / 10,000 TWD).
   */
  const updatePlanCurrencyUI = (opts = {}) => {
    const fromPlanDetailPanel = !!opts.fromPlanDetailPanel;
    const cur = currencyState.plan;
    const isUsdt = cur === "USDT";
    const defaultVal = isUsdt ? 300 : 10000;

    // Labels
    document.querySelectorAll("[data-plan-currency-label]").forEach((el) => {
      el.textContent = cur;
    });
    document.querySelectorAll("[data-plan-return-currency]").forEach((el) => {
      el.textContent = ` ${cur}`;
    });

    // Amount icon
    const amountIcon = document.querySelector("[data-plan-amount-icon]");
    if (amountIcon) {
      amountIcon.src = isUsdt
        ? "assets/icon_currency_usdt.svg"
        : "assets/icon_currency_TWD.svg";
    }

    const slider = document.querySelector("[data-plan-slider]");
    const detailInp = document.querySelector("[data-plan-detail-amount-input]");

    if (slider) {
      const min = isUsdt ? 15 : 500;
      const max = isUsdt ? 3000 : 100000;
      slider.setAttribute("data-min", String(min));
      slider.setAttribute("data-max", String(max));
      slider.setAttribute("aria-valuemin", String(min));
      slider.setAttribute("aria-valuemax", String(max));

      if (fromPlanDetailPanel) {
        // Deeper plan-detail page only: reset Auto-invest *field* to empty; keep main widget amount
        const curVal = parseInt(
          slider.getAttribute("aria-valuenow") || "0",
          10,
        );
        if (curVal > 0) {
          const clamped = Math.min(max, Math.max(min, curVal));
          if (typeof slider._planSliderSetValue === "function") {
            slider._planSliderSetValue(clamped);
          } else {
            slider.setAttribute("aria-valuenow", String(clamped));
            updatePlanStrategyHistoricalReturn();
          }
        }
        if (detailInp) detailInp.value = "";
      } else {
        // Finance → Auto-invest: restore defaults on main slider + sync detail if present
        if (typeof slider._planSliderSetValue === "function") {
          slider._planSliderSetValue(defaultVal);
        } else {
          slider.setAttribute("aria-valuenow", String(defaultVal));
          const amtEl = document.querySelector("[data-plan-amount]");
          if (amtEl) amtEl.textContent = defaultVal.toLocaleString("en-US");
          updatePlanStrategyHistoricalReturn();
        }
        if (detailInp) detailInp.value = defaultVal.toLocaleString("en-US");
      }
    } else {
      updatePlanStrategyHistoricalReturn();
    }

    document.dispatchEvent(
      new CustomEvent("plan-investment-currency-updated", {
        detail: { fromPlanDetailPanel },
      }),
    );
  };

  const initCurrencySheet = () => {
    const sheet = document.querySelector("[data-currency-sheet]");
    if (!sheet) return;

    const panel = sheet.querySelector(".currency-sheet__panel");
    const titleEl = sheet.querySelector("[data-currency-sheet-title]");
    const descEl = sheet.querySelector("[data-currency-sheet-desc]");
    const altRow = sheet.querySelector("[data-currency-sheet-alt-row]");
    const altIcon = altRow?.querySelector("[data-currency-sheet-alt-icon]");
    const altName = altRow?.querySelector(".currency-sheet__item-name");
    const altDesc = altRow?.querySelector(".currency-sheet__item-desc");

    const PLAN_SECOND_ROW = {
      value: "USDT",
      icon: "assets/icon_currency_usdt.svg",
      name: "USDT",
      desc: "USD Tether",
    };
    const SUMMARY_SECOND_ROW = {
      value: "USD",
      icon: "assets/icon_currency_USD.svg",
      name: "USD",
      desc: "US Dollar",
    };

    const applySecondCurrencyRow = (cfg) => {
      if (!altRow) return;
      altRow.setAttribute("data-currency-sheet-option", cfg.value);
      if (altIcon) altIcon.setAttribute("src", cfg.icon);
      if (altName) altName.textContent = cfg.name;
      if (altDesc) altDesc.textContent = cfg.desc;
    };

    let options = sheet.querySelectorAll("[data-currency-sheet-option]");

    let currentContext = null;
    /** Investment currency opened from plan detail pill → clear detail Auto-invest only. */
    let planCurrencyOpenedFromDetailPanel = false;

    const setSelected = (value) => {
      options.forEach((opt) => {
        opt.classList.toggle(
          "is-selected",
          opt.getAttribute("data-currency-sheet-option") === value,
        );
      });
    };

    const open = (context) => {
      currentContext = context;
      const isSummary = context === "summary";
      if (titleEl)
        titleEl.textContent = isSummary
          ? "Display currency"
          : "Investment currency";
      if (descEl) descEl.hidden = !isSummary;
      if (isSummary) {
        applySecondCurrencyRow(SUMMARY_SECOND_ROW);
        if (currencyState.summary === "USDT") currencyState.summary = "USD";
      } else {
        applySecondCurrencyRow(PLAN_SECOND_ROW);
      }
      options = sheet.querySelectorAll("[data-currency-sheet-option]");
      setSelected(currencyState[context]);
      sheet.hidden = false;
      requestAnimationFrame(() => {
        sheet.classList.add("is-open");
      });
    };

    const close = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
        sheet.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    // Open triggers
    document
      .querySelectorAll("[data-currency-sheet-trigger]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const ctx = btn.getAttribute("data-currency-sheet-trigger");
          planCurrencyOpenedFromDetailPanel =
            ctx === "plan" && !!btn.closest(".plan-detail-panel");
          open(ctx);
        });
      });

    // Close triggers
    sheet.querySelectorAll("[data-currency-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", close);
    });

    // Option selection
    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        const value = opt.getAttribute("data-currency-sheet-option");
        if (!currentContext) return;
        currencyState[currentContext] = value;
        setSelected(value);
        if (currentContext === "summary") updateSummaryCurrencyUI();
        if (currentContext === "plan") {
          updatePlanCurrencyUI({
            fromPlanDetailPanel: planCurrencyOpenedFromDetailPanel,
          });
        }
        close();
      });
    });
  };

  const updateRangeUI = (context, range) => {
    document
      .querySelectorAll(`[data-range-label="${context}"]`)
      .forEach((el) => {
        el.textContent = range;
      });
    const startedAgo = `Past ${range} simulation · your setup`;
    const breakdownOutcome = "Simulated outcome ≈";
    if (context === "plan") {
      document.querySelectorAll("[data-plan-return-title]").forEach((el) => {
        el.textContent = startedAgo;
      });
      document
        .querySelectorAll("[data-plan-detail-historic-performance-label]")
        .forEach((el) => {
          // Multi-asset alloc header uses the --below label for combined historic performance.
          // Single-asset uses --header and the alloc-row tone (so --below is hidden by CSS).
          if (
            el.classList.contains(
              "plan-detail-panel__historic-performance-label--below",
            )
          ) {
            el.textContent = `Past ${range} perf.`;
          } else {
            el.textContent = `Past ${range} perf.`;
          }
        });
    }
    if (context === "breakdown" || context === "widgetBreakdown") {
      document
        .querySelectorAll("[data-plan-breakdown-profit-range-label]")
        .forEach((el) => {
          el.textContent = breakdownOutcome;
        });
    }
  };

  const initRangeSheet = () => {
    const sheet = document.querySelector("[data-range-sheet]");
    if (!sheet) return;

    const panel = sheet.querySelector(".currency-sheet__panel");
    const options = sheet.querySelectorAll("[data-range-sheet-option]");
    let currentContext = "plan";

    const setSelected = (value) => {
      options.forEach((opt) => {
        opt.classList.toggle(
          "is-selected",
          opt.getAttribute("data-range-sheet-option") === value,
        );
      });
    };

    const open = (context) => {
      currentContext = context;
      setSelected(rangeState[context]);
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    const close = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll("[data-range-sheet-trigger]").forEach((btn) => {
      btn.addEventListener("click", () =>
        open(btn.getAttribute("data-range-sheet-trigger")),
      );
    });

    sheet.querySelectorAll("[data-range-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", close);
    });

    options.forEach((opt) => {
      opt.addEventListener("click", () => {
        const value = opt.getAttribute("data-range-sheet-option");
        rangeState[currentContext] = value;
        setSelected(value);
        updateRangeUI(currentContext, value);
        if (currentContext === "plan") updatePlanStrategyHistoricalReturn();
        if (currentContext === "curated") updateCuratedReturnsUI();
        if (currentContext === "spotlight") updateSpotlightReturnsUI();
        document.dispatchEvent(
          new CustomEvent("range-sheet-confirmed", {
            detail: { context: currentContext, value },
          }),
        );
        close();
      });
    });
  };

  const initPlanBufferAutofillSheet = () => {
    const sheet = document.querySelector("[data-plan-buffer-autofill-sheet]");
    if (!sheet) return;
    const panel = sheet.querySelector(".currency-sheet__panel");
    const openTriggers = document.querySelectorAll(
      "[data-plan-buffer-autofill-info]",
    );

    const open = () => {
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    const close = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel?.removeEventListener("transitionend", onEnd);
      };
      panel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    openTriggers.forEach((btn) => btn.addEventListener("click", open));
    sheet
      .querySelectorAll("[data-plan-buffer-autofill-sheet-close]")
      .forEach((btn) => btn.addEventListener("click", close));
  };

  const initSmartAllocInfoSheet = () => {
    const sheet = document.querySelector("[data-smart-alloc-info-sheet]");
    if (!sheet) return;
    const panel = sheet.querySelector(".currency-sheet__panel");

    const open = () => {
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    const close = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel?.removeEventListener("transitionend", onEnd);
      };
      panel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    document
      .querySelectorAll("[data-smart-alloc-info-trigger]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          open();
        });
      });
    sheet
      .querySelectorAll("[data-smart-alloc-info-sheet-close]")
      .forEach((btn) => {
        btn.addEventListener("click", close);
      });
  };

  const initPlanDetailHistoricPerfInfoSheet = () => {
    const sheet = document.querySelector(
      "[data-plan-detail-historic-perf-info-sheet]",
    );
    if (!sheet) return;
    const panel = sheet.querySelector(".currency-sheet__panel");
    const rangeEl = sheet.querySelector(
      "[data-plan-detail-historic-perf-info-range]",
    );

    const open = () => {
      const range = rangeState?.plan || "5Y";
      if (rangeEl) rangeEl.textContent = range;
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    const close = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel?.removeEventListener("transitionend", onEnd);
      };
      panel?.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    document
      .querySelectorAll("[data-plan-detail-historic-performance-info]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          open();
        });
      });

    document
      .querySelectorAll("[data-plan-detail-historic-perf-sheet-trigger]")
      .forEach((region) => {
        region.addEventListener("click", () => {
          open();
        });
      });
    sheet
      .querySelectorAll("[data-plan-detail-historic-perf-info-sheet-close]")
      .forEach((btn) => {
        btn.addEventListener("click", close);
      });
  };

  const initScheduleBuyNowInfoSheet = () => {
    const sheet = document.querySelector("[data-schedule-buy-now-info-sheet]");
    if (!sheet) return;
    const panel = sheet.querySelector(".currency-sheet__panel");

    const reveal = () => {
      sheetOpenWithInstantBackdrop(sheet);
    };

    const open = () => {
      reveal();
    };

    const closeBuyNowInfoSheet = () => {
      // Standalone sheet: same close as top-up — backdrop fades with the panel (no --backdrop-handoff nested swap).
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    document.querySelectorAll(".schedule-sheet__buy-now-info").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        open();
      });
    });
    sheet
      .querySelectorAll("[data-schedule-buy-now-info-sheet-close]")
      .forEach((btn) => btn.addEventListener("click", closeBuyNowInfoSheet));
  };

  const initFinanceSummaryInfoSheets = () => {
    const closeSheet = (sheet) => {
      const panel = sheet?.querySelector(".currency-sheet__panel");
      if (!sheet || !panel) return;
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    document
      .querySelectorAll("[data-finance-summary-info-open]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          const kind = btn.getAttribute("data-finance-summary-info-open");
          if (!kind) return;
          const sheet = document.querySelector(
            `[data-finance-summary-info-sheet="${kind}"]`,
          );
          if (!sheet) return;
          sheetOpenWithInstantBackdrop(sheet);
        });
      });

    document
      .querySelectorAll("[data-finance-summary-info-sheet]")
      .forEach((sheet) => {
        sheet
          .querySelectorAll("[data-finance-summary-info-sheet-close]")
          .forEach((closeBtn) => {
            closeBtn.addEventListener("click", () => closeSheet(sheet));
          });
      });
  };

  /** Plan detail: top-up sheet (Deposit / Convert) — reuses currency-sheet chrome. */
  const initTopupSheet = () => {
    const sheet = document.querySelector("[data-topup-sheet]");
    if (!sheet) return;

    const panel = sheet.querySelector(".currency-sheet__panel");

    const syncTopupSheetCopy = () => {
      const cur = currencyState.plan;
      const sub = `Convert other currencies to ${cur}`;
      const titleEl = sheet.querySelector("[data-topup-sheet-title]");
      const convertDesc = sheet.querySelector("[data-topup-convert-desc]");
      if (titleEl) titleEl.textContent = `Get ${cur}`;
      if (convertDesc) convertDesc.textContent = sub;
      sheet.setAttribute("aria-label", `Get ${cur}`);
    };

    const open = () => {
      syncTopupSheetCopy();
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    const close = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    document
      .querySelectorAll("[data-plan-detail-topup-trigger]")
      .forEach((btn) => {
        btn.addEventListener("click", open);
      });

    sheet.querySelectorAll("[data-topup-sheet-close]").forEach((b) => {
      b.addEventListener("click", close);
    });

    sheet.querySelectorAll("[data-topup-action]").forEach((b) => {
      b.addEventListener("click", () => {
        // Prototype: no navigation yet
      });
    });
  };

  /** Prototype: when true, nested schedule sheets open on top without animating the parent closed. */
  const getBottomSheetStacking = () => {
    const input = document.querySelector(
      "[data-prototype-bottomsheet-stacking]",
    );
    if (!input) return true;
    return Boolean(input.checked);
  };

  /** Prototype control: show/hide S&P 500 series + legend inside Breakdown panel. */
  const getPrototypeBreakdownSp500Visible = () => {
    const input = document.querySelector("[data-prototype-breakdown-sp500]");
    if (!input) return false;
    return Boolean(input.checked);
  };

  /** Prototype control: show/hide Finance display currency selector pill. */
  const syncPrototypeFinanceCurrencySelectorVisible = () => {
    const input = document.querySelector(
      "[data-prototype-finance-display-currency-selector]",
    );
    const container = document.querySelector(".phone-container");
    if (!container) return;
    const on = Boolean(input?.checked);
    container.classList.toggle("is-proto-finance-currency-selector-on", on);
  };

  /** Prototype control: show/hide "First buy today" row in schedule sheet. */
  const syncPrototypeScheduleBuyNowRowVisible = () => {
    const input = document.querySelector(
      "[data-prototype-show-first-buy-today]",
    );
    const on = Boolean(input?.checked);
    document.querySelectorAll(".schedule-sheet__buy-now-row").forEach((row) => {
      row.style.display = on ? "" : "none";
    });
  };

  /** Prototype control: show/hide By amount / By period segmented control (plan buffer hero). */
  const syncPrototypeFundingAmountPeriodSegVisible = () => {
    const input = document.querySelector(
      "[data-prototype-show-funding-amount-period]",
    );
    const on = input ? Boolean(input.checked) : true;
    // Use `html` class so dynamically cloned panels (e.g. Funding2) stay in sync without per-node inline styles.
    document.documentElement.classList.toggle(
      "proto-hide-plan-buffer-funding-seg-hero",
      !on,
    );
  };

  /** Prototype control: mark most recent-activity tail card as failed. */
  const getPrototypeShowFailedBuy = () => {
    const input = document.querySelector("[data-prototype-show-failed-buy]");
    return Boolean(input?.checked);
  };

  /** Prototype control: plan detail allocation mode (manual vs smart). */
  const getPrototypeSmartAllocationEnabled = () => {
    const sel = document.querySelector("[data-prototype-smart-allocation]");
    return String(sel?.value || "manual") === "smart";
  };

  /** Prototype control: pre-fund activity log `<select id="prototype-prefund-log">` in build badge. */
  const getPrototypePrefundLogSelectEl = () =>
    document.getElementById("prototype-prefund-log") ||
    document.querySelector("select[data-prototype-prefund-log]");

  /** Prototype control: recent activity scenario in build badge. */
  const syncPrototypePrefundLogToDocument = () => {
    const sel = getPrototypePrefundLogSelectEl();
    const v = String(sel?.value || "none").toLowerCase();
    const safe =
      v === "prefunded" ||
      v === "returned" ||
      v === "paused" ||
      v === "resumed" ||
      v === "ended"
        ? v
        : "none";
    document.documentElement.dataset.prototypePrefundLog = safe;
  };

  const getPrototypePrefundLog = () => {
    const sel = getPrototypePrefundLogSelectEl();
    const v = String(sel?.value || "none").toLowerCase();
    if (
      v === "prefunded" ||
      v === "returned" ||
      v === "paused" ||
      v === "resumed" ||
      v === "ended"
    )
      return v;
    return "none";
  };

  const setPrototypePrefundLog = (next) => {
    const sel = getPrototypePrefundLogSelectEl();
    if (!sel) return;
    const v =
      next === "prefunded" ||
      next === "returned" ||
      next === "paused" ||
      next === "resumed" ||
      next === "ended"
        ? next
        : "none";
    sel.value = v;
    const opt = Array.from(sel.options).find((o) => String(o.value) === v);
    if (opt) sel.selectedIndex = Array.from(sel.options).indexOf(opt);
    sel.setAttribute("data-prototype-prefund-log", v);
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    syncPrototypePrefundLogToDocument();
    document.dispatchEvent(new CustomEvent("prototype-prefund-log-change"));
  };

  /**
   * Closing a nested sheet (time / set-limit / buys): skip shared nested scrim when stacking is on,
   * or when the main schedule sheet never left the screen (e.g. user toggled stacking off mid-flow).
   * Otherwise activateScheduleNestedScrim would zero the parent backdrop while the scrim sits under
   * the sheet (z-index), so the dim disappears.
   */
  const getSuppressNestedScrimForScheduleChildClose = () => {
    if (getBottomSheetStacking()) return true;
    const scheduleSheet = document.querySelector("[data-schedule-sheet]");
    return Boolean(
      scheduleSheet &&
      !scheduleSheet.hidden &&
      scheduleSheet.classList.contains("is-open"),
    );
  };

  /** Coordinates nested time-picker: close schedule sheet first, reopen after time sheet closes. */
  const scheduleSheetApi = {
    /** @type {null | ((onClosed?: () => void) => void)} */
    closeAnimatedForChild: null,
    /** @type {null | (() => void)} */
    reopenFromChild: null,
    /** @type {null | ((end: string) => void)} */
    onEndOptionSelect: null,
    /** @type {null | (() => void)} */
    refreshEndConditionSubtitles: null,
    /** Realigns set-limit count to ~1 year of buys for the active repeat frequency */
    applyScheduleSetLimitYearDefault: null,
    /** Plan detail repeats line when end = enddate (from inline stepper summary) */
    planDetailRepeatsEndLimitText: "",
  };

  const SHEET_BACKDROP_HANDOFF = "currency-sheet--backdrop-handoff";
  const SHEET_BACKDROP_INSTANT_IN = "currency-sheet--backdrop-instant-in";
  /** Stacked child closing: drop scrim immediately so parent sheet shows (stacking mode only). */
  const SHEET_STACK_POP_DISMISS = "currency-sheet--stack-pop-dismiss";

  const isScheduleStackSheet = (el) =>
    !!el?.matches?.(
      "[data-schedule-sheet], [data-schedule-time-sheet], [data-schedule-buys-sheet]",
    );

  const getScheduleNestedScrimEls = () => {
    const phoneContainer = document.querySelector(".phone-container");
    const nestedScrim = document.querySelector("[data-nested-sheet-scrim]");
    return { phoneContainer, nestedScrim };
  };

  let scheduleNestedScrimSession = false;

  /** One shared dimmer for schedule + nested sheets so two sheet backdrops never stack visually. */
  const activateScheduleNestedScrim = () => {
    const { phoneContainer, nestedScrim } = getScheduleNestedScrimEls();
    if (!phoneContainer || !nestedScrim) return;
    scheduleNestedScrimSession = true;
    nestedScrim.classList.remove("is-fading-out");
    nestedScrim.hidden = false;
    nestedScrim.setAttribute("aria-hidden", "false");
    phoneContainer.classList.add("phone-container--nested-sheet-scrim");
  };

  const resetScheduleNestedScrimHard = () => {
    const { phoneContainer, nestedScrim } = getScheduleNestedScrimEls();
    if (!phoneContainer || !nestedScrim) return;
    scheduleNestedScrimSession = false;
    nestedScrim.hidden = true;
    nestedScrim.classList.remove("is-fading-out");
    nestedScrim.setAttribute("aria-hidden", "true");
    phoneContainer.classList.remove("phone-container--nested-sheet-scrim");
  };

  const fadeOutScheduleNestedScrim = () => {
    const { phoneContainer, nestedScrim } = getScheduleNestedScrimEls();
    if (!nestedScrim || !scheduleNestedScrimSession) return;
    if (nestedScrim.classList.contains("is-fading-out")) return;
    nestedScrim.classList.add("is-fading-out");
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      nestedScrim.removeEventListener("transitionend", done);
      nestedScrim.hidden = true;
      nestedScrim.classList.remove("is-fading-out");
      nestedScrim.setAttribute("aria-hidden", "true");
      phoneContainer?.classList.remove("phone-container--nested-sheet-scrim");
      scheduleNestedScrimSession = false;
    };
    nestedScrim.addEventListener("transitionend", done);
    setTimeout(done, 240);
  };

  /**
   * Close sheet with panel slide; backdrop stays dim until hidden (nested handoff).
   * @param {{ suppressNestedScrim?: boolean }} [opts] If true, skip shared nested scrim (stacked child closing while parent stays open).
   */
  const sheetCloseWithBackdropHandoff = (
    rootEl,
    panelEl,
    onDone,
    opts = {},
  ) => {
    const { suppressNestedScrim } = opts;
    if (isScheduleStackSheet(rootEl) && !suppressNestedScrim) {
      activateScheduleNestedScrim();
    }
    if (!rootEl.classList.contains("is-open")) {
      rootEl.hidden = true;
      rootEl.classList.remove(SHEET_BACKDROP_HANDOFF);
      rootEl.classList.remove(SHEET_STACK_POP_DISMISS);
      onDone?.();
      return;
    }
    if (suppressNestedScrim) {
      rootEl.classList.add(SHEET_STACK_POP_DISMISS);
    } else {
      rootEl.classList.add(SHEET_BACKDROP_HANDOFF);
    }
    rootEl.classList.remove("is-open");
    let done = false;
    const onEnd = () => {
      if (done) return;
      done = true;
      panelEl.removeEventListener("transitionend", onEnd);
      if (!rootEl.classList.contains("is-open")) {
        rootEl.hidden = true;
        rootEl.classList.remove(SHEET_BACKDROP_HANDOFF);
        rootEl.classList.remove(SHEET_STACK_POP_DISMISS);
      }
      onDone?.();
    };
    panelEl.addEventListener("transitionend", onEnd);
    setTimeout(onEnd, 290);
  };

  /** Open sheet: scrim snaps to dim, then panel opens; restores normal backdrop transitions after. */
  const sheetOpenWithInstantBackdrop = (rootEl) => {
    rootEl.classList.add(SHEET_BACKDROP_INSTANT_IN);
    rootEl.hidden = false;
    requestAnimationFrame(() => {
      rootEl.classList.add("is-open");
      requestAnimationFrame(() => {
        rootEl.classList.remove(SHEET_BACKDROP_INSTANT_IN);
      });
    });
  };

  /**
   * Plan overview + My plans detail: one funding-method bottom sheet
   * (`data-plan-overview-funding-info-sheet`).
   */
  const openPlanOverviewFundingInfoSheet = ({ title, desc } = {}) => {
    const sheet = document.querySelector(
      "[data-plan-overview-funding-info-sheet]",
    );
    if (!sheet) return;
    const titleEl = sheet.querySelector(
      "[data-plan-overview-funding-info-sheet-title]",
    );
    const descEl = sheet.querySelector(
      "[data-plan-overview-funding-info-sheet-desc]",
    );
    const nextTitle = String(title || "").trim() || "Deduct from balance";
    const emphasizeLine = "You can change or turn off pre-funding any time.";
    const rawDesc = String(desc || "");
    const localizedDesc = window.I18N?.t ? window.I18N.t(rawDesc) : rawDesc;
    const escapeHtml = (str) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const highlightedDescHtml = escapeHtml(localizedDesc)
      .replace(
        /You can change or turn off pre-funding any time\.?/g,
        '<span class="currency-sheet__desc-highlight">You can change or turn off pre-funding any time.</span>',
      )
      .replace(/\n/g, "<br>");
    if (titleEl) titleEl.textContent = nextTitle;
    if (descEl) {
      descEl.innerHTML = highlightedDescHtml || escapeHtml(emphasizeLine);
    }
    sheet.setAttribute("aria-label", nextTitle);
    sheetOpenWithInstantBackdrop(sheet);
  };

  const initPlanOverviewFundingInfoSheet = () => {
    const sheet = document.querySelector(
      "[data-plan-overview-funding-info-sheet]",
    );
    if (!sheet) return;
    const panel = sheet.querySelector(".currency-sheet__panel");
    const titleEl = sheet.querySelector(
      "[data-plan-overview-funding-info-sheet-title]",
    );
    const descEl = sheet.querySelector(
      "[data-plan-overview-funding-info-sheet-desc]",
    );
    if (!panel) return;

    const paygoTitle = "Deduct from balance";
    const paygoDesc =
      "We automatically deduct funds from your balance on each scheduled date of your DCA plan." +
      "\n\n" +
      "Orders start to execute at 12:00 PM (GMT +8).";

    const closeSheet = () => {
      sheet.classList.remove("is-open");
      const onEnd = () => {
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    /** @param {'overview' | 'my-plans-detail'} source */
    const open = (source) => {
      let isReserved = false;
      if (source === "my-plans-detail") {
        const main =
          document
            .querySelector("[data-my-plans-detail-funding-main]")
            ?.textContent?.trim() || "";
        isReserved = /\bset aside funds\b/i.test(main);
      } else {
        const method =
          document
            .querySelector("[data-plan-overview-payment-method]")
            ?.textContent?.trim() || "";
        isReserved = /\bset aside/i.test(method);
      }
      const title = isReserved ? "Set aside funds" : paygoTitle;
      const desc = isReserved
        ? "Funds are reserved and used automatically for your scheduled buys. You can adjust or add funds any time."
        : paygoDesc;
      if (titleEl) titleEl.textContent = title;
      if (descEl) descEl.textContent = desc;
      openPlanOverviewFundingInfoSheet({ title, desc });
    };

    document
      .querySelectorAll("[data-plan-overview-funding-info-open]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          open("overview");
        });
      });

    document
      .querySelectorAll("[data-my-plans-funding-info-trigger]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          open("my-plans-detail");
        });
      });

    sheet
      .querySelectorAll("[data-plan-overview-funding-info-sheet-close]")
      .forEach((b) => {
        b.addEventListener("click", () => closeSheet());
      });
  };

  /** My plans detail (prefund layout, funding state ≥3): pre-funded info + edit pre-funding sheets. */
  const initMyPlansPrefundDetailSheets = () => {
    const formatPrefundLeftSubtitle = () => {
      const managePrefundLeft = String(
        document
          .querySelector("[data-my-plans-manage-sheet]")
          ?.getAttribute("data-my-plans-manage-prefund-left-value") || "",
      ).trim();
      if (managePrefundLeft) return managePrefundLeft;
      const fallbackCur = String(currencyState.plan || "TWD")
        .trim()
        .toUpperCase();
      const detailPrefundText = String(
        document.querySelector("[data-my-plans-detail-funding-prefund-amount]")
          ?.textContent || "",
      ).trim();
      const detailParsed = parseMoneyWithCurrency(detailPrefundText);
      if (detailParsed && detailParsed.amount >= 0) {
        const cur = String(detailParsed.currency || fallbackCur)
          .trim()
          .toUpperCase();
        return `${detailParsed.amount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${cur} left`;
      }
      const records =
        typeof getMyPlansRecords === "function" ? getMyPlansRecords() : [];
      const rec = records[0] || null;
      const reservedParsed = parseMoneyWithCurrency(
        String(rec?.reservedFunds || ""),
      );
      const amount = Number.isFinite(reservedParsed?.amount)
        ? Math.max(0, Number(reservedParsed.amount))
        : 0;
      const cur = String(reservedParsed?.currency || fallbackCur)
        .trim()
        .toUpperCase();
      return `${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${cur} left`;
    };

    const syncPrefundSheetCurrencyCopy = () => {
      const cur = String(currencyState.plan || "TWD")
        .trim()
        .toUpperCase();
      const editSheet = document.querySelector(
        "[data-my-plans-prefund-edit-sheet]",
      );
      const endConfirmSheet = document.querySelector(
        "[data-my-plans-prefund-end-confirm-sheet]",
      );
      const editReturnNameEl = editSheet?.querySelector(
        "[data-my-plans-prefund-edit-return-name]",
      );
      const editReturnDescEl = editSheet?.querySelector(
        "[data-my-plans-prefund-edit-return-desc]",
      );
      const editLeftSubtitleEl = editSheet?.querySelector(
        "[data-my-plans-prefund-edit-left-subtitle]",
      );
      const endTitleEl = endConfirmSheet?.querySelector(
        "[data-my-plans-prefund-end-confirm-title]",
      );
      const endHighlightEl = endConfirmSheet?.querySelector(
        "[data-my-plans-prefund-end-confirm-highlight]",
      );
      const endCopyEl = endConfirmSheet?.querySelector(
        "[data-my-plans-prefund-end-confirm-copy-body]",
      );
      const endSubmitEl = endConfirmSheet?.querySelector(
        "[data-my-plans-prefund-end-confirm-submit]",
      );

      if (editReturnNameEl)
        editReturnNameEl.textContent = `Return reserved ${cur}`;
      if (editReturnDescEl)
        editReturnDescEl.textContent = `Release pre-funded ${cur} back to your wallet and stop auto-refill`;
      if (editLeftSubtitleEl)
        editLeftSubtitleEl.textContent = formatPrefundLeftSubtitle();
      if (endTitleEl) endTitleEl.textContent = `Return reserved ${cur}?`;
      if (endHighlightEl)
        endHighlightEl.textContent = `Your pre-funded ${cur} will be released back to your wallet, and auto-refill will stop.`;
      if (endCopyEl)
        endCopyEl.textContent = `This plan will resume deducting from your wallet's ${cur} balance on each scheduled DCA date.`;
      if (endSubmitEl) endSubmitEl.textContent = `Return reserved ${cur}`;
    };

    const bindSheet = (sheetSelector, closeAttr, openSelector) => {
      const sheet = document.querySelector(sheetSelector);
      if (!sheet) return;
      const panel = sheet.querySelector(".currency-sheet__panel");
      if (!panel) return;

      const closeSheet = () => {
        sheet.classList.remove("is-open");
        const onEnd = () => {
          if (!sheet.classList.contains("is-open")) sheet.hidden = true;
          panel.removeEventListener("transitionend", onEnd);
        };
        panel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 290);
      };

      sheet.querySelectorAll(`[${closeAttr}]`).forEach((b) => {
        b.addEventListener("click", () => closeSheet());
      });

      document.querySelectorAll(openSelector).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          syncPrefundSheetCurrencyCopy();
          sheetOpenWithInstantBackdrop(sheet);
        });
      });
    };

    bindSheet(
      "[data-my-plans-prefund-funded-info-sheet]",
      "data-my-plans-prefund-funded-info-sheet-close",
      "[data-my-plans-prefund-funded-info-sheet-open]",
    );
    bindSheet(
      "[data-my-plans-prefund-edit-sheet]",
      "data-my-plans-prefund-edit-sheet-close",
      "[data-my-plans-prefund-edit-sheet-open]",
    );
    syncPrefundSheetCurrencyCopy();
    document.addEventListener(
      "plan-investment-currency-updated",
      syncPrefundSheetCurrencyCopy,
    );
    /** Manage plan → Pre-funding settings opens the edit sheet without `[data-my-plans-prefund-edit-sheet-open]`; keep copy in sync. */
    document.addEventListener(
      "my-plans-prefund-edit-sheet-sync-copy",
      syncPrefundSheetCurrencyCopy,
    );
  };

  /** Plan detail: auto-invest schedule sheet (currency-sheet chrome). */
  const initScheduleSheet = () => {
    const sheet = document.querySelector("[data-schedule-sheet]");
    if (!sheet) return;

    const panel = sheet.querySelector(".currency-sheet__panel");
    const planDetail = document.querySelector("[data-plan-detail-panel]");
    const freqButtons = sheet.querySelectorAll("[data-schedule-freq]");
    const timingLabelEl = sheet.querySelector("[data-schedule-timing-label]");
    const timingValueEl = sheet.querySelector("[data-schedule-timing-value]");
    const buyNowToggleEl = planDetail?.querySelector(
      "[data-schedule-buy-now-toggle]",
    );
    const buyNowStateEl = planDetail?.querySelector(
      "[data-schedule-buy-now-state]",
    );
    const endButtons = sheet.querySelectorAll("[data-schedule-end]");
    const tr = (s, params) => (window.I18N?.t ? window.I18N.t(s, params) : s);

    const timingSectionLabels = {
      daily: "Every day",
      weekly: "Every week on",
      monthly: "Every month on",
      flexible: "Buy on these days every month",
    };
    const defaultTimingDetail = {
      daily: "- -",
      weekly: "Monday",
      monthly: "15th",
      flexible: "Select days",
    };
    const freqSchedulePrefix = {
      daily: "Daily",
      weekly: "Weekly",
      monthly: "Monthly",
      flexible: "Flexible",
    };
    let buyNowEnabled = false;
    const confirmBtn = sheet.querySelector("[data-schedule-sheet-confirm]");

    const setFreqUI = (freq) => {
      freqButtons.forEach((btn) => {
        const v = btn.getAttribute("data-schedule-freq");
        const on = v === freq;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });
    };

    const setEndUI = (end) => {
      endButtons.forEach((btn) => {
        const v = btn.getAttribute("data-schedule-end");
        btn.classList.toggle("is-selected", v === end);
      });
    };

    const endLimitRowBtn = sheet.querySelector('[data-schedule-end="enddate"]');
    const endLimitTitleEl = endLimitRowBtn?.querySelector(
      "[data-schedule-endlimit-title]",
    );

    const hasSchedulePerBuyAmount = () => {
      const raw =
        document.querySelector("[data-plan-detail-amount-input]")?.value ?? "";
      const n = parseInt(String(raw).replace(/,/g, "").trim(), 10);
      return Number.isFinite(n) && n > 0;
    };

    const syncEndLimitRowAvailability = () => {
      if (!endLimitRowBtn || !endLimitTitleEl) return;
      const descEl = sheet.querySelector("[data-schedule-endlimit-desc]");
      const ok = hasSchedulePerBuyAmount();
      if (!ok) {
        endLimitRowBtn.classList.add("schedule-end-limit-row--disabled");
        endLimitRowBtn.setAttribute("aria-disabled", "true");
        endLimitRowBtn.tabIndex = -1;
        endLimitTitleEl.textContent = tr("Set a limit (disabled)");
        if (descEl) {
          descEl.textContent = tr("Enter an amount to buy first");
          descEl.classList.add("schedule-end-limit-desc--needs-amount");
        }
        return;
      }
      endLimitRowBtn.classList.remove("schedule-end-limit-row--disabled");
      endLimitRowBtn.removeAttribute("aria-disabled");
      endLimitRowBtn.tabIndex = 0;
      endLimitTitleEl.textContent = tr("Set a limit");
      if (descEl) {
        descEl.classList.remove("schedule-end-limit-desc--needs-amount");
        const end = sheet
          .querySelector("[data-schedule-end].is-selected")
          ?.getAttribute("data-schedule-end");
        if (end !== "enddate") descEl.textContent = "";
      }
    };

    scheduleSheetApi.setEndConditionUI = setEndUI;
    scheduleSheetApi.hasSchedulePerBuyAmount = hasSchedulePerBuyAmount;
    scheduleSheetApi.syncEndLimitRowAvailability = syncEndLimitRowAvailability;

    const parseFreqFromScheduleText = (text) => {
      const head = (text || "").split("·")[0]?.trim().toLowerCase() || "";
      if (head.startsWith("daily")) return "daily";
      if (head.startsWith("weekly")) return "weekly";
      if (head.startsWith("flexible")) return "flexible";
      return "monthly";
    };

    const parseTimingFromScheduleText = (text, freq) => {
      const stripTimeSuffix = (v) =>
        String(v || "")
          .replace(/\s*at\s+~?\s*\d{1,2}:\d{2}/gi, "")
          .trim();
      const parts = (text || "").split("·").map((s) => s.trim());
      if (parts.length >= 2) {
        const detail = parts.slice(1).join(" · ");
        if (freq === "daily") {
          return defaultTimingDetail.daily;
        }
        if (freq === "flexible") {
          const v = stripTimeSuffix(detail);
          return v ? v : defaultTimingDetail.flexible;
        }
        return stripTimeSuffix(detail) || defaultTimingDetail[freq];
      }
      return defaultTimingDetail[freq];
    };

    const timingRowBtn = sheet.querySelector(".schedule-sheet__timing-row");
    const syncTimingRowInteractivity = (freq) => {
      if (!timingRowBtn) return;
      const disabled = freq === "daily";
      timingRowBtn.disabled = disabled;
      timingRowBtn.classList.toggle(
        "schedule-sheet__timing-row--disabled",
        disabled,
      );
      timingRowBtn.setAttribute("aria-disabled", disabled ? "true" : "false");
      if (disabled && timingValueEl)
        timingValueEl.textContent = tr(defaultTimingDetail.daily);
      if (timingValueEl) {
        const currentText = String(timingValueEl.textContent || "").trim();
        const isPlaceholder =
          freq === "flexible" &&
          (currentText === defaultTimingDetail.flexible ||
            currentText === tr(defaultTimingDetail.flexible));
        timingValueEl.classList.toggle(
          "schedule-sheet__timing-value--placeholder",
          isPlaceholder,
        );
      }
    };

    const syncScheduleConfirmDisabled = () => {
      if (!(confirmBtn instanceof HTMLButtonElement)) return;
      const freqBtn = sheet.querySelector("[data-schedule-freq].is-active");
      const freq = (
        freqBtn?.getAttribute("data-schedule-freq") || "monthly"
      ).toLowerCase();
      const timingText = String(timingValueEl?.textContent || "").trim();
      const isFlexUnset =
        freq === "flexible" &&
        (!timingText ||
          timingText === defaultTimingDetail.flexible ||
          timingText === tr(defaultTimingDetail.flexible));
      confirmBtn.disabled = isFlexUnset;
      confirmBtn.classList.toggle("is-disabled", isFlexUnset);
      if (timingValueEl) {
        const isPlaceholder =
          freq === "flexible" &&
          (!timingText ||
            timingText === defaultTimingDetail.flexible ||
            timingText === tr(defaultTimingDetail.flexible));
        timingValueEl.classList.toggle(
          "schedule-sheet__timing-value--placeholder",
          isPlaceholder,
        );
      }
    };

    const setBuyNowUI = (enabled) => {
      buyNowEnabled = !!enabled;
      if (planDetail)
        planDetail.dataset.scheduleBuyNow = buyNowEnabled ? "1" : "0";
      if (buyNowToggleEl) {
        buyNowToggleEl.classList.toggle("is-on", buyNowEnabled);
        buyNowToggleEl.setAttribute(
          "aria-checked",
          buyNowEnabled ? "true" : "false",
        );
      }
      if (buyNowStateEl) {
        buyNowStateEl.textContent = tr(buyNowEnabled ? "On" : "Off");
        buyNowStateEl.classList.toggle("is-on", buyNowEnabled);
      }
    };

    const open = () => {
      const scheduleEl = planDetail?.querySelector(
        "[data-plan-detail-schedule]",
      );
      const endEl = planDetail?.querySelector("[data-plan-detail-repeats-end]");
      const scheduleText = scheduleEl
        ? getPlanDetailScheduleFullTextFromEl(scheduleEl)
        : "";

      const mainFreqBtn = document.querySelector(
        "[data-plan-freq-item].is-active",
      );
      const mainFreq = (
        mainFreqBtn?.getAttribute("data-plan-freq-item") || "monthly"
      ).toLowerCase();
      const freq = scheduleText
        ? parseFreqFromScheduleText(scheduleText)
        : mainFreq;

      setFreqUI(freq);
      if (timingLabelEl)
        timingLabelEl.textContent = tr(
          timingSectionLabels[freq] || timingSectionLabels.monthly,
        );
      if (timingValueEl) {
        timingValueEl.textContent = tr(
          scheduleText
            ? parseTimingFromScheduleText(scheduleText, freq)
            : defaultTimingDetail[freq],
        );
      }
      syncTimingRowInteractivity(freq);
      syncScheduleConfirmDisabled();
      setBuyNowUI(planDetail?.dataset?.scheduleBuyNow === "1");

      let end = "continuous";
      const endText = String(
        endEl?.dataset?.endConditionText || endEl?.textContent || "",
      ).trim();
      // Match "… · ~ Ends Jun 18, 2026" plus legacy variants.
      const isSetLimitPlanDetail =
        endText === "End on date" ||
        (/\b(buy|buys)\b/i.test(endText) &&
          (endText.includes("~ Ends") ||
            endText.includes("Ends ~") ||
            /\bEnds\s+[\w\s,.]+\s*~\s*$/i.test(endText)));
      if (isSetLimitPlanDetail) end = "enddate";
      else if (endText.startsWith("After")) end = "buys";
      setEndUI(end);
      scheduleSheetApi.refreshEndConditionSubtitles?.();

      const endSel = sheet
        .querySelector("[data-schedule-end].is-selected")
        ?.getAttribute("data-schedule-end");
      if (endSel === "enddate") {
        const descEl = sheet.querySelector("[data-schedule-endlimit-desc]");
        const line = scheduleSheetApi.planDetailRepeatsEndLimitText?.trim();
        if (descEl && line && !descEl.textContent.trim()) {
          descEl.textContent = line;
        }
      }

      resetScheduleNestedScrimHard();
      sheet.hidden = false;
      requestAnimationFrame(() => sheet.classList.add("is-open"));
    };

    const close = () => {
      if (scheduleNestedScrimSession) {
        fadeOutScheduleNestedScrim();
      }
      sheet.classList.remove("is-open");
      let done = false;
      const onEnd = () => {
        if (done) return;
        done = true;
        panel.removeEventListener("transitionend", onEnd);
        if (!sheet.classList.contains("is-open")) sheet.hidden = true;
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    /** Used by nested sheets: slide schedule out without fading the scrim, then `onClosed`. */
    const closeAnimatedForChild = (onClosed) => {
      if (getBottomSheetStacking()) {
        onClosed?.();
        return;
      }
      sheetCloseWithBackdropHandoff(sheet, panel, onClosed);
    };

    /** After nested sheet closes — reopen schedule; scrim appears without fade-in. */
    const reopenFromChild = () => {
      if (getBottomSheetStacking()) {
        if (!sheet.hidden && sheet.classList.contains("is-open")) return;
      }
      sheetOpenWithInstantBackdrop(sheet);
    };

    scheduleSheetApi.closeAnimatedForChild = closeAnimatedForChild;
    scheduleSheetApi.reopenFromChild = reopenFromChild;

    const toCanonicalTimingForFreq = (freq, value) => {
      const toOrdinal = (day) => {
        const j = day % 10;
        const k = day % 100;
        if (k >= 11 && k <= 13) return `${day}th`;
        if (j === 1) return `${day}st`;
        if (j === 2) return `${day}nd`;
        if (j === 3) return `${day}rd`;
        return `${day}th`;
      };
      const raw = String(value || "").trim();
      if (!raw) return defaultTimingDetail[freq] || defaultTimingDetail.monthly;
      if (freq === "weekly") {
        const weekdayMap = {
          週一: "Monday",
          週二: "Tuesday",
          週三: "Wednesday",
          週四: "Thursday",
          週五: "Friday",
          週六: "Saturday",
          週日: "Sunday",
          星期一: "Monday",
          星期二: "Tuesday",
          星期三: "Wednesday",
          星期四: "Thursday",
          星期五: "Friday",
          星期六: "Saturday",
          星期日: "Sunday",
        };
        return weekdayMap[raw] || raw;
      }
      if (freq === "monthly") {
        const m = raw.match(/(\d{1,2})/);
        if (!m) return defaultTimingDetail.monthly;
        const day = Math.max(1, Math.min(28, parseInt(m[1], 10)));
        return toOrdinal(day);
      }
      return raw;
    };

    const applyAndClose = () => {
      const freqBtn = sheet.querySelector("[data-schedule-freq].is-active");
      const freq = (
        freqBtn?.getAttribute("data-schedule-freq") || "monthly"
      ).toLowerCase();
      const endBtn = sheet.querySelector("[data-schedule-end].is-selected");
      const end = endBtn?.getAttribute("data-schedule-end") || "continuous";
      const timingDisplay =
        (timingValueEl?.textContent || "").trim() ||
        tr(defaultTimingDetail[freq]);
      const timing = toCanonicalTimingForFreq(freq, timingDisplay);
      const prefix = freqSchedulePrefix[freq] || freqSchedulePrefix.monthly;

      document.querySelectorAll("[data-plan-freq-item]").forEach((item) => {
        const v = item.getAttribute("data-plan-freq-item");
        const on = v === freq;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", on ? "true" : "false");
      });

      const scheduleEl = planDetail?.querySelector(
        "[data-plan-detail-schedule]",
      );
      const endEl = planDetail?.querySelector("[data-plan-detail-repeats-end]");
      if (scheduleEl) {
        const nextSchedule =
          freq === "daily" ? "Daily" : `${prefix} · ${timing}`;
        setPlanDetailScheduleElement(scheduleEl, nextSchedule);
      }
      if (planDetail)
        planDetail.dataset.scheduleBuyNow = buyNowEnabled ? "1" : "0";
      if (endEl) {
        const setEndConditionText = (nextText) => {
          const next = String(nextText || "").trim();
          endEl.dataset.endConditionText = next;
          endEl.textContent = next;
        };
        if (end === "continuous") {
          setEndConditionText("Continuous");
          scheduleSheetApi.planDetailRepeatsEndLimitText = "";
        } else if (end === "enddate") {
          const limitDesc = document
            .querySelector("[data-schedule-setlimit-end-date]")
            ?.textContent?.trim();
          setEndConditionText(
            scheduleSheetApi.planDetailRepeatsEndLimitText ||
              limitDesc ||
              "End on date",
          );
        } else {
          setEndConditionText("After number of buys");
        }
      }

      document.dispatchEvent(
        new CustomEvent("plan-schedule-confirmed", { detail: { freq, end } }),
      );
      close();
    };

    document
      .querySelectorAll(".plan-detail-panel__repeats-row")
      .forEach((row) => {
        row.addEventListener("click", () => {
          open();
        });
      });

    sheet.querySelectorAll("[data-schedule-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", close);
    });

    if (confirmBtn) confirmBtn.addEventListener("click", applyAndClose);

    buyNowToggleEl?.addEventListener("click", () => {
      setBuyNowUI(!buyNowEnabled);
    });

    freqButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const freq = (
          btn.getAttribute("data-schedule-freq") || "monthly"
        ).toLowerCase();
        setFreqUI(freq);
        if (timingLabelEl)
          timingLabelEl.textContent = tr(
            timingSectionLabels[freq] || timingSectionLabels.monthly,
          );
        if (timingValueEl)
          timingValueEl.textContent = tr(defaultTimingDetail[freq]);
        syncTimingRowInteractivity(freq);
        syncScheduleConfirmDisabled();
        scheduleSheetApi.refreshEndConditionSubtitles?.();
      });
    });

    // Enable Confirm once flexible days are selected (timing value changes from placeholder).
    if (timingValueEl) {
      const obs = new MutationObserver(() => {
        syncScheduleConfirmDisabled();
      });
      obs.observe(timingValueEl, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    }

    // Ensure initial disabled state is correct on load.
    syncScheduleConfirmDisabled();

    endButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const end = btn.getAttribute("data-schedule-end") || "continuous";
        if (
          end === "enddate" &&
          btn.classList.contains("schedule-end-limit-row--disabled")
        )
          return;
        setEndUI(end);
        scheduleSheetApi.refreshEndConditionSubtitles?.();
        if (end === "enddate") scheduleSheetApi.onEndOptionSelect?.(end);
      });
    });

    document
      .querySelector("[data-plan-detail-amount-input]")
      ?.addEventListener("input", () => {
        scheduleSheetApi.refreshEndConditionSubtitles?.();
      });

    scheduleSheetApi.syncBuyNowFromPlanDetail = () => {
      setBuyNowUI(planDetail?.dataset?.scheduleBuyNow === "1");
    };
  };

  /**
   * “Set a limit” inline stepper — Figma DCA1.0_modal_schedule (8520:8386).
   * @returns {{
   *   syncDom: () => void,
   *   getSummary: () => { count: number, endsApprox: string },
   *   getCount: () => number,
   *   setCount: (nextCount: number) => void,
   *   applyYearDefaultForActiveFreq: () => void
   * } | null}
   */
  const initScheduleSetLimitStepper = (scheduleSheet, limitHostRoot) => {
    const root = limitHostRoot || scheduleSheet;
    const host = root.querySelector("[data-schedule-setlimit-inline]");
    const valueEl = host?.querySelector("[data-schedule-setlimit-value]");
    const suffixEl = host?.querySelector("[data-schedule-setlimit-suffix]");
    // End date label lives outside the stepper pill in some layouts (e.g. summary row).
    const dateEl = root.querySelector("[data-schedule-setlimit-end-date]");
    const decBtn = host?.querySelector("[data-schedule-setlimit-dec]");
    const incBtn = host?.querySelector("[data-schedule-setlimit-inc]");
    const dec10Btn = host?.querySelector("[data-schedule-setlimit-dec-10]");
    const inc10Btn = host?.querySelector("[data-schedule-setlimit-inc-10]");
    if (
      !host ||
      !valueEl ||
      !suffixEl ||
      !dateEl ||
      !decBtn ||
      !incBtn ||
      !dec10Btn ||
      !inc10Btn
    )
      return null;

    const MIN = 1;
    const MAX = 999;

    const getActiveFreq = () => {
      const btn = scheduleSheet.querySelector("[data-schedule-freq].is-active");
      return (
        btn?.getAttribute("data-schedule-freq") || "monthly"
      ).toLowerCase();
    };

    /** Always 12 for fresh state; freq changes do not override user-adjusted count. */
    const DEFAULT_LIMIT_BUYS = 12;

    let count = Math.max(MIN, Math.min(MAX, DEFAULT_LIMIT_BUYS));
    let countUserCustomized = false;

    /** 1–28 from strings like "15th at ~12:00"; null if not monthly-style. */
    const parseMonthlyBuyDayFromTiming = (text) => {
      const m = String(text || "").match(/(\d{1,2})(?:st|nd|rd|th)/i);
      if (!m) return null;
      return Math.max(1, Math.min(28, parseInt(m[1], 10)));
    };

    const projectEndDate = (buys) => {
      const freq = getActiveFreq();
      const d = new Date();
      const n = Math.max(MIN, Math.min(MAX, buys));
      if (freq === "daily") d.setDate(d.getDate() + n);
      else if (freq === "weekly") d.setDate(d.getDate() + n * 7);
      else {
        d.setMonth(d.getMonth() + n);
        const tv = (
          scheduleSheet.querySelector("[data-schedule-timing-value]")
            ?.textContent || ""
        ).trim();
        const buyDay = parseMonthlyBuyDayFromTiming(tv);
        if (buyDay != null) {
          const lastInMonth = new Date(
            d.getFullYear(),
            d.getMonth() + 1,
            0,
          ).getDate();
          d.setDate(Math.min(buyDay, lastInMonth));
        }
      }
      return d;
    };

    const formatProjection = (d) =>
      d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

    const getSummary = () => ({
      count,
      endsApprox: formatProjection(projectEndDate(count)),
    });

    const getCount = () => count;

    const setCount = (nextCount) => {
      const n = Number(nextCount);
      count = Number.isFinite(n)
        ? Math.max(MIN, Math.min(MAX, Math.round(n)))
        : count;
      syncDom();
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    };

    const syncDom = () => {
      valueEl.textContent = String(count);
      suffixEl.textContent = count === 1 ? "buy" : "buys";
      dateEl.textContent = `~ Ends ${formatProjection(projectEndDate(count))}`;
      decBtn.disabled = count <= MIN;
      dec10Btn.disabled = count <= MIN;
      incBtn.disabled = count >= MAX;
      inc10Btn.disabled = count >= MAX;
    };

    const bump = (delta) => {
      countUserCustomized = true;
      count = Math.max(MIN, Math.min(MAX, count + delta));
      syncDom();
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    };

    dec10Btn.addEventListener("click", () => bump(-10));
    decBtn.addEventListener("click", () => bump(-1));
    incBtn.addEventListener("click", () => bump(1));
    inc10Btn.addEventListener("click", () => bump(10));

    const applyYearDefaultForActiveFreq = () => {
      if (countUserCustomized) return;
      count = Math.max(MIN, Math.min(MAX, DEFAULT_LIMIT_BUYS));
      syncDom();
      scheduleSheetApi.refreshEndConditionSubtitles?.();
    };

    syncDom();
    return {
      syncDom,
      getSummary,
      getCount,
      setCount,
      applyYearDefaultForActiveFreq,
    };
  };

  /** Schedule sheet: nested follow-up for “Set a limit” stepper (same backdrop handoff as time picker). */
  const initScheduleEndFollowupSheets = () => {
    const scheduleSheet = document.querySelector("[data-schedule-sheet]");
    const buysSheet = document.querySelector("[data-schedule-buys-sheet]");
    if (!scheduleSheet || !buysSheet) return;

    const buysPanel = buysSheet.querySelector(".currency-sheet__panel");
    const handoff = scheduleSheetApi.closeAnimatedForChild;
    const reopen = scheduleSheetApi.reopenFromChild;

    const setLimitStepper = initScheduleSetLimitStepper(
      scheduleSheet,
      buysSheet,
    );
    const modeBtns = buysSheet.querySelectorAll("[data-setlimit-mode]");
    const labelEl = buysSheet.querySelector("[data-setlimit-label]");
    const captionEl = buysSheet.querySelector("[data-setlimit-caption]");
    const perBuyEl = buysSheet.querySelector("[data-setlimit-perbuy]");
    const totalBuysEl = buysSheet.querySelector("[data-setlimit-totalbuys]");
    const totalAmountEl = buysSheet.querySelector(
      "[data-setlimit-totalamount]",
    );
    const periodsValueCell = buysSheet.querySelector(
      '[data-setlimit-value-mode="periods"]',
    );
    const amountValueCell = buysSheet.querySelector(
      '[data-setlimit-value-mode="amount"]',
    );
    const amountCurEl = buysSheet.querySelector("[data-setlimit-value-cur]");
    const amountAmtEl = buysSheet.querySelector("[data-setlimit-value-amt]");
    const pillEl = buysSheet.querySelector(".schedule-setlimit-inline__pill");
    const endsEl = buysSheet.querySelector("[data-schedule-setlimit-end-date]");
    const buysConfirmBtn = buysSheet.querySelector(
      "[data-schedule-buys-sheet-confirm]",
    );
    const summaryRowBuyCount = buysSheet.querySelector(
      ".setlimit-sheet__summary-row--buycount",
    );
    const summaryRowTotalAmount = buysSheet.querySelector(
      ".setlimit-sheet__summary-row--totalamount",
    );
    const periodEl = buysSheet.querySelector("[data-setlimit-period]");

    const SETLIMIT_VALUE_PLACEHOLDER = "- -";

    const getPerBuyAmount = () => {
      const raw =
        document.querySelector("[data-plan-detail-amount-input]")?.value ?? "";
      const s = String(raw).replace(/,/g, "").trim();
      if (s === "") return null;
      const n = parseInt(s, 10);
      return Number.isFinite(n) && n > 0 ? n : null;
    };

    const getPerBuyCurrency = () =>
      document
        .querySelector("[data-plan-detail-currency]")
        ?.textContent?.trim() ||
      document
        .querySelector("[data-plan-detail-coverage-currency]")
        ?.textContent?.trim() ||
      "USDT";

    const fmt = (n) =>
      Number.isFinite(n)
        ? n.toLocaleString("en-US")
        : SETLIMIT_VALUE_PLACEHOLDER;

    let mode = "amount"; // 'periods' | 'amount'
    /** Remember Total amount tab for next open (only applied when auto-invest amount is set). */
    let setLimitFollowupPreferredMode = "amount";

    const getFreqUnitPlural = (count) => {
      const freqKey = (
        document
          .querySelector("[data-plan-freq-item].is-active")
          ?.getAttribute("data-plan-freq-item") || "monthly"
      ).toLowerCase();
      const unit =
        freqKey === "daily" ? "day" : freqKey === "weekly" ? "week" : "month";
      return `${unit}${count === 1 ? "" : "s"}`;
    };

    const setModeUI = (nextMode) => {
      mode = nextMode === "amount" ? "amount" : "periods";
      modeBtns.forEach((btn) => {
        const v = btn.getAttribute("data-setlimit-mode");
        const on = v === mode;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-selected", on ? "true" : "false");
      });

      if (periodsValueCell) periodsValueCell.hidden = mode !== "periods";
      if (amountValueCell) amountValueCell.hidden = mode !== "amount";

      if (labelEl)
        labelEl.textContent =
          mode === "amount" ? "Set total amount" : "Set total buys";
      // if (captionEl) captionEl.hidden = mode !== 'amount';

      // Summary rows: amount-mode shows Buy count; buys-mode shows Total amount.
      if (summaryRowBuyCount) summaryRowBuyCount.hidden = mode !== "amount";
      if (summaryRowTotalAmount)
        summaryRowTotalAmount.hidden = mode !== "periods";
    };

    const syncSummary = () => {
      if (!setLimitStepper) return;
      const perBuy = getPerBuyAmount();
      const cur = getPerBuyCurrency();
      const hasPerBuy = perBuy != null && perBuy > 0;
      const { count } = setLimitStepper.getSummary();
      const total = hasPerBuy ? perBuy * count : null;

      if (perBuyEl) {
        perBuyEl.textContent = hasPerBuy
          ? `${fmt(perBuy)} ${cur}`
          : SETLIMIT_VALUE_PLACEHOLDER;
      }
      if (totalBuysEl) totalBuysEl.textContent = `${count} buys`;
      if (totalAmountEl) {
        totalAmountEl.textContent = hasPerBuy
          ? `${fmt(total)} ${cur}`
          : SETLIMIT_VALUE_PLACEHOLDER;
      }

      if (periodEl) {
        periodEl.textContent = `${count} ${getFreqUnitPlural(count)}`;
      }

      if (captionEl) {
        captionEl.textContent = hasPerBuy
          ? `${fmt(perBuy)} ${cur} per buy`
          : `${SETLIMIT_VALUE_PLACEHOLDER} per buy`;
      }
      if (amountCurEl) amountCurEl.textContent = hasPerBuy ? cur : "";
      if (amountAmtEl) {
        amountAmtEl.textContent = hasPerBuy
          ? fmt(total)
          : SETLIMIT_VALUE_PLACEHOLDER;
      }

      const blockAmountStepper = mode === "amount" && !hasPerBuy;
      if (pillEl)
        pillEl.classList.toggle(
          "schedule-setlimit-inline__pill--blocked",
          blockAmountStepper,
        );
      if (buysConfirmBtn) buysConfirmBtn.disabled = blockAmountStepper;

      if (endsEl) {
        if (blockAmountStepper) {
          endsEl.textContent = "Set “Amount per buy” first";
          endsEl.classList.add("schedule-setlimit-inline__ends--error");
        } else {
          endsEl.classList.remove("schedule-setlimit-inline__ends--error");
          const { endsApprox } = setLimitStepper.getSummary();
          endsEl.textContent = `~ Ends ${endsApprox}`;
        }
      }
    };

    const refreshEndConditionSubtitles = () => {
      if (!scheduleSheetApi.hasSchedulePerBuyAmount?.()) {
        const sel = scheduleSheet.querySelector(
          "[data-schedule-end].is-selected",
        );
        if (sel?.getAttribute("data-schedule-end") === "enddate") {
          scheduleSheetApi.setEndConditionUI?.("continuous");
          scheduleSheetApi.planDetailRepeatsEndLimitText = "";
          scheduleSheet.classList.remove("schedule-sheet--end-limit-selected");
        }
      }
      const selected = scheduleSheet.querySelector(
        "[data-schedule-end].is-selected",
      );
      const end = selected?.getAttribute("data-schedule-end") || "continuous";
      const descEl = scheduleSheet.querySelector(
        "[data-schedule-endlimit-desc]",
      );
      scheduleSheet.classList.toggle(
        "schedule-sheet--end-limit-selected",
        end === "enddate",
      );
      if (end === "enddate" && setLimitStepper) {
        setLimitStepper.syncDom();
        const { count, endsApprox } = setLimitStepper.getSummary();
        const buyWord = count === 1 ? "buy" : "buys";
        const line = `${count} ${buyWord} ~ Ends ${endsApprox}`;
        scheduleSheetApi.planDetailRepeatsEndLimitText = line;
        if (descEl?.textContent.trim()) {
          descEl.textContent = line;
        }
        syncSummary();
      } else {
        scheduleSheetApi.planDetailRepeatsEndLimitText = "";
        if (descEl) descEl.textContent = "";
      }
      scheduleSheetApi.syncEndLimitRowAvailability?.();
    };

    scheduleSheetApi.refreshEndConditionSubtitles =
      refreshEndConditionSubtitles;

    scheduleSheetApi.applyScheduleSetLimitYearDefault = () => {
      setLimitStepper?.applyYearDefaultForActiveFreq();
    };

    const revealSheet = (el) => {
      sheetOpenWithInstantBackdrop(el);
    };

    const closeFollowupThenReopenSchedule = (el, elPanel, opts = {}) => {
      const suppressNestedScrim = getSuppressNestedScrimForScheduleChildClose();
      sheetCloseWithBackdropHandoff(
        el,
        elPanel,
        () => {
          reopen?.();
          if (opts.restoreDraft && setLimitStepper) {
            // Delay rollback until after close/reopen transition so values don't "jump"
            // while the follow-up sheet is still visible.
            setTimeout(() => {
              setLimitStepper.setCount(setLimitCommittedCount);
            }, 120);
          }
          requestAnimationFrame(() =>
            scheduleSheetApi.refreshEndConditionSubtitles?.(),
          );
        },
        { suppressNestedScrim },
      );
    };

    let setLimitCommittedCount = setLimitStepper?.getCount?.() ?? 12;

    const openSetLimitFollowup = () => {
      setLimitCommittedCount =
        setLimitStepper?.getCount?.() ?? setLimitCommittedCount;
      const perBuyOk = getPerBuyAmount() != null;
      const nextMode = perBuyOk ? setLimitFollowupPreferredMode : "amount";
      setModeUI(nextMode);
      setLimitStepper?.syncDom();
      syncSummary();
      const run = () => revealSheet(buysSheet);
      if (typeof handoff === "function") handoff(run);
      else run();
    };

    scheduleSheetApi.onEndOptionSelect = (end) => {
      if (end === "enddate") openSetLimitFollowup();
    };

    const wireClose = (root, closeAttr) => {
      root.querySelectorAll(`[${closeAttr}]`).forEach((btn) => {
        btn.addEventListener("click", () => {
          closeFollowupThenReopenSchedule(buysSheet, buysPanel, {
            restoreDraft: true,
          });
        });
      });
    };

    wireClose(buysSheet, "data-schedule-buys-sheet-close");
    buysSheet
      .querySelector("[data-schedule-buys-sheet-cancel]")
      ?.addEventListener("click", () =>
        closeFollowupThenReopenSchedule(buysSheet, buysPanel, {
          restoreDraft: true,
        }),
      );
    buysSheet
      .querySelector("[data-schedule-buys-sheet-confirm]")
      ?.addEventListener("click", () => {
        const descEl = scheduleSheet.querySelector(
          "[data-schedule-endlimit-desc]",
        );
        if (setLimitStepper && descEl) {
          setLimitStepper.syncDom();
          const { count, endsApprox } = setLimitStepper.getSummary();
          const buyWord = count === 1 ? "buy" : "buys";
          descEl.textContent = `${count} ${buyWord} ~ Ends ${endsApprox}`;
          setLimitCommittedCount = count;
        }
        if (getPerBuyAmount() != null) {
          setLimitFollowupPreferredMode =
            mode === "amount" ? "amount" : "periods";
        }
        closeFollowupThenReopenSchedule(buysSheet, buysPanel);
      });

    modeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-setlimit-mode") || "periods";
        setModeUI(v);
        if (getPerBuyAmount() != null) {
          setLimitFollowupPreferredMode = v === "amount" ? "amount" : "periods";
        }
        syncSummary();
      });
    });

    document
      .querySelector("[data-plan-detail-amount-input]")
      ?.addEventListener("input", () => {
        if (buysSheet.classList.contains("is-open")) syncSummary();
      });

    setModeUI("amount");
    scheduleSheetApi.refreshEndConditionSubtitles?.();
  };

  /** Schedule sheet: day picker only (monthly day / weekly weekday); daily timing is disabled placeholder. */
  const initScheduleTimePicker = () => {
    const timeSheet = document.querySelector("[data-schedule-time-sheet]");
    const scheduleSheet = document.querySelector("[data-schedule-sheet]");
    if (!timeSheet || !scheduleSheet) return;

    const panel = timeSheet.querySelector(".currency-sheet__panel");
    const titleEl = timeSheet.querySelector("[data-schedule-time-sheet-title]");
    const pickerRoot = timeSheet.querySelector("[data-schedule-time-picker]");
    const primaryCol = timeSheet.querySelector(
      '[data-schedule-time-col="primary"]',
    );
    const timeCol = timeSheet.querySelector('[data-schedule-time-col="time"]');
    const timingRow = scheduleSheet.querySelector(
      ".schedule-sheet__timing-row",
    );
    const timingValueEl = scheduleSheet.querySelector(
      "[data-schedule-timing-value]",
    );

    const flexDaysSheet = document.querySelector(
      "[data-schedule-flex-days-sheet]",
    );
    const flexDaysPanel = flexDaysSheet?.querySelector(
      ".currency-sheet__panel",
    );
    const flexDaysGrid = flexDaysSheet?.querySelector(
      "[data-schedule-flex-days-grid]",
    );
    const flexDaysSub = flexDaysSheet?.querySelector(
      "[data-schedule-flex-days-sub]",
    );
    const flexDaysSummary = flexDaysSheet?.querySelector(
      "[data-schedule-flex-days-summary]",
    );
    const flexDaysConfirmBtn = flexDaysSheet?.querySelector(
      "[data-schedule-flex-days-confirm]",
    );
    const tr = (s, params) => (window.I18N?.t ? window.I18N.t(s, params) : s);

    const ITEM_H = 44;
    const SPACER_H = 86;

    const timingTitles = {
      daily: "Every day at",
      weekly: "Every week on",
      monthly: "Every month on",
    };

    const WEEKDAYS = [
      { short: "Mon", label: "Monday" },
      { short: "Tue", label: "Tuesday" },
      { short: "Wed", label: "Wednesday" },
      { short: "Thu", label: "Thursday" },
      { short: "Fri", label: "Friday" },
      { short: "Sat", label: "Saturday" },
      { short: "Sun", label: "Sunday" },
    ];

    const isZhLocale = () => (window.I18N?.getLocale?.() || "en") === "zh";

    /** @param {number} n 1–31 */
    const ordinalSuffix = (n) => {
      const j = n % 10;
      const k = n % 100;
      if (k >= 11 && k <= 13) return `${n}th`;
      if (j === 1) return `${n}st`;
      if (j === 2) return `${n}nd`;
      if (j === 3) return `${n}rd`;
      return `${n}th`;
    };

    /** Locale-aware day label for picker UI (EN: 15th, ZH: 15日). */
    const formatDayLabel = (n) => (isZhLocale() ? `${n}日` : ordinalSuffix(n));

    // ───────────────────────────────────────────────────────────────────────────
    // Flexible: multi-day picker (nested sheet)

    let flexSelectedDays = [];
    const FLEX_MAX = 5;

    const parseFlexibleDaysFromTimingText = (text) => {
      const t = String(text || "").trim();
      if (!t || t === "Select days" || t === tr("Select days") || t === "- -")
        return [];
      const out = [];
      const re = /(\d{1,2})/g;
      let m;
      while ((m = re.exec(t))) {
        const d = Math.max(1, Math.min(28, parseInt(m[1], 10)));
        if (!out.includes(d)) out.push(d);
      }
      return out.sort((a, b) => a - b).slice(0, FLEX_MAX);
    };

    const ensureFlexDaysGrid = () => {
      if (!flexDaysGrid) return;
      if (flexDaysGrid.childElementCount > 0) return;
      const frag = document.createDocumentFragment();
      for (let d = 1; d <= 28; d += 1) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "schedule-flex-days__day";
        btn.textContent = String(d);
        btn.setAttribute("data-schedule-flex-day", String(d));
        btn.setAttribute("aria-pressed", "false");
        frag.appendChild(btn);
      }
      flexDaysGrid.appendChild(frag);
    };

    /** One day EN: "every month on the 15th"; ZH: "每月於15日". */
    const formatFlexDaysSummaryLine = (days) => {
      const labels = days.map((d) => formatDayLabel(d));
      if (labels.length === 0) return "- -";
      if (isZhLocale()) return `每月於${labels.join("、")}`;
      if (labels.length === 1) return `every month on the ${labels[0]}`;
      return `every ${labels.join(", ")}`;
    };

    const syncFlexDaysUI = () => {
      if (!flexDaysSheet) return;
      const count = flexSelectedDays.length;
      const maxed = count >= FLEX_MAX;

      if (flexDaysSub) {
        flexDaysSub.textContent = maxed ? "Maximum reached" : "Select up to 5";
        flexDaysSub.classList.toggle("schedule-flex-days__sub--max", maxed);
      }

      if (flexDaysSummary) {
        flexDaysSummary.textContent =
          formatFlexDaysSummaryLine(flexSelectedDays);
      }

      if (flexDaysConfirmBtn instanceof HTMLButtonElement) {
        flexDaysConfirmBtn.disabled = count === 0;
      }

      if (flexDaysGrid) {
        flexDaysGrid
          .querySelectorAll("[data-schedule-flex-day]")
          .forEach((el) => {
            const d = parseInt(el.getAttribute("data-schedule-flex-day"), 10);
            const isSel = flexSelectedDays.includes(d);
            el.classList.toggle("is-selected", isSel);
            el.setAttribute("aria-pressed", isSel ? "true" : "false");
            const dim = maxed && !isSel;
            el.classList.toggle("is-dimmed", dim);
          });
      }
    };

    const closeFlexDaysAndReopenSchedule = () => {
      const reopen = scheduleSheetApi.reopenFromChild;
      const suppressNestedScrim = getSuppressNestedScrimForScheduleChildClose();
      if (!flexDaysSheet || !flexDaysPanel) return;
      sheetCloseWithBackdropHandoff(
        flexDaysSheet,
        flexDaysPanel,
        () => reopen?.(),
        { suppressNestedScrim },
      );
    };

    const openFlexDaysSheet = () => {
      if (!flexDaysSheet || !flexDaysPanel) return;
      ensureFlexDaysGrid();
      flexSelectedDays = parseFlexibleDaysFromTimingText(
        timingValueEl?.textContent || "",
      );
      syncFlexDaysUI();

      const reveal = () => {
        sheetOpenWithInstantBackdrop(flexDaysSheet);
      };

      const handoff = scheduleSheetApi.closeAnimatedForChild;
      if (typeof handoff === "function") {
        handoff(() => reveal());
      } else {
        reveal();
      }
    };

    const parseMonthlyDayIndex = (text) => {
      const m = String(text || "").match(/(\d{1,2})/);
      if (!m) return 14;
      const d = Math.max(1, Math.min(28, parseInt(m[1], 10)));
      return d - 1;
    };

    const parseWeeklyDayIndex = (text) => {
      const beforeAt =
        String(text || "")
          .split(/\s+at\s+/i)[0]
          ?.trim()
          .toLowerCase() || "";
      const idx = WEEKDAYS.findIndex(
        (w) =>
          beforeAt.startsWith(w.short.toLowerCase()) ||
          beforeAt.startsWith(w.label.toLowerCase()),
      );
      return idx >= 0 ? idx : 0;
    };

    const buildColumnHtml = (labels, activeIndex) => {
      const opts = labels.map(
        (label, i) =>
          `<div class="schedule-time-sheet__option${i === activeIndex ? " is-active" : ""}" data-index="${i}">${label}</div>`,
      );
      return `<div class="schedule-time-sheet__spacer" style="height:${SPACER_H}px" aria-hidden="true"></div>${opts.join(
        "",
      )}<div class="schedule-time-sheet__spacer" style="height:${SPACER_H}px" aria-hidden="true"></div>`;
    };

    const scrollToIndex = (colEl, index, maxIndex) => {
      const i = Math.max(0, Math.min(maxIndex, Math.floor(index)));
      colEl.scrollTop = i * ITEM_H;
    };

    const scrollToIndexSmooth = (colEl, index, maxIndex) => {
      const i = Math.max(0, Math.min(maxIndex, Math.floor(index)));
      colEl.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
    };

    const updateColumnHighlight = (colEl, count) => {
      const idx = Math.max(
        0,
        Math.min(count - 1, Math.round(colEl.scrollTop / ITEM_H)),
      );
      colEl
        .querySelectorAll(".schedule-time-sheet__option")
        .forEach((opt, i) => {
          opt.classList.toggle("is-active", i === idx);
        });
    };

    let highlightAbort;

    const bindColumnScroll = (colEl, count) => {
      const onScroll = () => {
        updateColumnHighlight(colEl, count);
      };
      colEl.addEventListener("scroll", onScroll, {
        passive: true,
        signal: highlightAbort.signal,
      });
      onScroll();
    };

    /** Tap an option to snap the column to that index. */
    const bindColumnOptionClicks = (colEl, optionCount) => {
      const maxIdx = optionCount - 1;
      colEl.addEventListener(
        "click",
        (e) => {
          const opt = e.target.closest(".schedule-time-sheet__option");
          if (!opt || !colEl.contains(opt)) return;
          const idx = parseInt(opt.getAttribute("data-index"), 10);
          if (!Number.isFinite(idx)) return;
          scrollToIndexSmooth(colEl, idx, maxIdx);
        },
        { signal: highlightAbort.signal },
      );
    };

    const getActiveScheduleFreq = () => {
      const btn = scheduleSheet.querySelector("[data-schedule-freq].is-active");
      return (
        btn?.getAttribute("data-schedule-freq") || "monthly"
      ).toLowerCase();
    };

    const revealTimePicker = () => {
      highlightAbort?.abort();
      highlightAbort = new AbortController();

      const freq = getActiveScheduleFreq();
      if (titleEl)
        titleEl.textContent = tr(timingTitles[freq] || timingTitles.monthly);
      pickerRoot.classList.toggle(
        "schedule-time-picker--daily",
        freq === "daily",
      );

      const tv = (timingValueEl?.textContent || "").trim();

      if (freq === "daily") {
        return;
      } else if (freq === "weekly") {
        primaryCol.hidden = false;
        timeCol.hidden = true;
        timeCol.innerHTML = "";
        const dayLabels = WEEKDAYS.map((w) => w.label);
        const dayIdx = parseWeeklyDayIndex(tv);
        primaryCol.innerHTML = buildColumnHtml(dayLabels, dayIdx);
        scrollToIndex(primaryCol, dayIdx, 6);
        bindColumnScroll(primaryCol, 7);
        bindColumnOptionClicks(primaryCol, 7);
      } else {
        primaryCol.hidden = false;
        timeCol.hidden = true;
        timeCol.innerHTML = "";
        const dayLabels = Array.from({ length: 28 }, (_, i) =>
          formatDayLabel(i + 1),
        );
        const dayIdx = parseMonthlyDayIndex(tv);
        primaryCol.innerHTML = buildColumnHtml(dayLabels, dayIdx);
        scrollToIndex(primaryCol, dayIdx, 27);
        bindColumnScroll(primaryCol, 28);
        bindColumnOptionClicks(primaryCol, 28);
      }

      sheetOpenWithInstantBackdrop(timeSheet);
    };

    const openTimePicker = () => {
      const handoff = scheduleSheetApi.closeAnimatedForChild;
      if (typeof handoff === "function") {
        handoff(() => revealTimePicker());
      } else {
        revealTimePicker();
      }
    };

    /** Animate time sheet out, then slide schedule sheet back in. */
    const closeTimePickerAndReopenSchedule = () => {
      const reopen = scheduleSheetApi.reopenFromChild;
      const suppressNestedScrim = getSuppressNestedScrimForScheduleChildClose();
      sheetCloseWithBackdropHandoff(timeSheet, panel, () => reopen?.(), {
        suppressNestedScrim,
      });
    };

    const confirmTimePicker = () => {
      const freq = getActiveScheduleFreq();
      let next = "";
      if (freq === "daily") {
        next = "- -";
      } else if (freq === "weekly") {
        const pi = Math.max(
          0,
          Math.min(6, Math.round(primaryCol.scrollTop / ITEM_H)),
        );
        next = WEEKDAYS[pi].label;
      } else {
        const pi = Math.max(
          0,
          Math.min(27, Math.round(primaryCol.scrollTop / ITEM_H)),
        );
        next = formatDayLabel(pi + 1);
      }
      if (timingValueEl) timingValueEl.textContent = tr(next);
      scheduleSheetApi.refreshEndConditionSubtitles?.();
      closeTimePickerAndReopenSchedule();
    };

    timingRow?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const freq = getActiveScheduleFreq();
      if (freq === "flexible") openFlexDaysSheet();
      else openTimePicker();
    });

    timeSheet
      .querySelectorAll("[data-schedule-time-sheet-close]")
      .forEach((btn) => {
        btn.addEventListener("click", closeTimePickerAndReopenSchedule);
      });
    timeSheet
      .querySelector("[data-schedule-time-sheet-cancel]")
      ?.addEventListener("click", closeTimePickerAndReopenSchedule);
    timeSheet
      .querySelector("[data-schedule-time-sheet-confirm]")
      ?.addEventListener("click", confirmTimePicker);

    if (flexDaysSheet && flexDaysGrid) {
      const onFlexDayClick = (e) => {
        const btn = e.target.closest("[data-schedule-flex-day]");
        if (!btn || !flexDaysGrid.contains(btn)) return;
        const d = parseInt(btn.getAttribute("data-schedule-flex-day"), 10);
        if (!Number.isFinite(d)) return;
        const isSel = flexSelectedDays.includes(d);
        if (isSel) {
          flexSelectedDays = flexSelectedDays.filter((x) => x !== d);
        } else if (flexSelectedDays.length < FLEX_MAX) {
          flexSelectedDays = [...flexSelectedDays, d].sort((a, b) => a - b);
        }
        syncFlexDaysUI();
      };

      flexDaysGrid.addEventListener("click", onFlexDayClick);

      flexDaysSheet
        .querySelectorAll("[data-schedule-flex-days-sheet-close]")
        .forEach((btn) => {
          btn.addEventListener("click", closeFlexDaysAndReopenSchedule);
        });
      flexDaysSheet
        .querySelector("[data-schedule-flex-days-cancel]")
        ?.addEventListener("click", closeFlexDaysAndReopenSchedule);
      flexDaysSheet
        .querySelector("[data-schedule-flex-days-confirm]")
        ?.addEventListener("click", () => {
          if (timingValueEl) {
            timingValueEl.textContent = flexSelectedDays.length
              ? flexSelectedDays
                  .map((d) => formatDayLabel(d))
                  .join(isZhLocale() ? "、" : ", ")
              : tr("Select days");
          }
          scheduleSheetApi.refreshEndConditionSubtitles?.();
          closeFlexDaysAndReopenSchedule();
        });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────

  initStates();
  initAuthSignup();
  initBadgeControls();
  const tabNavApi = initTabs();
  const financeHeaderApi = initFinanceHeaderTabs();
  const tradeHeaderApi = initTradeHeaderTabs();
  const marketsPageApi = initMarketsPage();
  initMarketDetailPage();
  initTradeSpotSideToggle();
  initTradeSpotNotInPrototypeControls();
  initTradeCandlesButtons();
  initTradeMarginPage();
  initTradeMarginNotInPrototypeControls();
  initTradeGridPage();
  const goTradePage = (pageId) => {
    if (pageId === "convert") ensureConvertModulesInited();
    tabNavApi.setActiveTab("trade");
    tradeHeaderApi.setTradePage(pageId);
    const content = document.querySelector("[data-content]");
    if (content) content.scrollTop = 0;
  };

  document.addEventListener("trade-qm-select", (e) => {
    const action = String(e?.detail?.action || "").toLowerCase();
    if (
      action !== "spot" &&
      action !== "margin" &&
      action !== "grid" &&
      action !== "convert"
    )
      return;
    goTradePage(action);
  });

  document.querySelectorAll("[data-open-trade-page]").forEach((el) => {
    const open = () => {
      const pageId = String(el.getAttribute("data-open-trade-page") || "").toLowerCase();
      if (!pageId) return;
      goTradePage(pageId);
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
  const goFinanceAutoInvest = () => {
    tabNavApi.setActiveTab("finance");
    financeHeaderApi.setFinancePage("auto");
    const content = document.querySelector("[data-content]");
    if (content) content.scrollTop = 0;
  };

  /** Set in initPlanDetailPanel — instant teardown of plan detail + overlays when backing out of My plans (post-success). */
  let dismissPlanDetailStackInstant = () => {};

  const initMyPlansPanel = (opts = {}) => {
    const goFinance =
      typeof opts.goFinanceAutoInvest === "function"
        ? opts.goFinanceAutoInvest
        : () => {};
    const getDismissPlanDetail =
      typeof opts.getDismissPlanDetailStackInstant === "function"
        ? opts.getDismissPlanDetailStackInstant
        : () => () => {};
    const panel = document.querySelector("[data-my-plans-panel]");
    const detailPanel = document.querySelector("[data-my-plans-detail-panel]");
    const activityListPanel = document.querySelector(
      "[data-my-plans-activity-list-panel]",
    );
    const activityListContentEl = activityListPanel?.querySelector(
      "[data-my-plans-activity-list-content]",
    );
    const activityDetailPanel = document.querySelector(
      "[data-my-plans-activity-detail-panel]",
    );
    const manageSheet = document.querySelector("[data-my-plans-manage-sheet]");
    const detailHeader = detailPanel?.querySelector(
      ".my-plans-detail-panel__header",
    );
    const detailScroller = detailPanel?.querySelector(
      ".my-plans-detail-panel__scroller",
    );
    const container = document.querySelector(".phone-container");
    if (!panel) {
      return { open: () => {}, close: () => {} };
    }

    const titleEl = panel.querySelector("[data-my-plans-title]");
    let activePlanDetailRecord = null;

    const tabs = panel.querySelectorAll("[data-my-plans-filter]");
    const views = panel.querySelectorAll("[data-my-plans-view]");
    let activeFilter = "active";

    const buildEqualMixFromTickers = (tickers) => {
      const arr = Array.isArray(tickers)
        ? tickers.map((t) => String(t || "").trim()).filter(Boolean)
        : [];
      if (arr.length < 2) return [];
      const base = Math.floor(100 / arr.length);
      let rem = 100 - base * arr.length;
      return arr.map((ticker) => {
        const pct = base + (rem > 0 ? 1 : 0);
        if (rem > 0) rem -= 1;
        return { ticker, pct };
      });
    };

    const extractMyPlansAssetMixFromDetail = () => {
      const detailRoot = document.querySelector("[data-plan-detail-panel]");
      if (!detailRoot) return [];

      const multiRoot =
        detailRoot.querySelector(
          "[data-plan-detail-allocation-auto-section]:not([hidden]) .alloc-multi",
        ) ||
        detailRoot.querySelector(
          ".plan-detail-panel__allocation-section:not(.plan-detail-panel__allocation-section--auto):not([hidden]) .alloc-multi",
        ) ||
        detailRoot.querySelector(
          ".plan-detail-panel__allocation-section .alloc-multi",
        );
      if (multiRoot) {
        const mix = Array.from(multiRoot.querySelectorAll(".alloc-multi__item"))
          .map((row) => {
            const ticker = String(
              row.querySelector(".alloc-multi__ticker")?.textContent || "",
            )
              .trim()
              .toUpperCase();
            const raw = String(
              row.querySelector("[data-alloc-pct-input]")?.value || "",
            ).replace(/[^0-9]/g, "");
            const pct = raw ? parseInt(raw, 10) : 0;
            return { ticker, pct };
          })
          .filter((x) => x.ticker);
        if (mix.length > 1) {
          const hasAnyPct = mix.some(
            (x) => Number.isFinite(x.pct) && x.pct > 0,
          );
          return hasAnyPct
            ? mix
            : buildEqualMixFromTickers(mix.map((x) => x.ticker));
        }
      }

      const singleItems = Array.from(
        detailRoot.querySelectorAll(
          ".plan-detail-panel__allocation-section:not(.plan-detail-panel__allocation-section--auto):not([hidden]) .plan-detail-panel__alloc-item",
        ),
      );
      if (singleItems.length > 1) {
        const tickers = singleItems
          .map((row) =>
            String(
              row.querySelector(".plan-detail-panel__alloc-ticker")
                ?.textContent || "",
            )
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean);
        return buildEqualMixFromTickers(tickers);
      }
      return [];
    };

    /** Curated / empty-state hero art — not valid as a per-asset allocation chip icon. */
    const COMPOSITE_HERO_ICONS_FOR_ALLOC = new Set([
      "assets/icon_bigthree.svg",
      "assets/icon_digitalgold.svg",
      "assets/icon_aiessentials.svg",
      "assets/icon_noallocation.svg",
    ]);
    let suppressFocusShow = false;

    const resolveMyPlansAllocTickerIcon = (ticker) => {
      const t = String(ticker || "")
        .trim()
        .toUpperCase();
      if (!t) return "";
      if (t === "BTC") return "assets/icon_currency_btc.svg";
      if (t === "ETH") return "assets/icon_currency_eth.svg";
      if (t === "SOL" || t === "SOLANA") return "assets/icon_solana.svg";
      if (t === "USDT") return "assets/icon_currency_usdt.svg";
      if (t === "XAUT") return "assets/icon_currency_xaut.svg";
      if (t === "RENDER") return "assets/icon_currency_render.svg";
      if (t === "NEAR") return "assets/icon_currency_near.svg";
      if (t === "LINK") return "assets/icon_currency_link.svg";
      if (t === "XRP") return "assets/icon_currency_xrp.svg";
      return "";
    };

    /** Static prototype average prices (authored in TWD), converted for display currency when needed. */
    const getPrototypeAveragePrice = (ticker, cur) => {
      const t = String(ticker || "")
        .trim()
        .toUpperCase();
      const c = normalizeFxCurrency(cur || currencyState.plan || "TWD");
      const avgByTickerTwd = {
        BTC: 2831426,
        ETH: 127438,
        SOL: 4873,
        XAUT: 103782,
        RENDER: 217,
        NEAR: 163,
        LINK: 547,
        XRP: 71.28,
        USDT: 32.18,
        TWD: 1,
      };
      const twdValue = Number.isFinite(avgByTickerTwd[t])
        ? avgByTickerTwd[t]
        : 100;
      return convertFx(twdValue, "TWD", c);
    };

    /** My plans UI should preserve entered display code (e.g. keep USDT, not USD). */
    const toDisplayCurrencyCode = (cur, fallback = "TWD") => {
      const c = String(cur || "")
        .trim()
        .toUpperCase();
      return (
        c ||
        String(fallback || "TWD")
          .trim()
          .toUpperCase()
      );
    };

    const formatMoneyDisplayCurrency = (amount, cur) => {
      const n = Number.isFinite(amount) ? amount : 0;
      const c = toDisplayCurrencyCode(cur, "USD");
      return `${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c}`;
    };

    const getPlanRecordDisplayCurrency = (planRecord) => {
      const totalRaw = String(planRecord?.totalInvested || "").trim();
      const totalCurMatch = totalRaw.match(/([A-Za-z]{3,5})\s*$/);
      const investRaw = String(planRecord?.investLine || "").trim();
      const investCurMatch = investRaw.match(
        /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
      );
      return toDisplayCurrencyCode(
        investCurMatch?.[2] ||
          totalCurMatch?.[1] ||
          currencyState.plan ||
          currencyState.summary ||
          "TWD",
        "TWD",
      );
    };

    const buildFallbackPlanSnapshot = () => {
      if ((states.flow ?? 1) < 2) return null;
      const name =
        document
          .querySelector("[data-plan-detail-name]")
          ?.textContent?.trim() || "My plan";
      const panelEl = document.querySelector("[data-plan-detail-panel]");
      const tickerLineRaw =
        String(panelEl?.dataset?.planDetailAssetTickerLine || "").trim() ||
        document
          .querySelector("[data-plan-detail-ticker]")
          ?.textContent?.trim() ||
        "";
      const tickers = tickerLineRaw
        ? tickerLineRaw
            .split(/[·,]/g)
            .map((t) => t.trim())
            .filter(Boolean)
            .join(" · ")
        : "";
      const assetMix = extractMyPlansAssetMixFromDetail();
      const detailSingleIconSrc =
        document
          .querySelector("[data-plan-detail-icon-wrap] img")
          ?.getAttribute("src") || "assets/icon_currency_btc.svg";
      const tickerKeysForAllocIcons = tickerLineRaw
        ? tickerLineRaw
            .split(/[·,]/g)
            .map((x) => x.trim().toUpperCase())
            .filter(Boolean)
        : [];
      const assetIconsFromTickerLine = tickerKeysForAllocIcons
        .map((ticker) => ({
          ticker,
          icon: resolveMyPlansAllocTickerIcon(ticker),
        }))
        .filter((a) => a.icon);
      const amountRaw =
        parseInt(
          String(
            document.querySelector("[data-plan-detail-amount-input]")?.value ||
              "",
          ).replace(/[^0-9]/g, ""),
          10,
        ) || 0;
      const sliderAmt =
        parseInt(
          String(
            document
              .querySelector("[data-plan-slider]")
              ?.getAttribute("aria-valuenow") || "",
          ).trim(),
          10,
        ) || 0;
      const cur = String(
        document.querySelector("[data-plan-detail-currency]")?.textContent ||
          currencyState.plan ||
          "TWD",
      ).trim();
      const freqKey = (
        document
          .querySelector("[data-plan-freq-item].is-active")
          ?.getAttribute("data-plan-freq-item") || "monthly"
      ).toLowerCase();
      const cadence =
        freqKey === "daily" ? "day" : freqKey === "weekly" ? "week" : "month";
      const effAmount =
        amountRaw > 0 ? amountRaw : sliderAmt > 0 ? sliderAmt : 5000;
      const investLine = `${effAmount.toLocaleString("en-US")} ${cur} each ${cadence}`;
      const repeats =
        document
          .querySelector("[data-plan-overview-repeats]")
          ?.textContent?.trim() ||
        getPlanDetailScheduleFullText() ||
        "—";
      const schedLine = getPlanDetailScheduleFullText() || "";
      const nextCompact = formatFinanceNextBuyCompact(schedLine);
      const overviewFirstBuy =
        document
          .querySelector("[data-plan-overview-first-buy]")
          ?.textContent?.trim() || "";
      const financeNextBuy =
        document
          .querySelector("[data-finance-summary-next-buy]")
          ?.textContent?.trim() || "";
      const confirmedNb = String(financeSummaryConfirmedNextBuy || "").trim();
      const nextBuyRaw =
        overviewFirstBuy && overviewFirstBuy !== "—"
          ? overviewFirstBuy
          : confirmedNb && confirmedNb !== "—"
            ? confirmedNb
            : financeNextBuy ||
              FINANCE_SUMMARY_NEXT_BUY_FALLBACK ||
              nextCompact;
      const nextBuyDisplay = shortenWeekdayLabel(nextBuyRaw);
      const fundingMethod =
        document
          .querySelector("[data-plan-overview-payment-method]")
          ?.textContent?.trim() || "Pay as you go";
      const isReserved = /\bset aside funds\b/i.test(fundingMethod);
      const reservedFunds =
        document
          .querySelector("[data-plan-overview-prefund-amount]")
          ?.textContent?.trim() || "—";
      const runoutPolicy =
        document
          .querySelector("[data-plan-overview-runout-value]")
          ?.textContent?.trim() || "—";
      return {
        id: "plan-active-1",
        status: "active",
        name,
        kicker: name,
        tickers: tickers || "BTC",
        assetMix,
        iconSrc: detailSingleIconSrc,
        assetIcons: assetIconsFromTickerLine,
        investLine,
        repeats,
        firstBuy: nextBuyDisplay,
        nextBuy: nextBuyDisplay,
        completedBuys: 0,
        totalInvested: formatMoneyDisplayCurrency(0, cur),
        fundingMethod,
        isReserved,
        reservedFunds,
        runoutPolicy,
      };
    };

    const getMyPlansRecords = () => {
      if ((states.flow ?? 1) < 2) {
        myPlansPrefillPlan = null;
        return [];
      }
      const applyFlowStatusOverride = (records) => {
        const flowState = states.flow ?? 1;
        if (flowState !== 4 && flowState !== 5) return records;
        return records.map((rec) => {
          const statusKey =
            flowState === 5
              ? "ended"
              : rec?.status === "ended"
                ? "ended"
                : "paused";
          return { ...rec, status: statusKey };
        });
      };
      if (myPlansSubmittedPlan)
        return applyFlowStatusOverride([myPlansSubmittedPlan]);
      if (!myPlansPrefillPlan) {
        myPlansPrefillPlan = buildFallbackPlanSnapshot();
      }
      return myPlansPrefillPlan
        ? applyFlowStatusOverride([myPlansPrefillPlan])
        : [];
    };

    const parsePerBuyFromInvestLine = (investLine) => {
      const m = String(investLine || "").match(
        /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})\s+each\b/i,
      );
      if (!m) return null;
      const amount = parseFloat(String(m[1] || "").replace(/,/g, ""));
      if (!Number.isFinite(amount) || amount <= 0) return null;
      return { amount, currency: normalizeFxCurrency(m[2]) };
    };

    const computeCoversBuysText = (planRecord) => {
      if (String(planRecord?.coversBuys || "").trim())
        return String(planRecord.coversBuys).trim();
      if (!planRecord?.isReserved) return "";
      const reserved = parseMoneyWithCurrency(planRecord.reservedFunds || "");
      const perBuy = parsePerBuyFromInvestLine(planRecord.investLine || "");
      if (!reserved || !perBuy) return "";
      const reservedInPerBuyCur = convertFx(
        reserved.amount,
        reserved.currency,
        perBuy.currency,
      );
      const buys = Math.max(0, Math.floor(reservedInPerBuyCur / perBuy.amount));
      return `Covers ${buys} more ${buys === 1 ? "buy" : "buys"}`;
    };

    const escIconAttr = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");

    /**
     * Reuse Plan detail's icon stack DOM/CSS (2-coin + placeholder, or 3-coin).
     * Supports single-asset mode (one circular 32px icon).
     * @param {HTMLElement | null} wrap
     * @param {string} tickersText e.g. "BTC · ETH · SOL" or "BTC"
     * @param {string} fallbackIconSrc
     * @param {Array<{ticker?:string,icon?:string}>} [explicitAssets]
     * @param {'header'|'product'} [variant]
     */
    const renderMyPlansHeaderIcons = (
      wrap,
      tickersText,
      fallbackIconSrc,
      explicitAssets = [],
      variant = "header",
    ) => {
      if (!wrap) return;

      const toIcon = (ticker) => {
        const t = String(ticker || "")
          .trim()
          .toUpperCase();
        if (!t) return null;
        if (t === "BTC") return "assets/icon_currency_btc.svg";
        if (t === "ETH") return "assets/icon_currency_eth.svg";
        if (t === "SOL" || t === "SOLANA") return "assets/icon_solana.svg";
        if (t === "USDT") return "assets/icon_currency_usdt.svg";
        if (t === "TWD") return "assets/icon_currency_TWD.svg";
        if (t === "XAUT") return "assets/icon_currency_xaut.svg";
        if (t === "RENDER") return "assets/icon_currency_render.svg";
        if (t === "NEAR") return "assets/icon_currency_near.svg";
        if (t === "LINK") return "assets/icon_currency_link.svg";
        if (t === "XRP") return "assets/icon_currency_xrp.svg";
        return null;
      };

      const explicit = Array.isArray(explicitAssets)
        ? explicitAssets
            .map((a) => ({
              ticker: String(a?.ticker || "").trim(),
              icon: String(a?.icon || "").trim(),
            }))
            .filter((a) => a.icon)
            .slice(0, 3)
        : [];
      const tickers = String(tickersText || "")
        .split(/[·,]/g)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 3);
      const inferred = tickers
        .map((t) => ({ ticker: t, icon: toIcon(t) }))
        .filter((x) => x.icon);
      const items = explicit.length ? explicit : inferred;

      const buildStackMarkup = () => {
        const icons = items.slice(0, 3);
        if (icons.length < 2) return null;
        const twoOnly = icons.length === 2;
        const mod = twoOnly ? " plan-detail-panel__icon-stack--two" : "";
        const baseClass = `plan-detail-panel__icon-stack${mod}`;
        const [a, b, c] = [icons[0], icons[1], icons[2]];
        const br = c?.icon
          ? `<img src="${escIconAttr(c.icon)}" alt="" />`
          : '<span class="plan-detail-panel__icon-stack-placeholder" aria-hidden="true"></span>';
        const stack = `<div class="${baseClass}" aria-hidden="true"><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--top"><img src="${escIconAttr(a.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--bl"><img src="${escIconAttr(b.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--br">${br}</div></div>`;
        if (variant === "product") {
          return `<div class="plan-detail-panel__product-icon-wrap" aria-hidden="true">${stack}</div>`;
        }
        return stack;
      };

      const stack = buildStackMarkup();
      if (stack) {
        wrap.innerHTML = stack;
        return;
      }

      const singleSrc =
        items.length === 1 && items[0]?.icon ? items[0].icon : fallbackIconSrc;
      if (variant === "product") {
        wrap.innerHTML = `<div class="plan-detail-panel__product-icon-wrap" aria-hidden="true"><img class="plan-detail-panel__product-icon" src="${escIconAttr(singleSrc)}" alt="" /></div>`;
      } else {
        wrap.innerHTML = `<img class="plan-detail-panel__header-icon" src="${escIconAttr(singleSrc)}" alt="" />`;
      }
    };

    const renderMyPlansTickers = (target, planRecord) => {
      if (!target) return;
      target.innerHTML = "";
      const mixRaw = Array.isArray(planRecord?.assetMix)
        ? planRecord.assetMix
        : [];
      let mix = mixRaw
        .map((x) => ({
          ticker: String(x?.ticker || "")
            .trim()
            .toUpperCase(),
          pct: Number.isFinite(Number(x?.pct))
            ? Math.max(0, Math.round(Number(x.pct)))
            : NaN,
        }))
        .filter((x) => x.ticker);

      const tickerList = String(planRecord?.tickers || "")
        .split(/[·,]/g)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      if (!mix.length && tickerList.length) {
        if (tickerList.length === 1) {
          mix = [{ ticker: tickerList[0], pct: 100 }];
        } else {
          const base = Math.floor(100 / tickerList.length);
          let rem = 100 - base * tickerList.length;
          mix = tickerList.map((ticker) => {
            const pct = base + (rem > 0 ? 1 : 0);
            if (rem > 0) rem -= 1;
            return { ticker, pct };
          });
        }
      }

      const fallbackPlanIcon = (() => {
        const src = String(planRecord?.iconSrc || "").trim();
        return src && !COMPOSITE_HERO_ICONS_FOR_ALLOC.has(src) ? src : "";
      })();
      const resolveTickerIcon = (ticker) => {
        const t = String(ticker || "")
          .trim()
          .toUpperCase();
        const explicit = Array.isArray(planRecord?.assetIcons)
          ? planRecord.assetIcons.find(
              (a) =>
                String(a?.ticker || "")
                  .trim()
                  .toUpperCase() === t &&
                String(a?.icon || "").trim() &&
                !COMPOSITE_HERO_ICONS_FOR_ALLOC.has(
                  String(a?.icon || "").trim(),
                ),
            )
          : null;
        return (
          String(explicit?.icon || "").trim() ||
          resolveMyPlansAllocTickerIcon(t) ||
          fallbackPlanIcon ||
          "assets/icon_currency_btc.svg"
        );
      };

      mix.forEach((x) => {
        const seg = document.createElement("span");
        seg.className = "my-plans-position-card__ticker-seg";

        const icon = document.createElement("img");
        icon.className = "my-plans-position-card__ticker-icon";
        icon.src = resolveTickerIcon(x.ticker);
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");
        seg.appendChild(icon);

        const meta = document.createElement("span");
        meta.className = "my-plans-position-card__ticker-meta";
        const tk = document.createElement("span");
        tk.className = "my-plans-position-card__ticker-symbol";
        tk.textContent = x.ticker;
        meta.appendChild(tk);
        const pct = document.createElement("span");
        pct.className = "my-plans-position-card__ticker-pct";
        pct.textContent = Number.isFinite(x.pct) ? `${x.pct}%` : "";
        if (pct.textContent) meta.appendChild(pct);
        seg.appendChild(meta);
        target.appendChild(seg);
      });
    };

    const syncMyPlansLabels = () => {
      const records = getMyPlansRecords();
      const counts = records.reduce(
        (acc, item) => {
          const k =
            item.status === "paused"
              ? "paused"
              : item.status === "ended"
                ? "ended"
                : "active";
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        },
        { active: 0, paused: 0, ended: 0 },
      );

      // Title stays "My plans" per Figma; only tabs show counts.
      if (titleEl) titleEl.textContent = "My plans";

      tabs.forEach((tab) => {
        const k = (
          tab.getAttribute("data-my-plans-filter") || "active"
        ).toLowerCase();
        const base =
          k === "paused" ? "Paused" : k === "ended" ? "Ended" : "Active";
        const n = counts[k] || 0;
        tab.textContent = k === "ended" ? "Ended" : `${base} (${n})`;
      });
    };

    const appendPlanCard = (target, planRecord) => {
      const el = (tag, className, text) => {
        const n = document.createElement(tag);
        if (className) n.className = className;
        if (typeof text === "string") n.textContent = text;
        return n;
      };

      const statusKey =
        planRecord.status === "paused"
          ? "paused"
          : planRecord.status === "ended"
            ? "ended"
            : "active";
      const statusLabel =
        statusKey === "paused"
          ? "Paused"
          : statusKey === "ended"
            ? "Ended"
            : "Active";

      const card = el(
        "article",
        `my-plans-position-card my-plans-position-card--${statusKey}`,
      );
      card.setAttribute("data-plan-status", statusKey);
      card.setAttribute("data-plan-card-open-detail", "");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute(
        "aria-label",
        `Open ${statusLabel.toLowerCase()} plan details`,
      );
      if (planRecord.id)
        card.setAttribute("data-my-plans-plan-id", String(planRecord.id));

      // Header: product row
      const head = el("div", "my-plans-position-card__head");
      const headRow = el("div", "my-plans-position-card__head-row");
      const left = el("div", "my-plans-position-card__head-left");

      const titleWrap = el("div", "my-plans-position-card__title-wrap");
      titleWrap.appendChild(
        el(
          "div",
          "my-plans-position-card__kicker",
          planRecord.kicker || "Big Three",
        ),
      );
      left.appendChild(titleWrap);

      headRow.appendChild(left);

      const tag = el("div", "my-plans-position-card__tag");
      const dot = el("span", "my-plans-position-card__tag-dot");
      tag.appendChild(dot);
      tag.appendChild(
        el("span", "my-plans-position-card__tag-text", statusLabel),
      );
      headRow.appendChild(tag);
      head.appendChild(headRow);
      card.appendChild(head);

      // Body
      const body = el("div", "my-plans-position-card__body");

      const investLine = String(planRecord.investLine || "").trim();
      const money = investLine.match(
        /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
      );
      const moneyPart = money
        ? `${money[1]} ${String(money[2] || "").toUpperCase()}`
        : "";
      const schedulePart = formatScheduleNaturalLine(planRecord.repeats || "");

      const hero = el("div", "my-plans-position-card__hero");
      const heroRow = el("div", "my-plans-position-card__hero-row");
      const heroValue = el("div", "my-plans-position-card__hero-value");
      if (moneyPart) {
        heroValue.textContent = "";
        const amountLine = el(
          "div",
          "my-plans-position-card__invest-summary-line my-plans-position-card__invest-summary-line--amount",
        );
        amountLine.textContent = `Invest ${moneyPart}`;
        const scheduleLineEl = el(
          "div",
          "my-plans-position-card__invest-summary-line my-plans-position-card__invest-summary-line--schedule",
        );
        scheduleLineEl.textContent = schedulePart || "—";
        heroValue.appendChild(amountLine);
        heroValue.appendChild(scheduleLineEl);
      } else {
        heroValue.textContent = investLine || "—";
      }
      heroRow.appendChild(heroValue);
      const heroIcons = el("div", "my-plans-position-card__hero-icons");
      renderMyPlansHeaderIcons(
        heroIcons,
        planRecord.tickers || "BTC · ETH · SOL",
        planRecord.iconSrc || "assets/icon_currency_btc.svg",
        planRecord.assetIcons || [],
      );
      heroRow.appendChild(heroIcons);
      hero.appendChild(heroRow);
      const tickersLine = el("div", "my-plans-position-card__tickers");
      renderMyPlansTickers(tickersLine, planRecord);
      hero.appendChild(tickersLine);
      body.appendChild(hero);

      const list = el("div", "my-plans-position-card__list");
      const row = (label, value, opts = {}) => {
        const r = el(
          "div",
          `my-plans-position-card__row${opts.tight ? " my-plans-position-card__row--tight" : ""}`,
        );
        r.appendChild(el("div", "my-plans-position-card__row-label", label));
        r.appendChild(el("div", "my-plans-position-card__row-value", value));
        return r;
      };

      // Total invested (prototype: derive from invest amount * completed buys when possible)
      const parsed = String(planRecord.investLine || "").match(
        /(\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/,
      );
      const per = parsed ? parseFloat(parsed[1].replace(/,/g, "")) : NaN;
      const parsedTotalInvested = parseMoneyWithCurrency(
        planRecord.totalInvested || "",
      );
      const cur = getPlanRecordDisplayCurrency(planRecord);
      const flowState = states.flow ?? 1;
      const recCompletedBuys = Number.isFinite(planRecord.completedBuys)
        ? Math.max(0, Math.floor(planRecord.completedBuys))
        : 0;
      const completedCount = flowState >= 3 ? Math.max(5, recCompletedBuys) : 0;
      let totalInvAmount = 0;
      if (flowState >= 3) {
        if (parsedTotalInvested && parsedTotalInvested.amount > 0)
          totalInvAmount = parsedTotalInvested.amount;
        else if (Number.isFinite(per) && per > 0)
          totalInvAmount = per * completedCount;
      }
      const totalInv = formatMoneyDisplayCurrency(totalInvAmount, cur);
      if (flowState !== 5) {
        const nextBuyValue =
          flowState === 4
            ? "- -"
            : shortenWeekdayLabel(
                planRecord.nextBuy ||
                  planRecord.firstBuy ||
                  FINANCE_SUMMARY_NEXT_BUY_FALLBACK,
              );
        if (getPrototypeShowFailedBuy()) {
          const nextRow = el(
            "div",
            "my-plans-position-card__row my-plans-position-card__row--next-buy-stack",
          );
          nextRow.appendChild(
            el("div", "my-plans-position-card__row-label", "Next buy"),
          );
          const stack = el("div", "my-plans-position-card__row-right-stack");
          stack.appendChild(
            el("div", "my-plans-position-card__row-value", nextBuyValue),
          );
          const failRow = el("div", "my-plans-position-card__next-buy-failed");
          failRow.appendChild(document.createTextNode("Last buy failed"));
          const failChev = document.createElement("img");
          failChev.src = "assets/icon_chevron_right_red.svg";
          failChev.alt = "";
          failChev.className =
            "my-plans-position-card__next-buy-failed-chevron";
          failChev.setAttribute("aria-hidden", "true");
          failRow.appendChild(failChev);
          stack.appendChild(failRow);
          nextRow.appendChild(stack);
          list.appendChild(nextRow);
        } else {
          list.appendChild(row("Next buy", nextBuyValue));
        }
      }
      list.appendChild(
        row(
          "Total invested",
          `${totalInv} \u00b7 ${completedCount} ${completedCount === 1 ? "buy" : "buys"}`,
        ),
      );

      if (flowState !== 5) {
        const fundingState = states.funding ?? 1;
        const isFundingInsufficient =
          fundingState === 2 && !planRecord.isReserved;
        const isFundingPrefundLeft = fundingState === 3;
        const isFundingPrefundLow = fundingState === 4;
        const isFundingPrefundEmpty = fundingState === 5;
        const fundRow = el(
          "div",
          "my-plans-position-card__row my-plans-position-card__row--split",
        );
        fundRow.appendChild(
          el("div", "my-plans-position-card__row-label", "Funding"),
        );
        const fundValue = el(
          "div",
          `my-plans-position-card__row-value my-plans-position-card__row-value--with-check ${
            isFundingInsufficient
              ? "my-plans-position-card__row-value--negative my-plans-position-card__row-value--with-chevron"
              : isFundingPrefundEmpty
                ? "my-plans-position-card__row-value--negative my-plans-position-card__row-value--with-chevron"
                : isFundingPrefundLow
                  ? "my-plans-position-card__row-value--warning my-plans-position-card__row-value--with-chevron"
                  : "my-plans-position-card__row-value--positive"
          }`,
        );
        if (isFundingInsufficient) {
          fundValue.appendChild(
            document.createTextNode(`Insufficient ${cur} balance`),
          );
          const chevron = document.createElement("img");
          chevron.src = "assets/icon_chevron_right_red.svg";
          chevron.alt = "";
          chevron.className = "my-plans-position-card__row-chevron";
          chevron.setAttribute("aria-hidden", "true");
          fundValue.appendChild(chevron);
        } else if (isFundingPrefundEmpty) {
          fundValue.appendChild(
            document.createTextNode(`Pre-funded: 0.00 ${cur} left`),
          );
          const chevron = document.createElement("img");
          chevron.src = "assets/icon_chevron_right_red.svg";
          chevron.alt = "";
          chevron.className = "my-plans-position-card__row-chevron";
          chevron.setAttribute("aria-hidden", "true");
          fundValue.appendChild(chevron);
        } else if (isFundingPrefundLow) {
          const oneBuyAmount = Number.isFinite(per) && per > 0 ? per : 0;
          const oneBuyAmountText = oneBuyAmount.toLocaleString("en-US", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          });
          fundValue.appendChild(
            document.createTextNode(
              `Pre-funded: ${oneBuyAmountText} ${cur} left`,
            ),
          );
          const chevron = document.createElement("img");
          chevron.src = "assets/icon_chevron_right_orange.svg";
          chevron.alt = "";
          chevron.className = "my-plans-position-card__row-chevron";
          chevron.setAttribute("aria-hidden", "true");
          fundValue.appendChild(chevron);
        } else {
          const check = document.createElement("img");
          check.src = "assets/icon_check_green_s.svg";
          check.alt = "";
          check.className = "my-plans-position-card__row-check";
          check.setAttribute("aria-hidden", "true");
          fundValue.appendChild(check);
          if (isFundingPrefundLeft) {
            const parsedReserved = parseMoneyWithCurrency(
              planRecord.reservedFunds || "",
            );
            const fallbackPrefundAmount =
              Number.isFinite(per) && per > 0 ? per * 4 : 0;
            const prefundAmountText =
              parsedReserved && parsedReserved.amount > 0
                ? String(planRecord.reservedFunds || "").trim()
                : `${fallbackPrefundAmount.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })} ${cur}`;
            fundValue.appendChild(
              document.createTextNode(`Pre-funded: ${prefundAmountText} left`),
            );
          } else {
            fundValue.appendChild(
              document.createTextNode(
                planRecord.isReserved ? "Pre-fund" : `${cur} balance`,
              ),
            );
          }
        }
        fundRow.appendChild(fundValue);
        list.appendChild(fundRow);
      }

      body.appendChild(list);
      card.appendChild(body);

      // Actions
      const actions = el("div", "my-plans-position-card__actions");
      const leftActions = el("div", "my-plans-position-card__actions-left");
      const btn = (label, kind, dataAttr) => {
        const b = el(
          "button",
          `my-plans-position-card__btn my-plans-position-card__btn--${kind}`,
          label,
        );
        b.type = "button";
        if (dataAttr) b.setAttribute(dataAttr, "");
        return b;
      };
      const secondaryLabel =
        statusKey === "ended" ? "Duplicate plan" : "Manage plan";
      leftActions.appendChild(
        btn(
          secondaryLabel,
          "secondary",
          statusKey === "ended"
            ? "data-plan-card-recreate"
            : "data-plan-card-manage",
        ),
      );
      actions.appendChild(leftActions);
      actions.appendChild(
        btn("View detail", "primary", "data-plan-card-view-detail"),
      );
      card.appendChild(actions);

      target.appendChild(card);
    };

    const renderMyPlansViews = () => {
      const records = getMyPlansRecords();
      panel.classList.toggle(
        "my-plans-panel--hide-cards",
        records.length === 0,
      );
      views.forEach((view) => {
        const viewId = view.getAttribute("data-my-plans-view") || "active";
        const list = view.querySelector("[data-my-plans-list]");
        const empty = view.querySelector("[data-my-plans-empty]");
        if (!list) return;
        list.innerHTML = "";
        const filtered = records.filter((item) => item.status === viewId);
        filtered.forEach((item) => appendPlanCard(list, item));
        if (empty) empty.hidden = filtered.length > 0;
      });
      syncMyPlansLabels();
    };

    const setFilter = (id) => {
      activeFilter = id || "active";
      tabs.forEach((tab) => {
        const on = tab.getAttribute("data-my-plans-filter") === activeFilter;
        tab.classList.toggle("is-active", on);
        tab.setAttribute("aria-selected", on ? "true" : "false");
      });
      views.forEach((view) => {
        view.hidden = view.getAttribute("data-my-plans-view") !== activeFilter;
      });
    };

    tabs.forEach((tab) => {
      tab.addEventListener("click", () =>
        setFilter(tab.getAttribute("data-my-plans-filter")),
      );
    });

    /** Set after `syncManageSheetUi` — reapplies prefund row when prototype funding changes while sheet is open. */
    let refreshManageSheetIfOpen = () => {};

    const syncMyPlansFromFlow = () => {
      renderMyPlansViews();
      if (detailPanel?.classList.contains("is-open")) {
        const activeId = String(
          detailPanel.getAttribute("data-my-plans-detail-plan-id") || "",
        ).trim();
        const recs = getMyPlansRecords();
        const rec = activeId
          ? recs.find((r) => String(r?.id || "") === activeId)
          : recs[0];
        if (rec) populateMyPlansPlanDetail(rec);
      }
      refreshManageSheetIfOpen();
    };

    syncMyPlansFlowUi = syncMyPlansFromFlow;

    let backFromPlanSuccessView = false;
    let myPlansCopySnackbarTimer = null;

    const showMyPlansSnackbar = (message) => {
      if (!container) return;
      let el = container.querySelector("[data-my-plans-copy-snackbar]");
      if (!el) {
        el = document.createElement("div");
        el.className = "snackbar";
        el.setAttribute("data-my-plans-copy-snackbar", "true");
        el.setAttribute("role", "status");
        el.setAttribute("aria-live", "polite");
        el.innerHTML = `
          <span class="snackbar__icon" aria-hidden="true">
            <img src="assets/icon_success_screen.svg" alt="" />
          </span>
          <span data-my-plans-copy-snackbar-text></span>
        `;
        container.appendChild(el);
      }
      const textEl = el.querySelector("[data-my-plans-copy-snackbar-text]");
      if (textEl) textEl.textContent = String(message || "");
      if (myPlansCopySnackbarTimer) clearTimeout(myPlansCopySnackbarTimer);
      el.classList.remove("is-visible");
      void el.offsetWidth;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add("is-visible");
        });
      });
      myPlansCopySnackbarTimer = window.setTimeout(() => {
        el.classList.remove("is-visible");
      }, 1800);
    };

    const showMyPlansCopySnackbar = (message) => {
      showMyPlansSnackbar(message);
    };

    const closeActivityDetail = (instant = false) => {
      if (!activityDetailPanel) return;
      if (instant) {
        const prevTransition = activityDetailPanel.style.transition;
        activityDetailPanel.style.transition = "none";
        activityDetailPanel.classList.remove("is-open");
        activityDetailPanel.hidden = true;
        void activityDetailPanel.offsetHeight;
        activityDetailPanel.style.transition = prevTransition;
        return;
      }
      activityDetailPanel.classList.remove("is-open");
      const onEnd = () => {
        if (!activityDetailPanel.classList.contains("is-open"))
          activityDetailPanel.hidden = true;
        activityDetailPanel.removeEventListener("transitionend", onEnd);
      };
      activityDetailPanel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    const closeActivityList = (instant = false) => {
      if (!activityListPanel) return;
      if (instant) {
        const prevTransition = activityListPanel.style.transition;
        activityListPanel.style.transition = "none";
        activityListPanel.classList.remove("is-open");
        activityListPanel.hidden = true;
        void activityListPanel.offsetHeight;
        activityListPanel.style.transition = prevTransition;
        return;
      }
      activityListPanel.classList.remove("is-open");
      const onEnd = () => {
        if (!activityListPanel.classList.contains("is-open"))
          activityListPanel.hidden = true;
        activityListPanel.removeEventListener("transitionend", onEnd);
      };
      activityListPanel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    const setActivityCardsExpandedState = (rootEl, expandFirst = true) => {
      if (!rootEl) return;
      const renderedCards = Array.from(
        rootEl.querySelectorAll("[data-my-plans-activity-card]"),
      );
      renderedCards.forEach((rowCard, idx) => {
        const expanded = expandFirst && idx === 0;
        rowCard.classList.toggle("is-expanded", expanded);
        rowCard.classList.toggle("is-collapsed", !expanded);
        const rowToggle = rowCard.querySelector("[data-my-plans-activity-toggle]");
        if (!rowToggle) return;
        rowToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
        rowToggle.setAttribute(
          "aria-label",
          expanded ? "Collapse activity" : "Expand activity",
        );
        const icon = rowCard.querySelector(".my-plans-detail-panel__act-toggle img");
        if (icon)
          icon.setAttribute(
            "src",
            `assets/icon_chevron_${expanded ? "up" : "down"}_white.svg`,
          );
      });
    };

    const openActivityList = () => {
      if (!activityListPanel || !activityListContentEl || !detailPanel) return;
      const sourceActivityEl = detailPanel.querySelector(
        "[data-my-plans-detail-activity]",
      );
      const completedText = String(
        detailPanel.querySelector("[data-my-plans-detail-completed]")?.textContent ||
          "",
      );
      const completedBuysMatch = completedText.match(/(\d+)/);
      const completedBuys = completedBuysMatch
        ? Math.max(0, parseInt(completedBuysMatch[1], 10) || 0)
        : 0;
      const scratch = document.createElement("div");
      scratch.innerHTML = sourceActivityEl?.innerHTML || "";
      const listOnlyCards = Array.from(
        scratch.querySelectorAll("[data-my-plans-activity-card]"),
      ).filter((cardEl) =>
        cardEl.querySelector(".my-plans-detail-panel__act-row"),
      );
      scratch.innerHTML = "";
      listOnlyCards.forEach((cardEl) => scratch.appendChild(cardEl));
      const seedCards = Array.from(
        scratch.querySelectorAll("[data-my-plans-activity-card]"),
      );
      if (seedCards.length && completedBuys > 0) {
        if (seedCards.length > completedBuys) {
          seedCards.slice(completedBuys).forEach((card) => card.remove());
        } else if (seedCards.length < completedBuys) {
          const base = seedCards.map((card) => card.cloneNode(true));
          for (let i = seedCards.length; i < completedBuys; i += 1) {
            const src = base[i % base.length];
            if (!src) break;
            scratch.appendChild(src.cloneNode(true));
          }
        }
      }
      const cadenceRaw = String(
        activePlanDetailRecord?.repeats ||
          activePlanDetailRecord?.investLine ||
          "",
      ).toLowerCase();
      const cadenceUnit = cadenceRaw.includes("week")
        ? "week"
        : cadenceRaw.includes("day")
          ? "day"
          : "month";
      const shiftDateByCadence = (base, step) => {
        const d = new Date(base);
        if (cadenceUnit === "day") d.setDate(d.getDate() - step);
        else if (cadenceUnit === "week") d.setDate(d.getDate() - step * 7);
        else d.setMonth(d.getMonth() - step);
        return d;
      };
      const pad2 = (n) => String(n).padStart(2, "0");
      const fmtDate = (d) =>
        `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
      const fmtTime = (d) =>
        `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      Array.from(scratch.querySelectorAll("[data-my-plans-activity-card]")).forEach(
        (cardEl, idx) => {
          const d = shiftDateByCadence(new Date(), idx);
          const dateEl = cardEl.querySelector(".my-plans-detail-panel__activity-date");
          const timeEl = cardEl.querySelector(".my-plans-detail-panel__activity-time");
          if (dateEl) dateEl.textContent = fmtDate(d);
          if (timeEl) timeEl.textContent = `, ${fmtTime(d)}`;
        },
      );
      activityListContentEl.innerHTML = scratch.innerHTML;
      setActivityCardsExpandedState(activityListContentEl, false);
      activityListPanel.hidden = false;
      requestAnimationFrame(() => {
        activityListPanel.classList.add("is-open");
      });
    };

    const closePlanDetail = (instant = false) => {
      if (!detailPanel) return;
      if (instant) {
        const prevTransition = detailPanel.style.transition;
        detailPanel.style.transition = "none";
        detailPanel.classList.remove("is-open");
        detailHeader?.classList.remove("is-collapsed");
        closeActivityList(true);
        closeActivityDetail(true);
        if (detailScroller) detailScroller.scrollTop = 0;
        detailPanel.hidden = true;
        void detailPanel.offsetHeight;
        detailPanel.style.transition = prevTransition;
        return;
      }
      detailPanel.classList.remove("is-open");
      detailHeader?.classList.remove("is-collapsed");
      closeActivityList(true);
      closeActivityDetail(true);
      const onEnd = () => {
        if (!detailPanel.classList.contains("is-open"))
          detailPanel.hidden = true;
        detailPanel.removeEventListener("transitionend", onEnd);
      };
      detailPanel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    const populateMyPlansPlanDetail = (rec) => {
      if (!detailPanel || !rec) return;
      const detailTitleEl = detailPanel.querySelector(
        "[data-my-plans-detail-title]",
      );
      const detailHeaderKickerEl = detailPanel.querySelector(
        "[data-my-plans-detail-header-kicker]",
      );
      const statusLabelEl = detailPanel.querySelector(
        "[data-my-plans-detail-status-label]",
      );
      const investLineEl = detailPanel.querySelector(
        "[data-my-plans-detail-invest-line]",
      );
      const iconsWrap = detailPanel.querySelector(
        "[data-my-plans-detail-icons]",
      );
      const allocationEl = detailPanel.querySelector(
        "[data-my-plans-detail-allocation]",
      );
      const createdAtEl = detailPanel.querySelector(
        "[data-my-plans-detail-created-at]",
      );
      const endedAtRowEl = detailPanel.querySelector(
        "[data-my-plans-detail-ended-row]",
      );
      const endedAtEl = detailPanel.querySelector(
        "[data-my-plans-detail-ended-at]",
      );
      const planIdEl = detailPanel.querySelector(
        "[data-my-plans-detail-plan-id]",
      );
      const nextBuyEl = detailPanel.querySelector(
        "[data-my-plans-detail-next-buy]",
      );
      const completedEl = detailPanel.querySelector(
        "[data-my-plans-detail-completed]",
      );
      const totalInvestedEl = detailPanel.querySelector(
        "[data-my-plans-detail-total-invested]",
      );
      const fundingWrapEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-wrap]",
      );
      const fundingCardEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-card]",
      );
      const fundingMainEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-main]",
      );
      const fundingSubEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-sub]",
      );
      const fundingCheckEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-check]",
      );
      const accumulatedEl = detailPanel.querySelector(
        "[data-my-plans-detail-accumulated]",
      );
      const activityEl = detailPanel.querySelector(
        "[data-my-plans-detail-activity]",
      );
      const pauseBtn = detailPanel.querySelector(
        "[data-my-plans-detail-pause]",
      );

      const statusKey =
        rec.status === "paused"
          ? "paused"
          : rec.status === "ended"
            ? "ended"
            : "active";
      detailPanel.setAttribute("data-plan-status", statusKey);
      const statusText =
        statusKey === "paused"
          ? "Plan is paused"
          : statusKey === "ended"
            ? "Plan ended"
            : "Plan is active";
      if (statusLabelEl) statusLabelEl.textContent = statusText;
      const manageTriggerEl = detailPanel.querySelector(
        "[data-my-plans-detail-manage-trigger]",
      );
      if (manageTriggerEl)
        manageTriggerEl.textContent =
          statusKey === "ended" ? "Duplicate plan" : "Manage plan";
      const tickers = String(rec.tickers || "")
        .split(/[·,]/g)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      const mixRaw = Array.isArray(rec.assetMix) ? rec.assetMix : [];
      let mix = mixRaw
        .map((m) => ({
          ticker: String(m?.ticker || "")
            .trim()
            .toUpperCase(),
          pct: Number.isFinite(Number(m?.pct))
            ? Math.max(0, Math.round(Number(m.pct)))
            : 0,
        }))
        .filter((m) => m.ticker);
      if (!mix.length && tickers.length) {
        if (tickers.length === 1) mix = [{ ticker: tickers[0], pct: 100 }];
        else {
          const base = Math.floor(100 / tickers.length);
          let rem = 100 - base * tickers.length;
          mix = tickers.map((ticker) => {
            const pct = base + (rem > 0 ? 1 : 0);
            if (rem > 0) rem -= 1;
            return { ticker, pct };
          });
        }
      }
      const tickerMeta = (ticker) => {
        const t = String(ticker || "")
          .trim()
          .toUpperCase();
        const explicit = Array.isArray(rec.assetIcons)
          ? rec.assetIcons.find(
              (a) =>
                String(a?.ticker || "")
                  .trim()
                  .toUpperCase() === t && String(a?.icon || "").trim(),
            )
          : null;
        const exIcon = String(explicit?.icon || "").trim();
        const useExplicit =
          exIcon && !COMPOSITE_HERO_ICONS_FOR_ALLOC.has(exIcon);
        const names = {
          BTC: "Bitcoin",
          ETH: "Ethereum",
          SOL: "Solana",
          XAUT: "Tether Gold",
          RENDER: "Render",
          NEAR: "NEAR",
          LINK: "Chainlink",
          XRP: "XRP",
        };
        const recSrc = String(rec.iconSrc || "").trim();
        const fallbackPlanIcon =
          recSrc && !COMPOSITE_HERO_ICONS_FOR_ALLOC.has(recSrc) ? recSrc : "";
        const icon =
          (useExplicit ? exIcon : "") ||
          resolveMyPlansAllocTickerIcon(t) ||
          fallbackPlanIcon ||
          "assets/icon_currency_btc.svg";
        return { ticker: t, name: names[t] || t, icon };
      };
      const assetCount = mix.length;
      const tickerLine = mix
        .map((m) => m.ticker)
        .filter(Boolean)
        .join(" · ");
      const singleMeta = assetCount === 1 ? tickerMeta(mix[0].ticker) : null;
      const autoHeaderTitle =
        assetCount === 0
          ? "My plan"
          : assetCount === 1
            ? singleMeta?.name || "My plan"
            : tickerLine || "My plan";
      const candidateCustomName = String(rec.name || "").trim();
      const hasCustomHeaderName =
        !!candidateCustomName && candidateCustomName !== autoHeaderTitle;
      const effectiveHeaderTitle = hasCustomHeaderName
        ? candidateCustomName
        : autoHeaderTitle;
      const showHeaderKicker =
        assetCount === 1 || (hasCustomHeaderName && !!tickerLine);
      if (detailTitleEl) detailTitleEl.textContent = effectiveHeaderTitle;
      if (detailHeaderKickerEl) {
        detailHeaderKickerEl.textContent = "";
        detailHeaderKickerEl.hidden = true;
      }
      if (investLineEl) {
        const investLine = String(rec.investLine || "").trim();
        const money = investLine.match(
          /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
        );
        const moneyPart = money
          ? `${money[1]} ${String(money[2] || "").toUpperCase()}`
          : "";
        const schedulePart = formatScheduleNaturalLine(rec.repeats || "");
        if (moneyPart) {
          investLineEl.textContent = "";
          const amountLine = document.createElement("div");
          amountLine.className =
            "my-plans-detail-panel__invest-summary-line my-plans-detail-panel__invest-summary-line--amount";
          amountLine.textContent = `Invest ${moneyPart}`;
          const scheduleLineEl = document.createElement("div");
          scheduleLineEl.className =
            "my-plans-detail-panel__invest-summary-line my-plans-detail-panel__invest-summary-line--schedule";
          scheduleLineEl.textContent = schedulePart || "—";
          investLineEl.appendChild(amountLine);
          investLineEl.appendChild(scheduleLineEl);
        } else {
          investLineEl.textContent = investLine || "—";
        }
      }
      if (pauseBtn)
        pauseBtn.textContent = statusKey === "paused" ? "Resume" : "Pause";
      renderMyPlansHeaderIcons(
        iconsWrap,
        rec.tickers,
        rec.iconSrc || "assets/icon_currency_btc.svg",
        rec.assetIcons || [],
        "product",
      );

      if (allocationEl) {
        allocationEl.textContent = "";
        const singleAsset = mix.length === 1;
        mix.forEach((m) => {
          const meta = tickerMeta(m.ticker);
          appendPlanOverviewStyleAllocChip(
            allocationEl,
            { icon: meta.icon, ticker: m.ticker, pct: m.pct },
            { singleAssetFallback: singleAsset },
          );
        });
      }

      const nextBuyText = shortenWeekdayLabel(
        rec.nextBuy || rec.firstBuy || FINANCE_SUMMARY_NEXT_BUY_FALLBACK,
      );
      const flowState = states.flow ?? 1;
      const isEndedFlowState = flowState === 5;
      const formatDetailDateTime = (dateInput) => {
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (Number.isNaN(d.getTime())) return "—";
        const pad2 = (n) => String(n).padStart(2, "0");
        return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
      };
      if (nextBuyEl)
        nextBuyEl.textContent =
          flowState === 4 || isEndedFlowState ? "- -" : nextBuyText;
      if (fundingWrapEl) fundingWrapEl.hidden = isEndedFlowState;
      if (fundingCardEl) fundingCardEl.hidden = isEndedFlowState;
      const recCompletedBuys = Number.isFinite(rec.completedBuys)
        ? Math.max(0, Math.floor(rec.completedBuys))
        : 0;
      const completedN = flowState >= 3 ? Math.max(5, recCompletedBuys) : 0;
      if (completedEl) {
        completedEl.textContent = `${completedN} buys`;
        completedEl.classList.toggle(
          "my-plans-detail-panel__ov-value--zero",
          completedN <= 0,
        );
      }
      const parsedTotalInvested = parseMoneyWithCurrency(
        rec.totalInvested || "",
      );
      const perBuyMoney = parsePerBuyFromInvestLine(rec.investLine || "");
      const cur = getPlanRecordDisplayCurrency(rec);
      let totalAmt = 0;
      if (flowState >= 3) {
        if (parsedTotalInvested && parsedTotalInvested.amount > 0)
          totalAmt = parsedTotalInvested.amount;
        else if (perBuyMoney && perBuyMoney.amount > 0)
          totalAmt = perBuyMoney.amount * completedN;
      }
      const px = {
        BTC: 60000,
        ETH: 3000,
        SOL: 130,
        XAUT: 2400,
        RENDER: 7,
        NEAR: 6,
        LINK: 17,
        XRP: 0.6,
      };
      if (totalInvestedEl) {
        totalInvestedEl.textContent = formatMoneyDisplayCurrency(totalAmt, cur);
        totalInvestedEl.classList.toggle(
          "my-plans-detail-panel__ov-value--zero",
          totalAmt <= 0,
        );
      }

      const fundingClassicEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-classic]",
      );
      const fundingPrefundEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-prefund]",
      );
      const fundingPrefundAmountEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-prefund-amount]",
      );
      const fundingPrefundAmountRowEl = fundingPrefundAmountEl?.closest(
        ".my-plans-detail-panel__funding-prefund-amount-row",
      );
      const fundingPrefundBarFillEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-prefund-bar-fill]",
      );
      const fundingPrefundMetaEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-prefund-meta]",
      );
      const fundingPrefundAutorefEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-prefund-autoref]",
      );
      const fundingClassicAlertEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-alert-classic]",
      );
      const fundingClassicAlertTextEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-alert-classic-text]",
      );
      const fundingClassicAlertIconEl = fundingClassicAlertEl?.querySelector(
        ".my-plans-detail-panel__funding-alert-icon",
      );
      const fundingClassicAlertLinkEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-alert-link]",
      );
      const fundingPrefundAlertEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-alert-prefund]",
      );
      const fundingPrefundAlertTextEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-alert-prefund-text]",
      );
      const fundingPrefundAlertIconEl = fundingPrefundAlertEl?.querySelector(
        ".my-plans-detail-panel__funding-alert-icon",
      );
      const fundingPrefundAlertLinkEl = detailPanel.querySelector(
        "[data-my-plans-detail-funding-alert-prefund-link]",
      );
      const fundingState = states.funding ?? 1;
      // Pre-funded Figma layout only for prototype funding state 3+; 1–2 use classic row.
      const usePrefundDetailLayout = fundingState >= 3 && flowState !== 5;

      if (fundingClassicEl) fundingClassicEl.hidden = usePrefundDetailLayout;
      if (fundingPrefundEl) {
        fundingPrefundEl.hidden = !usePrefundDetailLayout;
        fundingPrefundEl.setAttribute(
          "aria-hidden",
          usePrefundDetailLayout ? "false" : "true",
        );
      }

      const applyFundingAlert = (el, textEl, iconEl, tone, text) => {
        if (!el) return;
        const hasText = String(text || "").trim().length > 0;
        el.hidden = !hasText;
        el.classList.toggle(
          "my-plans-detail-panel__funding-alert--warning",
          tone === "warning",
        );
        el.classList.toggle(
          "my-plans-detail-panel__funding-alert--negative",
          tone === "negative",
        );
        if (textEl) textEl.textContent = hasText ? String(text) : "";
        if (iconEl) {
          iconEl.setAttribute(
            "src",
            tone === "warning"
              ? "assets/icon_warning.svg"
              : "assets/icon_negative.svg",
          );
        }
      };

      if (!usePrefundDetailLayout) {
        applyFundingAlert(
          fundingPrefundAlertEl,
          fundingPrefundAlertTextEl,
          fundingPrefundAlertIconEl,
          "negative",
          "",
        );
        if (fundingMainEl) {
          fundingMainEl.textContent = rec.isReserved
            ? "Pre-fund"
            : `Deduct from balance`;
        }
        if (fundingSubEl) {
          const sub =
            fundingState === 2
              ? `Insufficient ${cur} balance`
              : rec.isReserved
                ? computeCoversBuysText(rec) || rec.reservedFunds || ""
                : `Sufficient ${cur} balance`;
          fundingSubEl.textContent = sub;
          fundingSubEl.classList.toggle(
            "my-plans-detail-panel__ov-sub--positive",
            fundingState !== 2,
          );
          fundingSubEl.classList.toggle(
            "my-plans-detail-panel__ov-sub--negative",
            fundingState === 2,
          );
          const subTrim = String(sub || "").trim();
          if (fundingCheckEl)
            fundingCheckEl.hidden = fundingState === 2 || !subTrim;
        }
        if (fundingState === 2) {
          applyFundingAlert(
            fundingClassicAlertEl,
            fundingClassicAlertTextEl,
            fundingClassicAlertIconEl,
            "negative",
            "Please add funds to your wallet before your next scheduled buy.",
          );
          if (fundingClassicAlertLinkEl)
            fundingClassicAlertLinkEl.hidden = false;
        } else {
          applyFundingAlert(
            fundingClassicAlertEl,
            fundingClassicAlertTextEl,
            fundingClassicAlertIconEl,
            "negative",
            "",
          );
          if (fundingClassicAlertLinkEl)
            fundingClassicAlertLinkEl.hidden = true;
        }
      } else {
        applyFundingAlert(
          fundingClassicAlertEl,
          fundingClassicAlertTextEl,
          fundingClassicAlertIconEl,
          "negative",
          "",
        );
        if (fundingClassicAlertLinkEl) fundingClassicAlertLinkEl.hidden = true;
        const investAmtMatch = String(rec.investLine || "").match(
          /(\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
        );
        const perNum = investAmtMatch
          ? parseFloat(String(investAmtMatch[1] || "").replace(/,/g, ""))
          : perBuyMoney && perBuyMoney.amount > 0
            ? perBuyMoney.amount
            : 0;
        const reservedRaw = String(rec.reservedFunds || "").trim();
        const reservedAmtMatch = reservedRaw.match(
          /([\d,]+(?:\.\d+)?)\s*([A-Za-z]{3,5})\s*$/,
        );
        const reservedNum = reservedAmtMatch
          ? parseFloat(String(reservedAmtMatch[1] || "").replace(/,/g, ""))
          : 0;

        let amountLeftNum = 0;
        if (fundingState === 5) {
          amountLeftNum = 0;
        } else if (fundingState === 4) {
          amountLeftNum = Number.isFinite(perNum) && perNum > 0 ? perNum : 0;
        } else if (reservedNum > 0) {
          amountLeftNum = reservedNum;
        } else {
          amountLeftNum =
            Number.isFinite(perNum) && perNum > 0 ? perNum * 4 : 0;
        }

        if (fundingPrefundAmountEl) {
          fundingPrefundAmountEl.textContent =
            fundingState === 5
              ? `0.00 ${cur}`
              : `${amountLeftNum.toLocaleString("en-US")} ${cur}`;
        }

        let prefundTone = "ok";
        let prefundBarPct = 100;
        if (fundingState === 3) {
          prefundTone = "ok";
          prefundBarPct = 100;
        } else if (fundingState === 4) {
          prefundTone = "low";
          prefundBarPct = 25;
        } else {
          prefundTone = "empty";
          prefundBarPct = 0;
        }
        if (fundingPrefundAmountRowEl) {
          fundingPrefundAmountRowEl.className = `my-plans-detail-panel__funding-prefund-amount-row my-plans-detail-panel__funding-prefund-amount-row--${prefundTone}`;
        }
        if (fundingPrefundBarFillEl) {
          fundingPrefundBarFillEl.style.width = `${prefundBarPct}%`;
          fundingPrefundBarFillEl.className = `my-plans-detail-panel__funding-prefund-bar-fill my-plans-detail-panel__funding-prefund-bar-fill--${prefundTone}`;
        }

        const formatRunsOutAround = (label) => {
          const t = String(label || "").trim();
          if (!t || t === "- -" || t === "—") return "—";
          const m = t.match(/^[A-Za-z]+,\s*(.+)$/);
          if (m) return m[1].trim();
          return t;
        };
        const covLine = computeCoversBuysText(rec) || "";
        const buyNMatch = covLine.match(/(\d+)/);
        /** `computeCoversBuysText` only runs when `isReserved`; prefund layout can show without that flag. */
        let buyN = buyNMatch ? buyNMatch[1] : "—";
        if (buyN === "—" && Number.isFinite(perNum) && perNum > 0) {
          buyN = String(Math.max(0, Math.floor(amountLeftNum / perNum)));
        }
        const runRaw =
          rec.nextBuy || rec.firstBuy || FINANCE_SUMMARY_NEXT_BUY_FALLBACK;
        const runShort = formatRunsOutAround(shortenWeekdayLabel(runRaw));
        if (fundingPrefundMetaEl) {
          fundingPrefundMetaEl.textContent =
            fundingState === 5
              ? "Funds have run out"
              : `Covers ${buyN} buys  ·  Runs out around ${runShort}`;
          fundingPrefundMetaEl.classList.toggle(
            "my-plans-detail-panel__funding-prefund-meta--negative",
            fundingState === 5,
          );
        }

        const topUpNum =
          reservedNum > 0
            ? reservedNum
            : Number.isFinite(perNum) && perNum > 0
              ? perNum * 4
              : 0;
        const lowThresholdNum =
          Number.isFinite(perNum) && perNum > 0
            ? perNum
            : topUpNum > 0
              ? Math.max(1, Math.round(topUpNum * 0.1))
              : 0;
        if (fundingPrefundAutorefEl) {
          fundingPrefundAutorefEl.textContent =
            topUpNum > 0
              ? `Automatically refill ${topUpNum.toLocaleString("en-US")} ${cur} when pre-funded amount drops below ${lowThresholdNum.toLocaleString("en-US")} ${cur}`
              : "—";
        }
        const alertTopUpText =
          topUpNum > 0
            ? `${topUpNum.toLocaleString("en-US")} ${cur}`
            : `0 ${cur}`;
        if (fundingState === 4) {
          applyFundingAlert(
            fundingPrefundAlertEl,
            fundingPrefundAlertTextEl,
            fundingPrefundAlertIconEl,
            "warning",
            `Auto-refill coming up: Keep at least ${alertTopUpText} in your wallet.`,
          );
          if (fundingPrefundAlertLinkEl)
            fundingPrefundAlertLinkEl.hidden = false;
        } else if (fundingState === 5) {
          applyFundingAlert(
            fundingPrefundAlertEl,
            fundingPrefundAlertTextEl,
            fundingPrefundAlertIconEl,
            "negative",
            `Auto-refill failed: Add ${alertTopUpText} to your wallet to continue.`,
          );
          if (fundingPrefundAlertLinkEl)
            fundingPrefundAlertLinkEl.hidden = false;
        } else {
          applyFundingAlert(
            fundingPrefundAlertEl,
            fundingPrefundAlertTextEl,
            fundingPrefundAlertIconEl,
            "negative",
            "",
          );
          if (fundingPrefundAlertLinkEl)
            fundingPrefundAlertLinkEl.hidden = true;
        }
      }

      if (createdAtEl) {
        createdAtEl.textContent = formatDetailDateTime(
          rec.createdAt || new Date(),
        );
      }
      if (endedAtRowEl) endedAtRowEl.hidden = !isEndedFlowState;
      if (endedAtEl) {
        if (isEndedFlowState && !rec.endedAt) rec.endedAt = new Date().toISOString();
        endedAtEl.textContent = isEndedFlowState
          ? formatDetailDateTime(rec.endedAt || rec.updatedAt || new Date())
          : "—";
      }

      if (planIdEl) {
        /** Stable 9-digit display id from record (looks like a real plan ref). */
        const planIdForDisplay = (r) => {
          const key = String(
            r?.id ?? r?.kicker ?? r?.name ?? r?.tickers ?? "plan",
          );
          let h = 2166136261;
          for (let i = 0; i < key.length; i += 1) {
            h ^= key.charCodeAt(i);
            h = Math.imul(h, 16777619);
          }
          const n = (Math.abs(h) % 900000000) + 100000000;
          return String(n);
        };
        planIdEl.textContent = planIdForDisplay(rec);
      }

      if (accumulatedEl) {
        accumulatedEl.innerHTML = "";
        mix.forEach((m) => {
          const meta = tickerMeta(m.ticker);
          const amount = totalAmt > 0 ? totalAmt * (m.pct / 100) : 0;
          const price = px[m.ticker] || 100;
          const qty = amount > 0 ? amount / price : 0;
          const qtyTone = qty > 0 ? "positive" : "zero";
          const flow2ZeroPlaceholder = "- -";
          const investedRowText =
            amount <= 0 && flowState === 2
              ? flow2ZeroPlaceholder
              : formatMoneyDisplayCurrency(amount, cur);
          const avgPrice = getPrototypeAveragePrice(m.ticker, cur);
          const avgRowText =
            completedN > 0
              ? formatMoneyDisplayCurrency(avgPrice, cur)
              : flowState === 2
                ? flow2ZeroPlaceholder
                : "--";
          const investedZeroClass =
            amount <= 0 ? "my-plans-detail-panel__asset-row__value--zero" : "";
          const avgZeroClass =
            completedN <= 0
              ? "my-plans-detail-panel__asset-row__value--zero"
              : "";
          const card = document.createElement("article");
          card.className = "my-plans-detail-panel__asset-card";
          card.innerHTML = `<div class="my-plans-detail-panel__asset-head"><div class="my-plans-detail-panel__asset-left"><img class="my-plans-detail-panel__asset-icon" src="${meta.icon}" alt="" /><div class="my-plans-detail-panel__asset-copy"><div class="my-plans-detail-panel__asset-ticker">${m.ticker}</div><div class="my-plans-detail-panel__asset-name">${meta.name}</div></div></div><div class="my-plans-detail-panel__asset-right"><div class="my-plans-detail-panel__asset-qty my-plans-detail-panel__asset-qty--${qtyTone}">${qty.toFixed(5)}</div><div class="my-plans-detail-panel__asset-sub">≈ ${formatMoneyDisplayCurrency(amount, cur)}</div></div></div><div class="my-plans-detail-panel__asset-rows"><div class="my-plans-detail-panel__asset-row"><span>Invested</span><strong class="${investedZeroClass.trim()}">${investedRowText}</strong></div><div class="my-plans-detail-panel__asset-row"><span>Average price</span><strong class="${avgZeroClass.trim()}">${avgRowText}</strong></div></div>`;
          accumulatedEl.appendChild(card);
        });
      }

      const showAllWrap = detailPanel.querySelector(
        ".my-plans-detail-panel__show-all-wrap",
      );
      if (showAllWrap) showAllWrap.hidden = flowState === 2;

      if (activityEl) {
        if (completedN <= 0) {
          activityEl.innerHTML =
            '<div class="my-plans-detail-panel__activity-empty">No activity yet</div>';
          return;
        }
        const now = new Date();
        const isSingleAssetPlan = mix.length < 2;
        const perBuyAmount =
          perBuyMoney?.amount && perBuyMoney.amount > 0
            ? perBuyMoney.amount
            : totalAmt > 0 && completedN > 0
              ? totalAmt / completedN
              : 5000;
        const pad2 = (n) => String(n).padStart(2, "0");
        const mkDate = (date) =>
          `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
        const mkTime = (date) =>
          `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
        const lines = mix
          .map((m) => {
            const meta = tickerMeta(m.ticker);
            const amount = perBuyAmount > 0 ? perBuyAmount * (m.pct / 100) : 0;
            const price = px[m.ticker] || 100;
            const qty = amount > 0 ? amount / price : 0;
            const qtyStr = String(qty.toFixed(6)).replace(/\.?0+$/, "") || "0";
            const pctHiddenAttr = isSingleAssetPlan ? " hidden" : "";
            return `<div class="my-plans-detail-panel__act-row"><div class="my-plans-detail-panel__act-left"><div class="my-plans-detail-panel__act-name-col"><div class="my-plans-detail-panel__act-ticker-line"><span class="my-plans-detail-panel__act-ticker">${m.ticker}</span><span class="my-plans-detail-panel__act-pct"${pctHiddenAttr}>${m.pct}%</span></div></div></div><div class="my-plans-detail-panel__act-right"><div class="my-plans-detail-panel__act-values"><span class="my-plans-detail-panel__act-gain">+ ${qtyStr}</span><span class="my-plans-detail-panel__act-pay">- ${formatMoneyDisplayCurrency(amount, cur)}</span></div><img class="my-plans-detail-panel__act-icon" src="${meta.icon}" alt="" /><span class="my-plans-detail-panel__act-chevron" aria-hidden="true"><img src="assets/icon_right_graychev.svg" alt="" width="15" height="15" /></span></div></div>`;
          })
          .join("");
        const buildCard = (date, expanded, opts = {}) => {
          const failed = Boolean(opts.failed);
          const prefundLogType = String(
            opts.prefundLogType || "",
          ).toLowerCase();
          const isPrefundedLog = prefundLogType === "prefunded";
          const isReturnedLog = prefundLogType === "returned";
          const isPausedLog = prefundLogType === "paused";
          const isResumedLog = prefundLogType === "resumed";
          const isEndedLog = prefundLogType === "ended";
          const hasSpecialLog =
            isPrefundedLog ||
            isReturnedLog ||
            isPausedLog ||
            isResumedLog ||
            isEndedLog;
          const hasPrefundLog = isPrefundedLog || isReturnedLog;
          const prefundAmtParsed = hasPrefundLog
            ? parseMoneyWithCurrency(rec.reservedFunds || "")
            : null;
          const prefundAmtNum =
            prefundAmtParsed && prefundAmtParsed.amount > 0
              ? prefundAmtParsed.amount
              : perBuyAmount > 0
                ? perBuyAmount * 4
                : 0;
          const prefundCur = prefundAmtParsed?.currency || cur;
          const prefundAmtText = `${prefundAmtNum.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${prefundCur}`;
          const headIcon = hasSpecialLog
            ? "assets/icon_info_blue.svg"
            : failed
              ? "assets/icon_failed.svg"
              : "assets/icon_success_screen.svg";
          const investedText = hasPrefundLog
            ? `${prefundAmtText} ${isReturnedLog ? "returned" : "pre-funded"}`
            : isPausedLog
              ? "Plan paused"
              : isResumedLog
                ? "Plan resumed"
                : isEndedLog
                  ? "Plan ended"
                  : failed
                    ? "Buy failed"
                    : `${formatMoneyDisplayCurrency(perBuyAmount, cur)} invested`;
          const investedClass = failed
            ? "my-plans-detail-panel__activity-invested-text my-plans-detail-panel__activity-invested-text--failed"
            : "my-plans-detail-panel__activity-invested-text";
          const bodyContent = hasPrefundLog
            ? isReturnedLog
              ? `<p class="my-plans-detail-panel__act-error">Returned ${prefundAmtText} from this plan to your wallet, auto-refill for pre-funding has been disabled.</p>`
              : `<p class="my-plans-detail-panel__act-error">Reserved ${prefundAmtText} from your wallet for this plan, auto-refill for pre-funding has been enabled.</p>`
            : isPausedLog
              ? '<p class="my-plans-detail-panel__act-error">Plan was paused. No new automated buys will be done until resumed.</p>'
              : isResumedLog
                ? '<p class="my-plans-detail-panel__act-error">Plan was resumed. Automated buys will continue from next upcoming scheduled buy.</p>'
                : isEndedLog
                  ? '<p class="my-plans-detail-panel__act-error">Plan was ended. Automated buys stopped and any remaining funds were returned to your wallet.</p>'
                  : failed
                    ? '<p class="my-plans-detail-panel__act-error">Buy order failed due to insufficient balance. Please ensure you have enough balance before the next buy.</p>'
                    : lines;
          const failedClass = failed ? " is-failed" : "";
          return `<article class="my-plans-detail-panel__activity-card ${expanded ? "is-expanded" : "is-collapsed"}${failedClass}" data-my-plans-activity-card><div class="my-plans-detail-panel__activity-head" data-my-plans-activity-toggle role="button" tabindex="0" aria-expanded="${expanded ? "true" : "false"}" aria-label="${expanded ? "Collapse activity" : "Expand activity"}"><img class="my-plans-detail-panel__activity-head-icon" src="${headIcon}" alt="" width="20" height="20" aria-hidden="true" /><div class="my-plans-detail-panel__activity-date-col"><div class="my-plans-detail-panel__activity-date-line"><span class="my-plans-detail-panel__activity-date">${mkDate(date)}</span><span class="my-plans-detail-panel__activity-time">, ${mkTime(date)}</span></div><div class="my-plans-detail-panel__activity-invested-line"><img class="my-plans-detail-panel__activity-invested-icon" src="assets/icon_check_gray_s.svg" alt="" width="16" height="16" /><span class="${investedClass}">${investedText}</span></div></div><span class="my-plans-detail-panel__act-toggle" aria-hidden="true"><img src="assets/icon_chevron_${expanded ? "up" : "down"}_white.svg" alt="" width="24" height="24" /></span></div><div class="my-plans-detail-panel__act-list-footer-divider" aria-hidden="true"></div><div class="my-plans-detail-panel__act-list">${bodyContent}</div></article>`;
        };
        const prefundLog = getPrototypePrefundLog();
        const showPrefundLogCard = prefundLog !== "none";
        const baseCardIndexes = [0, 1, 2];
        const cardIndexes = showPrefundLogCard
          ? baseCardIndexes.slice(0, -1)
          : baseCardIndexes;
        const failedIndex = Math.max(0, cardIndexes.length - 2);
        const cards = cardIndexes.map((idx) => {
          const d = new Date(now);
          d.setMonth(d.getMonth() - idx);
          const failed = getPrototypeShowFailedBuy() && idx === failedIndex;
          return buildCard(d, idx === 0, { failed });
        });
        if (showPrefundLogCard) {
          const d = new Date(now);
          cards.unshift(buildCard(d, true, { prefundLogType: prefundLog }));
        }
        activityEl.innerHTML = cards.join("");
        setActivityCardsExpandedState(activityEl);
      }
    };

    const openPlanDetail = (rec) => {
      if (!detailPanel || !rec) return;
      activePlanDetailRecord = rec;
      if (rec.id)
        detailPanel.setAttribute(
          "data-my-plans-detail-plan-id",
          String(rec.id),
        );
      else detailPanel.removeAttribute("data-my-plans-detail-plan-id");
      populateMyPlansPlanDetail(rec);
      detailPanel.hidden = false;
      if (detailScroller) detailScroller.scrollTop = 0;
      detailHeader?.classList.remove("is-collapsed");
      requestAnimationFrame(() => {
        detailPanel.classList.add("is-open");
      });
    };

    const syncMyPlansDetailHeaderCollapse = () => {
      if (!detailPanel || !detailHeader || !detailScroller) return;
      const hero = detailPanel.querySelector(".my-plans-detail-panel__hero");
      const threshold = Math.max(24, (hero?.offsetHeight || 100) - 20);
      detailHeader.classList.toggle(
        "is-collapsed",
        detailScroller.scrollTop >= threshold,
      );
    };

    detailScroller?.addEventListener(
      "scroll",
      syncMyPlansDetailHeaderCollapse,
      { passive: true },
    );

    panel.addEventListener("click", (e) => {
      const cardEl = e.target.closest(".my-plans-position-card");
      if (!cardEl || !panel.contains(cardEl)) return;
      const interactiveEl = e.target.closest(
        'button, a, input, textarea, select, [role="button"]',
      );
      if (interactiveEl && interactiveEl !== cardEl) return;
      const id = cardEl.getAttribute("data-my-plans-plan-id");
      const list = getMyPlansRecords();
      const rec = id ? list.find((r) => String(r.id) === id) : list[0];
      if (rec) openPlanDetail(rec);
    });

    panel.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const cardEl = e.target.closest(
        ".my-plans-position-card[data-plan-card-open-detail]",
      );
      if (!cardEl || !panel.contains(cardEl)) return;
      e.preventDefault();
      const id = cardEl.getAttribute("data-my-plans-plan-id");
      const list = getMyPlansRecords();
      const rec = id ? list.find((r) => String(r.id) === id) : list[0];
      if (rec) openPlanDetail(rec);
    });

    panel.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-plan-card-view-detail]");
      if (!btn || !panel.contains(btn)) return;
      const cardEl = btn.closest(".my-plans-position-card");
      const id = cardEl?.getAttribute("data-my-plans-plan-id");
      const list = getMyPlansRecords();
      const rec = id ? list.find((r) => String(r.id) === id) : list[0];
      if (rec) openPlanDetail(rec);
    });

    detailPanel
      ?.querySelector("[data-my-plans-detail-close]")
      ?.addEventListener("click", () => {
        closePlanDetail(false);
      });

    detailPanel?.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest("[data-my-plans-activity-toggle]");
      if (!toggleBtn || !detailPanel.contains(toggleBtn)) return;
      const card = toggleBtn.closest("[data-my-plans-activity-card]");
      if (!card) return;
      const nextExpanded = !card.classList.contains("is-expanded");
      const cards = Array.from(
        detailPanel.querySelectorAll("[data-my-plans-activity-card]"),
      );
      cards.forEach((rowCard) => {
        const isTarget = rowCard === card;
        const shouldExpand = isTarget ? nextExpanded : false;
        rowCard.classList.toggle("is-expanded", shouldExpand);
        rowCard.classList.toggle("is-collapsed", !shouldExpand);
        const rowToggle = rowCard.querySelector(
          "[data-my-plans-activity-toggle]",
        );
        if (!rowToggle) return;
        rowToggle.setAttribute(
          "aria-expanded",
          shouldExpand ? "true" : "false",
        );
        rowToggle.setAttribute(
          "aria-label",
          shouldExpand ? "Collapse activity" : "Expand activity",
        );
        const icon = rowCard.querySelector(
          ".my-plans-detail-panel__act-toggle img",
        );
        if (icon)
          icon.setAttribute(
            "src",
            `assets/icon_chevron_${shouldExpand ? "up" : "down"}_white.svg`,
          );
      });
    });
    activityListContentEl?.addEventListener("click", (e) => {
      const toggleBtn = e.target.closest("[data-my-plans-activity-toggle]");
      if (!toggleBtn || !activityListContentEl.contains(toggleBtn)) return;
      const card = toggleBtn.closest("[data-my-plans-activity-card]");
      if (!card) return;
      const nextExpanded = !card.classList.contains("is-expanded");
      const cards = Array.from(
        activityListContentEl.querySelectorAll("[data-my-plans-activity-card]"),
      );
      cards.forEach((rowCard) => {
        const isTarget = rowCard === card;
        const shouldExpand = isTarget ? nextExpanded : false;
        rowCard.classList.toggle("is-expanded", shouldExpand);
        rowCard.classList.toggle("is-collapsed", !shouldExpand);
        const rowToggle = rowCard.querySelector("[data-my-plans-activity-toggle]");
        if (!rowToggle) return;
        rowToggle.setAttribute("aria-expanded", shouldExpand ? "true" : "false");
        rowToggle.setAttribute(
          "aria-label",
          shouldExpand ? "Collapse activity" : "Expand activity",
        );
        const icon = rowCard.querySelector(".my-plans-detail-panel__act-toggle img");
        if (icon)
          icon.setAttribute(
            "src",
            `assets/icon_chevron_${shouldExpand ? "up" : "down"}_white.svg`,
          );
      });
    });

    detailPanel?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const trigger = e.target.closest("[data-my-plans-activity-toggle]");
      if (!trigger || !detailPanel.contains(trigger)) return;
      e.preventDefault();
      trigger.click();
    });

    const populateActivityDetailFromRow = (row) => {
      if (!activityDetailPanel || !row) return;
      const card = row.closest("[data-my-plans-activity-card]");
      const ticker =
        String(
          row.querySelector(".my-plans-detail-panel__act-ticker")
            ?.textContent || "",
        ).trim() || "BTC";
      const gainRaw = String(
        row.querySelector(".my-plans-detail-panel__act-gain")?.textContent ||
          "",
      ).trim();
      const payRaw = String(
        row.querySelector(".my-plans-detail-panel__act-pay")?.textContent || "",
      ).trim();
      const gainNum = gainRaw.replace(/^\+\s*/, "").trim() || "0";
      const payClean = payRaw.replace(/^-+\s*/, "").trim();
      const payAmtMatch = payClean.match(/^([\d,]+(?:\.\d+)?)/);
      const payCurMatch = payClean.match(/\b([A-Za-z]{3,5})\b$/);
      const payAmt = payAmtMatch ? payAmtMatch[1] : "0.00";
      const payCur = payCurMatch
        ? String(payCurMatch[1]).toUpperCase()
        : currencyState.plan || "TWD";
      const dateText = String(
        card?.querySelector(".my-plans-detail-panel__activity-date")
          ?.textContent || "",
      ).trim();
      const timeText = String(
        card?.querySelector(".my-plans-detail-panel__activity-time")
          ?.textContent || "",
      )
        .replace(/^·\s*/, "")
        .trim();
      const timestamp =
        dateText && timeText ? `${dateText}, ${timeText}` : dateText || "--";
      const planIdText =
        String(
          detailPanel?.querySelector("[data-my-plans-detail-plan-id]")
            ?.textContent || "",
        ).trim() || "—";
      const orderId = (() => {
        const key = `${dateText}|${timeText}|${ticker}|${payAmt}|${payCur}`;
        let h = 0;
        for (let i = 0; i < key.length; i += 1)
          h = (h << 5) - h + key.charCodeAt(i);
        return String((Math.abs(h) % 9000000) + 1000000);
      })();
      const setText = (sel, val) => {
        const el = activityDetailPanel.querySelector(sel);
        if (el) el.textContent = val;
      };
      const getParentAverageBuyPrice = () => {
        const cards = Array.from(
          detailPanel?.querySelectorAll(".my-plans-detail-panel__asset-card") ||
            [],
        );
        const matchingCard = cards.find((assetCard) => {
          const tk = String(
            assetCard.querySelector(".my-plans-detail-panel__asset-ticker")
              ?.textContent || "",
          )
            .trim()
            .toUpperCase();
          return (
            tk ===
            String(ticker || "")
              .trim()
              .toUpperCase()
          );
        });
        if (!matchingCard) return "";
        const avgRow = Array.from(
          matchingCard.querySelectorAll(".my-plans-detail-panel__asset-row"),
        ).find((assetRow) => {
          const label = String(
            assetRow.querySelector("span")?.textContent || "",
          )
            .trim()
            .toLowerCase();
          return label === "average buy price";
        });
        return String(
          avgRow?.querySelector("strong")?.textContent || "",
        ).trim();
      };
      const parentAvgPrice = getParentAverageBuyPrice();
      const fallbackAvg = formatMoneyDisplayCurrency(
        getPrototypeAveragePrice(ticker, payCur),
        payCur,
      );
      const investedText = String(
        card?.querySelector(".my-plans-detail-panel__activity-invested-text")
          ?.textContent || "",
      )
        .trim()
        .toLowerCase();
      const isFailed = investedText.includes("failed");
      const detailStatusEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-status]",
      );
      if (detailStatusEl) {
        detailStatusEl.textContent = isFailed ? "Failed" : "Completed";
        detailStatusEl.classList.toggle(
          "my-plans-activity-detail-panel__meta-value--negative",
          isFailed,
        );
        detailStatusEl.classList.toggle(
          "my-plans-activity-detail-panel__meta-value--positive",
          !isFailed,
        );
      }
      const paidWithText =
        String(
          card?.querySelector(".my-plans-detail-panel__act-list-footer-text")
            ?.textContent || "",
        ).trim() || `Paid with ${payCur} balance`;
      const paidWithNormalized = paidWithText.replace(/^Paid with\s*/i, "");
      const allocationTickers = Array.from(
        detailPanel?.querySelectorAll(".plan-overview-panel__chip-ticker") || [],
      )
        .map((el) => String(el.textContent || "").trim().toUpperCase())
        .filter(Boolean);
      const viaTitle = allocationTickers.length
        ? allocationTickers.join(" · ")
        : String(
            detailPanel?.querySelector("[data-my-plans-detail-title]")
              ?.textContent || "",
          ).trim() || ticker;
      const fromIconEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-icon-from]",
      );
      if (fromIconEl)
        fromIconEl.setAttribute(
          "src",
          `assets/icon_currency_${String(payCur).toUpperCase()}.svg`,
        );
      const toIconEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-icon-to]",
      );
      const toIconSrc = String(
        row.querySelector(".my-plans-detail-panel__act-icon")?.getAttribute("src") ||
          "",
      );
      if (toIconEl && toIconSrc) toIconEl.setAttribute("src", toIconSrc);
      setText(
        "[data-my-plans-activity-detail-convert-pair]",
        `${payCur} → ${ticker}`,
      );
      setText("[data-my-plans-activity-detail-from]", `- ${payAmt} ${payCur}`);
      setText("[data-my-plans-activity-detail-to]", `+ ${gainNum} ${ticker}`);
      setText("[data-my-plans-activity-detail-avg-price]", parentAvgPrice || fallbackAvg);
      setText("[data-my-plans-activity-detail-start]", timestamp);
      setText("[data-my-plans-activity-detail-hero-date]", timestamp);
      setText("[data-my-plans-activity-detail-fee]", `0.000001 ${ticker}`);
      setText("[data-my-plans-activity-detail-order-id]", orderId);
      setText("[data-my-plans-activity-detail-plan-id]", planIdText);
      setText("[data-my-plans-activity-detail-paid-with]", paidWithNormalized);
    };

    const openActivityDetail = (row = null) => {
      if (!activityDetailPanel) return;
      const titleEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-title]",
      );
      if (titleEl) titleEl.textContent = "DCA order";
      const toLabelEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-to-label]",
      );
      if (toLabelEl) toLabelEl.textContent = "To";
      const heroDateEl = activityDetailPanel.querySelector(
        "[data-my-plans-activity-detail-hero-date]",
      );
      if (heroDateEl) heroDateEl.hidden = false;
      const metaList = activityDetailPanel.querySelector(
        ".my-plans-activity-detail-panel__meta-list",
      );
      Array.from(
        metaList?.querySelectorAll("[data-my-plans-activity-detail-row]") || [],
      ).forEach((rowEl) => {
        rowEl.hidden = false;
      });
      Array.from(
        metaList?.querySelectorAll(".my-plans-activity-detail-panel__divider") || [],
      ).forEach((divider) => {
        divider.hidden = false;
      });
      // Status + Date are not shown in detail rows (date is shown in hero). Fee is hidden.
      ["status", "date", "fee"].forEach((k) => {
        const rowEl = activityDetailPanel.querySelector(
          `[data-my-plans-activity-detail-row="${k}"]`,
        );
        if (rowEl) rowEl.hidden = true;
      });
      // Re-hide dividers that sit next to hidden rows.
      const rows = Array.from(
        metaList?.querySelectorAll("[data-my-plans-activity-detail-row]") || [],
      );
      const dividers = Array.from(
        metaList?.querySelectorAll(".my-plans-activity-detail-panel__divider") || [],
      );
      dividers.forEach((divider, idx) => {
        const prev = rows[idx];
        const next = rows[idx + 1];
        divider.hidden =
          !prev ||
          !next ||
          prev.hidden ||
          (next.hidden &&
            next.getAttribute("data-my-plans-activity-detail-row") !== "fee");
      });
      if (row) populateActivityDetailFromRow(row);
      activityDetailPanel.hidden = false;
      requestAnimationFrame(() => {
        activityDetailPanel.classList.add("is-open");
      });
    };

    detailPanel?.addEventListener("click", (e) => {
      const row = e.target.closest(".my-plans-detail-panel__act-row");
      if (!row || !detailPanel.contains(row)) return;
      openActivityDetail(row);
    });
    activityListContentEl?.addEventListener("click", (e) => {
      const row = e.target.closest(".my-plans-detail-panel__act-row");
      if (!row || !activityListContentEl.contains(row)) return;
      openActivityDetail(row);
    });

    detailPanel
      ?.querySelector(".my-plans-detail-panel__show-all")
      ?.addEventListener("click", () => {
        openActivityList();
      });

    activityListPanel
      ?.querySelector("[data-my-plans-activity-list-close]")
      ?.addEventListener("click", () => {
        closeActivityList(false);
      });

    activityDetailPanel
      ?.querySelector("[data-my-plans-activity-detail-close]")
      ?.addEventListener("click", () => {
        closeActivityDetail(false);
      });

    const resolveManagePlanRecord = (sourceEl) => {
      const recs = getMyPlansRecords();
      if (!recs.length) return null;
      const detailOpen =
        detailPanel &&
        !detailPanel.hidden &&
        detailPanel.classList.contains("is-open");
      if (detailOpen) {
        const id = String(
          detailPanel.getAttribute("data-my-plans-detail-plan-id") || "",
        ).trim();
        if (id) {
          const r = recs.find((x) => String(x.id) === id);
          if (r) return r;
        }
      }
      const card = sourceEl?.closest?.(".my-plans-position-card");
      if (card) {
        const id = String(
          card.getAttribute("data-my-plans-plan-id") || "",
        ).trim();
        if (id) {
          const r = recs.find((x) => String(x.id) === id);
          if (r) return r;
        }
      }
      return recs[0] || null;
    };

    const resolvePrefundLeftSubtitleText = (rec) => {
      if (!rec)
        return `0.00 ${String(currencyState.plan || "TWD")
          .trim()
          .toUpperCase()} left`;
      const investMatch = String(rec.investLine || "").match(
        /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
      );
      const per = investMatch
        ? parseFloat(String(investMatch[1]).replace(/,/g, ""))
        : NaN;
      const cur = investMatch
        ? String(investMatch[2] || "").toUpperCase()
        : String(currencyState.plan || "TWD")
            .trim()
            .toUpperCase();
      const fundingState = states.funding ?? 1;
      const isFundingPrefundLow = fundingState === 4;
      const isFundingPrefundEmpty = fundingState === 5;
      if (isFundingPrefundEmpty) return `0.00 ${cur} left`;
      if (isFundingPrefundLow) {
        const oneBuyAmount = Number.isFinite(per) && per > 0 ? per : 0;
        return `${oneBuyAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur} left`;
      }
      const parsedReserved = parseMoneyWithCurrency(
        String(rec.reservedFunds || ""),
      );
      const fallbackPrefundAmount =
        Number.isFinite(per) && per > 0 ? per * 4 : 0;
      const leftText =
        parsedReserved && parsedReserved.amount > 0
          ? `${parsedReserved.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${String(parsedReserved.currency || cur).toUpperCase()}`
          : `${fallbackPrefundAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
      return `${leftText} left`;
    };

    const syncManageSheetUi = (rec) => {
      if (!manageSheet || !rec) return;
      const statusKey =
        rec.status === "paused"
          ? "paused"
          : rec.status === "ended"
            ? "ended"
            : "active";
      const kickerEl = manageSheet.querySelector(
        "[data-my-plans-manage-kicker]",
      );
      const statusEl = manageSheet.querySelector(
        "[data-my-plans-manage-status]",
      );
      const pauseRow = manageSheet.querySelector(
        "[data-my-plans-manage-pause-row]",
      );
      const endRow = manageSheet.querySelector(
        "[data-my-plans-manage-end-row]",
      );
      const d0 = manageSheet.querySelector(
        '[data-my-plans-manage-divider="0"]',
      );
      const d1 = manageSheet.querySelector(
        '[data-my-plans-manage-divider="1"]',
      );
      const pauseIcon = manageSheet.querySelector(
        "[data-my-plans-manage-pause-icon]",
      );
      const pauseLabel = manageSheet.querySelector(
        "[data-my-plans-manage-pause-label]",
      );
      const pauseBtn = manageSheet.querySelector(
        "[data-my-plans-manage-pause-row]",
      );
      const planName = String(rec.kicker || rec.name || "Your plan").trim();

      manageSheet.setAttribute("data-plan-status", statusKey);
      if (kickerEl) kickerEl.textContent = planName;
      if (statusEl) {
        statusEl.textContent =
          statusKey === "paused"
            ? "Plan is paused"
            : statusKey === "ended"
              ? "Plan is ended"
              : "Plan is active";
      }

      if (statusKey === "ended") {
        if (pauseRow) pauseRow.hidden = true;
        if (endRow) endRow.hidden = true;
        if (d0) d0.hidden = true;
        if (d1) d1.hidden = true;
        return;
      }
      if (pauseRow) pauseRow.hidden = false;
      if (endRow) endRow.hidden = false;
      if (d0) d0.hidden = false;
      if (d1) d1.hidden = false;

      if (statusKey === "paused") {
        pauseBtn?.setAttribute("data-my-plans-manage-action", "resume");
        if (pauseIcon) pauseIcon.src = "assets/icon_play.svg";
        if (pauseLabel) pauseLabel.textContent = "Resume plan";
      } else {
        pauseBtn?.setAttribute("data-my-plans-manage-action", "pause");
        if (pauseIcon) pauseIcon.src = "assets/icon_pause.svg";
        if (pauseLabel) pauseLabel.textContent = "Pause plan";
      }

      const fundingState = states.funding ?? 1;
      const prefundRowBtn = manageSheet.querySelector(
        '[data-my-plans-manage-action="prefund"]',
      );
      const prefundNameEl = prefundRowBtn?.querySelector(
        ".currency-sheet__item-name",
      );
      const prefundDescEl = prefundRowBtn?.querySelector(
        ".currency-sheet__item-desc--manage-prefund",
      );
      const prefundLeftEl = prefundRowBtn?.querySelector(
        "[data-my-plans-manage-prefund-left]",
      );
      const prefundEditMode = fundingState >= 3;
      manageSheet.setAttribute(
        "data-my-plans-manage-prefund-mode",
        prefundEditMode ? "edit" : "prefund",
      );
      if (prefundNameEl) {
        prefundNameEl.textContent = prefundEditMode
          ? "Pre-funding settings"
          : "Pre-fund plan";
      }
      if (prefundDescEl) {
        prefundDescEl.hidden = prefundEditMode;
      }
      if (prefundLeftEl) {
        if (!prefundEditMode) {
          prefundLeftEl.hidden = true;
          manageSheet.removeAttribute(
            "data-my-plans-manage-prefund-left-value",
          );
        } else {
          const leftText = resolvePrefundLeftSubtitleText(rec);
          prefundLeftEl.textContent = leftText;
          prefundLeftEl.hidden = false;
          manageSheet.setAttribute(
            "data-my-plans-manage-prefund-left-value",
            leftText,
          );
        }
      }
    };

    refreshManageSheetIfOpen = () => {
      if (
        !manageSheet ||
        manageSheet.hidden ||
        !manageSheet.classList.contains("is-open")
      )
        return;
      const rec = resolveManagePlanRecord(manageSheet);
      if (rec) syncManageSheetUi(rec);
    };

    const closeManageSheet = (instant = false) => {
      if (!manageSheet) return;
      const panelEl = manageSheet.querySelector(".currency-sheet__panel");
      if (instant) {
        manageSheet.classList.remove("is-open");
        manageSheet.hidden = true;
        return;
      }
      manageSheet.classList.remove("is-open");
      if (!panelEl) {
        manageSheet.hidden = true;
        return;
      }
      const onEnd = () => {
        if (!manageSheet.classList.contains("is-open"))
          manageSheet.hidden = true;
        panelEl.removeEventListener("transitionend", onEnd);
      };
      panelEl.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const openFunding2FromMyPlans = (sourceEl) => {
      const rec = resolveManagePlanRecord(sourceEl);
      funding2ContextRecord = rec ? { ...rec } : null;
      if (rec) {
        const investLine = String(rec.investLine || "").trim();
        const perBuyMatch = investLine.match(
          /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
        );
        const amountInput = panel.querySelector(
          "[data-plan-detail-amount-input]",
        );
        const planCurEl = panel.querySelector("[data-plan-detail-currency]");
        const scheduleEl = panel.querySelector("[data-plan-detail-schedule]");
        if (perBuyMatch && amountInput) {
          const n = parseInt(
            String(perBuyMatch[1] || "").replace(/,/g, ""),
            10,
          );
          if (Number.isFinite(n) && n > 0) amountInput.value = String(n);
        }
        if (perBuyMatch && planCurEl) {
          planCurEl.textContent = String(perBuyMatch[2] || "").toUpperCase();
        }
        const repeats = String(rec.repeats || "").trim();
        if (repeats && repeats !== "—" && scheduleEl) {
          setPlanDetailScheduleElement(scheduleEl, repeats);
        }
      }
      closeManageSheet(true);
      goFinance();
      document.dispatchEvent(new CustomEvent("open-funding2-flow"));
      window.setTimeout(() => {
        closeMyPlans(true);
      }, 360);
    };

    const startRecreatePlanFlow = (sourceEl) => {
      const rec = resolveManagePlanRecord(sourceEl);
      if (rec) {
        recreatePlanPrefillRecord = {
          ...rec,
          assetMix: Array.isArray(rec.assetMix)
            ? rec.assetMix.map((m) => ({ ...m }))
            : [],
          assetIcons: Array.isArray(rec.assetIcons)
            ? rec.assetIcons.map((a) => ({ ...a }))
            : [],
        };
      }
      closeManageSheet(true);
      goFinance();
      skipPlanAmountAutofocusOnce = true;
      const planPanel = document.querySelector("[data-plan-detail-panel]");
      planPanel?.classList.add("plan-detail-panel--handoff-top");
      document.querySelector("[data-finance-new-plan]")?.click();
      window.setTimeout(() => {
        closeMyPlans(true);
        planPanel?.classList.remove("plan-detail-panel--handoff-top");
      }, 380);
    };

    const openManageSheet = (sourceEl) => {
      if (!manageSheet) return;
      const rec = resolveManagePlanRecord(sourceEl);
      const statusKey =
        rec?.status === "paused"
          ? "paused"
          : rec?.status === "ended"
            ? "ended"
            : "active";
      if (statusKey === "ended") return;
      syncManageSheetUi(rec);
      sheetOpenWithInstantBackdrop(manageSheet);
    };

    const manageConfirmSheets = {
      pause: document.querySelector(
        '[data-my-plans-manage-confirm-sheet="pause"]',
      ),
      resume: document.querySelector(
        '[data-my-plans-manage-confirm-sheet="resume"]',
      ),
      end: document.querySelector('[data-my-plans-manage-confirm-sheet="end"]'),
    };

    const closeManageConfirmSheet = (sheetEl, onDone, opts = {}) => {
      if (!sheetEl) {
        onDone?.();
        return;
      }
      const panelEl = sheetEl.querySelector(".currency-sheet__panel");
      if (!panelEl) {
        sheetEl.hidden = true;
        onDone?.();
        return;
      }
      const suppressNestedScrim = Boolean(opts.stackPopDismiss);
      sheetCloseWithBackdropHandoff(sheetEl, panelEl, onDone, {
        suppressNestedScrim,
      });
    };

    const setManageConfirmSheetContent = (sheetEl, action, rec) => {
      if (!sheetEl || !rec) return;
      const kickerEl = sheetEl.querySelector(
        "[data-my-plans-manage-confirm-kicker]",
      );
      const titleEl = sheetEl.querySelector(
        "[data-my-plans-manage-confirm-title]",
      );
      const descEl = sheetEl.querySelector(
        "[data-my-plans-manage-confirm-desc]",
      );
      const submitEl = sheetEl.querySelector(
        "[data-my-plans-manage-confirm-submit]",
      );
      const planName = String(rec.kicker || rec.name || "Your plan").trim();
      if (kickerEl) kickerEl.textContent = planName;
      const actionLabel =
        action === "resume" ? "Resume" : action === "end" ? "End" : "Pause";
      if (titleEl) titleEl.textContent = `${actionLabel} this plan?`;
      if (submitEl) submitEl.textContent = `${actionLabel} plan`;
      if (descEl) {
        if (action === "resume") {
          const nextBuy = shortenWeekdayLabel(
            rec.nextBuy || rec.firstBuy || FINANCE_SUMMARY_NEXT_BUY_FALLBACK,
          );
          descEl.textContent = `This will resume your automated buys: The next buy will be on ${nextBuy}.`;
        } else if (action === "end") {
          descEl.textContent =
            "Automated buys will stop. Pre-funded funds, if any, will be returned to your wallet. This plan cannot be resumed once ended.";
        } else {
          descEl.textContent =
            "Your automated buys will be put on hold. No new investments will be made until you resume.";
        }
      }
    };

    const openManageActionConfirmSheet = (action, sourceEl) => {
      const sheetEl = manageConfirmSheets[action];
      if (!sheetEl || !manageSheet) {
        closeManageSheet();
        return;
      }
      const rec = resolveManagePlanRecord(sourceEl);
      if (rec) setManageConfirmSheetContent(sheetEl, action, rec);
      const managePanelEl = manageSheet.querySelector(".currency-sheet__panel");
      if (getBottomSheetStacking()) {
        sheetOpenWithInstantBackdrop(sheetEl);
        return;
      }
      sheetCloseWithBackdropHandoff(manageSheet, managePanelEl, () => {
        sheetOpenWithInstantBackdrop(sheetEl);
      });
    };

    detailPanel
      ?.querySelector("[data-my-plans-detail-manage-trigger]")
      ?.addEventListener("click", (e) => {
        const rec = resolveManagePlanRecord(e.currentTarget);
        if (rec?.status === "ended") {
          startRecreatePlanFlow(e.currentTarget);
          return;
        }
        openManageSheet(e.currentTarget);
      });
    panel.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-plan-card-manage]");
      if (!trigger || !panel.contains(trigger)) return;
      openManageSheet(trigger);
    });
    panel.addEventListener("click", (e) => {
      const trigger = e.target.closest("[data-plan-card-recreate]");
      if (!trigger || !panel.contains(trigger)) return;
      startRecreatePlanFlow(trigger);
    });
    manageSheet
      ?.querySelectorAll("[data-my-plans-manage-sheet-close]")
      .forEach((btn) => {
        btn.addEventListener("click", closeManageSheet);
      });
    manageSheet
      ?.querySelectorAll("[data-my-plans-manage-action]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const action = btn.getAttribute("data-my-plans-manage-action");
          if (action === "prefund") {
            const fundingState = states.funding ?? 1;
            if (fundingState >= 3) {
              const editSheet = document.querySelector(
                "[data-my-plans-prefund-edit-sheet]",
              );
              const managePanelEl = manageSheet.querySelector(
                ".currency-sheet__panel",
              );
              if (!editSheet) {
                closeManageSheet();
                return;
              }
              document.dispatchEvent(
                new CustomEvent("my-plans-prefund-edit-sheet-sync-copy"),
              );
              if (getBottomSheetStacking()) {
                sheetOpenWithInstantBackdrop(editSheet);
                return;
              }
              sheetCloseWithBackdropHandoff(manageSheet, managePanelEl, () => {
                sheetOpenWithInstantBackdrop(editSheet);
              });
              return;
            }
            openFunding2FromMyPlans(btn);
            return;
          }
          if (action === "recreate") {
            startRecreatePlanFlow(btn);
            return;
          }
          if (action === "pause" || action === "resume" || action === "end") {
            openManageActionConfirmSheet(action, btn);
            return;
          }
          closeManageSheet();
        });
      });

    Object.entries(manageConfirmSheets).forEach(([action, sheetEl]) => {
      if (!sheetEl) return;
      sheetEl
        .querySelectorAll("[data-my-plans-manage-confirm-close]")
        .forEach((btn) => {
          btn.addEventListener("click", () => {
            if (getBottomSheetStacking()) {
              closeManageConfirmSheet(sheetEl, null, { stackPopDismiss: true });
              return;
            }
            closeManageConfirmSheet(sheetEl, () => {
              openManageSheet();
            });
          });
        });
      sheetEl
        .querySelector("[data-my-plans-manage-confirm-submit]")
        ?.addEventListener("click", () => {
          if (action === "pause") {
            setState("flow", 4, { force: true });
            showMyPlansSnackbar("Plan paused");
          } else if (action === "resume") {
            setState("flow", 3, { force: true });
            showMyPlansSnackbar("Plan resumed");
          } else if (action === "end") {
            setState("flow", 5, { force: true });
            showMyPlansSnackbar("Plan ended");
          }
          closeManageConfirmSheet(sheetEl, null, {
            stackPopDismiss: getBottomSheetStacking(),
          });
          if (getBottomSheetStacking()) {
            closeManageSheet();
          }
        });
      sheetEl.setAttribute("aria-label", `${action} plan`);
    });

    // Edit pre-funding → End pre-fund confirm (Figma 8992:143933); stacks like manage confirm sheets.
    const editPrefundSheet = document.querySelector(
      "[data-my-plans-prefund-edit-sheet]",
    );
    const endPrefundConfirmSheet = document.querySelector(
      "[data-my-plans-prefund-end-confirm-sheet]",
    );
    const editPrefundPanel = editPrefundSheet?.querySelector(
      ".currency-sheet__panel",
    );
    const endPrefundConfirmPanel = endPrefundConfirmSheet?.querySelector(
      ".currency-sheet__panel",
    );

    const openEndPrefundConfirmSheet = () => {
      if (
        !editPrefundSheet ||
        !endPrefundConfirmSheet ||
        !editPrefundPanel ||
        !endPrefundConfirmPanel
      )
        return;
      const cur = String(currencyState.plan || "TWD")
        .trim()
        .toUpperCase();
      const endTitleEl = endPrefundConfirmSheet.querySelector(
        "[data-my-plans-prefund-end-confirm-title]",
      );
      const endHighlightEl = endPrefundConfirmSheet.querySelector(
        "[data-my-plans-prefund-end-confirm-highlight]",
      );
      const endCopyEl = endPrefundConfirmSheet.querySelector(
        "[data-my-plans-prefund-end-confirm-copy-body]",
      );
      const endSubmitEl = endPrefundConfirmSheet.querySelector(
        "[data-my-plans-prefund-end-confirm-submit]",
      );
      if (endTitleEl) endTitleEl.textContent = `Return reserved ${cur}?`;
      if (endHighlightEl)
        endHighlightEl.textContent = `Your pre-funded ${cur} will be released back to your wallet, and auto-refill will stop.`;
      if (endCopyEl)
        endCopyEl.textContent = `This plan will resume deducting from your wallet's ${cur} balance on each scheduled DCA date.`;
      if (endSubmitEl) endSubmitEl.textContent = `Return reserved ${cur}`;
      if (getBottomSheetStacking()) {
        sheetOpenWithInstantBackdrop(endPrefundConfirmSheet);
        return;
      }
      sheetCloseWithBackdropHandoff(editPrefundSheet, editPrefundPanel, () => {
        sheetOpenWithInstantBackdrop(endPrefundConfirmSheet);
      });
    };

    const closeEndPrefundConfirmSheet = (onDone, opts = {}) => {
      if (!endPrefundConfirmSheet || !endPrefundConfirmPanel) {
        onDone?.();
        return;
      }
      const suppressNestedScrim = Boolean(opts.stackPopDismiss);
      sheetCloseWithBackdropHandoff(
        endPrefundConfirmSheet,
        endPrefundConfirmPanel,
        onDone,
        { suppressNestedScrim },
      );
    };

    /** Close end-prefund confirm + edit + manage sheets in one motion (parallel panel slides). */
    const closePrefundEndConfirmStackTogether = () => {
      const stack = [
        endPrefundConfirmSheet,
        editPrefundSheet,
        manageSheet,
      ].filter(Boolean);
      let anyClosing = false;
      stack.forEach((sheetEl) => {
        if (!sheetEl.classList.contains("is-open")) return;
        anyClosing = true;
        sheetEl.classList.remove(SHEET_BACKDROP_HANDOFF);
        sheetEl.classList.remove(SHEET_STACK_POP_DISMISS);
        sheetEl.classList.remove(SHEET_BACKDROP_INSTANT_IN);
        sheetEl.classList.remove("is-open");
      });
      const finalize = () => {
        stack.forEach((sheetEl) => {
          if (!sheetEl.classList.contains("is-open")) sheetEl.hidden = true;
        });
        resetScheduleNestedScrimHard();
      };
      if (!anyClosing) {
        finalize();
        return;
      }
      window.setTimeout(finalize, 300);
    };

    editPrefundSheet
      ?.querySelector('[data-my-plans-prefund-edit-action="end-return"]')
      ?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openEndPrefundConfirmSheet();
      });

    endPrefundConfirmSheet
      ?.querySelectorAll(
        "[data-my-plans-prefund-end-confirm-close], [data-my-plans-prefund-end-confirm-dismiss]",
      )
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (getBottomSheetStacking()) {
            closeEndPrefundConfirmSheet(null, { stackPopDismiss: true });
            return;
          }
          closeEndPrefundConfirmSheet(() => {
            sheetOpenWithInstantBackdrop(editPrefundSheet);
          });
        });
      });

    endPrefundConfirmSheet
      ?.querySelector("[data-my-plans-prefund-end-confirm-submit]")
      ?.addEventListener("click", () => {
        setState("funding", 1, { force: true });
        setPrototypePrefundLog("returned");
        showMyPlansSnackbar("Funds returned");
        closePrefundEndConfirmStackTogether();
      });

    const copyTextWithFallback = async (text) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } finally {
          document.body.removeChild(ta);
        }
      }
    };

    detailPanel
      ?.querySelector("[data-my-plans-detail-copy-id]")
      ?.addEventListener("click", async () => {
        const idEl = detailPanel.querySelector(
          "[data-my-plans-detail-plan-id]",
        );
        const text = String(idEl?.textContent || "").trim();
        if (!text) return;
        await copyTextWithFallback(text);
        showMyPlansCopySnackbar("Copied to clipboard");
      });

    Array.from(
      activityDetailPanel?.querySelectorAll(
        ".my-plans-activity-detail-panel__meta-value--inline-copy",
      ) || [],
    ).forEach((el) => {
      el.addEventListener("click", async () => {
        const valueEl = el.querySelector(
          "[data-my-plans-activity-detail-order-id], [data-my-plans-activity-detail-plan-id]",
        );
        const text = String(valueEl?.textContent || "").trim();
        if (!text) return;
        await copyTextWithFallback(text);
        showMyPlansCopySnackbar("Copied to clipboard");
      });
    });

    detailPanel
      ?.querySelector(".my-plans-detail-panel__prefund-chip")
      ?.addEventListener("click", () => {
        openFunding2FromMyPlans(detailPanel);
      });

    // Locale flips can leave count labels stale if no My-plans rerender occurs afterward.
    document.addEventListener("prototype-locale-changed", () => {
      syncMyPlansLabels();
      if (panel.classList.contains("is-open")) {
        renderMyPlansViews();
        setFilter(activeFilter || "active");
      }
    });

    const open = (openOpts = {}) => {
      backFromPlanSuccessView = !!openOpts.fromPlanSuccessView;
      closePlanDetail(true);
      syncMyPlansFromFlow();
      setFilter(activeFilter || "active");
      panel.hidden = false;
      if (container) {
        container.classList.remove("is-my-plans-open");
        container.classList.remove("is-my-plans-fading");
      }
      requestAnimationFrame(() => {
        panel.classList.add("is-open");
      });
      setTimeout(() => {
        if (container && panel.classList.contains("is-open")) {
          container.classList.add("is-my-plans-fading");
        }
      }, 80);
      setTimeout(() => {
        if (container && panel.classList.contains("is-open")) {
          container.classList.add("is-my-plans-open");
        }
      }, 350);
    };

    const closeMyPlans = (instant = false) => {
      if (instant) {
        const prevTransition = panel.style.transition;
        panel.style.transition = "none";
        closePlanDetail(true);
        panel.classList.remove("is-open");
        panel.hidden = true;
        void panel.offsetHeight;
        panel.style.transition = prevTransition;
        if (container) {
          container.classList.remove("is-my-plans-open");
          container.classList.remove("is-my-plans-fading");
        }
        return;
      }
      closePlanDetail(true);
      panel.classList.remove("is-open");
      if (container) {
        container.classList.add("is-my-plans-fading");
        container.classList.remove("is-my-plans-open");
        requestAnimationFrame(() => {
          container.classList.remove("is-my-plans-fading");
        });
      }
      const onEnd = () => {
        if (!panel.classList.contains("is-open")) panel.hidden = true;
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    panel
      .querySelector("[data-my-plans-close]")
      ?.addEventListener("click", () => {
        if (backFromPlanSuccessView) {
          backFromPlanSuccessView = false;
          goFinance();
          const dismiss = getDismissPlanDetail();
          if (typeof dismiss === "function") dismiss();
          closeMyPlans();
          return;
        }
        closeMyPlans();
      });

    // "+" button: go back to Finance and open "New plan".
    panel
      .querySelector("[data-my-plans-add]")
      ?.addEventListener("click", () => {
        goFinance();
        const planPanel = document.querySelector("[data-plan-detail-panel]");
        planPanel?.classList.add("plan-detail-panel--handoff-top");
        document.querySelector("[data-finance-new-plan]")?.click();
        window.setTimeout(() => {
          closeMyPlans(true);
          planPanel?.classList.remove("plan-detail-panel--handoff-top");
        }, 380);
      });

    document.querySelectorAll("[data-open-my-plans]").forEach((btn) => {
      btn.addEventListener("click", () => {
        goFinance();
        open();
      });
    });

    const openFirstDetail = () => {
      const list = getMyPlansRecords();
      const rec = list[0];
      if (!rec) {
        open();
        return;
      }
      open();
      openPlanDetail(rec);
    };

    syncMyPlansFromFlow();

    return {
      open,
      close: closeMyPlans,
      sync: syncMyPlansFromFlow,
      openFirstDetail,
    };
  };

  const myPlansPanelApi = initMyPlansPanel({
    goFinanceAutoInvest,
    getDismissPlanDetailStackInstant: () => dismissPlanDetailStackInstant,
  });

  const flow2HeroNextBtn = document.querySelector(
    ".finance-summary__next--flow-2-hero",
  );
  flow2HeroNextBtn?.addEventListener("click", () => {
    if ((states.flow ?? 1) < 2) return;
    goFinanceAutoInvest();
    myPlansPanelApi.openFirstDetail?.();
  });

  initLimitsPanel();
  initPrototypeVersionControls();
  initSettingsPage();
  initSupportGuidePage();
  initCommunityPage();
  initSectionTitleLinks();
  initHomeMarketsToday({
    marketsPageApi,
    setActiveTab: tabNavApi.setActiveTab,
  });

  /** Fictional % delta from plan-detail allocation sliders (prototype feel). */
  let detailPanelAllocPctTweakFn = null;
  let refreshPlanDetailAllocTweak = () => {};

  // ─── Plan Detail Panel ──────────────────────────────────────────────────────
  const initPlanDetailPanel = (opts = {}) => {
    const goFinanceAutoInvestFromSuccess =
      typeof opts.goFinanceAutoInvest === "function"
        ? opts.goFinanceAutoInvest
        : () => {};
    const openMyPlansAfterPlanFlow =
      typeof opts.openMyPlansAfterPlanFlow === "function"
        ? opts.openMyPlansAfterPlanFlow
        : () => {};
    const panel = document.querySelector("[data-plan-detail-panel]");
    const container = document.querySelector(".phone-container");
    if (!panel) return;

    /**
     * Compact plan amounts by currency: TWD uses 萬 (10k) / 億 (100m); others use K / M (thousand / million).
     * @param {number} n
     * @param {string} [curLabel]
     */
    const formatDetailFooterProfit = (n, curLabel) => {
      const abs = Math.abs(n);
      const round1 = (x) => {
        const r = Math.round(x * 10) / 10;
        return Number.isInteger(r) ? String(r) : r.toFixed(1);
      };
      const cur = String(curLabel || "")
        .trim()
        .toUpperCase();
      if (cur === "TWD") {
        if (abs < 10000) return abs.toLocaleString("en-US");
        if (abs < 100000000) return `${round1(abs / 10000)}萬`;
        return `${round1(abs / 100000000)}百萬`;
      }
      if (abs < 10000) return abs.toLocaleString("en-US");
      if (abs < 1000000) return `${round1(abs / 1000)}K`;
      return `${round1(abs / 1000000)}M`;
    };

    /** Invested line number chunk: TWD 萬/億 vs other K/M; plain `0` when zero. */
    const formatPlanDetailFooterMoney = (n, curLabel) => {
      const v = Math.max(0, Math.round(Number(n) || 0));
      if (v === 0) return "0";
      return formatDetailFooterProfit(v, curLabel);
    };

    /**
     * Simulated value amount only: `≈ 0`, `≈ 7,114` or `≈ 1.1萬` (TWD) vs `≈ 11.4k` (USDT etc.).
     */
    const formatPlanDetailFooterSimulatedValueAmount = (n, curLabel) => {
      const v = Math.max(0, Math.round(Number(n) || 0));
      if (v === 0) return "≈ 0";
      const abs = v;
      const round1 = (x) => {
        const r = Math.round(x * 10) / 10;
        return Number.isInteger(r) ? String(r) : r.toFixed(1);
      };
      const cur = String(curLabel || "")
        .trim()
        .toUpperCase();
      let numPart;
      if (cur === "TWD") {
        if (abs < 10000) numPart = abs.toLocaleString("en-US");
        else if (abs < 100000000) numPart = `${round1(abs / 10000)}萬`;
        else numPart = `${round1(abs / 100000000)}百萬`;
      } else if (abs < 10000) {
        numPart = abs.toLocaleString("en-US");
      } else if (abs < 1000000) {
        numPart = `${round1(abs / 1000)}k`;
      } else {
        numPart = `${round1(abs / 1000000)}M`;
      }
      return `≈ ${numPart}`;
    };

    const setPlanDetailFooterMetricsDimmed = (isDimmed) => {
      const metricsEl = panel.querySelector(
        ".plan-detail-panel__footer-metrics",
      );
      const alertEl = panel.querySelector(".plan-detail-panel__footer-alert");
      const investedEl = panel.querySelector(
        "[data-plan-detail-footer-invested-line]",
      );
      const valueAmtEl = panel.querySelector(
        "[data-plan-detail-footer-value-amount]",
      );
      const valueSufEl = panel.querySelector(
        "[data-plan-detail-footer-value-suffix]",
      );
      if (!metricsEl) return;
      metricsEl.classList.toggle(
        "plan-detail-panel__footer-metrics--dimmed",
        !!isDimmed,
      );
      if (alertEl) alertEl.hidden = !!isDimmed;
      if (investedEl) investedEl.hidden = !!isDimmed;
      if (valueSufEl) {
        valueSufEl.hidden = !!isDimmed;
        valueSufEl.setAttribute("aria-hidden", isDimmed ? "true" : "false");
        if (isDimmed) valueSufEl.textContent = "";
      }
      if (valueAmtEl) {
        valueAmtEl.classList.toggle(
          "plan-detail-panel__footer-value-amount--unavailable",
          !!isDimmed,
        );
        if (isDimmed) valueAmtEl.textContent = "- -";
      }
    };

    const setPlanDetailFooterSimulatedValueDisplay = (n, curLabel) => {
      const valueAmtEl = panel.querySelector(
        "[data-plan-detail-footer-value-amount]",
      );
      const valueSufEl = panel.querySelector(
        "[data-plan-detail-footer-value-suffix]",
      );
      const cur = String(curLabel || "TWD").trim();
      const simRange = String(rangeState?.plan || "5Y").toUpperCase();
      const simRangeLabel = ["1Y", "3Y", "5Y"].includes(simRange)
        ? simRange
        : "5Y";
      const v = Math.max(0, Math.round(Number(n) || 0));
      if (valueAmtEl) {
        valueAmtEl.textContent = formatPlanDetailFooterSimulatedValueAmount(
          n,
          cur,
        );
        valueAmtEl.classList.remove(
          "plan-detail-panel__footer-value-amount--unavailable",
        );
      }
      if (valueSufEl) {
        valueSufEl.textContent = ` ${cur} (simulated value)`;
        valueSufEl.hidden = false;
        valueSufEl.setAttribute("aria-hidden", "false");
      }
      setPlanDetailFooterMetricsDimmed(v === 0);
    };

    const hidePlanDetailFooterValueSuffix = () => {
      const valueSufEl = panel.querySelector(
        "[data-plan-detail-footer-value-suffix]",
      );
      if (valueSufEl) {
        valueSufEl.textContent = "";
        valueSufEl.hidden = true;
        valueSufEl.setAttribute("aria-hidden", "true");
      }
    };

    const setPlanDetailFooterMetricsMissing = (curLabel) => {
      const investedEl = panel.querySelector(
        "[data-plan-detail-footer-invested-line]",
      );
      const cur = String(curLabel || "TWD").trim();
      if (investedEl)
        investedEl.textContent = `${formatPlanDetailFooterMoney(0, cur)} ${cur} invested →`;
      setPlanDetailFooterSimulatedValueDisplay(0, cur);
    };

    const setPlanDetailFooterMetricsError = (curLabel) => {
      const investedEl = panel.querySelector(
        "[data-plan-detail-footer-invested-line]",
      );
      const valueAmtEl = panel.querySelector(
        "[data-plan-detail-footer-value-amount]",
      );
      const cur = String(curLabel || "TWD").trim();
      if (investedEl) investedEl.textContent = `${cur} invested →`;
      if (valueAmtEl) {
        valueAmtEl.textContent = "- -";
        valueAmtEl.classList.add(
          "plan-detail-panel__footer-value-amount--unavailable",
        );
      }
      hidePlanDetailFooterValueSuffix();
      setPlanDetailFooterMetricsDimmed(true);
    };

    const snapshotFooterAllocBases = () => {
      const gate = readPlanDetailFooterGateState();
      if (
        gate.noAssets ||
        gate.noAmount ||
        gate.shouldBlockOneBuyBalance ||
        gate.allocationOutOfBalance
      ) {
        return;
      }
      const footerEl = panel.querySelector("[data-plan-detail-footer]");
      const histPctEl = panel.querySelector(
        "[data-plan-detail-return-historic-pct]",
      );
      if (footerEl) {
        const sim = computePlanDetailPanelFooterSimRaw();
        if (sim) {
          const totalInvested = Math.round(
            Number.isFinite(sim.totalInvested) ? sim.totalInvested : 0,
          );
          const profit = Number.isFinite(sim.profit) ? sim.profit : 0;
          const pct = Number.isFinite(sim.returnPct) ? sim.returnPct : 0;
          footerEl.dataset.allocBaseTotal = String(totalInvested);
          footerEl.dataset.allocBaseProfit = String(profit);
          footerEl.dataset.allocBasePct = String(pct);
        }
      }
      if (histPctEl) {
        const rawH = parseFloat(
          String(histPctEl.textContent).replace(/[^0-9.\-]/g, ""),
        );
        if (isFinite(rawH)) histPctEl.dataset.allocBaseHistPct = String(rawH);
      }
    };

    const applyFooterAllocSliderTweak = () => {
      const footerEl = panel.querySelector("[data-plan-detail-footer]");
      const histPctEl = panel.querySelector(
        "[data-plan-detail-return-historic-pct]",
      );
      const autoHistPctEl = panel.querySelector(
        "[data-plan-detail-alloc-auto-historic-pct]",
      );
      const histToneRoot = panel.querySelector(
        "[data-plan-detail-historic-performance-tone]",
      );
      const historicInlineArrows = panel.querySelectorAll(
        ".plan-detail-panel__alloc-header-historic-inline .plan-return-metric__arrow--historic, " +
          ".plan-detail-panel__alloc-header-historic-inline .plan-detail-panel__return-arrow",
      );
      const historicToneArrows =
        histToneRoot?.querySelectorAll(
          ".plan-return-metric__arrow--historic, .plan-detail-panel__return-arrow",
        ) || [];
      const gate = readPlanDetailFooterGateState();
      const isPctAllocInvalid = !!gate.isPctAllocInvalid;

      const curLabel = String(
        panel.querySelector("[data-plan-detail-currency]")?.textContent ||
          currencyState.plan ||
          "TWD",
      ).trim();
      const restoreHistoricFromSim = () => {
        const sim = computePlanDetailPanelFooterSimTweaked();
        if (!sim || !Number.isFinite(sim.historicReturnPct)) return;
        const histVal = sim.historicReturnPct;
        const histText = `${histVal.toLocaleString("en-US", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}%`;
        if (histPctEl) {
          histPctEl.textContent = histText;
          histPctEl.dataset.allocBaseHistPct = String(histVal);
        }
        if (autoHistPctEl) autoHistPctEl.textContent = histText;
        if (histToneRoot) setReturnMetricTone(histToneRoot, histVal);
      };

      // Invalid % allocation: show historic as "- -" and hide arrows. Must run before basePct / tweak early-returns
      // (footer sync clears data-alloc-base-* and would otherwise skip this branch).
      if (isPctAllocInvalid) {
        if (footerEl) {
          footerEl.classList.remove(
            "plan-detail-panel__footer--state-missing",
            "plan-detail-panel__footer--state-error",
            "plan-detail-panel__footer--state-ok",
          );
          footerEl.classList.add("plan-detail-panel__footer--state-error");
          setPlanDetailFooterMetricsError(curLabel);
        }
        if (histPctEl) {
          histPctEl.textContent = "- -";
        }
        if (autoHistPctEl) {
          autoHistPctEl.textContent = "- -";
        }
        if (histToneRoot) {
          histToneRoot.classList.remove("plan-return-metric__group--loss");
        }
        [...historicInlineArrows, ...historicToneArrows].forEach((arrow) => {
          arrow.hidden = true;
          arrow.style.display = "none";
        });
        return;
      }

      if (!footerEl || typeof detailPanelAllocPctTweakFn !== "function") {
        restoreHistoricFromSim();
        return;
      }
      const basePct = parseFloat(footerEl.dataset.allocBasePct || "");
      if (!isFinite(basePct)) {
        restoreHistoricFromSim();
        return;
      }
      const tw = detailPanelAllocPctTweakFn();
      if (!isFinite(tw)) {
        restoreHistoricFromSim();
        return;
      }

      [...historicInlineArrows, ...historicToneArrows].forEach((arrow) => {
        arrow.hidden = false;
        arrow.style.display = "";
      });
      const amountInp = panel.querySelector("[data-plan-detail-amount-input]");
      const investAmt = Math.max(
        0,
        parseInt(amountInp?.value?.replace(/[^0-9]/g, "") || "0", 10) || 0,
      );
      const appliedTwSim = investAmt > 0 ? tw : 0;
      const nextPct = basePct + appliedTwSim;

      const baseTotal = parseFloat(footerEl.dataset.allocBaseTotal || "");
      const baseProfit = parseFloat(footerEl.dataset.allocBaseProfit || "");
      if (isFinite(baseTotal) && isFinite(baseProfit)) {
        let nextProfit;
        if (Math.abs(basePct) <= 1e-6) {
          nextProfit = 0;
        } else {
          nextProfit = baseProfit * (nextPct / basePct);
        }
        const nextValue = Math.round(baseTotal + nextProfit);
        setPlanDetailFooterSimulatedValueDisplay(nextValue, curLabel);
      }

      if (histPctEl) {
        const baseHist = parseFloat(histPctEl.dataset.allocBaseHistPct || "");
        if (isFinite(baseHist)) {
          const nextHist = baseHist + tw;
          const histText = `${nextHist.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
          histPctEl.textContent = histText;
          if (autoHistPctEl) autoHistPctEl.textContent = histText;
          if (histToneRoot) setReturnMetricTone(histToneRoot, nextHist);
        }
      }
    };

    refreshPlanDetailAllocTweak = () => {
      if (panel.classList.contains("is-open")) applyFooterAllocSliderTweak();
    };

    /** @type {{ source: 'plan' | 'curated' | 'spotlight' | 'newplan', curatedKey?: string, spotlightKey?: string, card?: Element }} */
    let panelOpenContext = { source: "plan" };
    let customPlanTitle = "";

    const openBtn = document.querySelector(".plan-strategy__cta");
    const newPlanBtn = document.querySelector(".finance-summary__btn--primary");
    const closeButtons = panel.querySelectorAll("[data-plan-detail-close]");
    const scroller = panel.querySelector("[data-plan-detail-scroller]");
    /** Scroll plan-detail scroller so `el` sits near the top (with optional padding). */
    const scrollPlanDetailContentTo = (el, topOffsetPx = 0) => {
      if (!scroller || !el) return;
      const sr = scroller.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      const nextTop = scroller.scrollTop + (er.top - sr.top) - topOffsetPx;
      scroller.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
    };
    const productArea = panel.querySelector("[data-plan-detail-product-area]");
    const header = panel.querySelector("[data-plan-detail-header]");
    const pageTitle = panel.querySelector("[data-plan-detail-page-title]");
    const nameEditBtn = panel.querySelector("[data-plan-detail-name-edit-btn]");
    const nameEditIcon = panel.querySelector(
      "[data-plan-detail-name-edit-icon]",
    );
    const nameInput = panel.querySelector("[data-plan-detail-name-input]");
    const nameSpan = panel.querySelector("[data-plan-detail-name]");
    let snackbarTimer = null;
    let snackbarEl = null;
    let funding2PanelEl = null;
    let funding2ContextRecord = null;
    let funding2PrefundSuccessLoaderGen = 0;
    const FUNDING2_PREFUND_SUCCESS_LOADER_MS = 1400;
    const funding2ExitSheet = document.querySelector(
      "[data-funding2-exit-sheet]",
    );
    const funding2ExitSheetPanel = funding2ExitSheet?.querySelector(
      ".currency-sheet__panel",
    );
    const funding2PreviewSheet = document.querySelector(
      "[data-funding2-preview-sheet]",
    );
    const funding2PreviewSheetPanel = funding2PreviewSheet?.querySelector(
      ".currency-sheet__panel",
    );

    let funding2PreviewSheetApi = {
      openOverview: () => {},
      openLearnMorePreview: () => {},
    };
    let funding2PreviewSheetBound = false;
    let funding2PreviewReturnAfterLearnMore = false;

    const closeFunding2PreviewSheet = () => {
      if (!funding2PreviewSheet || !funding2PreviewSheetPanel) return;
      funding2PreviewSheet.classList.remove("is-open");
      const onEnd = () => {
        if (!funding2PreviewSheet.classList.contains("is-open"))
          funding2PreviewSheet.hidden = true;
        funding2PreviewSheetPanel.removeEventListener("transitionend", onEnd);
      };
      funding2PreviewSheetPanel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const bindFunding2PreviewSheetOnce = () => {
      if (funding2PreviewSheetBound || !funding2PreviewSheet) return;
      funding2PreviewSheetBound = true;
      const onClose = () => closeFunding2PreviewSheet();
      funding2PreviewSheet
        .querySelectorAll("[data-funding2-preview-close]")
        .forEach((b) => {
          b.addEventListener("click", onClose);
        });
      funding2PreviewSheet
        .querySelector("[data-funding2-preview-back]")
        ?.addEventListener("click", onClose);
      funding2PreviewSheet
        .querySelector("[data-funding2-preview-continue]")
        ?.addEventListener("click", () => {
          funding2PreviewSheetApi.openOverview();
        });
      funding2PreviewSheet
        .querySelector("[data-funding2-preview-how]")
        ?.addEventListener("click", () => {
          funding2PreviewSheetApi.openLearnMorePreview();
        });
    };

    const closeFunding2ExitSheet = () => {
      if (!funding2ExitSheet || !funding2ExitSheetPanel) return;
      funding2ExitSheet.classList.remove("is-open");
      const onEnd = () => {
        if (!funding2ExitSheet.classList.contains("is-open"))
          funding2ExitSheet.hidden = true;
        funding2ExitSheetPanel.removeEventListener("transitionend", onEnd);
      };
      funding2ExitSheetPanel.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 290);
    };

    const openFunding2ExitSheet = () => {
      if (!funding2ExitSheet) return;
      sheetOpenWithInstantBackdrop(funding2ExitSheet);
    };

    const resetFinanceAutoInvestScrollInstant = () => {
      const contentEl = document.querySelector("[data-content]");
      if (contentEl) {
        const prevBehavior = contentEl.style.scrollBehavior;
        contentEl.style.scrollBehavior = "auto";
        contentEl.scrollTop = 0;
        contentEl.style.scrollBehavior = prevBehavior;
      }
      const autoPageEl = document.querySelector('[data-finance-page="auto"]');
      if (autoPageEl && "scrollTop" in autoPageEl) {
        autoPageEl.scrollTop = 0;
      }
    };

    const closeFunding2Panel = (opts = {}) => {
      const shouldResetFinanceScroll = !!opts.resetFinanceScroll;
      funding2PreviewReturnAfterLearnMore = false;
      if (shouldResetFinanceScroll) {
        // Reset before unmasking Finance so users never see a scroll jump.
        resetFinanceAutoInvestScrollInstant();
      }
      closeFunding2PreviewSheet();
      const clone = funding2PanelEl;
      if (!clone) return;
      funding2PrefundSuccessLoaderGen += 1;
      const funding2Loader = clone.querySelector(
        "[data-funding2-submit-loader]",
      );
      if (funding2Loader) funding2Loader.hidden = true;
      // Collapse stacked inner steps without sliding each one (avoids multi-layer glitch).
      clone.classList.add("plan-buffer-funding2--instant-inner-close");
      void clone.offsetWidth;
      const confirmStep = clone.querySelector("[data-funding2-confirm-step]");
      if (confirmStep) {
        confirmStep.hidden = true;
        confirmStep.classList.remove("is-open");
      }
      const overviewStep = clone.querySelector("[data-funding2-overview-step]");
      if (overviewStep) {
        overviewStep.hidden = true;
        overviewStep.classList.remove("is-open");
      }
      const successStep = clone.querySelector("[data-funding2-success-step]");
      if (successStep) {
        successStep.hidden = true;
        successStep.classList.remove("is-open");
      }
      const learnMorePanel = clone.querySelector(
        "[data-plan-buffer-learn-more-panel]",
      );
      if (learnMorePanel) {
        learnMorePanel.classList.remove("is-open");
        learnMorePanel.hidden = true;
      }
      clone.classList.remove("plan-buffer-funding2--instant-inner-close");
      clone.classList.remove("is-open");
      const onEnd = () => {
        if (!clone.classList.contains("is-open")) clone.hidden = true;
        clone.removeEventListener("transitionend", onEnd);
      };
      clone.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    funding2ExitSheet
      ?.querySelectorAll("[data-funding2-exit-close]")
      .forEach((btn) => {
        btn.addEventListener("click", closeFunding2ExitSheet);
      });
    funding2ExitSheet
      ?.querySelector("[data-funding2-exit-confirm]")
      ?.addEventListener("click", () => {
        closeFunding2ExitSheet();
        closeFunding2Panel({ resetFinanceScroll: true });
      });

    const ensureFunding2Panel = () => {
      if (funding2PanelEl && funding2PanelEl.isConnected) {
        const structureVersion = funding2PanelEl.getAttribute(
          "data-funding2-structure",
        );
        if (structureVersion === "v8") return funding2PanelEl;
        funding2PanelEl.remove();
        funding2PanelEl = null;
      }
      const baseFundingPanel = panel.querySelector("[data-plan-buffer-panel]");
      if (!baseFundingPanel || !container) return null;
      const clone = baseFundingPanel.cloneNode(true);
      clone.removeAttribute("data-plan-buffer-panel");
      clone.setAttribute("data-plan-buffer-panel-2", "true");
      clone.setAttribute("data-funding2-structure", "v8");
      clone.classList.add("plan-buffer-panel--funding2");
      clone.classList.remove("is-open");
      clone.hidden = true;
      const titleEl = clone.querySelector(".plan-buffer-panel__title");
      if (titleEl) titleEl.textContent = "Pre-fund";
      const headerCloseBtn = clone.querySelector("[data-plan-buffer-back]");
      if (headerCloseBtn) {
        headerCloseBtn.setAttribute("data-plan-buffer2-exit-open", "true");
        headerCloseBtn.setAttribute("aria-label", "Back");
        const icon = headerCloseBtn.querySelector("img");
        if (icon) icon.setAttribute("src", "assets/icon_back.svg");
      }
      const headerSpacer = clone.querySelector(
        ".plan-buffer-panel__header .plan-buffer-panel__header-spacer",
      );
      if (headerSpacer && !clone.querySelector("[data-funding2-header-help]")) {
        const helpBtn = document.createElement("button");
        helpBtn.type = "button";
        helpBtn.className =
          "my-plans-detail-panel__icon-btn my-plans-detail-panel__icon-btn--right";
        helpBtn.setAttribute("data-funding2-header-help", "true");
        helpBtn.setAttribute("aria-label", "Support");
        helpBtn.innerHTML =
          '<img src="assets/icon_intercom.svg" alt="" width="24" height="24" />';
        headerSpacer.replaceWith(helpBtn);
      }
      const bottomBackBtn = clone.querySelector(
        "[data-plan-buffer-back-bottom]",
      );
      if (bottomBackBtn) {
        bottomBackBtn.setAttribute("data-plan-buffer2-close", "true");
        bottomBackBtn.hidden = true;
        bottomBackBtn.style.display = "none";
      }
      container.appendChild(clone);
      clone
        .querySelector("[data-plan-buffer2-exit-open]")
        ?.addEventListener("click", openFunding2ExitSheet);
      // Funding2 is standalone now, so wire all clone top-up triggers explicitly.
      clone
        .querySelectorAll("[data-plan-detail-topup-trigger]")
        .forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            baseFundingPanel
              .querySelector("[data-plan-detail-topup-trigger]")
              ?.click();
          });
        });

      const scrollerEl = clone.querySelector(".plan-buffer-panel__scroller");
      scrollerEl?.querySelector("[data-funding2-explained-wrap]")?.remove();
      scrollerEl?.querySelector("[data-funding2-seg-row]")?.remove();
      const heroSeg = clone.querySelector(
        ".plan-buffer-funding-seg.plan-buffer-funding-seg--hero",
      );
      const fundingHero = clone.querySelector(".plan-buffer-funding-hero");
      const heroTop = clone.querySelector(".plan-buffer-funding-hero__top");
      const heroSub = clone.querySelector(".plan-buffer-funding-hero__sub");
      if (fundingHero && heroTop && heroSub) {
        const explainedWrap = document.createElement("div");
        explainedWrap.className = "plan-buffer-funding2-hero-explained";
        explainedWrap.setAttribute("data-funding2-explained-wrap", "true");
        explainedWrap.innerHTML =
          '<button type="button" class="plan-buffer-funding2-explained-link" data-funding2-explained><img class="plan-buffer-funding2-explained-link__icon" src="assets/icon_guide_blue.svg" width="20" height="20" alt="" aria-hidden="true" /><span>Guide</span></button>';
        if (scrollerEl && heroSeg) {
          const segRow = document.createElement("div");
          segRow.className = "plan-buffer-funding2-seg-row";
          segRow.setAttribute("data-funding2-seg-row", "true");
          heroSeg.replaceWith(segRow);
          segRow.appendChild(heroSeg);
          segRow.appendChild(explainedWrap);
        }
        const head = document.createElement("div");
        head.className = "plan-buffer-funding2-hero-head";
        heroTop.replaceWith(head);
        head.appendChild(heroTop);
        head.appendChild(heroSub);
      }
      const funding2ExplainedBtn = clone.querySelector(
        "[data-funding2-explained]",
      );
      const learnMorePanel = clone.querySelector(
        "[data-plan-buffer-learn-more-panel]",
      );
      const learnMoreHeaderEl = learnMorePanel?.querySelector(
        ".plan-buffer-learn-more-panel__header",
      );
      const learnMoreTitleEl = learnMorePanel?.querySelector(
        ".plan-buffer-learn-more-panel__title",
      );
      const learnMoreDescEl = learnMorePanel?.querySelector(
        ".plan-buffer-learn-more-panel__desc",
      );
      const learnMoreVisualEl = learnMorePanel?.querySelector(
        ".plan-buffer-learn-more-panel__visual",
      );
      const learnMoreHeaderMiddle = learnMorePanel?.querySelector(
        ".plan-buffer-learn-more-panel__header-middle",
      );
      const learnMoreFooterEl = learnMorePanel?.querySelector(
        ".plan-buffer-learn-more-panel__footer",
      );
      const learnMoreCloseBtn = learnMorePanel?.querySelector(
        "[data-plan-buffer-learn-more-close]",
      );
      const funding2LearnMoreSlides = [
        {
          title: "How pre-funding works",
          desc: "Pre-funding your plan means you are reserving funds in advance so your scheduled investments always go through. No delays, no interruptions.",
          visual: "assets/fundingimage_1.png",
        },
        {
          title: "How auto-refill works",
          desc: "When your reserved funds run out, auto-refill automatically tops them back up, so your plan keeps investing on schedule, completely hands-free.",
          visual: "assets/fundingimage_2.png",
        },
      ];
      let funding2LearnMoreStep = 0;
      if (learnMoreCloseBtn) {
        learnMoreCloseBtn.classList.add(
          "finance-intro-learn-more-panel__close",
        );
      }
      if (learnMoreHeaderEl) {
        learnMoreHeaderEl.classList.add(
          "finance-intro-learn-more-panel__header",
        );
      }
      if (
        learnMoreHeaderEl &&
        !learnMoreHeaderEl.querySelector("[data-funding2-learn-more-help]")
      ) {
        const spacer = learnMoreHeaderEl.querySelector(
          ".plan-buffer-panel__header-spacer",
        );
        const helpBtn = document.createElement("button");
        helpBtn.type = "button";
        helpBtn.className = "finance-intro-learn-more-panel__help";
        helpBtn.setAttribute("data-funding2-learn-more-help", "true");
        helpBtn.setAttribute("aria-label", "Help");
        helpBtn.innerHTML =
          '<img src="assets/icon_intercom.svg" alt="" width="24" height="24" />';
        if (spacer) spacer.replaceWith(helpBtn);
        else learnMoreHeaderEl.appendChild(helpBtn);
      }
      if (
        learnMoreHeaderMiddle &&
        !learnMoreHeaderMiddle.querySelector(
          "[data-funding2-learn-more-stepper]",
        )
      ) {
        learnMoreHeaderMiddle.innerHTML = `
          <div class="finance-intro-learn-more-panel__stepper" data-funding2-learn-more-stepper aria-hidden="true">
            <span class="finance-intro-learn-more-panel__step is-active" data-funding2-learn-more-step="0"></span>
            <span class="finance-intro-learn-more-panel__step" data-funding2-learn-more-step="1"></span>
          </div>
        `;
      }
      if (
        learnMoreFooterEl &&
        !learnMoreFooterEl.querySelector("[data-funding2-learn-more-next]")
      ) {
        learnMoreFooterEl.classList.remove("plan-buffer-panel__footer--single");
        learnMoreFooterEl.innerHTML = `
          <button class="plan-buffer-panel__btn plan-buffer-panel__btn--secondary" type="button" data-funding2-learn-more-back>Back</button>
          <button class="plan-buffer-panel__btn plan-buffer-panel__btn--primary" type="button" data-funding2-learn-more-next>Next</button>
        `;
      }
      const funding2LearnMoreStepEls = Array.from(
        learnMorePanel?.querySelectorAll("[data-funding2-learn-more-step]") ||
          [],
      );
      const funding2LearnMoreBackBtn = learnMorePanel?.querySelector(
        "[data-funding2-learn-more-back]",
      );
      const funding2LearnMoreNextBtn = learnMorePanel?.querySelector(
        "[data-funding2-learn-more-next]",
      );
      if (
        learnMoreVisualEl &&
        !learnMoreVisualEl.querySelector("[data-funding2-learn-more-visual]")
      ) {
        const visualImg = document.createElement("img");
        visualImg.className = "plan-buffer-learn-more-panel__visual-img";
        visualImg.setAttribute("data-funding2-learn-more-visual", "true");
        visualImg.setAttribute("alt", "");
        learnMoreVisualEl.innerHTML = "";
        learnMoreVisualEl.appendChild(visualImg);
      }
      const funding2LearnMoreVisualEl = learnMorePanel?.querySelector(
        "[data-funding2-learn-more-visual]",
      );
      const renderFunding2LearnMore = () => {
        const safe = Math.max(
          0,
          Math.min(funding2LearnMoreSlides.length - 1, funding2LearnMoreStep),
        );
        funding2LearnMoreStep = safe;
        const slide = funding2LearnMoreSlides[safe];
        if (learnMoreTitleEl) learnMoreTitleEl.textContent = slide.title;
        if (learnMoreDescEl) learnMoreDescEl.textContent = slide.desc;
        if (learnMoreVisualEl) learnMoreVisualEl.hidden = !slide.visual;
        if (funding2LearnMoreVisualEl && slide.visual) {
          funding2LearnMoreVisualEl.setAttribute("src", slide.visual);
        }
        funding2LearnMoreStepEls.forEach((el, idx) =>
          el.classList.toggle("is-active", idx === safe),
        );
        if (funding2LearnMoreBackBtn) {
          funding2LearnMoreBackBtn.hidden = false;
          funding2LearnMoreBackBtn.textContent = safe === 0 ? "Cancel" : "Back";
        }
        if (funding2LearnMoreNextBtn) {
          funding2LearnMoreNextBtn.textContent =
            safe >= funding2LearnMoreSlides.length - 1 ? "Done" : "Next";
          funding2LearnMoreNextBtn.classList.remove(
            "plan-buffer-funding2-learn-more-next--full",
          );
        }
      };
      const openFunding2LearnMore = (initialStep = 0) => {
        if (!learnMorePanel) return;
        const nextStep = Number.isFinite(Number(initialStep))
          ? Math.floor(Number(initialStep))
          : 0;
        funding2LearnMoreStep = Math.max(
          0,
          Math.min(funding2LearnMoreSlides.length - 1, nextStep),
        );
        renderFunding2LearnMore();
        learnMorePanel.hidden = false;
        requestAnimationFrame(() => learnMorePanel.classList.add("is-open"));
      };
      const closeFunding2LearnMore = (opts = {}) => {
        if (!learnMorePanel) return;
        const shouldRestorePreview = funding2PreviewReturnAfterLearnMore;
        funding2PreviewReturnAfterLearnMore = false;
        if (opts.instant) {
          learnMorePanel.classList.remove("is-open");
          learnMorePanel.hidden = true;
          if (shouldRestorePreview)
            requestAnimationFrame(() => openFunding2PreviewSheet());
          return;
        }
        learnMorePanel.classList.remove("is-open");
        const onEnd = () => {
          if (!learnMorePanel.classList.contains("is-open"))
            learnMorePanel.hidden = true;
          learnMorePanel.removeEventListener("transitionend", onEnd);
          if (shouldRestorePreview)
            requestAnimationFrame(() => openFunding2PreviewSheet());
        };
        learnMorePanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };
      funding2ExplainedBtn?.addEventListener("click", () =>
        openFunding2LearnMore(0),
      );
      clone
        .querySelector("[data-plan-buffer-period-how-it-works]")
        ?.addEventListener("click", (e) => {
          e.preventDefault();
          openFunding2LearnMore(0);
        });
      funding2LearnMoreBackBtn?.addEventListener("click", () => {
        if (funding2LearnMoreStep <= 0) {
          closeFunding2LearnMore();
          return;
        }
        funding2LearnMoreStep -= 1;
        renderFunding2LearnMore();
      });
      funding2LearnMoreNextBtn?.addEventListener("click", () => {
        if (funding2LearnMoreStep >= funding2LearnMoreSlides.length - 1) {
          closeFunding2LearnMore();
          return;
        }
        funding2LearnMoreStep += 1;
        renderFunding2LearnMore();
      });
      learnMorePanel
        ?.querySelectorAll("[data-plan-buffer-learn-more-close]")
        .forEach((btn) =>
          btn.addEventListener("click", () => closeFunding2LearnMore()),
        );
      const parseMoneyText = (text) => {
        const m = String(text || "").match(
          /(-?\d[\d,]*(?:\.\d+)?)\s*([A-Za-z]{3,5})/i,
        );
        if (!m) return null;
        const amount = parseFloat(String(m[1] || "").replace(/,/g, ""));
        const currency = String(m[2] || "").toUpperCase();
        if (!Number.isFinite(amount) || !currency) return null;
        return { amount, currency };
      };

      const getFunding2PerBuy = (curFallback) => {
        const activePlanCur = String(currencyState.plan || curFallback || "TWD")
          .trim()
          .toUpperCase();
        const fromPlan = parseMoneyText(
          funding2ContextRecord?.investLine || "",
        );
        if (
          fromPlan &&
          fromPlan.amount > 0 &&
          String(fromPlan.currency || "").toUpperCase() === activePlanCur
        ) {
          return fromPlan;
        }
        const detailAmountRaw = String(
          panel.querySelector("[data-plan-detail-amount-input]")?.value || "",
        ).replace(/[^0-9]/g, "");
        const detailAmount = parseInt(detailAmountRaw, 10);
        const detailCur = String(
          panel.querySelector("[data-plan-detail-currency]")?.textContent ||
            currencyState.plan ||
            curFallback ||
            "TWD",
        )
          .trim()
          .toUpperCase();
        if (Number.isFinite(detailAmount) && detailAmount > 0) {
          return { amount: detailAmount, currency: detailCur };
        }
        const sliderAmount = parseInt(
          String(
            panel
              .querySelector("[data-plan-slider]")
              ?.getAttribute("aria-valuenow") || "",
          ).replace(/[^0-9]/g, ""),
          10,
        );
        if (Number.isFinite(sliderAmount) && sliderAmount > 0) {
          return { amount: sliderAmount, currency: detailCur };
        }
        const perBuySub =
          clone.querySelector("[data-plan-buffer-perbuy-sub]")?.textContent ||
          "";
        const fromSub = parseMoneyText(perBuySub);
        if (fromSub && fromSub.amount > 0) return fromSub;
        const safeFallbackAmount = detailCur === "USDT" ? 300 : 10000;
        return {
          amount: safeFallbackAmount,
          currency: detailCur || String(curFallback || "TWD").toUpperCase(),
        };
      };

      const ensureFunding2Meta = () => {
        let meta = clone.querySelector("[data-funding2-meta]");
        if (meta) return meta;
        const stack = clone.querySelector(".plan-buffer-funding-stack");
        if (!stack || !stack.parentElement) return null;
        meta = document.createElement("div");
        meta.className = "plan-buffer-funding2-meta";
        meta.setAttribute("data-funding2-meta", "true");
        meta.innerHTML = `
          <div class="plan-buffer-funding2-meta__row">
            <span class="plan-buffer-funding2-meta__label">Period covered</span>
            <span class="plan-buffer-funding2-meta__value" data-funding2-meta-period>—</span>
          </div>
          <div class="plan-buffer-funding2-meta__row">
            <span class="plan-buffer-funding2-meta__label">Covers until</span>
            <span class="plan-buffer-funding2-meta__value" data-funding2-meta-until>—</span>
          </div>
          <div class="plan-buffer-funding2-meta__row">
            <span class="plan-buffer-funding2-meta__label">You will pre-fund</span>
            <span class="plan-buffer-funding2-meta__value" data-funding2-meta-amount>—</span>
          </div>
        `;
        stack.parentElement.appendChild(meta);
        return meta;
      };

      const ensureFunding2Options = () => {
        let wrap = clone.querySelector("[data-funding2-options]");
        if (wrap) return wrap;
        const stack = clone.querySelector(".plan-buffer-funding-stack");
        if (!stack || !stack.parentElement) return null;
        wrap = document.createElement("div");
        wrap.className = "plan-buffer-funding2-options";
        wrap.setAttribute("data-funding2-options", "true");
        wrap.hidden = true;
        wrap.innerHTML = `
          <p class="plan-buffer-funding2-options__title">Select nearest option</p>
          <div class="plan-buffer-funding2-options__list" data-funding2-options-list></div>
        `;
        stack.parentElement.appendChild(wrap);
        return wrap;
      };

      let funding2SelectedAmount = null;
      let funding2OptionBaseAmount = null;
      /** Period-tab integer count (schedule units) for Funding2 clone. */
      let funding2PeriodCount = 0;
      const formatWithCommas = (n) => Number(n).toLocaleString("en-US");
      const resolveFunding2Numbers = () => {
        const perBuyData = getFunding2PerBuy(currencyState.plan || "TWD");
        const reserveCur = String(perBuyData.currency || "TWD")
          .trim()
          .toUpperCase();
        const availBalance = Number(BALANCES[reserveCur] ?? BALANCES.TWD ?? 0);
        return { perBuyData, reserveCur, availBalance };
      };
      const getFunding2StaticAmountCap = (
        currencyCode,
        fallbackBalance = 0,
      ) => {
        const code = String(currencyCode || "")
          .trim()
          .toUpperCase();
        if (code === "USDT") return 100000;
        if (code === "TWD") return 3000000;
        return Math.max(0, Math.floor(fallbackBalance));
      };
      const getFunding2StaticMaxPeriod = (
        currencyCode,
        perBuyAmount,
        fallbackBalance = 0,
      ) => {
        const perBuy = Number.isFinite(perBuyAmount)
          ? Math.max(0, Math.round(perBuyAmount))
          : 0;
        if (perBuy <= 0) return 0;
        return Math.floor(
          getFunding2StaticAmountCap(currencyCode, fallbackBalance) / perBuy,
        );
      };
      const applyFunding2Amount = (nextAmount) => {
        const reserveInput = clone.querySelector(
          "[data-plan-buffer-reserve-input]",
        );
        if (!(reserveInput instanceof HTMLInputElement)) return;
        const n = Number.isFinite(Number(nextAmount))
          ? Math.max(0, Math.floor(Number(nextAmount)))
          : 0;
        funding2SelectedAmount = n > 0 ? n : null;
        reserveInput.value = n > 0 ? formatWithCommas(n) : "";
      };

      const resolveFunding2FreqKey = () => {
        const inv = String(
          funding2ContextRecord?.investLine || "",
        ).toLowerCase();
        if (/\beach\s+day\b/.test(inv)) return "daily";
        if (/\beach\s+week\b/.test(inv)) return "weekly";
        if (/\beach\s+month\b/.test(inv)) return "monthly";
        const rep = String(funding2ContextRecord?.repeats || "").toLowerCase();
        if (/\bflexible\b/.test(rep)) return "flexible";
        if (/\bday\b|daily\b/.test(rep)) return "daily";
        if (/\bweek\b|weekly\b/.test(rep)) return "weekly";
        const scheduleText = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        ).toLowerCase();
        if (scheduleText.startsWith("flexible")) return "flexible";
        if (scheduleText.startsWith("daily")) return "daily";
        if (scheduleText.startsWith("weekly")) return "weekly";
        if (scheduleText.startsWith("monthly")) return "monthly";
        const fromDom = String(
          document
            .querySelector("[data-plan-freq-item].is-active")
            ?.getAttribute("data-plan-freq-item") || "",
        ).toLowerCase();
        if (fromDom === "flexible") return "flexible";
        if (
          fromDom === "daily" ||
          fromDom === "weekly" ||
          fromDom === "monthly"
        )
          return fromDom;
        return "monthly";
      };

      /** Pre-fund UI labels: flexible schedules use buy/buys (not days/weeks/months). */
      const funding2PrefundUnitLabels = (freqKey) => {
        if (freqKey === "flexible") return { unit: "buy", unitPlural: "buys" };
        const u =
          freqKey === "daily" ? "day" : freqKey === "weekly" ? "week" : "month";
        return { unit: u, unitPlural: `${u}s` };
      };
      /** Calendar step for projecting “until” dates (flexible ≈ monthly spacing). */
      const funding2PrefundDateUnit = (freqKey) =>
        freqKey === "daily" ? "day" : freqKey === "weekly" ? "week" : "month";

      const computeFunding2PeriodCoversDateText = (periods, unit) => {
        if (!Number.isFinite(periods) || periods <= 0) return "—";
        const schedText = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        );
        const compact = formatFinanceNextBuyCompact(schedText);
        const monthDay = compact.split("·")[0]?.trim();
        if (!monthDay) return "—";
        const t = new Date();
        const anchor = new Date(`${monthDay} ${t.getFullYear()}`);
        if (Number.isNaN(anchor.getTime())) return "—";
        if (anchor.getTime() < Date.now() - 24 * 60 * 60 * 1000)
          anchor.setFullYear(anchor.getFullYear() + 1);
        if (unit === "day") anchor.setDate(anchor.getDate() + periods);
        else if (unit === "week")
          anchor.setDate(anchor.getDate() + periods * 7);
        else anchor.setMonth(anchor.getMonth() + periods);
        const ordinalDay = (day) => {
          const d = Number(day) || 0;
          const mod100 = d % 100;
          if (mod100 >= 11 && mod100 <= 13) return `${d}th`;
          const mod10 = d % 10;
          if (mod10 === 1) return `${d}st`;
          if (mod10 === 2) return `${d}nd`;
          if (mod10 === 3) return `${d}rd`;
          return `${d}th`;
        };
        const month = anchor.toLocaleDateString("en-US", { month: "short" });
        const day = ordinalDay(anchor.getDate());
        const year = anchor.getFullYear();
        return `${month} ${day}, ${year}`;
      };

      /** Date like "Sep 15, 2026" for preview subline ("runs out …"). */
      const computeFunding2RunsOutAroundLabel = (periods, unit) => {
        if (!Number.isFinite(periods) || periods <= 0) return "";
        const schedText = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        );
        const compact = formatFinanceNextBuyCompact(schedText);
        const monthDay = compact.split("·")[0]?.trim();
        if (!monthDay) return "";
        const t = new Date();
        const anchor = new Date(`${monthDay} ${t.getFullYear()}`);
        if (Number.isNaN(anchor.getTime())) return "";
        if (anchor.getTime() < Date.now() - 24 * 60 * 60 * 1000)
          anchor.setFullYear(anchor.getFullYear() + 1);
        if (unit === "day") anchor.setDate(anchor.getDate() + periods);
        else if (unit === "week")
          anchor.setDate(anchor.getDate() + periods * 7);
        else anchor.setMonth(anchor.getMonth() + periods);
        return anchor.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };

      const syncFromOriginal = () => {
        const reserveInput = clone.querySelector(
          "[data-plan-buffer-reserve-input]",
        );
        const { perBuyData, reserveCur, availBalance } =
          resolveFunding2Numbers();
        const staticAmountCap = getFunding2StaticAmountCap(
          reserveCur,
          availBalance,
        );
        const reserveCurEl = clone.querySelector(
          "[data-plan-buffer-reserve-cur]",
        );
        if (reserveCurEl) reserveCurEl.textContent = reserveCur;
        const reserveInputIconEl = clone.querySelector(
          "[data-plan-buffer-reserve-input-icon]",
        );
        if (reserveInputIconEl) {
          const iconMap = {
            USDT: "assets/icon_currency_usdt.svg",
            TWD: "assets/icon_currency_TWD.svg",
            USD: "assets/icon_currency_USD.svg",
            BTC: "assets/icon_currency_btc.svg",
            ETH: "assets/icon_currency_eth.svg",
            XRP: "assets/icon_currency_xrp.svg",
            XAUT: "assets/icon_currency_xaut.svg",
            LINK: "assets/icon_currency_link.svg",
            NEAR: "assets/icon_currency_near.svg",
            MATIC: "assets/icon_currency_matic.svg",
            ONDO: "assets/icon_currency_ondo.svg",
            AAVE: "assets/icon_currency_aave.svg",
            RENDER: "assets/icon_currency_render.svg",
          };
          reserveInputIconEl.setAttribute(
            "src",
            iconMap[reserveCur] || iconMap.USDT,
          );
        }
        const availEl = clone.querySelector(
          "[data-plan-buffer-avail-balance-2]",
        );
        if (availEl) {
          const amount = Number(availBalance).toLocaleString("en-US");
          availEl.textContent = window.I18N?.t
            ? window.I18N.t("Avail. {amount} {currency}", {
                amount,
                currency: reserveCur,
              })
            : `Avail. ${amount} ${reserveCur}`;
        }
        const rangeHintEl = clone.querySelector(
          "[data-plan-buffer-reserve-range]",
        );
        const reserveBalanceErrorEl = clone.querySelector(
          "[data-plan-buffer-balance-error]",
        );
        const periodBalanceErrorEl = clone.querySelector(
          "[data-plan-buffer-period-balance-error]",
        );
        const parsedRaw = parseInt(
          String(reserveInput?.value || "").replace(/[^0-9]/g, ""),
          10,
        );
        const rawAmount = Number.isFinite(parsedRaw)
          ? Math.max(0, parsedRaw)
          : 0;
        if (!(rawAmount > 0)) funding2OptionBaseAmount = null;
        const perBuy = Number.isFinite(perBuyData.amount)
          ? Math.max(0, Math.round(perBuyData.amount))
          : 0;
        const isPeriodView = !!clone.querySelector(
          '[data-plan-buffer-funding-view-tab="period"].is-selected',
        );

        if (isPeriodView) {
          const fmt = (n) =>
            Number.isFinite(n) ? Number(n).toLocaleString("en-US") : "—";
          const freqKey = resolveFunding2FreqKey();
          const { unit, unitPlural } = funding2PrefundUnitLabels(freqKey);
          const dateUnit = funding2PrefundDateUnit(freqKey);
          const cadence =
            freqKey === "daily"
              ? "daily"
              : freqKey === "weekly"
                ? "weekly"
                : freqKey === "flexible"
                  ? ""
                  : "monthly";
          const maxPeriodByBalance =
            perBuy > 0 ? Math.floor(availBalance / perBuy) : 0;
          const staticMaxPeriod = getFunding2StaticMaxPeriod(
            reserveCur,
            perBuy,
            availBalance,
          );
          const periodInputEl = clone.querySelector(
            "[data-plan-buffer-period-input]",
          );
          const periodRangeEl = clone.querySelector(
            "[data-plan-buffer-period-range]",
          );
          const parsedPc = parseInt(
            String(periodInputEl?.value || "").replace(/[^0-9]/g, ""),
            10,
          );
          const rawPc =
            Number.isFinite(parsedPc) && parsedPc > 0 ? parsedPc : 0;
          funding2PeriodCount = Math.min(rawPc, staticMaxPeriod);
          const periodRaw =
            perBuy > 0 && funding2PeriodCount > 0
              ? funding2PeriodCount * perBuy
              : 0;
          const hasPeriodBalanceError =
            funding2PeriodCount > 0 && periodRaw > availBalance;
          const isValidPeriod =
            perBuy > 0 &&
            funding2PeriodCount >= 1 &&
            periodRaw > 0 &&
            !hasPeriodBalanceError;
          const activeAmount = isValidPeriod ? periodRaw : 0;
          const hasActiveSelection = activeAmount > 0;
          const completeBuys = funding2PeriodCount;
          funding2SelectedAmount = hasActiveSelection ? activeAmount : null;

          const periodAvail = clone.querySelector(
            "[data-plan-buffer-period-avail-balance]",
          );
          if (periodAvail) {
            const amount = fmt(availBalance);
            periodAvail.textContent = window.I18N?.t
              ? window.I18N.t("Avail. {amount} {currency}", {
                  amount,
                  currency: reserveCur,
                })
              : `Avail. ${amount} ${reserveCur}`;
          }
          const unitLabel = clone.querySelector(
            "[data-plan-buffer-period-unit-label]",
          );
          if (unitLabel) unitLabel.textContent = unitPlural;
          const heroTitlePeriod = clone.querySelector(
            "[data-plan-buffer-period-hero-title]",
          );
          if (heroTitlePeriod) {
            heroTitlePeriod.textContent = `How many ${unitPlural} would you like to pre-fund in advance?`;
          }
          const perBuyLine = clone.querySelector(
            "[data-plan-buffer-period-perbuy-line]",
          );
          if (perBuyLine) {
            if (perBuy > 0) {
              perBuyLine.innerHTML = `<span class="plan-buffer-funding-hero__subtitle-prefix">${formatEachBuyPrefix(cadence)}</span><span class="plan-buffer-funding-hero__subtitle-amount">${fmt(perBuy)} ${reserveCur}</span>`;
            } else {
              perBuyLine.innerHTML = `<span class="plan-buffer-funding-hero__subtitle-prefix">${formatEachBuyPrefix(cadence)}</span><span class="plan-buffer-funding-hero__subtitle-amount">—</span>`;
            }
          }
          if (
            periodInputEl instanceof HTMLInputElement &&
            document.activeElement !== periodInputEl
          ) {
            periodInputEl.value =
              funding2PeriodCount > 0
                ? formatWithCommas(funding2PeriodCount)
                : "";
          }
          if (periodRangeEl) {
            periodRangeEl.hidden = funding2PeriodCount > 0;
            periodRangeEl.textContent = `Max ${staticMaxPeriod > 0 ? formatWithCommas(staticMaxPeriod) : "—"}`;
          }
          const sumPeriod = clone.querySelector(
            "[data-plan-buffer-period-sum-period]",
          );
          if (sumPeriod) {
            sumPeriod.textContent =
              funding2PeriodCount > 0
                ? `${funding2PeriodCount} ${funding2PeriodCount === 1 ? unit : unitPlural}`
                : "—";
          }
          const sumCovers = clone.querySelector(
            "[data-plan-buffer-period-sum-covers]",
          );
          if (sumCovers) {
            sumCovers.textContent =
              funding2PeriodCount > 0 && perBuy > 0
                ? computeFunding2PeriodCoversDateText(
                    funding2PeriodCount,
                    dateUnit,
                  )
                : "—";
          }
          const sumAmt = clone.querySelector(
            "[data-plan-buffer-period-sum-amount]",
          );
          if (sumAmt)
            sumAmt.textContent = isValidPeriod
              ? `${fmt(periodRaw)} ${reserveCur}`
              : "—";
          const maxBtn = clone.querySelector("[data-plan-buffer-period-max]");
          if (maxBtn) maxBtn.disabled = !(maxPeriodByBalance > 0);
          if (reserveBalanceErrorEl) reserveBalanceErrorEl.hidden = true;
          if (periodBalanceErrorEl) {
            if (hasPeriodBalanceError && funding2PeriodCount > 0) {
              const periodLabel = funding2PeriodCount === 1 ? unit : unitPlural;
              periodBalanceErrorEl.textContent = `Not enough balance`;
            } else {
              periodBalanceErrorEl.textContent = "Not enough balance";
            }
            periodBalanceErrorEl.hidden = !hasPeriodBalanceError;
          }

          const freqKey2 = resolveFunding2FreqKey();
          const buyCadenceWord =
            freqKey2 === "daily"
              ? "daily"
              : freqKey2 === "weekly"
                ? "weekly"
                : freqKey2 === "flexible"
                  ? ""
                  : "monthly";
          const { unit: coverUnit, unitPlural: coverPlural } =
            funding2PrefundUnitLabels(freqKey2);
          const coverLabel = completeBuys === 1 ? coverUnit : coverPlural;

          const planName = String(
            funding2ContextRecord?.kicker ||
              funding2ContextRecord?.name ||
              "My plan",
          ).trim();
          const headerTitleEl = clone.querySelector(
            ".plan-buffer-panel__title",
          );
          if (headerTitleEl) {
            headerTitleEl.textContent = "Pre-fund";
            const planLine = planName ? `Plan: ${planName}` : "";
            if (planLine)
              headerTitleEl.setAttribute("data-funding2-plan-line", planLine);
            else headerTitleEl.removeAttribute("data-funding2-plan-line");
          }
          const overviewAmountEl = clone.querySelector(
            "[data-funding2-overview-prefund-amount]",
          );
          const overviewCoversMainEl = clone.querySelector(
            "[data-funding2-overview-covers-main]",
          );
          const overviewCoversSubEl = clone.querySelector(
            "[data-funding2-overview-covers-sub]",
          );
          const overviewAutorefillAmountEl = clone.querySelector(
            "[data-funding2-overview-autorefill-amount]",
          );
          const overviewAmountText = hasActiveSelection
            ? `${fmt(activeAmount)} ${reserveCur}`
            : "- -";
          if (overviewAmountEl)
            overviewAmountEl.textContent = overviewAmountText;
          if (overviewCoversMainEl) {
            overviewCoversMainEl.textContent =
              hasActiveSelection && completeBuys > 0
                ? `${completeBuys} ${coverLabel}`
                : "- -";
          }
          if (overviewCoversSubEl) {
            const runsOutDate = computeFunding2RunsOutAroundLabel(
              funding2PeriodCount,
              dateUnit,
            );
            overviewCoversSubEl.textContent =
              hasActiveSelection && completeBuys > 0 && runsOutDate
                ? `Runs out ${runsOutDate}`
                : "";
          }
          if (overviewAutorefillAmountEl)
            overviewAutorefillAmountEl.textContent = overviewAmountText;

          // By period: only the static `.plan-buffer-funding-period-summary` (Period / Covers / Amount rows).
          // Hide the injected "By amount" meta strip so it does not stack or steal the layout.
          const injectedMeta = clone.querySelector("[data-funding2-meta]");
          if (injectedMeta) injectedMeta.hidden = true;

          const roundWrap = clone.querySelector("[data-plan-buffer-rounding]");
          if (roundWrap) roundWrap.hidden = true;
          const actionWrap = clone.querySelector(
            "[data-plan-buffer-plan-action]",
          );
          if (actionWrap) actionWrap.hidden = true;
          const autoRefill = clone.querySelector(
            "[data-plan-buffer-autorefill]",
          );
          if (autoRefill) autoRefill.hidden = true;
          const summaryDivider = clone.querySelector(
            ".plan-buffer-funding-summary-autorefill-divider",
          );
          if (summaryDivider) summaryDivider.hidden = true;
          const summaryCard = clone.querySelector(
            ".plan-buffer-funding-summary",
          );
          if (summaryCard) summaryCard.hidden = true;
          const optionsWrap = ensureFunding2Options();
          if (optionsWrap) optionsWrap.hidden = true;

          const ctaBtn = clone.querySelector("[data-plan-buffer-confirm]");
          if (ctaBtn) {
            ctaBtn.textContent = "Preview";
            const isDisabled = !hasActiveSelection || hasPeriodBalanceError;
            ctaBtn.disabled = isDisabled;
            ctaBtn.classList.toggle("is-disabled", isDisabled);
          }
          clone.classList.toggle(
            "plan-buffer-panel--period-has-count",
            funding2PeriodCount >= 1,
          );
          const periodSummaryEl = clone.querySelector(
            ".plan-buffer-funding-period-summary",
          );
          if (periodSummaryEl)
            periodSummaryEl.hidden =
              funding2PeriodCount < 1 || hasPeriodBalanceError;
          return;
        }
        clone.classList.remove("plan-buffer-panel--period-has-count");
        if (periodBalanceErrorEl) periodBalanceErrorEl.hidden = true;
        const hasAmountBalanceError = rawAmount > availBalance;
        if (reserveBalanceErrorEl)
          reserveBalanceErrorEl.hidden = !hasAmountBalanceError;
        if (rangeHintEl) {
          const maxText =
            staticAmountCap > 0 ? staticAmountCap.toLocaleString("en-US") : "—";
          rangeHintEl.textContent = `Max ${maxText}${maxText === "—" ? "" : ` ${reserveCur}`}`;
          rangeHintEl.hidden = rawAmount > 0;
        }
        const isExactBuyMultiple =
          perBuy > 0 && rawAmount > 0 && rawAmount % perBuy === 0;
        // Amount tab: selection follows the reserve field (and option chips). The period tab sets
        // funding2SelectedAmount to periods × perBuy without writing the reserve input; that value
        // must not leak into this branch when rawAmount is empty or not an exact buy multiple.
        if (rawAmount === 0) {
          funding2SelectedAmount = null;
        } else if (isExactBuyMultiple && !hasAmountBalanceError) {
          funding2SelectedAmount = rawAmount;
        } else if (perBuy > 0) {
          funding2SelectedAmount = null;
        }
        const activeAmount = Number.isFinite(funding2SelectedAmount)
          ? Math.max(0, Number(funding2SelectedAmount))
          : 0;
        const hasActiveSelection = activeAmount > 0;
        const completeBuys =
          perBuy > 0 && hasActiveSelection
            ? Math.max(0, Math.floor(activeAmount / perBuy))
            : 0;
        const planName = String(
          funding2ContextRecord?.kicker ||
            funding2ContextRecord?.name ||
            "My plan",
        ).trim();
        const fmt = (n) =>
          Number.isFinite(n) ? Number(n).toLocaleString("en-US") : "—";
        const freqKey = resolveFunding2FreqKey();
        const buyCadenceWord =
          freqKey === "daily"
            ? "daily"
            : freqKey === "weekly"
              ? "weekly"
              : freqKey === "flexible"
                ? ""
                : "monthly";
        const { unit: coverUnit, unitPlural: coverPlural } =
          funding2PrefundUnitLabels(freqKey);
        const coverLabel = completeBuys === 1 ? coverUnit : coverPlural;
        const headTitle = clone.querySelector(
          ".plan-buffer-funding-input__title",
        );
        if (headTitle) headTitle.textContent = "Amount";
        const heroTitle = clone.querySelector(
          ".plan-buffer-funding-hero__title",
        );
        if (heroTitle)
          heroTitle.textContent =
            "How much would you like to reserve for your plan?";
        const headerTitleEl = clone.querySelector(".plan-buffer-panel__title");
        if (headerTitleEl) {
          headerTitleEl.textContent = "Pre-fund";
          const planLine = planName ? `Plan: ${planName}` : "";
          if (planLine)
            headerTitleEl.setAttribute("data-funding2-plan-line", planLine);
          else headerTitleEl.removeAttribute("data-funding2-plan-line");
        }
        const overviewTitleEl = clone.querySelector(
          "[data-funding2-overview-title]",
        );
        if (overviewTitleEl) {
          overviewTitleEl.textContent = "Pre-fund overview";
          const planLine = planName ? `Plan: ${planName}` : "";
          if (planLine)
            overviewTitleEl.setAttribute("data-funding2-plan-line", planLine);
          else overviewTitleEl.removeAttribute("data-funding2-plan-line");
        }
        const overviewAmountText = hasActiveSelection
          ? `${fmt(activeAmount)} ${reserveCur}`
          : "- -";
        const overviewAmountEl = clone.querySelector(
          "[data-funding2-overview-prefund-amount]",
        );
        if (overviewAmountEl) overviewAmountEl.textContent = overviewAmountText;
        const overviewCoversMainEl = clone.querySelector(
          "[data-funding2-overview-covers-main]",
        );
        if (overviewCoversMainEl) {
          overviewCoversMainEl.textContent =
            hasActiveSelection && completeBuys > 0
              ? `${completeBuys} ${coverLabel}`
              : "- -";
        }
        const overviewCoversSubEl = clone.querySelector(
          "[data-funding2-overview-covers-sub]",
        );
        if (overviewCoversSubEl) {
          const dateUnit = funding2PrefundDateUnit(freqKey);
          const runsOutDate = computeFunding2RunsOutAroundLabel(
            completeBuys,
            dateUnit,
          );
          overviewCoversSubEl.textContent =
            hasActiveSelection && completeBuys > 0 && runsOutDate
              ? `Runs out ${runsOutDate}`
              : "";
        }
        const overviewAutorefillAmountEl = clone.querySelector(
          "[data-funding2-overview-autorefill-amount]",
        );
        if (overviewAutorefillAmountEl)
          overviewAutorefillAmountEl.textContent = overviewAmountText;
        const overviewDeductEl = clone.querySelector(
          "[data-funding2-overview-deduct-value]",
        );
        if (overviewDeductEl)
          overviewDeductEl.textContent = `${reserveCur} balance`;
        const perBuySub = clone.querySelector("[data-plan-buffer-perbuy-sub]");
        if (perBuySub) {
          if (perBuy > 0) {
            perBuySub.innerHTML = `<span class="plan-buffer-funding-hero__subtitle-prefix">${formatEachBuyPrefix(buyCadenceWord)}</span><span class="plan-buffer-funding-hero__subtitle-amount">${fmt(perBuy)} ${perBuyData.currency}</span>`;
          } else {
            perBuySub.innerHTML = `<span class="plan-buffer-funding-hero__subtitle-prefix">${formatEachBuyPrefix(buyCadenceWord)}</span><span class="plan-buffer-funding-hero__subtitle-amount">—</span>`;
          }
        }

        const roundWrap = clone.querySelector("[data-plan-buffer-rounding]");
        if (roundWrap) roundWrap.hidden = true;
        const actionWrap = clone.querySelector(
          "[data-plan-buffer-plan-action]",
        );
        if (actionWrap) actionWrap.hidden = true;
        const autoRefill = clone.querySelector("[data-plan-buffer-autorefill]");
        if (autoRefill) autoRefill.hidden = true;
        const summaryDivider = clone.querySelector(
          ".plan-buffer-funding-summary-autorefill-divider",
        );
        if (summaryDivider) summaryDivider.hidden = true;
        const summaryCard = clone.querySelector(".plan-buffer-funding-summary");
        if (summaryCard) summaryCard.hidden = true;

        const optionsWrap = ensureFunding2Options();
        if (optionsWrap) {
          const optionsTitle = optionsWrap.querySelector(
            ".plan-buffer-funding2-options__title",
          );
          if (optionsTitle) optionsTitle.textContent = "Select nearest option";
          const optionsList = optionsWrap.querySelector(
            "[data-funding2-options-list]",
          );
          const showOptions = rawAmount > 0 && perBuy > 0;
          optionsWrap.hidden = !showOptions;
          if (optionsList) {
            optionsList.textContent = "";
            if (showOptions) {
              const optionsBaseAmount =
                Number.isFinite(funding2OptionBaseAmount) &&
                funding2OptionBaseAmount > 0
                  ? funding2OptionBaseAmount
                  : rawAmount;
              const center = Math.max(
                1,
                Math.round(optionsBaseAmount / perBuy),
              );
              const maxAffordableBuys = Math.max(
                0,
                Math.floor(availBalance / perBuy),
              );
              const maxShownBuy = Math.max(1, maxAffordableBuys + 1);
              const clampedCenter = Math.min(center, maxShownBuy);
              let startBuy = Math.max(1, clampedCenter - 1);
              let buyOptions = [startBuy, startBuy + 1, startBuy + 2];
              if (buyOptions[2] > maxShownBuy) {
                buyOptions = [
                  Math.max(1, maxShownBuy - 2),
                  Math.max(1, maxShownBuy - 1),
                  maxShownBuy,
                ];
              }
              buyOptions = Array.from(
                new Set(buyOptions.filter((n) => n >= 1 && n <= maxShownBuy)),
              );
              while (buyOptions.length < 3) {
                const next = Math.max(
                  1,
                  (buyOptions[buyOptions.length - 1] || 0) + 1,
                );
                if (next > maxShownBuy) break;
                buyOptions.push(next);
              }
              buyOptions.forEach((buyCount) => {
                const amountValue = buyCount * perBuy;
                const exceedsAvailBalance = amountValue > availBalance;
                const optionBtn = document.createElement("button");
                optionBtn.type = "button";
                optionBtn.className = "plan-buffer-funding2-option";
                if (amountValue === activeAmount && !exceedsAvailBalance)
                  optionBtn.classList.add("is-active");
                optionBtn.setAttribute("data-funding2-option-btn", "true");
                optionBtn.setAttribute(
                  "data-funding2-option-amount",
                  String(amountValue),
                );
                optionBtn.disabled = exceedsAvailBalance;
                optionBtn.innerHTML = `
                  <span class="plan-buffer-funding2-option__sub">${fmt(amountValue)}</span>
                <span class="plan-buffer-funding2-option__main">${buyCount} ${buyCount === 1 ? coverUnit : coverPlural}</span>

                `;
                optionsList.appendChild(optionBtn);
              });
            }
          }
        }

        const meta = ensureFunding2Meta();
        if (meta) {
          const periodEl = meta.querySelector("[data-funding2-meta-period]");
          const untilEl = meta.querySelector("[data-funding2-meta-until]");
          const amountEl = meta.querySelector("[data-funding2-meta-amount]");
          const dateUnit = funding2PrefundDateUnit(freqKey);
          const coversDate =
            hasActiveSelection && completeBuys > 0
              ? computeFunding2PeriodCoversDateText(completeBuys, dateUnit)
              : "- -";
          meta.hidden = !hasActiveSelection || hasAmountBalanceError;
          if (periodEl)
            periodEl.textContent =
              hasActiveSelection && completeBuys > 0
                ? `${completeBuys} ${coverLabel}`
                : "- -";
          if (untilEl) untilEl.textContent = coversDate;
          if (amountEl)
            amountEl.textContent = hasActiveSelection
              ? `${fmt(activeAmount)} ${reserveCur}`
              : "- -";
        }

        const ctaBtn = clone.querySelector("[data-plan-buffer-confirm]");
        if (ctaBtn) {
          ctaBtn.textContent = "Preview";
          const isDisabled = !hasActiveSelection || hasAmountBalanceError;
          ctaBtn.disabled = isDisabled;
          ctaBtn.classList.toggle("is-disabled", isDisabled);
        }

        // Keep Pre-fund in a true empty visual state on open / zero amount.
        if (
          reserveInput instanceof HTMLInputElement &&
          !hasActiveSelection &&
          rawAmount === 0
        ) {
          reserveInput.value = "";
        }
      };

      const handleCloneInput = (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches("[data-plan-buffer-reserve-input]")) return;
        funding2SelectedAmount = null;
        const parsed = parseInt(
          String(target.value || "").replace(/[^0-9]/g, ""),
          10,
        );
        const { reserveCur, availBalance } = resolveFunding2Numbers();
        const staticAmountCap = getFunding2StaticAmountCap(
          reserveCur,
          availBalance,
        );
        const clamped =
          Number.isFinite(parsed) && parsed > 0
            ? Math.min(parsed, staticAmountCap)
            : 0;
        funding2OptionBaseAmount = clamped > 0 ? clamped : null;
        target.value = clamped > 0 ? formatWithCommas(clamped) : "";
        requestAnimationFrame(syncFromOriginal);
      };

      const handleCloneChange = (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        if (!target.matches("[data-plan-buffer-reserve-input]")) return;
        requestAnimationFrame(syncFromOriginal);
      };

      const reserveInputRow = clone.querySelector(
        ".plan-buffer-funding-input__row",
      );
      reserveInputRow?.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        const reserveInput = clone.querySelector(
          "[data-plan-buffer-reserve-input]",
        );
        if (!(reserveInput instanceof HTMLInputElement)) return;
        reserveInput.focus();
        const endPos = reserveInput.value.length;
        reserveInput.setSelectionRange(endPos, endPos);
      });

      const maxBtn = clone.querySelector("[data-plan-buffer-reserve-max]");
      maxBtn?.addEventListener("click", () => {
        const { perBuyData, availBalance } = resolveFunding2Numbers();
        const perBuy = Number.isFinite(perBuyData.amount)
          ? Math.max(0, Math.round(perBuyData.amount))
          : 0;
        const maxAmount =
          perBuy > 0
            ? Math.floor(availBalance / perBuy) * perBuy
            : Math.max(0, Math.floor(availBalance));
        applyFunding2Amount(maxAmount);
        funding2OptionBaseAmount = maxAmount > 0 ? maxAmount : null;
        requestAnimationFrame(syncFromOriginal);
      });

      const handleFunding2OptionClick = (e) => {
        const optionBtn = e.target.closest("[data-funding2-option-btn]");
        if (!optionBtn || !clone.contains(optionBtn)) return;
        const n = parseInt(
          String(optionBtn.getAttribute("data-funding2-option-amount") || ""),
          10,
        );
        if (!Number.isFinite(n) || n <= 0) return;
        applyFunding2Amount(n);
        const reserveInput = clone.querySelector(
          "[data-plan-buffer-reserve-input]",
        );
        if (reserveInput instanceof HTMLInputElement) reserveInput.blur();
        requestAnimationFrame(syncFromOriginal);
      };

      const handleFunding2OptionMouseDown = (e) => {
        const optionBtn = e.target.closest("[data-funding2-option-btn]");
        if (!optionBtn || !clone.contains(optionBtn)) return;
        // When amount input is focused, first click can be consumed by blur.
        // Apply on mousedown so one click always selects immediately.
        e.preventDefault();
        const n = parseInt(
          String(optionBtn.getAttribute("data-funding2-option-amount") || ""),
          10,
        );
        if (!Number.isFinite(n) || n <= 0) return;
        applyFunding2Amount(n);
        const reserveInput = clone.querySelector(
          "[data-plan-buffer-reserve-input]",
        );
        if (reserveInput instanceof HTMLInputElement) reserveInput.blur();
        requestAnimationFrame(syncFromOriginal);
      };

      const ensureFunding2OverviewStep = () => {
        let step = clone.querySelector("[data-funding2-overview-step]");
        if (step) return step;
        step = document.createElement("div");
        step.className = "plan-buffer-funding2-confirm-step";
        step.setAttribute("data-funding2-overview-step", "true");
        step.hidden = true;
        step.innerHTML = `
          <header class="plan-buffer-funding2-confirm-step__header plan-buffer-panel__header plan-buffer-panel__header--funding">
            <button type="button" class="plan-buffer-panel__icon-btn" data-funding2-overview-step-back aria-label="Back">
              <img src="assets/icon_back.svg" alt="" width="24" height="24" />
            </button>
            <h1 class="plan-buffer-panel__title" data-funding2-overview-title>Pre-fund overview</h1>
            <button type="button" class="my-plans-detail-panel__icon-btn my-plans-detail-panel__icon-btn--right" aria-label="Support">
              <img src="assets/icon_intercom.svg" alt="" width="24" height="24" />
            </button>
          </header>
          <div class="plan-buffer-funding2-confirm-step__body plan-buffer-funding2-overview-step__body" aria-label="Pre-fund overview">
            <div class="plan-overview-panel__body">
              <div class="plan-overview-panel__summary">
                <div class="plan-overview-panel__row">
                  <span class="plan-overview-panel__row-label">Pre-fund amount</span>
                  <span class="plan-overview-panel__row-value" data-funding2-overview-prefund-amount>- -</span>
                </div>
                <div class="plan-overview-panel__divider plan-overview-panel__divider--dark" aria-hidden="true"></div>
                <div class="plan-overview-panel__row plan-overview-panel__row--stack">
                  <span class="plan-overview-panel__row-label">Covers</span>
                  <div class="plan-overview-panel__row-value-col">
                    <span class="plan-overview-panel__row-value" data-funding2-overview-covers-main>- -</span>
                    <span class="plan-overview-panel__row-sub" data-funding2-overview-covers-sub></span>
                  </div>
                </div>
                <div class="plan-overview-panel__divider plan-overview-panel__divider--dark" aria-hidden="true"></div>
                <div class="plan-overview-panel__row">
                  <span class="plan-overview-panel__row-label">Auto-refill</span>
                  <div class="plan-overview-panel__row-value-col">
                    <div class="plan-overview-panel__funding-value-row">
                      <span class="plan-overview-panel__row-value" data-funding2-overview-autorefill-value>When funds run out</span>
                      <button class="plan-overview-panel__funding-info-btn" type="button" data-funding2-overview-autorefill-info-open aria-label="About auto-refill when funds run out">
                        <img src="assets/icon_info_circle_white.svg" alt="" class="plan-overview-panel__funding-info-icon" width="16" height="16" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
                <div class="plan-overview-panel__divider plan-overview-panel__divider--dark" aria-hidden="true"></div>
                <div class="plan-overview-panel__row">
                  <span class="plan-overview-panel__row-label">Auto-refill amount</span>
                  <span class="plan-overview-panel__row-value" data-funding2-overview-autorefill-amount>- -</span>
                </div>
                <div class="plan-overview-panel__divider plan-overview-panel__divider--dark" aria-hidden="true"></div>
                <div class="plan-overview-panel__row plan-overview-panel__row--stack">
                  <span class="plan-overview-panel__row-label">Deduct from</span>
                  <div class="plan-overview-panel__row-value-col">
                    <div class="plan-overview-panel__funding-value-row">
                      <span class="plan-overview-panel__row-value" data-funding2-overview-deduct-value>TWD balance</span>
                      <button class="plan-overview-panel__funding-info-btn" type="button" data-funding2-overview-funding-info-open aria-label="About funding method">
                        <img src="assets/icon_info_circle_white.svg" alt="" class="plan-overview-panel__funding-info-icon" width="16" height="16" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="plan-buffer-funding2-overview-note-row">
                <p class="plan-buffer-funding2-overview-note" data-funding2-overview-note>You’re always in control. Change or turn off pre-funding at any time.</p>
                <img class="plan-buffer-funding2-overview-note-icon" src="assets/icon_green_shield.svg" alt="" width="32" height="32" aria-hidden="true" />
              </div>
            </div>
          </div>
          <div class="plan-overview-panel__footer plan-buffer-funding2-overview-step__footer">
            <p class="plan-overview-panel__consent-copy">By confirming, I have read and agree to the Terms of Service</p>
            <button class="plan-overview-panel__btn plan-overview-panel__btn--primary" type="button" data-funding2-overview-confirm>Confirm</button>
            <button class="plan-overview-panel__btn plan-overview-panel__btn--secondary" type="button" data-funding2-overview-back>Back</button>
          </div>
        `;
        clone.appendChild(step);
        const closeOverview = () => {
          step.classList.remove("is-open");
          const onEnd = () => {
            if (!step.classList.contains("is-open")) step.hidden = true;
            step.removeEventListener("transitionend", onEnd);
          };
          step.addEventListener("transitionend", onEnd);
          setTimeout(onEnd, 320);
        };
        step
          .querySelector("[data-funding2-overview-step-back]")
          ?.addEventListener("click", closeOverview);
        step
          .querySelector("[data-funding2-overview-back]")
          ?.addEventListener("click", closeOverview);
        step
          .querySelector("[data-funding2-overview-funding-info-open]")
          ?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPlanOverviewFundingInfoSheet({
              title: "Deduct from balance",
              desc: "The pre-fund amount will be deducted from your balance and reserved for this plan. When reserved funds run out, future auto-refills will also be deducted from your balance.\n\nYou can change or turn off pre-funding any time.",
            });
          });
        step
          .querySelector("[data-funding2-overview-autorefill-info-open]")
          ?.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPlanOverviewFundingInfoSheet({
              title: "Auto-refill when funds run out",
              desc: "When your reserved funds run out, we’ll automatically pre-fund again to keep your plan running.\n\nYou can change or turn off pre-funding any time",
            });
          });
        return step;
      };

      const openFunding2OverviewAfterPreview = () => {
        closeFunding2PreviewSheet();
        const confirmStepEl = clone.querySelector(
          "[data-funding2-confirm-step]",
        );
        if (confirmStepEl) {
          confirmStepEl.hidden = true;
          confirmStepEl.classList.remove("is-open");
        }
        const overviewStepEl = ensureFunding2OverviewStep();
        syncFromOriginal();
        overviewStepEl.hidden = false;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => overviewStepEl.classList.add("is-open"));
        });
      };

      const syncFunding2PreviewCopy = () => {
        if (!funding2PreviewSheet) return;
        const amountEl = funding2PreviewSheet.querySelector(
          "[data-funding2-preview-amount]",
        );
        const heroEl = funding2PreviewSheet.querySelector(
          "[data-funding2-preview-hero]",
        );
        const coversLineEl = funding2PreviewSheet.querySelector(
          "[data-funding2-preview-covers-line]",
        );
        const { reserveCur, perBuyData } = resolveFunding2Numbers();
        const perBuy = Number.isFinite(perBuyData.amount)
          ? Math.max(0, Math.round(perBuyData.amount))
          : 0;
        const activeAmount = Number.isFinite(funding2SelectedAmount)
          ? Math.max(0, Number(funding2SelectedAmount))
          : 0;
        const fmt = (n) =>
          Number.isFinite(n) ? Number(n).toLocaleString("en-US") : "—";
        const amountToken =
          activeAmount > 0
            ? `${fmt(activeAmount)} ${reserveCur}`
            : `0 ${reserveCur}`;
        if (amountEl) amountEl.textContent = amountToken;
        if (heroEl) {
          const esc = (s) =>
            String(s)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;");
          const t = esc(amountToken);
          const rawSentence = window.I18N?.t
            ? window.I18N.t(
                "When these reserved funds run out, we'll automatically pre-fund {amount} again to keep your plan running.",
                { amount: amountToken },
              )
            : `When these reserved funds run out, we'll automatically pre-fund ${amountToken} again to keep your plan running.`;
          const sentenceEsc = esc(rawSentence);
          heroEl.innerHTML = sentenceEsc.includes(t)
            ? sentenceEsc.replace(
                t,
                `<span class="funding2-preview-sheet__hl">${t}</span>`,
              )
            : sentenceEsc;
        }
        if (coversLineEl) {
          const isPeriodView = !!clone.querySelector(
            '[data-plan-buffer-funding-view-tab="period"].is-selected',
          );
          const freqKey = resolveFunding2FreqKey();
          const { unit, unitPlural } = funding2PrefundUnitLabels(freqKey);
          const dateUnit = funding2PrefundDateUnit(freqKey);
          let periods = 0;
          if (isPeriodView) {
            periods = funding2PeriodCount > 0 ? funding2PeriodCount : 0;
          } else if (perBuy > 0 && activeAmount > 0) {
            periods = Math.floor(activeAmount / perBuy);
          }
          const runsOutDate = computeFunding2RunsOutAroundLabel(
            periods,
            dateUnit,
          );
          if (periods > 0 && activeAmount > 0 && runsOutDate) {
            const coverPhrase = `Covers ${periods} ${periods === 1 ? unit : unitPlural}`;
            coversLineEl.textContent = `${coverPhrase}  ·  Runs out ${runsOutDate}`;
            coversLineEl.hidden = false;
            coversLineEl.setAttribute("aria-hidden", "false");
          } else if (periods > 0 && activeAmount > 0) {
            coversLineEl.textContent = `Covers ${periods} ${periods === 1 ? unit : unitPlural}`;
            coversLineEl.hidden = false;
            coversLineEl.setAttribute("aria-hidden", "false");
          } else {
            coversLineEl.textContent = "";
            coversLineEl.hidden = true;
            coversLineEl.setAttribute("aria-hidden", "true");
          }
        }
      };

      const openFunding2PreviewSheet = () => {
        syncFunding2PreviewCopy();
        if (!funding2PreviewSheet) return;
        sheetOpenWithInstantBackdrop(funding2PreviewSheet);
      };

      funding2PreviewSheetApi.openOverview = openFunding2OverviewAfterPreview;
      funding2PreviewSheetApi.openLearnMorePreview = () => {
        funding2PreviewReturnAfterLearnMore = true;
        closeFunding2PreviewSheet();
        requestAnimationFrame(() => openFunding2LearnMore(1));
      };
      bindFunding2PreviewSheetOnce();

      const syncFunding2SuccessCopy = () => {
        const successStepEl = clone.querySelector(
          "[data-funding2-success-step]",
        );
        if (!successStepEl) return;
        const reservedEl = successStepEl.querySelector(
          "[data-funding2-success-reserved]",
        );
        const { reserveCur } = resolveFunding2Numbers();
        const activeAmount = Number.isFinite(funding2SelectedAmount)
          ? Math.max(0, Number(funding2SelectedAmount))
          : 0;
        const fmt = (n) =>
          Number.isFinite(n) ? Number(n).toLocaleString("en-US") : "—";
        if (reservedEl) {
          reservedEl.textContent =
            activeAmount > 0
              ? `Pre-funded ${fmt(activeAmount)} ${reserveCur}`
              : `Pre-funded — ${reserveCur}`;
        }
      };

      const commitFunding2PrefundAmount = () => {
        const { reserveCur } = resolveFunding2Numbers();
        const activeAmount = Number.isFinite(funding2SelectedAmount)
          ? Math.max(0, Number(funding2SelectedAmount))
          : 0;
        const fmt = (n) =>
          Number.isFinite(n) ? Number(n).toLocaleString("en-US") : "—";
        const reservedFundsText =
          activeAmount > 0
            ? `${fmt(activeAmount)} ${reserveCur}`
            : `— ${reserveCur}`;
        const applyToRecord = (rec) => {
          if (!rec || typeof rec !== "object") return rec;
          return {
            ...rec,
            isReserved: true,
            fundingMethod: "Set aside funds",
            reservedFunds: reservedFundsText,
          };
        };
        funding2ContextRecord = applyToRecord(funding2ContextRecord);
        if (myPlansSubmittedPlan)
          myPlansSubmittedPlan = applyToRecord(myPlansSubmittedPlan);
        if (myPlansPrefillPlan)
          myPlansPrefillPlan = applyToRecord(myPlansPrefillPlan);
        syncMyPlansFlowUi();
      };

      const leaveFunding2SuccessDone = () => {
        commitFunding2PrefundAmount();
        setState("funding", 3);
        planSuccessApi.forceClose();
        planOverviewApi.close({ instant: true });
        closeFunding2Panel({ resetFinanceScroll: true });
        setOpen(false);
        tabNavApi.setActiveTab("finance");
        financeHeaderApi.setFinancePage("auto");
        window.setTimeout(() => {
          const content = document.querySelector("[data-content]");
          if (content) content.scrollTop = 0;
          const autoPageEl = document.querySelector(
            '[data-finance-page="auto"]',
          );
          if (autoPageEl && "scrollTop" in autoPageEl) autoPageEl.scrollTop = 0;
        }, 180);
      };

      const leaveFunding2SuccessDismiss = () => {
        commitFunding2PrefundAmount();
        setState("funding", 3);
        planSuccessApi.forceClose();
        planOverviewApi.close({ instant: true });
        closeFunding2Panel({ resetFinanceScroll: true });
        setOpen(false);
        goFinanceAutoInvestFromSuccess();
      };

      const ensureFunding2SuccessStep = () => {
        let successStep = clone.querySelector("[data-funding2-success-step]");
        if (successStep) return successStep;
        successStep = document.createElement("div");
        successStep.className = "plan-buffer-funding2-success-step";
        successStep.setAttribute("data-funding2-success-step", "true");
        successStep.hidden = true;
        successStep.setAttribute("aria-label", "Pre-fund set up success");
        successStep.innerHTML = `
          <header class="plan-buffer-funding2-success-step__header">
            <button type="button" class="plan-buffer-funding2-success-step__icon-btn" data-funding2-success-dismiss aria-label="Close">
              <img src="assets/icon_close.svg" alt="" width="24" height="24" />
            </button>
            <div class="plan-buffer-funding2-success-step__header-spacer" aria-hidden="true"></div>
          </header>
          <div class="plan-buffer-funding2-success-step__scroller">
            <div class="plan-buffer-funding2-success-step__body">
              <div class="plan-buffer-funding2-success-step__hero">
                <img class="plan-buffer-funding2-success-step__icon" src="assets/icon_success_screen.svg" alt="" width="60" height="60" aria-hidden="true" />
                <div class="plan-buffer-funding2-success-step__headline">You’ve successfully <br aria-hidden="true" />pre-funded your plan</div>
                <p class="plan-buffer-funding2-success-step__reserved" data-funding2-success-reserved>Pre-funded —</p>
              </div>
            </div>
            <div class="plan-buffer-funding2-success-step__footer">
              <button class="plan-buffer-funding2-success-step__btn plan-buffer-funding2-success-step__btn--done" type="button" data-funding2-success-done>Done</button>
            </div>
          </div>
        `;
        clone.appendChild(successStep);

        successStep
          .querySelector("[data-funding2-success-dismiss]")
          ?.addEventListener("click", leaveFunding2SuccessDismiss);

        successStep
          .querySelector("[data-funding2-success-done]")
          ?.addEventListener("click", leaveFunding2SuccessDone);

        return successStep;
      };

      const resetFunding2State = () => {
        funding2SelectedAmount = null;
        funding2OptionBaseAmount = null;
        funding2PeriodCount = 0;
        const reserveInput = clone.querySelector(
          "[data-plan-buffer-reserve-input]",
        );
        if (reserveInput instanceof HTMLInputElement) reserveInput.value = "";
        const periodInputReset = clone.querySelector(
          "[data-plan-buffer-period-input]",
        );
        if (periodInputReset instanceof HTMLInputElement)
          periodInputReset.value = "";
        syncFromOriginal();
      };

      const funding2ConfirmBtn = clone.querySelector(
        "[data-plan-buffer-confirm]",
      );
      funding2ConfirmBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (funding2ConfirmBtn.disabled) return;
        openFunding2PreviewSheet();
      });

      clone.addEventListener("click", handleFunding2OptionClick);
      clone.addEventListener("mousedown", handleFunding2OptionMouseDown);
      clone.addEventListener("input", handleCloneInput);
      clone.addEventListener("change", handleCloneChange);
      const applyFunding2PeriodInputLiveFormat = (target) => {
        if (!(target instanceof HTMLInputElement)) return;
        const { perBuyData, reserveCur, availBalance } =
          resolveFunding2Numbers();
        const perBuy = Number.isFinite(perBuyData.amount)
          ? Math.max(0, Math.round(perBuyData.amount))
          : 0;
        const maxPeriod = getFunding2StaticMaxPeriod(
          reserveCur,
          perBuy,
          availBalance,
        );
        const cursor = target.selectionStart || 0;
        const oldVal = target.value || "";
        const digitsBeforeCursor = oldVal
          .slice(0, cursor)
          .replace(/[^0-9]/g, "").length;
        const raw = oldVal.replace(/[^0-9]/g, "");
        if (!raw) {
          target.value = "";
          return;
        }
        let n = parseInt(raw, 10);
        if (!Number.isFinite(n)) n = 0;
        n = Math.max(0, Math.min(n, maxPeriod));
        if (n <= 0) {
          target.value = "";
          return;
        }
        const formatted = formatWithCommas(n);
        target.value = formatted;
        let newCursor = 0;
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i += 1) {
          if (digitsSeen === digitsBeforeCursor) {
            newCursor = i;
            break;
          }
          if (formatted[i] !== ",") digitsSeen += 1;
          newCursor = i + 1;
        }
        target.setSelectionRange(newCursor, newCursor);
      };
      clone.addEventListener("input", (e) => {
        const t = e.target;
        if (!(t instanceof HTMLInputElement)) return;
        if (!t.matches("[data-plan-buffer-period-input]")) return;
        applyFunding2PeriodInputLiveFormat(t);
        requestAnimationFrame(syncFromOriginal);
      });
      clone
        .querySelector("[data-plan-buffer-period-input]")
        ?.addEventListener("blur", () => {
          const el = clone.querySelector("[data-plan-buffer-period-input]");
          if (!(el instanceof HTMLInputElement)) return;
          const digits = String(el.value || "").replace(/[^0-9]/g, "");
          const raw = parseInt(digits, 10);
          if (!Number.isFinite(raw) || raw <= 0) el.value = "";
          requestAnimationFrame(syncFromOriginal);
        });
      clone
        .querySelector("[data-plan-buffer-period-max]")
        ?.addEventListener("click", (e) => {
          e.preventDefault();
          const { perBuyData, availBalance } = resolveFunding2Numbers();
          const perBuy = Number.isFinite(perBuyData.amount)
            ? Math.max(0, Math.round(perBuyData.amount))
            : 0;
          funding2PeriodCount =
            perBuy > 0 ? Math.floor(availBalance / perBuy) : 0;
          const periodInputMax = clone.querySelector(
            "[data-plan-buffer-period-input]",
          );
          if (periodInputMax instanceof HTMLInputElement) {
            periodInputMax.value =
              funding2PeriodCount > 0
                ? formatWithCommas(funding2PeriodCount)
                : "";
          }
          requestAnimationFrame(syncFromOriginal);
        });

      const ensureFunding2SubmitLoader = () => {
        let el = clone.querySelector("[data-funding2-submit-loader]");
        if (el) return el;
        el = document.createElement("div");
        el.className = "plan-submit-loader";
        el.setAttribute("data-funding2-submit-loader", "true");
        el.hidden = true;
        el.innerHTML = `
          <div class="plan-submit-loader__backdrop" aria-hidden="true"></div>
          <div class="plan-submit-loader__card" role="status" aria-live="polite" aria-label="Submitting">
            <img class="plan-submit-loader__icon" src="assets/icon-loading.svg" alt="" width="40" height="40" aria-hidden="true" />
          </div>
        `;
        clone.appendChild(el);
        return el;
      };

      clone.addEventListener("click", (e) => {
        const overviewConfirm = e.target.closest(
          "[data-funding2-overview-confirm]",
        );
        if (!overviewConfirm || !clone.contains(overviewConfirm)) return;
        if (overviewConfirm.disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setPrototypePrefundLog("prefunded");
        const loaderEl = ensureFunding2SubmitLoader();
        funding2PrefundSuccessLoaderGen += 1;
        const gen = funding2PrefundSuccessLoaderGen;
        overviewConfirm.disabled = true;
        loaderEl.hidden = false;
        window.setTimeout(() => {
          if (gen !== funding2PrefundSuccessLoaderGen) {
            loaderEl.hidden = true;
            return;
          }
          loaderEl.hidden = true;
          const successStep = ensureFunding2SuccessStep();
          syncFunding2SuccessCopy();
          successStep.hidden = false;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => successStep.classList.add("is-open"));
          });
        }, FUNDING2_PREFUND_SUCCESS_LOADER_MS);
      });
      clone._funding2Sync = syncFromOriginal;
      resetFunding2State();
      clone._funding2Reset = resetFunding2State;
      funding2PanelEl = clone;
      return funding2PanelEl;
    };

    const openFunding2Flow = (opts = {}) => {
      const teardownPlanFlow = opts.teardownPlanFlow !== false;
      const funding2 = ensureFunding2Panel();
      if (!funding2) return;
      closeFunding2PreviewSheet();
      funding2._funding2Reset?.();
      if (funding2.querySelector(".plan-buffer-panel__scroller")) {
        funding2.querySelector(".plan-buffer-panel__scroller").scrollTop = 0;
      }
      const confirmStep = funding2.querySelector(
        "[data-funding2-confirm-step]",
      );
      if (confirmStep) {
        confirmStep.hidden = true;
        confirmStep.classList.remove("is-open");
      }
      const overviewStep = funding2.querySelector(
        "[data-funding2-overview-step]",
      );
      if (overviewStep) {
        overviewStep.hidden = true;
        overviewStep.classList.remove("is-open");
      }
      const funding2SuccessStep = funding2.querySelector(
        "[data-funding2-success-step]",
      );
      if (funding2SuccessStep) {
        funding2SuccessStep.hidden = true;
        funding2SuccessStep.classList.remove("is-open");
      }
      funding2PrefundSuccessLoaderGen += 1;
      const openFl = funding2.querySelector("[data-funding2-submit-loader]");
      if (openFl) openFl.hidden = true;
      const learnMorePanel = funding2.querySelector(
        "[data-plan-buffer-learn-more-panel]",
      );
      if (learnMorePanel) {
        learnMorePanel.hidden = true;
        learnMorePanel.classList.remove("is-open");
      }
      planBufferApi.applyFundingViewToRoot?.(funding2, "amount");
      // Reset/sync may run while the clone still matched the base panel’s tab (e.g. period).
      // Re-sync after forcing "By amount" so hero subtitle / per-buy prefix match schedule (e.g. flexible).
      if (typeof funding2._funding2Sync === "function")
        funding2._funding2Sync();
      funding2.hidden = false;
      requestAnimationFrame(() => funding2.classList.add("is-open"));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const reserveInput = funding2.querySelector(
            "[data-plan-buffer-reserve-input]",
          );
          if (!(reserveInput instanceof HTMLInputElement)) return;
          reserveInput.focus();
          const endPos = reserveInput.value.length;
          reserveInput.setSelectionRange(endPos, endPos);
        });
      });
      if (!teardownPlanFlow) return;
      let cleaned = false;
      const cleanupPlanFlow = () => {
        if (cleaned) return;
        cleaned = true;
        funding2.removeEventListener("transitionend", cleanupPlanFlow);
        // Keep success visible during Funding 2 entrance, then tear down the full plan flow behind it.
        planSuccessApi.forceClose();
        planOverviewApi.close({ instant: true });
        planBufferApi.close({ instant: true });
        setOpen(false);
      };
      funding2.addEventListener("transitionend", cleanupPlanFlow);
      setTimeout(cleanupPlanFlow, 380);
    };

    const openFunding2FromSuccess = () => {
      if (myPlansSubmittedPlan) {
        funding2ContextRecord = { ...myPlansSubmittedPlan };
      }
      openFunding2Flow({ teardownPlanFlow: true });
    };

    document.addEventListener("open-funding2-flow", () => {
      openFunding2Flow({ teardownPlanFlow: false });
    });

    const ensureTopSnackbar = () => {
      if (snackbarEl && snackbarEl.isConnected) return snackbarEl;
      snackbarEl = document.createElement("div");
      snackbarEl.className = "snackbar";
      snackbarEl.setAttribute("role", "status");
      snackbarEl.setAttribute("aria-live", "polite");
      snackbarEl.innerHTML = `
        <span class="snackbar__icon" aria-hidden="true">
          <img src="assets/icon_timeline_activewarning.svg" alt="" />
        </span>
        <span data-plan-detail-snackbar-text></span>
      `;
      (container || panel).appendChild(snackbarEl);
      return snackbarEl;
    };

    const showTopSnackbar = (message, opts = {}) => {
      const el = ensureTopSnackbar();
      const variant = opts.variant || "default";
      const textEl = el.querySelector("[data-plan-detail-snackbar-text]");
      if (textEl) textEl.textContent = String(message || "");
      el.classList.toggle(
        "snackbar--alloc-picker-max",
        variant === "alloc-picker-max",
      );
      const iconImg = el.querySelector(".snackbar__icon img");
      if (iconImg) {
        iconImg.setAttribute(
          "src",
          variant === "alloc-picker-max"
            ? "assets/icon_info_blue.svg"
            : "assets/icon_timeline_activewarning.svg",
        );
      }
      if (snackbarTimer) clearTimeout(snackbarTimer);
      el.classList.remove("is-visible");
      void el.offsetWidth;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add("is-visible");
        });
      });
      snackbarTimer = setTimeout(() => {
        el.classList.remove("is-visible", "snackbar--alloc-picker-max");
        if (iconImg)
          iconImg.setAttribute("src", "assets/icon_timeline_activewarning.svg");
        snackbarTimer = null;
      }, 1800);
    };

    const planAllocation = {
      bitcoin: [
        {
          name: "Bitcoin",
          ticker: "BTC",
          icon: "assets/icon_currency_btc.svg",
        },
      ],
      ethereum: [
        {
          name: "Ethereum",
          ticker: "ETH",
          icon: "assets/icon_currency_eth.svg",
        },
      ],
      solana: [
        { name: "Solana", ticker: "SOL", icon: "assets/icon_solana.svg" },
      ],
      bigthree: [
        {
          name: "Bitcoin",
          ticker: "BTC",
          icon: "assets/icon_currency_btc.svg",
        },
        {
          name: "Ethereum",
          ticker: "ETH",
          icon: "assets/icon_currency_eth.svg",
        },
        { name: "Solana", ticker: "SOL", icon: "assets/icon_solana.svg" },
      ],
      digitalgold: [
        {
          name: "Bitcoin",
          ticker: "BTC",
          icon: "assets/icon_currency_btc.svg",
        },
        {
          name: "Tether Gold",
          ticker: "XAUT",
          icon: "assets/icon_currency_xaut.svg",
        },
      ],
      aiessentials: [
        {
          name: "Render",
          ticker: "RENDER",
          icon: "assets/icon_currency_render.svg",
        },
        { name: "NEAR", ticker: "NEAR", icon: "assets/icon_currency_near.svg" },
        { name: "Solana", ticker: "SOL", icon: "assets/icon_solana.svg" },
      ],
    };

    const planTicker = {
      bitcoin: "BTC",
      ethereum: "ETH",
      solana: "SOL",
      bigthree: "BTC · ETH · SOL",
      digitalgold: "BTC · XAUT",
      aiessentials: "RENDER, NEAR, SOL",
    };

    const mapCuratedKeyToThemeCategory = (key) => {
      const k = String(key || "").toLowerCase();
      if (k === "aiessentials") return "ai";
      if (k === "digitalgold") return "rwa";
      if (k === "bigthree") return "defi";
      return "all";
    };

    const pickableCoins = [
      {
        key: "btc",
        name: "Bitcoin",
        ticker: "BTC",
        icon: "assets/icon_currency_btc.svg",
        ret: "121.23%",
        categories: ["gold", "defi", "l1"],
      },
      {
        key: "eth",
        name: "Ethereum",
        ticker: "ETH",
        icon: "assets/icon_currency_eth.svg",
        ret: "73.88%",
        categories: ["defi", "l1", "nft"],
      },
      {
        key: "sol",
        name: "Solana",
        ticker: "SOL",
        icon: "assets/icon_solana.svg",
        ret: "142.11%",
        categories: ["ai", "l1", "gaming", "nft", "metaverse"],
      },
      {
        key: "xaut",
        name: "Tether Gold",
        ticker: "XAUT",
        icon: "assets/icon_currency_xaut.svg",
        ret: "28.30%",
        categories: ["rwa", "gold"],
      },
      {
        key: "render",
        name: "Render",
        ticker: "RENDER",
        icon: "assets/icon_currency_render.svg",
        ret: "65.20%",
        categories: ["ai", "metaverse"],
      },
      {
        key: "near",
        name: "NEAR",
        ticker: "NEAR",
        icon: "assets/icon_currency_near.svg",
        ret: "41.80%",
        categories: ["ai", "l1", "storage"],
      },
      {
        key: "link",
        name: "Chainlink",
        ticker: "LINK",
        icon: "assets/icon_currency_link.svg",
        ret: "35.60%",
        categories: ["defi", "rwa"],
      },
      {
        key: "xrp",
        name: "XRP",
        ticker: "XRP",
        icon: "assets/icon_currency_xrp.svg",
        ret: "44.20%",
        categories: ["l1"],
      },
    ];

    const themeCategories = [
      {
        key: "all",
        label: "All",
        hintLabel: "All coins",
        iconOff: "assets/icon_cat_all_off.svg",
        iconOn: "assets/icon_cat_all_on.svg",
      },
      {
        key: "ai",
        label: "AI",
        iconOff: "assets/icon_cat_ai_off.svg",
        iconOn: "assets/icon_cat_ai_on.svg",
      },
      {
        key: "gold",
        label: "Gold",
        iconOff: "assets/icon_cat_gold_off.svg",
        iconOn: "assets/icon_cat_gold_on.svg",
      },
      {
        key: "rwa",
        label: "RWA",
        iconOff: "assets/icon_cat_rwa_off.svg.svg",
        iconOn: "assets/icon_cat_rwa_on.svg",
      },
      {
        key: "l1",
        label: "L1",
        iconOff: "assets/icon_cat_l1_off.svg",
        iconOn: "assets/icon_cat_l1_on.svg",
      },
      {
        key: "l2",
        label: "L2",
        iconOff: "assets/icon_cat_l2_off.svg",
        iconOn: "assets/icon_cat_l2_on.svg",
      },
      {
        key: "defi",
        label: "DeFi",
        iconOff: "assets/icon_cat_defi_off.svg",
        iconOn: "assets/icon_cat_defi_on.svg",
      },
      {
        key: "gaming",
        label: "Gaming",
        iconOff: "assets/icon_cat_game_off.svg",
        iconOn: "assets/icon_cat_game_on.svg",
      },
      {
        key: "storage",
        label: "Storage",
        iconOff: "assets/icon_cat_storage_off.svg",
        iconOn: "assets/icon_cat_storage_on.svg",
      },
      {
        key: "restake",
        label: "Restake",
        iconOff: "assets/icon_cat_restake_off.svg",
        iconOn: "assets/icon_cat_restake_on.svg",
      },
      {
        key: "meme",
        label: "Meme",
        iconOff: "assets/icon_cat_meme_off.svg",
        iconOn: "assets/icon_cat_meme_on.svg",
      },
      {
        key: "nft",
        label: "NFT",
        iconOff: "assets/icon_cat_nft_off.svg",
        iconOn: "assets/icon_cat_nft_on.svg",
      },
      {
        key: "metaverse",
        label: "Metaverse",
        iconOff: "assets/icon_cat_metaverse_off.svg",
        iconOn: "assets/icon_cat_metaverse_on.svg",
      },
    ];

    const pickerCurated = [
      {
        key: "bigthree",
        icon: "assets/icon_bigthree.svg",
        title: "Big Three",
        tickers: "BTC · ETH · SOL",
        desc: "DCA into the top three cryptos",
      },
      {
        key: "digitalgold",
        icon: "assets/icon_digitalgold.svg",
        title: "Digital gold",
        tickers: "BTC · XAUT",
        desc: "Tokenized Gold and Bitcoin combined",
      },
      {
        key: "aiessentials",
        icon: "assets/icon_aiessentials.svg",
        title: "AI essentials",
        tickers: "RENDER · NEAR · SOL",
        desc: "Leading AI projects and platforms",
      },
    ];

    let detailAllocOverride = null;
    let latestAllocItemCount = 0;
    const HISTORIC_TONE_DEFAULT_MARKUP = `
      <div class="plan-detail-panel__return-pct-inline plan-detail-panel__return-pct-inline--historic plan-return-metric__pct-line--historic">
        <img src="assets/icon_northeast_arrow.svg" alt="" class="plan-detail-panel__return-arrow plan-return-metric__arrow plan-return-metric__arrow--historic" />
        <span class="plan-return-metric__pct plan-return-metric__pct--historic" data-plan-detail-return-historic-pct>0.0%</span>
      </div>
    `;

    const getManualAllocSection = () =>
      panel.querySelector(
        ".plan-detail-panel__allocation-section:not(.plan-detail-panel__allocation-section--auto)",
      );
    const getOrCreateHistoricToneNode = (section = getManualAllocSection()) => {
      if (!section) return null;
      let tone = section.querySelector(
        "[data-plan-detail-historic-performance-tone]",
      );
      if (tone) return tone;
      const headerHistoric = section.querySelector(
        "[data-plan-detail-alloc-header-historic]",
      );
      if (!headerHistoric) return null;
      tone = document.createElement("div");
      tone.setAttribute("data-plan-detail-historic-performance-tone", "");
      tone.dataset.historicToneMarkupDefault =
        HISTORIC_TONE_DEFAULT_MARKUP.trim();
      tone.innerHTML = HISTORIC_TONE_DEFAULT_MARKUP;
      const labelRow = headerHistoric.querySelector(
        "[data-plan-detail-alloc-historic-label-row]",
      );
      const belowLabel = headerHistoric.querySelector(
        ".plan-detail-panel__historic-performance-label--below",
      );
      const historicAnchor = labelRow || belowLabel;
      if (historicAnchor)
        headerHistoric.insertBefore(tone, historicAnchor.nextSibling);
      else headerHistoric.appendChild(tone);
      return tone;
    };
    const getAutoAllocSection = () =>
      panel.querySelector("[data-plan-detail-allocation-auto-section]");
    const getActiveAllocSection = () => {
      const useSmart = getPrototypeSmartAllocationEnabled();
      const manualSection = getManualAllocSection();
      const autoSection = getAutoAllocSection();
      if (useSmart && autoSection && !autoSection.hidden) return autoSection;
      if (manualSection && !manualSection.hidden) return manualSection;
      if (autoSection && !autoSection.hidden) return autoSection;
      return manualSection || autoSection || null;
    };
    const getActiveAllocMultiRoot = () =>
      getActiveAllocSection()?.querySelector(".alloc-multi") || null;
    const getActiveAllocMultiItems = () =>
      Array.from(
        getActiveAllocSection()?.querySelectorAll(".alloc-multi__item") || [],
      );
    const syncActiveAllocationVariant = () => {
      const manualSection = getManualAllocSection();
      const autoSection = getAutoAllocSection();
      const useSmart = getPrototypeSmartAllocationEnabled();
      const canUseSmart = useSmart && latestAllocItemCount >= 2;
      if (manualSection) manualSection.hidden = canUseSmart;
      if (autoSection) autoSection.hidden = !canUseSmart;
      detailPanelAllocPctTweakFn = canUseSmart
        ? panel._planDetailAutoAllocTweakFn ||
          panel._planDetailManualAllocTweakFn ||
          null
        : panel._planDetailManualAllocTweakFn ||
          panel._planDetailAutoAllocTweakFn ||
          null;
    };
    const syncManualAllocHistoricInline = () => {
      const manualSection = getManualAllocSection();
      if (!manualSection) return;
      const headerHistoric = manualSection.querySelector(
        "[data-plan-detail-alloc-header-historic]",
      );
      const tone = getOrCreateHistoricToneNode(manualSection);
      if (!headerHistoric || !tone) return;
      const labelRow = headerHistoric.querySelector(
        "[data-plan-detail-alloc-historic-label-row]",
      );
      const belowLabel = headerHistoric.querySelector(
        ".plan-detail-panel__historic-performance-label--below",
      );
      const historicAnchor = labelRow || belowLabel;
      const isSingle = latestAllocItemCount === 1;
      manualSection.classList.toggle("is-single-asset", isSingle);
      manualSection.classList.toggle(
        "is-multi-asset",
        latestAllocItemCount >= 2,
      );
      if (isSingle) {
        const firstItem = manualSection.querySelector(
          "[data-plan-detail-allocation] .plan-detail-panel__alloc-item",
        );
        if (firstItem && !firstItem.contains(tone)) firstItem.appendChild(tone);
      } else if (historicAnchor) {
        if (
          tone.parentElement !== headerHistoric ||
          tone.previousElementSibling !== historicAnchor
        ) {
          headerHistoric.insertBefore(tone, historicAnchor.nextSibling);
        }
      } else if (tone.parentElement !== headerHistoric) {
        headerHistoric.appendChild(tone);
      }
      const footerHistoricPct = panel
        .querySelector("[data-plan-detail-return-historic-pct]")
        ?.textContent?.trim();
      const manualHistoricPct = tone.querySelector(
        "[data-plan-detail-return-historic-pct]",
      );
      if (footerHistoricPct && manualHistoricPct) {
        manualHistoricPct.textContent = footerHistoricPct;
      }
    };

    const BALANCES = PROTOTYPE_BALANCES;

    const applyPlanDetailAllocTweakToSim = (sim, amount) => {
      if (!sim || typeof detailPanelAllocPctTweakFn !== "function") return sim;
      const tw = detailPanelAllocPctTweakFn();
      if (!isFinite(tw)) return sim;
      const next = { ...sim };
      const simBasePct = Number.isFinite(sim.returnPct) ? sim.returnPct : 0;
      const simAppliedTw = amount > 0 ? tw : 0;
      const simNextPct = simBasePct + simAppliedTw;
      next.returnPct = simNextPct;
      if (Number.isFinite(sim.profit) && Math.abs(simBasePct) > 1e-6) {
        next.profit = sim.profit * (simNextPct / simBasePct);
      }
      if (Number.isFinite(sim.historicReturnPct)) {
        next.historicReturnPct = sim.historicReturnPct + tw;
      }
      return next;
    };

    const computePlanDetailPanelFooterSimRaw = () => {
      const amountEl = panel.querySelector("[data-plan-detail-amount-input]");
      const amount =
        parseInt(String(amountEl?.value || "").replace(/[^0-9]/g, ""), 10) || 0;
      const selectedAssets = getCurrentPlanDisplayAssets(
        "assets/icon_currency_btc.svg",
      );
      const range = rangeState.plan || "5Y";
      const freq = (
        document
          .querySelector("[data-plan-freq-item].is-active")
          ?.getAttribute("data-plan-freq-item") || "monthly"
      ).toLowerCase();
      const ctx = panelOpenContext;
      const overrideCuratedKey =
        detailAllocOverride?.kind === "curated" && detailAllocOverride.key
          ? String(detailAllocOverride.key).toLowerCase()
          : "";
      const effectiveCuratedKey =
        ctx.source === "curated" && ctx.curatedKey
          ? String(ctx.curatedKey).toLowerCase()
          : overrideCuratedKey;
      let planKeyOpt;
      if (effectiveCuratedKey) planKeyOpt = effectiveCuratedKey;
      else if (ctx.source === "spotlight" && ctx.spotlightKey) {
        planKeyOpt = String(ctx.spotlightKey).toLowerCase();
      }

      return updatePlanStrategyHistoricalReturn({
        detailPanel: true,
        amount,
        planKey: planKeyOpt,
        freq,
        historicalRangeKey: range,
        domWrite: false,
        displayAssets: selectedAssets,
      });
    };

    const computePlanDetailPanelFooterSimTweaked = () => {
      const amountEl = panel.querySelector("[data-plan-detail-amount-input]");
      const amount =
        parseInt(String(amountEl?.value || "").replace(/[^0-9]/g, ""), 10) || 0;
      const sim = computePlanDetailPanelFooterSimRaw();
      return applyPlanDetailAllocTweakToSim(sim, amount);
    };

    const readPlanDetailFooterGateState = () => {
      const allocCount =
        parseInt(
          panel
            .querySelector("[data-plan-detail-alloc-count]")
            ?.textContent?.trim() || "0",
          10,
        ) || 0;
      const amount = parseInt(
        panel
          .querySelector("[data-plan-detail-amount-input]")
          ?.value?.replace(/[^0-9]/g, "") || "0",
        10,
      );
      const cur = currencyState.plan;
      const balance = BALANCES[cur] ?? BALANCES.TWD;

      const noAssets = allocCount < 1;
      const noAmount = !amount || amount <= 0;
      const exceedsBalance = amount > balance;
      const shouldBlockOneBuyBalance =
        ENABLE_PLAN_AMOUNT_ONE_BUY_ERROR && exceedsBalance;

      let allocationOutOfBalance = false;
      const allocRoot = getActiveAllocMultiRoot();
      const isSmartAllocUi = Boolean(
        allocRoot?.classList.contains("alloc-multi--auto"),
      );
      if (allocRoot && allocCount >= 2 && !isSmartAllocUi) {
        const rows = allocRoot.querySelectorAll(
          ".alloc-multi__item [data-alloc-pct-input]",
        );
        if (rows.length >= 2) {
          if (allocRoot.classList.contains("alloc-multi--amount-mode")) {
            let sumAmt = 0;
            rows.forEach((inp) => {
              const v = parseInt(
                String(inp.value || "").replace(/[^0-9]/g, ""),
                10,
              );
              if (!isNaN(v)) sumAmt += v;
            });
            allocationOutOfBalance = amount > 0 && sumAmt !== amount;
          } else {
            let sumPct = 0;
            rows.forEach((inp) => {
              const v = parseInt(
                String(inp.value || "").replace(/[^0-9]/g, ""),
                10,
              );
              if (!isNaN(v)) sumPct += v;
            });
            allocationOutOfBalance = Math.abs(sumPct - 100) > 0.51;
          }
        }
      }

      const isPctAllocInvalid =
        Boolean(allocRoot) &&
        allocCount >= 2 &&
        !allocRoot.classList.contains("alloc-multi--amount-mode") &&
        allocationOutOfBalance;

      return {
        allocCount,
        amount,
        cur,
        balance,
        noAssets,
        noAmount,
        shouldBlockOneBuyBalance,
        allocationOutOfBalance,
        isPctAllocInvalid,
        allocRoot,
      };
    };

    const syncPlanDetailFooterInvestmentDisplay = (gate) => {
      const footerEl = panel.querySelector("[data-plan-detail-footer]");
      const investedEl = panel.querySelector(
        "[data-plan-detail-footer-invested-line]",
      );
      const valueAmtEl = panel.querySelector(
        "[data-plan-detail-footer-value-amount]",
      );
      const histPctEl = panel.querySelector(
        "[data-plan-detail-return-historic-pct]",
      );
      const autoHistPctEl = panel.querySelector(
        "[data-plan-detail-alloc-auto-historic-pct]",
      );
      const histToneRoot = panel.querySelector(
        "[data-plan-detail-historic-performance-tone]",
      );
      if (!footerEl || !investedEl || !valueAmtEl) return;

      footerEl.classList.remove(
        "plan-detail-panel__footer--state-missing",
        "plan-detail-panel__footer--state-error",
        "plan-detail-panel__footer--state-ok",
      );

      const curLabel = String(
        panel.querySelector("[data-plan-detail-currency]")?.textContent ||
          gate.cur ||
          "TWD",
      ).trim();
      const {
        noAssets,
        noAmount,
        shouldBlockOneBuyBalance,
        allocationOutOfBalance,
      } = gate;

      footerEl.removeAttribute("data-alloc-base-total");
      footerEl.removeAttribute("data-alloc-base-profit");
      footerEl.removeAttribute("data-alloc-base-pct");

      if (noAssets || noAmount) {
        footerEl.classList.add("plan-detail-panel__footer--state-missing");
        setPlanDetailFooterMetricsMissing(curLabel);
        return;
      }

      if (shouldBlockOneBuyBalance || allocationOutOfBalance) {
        footerEl.classList.add("plan-detail-panel__footer--state-error");
        setPlanDetailFooterMetricsError(curLabel);
        return;
      }

      footerEl.classList.add("plan-detail-panel__footer--state-ok");
      const sim = computePlanDetailPanelFooterSimTweaked();
      if (!sim) return;
      const totalInvested = Math.round(
        Number.isFinite(sim.totalInvested) ? sim.totalInvested : 0,
      );
      const profit = Number.isFinite(sim.profit) ? sim.profit : 0;
      const value = Math.round(totalInvested + profit);
      investedEl.textContent = `${formatPlanDetailFooterMoney(totalInvested, curLabel)} ${curLabel} invested →`;
      setPlanDetailFooterSimulatedValueDisplay(value, curLabel);
      if (Number.isFinite(sim.historicReturnPct)) {
        const histText = `${sim.historicReturnPct.toLocaleString("en-US", {
          maximumFractionDigits: 1,
          minimumFractionDigits: 1,
        })}%`;
        if (histPctEl) {
          histPctEl.textContent = histText;
          histPctEl.dataset.allocBaseHistPct = String(sim.historicReturnPct);
        }
        if (autoHistPctEl) autoHistPctEl.textContent = histText;
        if (histToneRoot)
          setReturnMetricTone(histToneRoot, sim.historicReturnPct);
      }
    };

    const syncPlanDetailContinueState = () => {
      const continueBtn = panel.querySelector(".plan-detail-panel__continue");
      if (!continueBtn) return;
      const breakdownBtn = panel.querySelector(
        ".plan-detail-panel__view-breakdown-link",
      );

      const gate = readPlanDetailFooterGateState();
      const {
        noAssets,
        noAmount,
        shouldBlockOneBuyBalance,
        allocationOutOfBalance,
        isPctAllocInvalid,
      } = gate;

      continueBtn.disabled = false;
      if (breakdownBtn)
        breakdownBtn.disabled = noAssets || noAmount || isPctAllocInvalid;

      syncPlanDetailFooterInvestmentDisplay(gate);
      // Restore footer sim snapshot after display sync (sync clears data-alloc-base-*); needed for historic % tweak.
      if (
        !noAssets &&
        !noAmount &&
        !shouldBlockOneBuyBalance &&
        !allocationOutOfBalance
      ) {
        snapshotFooterAllocBases();
      }
      applyFooterAllocSliderTweak();
    };

    /** Plan detail repeats line reflects schedule end: Set a limit (enddate) vs Continuous / After N buys. */
    const isPlanDetailSetLimitEnd = (text) => {
      const t = String(text || "").trim();
      const tl = t.toLowerCase();
      if (!t) return false;
      // Guard continuous variants (including legacy typo "Continuous").
      if (tl.includes("continuous") || tl.includes("Continuous")) return false;
      if (tl.startsWith("after")) return false;
      if (t === "End on date") return true;
      if (!/\b(buy|buys)\b/i.test(t)) return false;
      return (
        t.includes("~ Ends") ||
        t.includes("Ends ~") ||
        /\bEnds\s+[\w\s,.]+\s*~\s*$/i.test(t)
      );
    };

    /** "Total planned investment" row only for Set a limit; Continuous uses current balance + cover + hint (Figma 8527:4820 / 8527:4835). */
    const syncPlanDetailSetLimitDetailRowsVisibility = () => {
      const totalPlannedRow = panel.querySelector(
        "[data-plan-detail-total-planned-row]",
      );
      const endEl = panel.querySelector("[data-plan-detail-repeats-end]");
      const endText = String(
        endEl?.dataset?.endConditionText || endEl?.textContent || "",
      );
      const show = isPlanDetailSetLimitEnd(endText);
      if (totalPlannedRow) totalPlannedRow.hidden = !show;
    };

    // Recalculate header "Avail.", Details rows (Figma 8527:4820 / 8527:4835), and balance-can-cover copy.
    const updateCoverageUI = () => {
      const cur = currencyState.plan;
      const balance = BALANCES[cur] ?? BALANCES.TWD;

      // "Avail. - - TWD" (visitor mode — no balance shown)
      const availEl = panel.querySelector(".plan-detail-panel__avail-text");
      if (availEl) {
        availEl.innerHTML = `Avail. - - <span data-plan-detail-coverage-currency>${cur}</span>`;
      }

      const currentBalanceEl = panel.querySelector(
        "[data-plan-detail-current-balance]",
      );
      if (currentBalanceEl) {
        currentBalanceEl.textContent = `${balance.toLocaleString("en-US")} ${cur}`;
      }

      const totalPlannedEl = panel.querySelector(
        "[data-plan-detail-total-planned]",
      );
      const coverageValueEl = panel.querySelector(
        "[data-plan-detail-coverage-value]",
      );
      const errorEl = panel.querySelector("[data-plan-detail-amount-error]");
      const errorCurEl = errorEl?.querySelector(
        "[data-plan-detail-error-currency]",
      );

      // Keep error currency label in sync
      if (errorCurEl) errorCurEl.textContent = cur;

      const setError = (isError, message = null) => {
        if (coverageValueEl)
          coverageValueEl.style.color = isError ? "#EB5347" : "";
        if (errorEl) errorEl.classList.toggle("is-visible", isError);
        if (errorEl && typeof message === "string" && message.trim()) {
          errorEl.innerHTML = `${message}${message.includes(cur) ? "" : ` <span data-plan-detail-error-currency></span>`}`;
        }
      };

      if (!coverageValueEl) return;
      const syncCoveragePlaceholderTone = (el) => {
        if (!el) return;
        const t = String(el.textContent || "").trim();
        const isPlaceholder = t === "- -" || t === "—";
        el.classList.toggle(
          "plan-detail-panel__coverage-value--placeholder",
          isPlaceholder,
        );
      };

      const getRepeatsEndText = () => {
        const endEl = panel.querySelector("[data-plan-detail-repeats-end]");
        return String(
          endEl?.dataset?.endConditionText || endEl?.textContent || "",
        ).trim();
      };

      const parseLimitBuysFromRepeatsEnd = (endT) => {
        const lead = String(endT || "").match(/^(\d+)/);
        const n = lead ? parseInt(lead[1], 10) : NaN;
        return Number.isFinite(n) && n >= 1 ? n : NaN;
      };

      /** Set a limit: total planned = auto-invest × scheduled buys (Figma 8527:4835). */
      const refillTotalPlannedForSetLimit = () => {
        if (!totalPlannedEl) return;
        const endT = getRepeatsEndText();
        if (!isPlanDetailSetLimitEnd(endT)) return;
        const amt = parseInt(
          amountInput?.value?.replace(/[^0-9]/g, "") || "0",
          10,
        );
        if (!amt || amt <= 0) {
          totalPlannedEl.textContent = "- -";
          syncCoveragePlaceholderTone(totalPlannedEl);
          return;
        }
        const limitBuys = parseLimitBuysFromRepeatsEnd(endT);
        if (!Number.isFinite(limitBuys)) {
          totalPlannedEl.textContent = "- -";
          syncCoveragePlaceholderTone(totalPlannedEl);
          return;
        }
        totalPlannedEl.textContent = `${(amt * limitBuys).toLocaleString("en-US")} ${cur}`;
        syncCoveragePlaceholderTone(totalPlannedEl);
      };

      const formatCoverageBuysValue = (balanceBuys, endT) => {
        const setLimit = isPlanDetailSetLimitEnd(endT);
        const limitBuys = setLimit ? parseLimitBuysFromRepeatsEnd(endT) : NaN;
        const raw = Math.max(0, Math.floor(balanceBuys));
        if (setLimit && Number.isFinite(limitBuys)) {
          const shown = Math.min(raw, limitBuys);
          const limWord = limitBuys === 1 ? "buy" : "buys";
          return `~${shown} / ${limitBuys} ${limWord}`;
        }
        const buyWord = raw === 1 ? "buy" : "buys";
        return `~${raw} ${buyWord}`;
      };

      const HINT_NEUTRAL = "";
      const HINT_ERROR = "Not enough for 1 buy";
      const HINT_OK = "Enough for 1 buy";

      const syncPlanDetailCoverageHint = ({ hasAmount, balanceBuys }) => {
        const hintEl = panel.querySelector("[data-plan-detail-coverage-hint]");
        if (!hintEl) return;
        hintEl.classList.remove(
          "plan-detail-panel__coverage-hint--neutral",
          "plan-detail-panel__coverage-hint--error",
          "plan-detail-panel__coverage-hint--ok",
        );
        if (!hasAmount) {
          hintEl.classList.add("plan-detail-panel__coverage-hint--neutral");
          hintEl.textContent = HINT_NEUTRAL;
          return;
        }
        if (balanceBuys <= 0) {
          hintEl.classList.add("plan-detail-panel__coverage-hint--error");
          hintEl.textContent = HINT_ERROR;
          return;
        }
        hintEl.classList.add("plan-detail-panel__coverage-hint--ok");
        hintEl.textContent = HINT_OK;
      };

      const amount = parseInt(
        amountInput?.value?.replace(/[^0-9]/g, "") || "0",
        10,
      );
      const endT = getRepeatsEndText();

      if (!amount || amount <= 0) {
        coverageValueEl.textContent = "- -";
        setError(false);
        syncCoveragePlaceholderTone(coverageValueEl);
        refillTotalPlannedForSetLimit();
        syncPlanDetailSetLimitDetailRowsVisibility();
        syncPlanDetailCoverageHint({ hasAmount: false, balanceBuys: 0 });
        return;
      }

      if (amount > balance) {
        coverageValueEl.textContent = formatCoverageBuysValue(0, endT);
        setError(
          ENABLE_PLAN_AMOUNT_ONE_BUY_ERROR,
          ENABLE_PLAN_AMOUNT_ONE_BUY_ERROR
            ? "Not enough balance for one buy"
            : null,
        );
        syncCoveragePlaceholderTone(coverageValueEl);
        refillTotalPlannedForSetLimit();
        syncPlanDetailSetLimitDetailRowsVisibility();
        syncPlanDetailCoverageHint({ hasAmount: true, balanceBuys: 0 });
        return;
      }

      // How many buys fit in the available balance (same for daily / weekly / monthly).
      const buys = Math.floor(balance / amount);

      if (buys === 0) {
        coverageValueEl.textContent = formatCoverageBuysValue(0, endT);
        setError(
          ENABLE_PLAN_AMOUNT_ONE_BUY_ERROR,
          ENABLE_PLAN_AMOUNT_ONE_BUY_ERROR
            ? `Not enough <span data-plan-detail-error-currency>${cur}</span> for one buy`
            : null,
        );
        syncCoveragePlaceholderTone(coverageValueEl);
        refillTotalPlannedForSetLimit();
        syncPlanDetailSetLimitDetailRowsVisibility();
        syncPlanDetailCoverageHint({ hasAmount: true, balanceBuys: 0 });
        return;
      }

      setError(false);
      coverageValueEl.textContent = formatCoverageBuysValue(buys, endT);
      syncCoveragePlaceholderTone(coverageValueEl);
      refillTotalPlannedForSetLimit();
      syncPlanDetailSetLimitDetailRowsVisibility();
      syncPlanDetailCoverageHint({ hasAmount: true, balanceBuys: buys });
      syncPlanDetailContinueState();
    };

    // Sync simulation title from the main widget (footer totals come from updateDetailReturn / gate state).
    const syncFooterFromMainWidget = () => {
      const titleEl = panel.querySelector("[data-plan-detail-return-title]");
      if (titleEl) {
        titleEl.textContent =
          document.querySelector("[data-plan-return-title]")?.textContent ||
          titleEl.textContent;
      }
    };

    // ── Multi-asset allocation sliders ────────────────────────────────────────
    // Called after multi-asset HTML is rendered into the allocation list.
    // Each row is edited independently; total % or amounts must match before Continue.
    const initAllocSliders = (panelEl, count) => {
      const allocPanelAbortKey = "_allocPanelControlsAbort";
      if (panelEl[allocPanelAbortKey]) panelEl[allocPanelAbortKey].abort();

      if (count < 2) {
        panelEl._planDetailManualAllocTweakFn = null;
        panelEl._planDetailAllocRefreshAmounts = null;
        const resetBtnEarly = panelEl.querySelector("[data-alloc-reset]");
        if (resetBtnEarly) resetBtnEarly.hidden = true;
        syncActiveAllocationVariant();
        return;
      }

      const panelAc = new AbortController();
      panelEl[allocPanelAbortKey] = panelAc;
      const panelCtlSignal = panelAc.signal;

      document
        .querySelector("[data-alloc-lock-tooltip]")
        ?.classList.remove("is-visible");

      const defaultPcts = count === 2 ? [50, 50] : [34, 33, 33];
      const pcts = [...defaultPcts];

      const items = Array.from(panelEl.querySelectorAll(".alloc-multi__item"));
      const allocMultiRoot = items[0]?.closest(".alloc-multi");
      /** @type {'pct' | 'amount'} */
      let inputMode = "pct";

      const getPlanDetailInvestTotal = () => {
        const inp = panelEl.querySelector("[data-plan-detail-amount-input]");
        return Math.max(
          0,
          parseInt(inp?.value?.replace(/[^0-9]/g, "") || "0", 10) || 0,
        );
      };

      const getPlanDetailCurrency = () =>
        panelEl
          .querySelector("[data-plan-detail-currency]")
          ?.textContent?.trim() || "TWD";

      const formatAllocAmountDisplay = (n) => {
        const r = Math.round(n);
        return Number.isFinite(r) ? r.toLocaleString("en-US") : "";
      };

      /** Comma-format like the main Auto-invest field; keeps cursor on digit count. */
      const applyAllocInputLiveFormat = (inp) => {
        const cursor = inp.selectionStart;
        const oldVal = inp.value;
        const digitsBeforeCursor = oldVal
          .slice(0, cursor)
          .replace(/[^0-9]/g, "").length;
        const raw = oldVal.replace(/[^0-9]/g, "");
        if (!raw) {
          inp.value = "";
          return;
        }
        const clamped = Math.min(parseInt(raw, 10), 999999999);
        const formatted = clamped.toLocaleString("en-US");
        inp.value = formatted;
        let newCursor = 0;
        let digitsSeen = 0;
        for (let k = 0; k < formatted.length; k += 1) {
          if (digitsSeen === digitsBeforeCursor) {
            newCursor = k;
            break;
          }
          if (formatted[k] !== ",") digitsSeen += 1;
          newCursor = k + 1;
        }
        inp.setSelectionRange(newCursor, newCursor);
      };

      const syncAllocInputModeClass = () => {
        if (allocMultiRoot) {
          allocMultiRoot.classList.toggle(
            "alloc-multi--amount-mode",
            inputMode === "amount",
          );
        }
      };

      const isAllocPctTotalValid = () => {
        const sum = pcts.reduce((a, b) => a + b, 0);
        return Math.abs(sum - 100) < 0.45;
      };

      /**
       * Amount mode only: dim + block allocation controls when Auto-invest can't assign
       * at least 1 unit per asset (or total is 0). % mode is always fully interactive.
       */
      const syncAllocAmountWrapDisabled = () => {
        if (!allocMultiRoot) return;
        const total = getPlanDetailInvestTotal();
        const cannotSplitWholeUnits = total > 0 && total < count;
        const wrapDisabled =
          inputMode === "amount" && (total <= 0 || cannotSplitWholeUnits);
        allocMultiRoot.classList.toggle(
          "alloc-multi--amount-wrap-disabled",
          wrapDisabled,
        );
        if (wrapDisabled) {
          const ae = document.activeElement;
          if (ae && allocMultiRoot.contains(ae)) ae.blur();
        }
      };

      const updateAllocHeaderSubtitle = () => {
        const el = panelEl.querySelector("[data-plan-detail-alloc-subtitle]");
        if (!el) return;
        const valueWrap = el.querySelector(
          "[data-plan-detail-alloc-total-value-wrap]",
        );
        const hintRow = el.querySelector("[data-plan-detail-alloc-total-hint]");
        const currentEl = el.querySelector(
          "[data-plan-detail-alloc-total-current]",
        );
        const targetEl = el.querySelector(
          "[data-plan-detail-alloc-total-target]",
        );
        const errEl = el.querySelector("[data-plan-detail-alloc-total-error]");
        const checkEl = el.querySelector(
          "[data-plan-detail-alloc-total-check]",
        );

        if (inputMode === "amount") {
          // Amount mode: show total amount-per-buy on the summary row; no /100% or allocation error.
          const total = getPlanDetailInvestTotal();
          const cur = getPlanDetailCurrency();
          const numStr = total > 0 ? total.toLocaleString("en-US") : "0";
          if (currentEl) currentEl.textContent = `${numStr} ${cur}`;
          if (targetEl) targetEl.textContent = "";
          if (errEl) errEl.hidden = true;
          if (currentEl) currentEl.classList.remove("is-error");
          if (checkEl) {
            checkEl.hidden = true;
            checkEl.setAttribute("aria-hidden", "true");
          }
          if (hintRow) hintRow.hidden = false;
          return;
        }

        const sum = pcts.reduce((a, b) => a + b, 0);
        const remainingRaw = 100 - sum;
        const isValid = isAllocPctTotalValid();
        const formatAllocTotalPct = (n) => {
          const v = Math.round(n * 10) / 10;
          if (Number.isInteger(v)) return `${v}%`;
          return `${v.toFixed(1)}%`;
        };
        if (valueWrap) valueWrap.hidden = false;
        if (currentEl) {
          if (isValid) {
            currentEl.textContent = "100%";
            currentEl.classList.remove("is-error");
          } else {
            currentEl.textContent = formatAllocTotalPct(remainingRaw);
            currentEl.classList.add("is-error");
          }
        }
        if (checkEl) {
          checkEl.hidden = !isValid;
          checkEl.setAttribute("aria-hidden", isValid ? "false" : "true");
        }
        if (targetEl) targetEl.textContent = "";
        if (errEl) {
          if (isValid) {
            errEl.hidden = true;
          } else {
            errEl.hidden = false;
            if (remainingRaw > 0.45) {
              const pct = formatAllocTotalPct(remainingRaw);
              errEl.textContent = window.I18N?.t
                ? window.I18N.t("Increase {pct} to continue", { pct })
                : `Increase ${pct} to continue`;
            } else if (remainingRaw < -0.45) {
              const pct = formatAllocTotalPct(sum - 100);
              errEl.textContent = window.I18N?.t
                ? window.I18N.t("Decrease {pct} to continue", { pct })
                : `Decrease ${pct} to continue`;
            } else {
              errEl.textContent = window.I18N?.t
                ? window.I18N.t("Allocation should add up to 100%")
                : "Allocation should add up to 100%";
            }
          }
        }
        if (hintRow) hintRow.hidden = false;
      };

      const renderItem = (i) => {
        const item = items[i];
        if (!item) return;
        const fill = item.querySelector("[data-alloc-fill]");
        const thumb = item.querySelector("[data-alloc-thumb]");
        const input = item.querySelector("[data-alloc-pct-input]");
        const symbolEl = item.querySelector(".alloc-multi__pct-symbol");
        const amountSubEl = item.querySelector("[data-alloc-pct-amount-sub]");
        const p = pcts[i] / 100;

        if (fill) fill.style.width = `${p * 100}%`;
        if (thumb) thumb.style.left = `calc(${p * 100}% - ${p * 24}px)`;
        if (symbolEl) {
          symbolEl.textContent =
            inputMode === "amount" ? getPlanDetailCurrency() : "%";
        }
        if (amountSubEl) {
          if (inputMode === "amount") {
            amountSubEl.textContent = "";
            amountSubEl.hidden = true;
            amountSubEl.setAttribute("aria-hidden", "true");
          } else {
            amountSubEl.hidden = false;
            const invest = getPlanDetailInvestTotal();
            const cur = getPlanDetailCurrency();
            const slice = invest > 0 ? Math.round((invest * pcts[i]) / 100) : 0;
            amountSubEl.textContent = `≈ ${slice.toLocaleString("en-US")} ${cur}`;
            amountSubEl.setAttribute("aria-hidden", "false");
          }
        }
        if (input && document.activeElement !== input) {
          if (inputMode === "amount") {
            const total = getPlanDetailInvestTotal();
            if (total > 0) {
              const rounded = Math.round((total * pcts[i]) / 100);
              const minOne = total >= count && rounded < 1 ? 1 : rounded;
              input.value = formatAllocAmountDisplay(minOne);
            } else {
              input.value = "";
            }
            input.setAttribute("aria-label", "Allocation amount");
            input.removeAttribute("maxlength");
          } else {
            input.value = String(Math.round(pcts[i]));
            input.setAttribute("aria-label", "Allocation percent");
            input.setAttribute("maxlength", "2");
          }
        }
      };

      const isAtDefaultAllocation = () =>
        pcts.every((p, i) => Math.abs(p - defaultPcts[i]) < 0.45);

      const updateAllocResetVisibility = () => {
        const btn = panelEl.querySelector("[data-alloc-reset]");
        if (!btn) return;
        // For multi-asset plans this action should always be available.
        btn.hidden = false;
      };

      const renderAll = () => {
        items.forEach((_, i) => renderItem(i));
        updateAllocResetVisibility();
        updateAllocHeaderSubtitle();
        if (allocMultiRoot) {
          allocMultiRoot.classList.toggle(
            "alloc-multi--pct-invalid",
            inputMode === "pct" && !isAllocPctTotalValid(),
          );
        }
        syncAllocAmountWrapDisabled();
        syncPlanDetailContinueState();
      };

      /** Slider drags update `pcts` but `renderItem` skips the focused input — blur so values stay in sync. */
      const blurAllocPctInputIfFocused = () => {
        const ae = document.activeElement;
        if (ae?.matches?.("[data-alloc-pct-input]") && panelEl.contains(ae))
          ae.blur();
      };

      /**
       * Amount mode: min % so Math.round(total × pct / 100) ≥ 1 → pct ≥ 50/t (ceil).
       * % mode: 1% floor per row; rows are independent (total can differ from 100% until user balances).
       */
      const getMinPctPerOpenSlot = () => {
        if (inputMode !== "amount") return 1;
        const t = getPlanDetailInvestTotal();
        if (!t || t <= 0) return 1;
        const need = Math.ceil(50 / t);
        const minPct = Math.max(1, Math.min(99, need));
        if (minPct * count > 100) return 1;
        return minPct;
      };

      /** Update one row only; no auto-rebalance across assets. */
      const applyAllocChange = (changedIdx, rawPct) => {
        const minSlot = getMinPctPerOpenSlot();
        let v = Math.round(rawPct);
        v = Math.max(minSlot, Math.min(99, v));
        pcts[changedIdx] = v;

        if (inputMode === "amount") {
          const t = getPlanDetailInvestTotal();
          const minS = getMinPctPerOpenSlot();
          if (
            t >= count &&
            t > 0 &&
            Math.round((t * pcts[changedIdx]) / 100) < 1
          ) {
            pcts[changedIdx] = minS;
          }
        }

        renderAll();
        refreshPlanDetailAllocTweak();
      };

      // Tiny synthetic sensitivity vs default split → footer % moves slightly (prototype only)
      const allocBaseline = [...defaultPcts];
      panelEl._planDetailManualAllocTweakFn = () => {
        const sens = count === 3 ? [0.018, 0.01, -0.007] : [0.014, -0.014];
        let t = 0;
        for (let i = 0; i < count; i += 1) {
          t += (pcts[i] - allocBaseline[i]) * sens[i];
        }
        return Math.max(-1.6, Math.min(1.6, t));
      };
      syncActiveAllocationVariant();

      items.forEach((item, i) => {
        const slider = item.querySelector("[data-alloc-slider]");
        const input = item.querySelector("[data-alloc-pct-input]");

        // Slider pointer interaction.
        // setPointerCapture keeps events routed to the slider even when the
        // pointer moves outside it or moves fast, and prevents the browser
        // from firing pointercancel due to scroll-gesture detection.
        if (slider) {
          const getSliderPct = (clientX) => {
            const rect = slider.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            return (x / rect.width) * 100;
          };

          slider.addEventListener("pointerdown", (e) => {
            e.preventDefault();
            blurAllocPctInputIfFocused();
            slider.setPointerCapture(e.pointerId);
            applyAllocChange(i, getSliderPct(e.clientX));
          });

          slider.addEventListener("pointermove", (e) => {
            if (!slider.hasPointerCapture(e.pointerId)) return;
            e.preventDefault();
            applyAllocChange(i, getSliderPct(e.clientX));
          });

          slider.addEventListener("pointerup", (e) => {
            if (slider.hasPointerCapture(e.pointerId)) {
              slider.releasePointerCapture(e.pointerId);
            }
          });

          slider.addEventListener("pointercancel", (e) => {
            if (slider.hasPointerCapture(e.pointerId)) {
              slider.releasePointerCapture(e.pointerId);
            }
          });
        }

        // % or amount input (mode toggled in header)
        if (input) {
          const ALLOC_NAME_SCROLL_TOP_PAD = 20;
          input.addEventListener("focus", () => {
            const nameEl = item.querySelector(".alloc-multi__name");
            //scrollPlanDetailContentTo(nameEl, ALLOC_NAME_SCROLL_TOP_PAD);
          });

          input.addEventListener("keydown", (e) => {
            const allowed = [
              "Backspace",
              "Delete",
              "Tab",
              "Enter",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
            ];
            if (
              !allowed.includes(e.key) &&
              !/^\d$/.test(e.key) &&
              !(e.ctrlKey || e.metaKey)
            ) {
              e.preventDefault();
            }
          });

          input.addEventListener("blur", () => {
            if (inputMode === "amount") {
              const total = getPlanDetailInvestTotal();
              const raw = parseInt(input.value.replace(/[^0-9]/g, ""), 10);
              if (!total || isNaN(raw) || raw < 1) {
                input.value =
                  total > 0
                    ? formatAllocAmountDisplay((total * pcts[i]) / 100)
                    : "";
                syncPlanDetailContinueState();
                return;
              }
              const newPct = Math.round((raw / total) * 100);
              applyAllocChange(i, newPct);
              return;
            }

            if (input.value.trim() === "") {
              pcts[i] = 0;
              renderAll();
              refreshPlanDetailAllocTweak();
              return;
            }

            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) {
              applyAllocChange(i, val);
            } else {
              input.value = String(Math.round(pcts[i]));
              syncPlanDetailContinueState();
            }
          });

          input.addEventListener("input", () => {
            if (inputMode === "amount") {
              applyAllocInputLiveFormat(input);
              syncPlanDetailContinueState();
              return;
            }
            const digits = input.value.replace(/[^0-9]/g, "").slice(0, 2);
            if (input.value !== digits) input.value = digits;
            if (input.value.trim() === "") {
              pcts[i] = 0;
              renderAll();
              refreshPlanDetailAllocTweak();
              return;
            }
            const val = parseInt(input.value, 10);
            if (!isNaN(val) && val >= 1 && val <= 99) {
              applyAllocChange(i, val);
            } else {
              syncPlanDetailContinueState();
            }
          });
        }
      });

      const resetAllocBtn = panelEl.querySelector("[data-alloc-reset]");
      if (resetAllocBtn) {
        resetAllocBtn.addEventListener(
          "click",
          () => {
            for (let j = 0; j < count; j += 1) {
              pcts[j] = defaultPcts[j];
            }
            renderAll();
            refreshPlanDetailAllocTweak();
          },
          { signal: panelCtlSignal },
        );
      }

      panelEl._planDetailAllocRefreshAmounts = () => {
        renderAll();
      };

      // Initial render
      renderAll();
      refreshPlanDetailAllocTweak();
      syncAllocInputModeClass();

      // Mode toggle (Amount / %) — inputs show % or Auto-invest × allocation
      const modeToggle = panelEl.querySelector("[data-alloc-mode-toggle]");
      if (modeToggle) {
        const pctIcon = modeToggle.querySelector("[data-pct-icon]");
        // Toggle nodes persist across opens; always start in % mode for a fresh plan view
        inputMode = "pct";
        modeToggle.querySelectorAll("[data-alloc-mode-btn]").forEach((b) => {
          b.classList.toggle("is-active", b.dataset.allocModeBtn === "pct");
        });
        if (pctIcon) pctIcon.src = "assets/icon_percentage_tab_black.svg";

        const setAllocInputMode = (mode) => {
          const next = mode === "amount" ? "amount" : "pct";
          const ae = document.activeElement;
          if (ae?.matches?.("[data-alloc-pct-input]")) ae.blur();
          inputMode = next;
          modeToggle.querySelectorAll("[data-alloc-mode-btn]").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.allocModeBtn === next);
          });
          if (pctIcon) {
            pctIcon.src =
              next === "pct"
                ? "assets/icon_percentage_tab_black.svg"
                : "assets/icon_percentage_tab_gray.svg";
          }
          syncAllocInputModeClass();
          renderAll();
        };
        modeToggle.querySelectorAll("[data-alloc-mode-btn]").forEach((btn) => {
          btn.addEventListener(
            "click",
            () =>
              setAllocInputMode(
                btn.dataset.allocModeBtn === "amount" ? "amount" : "pct",
              ),
            { signal: panelCtlSignal },
          );
        });
      }
    };

    const initAutoAllocSliders = (panelEl, autoRoot, count) => {
      const autoAbortKey = "_autoAllocPanelControlsAbort";
      if (panelEl[autoAbortKey]) panelEl[autoAbortKey].abort();
      if (!autoRoot || count < 2) {
        panelEl._planDetailAutoAllocTweakFn = null;
        syncActiveAllocationVariant();
        return;
      }

      const panelAc = new AbortController();
      panelEl[autoAbortKey] = panelAc;
      const panelCtlSignal = panelAc.signal;

      const defaultPcts = count === 2 ? [50, 50] : [34, 33, 33];
      const pcts = [...defaultPcts];
      let lockedIdx = null;
      let dragRafId = 0;
      let pendingDrag = null;
      const allocBaseline = [...defaultPcts];

      const items = Array.from(autoRoot.querySelectorAll(".alloc-multi__item"));

      const roundPct = (n) => Math.round((Number(n) || 0) * 10) / 10;

      const redistributeByWeights = (total, idxs) => {
        if (!idxs.length) return;
        const safeTotal = Math.max(0, roundPct(total));
        const currentWeights = idxs.map((idx) => Math.max(0, pcts[idx]));
        let weightSum = currentWeights.reduce((sum, v) => sum + v, 0);
        if (weightSum <= 0) {
          for (let i = 0; i < currentWeights.length; i += 1)
            currentWeights[i] = 1;
          weightSum = currentWeights.length;
        }
        const rawShares = currentWeights.map(
          (w) => (w / weightSum) * safeTotal,
        );
        let allocated = 0;
        idxs.forEach((idx, localIdx) => {
          if (localIdx === idxs.length - 1) {
            pcts[idx] = roundPct(safeTotal - allocated);
          } else {
            const share = roundPct(rawShares[localIdx]);
            pcts[idx] = share;
            allocated = roundPct(allocated + share);
          }
        });
      };

      const applyAutoAllocChange = (changedIdx, rawPct) => {
        if (lockedIdx === changedIdx) return;
        let nextChanged = roundPct(Math.max(0, Math.min(100, rawPct)));
        if (lockedIdx !== null && lockedIdx !== changedIdx) {
          const maxAllowed = Math.max(0, 100 - pcts[lockedIdx]);
          nextChanged = Math.min(nextChanged, maxAllowed);
        }
        pcts[changedIdx] = nextChanged;

        const fixedIdxs = new Set([changedIdx]);
        if (lockedIdx !== null && lockedIdx !== changedIdx)
          fixedIdxs.add(lockedIdx);
        const freeIdxs = [];
        for (let i = 0; i < count; i += 1) {
          if (!fixedIdxs.has(i)) freeIdxs.push(i);
        }
        const fixedTotal = [...fixedIdxs].reduce(
          (sum, idx) => sum + pcts[idx],
          0,
        );
        const remaining = roundPct(Math.max(0, 100 - fixedTotal));
        redistributeByWeights(remaining, freeIdxs);
        renderAll();
        refreshPlanDetailAllocTweak();
      };

      const scheduleAutoAllocDrag = (changedIdx, rawPct) => {
        pendingDrag = { changedIdx, rawPct };
        if (dragRafId) return;
        dragRafId = requestAnimationFrame(() => {
          dragRafId = 0;
          if (!pendingDrag) return;
          const next = pendingDrag;
          pendingDrag = null;
          applyAutoAllocChange(next.changedIdx, next.rawPct);
        });
      };

      panelCtlSignal.addEventListener("abort", () => {
        if (dragRafId) cancelAnimationFrame(dragRafId);
        dragRafId = 0;
        pendingDrag = null;
      });

      panelEl._planDetailAutoAllocTweakFn = () => {
        const sens = count === 3 ? [0.018, 0.01, -0.007] : [0.014, -0.014];
        let t = 0;
        for (let i = 0; i < count; i += 1) {
          t += (pcts[i] - allocBaseline[i]) * sens[i];
        }
        return Math.max(-1.6, Math.min(1.6, t));
      };
      syncActiveAllocationVariant();

      const renderItem = (i) => {
        const item = items[i];
        if (!item) return;
        const fill = item.querySelector("[data-auto-alloc-fill]");
        const thumb = item.querySelector("[data-auto-alloc-thumb]");
        const input = item.querySelector("[data-auto-alloc-pct-input]");
        const amountSubEl = item.querySelector(
          "[data-auto-alloc-pct-amount-sub]",
        );
        const lockLabelEl = item.querySelector("[data-auto-alloc-lock-label]");
        const lockBtn = item.querySelector("[data-auto-alloc-lock-btn]");
        const lockVisual = item.querySelector(".alloc-multi__auto-lock-btn");
        const lockIcon = item.querySelector("[data-auto-alloc-lock-icon]");
        const p = pcts[i] / 100;
        if (fill) fill.style.width = `${p * 100}%`;
        if (thumb) thumb.style.left = `calc(${p * 100}% - ${p * 24}px)`;
        if (input && document.activeElement !== input)
          input.value = String(Math.round(pcts[i]));
        if (amountSubEl) {
          const invest = Math.max(
            0,
            parseInt(
              panelEl
                .querySelector("[data-plan-detail-amount-input]")
                ?.value?.replace(/[^0-9]/g, "") || "0",
              10,
            ) || 0,
          );
          const cur =
            panelEl
              .querySelector("[data-plan-detail-currency]")
              ?.textContent?.trim() || "TWD";
          const slice = invest > 0 ? Math.round((invest * pcts[i]) / 100) : 0;
          amountSubEl.textContent = `≈ ${slice.toLocaleString("en-US")} ${cur}`;
        }
        const isLocked = lockedIdx === i;
        item.classList.toggle("is-locked", isLocked);
        if (lockLabelEl) {
          lockLabelEl.textContent = isLocked
            ? `Holding at ${Math.round(pcts[i])}%`
            : "Hold this %";
        }
        if (lockLabelEl) lockLabelEl.classList.toggle("is-locked", isLocked);
        if (lockBtn) {
          lockBtn.setAttribute("aria-pressed", isLocked ? "true" : "false");
        }
        if (lockVisual) lockVisual.classList.toggle("is-locked", isLocked);
        if (lockIcon) {
          lockIcon.src = isLocked
            ? "assets/icon_lock.svg"
            : "assets/icon_unlock.svg";
        }
        if (input) {
          input.disabled = isLocked;
          input.setAttribute("aria-disabled", isLocked ? "true" : "false");
        }
      };

      const renderAll = () => {
        items.forEach((_, i) => renderItem(i));
      };

      items.forEach((item, i) => {
        const slider = item.querySelector("[data-auto-alloc-slider]");
        const input = item.querySelector("[data-auto-alloc-pct-input]");
        const lockBtn = item.querySelector("[data-auto-alloc-lock-btn]");

        if (slider) {
          const getSliderPct = (clientX) => {
            const rect = slider.getBoundingClientRect();
            const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
            return (x / rect.width) * 100;
          };
          slider.addEventListener(
            "pointerdown",
            (e) => {
              if (lockedIdx === i) return;
              e.preventDefault();
              const ae = document.activeElement;
              if (
                ae?.matches?.("[data-auto-alloc-pct-input]") &&
                autoRoot.contains(ae)
              )
                ae.blur();
              slider.setPointerCapture(e.pointerId);
              applyAutoAllocChange(i, getSliderPct(e.clientX));
            },
            { signal: panelCtlSignal },
          );
          slider.addEventListener(
            "pointermove",
            (e) => {
              if (!slider.hasPointerCapture(e.pointerId)) return;
              if (lockedIdx === i) return;
              e.preventDefault();
              scheduleAutoAllocDrag(i, getSliderPct(e.clientX));
            },
            { signal: panelCtlSignal },
          );
          slider.addEventListener(
            "pointerup",
            (e) => {
              if (pendingDrag && pendingDrag.changedIdx === i) {
                const next = pendingDrag;
                pendingDrag = null;
                applyAutoAllocChange(next.changedIdx, next.rawPct);
              }
              if (slider.hasPointerCapture(e.pointerId))
                slider.releasePointerCapture(e.pointerId);
            },
            { signal: panelCtlSignal },
          );
          slider.addEventListener(
            "pointercancel",
            (e) => {
              if (pendingDrag && pendingDrag.changedIdx === i) {
                const next = pendingDrag;
                pendingDrag = null;
                applyAutoAllocChange(next.changedIdx, next.rawPct);
              }
              if (slider.hasPointerCapture(e.pointerId))
                slider.releasePointerCapture(e.pointerId);
            },
            { signal: panelCtlSignal },
          );
        }

        if (input) {
          input.addEventListener(
            "keydown",
            (e) => {
              const allowed = [
                "Backspace",
                "Delete",
                "Tab",
                "Enter",
                "ArrowLeft",
                "ArrowRight",
                "Home",
                "End",
              ];
              if (
                !allowed.includes(e.key) &&
                !/^\d$/.test(e.key) &&
                !(e.ctrlKey || e.metaKey)
              ) {
                e.preventDefault();
              }
            },
            { signal: panelCtlSignal },
          );
          input.addEventListener(
            "input",
            () => {
              const digits = input.value.replace(/[^0-9]/g, "").slice(0, 2);
              if (input.value !== digits) input.value = digits;
              if (digits === "") return;
              const val = parseInt(digits, 10);
              if (!isNaN(val)) applyAutoAllocChange(i, val);
            },
            { signal: panelCtlSignal },
          );
          input.addEventListener(
            "blur",
            () => {
              if (input.value.trim() === "") {
                input.value = String(pcts[i]);
                return;
              }
              const val = parseInt(input.value.replace(/[^0-9]/g, ""), 10);
              if (isNaN(val)) input.value = String(pcts[i]);
              else applyAutoAllocChange(i, val);
            },
            { signal: panelCtlSignal },
          );
        }

        if (lockBtn) {
          lockBtn.addEventListener(
            "click",
            () => {
              lockedIdx = lockedIdx === i ? null : i;
              if (lockedIdx === i) {
                const ae = document.activeElement;
                if (ae === input) ae.blur();
              }
              renderAll();
            },
            { signal: panelCtlSignal },
          );
        }
      });

      panelEl._planDetailAutoAllocRefreshAmounts = () => {
        renderAll();
      };
      renderAll();
      refreshPlanDetailAllocTweak();
    };

    const escPlanDetailIconAttr = (v) =>
      String(v ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");

    /**
     * Single hero icon or Figma pyramid stack (2 coins + placeholder / 3 coins).
     * @param {{ singleProductClass?: string, singleHeaderClass?: string }} [iconOpts] — override img classes for single-asset mode (e.g. breakdown panel)
     */
    const renderPlanDetailProductIcons = (
      productWrap,
      headerWrap,
      fallbackIconSrc,
      coinItems,
      iconOpts = {},
    ) => {
      if (!productWrap || !headerWrap) return;

      const singleProductClass =
        iconOpts.singleProductClass || "plan-detail-panel__product-icon";
      const singleHeaderClass =
        iconOpts.singleHeaderClass || "plan-detail-panel__header-icon";

      const buildStackMarkup = (variant) => {
        const items = (coinItems || [])
          .slice(0, 3)
          .filter((it) => it && it.icon);
        if (items.length < 2) return null;
        const twoOnly = items.length === 2;
        const mod = twoOnly ? " plan-detail-panel__icon-stack--two" : "";
        const baseClass =
          variant === "header"
            ? `plan-detail-panel__icon-stack plan-detail-panel__icon-stack--header${mod}`
            : `plan-detail-panel__icon-stack${mod}`;
        const [a, b, c] = [items[0], items[1], items[2]];
        const br = c?.icon
          ? `<img src="${escPlanDetailIconAttr(c.icon)}" alt="" />`
          : '<span class="plan-detail-panel__icon-stack-placeholder" aria-hidden="true"></span>';
        return `<div class="${baseClass}" aria-hidden="true"><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--top"><img src="${escPlanDetailIconAttr(a.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--bl"><img src="${escPlanDetailIconAttr(b.icon)}" alt="" /></div><div class="plan-detail-panel__icon-slot plan-detail-panel__icon-slot--br">${br}</div></div>`;
      };

      const stackProduct = buildStackMarkup("product");
      if (stackProduct) {
        productWrap.innerHTML = stackProduct;
        headerWrap.innerHTML = buildStackMarkup("header");
        return;
      }

      const singleSrc =
        coinItems && coinItems.length === 1 && coinItems[0]?.icon
          ? coinItems[0].icon
          : fallbackIconSrc;
      const s = escPlanDetailIconAttr(singleSrc);
      if (productWrap === headerWrap) {
        productWrap.innerHTML = `<img class="${singleProductClass}" src="${s}" alt="" />`;
      } else {
        productWrap.innerHTML = `<img class="${singleProductClass}" src="${s}" alt="" />`;
        headerWrap.innerHTML = `<img class="${singleHeaderClass}" src="${s}" alt="" />`;
      }
    };

    /** Auto plan title from allocation: 0 → "My plan", 1 → asset name, 2+ → "BTC · ETH · …". */
    const resolveAutoPlanTitleFromItems = (items) => {
      const list = Array.isArray(items) ? items.filter(Boolean) : [];
      if (list.length === 0) return "My plan";
      if (list.length === 1) {
        const name = String(list[0].name || list[0].ticker || "").trim();
        return name || "My plan";
      }
      return list
        .map((i) => String(i.ticker || "").trim())
        .filter(Boolean)
        .join(" · ");
    };

    const getCurrentPlanDisplayAssets = (fallbackIconSrc) => {
      const ctx = panelOpenContext || { source: "plan" };
      if (detailAllocOverride?.items?.length)
        return detailAllocOverride.items.slice(0, 3);
      if (ctx.source === "newplan" && !detailAllocOverride?.items?.length)
        return [];
      if (ctx.source === "curated" && ctx.curatedKey)
        return (
          planAllocation[String(ctx.curatedKey).toLowerCase()] || []
        ).slice(0, 3);
      if (ctx.source === "spotlight" && ctx.spotlightKey) {
        const key = String(ctx.spotlightKey || "").toLowerCase();
        const coin = pickableCoins.find((c) => c.key === key);
        return coin
          ? [{ name: coin.name, ticker: coin.ticker, icon: coin.icon }]
          : [];
      }
      const carousel = document.querySelector("[data-plan-carousel]");
      const activePlan = String(
        carousel?.getAttribute("data-active-plan") || "bitcoin",
      ).toLowerCase();
      const fromPlan = planAllocation[activePlan];
      if (fromPlan?.length) return fromPlan.slice(0, 3);
      const ticker =
        String(planTicker[activePlan] || "")
          .split(/[·,]/)[0]
          .trim() || "BTC";
      return [
        {
          name: ticker,
          ticker,
          icon: fallbackIconSrc || "assets/icon_currency_btc.svg",
        },
      ];
    };

    let planBreakdownApi = {
      sync: () => {},
      syncFromPlanWidget: () => {},
      close: () => {},
    };
    let planOverviewApi = { open: () => {}, close: () => {}, sync: () => {} };
    let planBufferApi = { open: () => {}, close: () => {} };
    let planEndConditionApi = { open: () => {}, close: () => {} };
    let planSuccessApi = { close: () => {}, forceClose: () => {} };
    let planBufferOverviewState = {
      mode: "flexible",
      rawAmount: 0,
      reservedAmount: 0,
      autoRefillEnabled: true,
      currency: "",
      perBuy: 0,
    };

    const PLAN_DETAIL_AMOUNT_HINT = {
      USDT: "Min 3 / Max 30,000",
      TWD: "Min 100 / Max 1,000,000",
    };

    const syncPlanDetailAmountHint = () => {
      const hintEl = panel.querySelector("[data-plan-detail-amount-hint]");
      const inp = panel.querySelector("[data-plan-detail-amount-input]");
      if (!hintEl || !inp) return;
      const tr = (s) => (window.I18N?.t ? window.I18N.t(s) : s);
      const cur = String(currencyState.plan || "TWD")
        .trim()
        .toUpperCase();
      const raw = String(inp.value || "").replace(/[^0-9]/g, "");
      const amount = parseInt(raw, 10);
      const empty = !raw || !Number.isFinite(amount) || amount <= 0;
      hintEl.hidden = !empty;
      if (!empty) return;
      const template =
        cur === "USDT"
          ? PLAN_DETAIL_AMOUNT_HINT.USDT
          : PLAN_DETAIL_AMOUNT_HINT.TWD;
      hintEl.textContent = tr(template);
    };

    const populatePanel = (opts = {}) => {
      const ctx = panelOpenContext;
      const shouldPreserveCurrentAmount = !!opts.preserveAmount;
      const cur = currencyState.plan;
      const carousel = document.querySelector("[data-plan-carousel]");
      let planKey = (
        carousel?.getAttribute("data-active-plan") || "bitcoin"
      ).toLowerCase();
      let iconSrc = "assets/icon_currency_btc.svg";
      let ticker = "BTC";

      const amountInput = panel.querySelector(
        "[data-plan-detail-amount-input]",
      );

      if (ctx.source === "newplan") {
        iconSrc = "assets/icon_noallocation.svg";
        planKey = "newplan";
        if (amountInput && !shouldPreserveCurrentAmount) amountInput.value = "";
      } else if (ctx.source === "curated" && ctx.curatedKey && ctx.card) {
        planKey = ctx.curatedKey.toLowerCase();
        const card = ctx.card;
        iconSrc =
          (
            card.querySelector(".curated-portfolios__icon") ||
            card.querySelector(".start-theme__icon img")
          )?.getAttribute("src") || iconSrc;
        if (amountInput && !shouldPreserveCurrentAmount) amountInput.value = "";
      } else if (ctx.source === "spotlight" && ctx.spotlightKey && ctx.card) {
        const card = ctx.card;
        ticker =
          card.querySelector(".crypto-pill__ticker")?.textContent?.trim() ||
          String(ctx.spotlightKey).toUpperCase();
        iconSrc =
          card.querySelector(".crypto-pill__icon")?.getAttribute("src") ||
          iconSrc;
        planKey = String(ctx.spotlightKey).toLowerCase();
        if (amountInput && !shouldPreserveCurrentAmount) amountInput.value = "";
      } else {
        const activeSlide =
          carousel?.querySelector(
            "[data-plan-carousel-item].swiper-slide-active",
          ) || carousel?.querySelector("[data-plan-carousel-item]");
        planKey = (
          carousel?.getAttribute("data-active-plan") || "bitcoin"
        ).toLowerCase();
        iconSrc =
          activeSlide?.querySelector("img")?.getAttribute("src") ||
          "assets/icon_currency_btc.svg";
        ticker = planTicker[planKey] || "BTC";
        const amountRaw =
          document
            .querySelector("[data-plan-amount]")
            ?.textContent?.replace(/,/g, "") || "10000";
        if (amountInput && !shouldPreserveCurrentAmount) {
          const amountNum = parseInt(amountRaw, 10);
          amountInput.value = !isNaN(amountNum)
            ? amountNum.toLocaleString("en-US")
            : amountRaw;
        }
      }

      if (
        detailAllocOverride?.kind === "curated" &&
        detailAllocOverride.items?.length
      ) {
        const curatedMeta = pickerCurated.find(
          (p) => p.key === detailAllocOverride.key,
        );
        if (curatedMeta?.icon) iconSrc = curatedMeta.icon;
      }

      const allocItems =
        (detailAllocOverride?.items?.length
          ? detailAllocOverride.items
          : null) ||
        (ctx.source === "newplan" && !detailAllocOverride?.items?.length
          ? []
          : null) ||
        (ctx.source === "spotlight" && ctx.card
          ? [
              {
                name:
                  ctx.card
                    .querySelector(".crypto-pill__name")
                    ?.textContent?.trim() || "Crypto",
                ticker:
                  ctx.card
                    .querySelector(".crypto-pill__ticker")
                    ?.textContent?.trim() || ticker,
                icon:
                  ctx.card
                    .querySelector(".crypto-pill__icon")
                    ?.getAttribute("src") || iconSrc,
              },
            ]
          : planAllocation[planKey] || planAllocation.bitcoin);

      const autoTitle = resolveAutoPlanTitleFromItems(allocItems);
      const hasCustomTitle = !!customPlanTitle.trim();
      const effectiveTitle = hasCustomTitle
        ? customPlanTitle.trim()
        : autoTitle;
      const tickerLine = allocItems
        .map((i) => String(i.ticker || "").trim())
        .filter(Boolean)
        .join(" · ");
      const secondaryPlanLine = tickerLine;
      const shouldShowSecondaryLine =
        allocItems.length === 1 || (hasCustomTitle && !!tickerLine);

      panel.dataset.planDetailAutoTitle = autoTitle;
      panel.dataset.planDetailAssetTickerLine = tickerLine;

      // Product hero
      panel.querySelector("[data-plan-detail-name]").textContent =
        effectiveTitle;
      {
        const t = panel.querySelector("[data-plan-detail-ticker]");
        if (t) {
          t.textContent = secondaryPlanLine;
          t.hidden = !shouldShowSecondaryLine;
        }
      }
      const productIconWrap = panel.querySelector(
        "[data-plan-detail-icon-wrap]",
      );
      const headerIconWrap = panel.querySelector(
        "[data-plan-detail-header-icon-wrap]",
      );
      const coinPickItems =
        detailAllocOverride?.kind === "coins" &&
        Array.isArray(detailAllocOverride.items)
          ? detailAllocOverride.items
          : null;
      renderPlanDetailProductIcons(
        productIconWrap,
        headerIconWrap,
        iconSrc,
        coinPickItems,
      );
      planBreakdownApi.sync({ iconSrc });

      // Collapsed header state
      panel.querySelector("[data-plan-detail-header-name]").textContent =
        effectiveTitle;
      {
        const ht = panel.querySelector("[data-plan-detail-header-ticker]");
        if (ht) {
          ht.textContent = secondaryPlanLine;
          ht.hidden = !shouldShowSecondaryLine;
        }
      }

      if (nameEditIcon) nameEditIcon.hidden = false;
      if (nameEditBtn) {
        nameEditBtn.disabled = false;
        nameEditBtn.style.cursor = "pointer";
      }

      const curatedProductKeyForDesc = (() => {
        // Manual/new plans should never show curated subtitles.
        if (
          ctx.source === "newplan" ||
          detailAllocOverride?.kind === "coins" ||
          !allocItems.length
        ) {
          return null;
        }
        if (
          detailAllocOverride?.kind === "curated" &&
          detailAllocOverride.key
        ) {
          return String(detailAllocOverride.key).toLowerCase();
        }
        if (ctx.source === "curated" && ctx.curatedKey) {
          return String(ctx.curatedKey).toLowerCase();
        }
        const k = String(planKey || "").toLowerCase();
        return pickerCurated.some((p) => p.key === k) ? k : null;
      })();
      const productDescEl = panel.querySelector(
        "[data-plan-detail-product-desc]",
      );
      if (productDescEl) {
        const isUserEditedTitle = !!customPlanTitle.trim();
        const meta = curatedProductKeyForDesc
          ? pickerCurated.find((p) => p.key === curatedProductKeyForDesc)
          : null;
        if (!isUserEditedTitle && meta?.desc) {
          productDescEl.textContent = meta.desc;
          productDescEl.hidden = false;
        } else {
          productDescEl.textContent = "";
          productDescEl.hidden = true;
        }
      }

      panel.querySelector("[data-plan-detail-currency]").textContent = cur;
      panel.querySelector("[data-plan-detail-amount-icon]").src =
        cur === "USDT"
          ? "assets/icon_currency_usdt.svg"
          : "assets/icon_currency_TWD.svg";

      updateCoverageUI();

      // Repeats schedule
      const freqLabels = {
        daily: "Daily",
        weekly: "Weekly · Monday",
        monthly: "Monthly · 15th",
      };
      const syncMainFreqTabs = (freqKey) => {
        const key = String(freqKey || "monthly").toLowerCase();
        panel.querySelectorAll("[data-plan-freq-item]").forEach((item) => {
          const on =
            String(
              item.getAttribute("data-plan-freq-item") || "",
            ).toLowerCase() === key;
          item.classList.toggle("is-active", on);
          item.setAttribute("aria-selected", on ? "true" : "false");
        });
      };
      const scheduleEl = panel.querySelector("[data-plan-detail-schedule]");
      const shouldApplyDefaultMonthly =
        panel.dataset.forceDefaultMonthlySchedule === "1";
      const inferFreqFromScheduleText = (text) => {
        const t = String(text || "")
          .trim()
          .toLowerCase();
        if (t.startsWith("daily")) return "daily";
        if (t.startsWith("weekly")) return "weekly";
        if (t.startsWith("flexible")) return "flexible";
        return "monthly";
      };
      if (scheduleEl) {
        const existingSchedule =
          getPlanDetailScheduleFullTextFromEl(scheduleEl);
        if (
          shouldApplyDefaultMonthly &&
          (ctx.source === "curated" ||
            ctx.source === "spotlight" ||
            ctx.source === "newplan")
        ) {
          syncMainFreqTabs("monthly");
          setPlanDetailScheduleElement(scheduleEl, freqLabels.monthly);
        } else if (existingSchedule) {
          // Preserve user-entered schedule/frequency across in-page hops
          // (Add assets, Breakdown, etc.) instead of re-deriving/resetting.
          syncMainFreqTabs(inferFreqFromScheduleText(existingSchedule));
        } else {
          const freqItem = document.querySelector(
            "[data-plan-freq-item].is-active",
          );
          const freqKey = (
            freqItem?.getAttribute("data-plan-freq-item") || "monthly"
          ).toLowerCase();
          syncMainFreqTabs(freqKey);
          setPlanDetailScheduleElement(
            scheduleEl,
            freqLabels[freqKey] || freqLabels.monthly,
          );
        }
      }
      panel.dataset.forceDefaultMonthlySchedule = "0";

      // Return footer title (investment rows refresh in updateDetailReturn)
      if (
        ctx.source === "curated" ||
        ctx.source === "spotlight" ||
        ctx.source === "newplan"
      ) {
        const titleEl = panel.querySelector("[data-plan-detail-return-title]");
        if (titleEl)
          titleEl.textContent =
            document.querySelector("[data-plan-return-title]")?.textContent ||
            titleEl.textContent;
      } else {
        syncFooterFromMainWidget();
      }

      // Allocation list
      const allocList = panel.querySelector("[data-plan-detail-allocation]");
      const allocCountEl = panel.querySelector(
        "[data-plan-detail-alloc-count]",
      );
      const allocSection = getManualAllocSection();
      const syncAllocSummaryChrome = (assetCount) => {
        const valueWrap = panel.querySelector(
          "[data-plan-detail-alloc-total-value-wrap]",
        );
        const hintRow = panel.querySelector(
          "[data-plan-detail-alloc-total-hint]",
        );
        const showSummaryExtras = assetCount >= 2;
        if (valueWrap) valueWrap.hidden = !showSummaryExtras;
        if (hintRow) hintRow.hidden = !showSummaryExtras;
      };
      const allocAutoSection = panel.querySelector(
        "[data-plan-detail-allocation-auto-section]",
      );
      const allocAutoList = panel.querySelector(
        "[data-plan-detail-allocation-auto]",
      );
      const allocAutoCountEl = panel.querySelector(
        "[data-plan-detail-alloc-auto-count]",
      );
      const allocAutoRangeEl = panel.querySelector(
        "[data-plan-detail-alloc-auto-range]",
      );
      const allocAutoHistoricPctEl = panel.querySelector(
        "[data-plan-detail-alloc-auto-historic-pct]",
      );

      if (ctx.source === "newplan" && !detailAllocOverride?.items?.length) {
        // Empty state: no assets selected yet
        if (allocCountEl) allocCountEl.textContent = "0";
        allocList.innerHTML = "";
        const emptyHeaderHistoric = panel.querySelector(
          "[data-plan-detail-alloc-header-historic]",
        );
        const emptyHistoricTone = panel.querySelector(
          "[data-plan-detail-historic-performance-tone]",
        );
        const emptyLabelRow = emptyHeaderHistoric?.querySelector(
          "[data-plan-detail-alloc-historic-label-row]",
        );
        const emptyBelowLabel = emptyHeaderHistoric?.querySelector(
          ".plan-detail-panel__historic-performance-label--below",
        );
        const emptyAnchor = emptyLabelRow || emptyBelowLabel;
        if (
          emptyHeaderHistoric &&
          emptyHistoricTone &&
          !emptyHeaderHistoric.contains(emptyHistoricTone)
        ) {
          if (emptyAnchor)
            emptyHeaderHistoric.insertBefore(
              emptyHistoricTone,
              emptyAnchor.nextSibling,
            );
          else emptyHeaderHistoric.appendChild(emptyHistoricTone);
        } else if (
          emptyHeaderHistoric &&
          emptyHistoricTone &&
          emptyAnchor &&
          emptyHistoricTone.previousElementSibling !== emptyAnchor
        ) {
          emptyHeaderHistoric.insertBefore(
            emptyHistoricTone,
            emptyAnchor.nextSibling,
          );
        }
        if (allocSection) {
          allocSection.classList.remove("is-single-asset");
          allocSection.classList.remove("is-multi-asset");
          allocSection.classList.add("is-empty");
        }
        const allocModeToggleNewplan = panel.querySelector(
          "[data-alloc-mode-toggle]",
        );
        if (allocModeToggleNewplan)
          allocModeToggleNewplan.classList.add("is-hidden");
        panel
          .querySelectorAll(".plan-detail-panel__add-assets")
          .forEach((btn) => {
            btn.textContent = window.I18N?.t
              ? window.I18N.t("Add assets")
              : "Add assets";
          });
        const resetNewplan = panel.querySelector("[data-alloc-reset]");
        if (resetNewplan) resetNewplan.hidden = true;
        syncAllocSummaryChrome(0);
        latestAllocItemCount = 0;
        syncActiveAllocationVariant();
        if (allocAutoSection) allocAutoSection.hidden = true;
        if (allocAutoList) allocAutoList.innerHTML = "";
        updateDetailReturn();
        syncPlanDetailAmountHint();
        return;
      }

      if (allocSection) allocSection.classList.remove("is-empty");

      if (allocCountEl) allocCountEl.textContent = String(allocItems.length);
      latestAllocItemCount = allocItems.length;

      const addLabelKey =
        allocItems.length > 1 ? "Add / remove assets" : "Add assets";
      const addLabel = window.I18N?.t
        ? window.I18N.t(addLabelKey)
        : addLabelKey;
      panel
        .querySelectorAll(".plan-detail-panel__add-assets")
        .forEach((btn) => {
          btn.textContent = addLabel;
        });
      const allocResetBtn = panel.querySelector("[data-alloc-reset]");
      if (allocResetBtn) {
        allocResetBtn.textContent = "Set equal";
        allocResetBtn.hidden = allocItems.length < 2;
      }

      // Multi-asset allocation header uses "Combined #Y performance" (Figma); single-asset uses "Past #Y performance".
      // updateRangeUI() handles live range changes; this ensures the initial open has the right label too.
      const planRange = rangeState?.plan || "5Y";
      const belowHistLabel = panel.querySelector(
        ".plan-detail-panel__alloc-header-historic-inline .plan-detail-panel__historic-performance-label--below",
      );
      if (belowHistLabel) {
        belowHistLabel.textContent =
          allocItems.length >= 2
            ? `Past ${planRange} perf.`
            : `Past ${planRange} perf.`;
      }
      if (allocAutoRangeEl)
        allocAutoRangeEl.textContent = `Past ${planRange} perf.`;
      if (allocAutoHistoricPctEl) {
        const histPct = panel
          .querySelector("[data-plan-detail-return-historic-pct]")
          ?.textContent?.trim();
        allocAutoHistoricPctEl.textContent =
          histPct || allocAutoHistoricPctEl.textContent;
      }

      // Show mode toggle + allocation subtitle for 2+ assets only
      const allocModeToggle = panel.querySelector("[data-alloc-mode-toggle]");
      if (allocModeToggle)
        allocModeToggle.classList.toggle("is-hidden", allocItems.length < 2);
      syncAllocSummaryChrome(allocItems.length);

      const headerHistoric = panel.querySelector(
        "[data-plan-detail-alloc-header-historic]",
      );
      const historicLabelRow = headerHistoric?.querySelector(
        "[data-plan-detail-alloc-historic-label-row]",
      );
      const historicBelowInHeader = headerHistoric?.querySelector(
        ".plan-detail-panel__historic-performance-label--below",
      );
      const historicAnchor = historicLabelRow || historicBelowInHeader;
      let historicTone = getOrCreateHistoricToneNode(allocSection);
      const singleAssetAmountText = () => {
        const amountInputEl = panel.querySelector(
          "[data-plan-detail-amount-input]",
        );
        const currencyEl = panel.querySelector("[data-plan-detail-currency]");
        const perBuyAmount =
          parseInt(
            String(amountInputEl?.value || "").replace(/[^0-9]/g, ""),
            10,
          ) || 0;
        const currency =
          String(currencyEl?.textContent || "TWD").trim() || "TWD";
        return `${Math.max(0, perBuyAmount).toLocaleString("en-US")} ${currency}`;
      };
      const setHistoricToneSingleAsset = () => {
        const tone = getOrCreateHistoricToneNode(allocSection);
        if (!tone) return;
        if (!tone.dataset.historicToneMarkupDefault) {
          tone.dataset.historicToneMarkupDefault = tone.innerHTML;
        }
        tone.innerHTML = `
          <div class="plan-detail-panel__single-asset-summary" data-plan-detail-single-asset-summary>
            <span class="plan-detail-panel__single-asset-summary-title" data-plan-detail-single-asset-per-buy>${singleAssetAmountText()}</span>
            <span class="plan-detail-panel__single-asset-summary-subtitle">per buy</span>
          </div>
        `;
      };
      const setHistoricToneMultiAsset = () => {
        const tone = getOrCreateHistoricToneNode(allocSection);
        if (!tone) return;
        const defaultMarkup = tone.dataset.historicToneMarkupDefault;
        if (
          !defaultMarkup ||
          tone.querySelector("[data-plan-detail-return-historic-pct]")
        )
          return;
        tone.innerHTML = defaultMarkup;
      };

      const placeHistoricToneInAllocHeaderInline = () => {
        const tone = getOrCreateHistoricToneNode(allocSection);
        if (!headerHistoric || !tone) return;
        if (historicAnchor) {
          if (
            tone.parentElement === headerHistoric &&
            tone.previousElementSibling === historicAnchor
          )
            return;
          headerHistoric.insertBefore(tone, historicAnchor.nextSibling);
        } else {
          if (tone.parentElement === headerHistoric) return;
          headerHistoric.appendChild(tone);
        }
      };

      // Historic % may sit in a single alloc-item; pull it out before list innerHTML replaces nodes.
      if (historicTone && allocList.contains(historicTone)) {
        placeHistoricToneInAllocHeaderInline();
      }

      if (allocItems.length >= 2) {
        // Multi-asset layout with sliders (per-row %; user balances total to 100% / amounts to per-buy total)
        allocList.innerHTML = `<div class="alloc-multi">${allocItems
          .map(
            (item, i) => `
            <div class="alloc-multi__item" data-alloc-idx="${i}">
              <div class="alloc-multi__manual-layout">
                <div class="alloc-multi__manual-left">
                  <div class="alloc-multi__row alloc-multi__row--manual-head">
                    <img class="alloc-multi__icon" src="${item.icon}" alt="" />
                    <div class="alloc-multi__info">
                      <span class="alloc-multi__name">${item.name}</span>
                      <span class="alloc-multi__ticker">${item.ticker}</span>
                    </div>
                  </div>
                  <div class="alloc-multi__slider-row alloc-multi__slider-row--manual">
                    <div class="alloc-multi__slider" data-alloc-slider>
                      <div class="alloc-multi__slider-bg"></div>
                      <div class="alloc-multi__slider-fill" data-alloc-fill></div>
                      <div class="alloc-multi__slider-thumb" data-alloc-thumb></div>
                    </div>
                  </div>
                </div>
                <div class="alloc-multi__pct-col alloc-multi__pct-col--manual-stacked">
                  <div class="alloc-multi__pct-amount-sub-wrap">
                    <p class="alloc-multi__pct-amount-sub" data-alloc-pct-amount-sub aria-hidden="true"></p>
                  </div>
                  <div class="alloc-multi__pct-wrap">
                    <div class="alloc-multi__pct-inner">
                      <input class="alloc-multi__pct-input" type="text" inputmode="numeric" data-alloc-pct-input />
                      <span class="alloc-multi__pct-symbol">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>`,
          )
          .join("")}</div>`;

        initAllocSliders(panel, allocItems.length);
      } else {
        // Single-asset layout (simple, no slider)
        allocList.innerHTML = allocItems
          .map(
            (item) => `
          <div class="plan-detail-panel__alloc-item">
            <img class="plan-detail-panel__alloc-icon" src="${item.icon}" alt="" />
            <div class="plan-detail-panel__alloc-info">
              <span class="plan-detail-panel__alloc-name">${item.name}</span>
              <span class="plan-detail-panel__alloc-ticker">${item.ticker}</span>
            </div>
          </div>`,
          )
          .join("");
        const resetSingle = panel.querySelector("[data-alloc-reset]");
        if (resetSingle) resetSingle.hidden = true;
      }

      if (allocAutoSection && allocAutoList) {
        allocAutoSection.hidden = allocItems.length < 2;
        if (allocAutoCountEl)
          allocAutoCountEl.textContent = String(allocItems.length);
        if (allocItems.length >= 2) {
          allocAutoList.innerHTML = `<div class="alloc-multi alloc-multi--auto">${allocItems
            .map(
              (item, i) => `
              <div class="alloc-multi__item" data-auto-alloc-idx="${i}">
                <div class="alloc-multi__row">
                  <img class="alloc-multi__icon" src="${item.icon}" alt="" />
                  <div class="alloc-multi__info">
                    <span class="alloc-multi__name">${item.name}</span>
                    <span class="alloc-multi__ticker">${item.ticker}</span>
                  </div>
                  <div class="alloc-multi__pct-col">
                    <div class="alloc-multi__pct-wrap">
                      <div class="alloc-multi__pct-inner">
                        <input class="alloc-multi__pct-input" type="text" inputmode="numeric" maxlength="2" data-alloc-pct-input data-auto-alloc-pct-input />
                        <span class="alloc-multi__pct-symbol">%</span>
                      </div>
                    </div>
                    <p class="alloc-multi__pct-amount-sub" data-auto-alloc-pct-amount-sub aria-hidden="false"></p>
                  </div>
                </div>
                <div class="alloc-multi__slider-row">
                  <div class="alloc-multi__slider" data-auto-alloc-slider>
                    <div class="alloc-multi__slider-bg"></div>
                    <div class="alloc-multi__slider-fill" data-auto-alloc-fill></div>
                    <div class="alloc-multi__slider-thumb" data-auto-alloc-thumb></div>
                  </div>
                </div>
                <div class="alloc-multi__auto-lock-row"${allocItems.length === 2 ? " hidden" : ""}>
                  <button class="alloc-multi__auto-lock-toggle" type="button" data-auto-alloc-lock-btn aria-pressed="false" aria-label="Toggle allocation lock">
                    <span class="alloc-multi__auto-lock-label" data-auto-alloc-lock-label>Lock this allocation</span>
                    <span class="alloc-multi__auto-lock-btn" aria-hidden="true">
                      <img class="alloc-multi__auto-lock-icon" src="assets/icon_unlock.svg" width="16" height="16" alt="" data-auto-alloc-lock-icon />
                    </span>
                  </button>
                </div>
              </div>`,
            )
            .join("")}</div>`;
          initAutoAllocSliders(panel, allocAutoList, allocItems.length);
        } else {
          allocAutoList.innerHTML = "";
          if (panel._planDetailAutoAllocRefreshAmounts)
            panel._planDetailAutoAllocRefreshAmounts = null;
        }
      }
      syncActiveAllocationVariant();

      // Keep modifier classes in sync whenever we have assets; do not depend on historic DOM (avoids stale
      // is-multi-asset + single-row list, which hid single-asset historic UI).
      if (allocSection) {
        if (allocItems.length === 1) {
          allocSection.classList.add("is-single-asset");
          allocSection.classList.remove("is-multi-asset");
        } else if (allocItems.length >= 2) {
          allocSection.classList.remove("is-single-asset");
          allocSection.classList.add("is-multi-asset");
        }
      }

      historicTone = getOrCreateHistoricToneNode(allocSection);
      if (allocSection && historicTone) {
        if (allocItems.length === 1) {
          setHistoricToneSingleAsset();
          const firstItem = allocList.querySelector(
            ".plan-detail-panel__alloc-item",
          );
          if (firstItem && !firstItem.contains(historicTone)) {
            firstItem.appendChild(historicTone);
          }
        } else {
          setHistoricToneMultiAsset();
          placeHistoricToneInAllocHeaderInline();
        }
      }

      updateDetailReturn();
      scheduleSheetApi.syncBuyNowFromPlanDetail?.();
      if (
        panel
          .querySelector("[data-plan-overview-panel]")
          ?.classList.contains("is-open")
      ) {
        planOverviewApi.sync();
      }
      syncPlanDetailAmountHint();
    };

    const commitCustomPlanTitle = () => {
      if (!nameInput) return;
      const next = String(nameInput.value || "")
        .trim()
        .slice(0, 40);
      const autoTitle = String(panel.dataset.planDetailAutoTitle || "").trim();
      customPlanTitle = next && next !== autoTitle ? next : "";
      nameInput.hidden = true;
      if (nameSpan) nameSpan.hidden = false;
      if (nameEditIcon) nameEditIcon.hidden = false;
      populatePanel({ preserveAmount: true });
    };

    const enterTitleEditMode = () => {
      if (!nameInput || !nameEditBtn) return;
      const current =
        panel.querySelector("[data-plan-detail-name]")?.textContent ||
        "My plan";
      nameInput.value = String(current).trim();
      if (nameSpan) nameSpan.hidden = true;
      // Keep the edit icon + product icon visible; only swap title text → input.
      nameInput.hidden = false;
      requestAnimationFrame(() => {
        nameInput.focus();
        nameInput.select();
      });
    };

    nameEditBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      // If already editing, ignore (prevents space/enter bubbling reopening edit mode).
      if (nameInput && !nameInput.hidden) return;
      enterTitleEditMode();
    });
    nameInput?.addEventListener("keydown", (e) => {
      // Prevent bubbling to the wrapper button (spacebar can "activate" the button).
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        commitCustomPlanTitle();
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (nameInput) nameInput.hidden = true;
        if (nameSpan) nameSpan.hidden = false;
        if (nameEditIcon) nameEditIcon.hidden = false;
      }
    });
    nameInput?.addEventListener("click", (e) => e.stopPropagation());
    nameInput?.addEventListener("blur", () => commitCustomPlanTitle());

    // ── Scroll-driven collapse behaviour ──────────────────────────────────────
    const resetScrollState = () => {
      if (!scroller || !productArea || !header || !pageTitle) return;
      scroller.scrollTop = 0;
      productArea.style.opacity = "";
      productArea.style.transform = "";
      pageTitle.style.opacity = "";
      header.classList.remove("is-collapsed");
    };

    let rafPending = false;
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        rafPending = false;
        if (!scroller || !productArea || !header || !pageTitle) return;

        const scrollTop = scroller.scrollTop;
        const productH = productArea.offsetHeight - 400;

        // Fade product content and page title together (0→1 over the product height)
        const fadeProgress = Math.min(1, Math.max(0, scrollTop / productH));
        productArea.style.opacity = String(1 - fadeProgress);
        pageTitle.style.opacity = String(1 - fadeProgress);

        // Parallax: counteract 50% of the scroll → product moves up at 0.5× speed
        productArea.style.transform = `translateY(${scrollTop * 0.5}px)`;

        // Collapse header once content has fully covered the product
        header.classList.toggle("is-collapsed", scrollTop >= productH);
      });
    };

    if (scroller)
      scroller.addEventListener("scroll", onScroll, { passive: true });

    // ── Allocation picker panel (right-slide child screen) ────────────────────
    const allocPickerPanel = document.querySelector(
      "[data-alloc-picker-panel]",
    );
    const initPlanAllocPicker = () => {
      if (!allocPickerPanel) return { open: () => {}, close: () => {} };
      const tabBtns = Array.from(
        allocPickerPanel.querySelectorAll("[data-alloc-picker-tab]"),
      );
      const viewCoins = allocPickerPanel.querySelector(
        '[data-alloc-picker-view="coins"]',
      );
      const viewCurated = allocPickerPanel.querySelector(
        '[data-alloc-picker-view="curated"]',
      );
      const coinsListEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-coins-list]",
      );
      const themeCoinsListEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-theme-coins-list]",
      );
      const themeTopEl = allocPickerPanel.querySelector(
        ".alloc-picker-panel__theme-top",
      );
      const themeCatsEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-theme-cats]",
      );
      const themeTitleEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-theme-title]",
      );
      const themeSubhintEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-subhint]",
      );
      const searchEmptyEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-search-empty]",
      );
      const themeInfoEl = allocPickerPanel.querySelector(
        ".alloc-picker-panel__theme-info",
      );
      const chipsEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-chips]",
      );
      const footerEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-footer]",
      );
      const continueBtn = allocPickerPanel.querySelector(
        "[data-alloc-picker-continue]",
      );
      const selectedHeadingEl = allocPickerPanel.querySelector(
        "[data-alloc-picker-selected-heading]",
      );
      const searchInput = allocPickerPanel.querySelector(
        "[data-alloc-picker-search]",
      );
      const searchClearBtn = allocPickerPanel.querySelector(
        "[data-alloc-picker-search-clear]",
      );
      const searchWrap = allocPickerPanel.querySelector(
        ".alloc-picker-panel__search-wrap",
      );
      let activeTab = "curated";
      let selectedCoinKeys = [];
      let selectedThemeCoinKeys = [];
      let activeThemeCategory = "all";
      let themeCategoryBeforeSearchFocus = "all";
      let searchForcedAllCategory = false;
      let allocPickerOpenSource = "plan";

      const coinByKey = new Map(pickableCoins.map((c) => [c.key, c]));
      const themeCategoryByKey = new Map(
        themeCategories.map((c) => [c.key, c]),
      );
      const themeCategoryBtnByKey = new Map();
      const themeCoinRowByKey = new Map();

      const getActiveSelectedKeys = () =>
        activeTab === "curated" ? selectedThemeCoinKeys : selectedCoinKeys;
      const setActiveSelectedKeys = (next) => {
        if (activeTab === "curated") selectedThemeCoinKeys = next;
        else selectedCoinKeys = next;
      };

      const syncTabs = () => {
        tabBtns.forEach((btn) =>
          btn.classList.toggle(
            "is-active",
            btn.dataset.allocPickerTab === activeTab,
          ),
        );
        if (viewCoins) viewCoins.hidden = activeTab !== "coins";
        if (viewCurated) viewCurated.hidden = activeTab !== "curated";
        if (footerEl)
          footerEl.hidden = !(activeTab === "coins" || activeTab === "curated");
        renderChips({ full: true });
      };

      const syncCoinListMaxSelectedClass = () => {
        const listEl = activeTab === "curated" ? themeCoinsListEl : coinsListEl;
        if (!listEl) return;
        listEl.classList.toggle(
          "alloc-picker-panel__coins--max-selected",
          getActiveSelectedKeys().length >= 3,
        );
      };

      const syncCoinRowSelectionOnly = () => {
        const listEl = activeTab === "curated" ? themeCoinsListEl : coinsListEl;
        if (!listEl) return;
        const onSrc = "assets/icon_checkbox_on.svg";
        const offSrc = "assets/icon_checkbox_off.svg";
        const selectedKeys = getActiveSelectedKeys();
        listEl.querySelectorAll("[data-alloc-picker-coin]").forEach((row) => {
          const key = row.getAttribute("data-alloc-picker-coin");
          if (!key) return;
          const isSelected = selectedKeys.includes(key);
          row.classList.toggle("is-selected", isSelected);
          const check = row.querySelector(".alloc-picker-panel__coin-check");
          if (check) {
            const next = isSelected ? onSrc : offSrc;
            if (check.getAttribute("src") !== next)
              check.setAttribute("src", next);
          }
        });
        syncCoinListMaxSelectedClass();
      };

      const renderCoins = (opts = { full: true }) => {
        if (!coinsListEl) return;
        if (!opts.full) {
          syncCoinRowSelectionOnly();
          return;
        }
        const q = String(searchInput?.value || "")
          .trim()
          .toLowerCase();
        const spotRange = rangeState.spotlight;
        const visible = pickableCoins.filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.ticker.toLowerCase().includes(q),
        );
        coinsListEl.innerHTML = visible
          .map((c) => {
            const isSelected = selectedCoinKeys.includes(c.key);
            const ret = spotlightReturns[c.key]?.[spotRange] || c.ret;
            return `
            <button class="alloc-picker-panel__coin-row ${isSelected ? "is-selected" : ""}" type="button" data-alloc-picker-coin="${c.key}">
              <img class="alloc-picker-panel__coin-icon" src="${c.icon}" alt="" />
              <div class="alloc-picker-panel__coin-main">
                <span class="alloc-picker-panel__coin-ticker">${c.ticker}</span>
                <span class="alloc-picker-panel__coin-name">${c.name}</span>
              </div>
              <span class="alloc-picker-panel__coin-pct-wrap">
                <img class="alloc-picker-panel__coin-pct-arrow" src="assets/icon_northeast_arrow.svg" alt="" />
                <span class="alloc-picker-panel__coin-pct">${ret}</span>
              </span>
              <img
                class="alloc-picker-panel__coin-check"
                src="${isSelected ? "assets/icon_checkbox_on.svg" : "assets/icon_checkbox_off.svg"}"
                width="20"
                height="20"
                alt=""
                aria-hidden="true"
              />
            </button>
          `;
          })
          .join("");
        syncCoinListMaxSelectedClass();
      };

      const renderThemeCategories = () => {
        if (!themeCatsEl) return;
        if (!themeCategoryBtnByKey.size) {
          themeCatsEl.innerHTML = "";
          themeCategories.forEach((cat) => {
            const btn = document.createElement("button");
            btn.className = "alloc-picker-panel__theme-cat";
            btn.type = "button";
            btn.setAttribute("data-alloc-picker-theme-cat", cat.key);
            const iconWrap = document.createElement("span");
            iconWrap.className =
              `alloc-picker-panel__theme-cat-icon ${cat.iconClass || ""}`.trim();
            const iconImg = document.createElement("img");
            iconImg.alt = "";
            iconWrap.appendChild(iconImg);
            const label = document.createElement("span");
            label.className = "alloc-picker-panel__theme-cat-label";
            label.textContent = cat.label;
            btn.append(iconWrap, label);
            themeCatsEl.appendChild(btn);
            themeCategoryBtnByKey.set(cat.key, btn);
          });
        }
        themeCategories.forEach((cat) => {
          const btn = themeCategoryBtnByKey.get(cat.key);
          if (!btn) return;
          const isActive = cat.key === activeThemeCategory;
          btn.classList.toggle("is-active", isActive);
          const img = btn.querySelector("img");
          const nextSrc = isActive ? cat.iconOn : cat.iconOff;
          if (img && img.getAttribute("src") !== nextSrc)
            img.setAttribute("src", nextSrc);
        });
      };

      const scrollActiveThemeCategoryIntoView = (behavior = "auto") => {
        if (!themeCatsEl) return;
        const activeBtn = themeCatsEl.querySelector(
          "[data-alloc-picker-theme-cat].is-active",
        );
        if (!activeBtn) return;
        activeBtn.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior,
        });
      };

      const syncThemeListSearchUi = (q, visibleCount) => {
        const hasQuery = !!String(q || "").trim();
        if (themeSubhintEl) themeSubhintEl.hidden = hasQuery;
        if (themeInfoEl) themeInfoEl.hidden = hasQuery;
        if (searchEmptyEl) {
          const showEmpty = hasQuery && visibleCount === 0;
          searchEmptyEl.hidden = !showEmpty;
          searchEmptyEl.classList.toggle("is-visible", showEmpty);
        }
      };

      const renderThemeCoins = (opts = { full: true }) => {
        if (!themeCoinsListEl) return;
        const q = String(searchInput?.value || "")
          .trim()
          .toLowerCase();
        if (!opts.full) {
          syncCoinRowSelectionOnly();
          const filterCategory = q ? "all" : activeThemeCategory;
          const filteredByCategory =
            filterCategory === "all"
              ? pickableCoins
              : pickableCoins.filter((c) =>
                  (c.categories || []).includes(filterCategory),
                );
          const visibleCount = filteredByCategory.filter(
            (c) =>
              !q ||
              c.name.toLowerCase().includes(q) ||
              c.ticker.toLowerCase().includes(q),
          ).length;
          syncThemeListSearchUi(q, visibleCount);
          return;
        }
        const filterCategory = q ? "all" : activeThemeCategory;
        const cat = themeCategoryByKey.get(filterCategory);
        if (themeTitleEl) {
          themeTitleEl.textContent = cat?.hintLabel || cat?.label || "All coins";
        }
        const selectedKeys = selectedThemeCoinKeys;
        const curRange = rangeState.curated;
        const filteredByCategory =
          filterCategory === "all"
            ? pickableCoins
            : pickableCoins.filter((c) =>
                (c.categories || []).includes(filterCategory),
              );
        const visible = filteredByCategory.filter(
          (c) =>
            !q ||
            c.name.toLowerCase().includes(q) ||
            c.ticker.toLowerCase().includes(q),
        );
        if (!themeCoinRowByKey.size) {
          themeCoinsListEl.innerHTML = "";
          pickableCoins.forEach((c) => {
            const row = document.createElement("button");
            row.className = "alloc-picker-panel__coin-row";
            row.type = "button";
            row.setAttribute("data-alloc-picker-coin", c.key);

            const icon = document.createElement("img");
            icon.className = "alloc-picker-panel__coin-icon";
            icon.src = c.icon;
            icon.alt = "";

            const main = document.createElement("div");
            main.className = "alloc-picker-panel__coin-main";
            const ticker = document.createElement("span");
            ticker.className = "alloc-picker-panel__coin-ticker";
            ticker.textContent = c.ticker;
            const name = document.createElement("span");
            name.className = "alloc-picker-panel__coin-name";
            name.textContent = c.name;
            main.append(ticker, name);

            const pctWrap = document.createElement("span");
            pctWrap.className = "alloc-picker-panel__coin-pct-wrap";
            const pctArrow = document.createElement("img");
            pctArrow.className = "alloc-picker-panel__coin-pct-arrow";
            pctArrow.src = "assets/icon_northeast_arrow.svg";
            pctArrow.alt = "";
            const pct = document.createElement("span");
            pct.className = "alloc-picker-panel__coin-pct";
            pctWrap.append(pctArrow, pct);

            const check = document.createElement("img");
            check.className = "alloc-picker-panel__coin-check";
            check.width = 20;
            check.height = 20;
            check.alt = "";
            check.setAttribute("aria-hidden", "true");

            row.append(icon, main, pctWrap, check);
            themeCoinsListEl.appendChild(row);
            themeCoinRowByKey.set(c.key, row);
          });
        }
        const visibleKeySet = new Set(visible.map((c) => c.key));
        pickableCoins.forEach((c) => {
          const row = themeCoinRowByKey.get(c.key);
          if (!row) return;
          if (!visibleKeySet.has(c.key)) {
            if (row.parentElement === themeCoinsListEl) row.remove();
            return;
          }
          const isSelected = selectedKeys.includes(c.key);
          row.classList.toggle("is-selected", isSelected);
          const ret = spotlightReturns[c.key]?.[curRange] || c.ret;
          const pctEl = row.querySelector(".alloc-picker-panel__coin-pct");
          if (pctEl) pctEl.textContent = ret;
          const check = row.querySelector(".alloc-picker-panel__coin-check");
          if (check) {
            const nextCheck = isSelected
              ? "assets/icon_checkbox_on.svg"
              : "assets/icon_checkbox_off.svg";
            if (check.getAttribute("src") !== nextCheck)
              check.setAttribute("src", nextCheck);
          }
        });
        // Rebuild visible order without recreating row nodes (keeps image cache warm, no flicker).
        const orderedVisibleRows = visible
          .map((c) => themeCoinRowByKey.get(c.key))
          .filter(Boolean);
        themeCoinsListEl.replaceChildren(...orderedVisibleRows);
        syncCoinListMaxSelectedClass();
        syncThemeListSearchUi(q, visible.length);
      };

      const createAllocPickerChip = (c) => {
        const wrap = document.createElement("div");
        wrap.className = "alloc-picker-panel__chip";
        wrap.setAttribute("data-alloc-picker-chip-key", c.key);
        const icon = document.createElement("img");
        icon.className = "alloc-picker-panel__chip-currency";
        icon.src = c.icon;
        icon.alt = "";
        const label = document.createElement("span");
        label.className = "alloc-picker-panel__chip-label";
        label.textContent = c.ticker;
        const dismiss = document.createElement("button");
        dismiss.className = "alloc-picker-panel__chip-dismiss";
        dismiss.type = "button";
        dismiss.setAttribute("data-alloc-picker-chip-remove", c.key);
        dismiss.setAttribute("aria-label", `Remove ${c.ticker}`);
        const closeImg = document.createElement("img");
        closeImg.className = "alloc-picker-panel__chip-close";
        closeImg.src = "assets/icon_close_gray.svg";
        closeImg.width = 12;
        closeImg.height = 12;
        closeImg.alt = "";
        closeImg.setAttribute("aria-hidden", "true");
        dismiss.appendChild(closeImg);
        wrap.append(icon, label, dismiss);
        return wrap;
      };

      const renderChips = (opts = { full: false }) => {
        if (!chipsEl || !continueBtn) return;
        const selectedKeys = getActiveSelectedKeys();
        const selected = selectedKeys
          .map((k) => coinByKey.get(k))
          .filter(Boolean);
        const n = selected.length;
        if (selectedHeadingEl) {
          const headingByCount = [
            "No coins selected",
            "1 coin selected",
            "2 coins selected",
            "3 coins selected",
          ];
          selectedHeadingEl.textContent =
            headingByCount[n] ?? headingByCount[0];
        }
        continueBtn.textContent = "Continue";
        continueBtn.disabled = n < 1;

        if (opts.full) {
          chipsEl.replaceChildren(
            ...selected.map((c) => createAllocPickerChip(c)),
          );
          document.dispatchEvent(new CustomEvent("fake-keyboard-alloc-sync"));
          return;
        }

        const wantKeys = new Set(selectedKeys);
        chipsEl
          .querySelectorAll("[data-alloc-picker-chip-key]")
          .forEach((chip) => {
            const k = chip.getAttribute("data-alloc-picker-chip-key");
            if (!wantKeys.has(k)) chip.remove();
          });

        selected.forEach((c) => {
          let chip = chipsEl.querySelector(
            `[data-alloc-picker-chip-key="${c.key}"]`,
          );
          if (!chip) chip = createAllocPickerChip(c);
          chipsEl.appendChild(chip);
        });
        document.dispatchEvent(new CustomEvent("fake-keyboard-alloc-sync"));
      };

      const hasThemeSearchQuery = () =>
        !!(searchInput && String(searchInput.value || "").trim());

      const isAllocSearchEngaged = () =>
        !!(
          searchInput &&
          (document.activeElement === searchInput || hasThemeSearchQuery())
        );

      const syncSearchClearUi = () => {
        const show = isAllocSearchEngaged();
        if (searchClearBtn) searchClearBtn.hidden = !show;
        if (searchWrap)
          searchWrap.classList.toggle(
            "alloc-picker-panel__search-wrap--has-query",
            show,
          );
      };

      const syncThemeSearchMode = () => {
        const hasQuery = hasThemeSearchQuery();
        if (hasQuery) {
          themeTopEl?.classList.add(
            "alloc-picker-panel__theme-top--search-focused",
          );
          if (!searchForcedAllCategory && activeThemeCategory !== "all") {
            themeCategoryBeforeSearchFocus = activeThemeCategory;
            activeThemeCategory = "all";
            searchForcedAllCategory = true;
            renderThemeCategories();
            renderThemeCoins();
          }
        } else {
          themeTopEl?.classList.remove(
            "alloc-picker-panel__theme-top--search-focused",
          );
          if (searchForcedAllCategory) {
            activeThemeCategory = themeCategoryBeforeSearchFocus;
            searchForcedAllCategory = false;
            renderThemeCategories();
            scrollActiveThemeCategoryIntoView();
            renderThemeCoins();
          }
        }
        syncSearchClearUi();
        syncAllocPickerFakeKeyboard();
        if (!hasThemeSearchQuery()) {
          syncThemeListSearchUi("", 1);
        }
      };

      const syncAllocPickerFakeKeyboard = () => {
        const panelOpen = allocPickerPanel.classList.contains("is-open");
        if (!panelOpen || !isAllocSearchEngaged()) {
          document.dispatchEvent(new CustomEvent("fake-keyboard-alloc-hide"));
          return;
        }
        document.dispatchEvent(new CustomEvent("fake-keyboard-alloc-show"));
      };

      const applySelectedCoins = () => {
        const selectedKeys = getActiveSelectedKeys();
        const items = selectedKeys
          .map((k) => coinByKey.get(k))
          .filter(Boolean)
          .map((c) => ({
            name: c.name,
            ticker: c.ticker,
            icon: c.icon,
          }));
        if (!items.length) return;
        detailAllocOverride = { kind: "coins", items };
        populatePanel({ preserveAmount: true });
        updateDetailReturn();
        syncPlanDetailAmountHint();
      };

      const open = (openOpts = {}) => {
        const emptyEntry = openOpts.emptyEntry === true;
        const openSource = openOpts.source === "finance" ? "finance" : "plan";
        const initialTab = "curated";
        const initialThemeCategory = themeCategoryByKey.has(
          String(openOpts.themeCategory || "").toLowerCase(),
        )
          ? String(openOpts.themeCategory || "").toLowerCase()
          : "all";
        allocPickerOpenSource = openSource;
        const currentPanelTickers = Array.from(
          panel.querySelectorAll(
            ".alloc-multi__ticker, .plan-detail-panel__alloc-ticker",
          ),
        )
          .map((el) =>
            String(el.textContent || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean);

        const fallbackItems = detailAllocOverride?.items?.length
          ? detailAllocOverride.items
          : (() => {
              const activePlan = (
                document
                  .querySelector("[data-plan-carousel]")
                  ?.getAttribute("data-active-plan") || "bitcoin"
              ).toLowerCase();
              const fallback =
                planAllocation[activePlan] || planAllocation.bitcoin;
              return fallback || [];
            })();

        const initialKeysFromPanel = currentPanelTickers
          .map(
            (ticker) =>
              pickableCoins.find((c) => c.ticker.toLowerCase() === ticker)?.key,
          )
          .filter(Boolean);
        const initialKeysFromFallback = fallbackItems
          .map((it) => {
            const ticker = String(it.ticker || "")
              .trim()
              .toLowerCase();
            return pickableCoins.find((c) => c.ticker.toLowerCase() === ticker)
              ?.key;
          })
          .filter(Boolean);

        const seed =
          openSource === "finance"
            ? []
            : emptyEntry
              ? []
              : initialKeysFromPanel.length
                ? initialKeysFromPanel
                : initialKeysFromFallback;
        selectedCoinKeys = Array.from(new Set(seed)).slice(0, 3);
        selectedThemeCoinKeys =
          openSource === "finance" ? [] : selectedCoinKeys.slice();
        activeThemeCategory = initialThemeCategory;
        themeCategoryBeforeSearchFocus = initialThemeCategory;
        searchForcedAllCategory = false;
        activeTab = initialTab;
        if (searchInput) searchInput.value = "";
        syncThemeSearchMode();
        syncTabs();
        renderThemeCategories();
        scrollActiveThemeCategoryIntoView();
        renderCoins();
        renderThemeCoins();
        renderChips({ full: true });
        document.dispatchEvent(new CustomEvent("fake-keyboard-hide"));
        allocPickerPanel.hidden = false;
        requestAnimationFrame(() => {
          allocPickerPanel.classList.add("is-open");
          scrollActiveThemeCategoryIntoView();
        });
      };

      const close = (closeOpts = {}) => {
        document.dispatchEvent(new CustomEvent("fake-keyboard-alloc-hide"));
        if (closeOpts.instant) {
          allocPickerPanel.style.transition = "none";
          allocPickerPanel.classList.remove("is-open");
          void allocPickerPanel.offsetHeight;
          allocPickerPanel.style.transition = "";
          allocPickerPanel.hidden = true;
          return;
        }
        allocPickerPanel.classList.remove("is-open");
        const onEnd = () => {
          if (!allocPickerPanel.classList.contains("is-open"))
            allocPickerPanel.hidden = true;
          allocPickerPanel.removeEventListener("transitionend", onEnd);
        };
        allocPickerPanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 420);
      };

      tabBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          activeTab =
            btn.dataset.allocPickerTab === "curated" ? "curated" : "coins";
          if (activeTab === "curated") {
            selectedThemeCoinKeys = [];
            renderThemeCategories();
            scrollActiveThemeCategoryIntoView();
            renderThemeCoins();
          }
          syncTabs();
        });
      });

      allocPickerPanel
        .querySelectorAll("[data-alloc-picker-close]")
        .forEach((btn) => {
          btn.addEventListener("click", () => close());
        });

      searchInput?.addEventListener("focus", () => syncThemeSearchMode());

      searchInput?.addEventListener("blur", () => {
        requestAnimationFrame(() => syncThemeSearchMode());
      });

      searchInput?.addEventListener("input", () => {
        syncThemeSearchMode();
        renderThemeCoins();
      });

      searchClearBtn?.addEventListener("mousedown", (e) => {
        e.preventDefault();
      });

      searchClearBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        if (searchInput) searchInput.value = "";
        renderThemeCoins();
        searchInput?.blur();
        syncThemeSearchMode();
      });

      coinsListEl?.addEventListener("click", (e) => {
        const row = e.target.closest("[data-alloc-picker-coin]");
        if (!row) return;
        const key = row.getAttribute("data-alloc-picker-coin");
        const idx = selectedCoinKeys.indexOf(key);
        if (idx >= 0) {
          selectedCoinKeys.splice(idx, 1);
        } else if (selectedCoinKeys.length < 3) {
          selectedCoinKeys.push(key);
        } else {
          showTopSnackbar("Max 3 coins", { variant: "alloc-picker-max" });
        }
        renderCoins({ full: false });
        renderChips();
      });

      themeCoinsListEl?.addEventListener("click", (e) => {
        const row = e.target.closest("[data-alloc-picker-coin]");
        if (!row) return;
        const key = row.getAttribute("data-alloc-picker-coin");
        const idx = selectedThemeCoinKeys.indexOf(key);
        if (idx >= 0) {
          selectedThemeCoinKeys.splice(idx, 1);
        } else if (selectedThemeCoinKeys.length < 3) {
          selectedThemeCoinKeys.push(key);
        } else {
          showTopSnackbar("Max 3 coins", { variant: "alloc-picker-max" });
        }
        renderThemeCoins({ full: false });
        renderChips();
      });

      chipsEl?.addEventListener("click", (e) => {
        const dismiss = e.target.closest(
          "button[data-alloc-picker-chip-remove]",
        );
        if (!dismiss) return;
        e.preventDefault();
        const key = dismiss.getAttribute("data-alloc-picker-chip-remove");
        setActiveSelectedKeys(getActiveSelectedKeys().filter((k) => k !== key));
        if (activeTab === "curated") renderThemeCoins({ full: false });
        else renderCoins({ full: false });
        renderChips();
      });

      continueBtn?.addEventListener("click", () => {
        if (allocPickerOpenSource === "finance") {
          // Finance entrypoint should move forward to plan detail, not "back" from a stacked child panel.
          // Open the plan first, then apply selected assets so newplan initialization doesn't clear override.
          closeFinanceThemesPage({ instant: true });
          close({ instant: true });
          setOpen(true, { source: "newplan" });
          customPlanTitle = "";
          applySelectedCoins();
          setTimeout(() => {
            const inp = panel.querySelector("[data-plan-detail-amount-input]");
            inp?.focus();
          }, 200);
          return;
        }
        applySelectedCoins();
        close();
      });

      themeCatsEl?.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-alloc-picker-theme-cat]");
        if (!btn) return;
        const next = String(
          btn.getAttribute("data-alloc-picker-theme-cat") || "",
        );
        if (!next || next === activeThemeCategory) return;
        activeThemeCategory = next;
        searchForcedAllCategory = false;
        renderThemeCategories();
        scrollActiveThemeCategoryIntoView("smooth");
        renderThemeCoins();
      });

      document.addEventListener("range-sheet-confirmed", () => {
        if (!allocPickerPanel.classList.contains("is-open")) return;
        renderCoins();
        renderThemeCoins();
      });

      return { open, close };
    };
    const allocPickerApi = initPlanAllocPicker();

    const initPlanBreakdownPanel = () => {
      const breakdownPanel = document.querySelector(
        "[data-plan-breakdown-panel]",
      );
      if (!breakdownPanel)
        return {
          open: () => {},
          close: () => {},
          sync: () => {},
          syncFromPlanWidget: () => {},
        };

      const rangeBtnDetail = breakdownPanel.querySelector(
        ".plan-breakdown-panel__range--detail",
      );
      const rangeBtnWidget = breakdownPanel.querySelector(
        ".plan-breakdown-panel__range--widget",
      );
      const breakdownSegments = Array.from(
        breakdownPanel.querySelectorAll("[data-plan-breakdown-segment]"),
      );
      const breakdownCardEl = breakdownPanel.querySelector(
        ".plan-breakdown-panel__card",
      );

      const iconWrap = breakdownPanel.querySelector(
        "[data-plan-breakdown-icon-wrap]",
      );
      const headlineEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-headline]",
      );
      const legendAssetsEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-legend-assets]",
      );
      const legendSpEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-legend-sp]",
      );
      const legendSpItemEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-legend-sp-item]",
      );
      const simTitleEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-sim-title]",
      );
      const periodLabelEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-period-label]",
      );
      const contributionEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-contribution]",
      );
      const totalLabelEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-total-label]",
      );
      const totalEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-total]",
      );
      const valueEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-value]",
      );
      const profitPctEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-pct]",
      );
      const profitHistPctEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-historic-pct]",
      );
      const profitAssetIconsEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-asset-icons]",
      );
      const profitHistCapEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-historic-caption]",
      );
      const profitStratCapEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-strategy-caption]",
      );
      const profitAbsEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-abs]",
      );
      const profitCurEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-profit-currency]",
      );
      const breakdownScrollEl = breakdownPanel.querySelector(
        ".plan-breakdown-panel__body",
      );
      const pastViewEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-view]",
      );
      const pastListEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-list]",
      );
      const pastRangeEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-range]",
      );
      const pastCombinedEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-combined]",
      );
      const pastCombinedValueEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-combined-value]",
      );
      const pastCombinedValueWrapEl = breakdownPanel.querySelector(
        ".plan-breakdown-panel__past-combined-value-wrap",
      );
      const pastCombinedArrowEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-combined-arrow]",
      );
      const pastDividerEl = breakdownPanel.querySelector(
        "[data-plan-breakdown-past-divider]",
      );

      /** @type {'detail' | 'widget'} */
      let breakdownOpenSource = "detail";
      /** @type {'simulated' | 'historic'} */
      let breakdownViewMode = "simulated";

      const ensureBreakdownCardViewMarkup = () => {
        if (!breakdownCardEl) return;
        breakdownCardEl.classList.remove("is-empty");
      };

      const setBreakdownViewMode = (mode) => {
        breakdownViewMode = mode === "historic" ? "historic" : "simulated";
        breakdownSegments.forEach((btn) => {
          const active =
            btn.getAttribute("data-plan-breakdown-segment") ===
            breakdownViewMode;
          btn.classList.toggle("is-active", active);
          btn.setAttribute("aria-selected", active ? "true" : "false");
        });
        ensureBreakdownCardViewMarkup();
      };
      setBreakdownViewMode("simulated");

      const renderPastPerformanceCard = (selectedAssets, range) => {
        if (!pastViewEl || !pastListEl) return;
        if (pastRangeEl) pastRangeEl.textContent = range || "5Y";
        const normalizedRange = String(range || "5Y").toUpperCase();
        const rows = (selectedAssets || []).slice(0, 3).map((asset) => {
          const ticker = String(asset?.ticker || "")
            .trim()
            .toUpperCase();
          const key = ticker.toLowerCase();
          const fromSpotlight = spotlightReturns[key]?.[normalizedRange];
          const numericPct = parseFloat(
            String(fromSpotlight || "0").replace(/[^0-9.-]/g, ""),
          );
          const pct = Number.isFinite(numericPct) ? numericPct : 0;
          return {
            name: String(asset?.name || ticker || "Asset").trim(),
            ticker: ticker || "—",
            icon: String(asset?.icon || "assets/icon_currency_btc.svg").trim(),
            pct,
          };
        });
        pastListEl.innerHTML = rows
          .map(
            (row) => `
          <div class="plan-breakdown-panel__past-row">
            <img class="plan-breakdown-panel__past-icon" src="${row.icon}" alt="" />
            <div class="plan-breakdown-panel__past-asset">
              <span class="plan-breakdown-panel__past-name">${row.name}</span>
              <span class="plan-breakdown-panel__past-ticker">${row.ticker}</span>
            </div>
            <span class="plan-breakdown-panel__past-pct ${row.pct < 0 ? "is-negative" : ""}">
              <img src="${row.pct < 0 ? RETURN_METRIC_ARROW_HIST_NEG : RETURN_METRIC_ARROW_HIST_POS}" alt="" class="plan-breakdown-panel__past-pct-arrow" />
              ${Math.abs(row.pct).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
            </span>
          </div>
        `,
          )
          .join("");

        const showCombined = rows.length >= 2;
        if (pastCombinedEl) pastCombinedEl.hidden = !showCombined;
        if (pastDividerEl) pastDividerEl.hidden = rows.length < 1;
        if (
          showCombined &&
          pastCombinedValueEl &&
          pastCombinedValueWrapEl &&
          pastCombinedArrowEl
        ) {
          const avg = rows.reduce((acc, row) => acc + row.pct, 0) / rows.length;
          const pos = avg >= 0;
          pastCombinedValueEl.textContent = `${Math.abs(avg).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
          pastCombinedValueWrapEl.classList.toggle("is-negative", !pos);
          pastCombinedArrowEl.src = pos
            ? RETURN_METRIC_ARROW_HIST_POS
            : RETURN_METRIC_ARROW_HIST_NEG;
        }
      };

      const syncBreakdownViewVisibility = () => {
        const showPast = breakdownViewMode === "historic";
        if (pastViewEl) pastViewEl.hidden = !showPast;
        if (iconWrap) iconWrap.hidden = showPast;
        const simNodes = [
          ".plan-breakdown-panel__plan-row",
          ".plan-breakdown-panel__chart",
          ".plan-breakdown-panel__stats",
        ];
        simNodes.forEach((sel) => {
          const el = breakdownPanel.querySelector(sel);
          if (el) el.hidden = showPast;
        });
      };

      const setBreakdownRangeButtons = (source) => {
        if (rangeBtnDetail) rangeBtnDetail.hidden = source !== "detail";
        if (rangeBtnWidget) rangeBtnWidget.hidden = source !== "widget";
      };

      const applyCommonBreakdownUi = ({
        selectedAssets,
        prettyTickers,
        range,
        amount,
        cur,
        freqLabel,
        sim,
        chartPlanKey,
        freq,
        fallbackIconSrc,
      }) => {
        const pct = Number.isFinite(sim?.returnPct) ? sim.returnPct : 0;
        const histPct = Number.isFinite(sim?.historicReturnPct)
          ? sim.historicReturnPct
          : 0;
        const totalInvested = Math.round(
          Number.isFinite(sim?.totalInvested) ? sim.totalInvested : 0,
        );
        const profit = Number.isFinite(sim?.profit) ? sim.profit : 0;
        const value = Math.round(totalInvested + profit);

        const tickers = (selectedAssets || [])
          .map((it) => String(it?.ticker || "").trim())
          .filter(Boolean)
          .slice(0, 3);
        const stackItems = (selectedAssets || [])
          .slice(0, 3)
          .filter((it) => it && it.icon);
        const isBreakdownIconStack = stackItems.length >= 2;
        if (iconWrap) {
          iconWrap.classList.toggle(
            "plan-breakdown-panel__asset-wrap--stack",
            isBreakdownIconStack,
          );
          iconWrap.classList.toggle(
            "plan-breakdown-panel__asset-wrap--single",
            !isBreakdownIconStack,
          );
        }
        renderPlanDetailProductIcons(
          iconWrap,
          iconWrap,
          fallbackIconSrc,
          tickers.length ? selectedAssets : null,
          {
            singleProductClass: "plan-breakdown-panel__asset-icon",
            singleHeaderClass: "plan-breakdown-panel__asset-icon",
          },
        );
        if (headlineEl) {
          headlineEl.textContent = `If you'd started ${range} ago and invested in ${prettyTickers}`;
        }
        if (simTitleEl) {
          const breakdownPlanSetupTail =
            freq === "flexible"
              ? "your plan setup"
              : freq === "daily"
                ? "your daily plan setup"
                : freq === "weekly"
                  ? "your weekly plan setup"
                  : "your monthly plan setup";
          simTitleEl.textContent = `Past ${range} simulation based on ${breakdownPlanSetupTail}`;
        }
        breakdownPanel
          .querySelectorAll("[data-plan-breakdown-profit-range-label]")
          .forEach((el) => {
            el.textContent = "Simulated outcome ≈";
          });
        if (legendAssetsEl)
          legendAssetsEl.textContent = `Simulated value (${prettyTickers || "—"})`;
        const showSp500 = getPrototypeBreakdownSp500Visible();
        if (legendSpEl) legendSpEl.hidden = !showSp500;
        if (legendSpItemEl) legendSpItemEl.hidden = !showSp500;
        if (periodLabelEl)
          periodLabelEl.textContent =
            freq === "flexible"
              ? "Invested each time"
              : `${freqLabel} invested`;
        if (totalLabelEl) totalLabelEl.textContent = `Total invested`;
        if (contributionEl)
          contributionEl.textContent = `${amount.toLocaleString("en-US")} ${cur}`;
        if (totalEl)
          totalEl.textContent = `${formatPlanDetailFooterMoney(totalInvested, cur)} ${cur}`;
        if (valueEl)
          valueEl.textContent = `${formatPlanDetailFooterSimulatedValueAmount(value, cur)} ${cur}`;
        if (profitPctEl) {
          profitPctEl.textContent = `${pct.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
        }
        if (profitHistPctEl) {
          profitHistPctEl.textContent = `${histPct.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
        }
        const profitIcons = buildReturnMetricProductIconWrap(
          selectedAssets,
          fallbackIconSrc,
        );
        setReturnMetricIconWrapHtml(profitAssetIconsEl, profitIcons.html, {
          layoutSig: profitIcons.sig,
        });
        if (profitHistCapEl)
          profitHistCapEl.textContent =
            buildHistoricPerformanceCaption(selectedAssets);
        if (profitStratCapEl) profitStratCapEl.textContent = "Return";
        if (profitAbsEl) {
          profitAbsEl.textContent = `${profit >= 0 ? "+" : "-"}${formatDetailFooterProfit(Math.abs(profit), cur)}`;
        }
        if (profitCurEl) profitCurEl.textContent = cur;

        const stratG = breakdownPanel.querySelector(
          ".plan-breakdown-panel__profit-metrics-col--strategy.plan-breakdown-panel__profit-metrics-col--values",
        );
        const histG = breakdownPanel.querySelector(
          ".plan-breakdown-panel__profit-metrics-col--historic.plan-breakdown-panel__profit-metrics-col--values",
        );
        setReturnMetricTone(stratG, profit);
        setReturnMetricTone(histG, histPct);

        const chartSvg = breakdownPanel.querySelector(
          "[data-plan-breakdown-chart-svg]",
        );
        const chartData = computePlanBreakdownChartSeries({
          amount,
          planKey: chartPlanKey,
          freq,
          historicalRangeKey: range,
        });
        renderPlanBreakdownChartSvg(chartSvg, chartData);
      };

      const syncFromDetail = (opts = {}) => {
        const fallbackIconSrc = opts.iconSrc || "assets/icon_currency_btc.svg";
        const selectedAssets = getCurrentPlanDisplayAssets(fallbackIconSrc);
        const tickers = selectedAssets
          .map((it) => String(it?.ticker || "").trim())
          .filter(Boolean)
          .slice(0, 3);
        const prettyTickers = tickers.join(", ") || "BTC";
        const range = rangeState.breakdown || "5Y";
        const amount =
          parseInt(
            String(amountInput?.value || "").replace(/[^0-9]/g, ""),
            10,
          ) || 0;
        const cur = String(
          panel.querySelector("[data-plan-detail-currency]")?.textContent ||
            currencyState.plan ||
            "TWD",
        ).trim();
        const freq = (
          document
            .querySelector("[data-plan-freq-item].is-active")
            ?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        const freqLabel =
          freq === "daily" ? "Daily" : freq === "weekly" ? "Weekly" : "Monthly";
        if (breakdownViewMode === "historic") {
          renderPastPerformanceCard(selectedAssets, range);
          syncBreakdownViewVisibility();
          return;
        }

        const ctx = panelOpenContext;
        const overrideCuratedKey =
          detailAllocOverride?.kind === "curated" && detailAllocOverride.key
            ? String(detailAllocOverride.key).toLowerCase()
            : "";
        const effectiveCuratedKey =
          ctx.source === "curated" && ctx.curatedKey
            ? String(ctx.curatedKey).toLowerCase()
            : overrideCuratedKey;
        let planKeyOpt;
        if (effectiveCuratedKey) planKeyOpt = effectiveCuratedKey;
        else if (ctx.source === "spotlight" && ctx.spotlightKey)
          planKeyOpt = String(ctx.spotlightKey).toLowerCase();

        const chartPlanKey =
          planKeyOpt ||
          String(
            document
              .querySelector("[data-plan-carousel]")
              ?.getAttribute("data-active-plan") || "bitcoin",
          ).toLowerCase();

        const sim = updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: planKeyOpt,
          freq,
          historicalRangeKey: range,
          domWrite: false,
          displayAssets: selectedAssets,
        });
        const simWithAllocTweak = (() => {
          if (!sim || typeof detailPanelAllocPctTweakFn !== "function")
            return sim;
          const tw = detailPanelAllocPctTweakFn();
          if (!isFinite(tw)) return sim;
          const next = { ...sim };
          const simBasePct = Number.isFinite(sim.returnPct) ? sim.returnPct : 0;
          const simAppliedTw = amount > 0 ? tw : 0;
          const simNextPct = simBasePct + simAppliedTw;
          next.returnPct = simNextPct;
          if (Number.isFinite(sim.profit) && Math.abs(simBasePct) > 1e-6) {
            next.profit = sim.profit * (simNextPct / simBasePct);
          }
          if (Number.isFinite(sim.historicReturnPct)) {
            next.historicReturnPct = sim.historicReturnPct + tw;
          }
          return next;
        })();

        applyCommonBreakdownUi({
          selectedAssets,
          prettyTickers,
          range,
          amount,
          cur,
          freqLabel,
          sim: simWithAllocTweak,
          chartPlanKey,
          freq,
          fallbackIconSrc,
        });
      };

      const syncFromWidget = () => {
        const carousel = document.querySelector("[data-plan-carousel]");
        const activePlan = String(
          carousel?.getAttribute("data-active-plan") || "bitcoin",
        ).toLowerCase();
        const selectedAssets = (
          planAllocation[activePlan] ||
          planAllocation.bitcoin ||
          []
        ).slice(0, 3);
        const tickers = selectedAssets
          .map((it) => String(it?.ticker || "").trim())
          .filter(Boolean)
          .slice(0, 3);
        const prettyTickers = tickers.join(", ") || "BTC";
        const range = rangeState.widgetBreakdown || rangeState.plan || "5Y";
        const amount =
          parseInt(
            String(
              document.querySelector("[data-plan-amount]")?.textContent || "0",
            ).replace(/[^0-9]/g, ""),
            10,
          ) || 0;
        const cur = String(
          document.querySelector("[data-plan-currency-label]")?.textContent ||
            currencyState.plan ||
            "TWD",
        ).trim();
        const freq = (
          document
            .querySelector("[data-plan-freq-item].is-active")
            ?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        const freqLabel =
          freq === "daily" ? "Daily" : freq === "weekly" ? "Weekly" : "Monthly";
        const fallbackIconSrc =
          selectedAssets[0]?.icon || "assets/icon_currency_btc.svg";
        if (breakdownViewMode === "historic") {
          renderPastPerformanceCard(selectedAssets, range);
          syncBreakdownViewVisibility();
          return;
        }

        const sim = updatePlanStrategyHistoricalReturn({
          amount,
          planKey: activePlan,
          freq,
          historicalRangeKey: range,
          domWrite: false,
          displayAssets: selectedAssets,
        });

        applyCommonBreakdownUi({
          selectedAssets,
          prettyTickers,
          range,
          amount,
          cur,
          freqLabel,
          sim,
          chartPlanKey: activePlan,
          freq,
          fallbackIconSrc,
        });
      };

      const sync = (opts = {}) => {
        ensureBreakdownCardViewMarkup();
        syncBreakdownViewVisibility();
        const source =
          opts.source ||
          (breakdownPanel.classList.contains("is-open")
            ? breakdownOpenSource
            : "detail");
        if (source === "widget") syncFromWidget();
        else syncFromDetail(opts);
      };

      const open = () => {
        breakdownOpenSource = "detail";
        setBreakdownViewMode("simulated");
        // Opening breakdown from plan-detail footer should inherit the current plan range.
        rangeState.breakdown = rangeState.plan || rangeState.breakdown || "5Y";
        updateRangeUI("breakdown", rangeState.breakdown);
        setBreakdownRangeButtons("detail");
        syncFromDetail();
        syncBreakdownViewVisibility();
        if (breakdownScrollEl) breakdownScrollEl.scrollTop = 0;
        panel.classList.add("is-plan-breakdown-open");
        breakdownPanel.hidden = false;
        requestAnimationFrame(() => breakdownPanel.classList.add("is-open"));
      };

      const openFromPlanWidget = () => {
        breakdownOpenSource = "widget";
        setBreakdownViewMode("simulated");
        // Opening breakdown from Finance quick strategy should inherit its current range.
        rangeState.widgetBreakdown =
          rangeState.plan || rangeState.widgetBreakdown || "5Y";
        updateRangeUI("widgetBreakdown", rangeState.widgetBreakdown);
        setBreakdownRangeButtons("widget");
        syncFromWidget();
        syncBreakdownViewVisibility();
        breakdownPanel.hidden = false;
        requestAnimationFrame(() => breakdownPanel.classList.add("is-open"));
      };

      const close = (closeOpts = {}) => {
        const finishClose = () => {
          breakdownPanel.hidden = true;
          panel.classList.remove("is-plan-breakdown-open");
        };
        if (closeOpts.instant) {
          breakdownPanel.style.transition = "none";
          breakdownPanel.classList.remove("is-open");
          void breakdownPanel.offsetHeight;
          breakdownPanel.style.transition = "";
          finishClose();
          return;
        }
        breakdownPanel.classList.remove("is-open");
        const onEnd = () => {
          if (!breakdownPanel.classList.contains("is-open")) {
            finishClose();
          }
          breakdownPanel.removeEventListener("transitionend", onEnd);
        };
        breakdownPanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };

      panel
        .querySelector(".plan-detail-panel__view-breakdown-link")
        ?.addEventListener("click", open);
      document
        .querySelector(".plan-strategy__view-breakdown-link")
        ?.addEventListener("click", openFromPlanWidget);
      breakdownPanel
        .querySelectorAll("[data-plan-breakdown-close]")
        .forEach((btn) => btn.addEventListener("click", close));
      breakdownSegments.forEach((btn) => {
        btn.addEventListener("click", () => {
          setBreakdownViewMode(btn.getAttribute("data-plan-breakdown-segment"));
          sync();
        });
      });

      document.addEventListener("range-sheet-confirmed", (e) => {
        if (!breakdownPanel.classList.contains("is-open")) return;
        const ctx = e?.detail?.context;
        // The breakdown panel is shared by Plan Detail and Finance widget.
        // Once opened, it must not "switch sources" when range changes — only refresh
        // if the confirmed range context matches the currently-open source.
        if (
          ctx === "breakdown" &&
          (breakdownOpenSource === "detail" || rangeBtnDetail?.hidden === false)
        ) {
          syncFromDetail();
        } else if (
          ctx === "widgetBreakdown" &&
          (breakdownOpenSource === "widget" || rangeBtnWidget?.hidden === false)
        ) {
          syncFromWidget();
        }
      });

      document.addEventListener("plan-schedule-confirmed", () => {
        if (
          breakdownPanel.classList.contains("is-open") &&
          breakdownOpenSource === "detail"
        )
          sync({ source: "detail" });
      });
      document.addEventListener("prototype-breakdown-sp500-toggle", () => {
        if (!breakdownPanel.classList.contains("is-open")) return;
        if (breakdownOpenSource === "widget") syncFromWidget();
        else syncFromDetail();
      });

      return {
        open,
        close,
        sync,
        syncFromPlanWidget: () => {
          if (
            breakdownPanel.classList.contains("is-open") &&
            breakdownOpenSource === "widget"
          )
            syncFromWidget();
        },
      };
    };
    planBreakdownApi = initPlanBreakdownPanel();

    const initPlanOverviewPanel = () => {
      const overviewPanel = panel.querySelector("[data-plan-overview-panel]");
      if (!overviewPanel)
        return { open: () => {}, close: () => {}, sync: () => {} };
      const overviewScroller = overviewPanel.querySelector(
        ".plan-overview-panel__scroller",
      );
      const overviewHeader = overviewPanel.querySelector(
        ".plan-overview-panel__header",
      );
      const overviewConfirmBtn = overviewPanel.querySelector(
        "[data-plan-overview-confirm]",
      );
      const overviewConsentRow = overviewPanel.querySelector(
        ".plan-overview-panel__consent",
      );
      const overviewConsentToggle = overviewPanel.querySelector(
        "[data-plan-overview-consent-toggle]",
      );
      const overviewConsentLink = overviewPanel.querySelector(
        ".plan-overview-panel__consent-link",
      );
      const overviewConsentIcon = overviewPanel.querySelector(
        ".plan-overview-panel__consent-icon",
      );
      let overviewConsentChecked = false;
      let openedFromBuffer = false;

      const overviewTimingLabels = {
        daily: "Every day at",
        weekly: "Every week on",
        monthly: "Every month on",
      };

      // Reserve option section removed from overview.
      const closeReserveInfo = () => {};

      const syncOverviewConsentUI = () => {
        if (overviewConsentToggle) {
          overviewConsentToggle.setAttribute(
            "aria-pressed",
            overviewConsentChecked ? "true" : "false",
          );
        }
        if (overviewConsentIcon) {
          overviewConsentIcon.setAttribute(
            "src",
            overviewConsentChecked
              ? "assets/icon_checkbox_on.svg"
              : "assets/icon_checkbox_off.svg",
          );
        }
        if (overviewConfirmBtn)
          overviewConfirmBtn.disabled = !overviewConsentChecked;
      };

      const syncFromPlanDetail = () => {
        const chipsEl = overviewPanel.querySelector(
          "[data-plan-overview-chips]",
        );
        const headingEl = overviewPanel.querySelector(
          "[data-plan-overview-alloc-heading]",
        );
        const headerTitleEl = overviewPanel.querySelector(
          "[data-plan-overview-header-title]",
        );
        const planAmountEl = overviewPanel.querySelector(
          "[data-plan-overview-plan-amount]",
        );
        const planMetaEl = overviewPanel.querySelector(
          "[data-plan-overview-plan-meta]",
        );
        const planIconWrap = overviewPanel.querySelector(
          "[data-plan-overview-plan-icon-wrap]",
        );
        const repeatsEl = overviewPanel.querySelector(
          "[data-plan-overview-repeats]",
        );
        const endMainEl = overviewPanel.querySelector(
          "[data-plan-overview-end-main]",
        );
        const endSubEl = overviewPanel.querySelector(
          "[data-plan-overview-end-sub]",
        );
        const totalPlannedRowEl = overviewPanel.querySelector(
          "[data-plan-overview-total-planned-row]",
        );
        const totalPlannedAfterDividerEl = overviewPanel.querySelector(
          "[data-plan-overview-total-planned-after-divider]",
        );
        const totalPlannedValEl = overviewPanel.querySelector(
          "[data-plan-overview-total-planned]",
        );
        const paymentMethodEl = overviewPanel.querySelector(
          "[data-plan-overview-payment-method]",
        );
        const paymentMethodSubEl = overviewPanel.querySelector(
          "[data-plan-overview-payment-method-sub]",
        );
        const prefundDividerEl = overviewPanel.querySelector(
          "[data-plan-overview-prefund-divider]",
        );
        const prefundRowEl = overviewPanel.querySelector(
          "[data-plan-overview-prefund-row]",
        );
        const runoutDividerEl = overviewPanel.querySelector(
          "[data-plan-overview-runout-divider]",
        );
        const runoutRowEl = overviewPanel.querySelector(
          "[data-plan-overview-runout-row]",
        );
        const runoutValueEl = overviewPanel.querySelector(
          "[data-plan-overview-runout-value]",
        );
        const prefundAfterDividerEl = overviewPanel.querySelector(
          "[data-plan-overview-prefund-after-divider]",
        );
        const prefundAmountEl = overviewPanel.querySelector(
          "[data-plan-overview-prefund-amount]",
        );
        const prefundSubEl = overviewPanel.querySelector(
          "[data-plan-overview-prefund-sub]",
        );
        const firstBuyEl = overviewPanel.querySelector(
          "[data-plan-overview-first-buy]",
        );
        const deductSubEl = overviewPanel.querySelector(
          "[data-plan-overview-deduct-sub]",
        );
        const deductValueEl = overviewPanel.querySelector(
          "[data-plan-overview-deduct-value]",
        );

        const multiItems = getActiveAllocMultiItems();
        const singleItems = panel.querySelectorAll(
          ".plan-detail-panel__alloc-item",
        );

        if (chipsEl) chipsEl.textContent = "";

        if (multiItems.length) {
          const allocRoot = getActiveAllocMultiRoot();
          const isAmountMode = !!allocRoot?.classList.contains(
            "alloc-multi--amount-mode",
          );
          /** @type {number[]} */
          let pctValues = [];
          if (isAmountMode) {
            const amounts = Array.from(multiItems).map((row) => {
              const pctIn = row.querySelector("[data-alloc-pct-input]");
              const raw = pctIn
                ? String(pctIn.value || "").replace(/[^0-9]/g, "")
                : "";
              return raw ? parseInt(raw, 10) : 0;
            });
            const totalAmt = amounts.reduce(
              (s, n) => s + (isFinite(n) ? n : 0),
              0,
            );
            if (totalAmt > 0) {
              pctValues = amounts.map((n) =>
                Math.max(0, Math.round((n / totalAmt) * 100)),
              );
              // Keep display totals stable at 100% after rounding.
              const sumPct = pctValues.reduce((s, n) => s + n, 0);
              const adjIdx = pctValues.length - 1;
              if (adjIdx >= 0 && sumPct !== 100)
                pctValues[adjIdx] += 100 - sumPct;
            } else {
              pctValues = amounts.map(() => 0);
            }
          }
          const singleMulti = multiItems.length === 1;
          multiItems.forEach((row, idx) => {
            const icon =
              row.querySelector(".alloc-multi__icon")?.getAttribute("src") ||
              "";
            const ticker =
              row.querySelector(".alloc-multi__ticker")?.textContent?.trim() ||
              "";
            const pctIn = row.querySelector("[data-alloc-pct-input]");
            const pctRaw = pctIn
              ? String(pctIn.value || "").replace(/[^0-9]/g, "")
              : "";
            const pctNum = isAmountMode
              ? isFinite(pctValues[idx])
                ? pctValues[idx]
                : 0
              : pctRaw
                ? parseInt(pctRaw, 10)
                : 0;
            if (!ticker) return;
            appendPlanOverviewStyleAllocChip(
              chipsEl,
              { icon, ticker, pct: pctNum },
              { singleAssetFallback: singleMulti },
            );
          });
        } else {
          singleItems.forEach((row) => {
            const icon =
              row
                .querySelector(".plan-detail-panel__alloc-icon")
                ?.getAttribute("src") || "";
            const ticker =
              row
                .querySelector(".plan-detail-panel__alloc-ticker")
                ?.textContent?.trim() || "";
            if (!ticker) return;
            appendPlanOverviewStyleAllocChip(
              chipsEl,
              { icon, ticker, pct: 100 },
              { singleAssetFallback: true },
            );
          });
        }

        const n = chipsEl ? chipsEl.children.length : 0;
        if (headingEl) headingEl.textContent = `Allocation (${n})`;

        const planName =
          panel.querySelector("[data-plan-detail-name]")?.textContent?.trim() ||
          "—";
        if (headerTitleEl) headerTitleEl.textContent = planName;

        const amount =
          parseInt(
            String(amountInput?.value || "").replace(/[^0-9]/g, ""),
            10,
          ) || 0;
        const cur = String(
          panel.querySelector("[data-plan-detail-currency]")?.textContent ||
            currencyState.plan ||
            "TWD",
        ).trim();

        const freqKey = (
          document
            .querySelector("[data-plan-freq-item].is-active")
            ?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        const freqBtn = document.querySelector(
          "[data-plan-freq-item].is-active",
        );
        const freqText = freqBtn?.textContent?.trim() || "Monthly";
        const sched = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        );
        const schedLower = sched.toLowerCase();
        const cadenceFromSchedule = schedLower.startsWith("daily")
          ? "day"
          : schedLower.startsWith("weekly")
            ? "week"
            : schedLower.startsWith("monthly") ||
                schedLower.startsWith("flexible")
              ? "month"
              : "";
        const freqUnit =
          cadenceFromSchedule ||
          (freqKey === "daily"
            ? "day"
            : freqKey === "weekly"
              ? "week"
              : "month");
        const scheduleLine =
          formatScheduleNaturalLine(sched) ||
          (freqUnit === "day"
            ? "every day"
            : freqUnit === "week"
              ? "every week"
              : "every month");
        if (planAmountEl) {
          planAmountEl.textContent =
            amount > 0
              ? `Invest ${amount.toLocaleString("en-US")} ${cur}`
              : "—";
        }
        const schedParts = sched
          .split("·")
          .map((t) => t.trim())
          .filter(Boolean);
        const timingDetail =
          schedParts.length > 1
            ? schedParts.slice(1).join(" · ")
            : schedParts[0] || "—";
        const repeatsText = sched
          ? sched.replace(/\s+at\s+~?\d{1,2}:\d{2}\s*$/i, "").trim()
          : "";
        if (repeatsEl) {
          repeatsEl.textContent = repeatsText || freqText;
        }
        if (planMetaEl) {
          const schedText = scheduleLine || "";
          planMetaEl.textContent = schedText;
          planMetaEl.hidden = !schedText;
        }

        const fallbackPlanIcon =
          getActiveAllocSection()
            ?.querySelector(".alloc-multi__icon")
            ?.getAttribute("src") ||
          panel
            .querySelector(".plan-detail-panel__alloc-icon")
            ?.getAttribute("src") ||
          "assets/icon_currency_btc.svg";
        const selectedPlanAssets =
          getCurrentPlanDisplayAssets(fallbackPlanIcon);
        if (planIconWrap) {
          renderPlanDetailProductIcons(
            planIconWrap,
            planIconWrap,
            fallbackPlanIcon,
            selectedPlanAssets,
            {
              singleProductClass: "plan-detail-panel__product-icon",
              singleHeaderClass: "plan-detail-panel__product-icon",
            },
          );
        }

        const endEl = panel.querySelector("[data-plan-detail-repeats-end]");
        const endRaw = String(
          endEl?.dataset?.endConditionText || endEl?.textContent || "—",
        ).trim();
        let endMain = "Continuous";
        let endSub = "Pause any time";
        const endLower = endRaw.toLowerCase();
        // When set to number-of-buys mode, plan-detail stores values like:
        // "12 buys ~ Ends Mar 24, 2027" (or small legacy variants). Split this
        // so overview shows title: "12 buys", subtitle: "~ Ends Mar 24, 2027".
        const buysEndsMatch = endRaw.match(
          /^(.+?\bbuys?\b)\s*(?:~\s*)?Ends\s+(.+)$/i,
        );
        if (
          buysEndsMatch ||
          endLower === "continuous" ||
          /^after\s*\d+/i.test(endRaw) ||
          /^after number/i.test(endRaw) ||
          isPlanDetailSetLimitEnd(endRaw)
        ) {
          endSub = "Pause any time";
        }
        if (endMainEl) endMainEl.textContent = endMain;
        if (endSubEl) {
          endSubEl.textContent = endSub;
          endSubEl.hidden = !endSub;
        }
        const showTotalPlanned = false;
        if (totalPlannedRowEl) {
          totalPlannedRowEl.hidden = !showTotalPlanned;
          totalPlannedRowEl.style.display = showTotalPlanned ? "" : "none";
        }
        if (totalPlannedAfterDividerEl) {
          totalPlannedAfterDividerEl.hidden = !showTotalPlanned;
          totalPlannedAfterDividerEl.style.display = showTotalPlanned
            ? ""
            : "none";
        }
        if (totalPlannedValEl) {
          const detailTotalPlanned =
            panel
              .querySelector("[data-plan-detail-total-planned]")
              ?.textContent?.trim() || "- -";
          totalPlannedValEl.textContent = showTotalPlanned
            ? detailTotalPlanned
            : "- -";
        }

        const selectedMethod =
          planBufferOverviewState.mode === "reserved" ? "reserved" : "flexible";
        if (paymentMethodEl) {
          paymentMethodEl.textContent =
            selectedMethod === "reserved" ? "Pre-fund" : "${cur} balance";
        }
        if (paymentMethodSubEl) {
          const showPaymentMethodSub = selectedMethod === "reserved";
          paymentMethodSubEl.textContent = showPaymentMethodSub
            ? "Reserved directly"
            : "";
          paymentMethodSubEl.hidden = !showPaymentMethodSub;
          paymentMethodSubEl.style.display = showPaymentMethodSub ? "" : "none";
        }
        const showPrefund = false;
        if (prefundRowEl) {
          prefundRowEl.hidden = !showPrefund;
          prefundRowEl.style.display = showPrefund ? "" : "none";
        }
        // Plan overview summary should only keep Duration, Deduct from, and First buy rows.
        if (prefundDividerEl) {
          prefundDividerEl.hidden = true;
          prefundDividerEl.style.display = "none";
        }
        if (runoutDividerEl) {
          runoutDividerEl.hidden = !showPrefund;
          runoutDividerEl.style.display = showPrefund ? "" : "none";
        }
        if (runoutRowEl) {
          runoutRowEl.hidden = !showPrefund;
          runoutRowEl.style.display = showPrefund ? "" : "none";
        }
        if (runoutValueEl) {
          runoutValueEl.textContent = planBufferOverviewState.autoRefillEnabled
            ? "Auto-reserve again"
            : "Use remaining balance";
        }
        if (prefundAfterDividerEl) {
          prefundAfterDividerEl.hidden = !showPrefund;
          prefundAfterDividerEl.style.display = showPrefund ? "" : "none";
        }
        if (prefundAmountEl) {
          const reserveInputNum = Number.isFinite(
            planBufferOverviewState.reservedAmount,
          )
            ? Math.floor(planBufferOverviewState.reservedAmount)
            : NaN;
          prefundAmountEl.textContent =
            Number.isFinite(reserveInputNum) && reserveInputNum > 0
              ? `${reserveInputNum.toLocaleString("en-US")} ${cur}`
              : "—";
          if (prefundSubEl) {
            // Always start from neutral text; avoid any stale legacy "Covers ..." copy.
            prefundSubEl.textContent = "—";
            const coversCount =
              Number.isFinite(reserveInputNum) &&
              reserveInputNum > 0 &&
              amount > 0
                ? Math.floor(reserveInputNum / amount)
                : 0;
            const dateUnit =
              freqKey === "daily"
                ? "day"
                : freqKey === "weekly"
                  ? "week"
                  : "month";
            const unitLabel =
              freqKey === "flexible"
                ? coversCount === 1
                  ? "buy"
                  : "buys"
                : `${dateUnit}${coversCount === 1 ? "" : "s"}`;
            let untilText = "";
            if (coversCount > 0) {
              const compactNextBuyForCovers =
                formatFinanceNextBuyCompact(sched) || "";
              const dateToken =
                compactNextBuyForCovers.split("·")[0]?.trim() || "";
              const monthDayMatch = dateToken.match(
                /^([A-Za-z]{3,9})\s+(\d{1,2})$/,
              );
              if (monthDayMatch) {
                const monthDay = `${monthDayMatch[1]} ${monthDayMatch[2]}`;
                const now = new Date();
                const endDate = new Date(`${monthDay} ${now.getFullYear()}`);
                if (!Number.isNaN(endDate.getTime())) {
                  if (endDate.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                  }
                  if (dateUnit === "day")
                    endDate.setDate(endDate.getDate() + coversCount);
                  else if (dateUnit === "week")
                    endDate.setDate(endDate.getDate() + coversCount * 7);
                  else endDate.setMonth(endDate.getMonth() + coversCount);
                  untilText = endDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  });
                }
              }
            }
            prefundSubEl.textContent =
              coversCount > 0
                ? `~${coversCount} ${unitLabel}${untilText ? ` · until ${untilText}` : ""}`
                : "—";
          }
        }

        const compactNextBuy = formatFinanceNextBuyCompact(sched);
        let firstBuyText = "—";
        const buyNowOn = panel.dataset?.scheduleBuyNow === "1";
        const isZhLocale = String(window.I18N?.getLocale?.() || "en") === "zh";
        const firstBuyLocale = isZhLocale ? "zh-TW" : "en-US";
        const firstBuyDateFormat = isZhLocale
          ? { weekday: "long", month: "numeric", day: "numeric" }
          : { weekday: "long", month: "short", day: "numeric" };
        if (buyNowOn) {
          firstBuyText = new Date().toLocaleDateString(
            firstBuyLocale,
            firstBuyDateFormat,
          );
        }
        if (!buyNowOn && compactNextBuy) {
          const dateToken = compactNextBuy.split("·")[0]?.trim() || "";
          const monthDayMatch = dateToken.match(
            /^([A-Za-z]{3,9})\s+(\d{1,2})$/,
          );
          if (monthDayMatch) {
            const monthDay = `${monthDayMatch[1]} ${monthDayMatch[2]}`;
            const now = new Date();
            const guessed = new Date(`${monthDay} ${now.getFullYear()}`);
            if (!Number.isNaN(guessed.getTime())) {
              if (guessed.getTime() < Date.now() - 24 * 60 * 60 * 1000) {
                guessed.setFullYear(guessed.getFullYear() + 1);
              }
              firstBuyText = guessed.toLocaleDateString(
                firstBuyLocale,
                firstBuyDateFormat,
              );
            } else {
              firstBuyText = dateToken || "—";
            }
          } else {
            firstBuyText = dateToken || "—";
          }
        }
        if (firstBuyEl) firstBuyEl.textContent = firstBuyText;

        const balCur = currencyState.plan || "TWD";
        const bal = BALANCES[balCur] ?? BALANCES.TWD;
        if (deductSubEl) {
          const amount = bal.toLocaleString("en-US");
          deductSubEl.textContent = window.I18N?.t
            ? window.I18N.t("Avail. {amount} {currency}", {
                amount,
                currency: balCur,
              })
            : `Avail. ${amount} ${balCur}`;
        }
        if (deductValueEl) deductValueEl.textContent = `${cur} balance`;
      };

      const syncOverviewHeaderCollapse = () => {
        if (!overviewPanel || !overviewHeader || !overviewScroller) return;
        const hero = overviewPanel.querySelector(
          ".plan-overview-panel__gradient-wrap",
        );
        const threshold = Math.max(24, (hero?.offsetHeight || 100) - 20);
        overviewHeader.classList.toggle(
          "is-collapsed",
          overviewScroller.scrollTop >= threshold,
        );
      };

      overviewScroller?.addEventListener("scroll", syncOverviewHeaderCollapse, {
        passive: true,
      });

      const open = (openOpts = {}) => {
        planBreakdownApi.close();
        closeReserveInfo({ instant: true });
        syncFromPlanDetail();
        overviewConsentChecked = false;
        syncOverviewConsentUI();
        if (overviewScroller) overviewScroller.scrollTop = 0;
        overviewHeader?.classList.remove("is-collapsed");
        openedFromBuffer = !!openOpts.fromBuffer;
        panel.classList.add("is-plan-overview-open");
        overviewPanel.hidden = false;
        requestAnimationFrame(() => overviewPanel.classList.add("is-open"));
      };

      const close = (closeOpts = {}) => {
        if (closeOpts.instant) {
          closeReserveInfo({ instant: true });
          overviewHeader?.classList.remove("is-collapsed");
          overviewPanel.style.transition = "none";
          overviewPanel.classList.remove("is-open");
          void overviewPanel.offsetHeight;
          overviewPanel.style.transition = "";
          overviewPanel.hidden = true;
          panel.classList.remove("is-plan-overview-open");
          if (openedFromBuffer) {
            const buf = panel.querySelector("[data-plan-buffer-panel]");
            if (buf) {
              buf.hidden = false;
              buf.classList.add("is-open");
            }
          }
          openedFromBuffer = false;
          return;
        }
        closeReserveInfo({ instant: true });
        overviewHeader?.classList.remove("is-collapsed");
        overviewPanel.classList.remove("is-open");
        const onEnd = () => {
          if (!overviewPanel.classList.contains("is-open")) {
            overviewPanel.hidden = true;
            panel.classList.remove("is-plan-overview-open");
            if (openedFromBuffer) {
              const buf = panel.querySelector("[data-plan-buffer-panel]");
              if (buf) {
                buf.hidden = false;
                buf.classList.add("is-open");
              }
            }
            openedFromBuffer = false;
          }
          overviewPanel.removeEventListener("transitionend", onEnd);
        };
        overviewPanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };

      overviewPanel
        .querySelectorAll("[data-plan-overview-close]")
        .forEach((b) => b.addEventListener("click", close));
      const toggleOverviewConsent = () => {
        overviewConsentChecked = !overviewConsentChecked;
        syncOverviewConsentUI();
      };

      overviewConsentRow?.addEventListener("click", (e) => {
        if (e.target.closest(".plan-overview-panel__consent-link")) return;
        toggleOverviewConsent();
      });

      overviewConsentLink?.addEventListener("click", (e) => {
        e.stopPropagation();
      });
      syncOverviewConsentUI();
      // Reserve option section removed from overview.

      const continueSheet = document.querySelector(
        "[data-plan-detail-continue-sheet]",
      );
      const continueSheetPanel = continueSheet?.querySelector(
        ".currency-sheet__panel",
      );
      const continueSheetNameEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-name]",
      );
      const continueSheetAmountEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-amount]",
      );
      const continueSheetIconWrapEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-icon-wrap]",
      );
      const continueSheetAllocHeadingEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-alloc-heading]",
      );
      const continueSheetChipsEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-chips]",
      );
      const continueSheetRepeatsEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-repeats]",
      );
      const continueSheetRepeatsSubEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-repeats-sub]",
      );
      const continueSheetDurationMainEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-duration-main]",
      );
      const continueSheetDurationSubEl = continueSheet?.querySelector(
        "[data-plan-continue-sheet-duration-sub]",
      );

      const navigateToFundingStep = () => {
        if (ENABLE_PLAN_END_CONDITION_STEP) planEndConditionApi.open();
        else planBufferApi.open({ autofocusInput: true });
      };

      const openContinueSheet = () => {
        if (!continueSheet) return;
        continueSheet.hidden = false;
        requestAnimationFrame(() => continueSheet.classList.add("is-open"));
      };

      const closeContinueSheet = () => {
        if (!continueSheet || !continueSheetPanel) return;
        continueSheet.classList.remove("is-open");
        const onEnd = () => {
          if (!continueSheet.classList.contains("is-open"))
            continueSheet.hidden = true;
          continueSheetPanel.removeEventListener("transitionend", onEnd);
        };
        continueSheetPanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 290);
      };

      const syncContinueSheetChips = () => {
        if (!continueSheetChipsEl) return 0;
        const multiItems = getActiveAllocMultiItems();
        const singleItems = panel.querySelectorAll(
          ".plan-detail-panel__alloc-item",
        );
        continueSheetChipsEl.innerHTML = "";

        const appendChip = (icon, ticker, pctText) => {
          if (!ticker) return;
          const chip = document.createElement("div");
          chip.className = "plan-overview-panel__chip";

          const iconEl = document.createElement("img");
          iconEl.className = "plan-overview-panel__chip-icon";
          iconEl.src = icon || "";
          iconEl.alt = "";

          const meta = document.createElement("div");
          meta.className = "plan-overview-panel__chip-meta";

          const tickerEl = document.createElement("span");
          tickerEl.className = "plan-overview-panel__chip-ticker";
          tickerEl.textContent = ticker;
          meta.appendChild(tickerEl);

          const pctEl = document.createElement("span");
          pctEl.className = "plan-overview-panel__chip-pct";
          pctEl.textContent = pctText;
          meta.appendChild(pctEl);

          chip.appendChild(iconEl);
          chip.appendChild(meta);
          continueSheetChipsEl.appendChild(chip);
        };

        if (multiItems.length) {
          const allocRoot = getActiveAllocMultiRoot();
          const isAmountMode = !!allocRoot?.classList.contains(
            "alloc-multi--amount-mode",
          );
          let pctValues = [];
          if (isAmountMode) {
            const amounts = Array.from(multiItems).map((row) => {
              const pctIn = row.querySelector("[data-alloc-pct-input]");
              const raw = pctIn
                ? String(pctIn.value || "").replace(/[^0-9]/g, "")
                : "";
              return raw ? parseInt(raw, 10) : 0;
            });
            const totalAmt = amounts.reduce(
              (s, n) => s + (isFinite(n) ? n : 0),
              0,
            );
            if (totalAmt > 0) {
              pctValues = amounts.map((n) =>
                Math.max(0, Math.round((n / totalAmt) * 100)),
              );
              const sumPct = pctValues.reduce((s, n) => s + n, 0);
              const adjIdx = pctValues.length - 1;
              if (adjIdx >= 0 && sumPct !== 100)
                pctValues[adjIdx] += 100 - sumPct;
            } else {
              pctValues = amounts.map(() => 0);
            }
          }
          multiItems.forEach((row, idx) => {
            const icon =
              row.querySelector(".alloc-multi__icon")?.getAttribute("src") ||
              "";
            const ticker =
              row.querySelector(".alloc-multi__ticker")?.textContent?.trim() ||
              "";
            const pctIn = row.querySelector("[data-alloc-pct-input]");
            const pctRaw = pctIn
              ? String(pctIn.value || "").replace(/[^0-9]/g, "")
              : "";
            const pctNum = isAmountMode
              ? isFinite(pctValues[idx])
                ? pctValues[idx]
                : 0
              : pctRaw
                ? parseInt(pctRaw, 10)
                : 0;
            const pct = pctNum > 0 ? `${pctNum}%` : "0%";
            appendChip(icon, ticker, pct);
          });
          return continueSheetChipsEl.children.length;
        }

        singleItems.forEach((row) => {
          const icon =
            row
              .querySelector(".plan-detail-panel__alloc-icon")
              ?.getAttribute("src") || "";
          const ticker =
            row
              .querySelector(".plan-detail-panel__alloc-ticker")
              ?.textContent?.trim() || "";
          appendChip(icon, ticker, "100%");
        });
        return continueSheetChipsEl.children.length;
      };

      const syncContinueSheetSummary = () => {
        if (!continueSheet) return;
        const name =
          panel.querySelector("[data-plan-detail-name]")?.textContent?.trim() ||
          "—";
        const amountRaw =
          parseInt(
            String(
              panel.querySelector("[data-plan-detail-amount-input]")?.value ||
                "",
            ).replace(/[^0-9]/g, ""),
            10,
          ) || 0;
        const cur = String(
          panel.querySelector("[data-plan-detail-currency]")?.textContent ||
            currencyState.plan ||
            "TWD",
        ).trim();
        const sched = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        );
        const schedClean = sched
          ? sched.replace(/\s+at\s+~?\d{1,2}:\d{2}\s*$/i, "").trim()
          : "—";
        const schedParts = sched
          .split("·")
          .map((t) => t.trim())
          .filter(Boolean);
        const timingDetail =
          schedParts.length > 1 ? schedParts.slice(1).join(" · ") : "";
        const cadence = sched.toLowerCase().startsWith("daily")
          ? "day"
          : sched.toLowerCase().startsWith("weekly")
            ? "week"
            : "month";

        const allocCount = syncContinueSheetChips();
        const iconSourceWrap = panel.querySelector(
          "[data-plan-detail-icon-wrap]",
        );
        const buyNowEnabled =
          String(panel.dataset.scheduleBuyNow || "0") === "1";
        const overviewFirstBuy =
          panel
            .querySelector("[data-plan-overview-first-buy]")
            ?.textContent?.trim() || "";
        const repeatsSub = buyNowEnabled
          ? "First buy Today"
          : overviewFirstBuy && overviewFirstBuy !== "—"
            ? `First buy ${overviewFirstBuy}`
            : timingDetail
              ? `First buy ${timingDetail}`
              : "";
        const durationMain = "Continuous";
        const durationSub =
          panel
            .querySelector("[data-plan-overview-end-sub]")
            ?.textContent?.trim() || "Pause any time";

        if (continueSheetNameEl) continueSheetNameEl.textContent = name;
        if (continueSheetAmountEl) {
          continueSheetAmountEl.innerHTML =
            amountRaw > 0
              ? `Invest ${amountRaw.toLocaleString("en-US")} ${cur}<br aria-hidden="true" />each ${cadence}`
              : "—";
        }
        if (continueSheetAllocHeadingEl)
          continueSheetAllocHeadingEl.textContent = `Allocation (${allocCount})`;
        if (continueSheetRepeatsEl)
          continueSheetRepeatsEl.textContent = schedClean || "—";
        if (continueSheetRepeatsSubEl) {
          continueSheetRepeatsSubEl.textContent = repeatsSub;
          continueSheetRepeatsSubEl.hidden = !repeatsSub;
        }
        if (continueSheetDurationMainEl)
          continueSheetDurationMainEl.textContent = durationMain;
        if (continueSheetDurationSubEl)
          continueSheetDurationSubEl.textContent = durationSub;
        if (continueSheetIconWrapEl && iconSourceWrap) {
          continueSheetIconWrapEl.innerHTML = iconSourceWrap.innerHTML;
        }
      };

      continueSheet
        ?.querySelectorAll("[data-plan-detail-continue-sheet-close]")
        .forEach((b) => {
          b.addEventListener("click", closeContinueSheet);
        });
      continueSheet
        ?.querySelector("[data-plan-detail-continue-sheet-confirm]")
        ?.addEventListener("click", () => {
          closeContinueSheet();
          window.setTimeout(navigateToFundingStep, 500);
        });

      return { open, close, sync: syncFromPlanDetail };
    };
    planOverviewApi = initPlanOverviewPanel();

    const initPlanBufferPanel = () => {
      const bufferPanel = panel.querySelector("[data-plan-buffer-panel]");
      if (!bufferPanel) return { open: () => {}, close: () => {} };

      const bufferScroller = bufferPanel.querySelector(
        ".plan-buffer-panel__scroller",
      );
      const methodBtns = Array.from(
        bufferPanel.querySelectorAll("[data-plan-buffer-method]"),
      );
      const flexibleDetails = bufferPanel.querySelector(
        '[data-plan-buffer-details="flexible"]',
      );
      const reservedDetails = bufferPanel.querySelector(
        '[data-plan-buffer-details="reserved"]',
      );
      const perBuyEl = bufferPanel.querySelector("[data-plan-buffer-perbuy]");
      const perBuyEl2 = bufferPanel.querySelector(
        "[data-plan-buffer-perbuy-2]",
      );
      const availBalanceEl = bufferPanel.querySelector(
        "[data-plan-buffer-avail-balance]",
      );
      const availBalanceEl2 = bufferPanel.querySelector(
        "[data-plan-buffer-avail-balance-2]",
      );
      const nextBuyEl = bufferPanel.querySelector("[data-plan-buffer-nextbuy]");
      const sourceEl = bufferPanel.querySelector("[data-plan-buffer-source]");
      const sourceEl2 = bufferPanel.querySelector(
        "[data-plan-buffer-source-2]",
      );

      const stepsEl = bufferPanel.querySelector("[data-plan-buffer-steps]");
      const reserveCurEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-cur]",
      );
      const reserveAmtEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-amt]",
      );
      const reserveBalanceErrorEl = bufferPanel.querySelector(
        "[data-plan-buffer-balance-error]",
      );
      const coversNowEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-now]",
      );
      const coversTotalEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-total]",
      );
      const coversSlashEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-slash]",
      );
      const coversAmountRowEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-amount]",
      );
      const coversAmountNowEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-amount-now]",
      );
      const coversAmountTotalEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-amount-total]",
      );
      const coversFillEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-fill]",
      );
      const coversTrackEl = bufferPanel.querySelector(
        ".plan-buffer-panel__reserve-track",
      );
      const reserveTrackNoteEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-track-note]",
      );
      const reserveTrackPerBuyEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-track-perbuy]",
      );
      const recurringPrefundEl = bufferPanel.querySelector(
        "[data-plan-buffer-recurring-prefund]",
      );
      const hideOnReservedRows = Array.from(
        bufferPanel.querySelectorAll("[data-plan-buffer-hide-on-reserved]"),
      );
      const hideOnFlexibleRows = Array.from(
        bufferPanel.querySelectorAll("[data-plan-buffer-hide-on-flexible]"),
      );

      const dec10Btn = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-dec-10]",
      );
      const decBtn = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-dec]",
      );
      const incBtn = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-inc]",
      );
      const inc10Btn = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-inc-10]",
      );

      const ctaBtn = bufferPanel.querySelector("[data-plan-buffer-confirm]");
      const learnMoreTrigger = bufferPanel.querySelector(
        "[data-plan-buffer-learn-more-open]",
      );
      const learnMorePanel = bufferPanel.querySelector(
        "[data-plan-buffer-learn-more-panel]",
      );
      const learnMoreTabButtons = Array.from(
        bufferPanel.querySelectorAll("[data-plan-buffer-learn-more-tab]"),
      );
      const learnMoreViews = Array.from(
        bufferPanel.querySelectorAll("[data-plan-buffer-learn-more-view]"),
      );

      const useMaxBtn = bufferPanel.querySelector("[data-plan-buffer-use-max]");
      const coversPctEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-pct]",
      );
      const coversPctWrapEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-pct-wrap]",
      );
      const coversBarEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-bar]",
      );
      const coversBarDividersEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-bar-dividers]",
      );
      const coversBuyTotalSuffix = bufferPanel.querySelector(
        "[data-plan-buffer-covers-buy-total-suffix]",
      );
      const coversPeriodNowEl = bufferPanel.querySelector(
        "[data-plan-buffer-covers-period-now]",
      );
      const coversPeriodTotalSuffix = bufferPanel.querySelector(
        "[data-plan-buffer-covers-period-total-suffix]",
      );
      const coversAmountTotalSuffix = bufferPanel.querySelector(
        "[data-plan-buffer-covers-amount-total-suffix]",
      );

      const sumPerbuyEl = bufferPanel.querySelector(
        "[data-plan-buffer-sum-perbuy]",
      );
      const sumCoversDateEl = bufferPanel.querySelector(
        "[data-plan-buffer-sum-covers-date]",
      );
      const sumCoversDurationEl = bufferPanel.querySelector(
        "[data-plan-buffer-sum-covers-duration]",
      );
      const sumUnusedEl = bufferPanel.querySelector(
        "[data-plan-buffer-sum-unused]",
      );
      const reserveInputEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-input]",
      );
      const reserveRangeEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-range]",
      );
      const reserveInputIconEl = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-input-icon]",
      );
      const reserveMaxBtn = bufferPanel.querySelector(
        "[data-plan-buffer-reserve-max]",
      );
      const perBuySubtitleEl = bufferPanel.querySelector(
        "[data-plan-buffer-perbuy-sub]",
      );
      const periodHeroTitleEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-hero-title]",
      );
      const periodPerbuyLineEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-perbuy-line]",
      );
      const periodAvailBalanceEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-avail-balance]",
      );
      const periodInputEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-input]",
      );
      const periodRangeEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-range]",
      );
      const periodUnitLabelEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-unit-label]",
      );
      const periodSumPeriodEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-sum-period]",
      );
      const periodSumCoversEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-sum-covers]",
      );
      const periodSumAmountEl = bufferPanel.querySelector(
        "[data-plan-buffer-period-sum-amount]",
      );
      const periodMaxBtn = bufferPanel.querySelector(
        "[data-plan-buffer-period-max]",
      );
      const periodHowItWorksBtn = bufferPanel.querySelector(
        "[data-plan-buffer-period-how-it-works]",
      );
      const planActionEl = bufferPanel.querySelector(
        "[data-plan-buffer-plan-action]",
      );
      const planActionTitleSuffixEl = bufferPanel.querySelector(
        "[data-plan-buffer-plan-action-title-suffix]",
      );
      const planActionBodyEl = bufferPanel.querySelector(
        "[data-plan-buffer-plan-action-body]",
      );
      const autoRefillTextEl = bufferPanel.querySelector(
        "[data-plan-buffer-autorefill-text]",
      );
      const autoRefillOptionBtns = Array.from(
        bufferPanel.querySelectorAll("[data-plan-buffer-autorefill-option]"),
      );
      const roundWrapEl = bufferPanel.querySelector(
        "[data-plan-buffer-rounding]",
      );
      const roundDownBtn = bufferPanel.querySelector(
        "[data-plan-buffer-round-down]",
      );
      const roundUpBtn = bufferPanel.querySelector(
        "[data-plan-buffer-round-up]",
      );

      let method = "flexible"; // 'flexible' | 'reserved'
      let perBuy = 0;
      let cur = currencyState.plan || "USDT";
      let reserveAmount = 0;
      let reserveInputAmount = 0;
      let coversTotalBuys = 40;
      let isSetLimit = false;
      let autoRefillEnabled = true;
      /** Integer count of schedule periods (days/weeks/months) to pre-fund; 0 = empty input. */
      let periodInputCount = 0;

      /** Amount / Period tabs exist on the base buffer panel and on the Funding2 clone (`data-plan-buffer-panel-2`). */
      const applyFundingViewToRoot = (rootEl, nextView) => {
        if (!rootEl) return;
        const view = nextView === "period" ? "period" : "amount";
        rootEl
          .querySelectorAll("[data-plan-buffer-funding-view-tab]")
          .forEach((btn) => {
            const on =
              btn.getAttribute("data-plan-buffer-funding-view-tab") === view;
            btn.classList.toggle("is-selected", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
          });
        rootEl
          .querySelectorAll("[data-plan-buffer-funding-view]")
          .forEach((viewEl) => {
            const show =
              viewEl.getAttribute("data-plan-buffer-funding-view") === view;
            viewEl.hidden = !show;
            viewEl.style.display = show ? "" : "none";
          });
      };

      const setMethodUI = (next) => {
        method = next === "reserved" ? "reserved" : "flexible";
        methodBtns.forEach((btn) => {
          const on = btn.getAttribute("data-plan-buffer-method") === method;
          btn.classList.toggle("is-selected", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
        if (flexibleDetails) {
          const showFlex = method === "flexible";
          flexibleDetails.hidden = !showFlex;
          flexibleDetails.style.display = showFlex ? "" : "none";
        }
        if (reservedDetails) reservedDetails.hidden = method !== "reserved";
        hideOnReservedRows.forEach((row) => {
          const show = method !== "reserved";
          row.hidden = !show;
          row.style.display = show ? "" : "none";
        });
        hideOnFlexibleRows.forEach((row) => {
          const show = method !== "flexible";
          row.hidden = !show;
          row.style.display = show ? "" : "none";
        });
        if (ctaBtn)
          ctaBtn.textContent = method === "reserved" ? "Continue" : "Continue";
      };

      const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString("en-US") : "—");
      const formatWithCommas = (n) => n.toLocaleString("en-US");
      const MAX_RESERVE_INPUT = 99999999;
      const formatBuys = (n) => {
        if (!Number.isFinite(n) || n <= 0) return "0";
        const rounded = Math.round(n * 10) / 10;
        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
      };
      const currencyIconSrc = (code) => {
        const c = String(code || "USDT").toUpperCase();
        const map = {
          USDT: "assets/icon_currency_usdt.svg",
          TWD: "assets/icon_currency_TWD.svg",
          USD: "assets/icon_currency_USD.svg",
          BTC: "assets/icon_currency_btc.svg",
          ETH: "assets/icon_currency_eth.svg",
          XRP: "assets/icon_currency_xrp.svg",
          XAUT: "assets/icon_currency_xaut.svg",
          LINK: "assets/icon_currency_link.svg",
          NEAR: "assets/icon_currency_near.svg",
          MATIC: "assets/icon_currency_matic.svg",
          ONDO: "assets/icon_currency_ondo.svg",
          AAVE: "assets/icon_currency_aave.svg",
          RENDER: "assets/icon_currency_render.svg",
        };
        return map[c] || map.USDT;
      };

      const computeNextBuyDate = () => {
        const schedText = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        );
        // Try to reuse existing compact formatter; then expand to include year.
        const compact = formatFinanceNextBuyCompact(schedText);
        const monthDay = compact.split("·")[0]?.trim();
        if (!monthDay) return "—";
        const t = new Date();
        const guess = new Date(`${monthDay} ${t.getFullYear()}`);
        if (Number.isNaN(guess.getTime())) return monthDay;
        // If the guess is in the past (e.g. Jan 10 when today is Mar), roll to next year.
        if (guess.getTime() < Date.now() - 24 * 60 * 60 * 1000)
          guess.setFullYear(guess.getFullYear() + 1);
        return guess.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };

      const computeCoversUntilDisplay = ({ periods, unit, unitPlural }) => {
        const empty = {
          dateText: "- -",
          durationText: "",
          showDuration: false,
        };
        if (!Number.isFinite(periods) || periods <= 0) return empty;
        const label = periods === 1 ? unit : unitPlural;
        const durationText = `${periods} ${label}`;
        const ordinalDay = (day) => {
          const d = Number(day) || 0;
          const mod100 = d % 100;
          if (mod100 >= 11 && mod100 <= 13) return `${d}th`;
          const mod10 = d % 10;
          if (mod10 === 1) return `${d}st`;
          if (mod10 === 2) return `${d}nd`;
          if (mod10 === 3) return `${d}rd`;
          return `${d}th`;
        };
        const nextBuyDate = computeNextBuyDate();
        const anchor = new Date(nextBuyDate);
        if (Number.isNaN(anchor.getTime())) {
          return { dateText: "—", durationText, showDuration: true };
        }
        if (unit === "day") anchor.setDate(anchor.getDate() + periods);
        else if (unit === "week")
          anchor.setDate(anchor.getDate() + periods * 7);
        else anchor.setMonth(anchor.getMonth() + periods);
        const month = anchor.toLocaleDateString("en-US", { month: "short" });
        const day = ordinalDay(anchor.getDate());
        const year = anchor.getFullYear();
        const dateText = `${month} ${day}, ${year}`;
        return { dateText, durationText, showDuration: true };
      };

      const getReserveBuyBounds = () => {
        // Prototype rule: pre-fund stepper never goes below 1 buy.
        if (!isSetLimit) return { min: 1, max: Number.POSITIVE_INFINITY };
        const maxBuys =
          Number.isFinite(coversTotalBuys) && coversTotalBuys > 0
            ? coversTotalBuys
            : 1;
        return { min: 1, max: maxBuys };
      };

      const clampReserveAmount = (rawAmount) => {
        if (!Number.isFinite(rawAmount)) return 0;
        const n = Math.min(
          MAX_RESERVE_INPUT,
          Math.max(0, Math.floor(rawAmount)),
        );
        if (perBuy <= 0) return n;
        const { max } = getReserveBuyBounds();
        if (Number.isFinite(max) && max > 0) {
          return Math.min(n, max * perBuy);
        }
        return n;
      };

      const getMaxAllowedAmount = () => {
        const balance = BALANCES[cur] ?? BALANCES.TWD;
        const { max: maxBuys } = getReserveBuyBounds();
        const maxByBuys =
          perBuy > 0 && Number.isFinite(maxBuys) && maxBuys > 0
            ? perBuy * maxBuys
            : Number.POSITIVE_INFINITY;
        const hardCap = Math.max(
          0,
          Math.min(balance, maxByBuys, MAX_RESERVE_INPUT),
        );
        if (perBuy <= 0) return Math.floor(hardCap);
        return Math.floor(hardCap / perBuy) * perBuy;
      };

      const getActiveFundingView = () =>
        bufferPanel.querySelector(
          '[data-plan-buffer-funding-view-tab="period"].is-selected',
        )
          ? "period"
          : "amount";

      const getFreqDerived = () => {
        const freqKey = (
          document
            .querySelector("[data-plan-freq-item].is-active")
            ?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        const unit =
          freqKey === "flexible"
            ? "buy"
            : freqKey === "daily"
              ? "day"
              : freqKey === "weekly"
                ? "week"
                : "month";
        const unitPlural = freqKey === "flexible" ? "buys" : `${unit}s`;
        const cadence =
          freqKey === "daily"
            ? "daily"
            : freqKey === "weekly"
              ? "weekly"
              : freqKey === "flexible"
                ? ""
                : "monthly";
        return { freqKey, unit, unitPlural, cadence };
      };

      const getMaxPeriodCount = () => {
        if (perBuy <= 0) return 0;
        const balance = BALANCES[cur] ?? BALANCES.TWD;
        const maxByBalance = Math.floor(balance / perBuy);
        const { max: maxBuys } = getReserveBuyBounds();
        const cap =
          Number.isFinite(maxBuys) && maxBuys > 0
            ? Math.min(maxByBalance, maxBuys)
            : maxByBalance;
        return Math.max(0, cap);
      };

      const clampPeriodCount = (raw) => {
        if (!Number.isFinite(raw) || raw < 0) return 0;
        const maxC = getMaxPeriodCount();
        return Math.min(Math.floor(raw), maxC);
      };

      const render = () => {
        const isPeriodView = getActiveFundingView() === "period";
        const { unit, unitPlural, cadence } = getFreqDerived();

        reserveInputAmount = clampReserveAmount(reserveInputAmount);
        const perBuyStr = perBuy > 0 ? `${fmt(perBuy)} ${cur}` : "—";
        const balance = BALANCES[cur] ?? BALANCES.TWD;
        const staticAmountCap =
          cur === "USDT"
            ? 100000
            : cur === "TWD"
              ? 3000000
              : Math.max(0, Math.floor(balance));
        const reserveLimitAmount =
          isSetLimit && perBuy > 0
            ? perBuy * coversTotalBuys
            : Number.POSITIVE_INFINITY;
        const maxAllowedAmount = Math.floor(
          Math.max(0, Math.min(balance, reserveLimitAmount)),
        );
        const rawAmount = reserveInputAmount;
        const inputDigits = String(reserveInputEl?.value || "").replace(
          /[^0-9]/g,
          "",
        );
        const isEmptyInput = inputDigits.length === 0;
        const isZeroInput = !isEmptyInput && rawAmount === 0;
        const isReservedActive = !!reservedDetails && !reservedDetails.hidden;
        const hasReserveBalanceError = isReservedActive && rawAmount > balance;
        const isOverLimit = isReservedActive && rawAmount > reserveLimitAmount;
        // "Fits 1 or multiple buys" means the amount covers an integer number of buys exactly.
        const isMultiple =
          perBuy > 0 &&
          rawAmount > 0 &&
          Math.floor(rawAmount / perBuy) * perBuy === rawAmount;
        const isValidReservedAmount =
          perBuy > 0 &&
          rawAmount > 0 &&
          isMultiple &&
          !hasReserveBalanceError &&
          !isOverLimit;
        reserveAmount = isValidReservedAmount ? rawAmount : 0;

        const nearestDown =
          perBuy > 0 ? Math.floor(rawAmount / perBuy) * perBuy : 0;
        const nearestUp =
          perBuy > 0 ? Math.ceil(rawAmount / perBuy) * perBuy : 0;
        const coversNow = perBuy > 0 ? Math.floor(rawAmount / perBuy) : 0;
        const unusedRaw = perBuy > 0 ? rawAmount - coversNow * perBuy : 0;

        periodInputCount = clampPeriodCount(periodInputCount);
        const periodRawAmount =
          perBuy > 0 && periodInputCount > 0 ? periodInputCount * perBuy : 0;
        const isEmptyPeriodInput = periodInputCount <= 0;
        const isValidPeriod =
          perBuy > 0 &&
          periodInputCount >= 1 &&
          periodRawAmount <= balance &&
          periodRawAmount <= reserveLimitAmount;

        if (availBalanceEl)
          availBalanceEl.textContent = `${fmt(balance)} ${cur}`;
        if (availBalanceEl2) {
          const amount = fmt(balance);
          availBalanceEl2.textContent = window.I18N?.t
            ? window.I18N.t("Avail. {amount} {currency}", {
                amount,
                currency: cur,
              })
            : `Avail. ${amount} ${cur}`;
        }
        if (perBuyEl) perBuyEl.textContent = perBuyStr;
        if (perBuyEl2) perBuyEl2.textContent = perBuyStr;
        if (recurringPrefundEl)
          recurringPrefundEl.textContent =
            reserveAmount > 0 ? `${fmt(reserveAmount)} ${cur}` : "—";
        if (nextBuyEl) nextBuyEl.textContent = computeNextBuyDate();
        if (sourceEl) sourceEl.textContent = "Wallet";
        if (sourceEl2) sourceEl2.textContent = "Wallet";
        if (reserveCurEl) reserveCurEl.textContent = cur;
        if (reserveAmtEl)
          reserveAmtEl.textContent =
            reserveAmount > 0 ? fmt(reserveAmount) : "- -";
        if (reserveBalanceErrorEl)
          reserveBalanceErrorEl.hidden = !(
            hasReserveBalanceError || isOverLimit
          );
        if (reserveInputEl && document.activeElement !== reserveInputEl) {
          reserveInputEl.value =
            rawAmount > 0
              ? formatWithCommas(rawAmount)
              : isEmptyInput
                ? ""
                : "0";
        }
        if (reserveRangeEl) {
          reserveRangeEl.hidden = rawAmount > 0;
          const maxText = staticAmountCap > 0 ? fmt(staticAmountCap) : "—";
          reserveRangeEl.textContent = `Max ${maxText}${maxText === "—" ? "" : ``}`;
        }
        if (reserveInputIconEl)
          reserveInputIconEl.setAttribute("src", currencyIconSrc(cur));

        if (stepsEl)
          stepsEl.textContent =
            perBuy > 0 ? `${fmt(perBuy)} ${cur} per buy` : "- - per buy";
        if (coversNowEl) coversNowEl.textContent = String(coversNow);
        if (coversTotalEl) {
          coversTotalEl.textContent = String(coversTotalBuys);
          coversTotalEl.hidden = !isSetLimit;
        }
        if (coversSlashEl) coversSlashEl.hidden = !isSetLimit;
        if (coversAmountRowEl) coversAmountRowEl.hidden = !isSetLimit;
        if (coversAmountNowEl)
          coversAmountNowEl.textContent = rawAmount > 0 ? fmt(rawAmount) : "—";
        if (coversAmountTotalEl) {
          const totalAmount =
            isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : null;
          const totalText = totalAmount != null ? fmt(totalAmount) : "—";
          coversAmountTotalEl.textContent = ` / ${totalText} ${cur}`;
        }

        if (coversBarEl) coversBarEl.hidden = !isSetLimit;
        if (coversPctWrapEl) coversPctWrapEl.hidden = !isSetLimit;
        if (isSetLimit) {
          if (coversNowEl)
            coversNowEl.textContent = String(Math.max(0, coversNow));
          if (coversPeriodNowEl)
            coversPeriodNowEl.textContent = String(Math.max(0, coversNow));
          if (coversAmountNowEl)
            coversAmountNowEl.textContent =
              rawAmount > 0 ? fmt(rawAmount) : "—";
        } else {
          if (coversNowEl)
            coversNowEl.textContent = `${String(Math.max(0, coversNow))} buys`;
          if (coversPeriodNowEl)
            coversPeriodNowEl.textContent = `${String(Math.max(0, coversNow))} ${unitPlural}`;
          if (coversAmountNowEl)
            coversAmountNowEl.textContent =
              rawAmount > 0 ? `${fmt(rawAmount)} ${cur}` : "—";
        }
        if (coversBuyTotalSuffix) {
          coversBuyTotalSuffix.textContent = ` / ${String(coversTotalBuys)} buys`;
          coversBuyTotalSuffix.hidden = !isSetLimit;
        }
        if (coversPeriodTotalSuffix) {
          coversPeriodTotalSuffix.textContent = ` / ${String(coversTotalBuys)} ${unitPlural}`;
          coversPeriodTotalSuffix.hidden = !isSetLimit;
        }
        if (coversAmountTotalSuffix) {
          const totalAmount =
            isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : null;
          const totalText =
            totalAmount != null ? `${fmt(totalAmount)} ${cur}` : `— ${cur}`;
          coversAmountTotalSuffix.textContent = ` / ${totalText}`;
          coversAmountTotalSuffix.hidden = !isSetLimit;
        }
        if (coversPctEl) {
          const denom = isSetLimit && perBuy > 0 ? perBuy * coversTotalBuys : 0;
          const pct = denom > 0 ? Math.floor((rawAmount / denom) * 100) : 0;
          coversPctEl.textContent = String(Math.max(0, Math.min(100, pct)));
        }
        if (coversTrackEl) coversTrackEl.hidden = !isSetLimit;
        if (reserveTrackNoteEl) reserveTrackNoteEl.hidden = !isReservedActive;
        if (reserveTrackPerBuyEl)
          reserveTrackPerBuyEl.textContent =
            perBuy > 0 ? `${fmt(perBuy)} ${cur}` : "—";
        if (coversFillEl) {
          const pct =
            isSetLimit && coversTotalBuys > 0
              ? (coversNow / coversTotalBuys) * 100
              : 0;
          coversFillEl.style.width = `${Math.max(0, Math.min(100, pct))}%`;
        }
        if (coversBarDividersEl) {
          coversBarDividersEl.innerHTML = "";
          const stepBuys = isSetLimit ? Math.max(0, Math.floor(coversNow)) : 0;
          const totalBuys = isSetLimit
            ? Math.max(0, Math.floor(coversTotalBuys))
            : 0;
          const maxTicks = 18;
          if (stepBuys > 0 && totalBuys > 0 && stepBuys < totalBuys) {
            const tickCount = Math.floor((totalBuys - 1) / stepBuys);
            if (tickCount > 0 && tickCount <= maxTicks) {
              for (let k = 1; k <= tickCount; k += 1) {
                const buysAtTick = k * stepBuys;
                if (buysAtTick >= totalBuys) break;
                const leftPct = (buysAtTick / totalBuys) * 100;
                const tick = document.createElement("span");
                tick.className = "plan-buffer-panel__covers-bar-divider";
                tick.style.left = `${leftPct}%`;
                coversBarDividersEl.appendChild(tick);
              }
            }
          }
        }

        const coversNowForButtons =
          perBuy > 0 ? Math.floor(rawAmount / perBuy) : 0;
        const { min: minBuys, max: maxBuys } = getReserveBuyBounds();
        if (dec10Btn) dec10Btn.disabled = coversNowForButtons <= minBuys;
        if (decBtn) decBtn.disabled = coversNowForButtons <= minBuys;
        if (incBtn) incBtn.disabled = coversNowForButtons >= maxBuys;
        if (inc10Btn) inc10Btn.disabled = coversNowForButtons >= maxBuys;

        if (perBuySubtitleEl) {
          perBuySubtitleEl.textContent =
            perBuy > 0 ? `Per buy : ${fmt(perBuy)} ${cur}` : "Per buy : —";
        }
        if (sumPerbuyEl) {
          if (perBuy > 0 && rawAmount > 0) {
            const buysCovered = rawAmount / perBuy;
            const buyLabel = buysCovered === 1 ? "buy" : "buys";
            sumPerbuyEl.textContent = `${formatBuys(buysCovered)} ${buyLabel}`;
          } else {
            sumPerbuyEl.textContent = "- -";
          }
          sumPerbuyEl.classList.toggle(
            "plan-buffer-funding-summary__value--warning",
            rawAmount > 0 && unusedRaw > 0,
          );
          sumPerbuyEl.classList.toggle(
            "plan-buffer-funding-summary__value--highlight",
            rawAmount > 0 && unusedRaw === 0,
          );
        }
        if (sumCoversDateEl && sumCoversDurationEl) {
          const periods =
            perBuy > 0 && rawAmount > 0
              ? Math.max(1, Math.floor(rawAmount / perBuy))
              : 0;
          const { dateText, durationText, showDuration } =
            computeCoversUntilDisplay({
              periods,
              unit,
              unitPlural,
            });
          sumCoversDateEl.textContent = dateText;
          if (showDuration && durationText) {
            sumCoversDurationEl.textContent = durationText;
            sumCoversDurationEl.hidden = false;
            sumCoversDurationEl.setAttribute("aria-hidden", "false");
          } else {
            sumCoversDurationEl.textContent = "";
            sumCoversDurationEl.hidden = true;
            sumCoversDurationEl.setAttribute("aria-hidden", "true");
          }
        }
        if (sumUnusedEl) {
          const shouldHideUnused =
            perBuy > 0 &&
            rawAmount > 0 &&
            (rawAmount < perBuy || unusedRaw === 0);
          const unusedText =
            perBuy > 0 && rawAmount > 0 && !shouldHideUnused
              ? `${fmt(Math.max(0, unusedRaw))} ${cur}`
              : "- -";
          sumUnusedEl.textContent = unusedText;
          sumUnusedEl.classList.toggle(
            "plan-buffer-funding-summary__value--negative",
            rawAmount > 0 && unusedRaw > 0 && !shouldHideUnused,
          );
          sumUnusedEl.classList.toggle(
            "plan-buffer-funding-summary__value--positive",
            rawAmount > 0 && unusedRaw === 0 && !shouldHideUnused,
          );
        }

        // If the amount already covers an integer number of buys, unused remainder is 0.
        // In that case we hide the rounding UI.
        const showRounding = perBuy > 0 && rawAmount > 0 && unusedRaw !== 0;
        if (roundWrapEl) roundWrapEl.hidden = !showRounding;
        if (roundDownBtn) {
          const roundDownMain = roundDownBtn.querySelector(
            ".plan-buffer-funding-round__btn-main",
          );
          const roundDownSub = roundDownBtn.querySelector(
            ".plan-buffer-funding-round__btn-sub",
          );
          const hasRoundDownValue = nearestDown > 0;
          const downBuys = perBuy > 0 ? Math.floor(nearestDown / perBuy) : 0;
          const isSubOneBuyRemainder =
            perBuy > 0 && rawAmount > 0 && rawAmount < perBuy;
          roundDownBtn.classList.toggle(
            "plan-buffer-funding-round__btn--secondary-paygo",
            isSubOneBuyRemainder,
          );
          if (isSubOneBuyRemainder) {
            if (roundDownMain) roundDownMain.textContent = `0 ${cur}`;
            if (roundDownSub) roundDownSub.textContent = "Pay as you go";
            roundDownBtn.disabled = false;
            roundDownBtn.hidden = false;
          } else {
            if (roundDownMain)
              roundDownMain.textContent = hasRoundDownValue
                ? `${formatWithCommas(nearestDown)} ${cur}`
                : "—";
            if (roundDownSub)
              roundDownSub.textContent = hasRoundDownValue
                ? `${downBuys} ${downBuys === 1 ? "buy" : "buys"}`
                : "—";
            roundDownBtn.disabled = !hasRoundDownValue;
            roundDownBtn.hidden = !hasRoundDownValue;
          }
        }
        if (roundUpBtn) {
          const roundUpMain = roundUpBtn.querySelector(
            ".plan-buffer-funding-round__btn-main",
          );
          const roundUpSub = roundUpBtn.querySelector(
            ".plan-buffer-funding-round__btn-sub",
          );
          const upBuys = perBuy > 0 ? Math.floor(nearestUp / perBuy) : 0;
          if (roundUpMain)
            roundUpMain.textContent =
              nearestUp > 0 ? `${formatWithCommas(nearestUp)} ${cur}` : "—";
          if (roundUpSub)
            roundUpSub.textContent =
              nearestUp > 0
                ? `${upBuys} ${upBuys === 1 ? "buy" : "buys"}`
                : "—";
          roundUpBtn.disabled = !(
            nearestUp > 0 && nearestUp <= maxAllowedAmount
          );
        }
        if (reserveMaxBtn) reserveMaxBtn.disabled = !(maxAllowedAmount > 0);

        if (periodAvailBalanceEl) {
          const amount = fmt(balance);
          periodAvailBalanceEl.textContent = window.I18N?.t
            ? window.I18N.t("Avail. {amount} {currency}", {
                amount,
                currency: cur,
              })
            : `Avail. ${amount} ${cur}`;
        }
        if (periodUnitLabelEl) periodUnitLabelEl.textContent = unitPlural;
        if (periodHeroTitleEl) {
          periodHeroTitleEl.textContent = `How many ${unitPlural} would you like to pre-fund in advance?`;
        }
        if (periodPerbuyLineEl) {
          if (perBuy > 0) {
            periodPerbuyLineEl.innerHTML = `<span class="plan-buffer-funding-hero__subtitle-prefix">${formatEachBuyPrefix(cadence)}</span><span class="plan-buffer-funding-hero__subtitle-amount">${fmt(perBuy)} ${cur}</span>`;
          } else {
            periodPerbuyLineEl.innerHTML = `<span class="plan-buffer-funding-hero__subtitle-prefix">${formatEachBuyPrefix(cadence)}</span><span class="plan-buffer-funding-hero__subtitle-amount">—</span>`;
          }
        }
        if (periodInputEl && document.activeElement !== periodInputEl) {
          periodInputEl.value =
            periodInputCount > 0 ? formatWithCommas(periodInputCount) : "";
        }
        if (periodRangeEl) {
          const maxPeriodCount =
            perBuy > 0 ? Math.floor(staticAmountCap / perBuy) : 0;
          periodRangeEl.hidden = periodInputCount > 0;
          periodRangeEl.textContent = `Max ${maxPeriodCount > 0 ? formatWithCommas(maxPeriodCount) : "—"}`;
        }
        if (periodSumPeriodEl) {
          if (periodInputCount > 0) {
            const label = periodInputCount === 1 ? unit : unitPlural;
            periodSumPeriodEl.textContent = `${periodInputCount} ${label}`;
          } else {
            periodSumPeriodEl.textContent = "—";
          }
        }
        if (periodSumCoversEl) {
          if (periodInputCount > 0 && perBuy > 0) {
            const { dateText } = computeCoversUntilDisplay({
              periods: periodInputCount,
              unit,
              unitPlural,
            });
            periodSumCoversEl.textContent = dateText;
          } else {
            periodSumCoversEl.textContent = "—";
          }
        }
        if (periodSumAmountEl) {
          periodSumAmountEl.textContent = isValidPeriod
            ? `${fmt(periodRawAmount)} ${cur}`
            : "—";
        }
        if (periodMaxBtn) periodMaxBtn.disabled = !(getMaxPeriodCount() > 0);

        const showZeroAction = isPeriodView ? isEmptyPeriodInput : isZeroInput;
        const showValidAction = isPeriodView
          ? isValidPeriod
          : isValidReservedAmount;
        const actionAmount = isPeriodView ? periodRawAmount : rawAmount;
        planBufferOverviewState = {
          mode: showValidAction ? "reserved" : "flexible",
          rawAmount: actionAmount,
          reservedAmount: isPeriodView
            ? isValidPeriod
              ? periodRawAmount
              : 0
            : reserveAmount,
          autoRefillEnabled,
          currency: cur,
          perBuy,
        };
        if (planActionEl) {
          if (showZeroAction) {
            if (planActionTitleSuffixEl)
              planActionTitleSuffixEl.textContent = "Pay as you go";
            if (planActionBodyEl) {
              planActionBodyEl.textContent =
                "No funds are set aside: Your plan is paid from your balance at time of each buy. May fail if balance is low.";
            }
          } else if (showValidAction) {
            if (planActionTitleSuffixEl)
              planActionTitleSuffixEl.textContent = "Set aside funds";
            if (planActionBodyEl) {
              planActionBodyEl.textContent = `${fmt(actionAmount)} ${cur} will be set aside now and reserved for upcoming buys.`;
            }
          } else {
            if (planActionTitleSuffixEl)
              planActionTitleSuffixEl.textContent = "";
            if (planActionBodyEl) planActionBodyEl.textContent = "";
          }
          planActionEl.hidden = !(showZeroAction || showValidAction);
        }

        if (autoRefillTextEl) {
          autoRefillTextEl.textContent = showValidAction
            ? `We\u2019ll reserve ${fmt(actionAmount)} ${cur} again after funds runs out.`
            : "\u2014";
        }
        autoRefillOptionBtns.forEach((btn) => {
          const key =
            btn.getAttribute("data-plan-buffer-autorefill-option") || "auto";
          const selected = autoRefillEnabled
            ? key === "auto"
            : key === "balance";
          btn.classList.toggle("is-selected", selected);
          btn.setAttribute("aria-checked", selected ? "true" : "false");
        });

        bufferPanel.classList.toggle(
          "plan-buffer-panel--state-empty",
          isPeriodView ? isEmptyPeriodInput : isEmptyInput,
        );
        bufferPanel.classList.toggle(
          "plan-buffer-panel--state-zero",
          isPeriodView ? false : isZeroInput,
        );
        bufferPanel.classList.toggle(
          "plan-buffer-panel--has-positive",
          isPeriodView ? periodInputCount > 0 : rawAmount > 0,
        );
        bufferPanel.classList.toggle(
          "plan-buffer-panel--period-has-count",
          isPeriodView && periodInputCount >= 1,
        );
        bufferPanel.classList.toggle(
          "plan-buffer-panel--state-invalid",
          isPeriodView
            ? periodInputCount > 0 && !isValidPeriod
            : rawAmount > 0 && !isMultiple,
        );
        bufferPanel.classList.toggle(
          "plan-buffer-panel--state-valid",
          showValidAction,
        );

        const shouldDisableContinue = isPeriodView
          ? isEmptyPeriodInput || !isValidPeriod
          : isEmptyInput || (rawAmount > 0 && !isValidReservedAmount);
        if (ctaBtn) ctaBtn.disabled = shouldDisableContinue;
      };

      const syncFromPlanDetail = () => {
        const amountInput = panel.querySelector(
          "[data-plan-detail-amount-input]",
        );
        cur =
          currencyState.plan ||
          String(
            panel.querySelector("[data-plan-detail-currency]")?.textContent ||
              "USDT",
          ).trim();
        perBuy =
          parseInt(
            String(amountInput?.value || "").replace(/[^0-9]/g, ""),
            10,
          ) || 0;

        // Use plan limit buys if available; else keep the Figma example default.
        const endEl = panel.querySelector("[data-plan-detail-repeats-end]");
        const endRaw = String(
          endEl?.dataset?.endConditionText || endEl?.textContent || "",
        ).trim();
        isSetLimit = isPlanDetailSetLimitEnd(endRaw);
        bufferPanel.classList.toggle(
          "plan-buffer-panel--continuous",
          !isSetLimit,
        );
        const m = endRaw.match(/^(\d+)\s+buys?\b/i);
        const n = m ? parseInt(m[1], 10) : NaN;
        coversTotalBuys = Number.isFinite(n) && n > 0 ? n : 40;

        // Funding (Set aside) starts empty until user enters a valid amount.
        reserveInputAmount = 0;
        reserveAmount = 0;
        periodInputCount = 0;
        autoRefillEnabled = true;
        if (reserveInputEl) reserveInputEl.value = "0";
        if (periodInputEl) periodInputEl.value = "";

        setMethodUI("reserved");
        render();
      };

      const bumpReserve = (deltaBuys) => {
        if (perBuy <= 0) return;
        reserveInputAmount = clampReserveAmount(
          reserveInputAmount + deltaBuys * perBuy,
        );
        render();
      };

      const open = (openOpts = {}) => {
        const shouldAutofocusInput = !!openOpts.autofocusInput;
        planBreakdownApi.close();
        planOverviewApi.close({ instant: true });
        planSuccessApi.forceClose();
        if (learnMorePanel) {
          learnMorePanel.classList.remove("is-open");
          learnMorePanel.hidden = true;
        }

        syncFromPlanDetail();
        applyFundingViewToRoot(bufferPanel, "amount");

        if (bufferScroller) bufferScroller.scrollTop = 0;
        bufferPanel.hidden = false;
        requestAnimationFrame(() => bufferPanel.classList.add("is-open"));
        if (shouldAutofocusInput) {
          // Focus only after panel transition finishes to avoid viewport jump
          // interrupting stacked panel animations.
          let focused = false;
          const focusInput = () => {
            if (focused || !reserveInputEl) return;
            if (
              bufferPanel.hidden ||
              !bufferPanel.classList.contains("is-open")
            )
              return;
            focused = true;
            try {
              reserveInputEl.focus({ preventScroll: true });
            } catch (_) {
              reserveInputEl.focus();
            }
            const len = (reserveInputEl.value || "").length;
            try {
              reserveInputEl.setSelectionRange(len, len);
            } catch (_) {}
          };
          const onEnd = () => {
            bufferPanel.removeEventListener("transitionend", onEnd);
            focusInput();
          };
          bufferPanel.addEventListener("transitionend", onEnd);
          // Fallback in case transitionend is skipped.
          setTimeout(() => {
            bufferPanel.removeEventListener("transitionend", onEnd);
            focusInput();
          }, 420);
        }
      };

      const close = (opts = {}) => {
        if (learnMorePanel) {
          learnMorePanel.classList.remove("is-open");
          learnMorePanel.hidden = true;
        }
        if (opts.instant) {
          // Leaving buffer should always leave the stack clean.
          planOverviewApi.close({ instant: true });
          bufferPanel.classList.remove("is-open");
          bufferPanel.hidden = true;
          return;
        }
        // If overview is open above us, close it first.
        planOverviewApi.close({ instant: true });
        bufferPanel.classList.remove("is-open");
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          bufferPanel.removeEventListener("transitionend", onEnd);
          if (!bufferPanel.classList.contains("is-open"))
            bufferPanel.hidden = true;
        };
        bufferPanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };

      const closeBuffer = () => close();
      bufferPanel
        .querySelector("[data-plan-buffer-back]")
        ?.addEventListener("click", closeBuffer);
      bufferPanel
        .querySelector("[data-plan-buffer-back-bottom]")
        ?.addEventListener("click", closeBuffer);

      methodBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const v = btn.getAttribute("data-plan-buffer-method") || "flexible";
          setMethodUI(v);
          render();
        });
      });
      const onFundingViewTabClick = (e) => {
        const tab = e.target.closest("[data-plan-buffer-funding-view-tab]");
        if (!tab || !container?.contains(tab)) return;
        const root = tab.closest(
          "[data-plan-buffer-panel], [data-plan-buffer-panel-2]",
        );
        if (!root || root.hidden) return;
        e.preventDefault();
        const nextView =
          tab.getAttribute("data-plan-buffer-funding-view-tab") || "amount";
        applyFundingViewToRoot(root, nextView);
        render();
        if (typeof root._funding2Sync === "function") root._funding2Sync();
      };
      container?.addEventListener("click", onFundingViewTabClick);
      applyFundingViewToRoot(bufferPanel, "amount");

      const applyReserveInputLiveFormat = () => {
        if (!reserveInputEl) return;
        const cursor = reserveInputEl.selectionStart || 0;
        const oldVal = reserveInputEl.value || "";
        const digitsBeforeCursor = oldVal
          .slice(0, cursor)
          .replace(/[^0-9]/g, "").length;
        const raw = oldVal.replace(/[^0-9]/g, "");
        if (!raw) {
          reserveInputEl.value = "";
          reserveInputAmount = 0;
          return;
        }
        const clamped = Math.min(parseInt(raw, 10), MAX_RESERVE_INPUT);
        reserveInputAmount = Number.isFinite(clamped) ? clamped : 0;
        const formatted = formatWithCommas(reserveInputAmount);
        reserveInputEl.value = formatted;

        let newCursor = 0;
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i += 1) {
          if (digitsSeen === digitsBeforeCursor) {
            newCursor = i;
            break;
          }
          if (formatted[i] !== ",") digitsSeen += 1;
          newCursor = i + 1;
        }
        reserveInputEl.setSelectionRange(newCursor, newCursor);
      };

      reserveInputEl?.addEventListener("input", () => {
        applyReserveInputLiveFormat();
        render();
      });

      reserveInputEl?.addEventListener("blur", () => {
        const digits = String(reserveInputEl.value || "").replace(
          /[^0-9]/g,
          "",
        );
        const raw = parseInt(digits, 10);
        reserveInputAmount = Number.isFinite(raw) ? Math.max(0, raw) : 0;
        if (reserveInputEl) {
          reserveInputEl.value = digits
            ? formatWithCommas(reserveInputAmount)
            : "";
        }
        render();
      });

      reserveMaxBtn?.addEventListener("click", () => {
        const maxAllowed = getMaxAllowedAmount();
        if (perBuy > 0) {
          reserveInputAmount = Math.floor(maxAllowed / perBuy) * perBuy;
        } else {
          reserveInputAmount = maxAllowed;
        }
        render();
      });

      const applyPeriodInputLiveFormat = () => {
        if (!periodInputEl) return;
        const cursor = periodInputEl.selectionStart || 0;
        const oldVal = periodInputEl.value || "";
        const digitsBeforeCursor = oldVal
          .slice(0, cursor)
          .replace(/[^0-9]/g, "").length;
        const raw = oldVal.replace(/[^0-9]/g, "");
        if (!raw) {
          periodInputEl.value = "";
          periodInputCount = 0;
          return;
        }
        const maxPeriod = getMaxPeriodCount();
        let n = Math.min(parseInt(raw, 10), MAX_RESERVE_INPUT);
        if (Number.isFinite(n) && maxPeriod >= 0) n = Math.min(n, maxPeriod);
        if (!Number.isFinite(n) || n <= 0) {
          periodInputEl.value = "";
          periodInputCount = 0;
          return;
        }
        periodInputCount = n;
        const formatted = formatWithCommas(periodInputCount);
        periodInputEl.value = formatted;
        let newCursor = 0;
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i += 1) {
          if (digitsSeen === digitsBeforeCursor) {
            newCursor = i;
            break;
          }
          if (formatted[i] !== ",") digitsSeen += 1;
          newCursor = i + 1;
        }
        periodInputEl.setSelectionRange(newCursor, newCursor);
      };

      periodInputEl?.addEventListener("input", () => {
        applyPeriodInputLiveFormat();
        render();
      });

      periodInputEl?.addEventListener("blur", () => {
        const digits = String(periodInputEl.value || "").replace(/[^0-9]/g, "");
        const raw = parseInt(digits, 10);
        const maxPeriod = getMaxPeriodCount();
        let n = Number.isFinite(raw) ? Math.max(0, raw) : 0;
        if (maxPeriod >= 0) n = Math.min(n, maxPeriod);
        periodInputCount = n;
        if (periodInputEl) {
          periodInputEl.value =
            periodInputCount > 0 ? formatWithCommas(periodInputCount) : "";
        }
        render();
      });

      periodMaxBtn?.addEventListener("click", () => {
        periodInputCount = getMaxPeriodCount();
        render();
      });

      roundDownBtn?.addEventListener("click", () => {
        if (perBuy <= 0) return;
        reserveInputAmount = Math.floor(reserveInputAmount / perBuy) * perBuy;
        render();
      });

      roundUpBtn?.addEventListener("click", () => {
        if (perBuy <= 0) return;
        const next = Math.ceil(reserveInputAmount / perBuy) * perBuy;
        reserveInputAmount = Math.min(next, getMaxAllowedAmount());
        render();
      });

      incBtn?.addEventListener("click", () => bumpReserve(1));
      inc10Btn?.addEventListener("click", () => bumpReserve(10));
      decBtn?.addEventListener("click", () => bumpReserve(-1));
      dec10Btn?.addEventListener("click", () => bumpReserve(-10));

      // "Use Max": take the max whole-buy amount from available balance.
      useMaxBtn?.addEventListener("click", () => {
        if (perBuy <= 0) return;
        const maxAllowed = getMaxAllowedAmount();
        reserveInputAmount = Math.floor(maxAllowed / perBuy) * perBuy;
        render();
      });

      autoRefillOptionBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          const key =
            btn.getAttribute("data-plan-buffer-autorefill-option") || "auto";
          autoRefillEnabled = key !== "balance";
          render();
        });
      });

      bufferPanel
        .querySelector("[data-plan-buffer-confirm]")
        ?.addEventListener("click", () => {
          // Keep buffer open underneath overview so "Back" returns to buffer.
          planOverviewApi.open({ fromBuffer: true });
        });

      const openLearnMore = () => {
        if (!learnMorePanel) return;
        const setLearnMoreTab = (tabKey) => {
          const activeTab = tabKey === "reserved" ? "reserved" : "flexible";
          learnMoreTabButtons.forEach((btn) => {
            const on =
              (btn.getAttribute("data-plan-buffer-learn-more-tab") ||
                "flexible") === activeTab;
            btn.classList.toggle("is-active", on);
            btn.setAttribute("aria-selected", on ? "true" : "false");
          });
          learnMoreViews.forEach((view) => {
            const on =
              (view.getAttribute("data-plan-buffer-learn-more-view") ||
                "flexible") === activeTab;
            view.hidden = !on;
          });
        };
        setLearnMoreTab(method);
        learnMorePanel.hidden = false;
        requestAnimationFrame(() => learnMorePanel.classList.add("is-open"));
      };

      const closeLearnMore = (opts = {}) => {
        if (!learnMorePanel) return;
        if (opts.instant) {
          learnMorePanel.classList.remove("is-open");
          learnMorePanel.hidden = true;
          return;
        }
        learnMorePanel.classList.remove("is-open");
        const onEnd = () => {
          if (!learnMorePanel.classList.contains("is-open"))
            learnMorePanel.hidden = true;
          learnMorePanel.removeEventListener("transitionend", onEnd);
        };
        learnMorePanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };

      learnMoreTrigger?.addEventListener("click", openLearnMore);
      periodHowItWorksBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        openLearnMore();
      });
      learnMoreTabButtons.forEach((btn) => {
        btn.addEventListener("click", () => {
          const key =
            btn.getAttribute("data-plan-buffer-learn-more-tab") || "flexible";
          const activeTab = key === "reserved" ? "reserved" : "flexible";
          learnMoreTabButtons.forEach((item) => {
            const on =
              (item.getAttribute("data-plan-buffer-learn-more-tab") ||
                "flexible") === activeTab;
            item.classList.toggle("is-active", on);
            item.setAttribute("aria-selected", on ? "true" : "false");
          });
          learnMoreViews.forEach((view) => {
            const on =
              (view.getAttribute("data-plan-buffer-learn-more-view") ||
                "flexible") === activeTab;
            view.hidden = !on;
          });
        });
      });
      learnMorePanel
        ?.querySelectorAll("[data-plan-buffer-learn-more-close]")
        .forEach((btn) =>
          btn.addEventListener("click", () => closeLearnMore()),
        );

      return { open, close, sync: syncFromPlanDetail, applyFundingViewToRoot };
    };

    planBufferApi = initPlanBufferPanel();

    const initPlanEndConditionPanel = () => {
      const endPanel = panel.querySelector("[data-plan-end-condition-panel]");
      if (!endPanel) return { open: () => {}, close: () => {} };

      const ecScroller = endPanel.querySelector(".plan-buffer-panel__scroller");
      const ecMethodBtns = Array.from(
        endPanel.querySelectorAll("[data-plan-end-condition]"),
      );
      /** @type {'continuous' | 'limit'} */
      let ecSelection = "continuous";

      const syncFromPlanDetail = () => {
        const endEl = panel.querySelector("[data-plan-detail-repeats-end]");
        const endRaw = String(
          endEl?.dataset?.endConditionText || endEl?.textContent || "",
        ).trim();
        const useContinuous =
          !endRaw || /\bcontinuous\b|\bContinuous\b/i.test(endRaw);
        ecSelection = useContinuous ? "continuous" : "limit";
        ecMethodBtns.forEach((btn) => {
          const v =
            btn.getAttribute("data-plan-end-condition") === "limit"
              ? "limit"
              : "continuous";
          const on = v === ecSelection;
          btn.classList.toggle("is-selected", on);
          btn.setAttribute("aria-pressed", on ? "true" : "false");
        });
      };

      const applySelectionToPlanDetail = () => {
        const endEl = panel.querySelector("[data-plan-detail-repeats-end]");
        if (!endEl) return;
        const setEndConditionText = (nextText) => {
          const next = String(nextText || "").trim();
          endEl.dataset.endConditionText = next;
          endEl.textContent = next;
        };
        if (ecSelection === "continuous") {
          setEndConditionText("Continuous");
          scheduleSheetApi.planDetailRepeatsEndLimitText = "";
        } else {
          const cur = String(
            endEl.dataset.endConditionText || endEl.textContent || "",
          ).trim();
          if (
            /\bcontinuous\b|\bContinuous\b/i.test(cur) ||
            !cur ||
            !isPlanDetailSetLimitEnd(cur)
          ) {
            setEndConditionText("40 buys ~ Ends Dec 31, 2026");
            scheduleSheetApi.planDetailRepeatsEndLimitText = String(
              endEl.dataset.endConditionText || endEl.textContent || "",
            ).trim();
          }
        }
        syncPlanDetailSetLimitDetailRowsVisibility();
        updateCoverageUI();
      };

      const open = () => {
        planBreakdownApi.close();
        planOverviewApi.close({ instant: true });
        planSuccessApi.forceClose();
        syncFromPlanDetail();
        if (ecScroller) ecScroller.scrollTop = 0;
        endPanel.hidden = false;
        requestAnimationFrame(() => endPanel.classList.add("is-open"));
      };

      const close = (opts = {}) => {
        if (opts.instant) {
          endPanel.classList.remove("is-open");
          endPanel.hidden = true;
          return;
        }
        endPanel.classList.remove("is-open");
        let done = false;
        const onEnd = () => {
          if (done) return;
          done = true;
          endPanel.removeEventListener("transitionend", onEnd);
          if (!endPanel.classList.contains("is-open")) endPanel.hidden = true;
        };
        endPanel.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };

      endPanel
        .querySelector("[data-plan-end-condition-back]")
        ?.addEventListener("click", () => close());

      ecMethodBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          ecSelection =
            btn.getAttribute("data-plan-end-condition") === "limit"
              ? "limit"
              : "continuous";
          ecMethodBtns.forEach((b) => {
            const v =
              b.getAttribute("data-plan-end-condition") === "limit"
                ? "limit"
                : "continuous";
            const on = v === ecSelection;
            b.classList.toggle("is-selected", on);
            b.setAttribute("aria-pressed", on ? "true" : "false");
          });
        });
      });

      endPanel
        .querySelector("[data-plan-end-condition-continue]")
        ?.addEventListener("click", () => {
          applySelectionToPlanDetail();
          planBufferApi.open({ autofocusInput: true });
        });

      return { open, close, sync: syncFromPlanDetail };
    };

    planEndConditionApi = initPlanEndConditionPanel();

    const applyRecreatePlanPrefill = (rec) => {
      if (!rec || !panel) return;

      const toTickerIcon = (ticker) => {
        const t = String(ticker || "")
          .trim()
          .toUpperCase();
        if (t === "BTC") return "assets/icon_currency_btc.svg";
        if (t === "ETH") return "assets/icon_currency_eth.svg";
        if (t === "SOL" || t === "SOLANA") return "assets/icon_solana.svg";
        if (t === "USDT") return "assets/icon_currency_usdt.svg";
        if (t === "XAUT") return "assets/icon_currency_xaut.svg";
        if (t === "RENDER") return "assets/icon_currency_render.svg";
        if (t === "NEAR") return "assets/icon_currency_near.svg";
        if (t === "LINK") return "assets/icon_currency_link.svg";
        if (t === "XRP") return "assets/icon_currency_xrp.svg";
        return "";
      };

      const mixRaw = Array.isArray(rec.assetMix) ? rec.assetMix : [];
      let mix = mixRaw
        .map((m) => ({
          ticker: String(m?.ticker || "")
            .trim()
            .toUpperCase(),
          pct: Number.isFinite(Number(m?.pct))
            ? Math.max(0, Math.round(Number(m.pct)))
            : 0,
        }))
        .filter((m) => m.ticker)
        .slice(0, 3);

      if (!mix.length) {
        const tickers = String(rec.tickers || "")
          .split(/[·,]/g)
          .map((t) =>
            String(t || "")
              .trim()
              .toUpperCase(),
          )
          .filter(Boolean)
          .slice(0, 3);
        if (tickers.length === 1) {
          mix = [{ ticker: tickers[0], pct: 100 }];
        } else if (tickers.length > 1) {
          const base = Math.floor(100 / tickers.length);
          let rem = 100 - base * tickers.length;
          mix = tickers.map((ticker) => {
            const pct = base + (rem > 0 ? 1 : 0);
            if (rem > 0) rem -= 1;
            return { ticker, pct };
          });
        }
      }

      if (mix.length) {
        const items = mix.map((m) => {
          const explicit = Array.isArray(rec.assetIcons)
            ? rec.assetIcons.find(
                (a) =>
                  String(a?.ticker || "")
                    .trim()
                    .toUpperCase() === m.ticker,
              )
            : null;
          const icon =
            String(explicit?.icon || "").trim() ||
            toTickerIcon(m.ticker) ||
            String(rec.iconSrc || "").trim() ||
            "assets/icon_currency_btc.svg";
          return { name: m.ticker, ticker: m.ticker, icon };
        });
        detailAllocOverride = { kind: "coins", items };
      }

      customPlanTitle = String(rec.kicker || rec.name || "").trim();
      populatePanel({ preserveAmount: true });

      const amountInput = panel.querySelector(
        "[data-plan-detail-amount-input]",
      );
      const amountMatch = String(rec.investLine || "").match(
        /(-?\d[\d,]*(?:\.\d+)?)\s*[A-Za-z]{3,5}\s+each\b/i,
      );
      if (amountInput && amountMatch) {
        const amountNum = parseFloat(
          String(amountMatch[1] || "").replace(/,/g, ""),
        );
        if (Number.isFinite(amountNum) && amountNum > 0) {
          amountInput.value = Math.round(amountNum).toLocaleString("en-US");
          amountInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      const repeatsText = String(rec.repeats || "").trim();
      const lowerRepeats = repeatsText.toLowerCase();
      const freq = lowerRepeats.startsWith("daily")
        ? "daily"
        : lowerRepeats.startsWith("weekly")
          ? "weekly"
          : lowerRepeats.startsWith("flexible")
            ? "flexible"
            : "monthly";
      const freqBtn = panel.querySelector(`[data-plan-freq-item="${freq}"]`);
      freqBtn?.click();

      const scheduleEl = panel.querySelector("[data-plan-detail-schedule]");
      if (scheduleEl && repeatsText)
        setPlanDetailScheduleElement(scheduleEl, repeatsText);
    };

    // ── Open / close ──────────────────────────────────────────────────────────
    const setOpen = (nextOpen, openCtx = null) => {
      if (nextOpen) {
        // Entering plan detail from Finance → Auto-invest should always start
        // from the original plan name (discard any previously edited title).
        customPlanTitle = "";
        if (nameInput) nameInput.hidden = true;
        if (nameSpan) nameSpan.hidden = false;
        planBreakdownApi.close();
        planOverviewApi.close();
        planSuccessApi.forceClose();
        // When entering from the Finance wizard CTA (no openCtx) or from any non-plan
        // entrypoint (curated/spotlight/newplan), start with the preset allocation
        // instead of any stale custom override from a previous visit.
        if (
          !openCtx ||
          (openCtx && openCtx.source && openCtx.source !== "plan")
        ) {
          detailAllocOverride = null;
          // Entering from Finance entrypoints should start with Buy now OFF.
          panel.dataset.scheduleBuyNow = "0";
          panel.dataset.forceDefaultMonthlySchedule = "1";
        } else {
          panel.dataset.forceDefaultMonthlySchedule = "0";
        }
        panelOpenContext =
          openCtx?.source === "newplan"
            ? { source: "newplan" }
            : openCtx && openCtx.source === "curated" && openCtx.curatedKey
              ? {
                  source: "curated",
                  curatedKey: String(openCtx.curatedKey).toLowerCase(),
                  card: openCtx.card,
                }
              : openCtx &&
                  openCtx.source === "spotlight" &&
                  openCtx.spotlightKey
                ? {
                    source: "spotlight",
                    spotlightKey: String(openCtx.spotlightKey).toLowerCase(),
                    card: openCtx.card,
                  }
                : { source: "plan" };
        // Entering plan detail from Finance entrypoints should start with a fresh end condition.
        // Prevent previous "Set a limit" state from leaking across entries.
        const repeatsEndEl = panel.querySelector(
          "[data-plan-detail-repeats-end]",
        );
        if (repeatsEndEl) {
          repeatsEndEl.dataset.endConditionText = "Continuous";
          repeatsEndEl.textContent = "Continuous";
        }
        scheduleSheetApi.planDetailRepeatsEndLimitText = "";
        syncPlanDetailSetLimitDetailRowsVisibility();
        populatePanel();
        syncPlanDetailAmountHint();
        if (openCtx?.source === "newplan" && recreatePlanPrefillRecord) {
          applyRecreatePlanPrefill(recreatePlanPrefillRecord);
          recreatePlanPrefillRecord = null;
          syncPlanDetailAmountHint();
        }
        resetScrollState();
        // Always start with the Repeats "Details" disclosure collapsed (instant, no animation).
        // This avoids reopening the panel in an expanded state from a previous visit.
        {
          const detailsCollapse = panel.querySelector(
            "[data-plan-detail-details-collapse]",
          );
          const detailsToggle = panel.querySelector(
            "[data-plan-detail-details-toggle]",
          );
          const detailsChevron = panel.querySelector(
            "[data-plan-detail-details-chevron]",
          );
          const detailsBody = detailsCollapse?.querySelector(
            ".plan-detail-panel__details-body",
          );
          if (detailsCollapse && detailsToggle && detailsChevron) {
            if (detailsBody) {
              detailsBody.style.transition = "none";
            }
            detailsCollapse.classList.remove(
              "plan-detail-panel__details-collapse--expanded",
            );
            detailsToggle.setAttribute("aria-expanded", "false");
            detailsChevron.setAttribute(
              "src",
              "assets/icon_chevron_down_white.svg",
            );
            if (detailsBody) {
              void detailsBody.offsetHeight;
              detailsBody.style.transition = "";
            }
          }
        }

        // Ensure stacked flow panels never "stick" open across visits.
        {
          const bufPanel = panel.querySelector("[data-plan-buffer-panel]");
          if (bufPanel) {
            bufPanel.classList.remove("is-open");
            bufPanel.hidden = true;
          }
          const ecPanel = panel.querySelector(
            "[data-plan-end-condition-panel]",
          );
          if (ecPanel) {
            ecPanel.classList.remove("is-open");
            ecPanel.hidden = true;
          }
        }

        panel.hidden = false;
        if (container) {
          container.classList.remove("is-plan-detail-open");
          container.classList.remove("is-plan-detail-fading");
        }
        requestAnimationFrame(() => {
          panel.classList.add("is-open");
        });
        setTimeout(() => {
          if (container && panel.classList.contains("is-open")) {
            container.classList.add("is-plan-detail-fading");
          }
        }, 80);
        setTimeout(() => {
          if (container && panel.classList.contains("is-open")) {
            container.classList.add("is-plan-detail-open");
          }
        }, 350);
      } else {
        const instant = !!(openCtx && openCtx.instant);
        if (instant) {
          planBreakdownApi.close({ instant: true });
          planBufferApi.close({ instant: true });
          planEndConditionApi.close({ instant: true });
          planOverviewApi.close({ instant: true });
          planSuccessApi.forceClose();
          const submitLoader = panel.querySelector("[data-plan-submit-loader]");
          if (submitLoader) submitLoader.hidden = true;
          document
            .querySelector("[data-alloc-lock-tooltip]")
            ?.classList.remove("is-visible");
          panelOpenContext = { source: "plan" };
          panel.style.transition = "none";
          panel.classList.remove("is-open");
          void panel.offsetHeight;
          panel.style.transition = "";
          panel.hidden = true;
          if (container) {
            container.classList.remove("is-plan-detail-open");
            container.classList.remove("is-plan-detail-fading");
          }
          const spotlightEl = document.querySelector(".spotlight__scroll");
          if (spotlightEl) spotlightEl.scrollLeft = 0;
          return;
        }
        planBreakdownApi.close();
        planBufferApi.close({ instant: true });
        planEndConditionApi.close({ instant: true });
        planOverviewApi.close();
        planSuccessApi.forceClose();
        const submitLoader = panel.querySelector("[data-plan-submit-loader]");
        if (submitLoader) submitLoader.hidden = true;
        document
          .querySelector("[data-alloc-lock-tooltip]")
          ?.classList.remove("is-visible");
        panelOpenContext = { source: "plan" };
        panel.classList.remove("is-open");
        if (container) {
          container.classList.add("is-plan-detail-fading");
          container.classList.remove("is-plan-detail-open");
          requestAnimationFrame(() => {
            container.classList.remove("is-plan-detail-fading");
          });
        }
        const onEnd = () => {
          if (!panel.classList.contains("is-open")) panel.hidden = true;
          panel.removeEventListener("transitionend", onEnd);
        };
        panel.addEventListener("transitionend", onEnd);
        // Reset spotlight scroll position when returning to the Finance page
        const spotlightEl = document.querySelector(".spotlight__scroll");
        if (spotlightEl) spotlightEl.scrollLeft = 0;
      }
    };

    dismissPlanDetailStackInstant = () => {
      allocPickerApi.close({ instant: true });
      setOpen(false, { instant: true });
    };

    const initPlanSubmitSuccessFlow = () => {
      const loaderEl = panel.querySelector("[data-plan-submit-loader]");
      const successEl = panel.querySelector("[data-plan-success-panel]");
      const LOADER_MS = 1400;
      let submitGeneration = 0;

      const forceClose = () => {
        submitGeneration += 1;
        if (loaderEl) {
          loaderEl.hidden = true;
        }
        if (successEl) {
          successEl.classList.remove("is-open");
          successEl.hidden = true;
        }
        panel.classList.remove("is-plan-success-open");
      };

      const showLoader = () => {
        if (!loaderEl) return;
        loaderEl.hidden = false;
      };

      const hideLoader = () => {
        if (!loaderEl) return;
        loaderEl.hidden = true;
      };

      const buildFirstBuyLine = () => {
        const t = window.I18N?.t
          ? window.I18N.t.bind(window.I18N)
          : (source, params) => {
              if (!params) return source;
              return String(source).replace(/\{(\w+)\}/g, (_, key) =>
                Object.prototype.hasOwnProperty.call(params, key)
                  ? String(params[key])
                  : `{${key}}`,
              );
            };
        const overviewFirstBuy =
          panel
            .querySelector("[data-plan-overview-first-buy]")
            ?.textContent?.trim() || "";
        if (overviewFirstBuy && overviewFirstBuy !== "—") {
          return t("First buy on {date}", { date: overviewFirstBuy });
        }
        const sched = getPlanDetailScheduleFullTextFromEl(
          panel.querySelector("[data-plan-detail-schedule]"),
        );
        const parts = sched
          .split("·")
          .map((t) => t.trim())
          .filter(Boolean);
        const tail =
          parts.length > 1 ? parts.slice(1).join(" · ") : parts[0] || "";
        const timeMatch = tail.match(/at\s+~?\s*(\d{1,2}:\d{2})/i);
        const timeStr = timeMatch ? `~${timeMatch[1]}` : "~12:00";
        const dayMatch = tail.match(/(\d{1,2})(?:st|nd|rd|th)/i);
        if (!dayMatch && tail) {
          return t("First buy on {date}", { date: tail });
        }
        const day = dayMatch ? parseInt(dayMatch[1], 10) : 15;
        const dateObj = new Date();
        if (dateObj.getDate() >= day) dateObj.setMonth(dateObj.getMonth() + 1);
        dateObj.setDate(day);
        const mon = dateObj.toLocaleString("en-US", { month: "short" });
        return t("First buy on {date}", { date: `${mon} ${day} at ${timeStr}` });
      };

      const syncSuccessCopy = () => {
        const t = window.I18N?.t
          ? window.I18N.t.bind(window.I18N)
          : (source, params) => {
              if (!params) return source;
              return String(source).replace(/\{(\w+)\}/g, (_, key) =>
                Object.prototype.hasOwnProperty.call(params, key)
                  ? String(params[key])
                  : `{${key}}`,
              );
            };
        const freqKey = (
          document
            .querySelector("[data-plan-freq-item].is-active")
            ?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        const freqWord =
          freqKey === "daily"
            ? "daily"
            : freqKey === "weekly"
              ? "weekly"
              : "monthly";
        const titleEl = successEl?.querySelector("[data-plan-success-title]");
        const prefundEl = successEl?.querySelector(
          "[data-plan-success-prefund]",
        );
        const subEl = successEl?.querySelector("[data-plan-success-sub]");
        const reserveCardEl = successEl?.querySelector(
          "[data-plan-success-reserve-card]",
        );
        if (titleEl) {
          if (freqKey === "flexible") {
            titleEl.textContent = t("Your DCA plan is set");
          } else {
            titleEl.textContent = t("Your {frequency} DCA plan is set", {
              frequency: t(freqWord),
            });
          }
        }
        const selectedMethodBtn =
          panel.querySelector("[data-plan-buffer-method].is-selected") ||
          panel.querySelector('[data-plan-buffer-method][aria-pressed="true"]');
        const isReservedMethod =
          selectedMethodBtn?.getAttribute("data-plan-buffer-method") ===
          "reserved";
        if (prefundEl) {
          const reserveAmount =
            panel
              .querySelector("[data-plan-overview-prefund-amount]")
              ?.textContent?.trim() ||
            panel
              .querySelector("[data-plan-buffer-reserve-amt]")
              ?.textContent?.trim() ||
            "—";
          const cur = String(
            panel.querySelector("[data-plan-detail-currency]")?.textContent ||
              currencyState.plan ||
              "USDT",
          ).trim();
          const hasCurrencySuffix = new RegExp(`\\b${cur}\\b$`, "i").test(
            reserveAmount,
          );
          prefundEl.textContent =
            reserveAmount === "—"
              ? `Reserved — ${cur}`
              : `Reserved ${hasCurrencySuffix ? reserveAmount : `${reserveAmount} ${cur}`}`;
          prefundEl.hidden = !isReservedMethod;
          prefundEl.style.display = isReservedMethod ? "" : "none";
        }
        if (reserveCardEl) {
          reserveCardEl.hidden = isReservedMethod;
          reserveCardEl.style.display = isReservedMethod ? "none" : "";
        }
        if (subEl) subEl.textContent = buildFirstBuyLine();
      };

      const openSuccess = () => {
        if (!successEl) return;
        syncSuccessCopy();
        panel.classList.add("is-plan-success-open");
        successEl.hidden = false;
        requestAnimationFrame(() => successEl.classList.add("is-open"));
      };

      const closeSuccess = () => {
        if (!successEl) return;
        successEl.classList.remove("is-open");
        const onEnd = () => {
          if (!successEl.classList.contains("is-open")) {
            successEl.hidden = true;
            panel.classList.remove("is-plan-success-open");
          }
          successEl.removeEventListener("transitionend", onEnd);
        };
        successEl.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 380);
      };

      panel
        .querySelector("[data-plan-overview-confirm]")
        ?.addEventListener("click", () => {
          const gen = (submitGeneration += 1);
          showLoader();
          window.setTimeout(() => {
            if (gen !== submitGeneration) return;
            hideLoader();
            // Keep overview in place (still open under success); success z-index is higher so it
            // slides in over it—avoids the overview “popping off” before the submitted screen.
            if (gen !== submitGeneration) return;
            setState("flow", 2, { force: true });
            const overviewFirstBuy =
              panel
                .querySelector("[data-plan-overview-first-buy]")
                ?.textContent?.trim() || "";
            const overviewReserved =
              panel
                .querySelector("[data-plan-overview-prefund-amount]")
                ?.textContent?.trim() || "";
            const schedLine = getPlanDetailScheduleFullTextFromEl(
              panel.querySelector("[data-plan-detail-schedule]"),
            );
            const nextCompact = formatFinanceNextBuyCompact(schedLine);
            const financeNextBuy =
              document
                .querySelector("[data-finance-summary-next-buy]")
                ?.textContent?.trim() || "";
            const paymentMethod =
              panel
                .querySelector("[data-plan-overview-payment-method]")
                ?.textContent?.trim() || "Pay as you go";
            const runoutPolicy =
              panel
                .querySelector("[data-plan-overview-runout-value]")
                ?.textContent?.trim() || "—";
            const repeatsValue =
              panel
                .querySelector("[data-plan-overview-repeats]")
                ?.textContent?.trim() ||
              schedLine ||
              "—";
            const amountRaw =
              parseInt(
                String(
                  panel.querySelector("[data-plan-detail-amount-input]")
                    ?.value || "",
                ).replace(/[^0-9]/g, ""),
                10,
              ) || 0;
            const sliderAmt =
              parseInt(
                String(
                  document
                    .querySelector("[data-plan-slider]")
                    ?.getAttribute("aria-valuenow") || "",
                ).trim(),
                10,
              ) || 0;
            const cur = String(
              panel.querySelector("[data-plan-detail-currency]")?.textContent ||
                currencyState.plan ||
                "TWD",
            ).trim();
            const freqKey = (
              document
                .querySelector("[data-plan-freq-item].is-active")
                ?.getAttribute("data-plan-freq-item") || "monthly"
            ).toLowerCase();
            const cadence =
              freqKey === "daily"
                ? "day"
                : freqKey === "weekly"
                  ? "week"
                  : "month";
            const effAmount =
              amountRaw > 0 ? amountRaw : sliderAmt > 0 ? sliderAmt : 5000;
            const isReservedPlan = /\bset aside funds\b/i.test(paymentMethod);
            const selectedAssets =
              getCurrentPlanDisplayAssets("assets/icon_currency_btc.svg") || [];
            const selectedTickers = selectedAssets
              .map((a) => String(a?.ticker || "").trim())
              .filter(Boolean);
            const buildEqualMix = (tickers) => {
              if (!Array.isArray(tickers) || tickers.length < 2) return [];
              const base = Math.floor(100 / tickers.length);
              let rem = 100 - base * tickers.length;
              return tickers.map((ticker) => {
                const pct = base + (rem > 0 ? 1 : 0);
                if (rem > 0) rem -= 1;
                return {
                  ticker: String(ticker || "")
                    .trim()
                    .toUpperCase(),
                  pct,
                };
              });
            };
            let assetMix = [];
            const activeItems = getActiveAllocMultiItems();
            if (activeItems.length > 1) {
              assetMix = activeItems
                .map((row) => {
                  const ticker = String(
                    row.querySelector(".alloc-multi__ticker")?.textContent ||
                      "",
                  )
                    .trim()
                    .toUpperCase();
                  const raw = String(
                    row.querySelector("[data-alloc-pct-input]")?.value || "",
                  ).replace(/[^0-9]/g, "");
                  const pct = raw ? parseInt(raw, 10) : 0;
                  return { ticker, pct };
                })
                .filter((x) => x.ticker);
              if (
                assetMix.length > 1 &&
                !assetMix.some((x) => Number.isFinite(x.pct) && x.pct > 0)
              ) {
                assetMix = buildEqualMix(assetMix.map((x) => x.ticker));
              }
            }
            if (assetMix.length < 2) {
              assetMix = buildEqualMix(selectedTickers);
            }
            const tickerLine = selectedTickers.join(" · ");
            const singleIconSrc =
              selectedAssets[0]?.icon || "assets/icon_currency_btc.svg";
            const resolvedNextBuyRaw =
              overviewFirstBuy && overviewFirstBuy !== "—"
                ? overviewFirstBuy
                : financeNextBuy ||
                  FINANCE_SUMMARY_NEXT_BUY_FALLBACK ||
                  nextCompact;
            const resolvedNextBuy = shortenWeekdayLabel(resolvedNextBuyRaw);
            financeSummaryConfirmedNextBuy = resolvedNextBuy;
            financeSummaryConfirmedReserved =
              parseMoneyWithCurrency(overviewReserved);
            myPlansSubmittedPlan = {
              id: `plan-active-${Date.now()}`,
              status: "active",
              name:
                panel
                  .querySelector("[data-plan-detail-name]")
                  ?.textContent?.trim() || "My plan",
              kicker:
                selectedAssets.length === 1
                  ? selectedAssets[0]?.name ||
                    panel
                      .querySelector("[data-plan-detail-name]")
                      ?.textContent?.trim() ||
                    "My plan"
                  : panel
                      .querySelector("[data-plan-detail-name]")
                      ?.textContent?.trim() || "My plan",
              tickers:
                tickerLine ||
                String(panel.dataset?.planDetailAssetTickerLine || "").trim() ||
                "BTC",
              assetMix,
              iconSrc: singleIconSrc,
              assetIcons: selectedAssets
                .map((a) => ({
                  ticker: String(a?.ticker || "").trim(),
                  icon: String(a?.icon || "").trim(),
                }))
                .filter((a) => a.icon),
              investLine: `${effAmount.toLocaleString("en-US")} ${cur} each ${cadence}`,
              repeats: repeatsValue,
              firstBuy: resolvedNextBuy,
              nextBuy: resolvedNextBuy,
              completedBuys: 0,
              totalInvested: formatMoney(0, cur),
              fundingMethod: paymentMethod,
              isReserved: isReservedPlan,
              reservedFunds: overviewReserved || "—",
              runoutPolicy: runoutPolicy || "—",
            };
            myPlansPrefillPlan = null;
            applyFinanceSummaryMeta();
            myPlansPanelApi.sync?.();
            openSuccess();
          }, LOADER_MS);
        });

      const leaveSuccessToFinanceAuto = () => {
        planOverviewApi.close({ instant: true });
        forceClose();
        setOpen(false);
        goFinanceAutoInvestFromSuccess();
      };

      const leaveSuccessToMyPlans = () => {
        openMyPlansAfterPlanFlow();
      };

      successEl
        ?.querySelectorAll("[data-plan-success-dismiss]")
        .forEach((b) => {
          b.addEventListener("click", leaveSuccessToFinanceAuto);
        });

      successEl
        ?.querySelector("[data-plan-success-open-prefund]")
        ?.addEventListener("click", openFunding2FromSuccess);

      successEl
        ?.querySelector("[data-plan-success-view-plan]")
        ?.addEventListener("click", leaveSuccessToMyPlans);

      return { close: closeSuccess, forceClose };
    };

    planSuccessApi = initPlanSubmitSuccessFlow();

    if (openBtn) openBtn.addEventListener("click", () => setOpen(true));
    if (newPlanBtn) {
      newPlanBtn.addEventListener("click", () => {
        // Always reset custom title when starting a fresh New plan flow.
        customPlanTitle = "";
        const shouldAutofocusAmount = !skipPlanAmountAutofocusOnce;
        skipPlanAmountAutofocusOnce = false;
        setOpen(true, { source: "newplan" });
        if (shouldAutofocusAmount) {
          setTimeout(() => {
            const inp = panel.querySelector("[data-plan-detail-amount-input]");
            inp?.focus();
          }, 380);
        }
      });
    }
    closeButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const ld = panel.querySelector("[data-plan-submit-loader]");
        if (ld && !ld.hidden) {
          planSuccessApi.forceClose();
          return;
        }
        const sep = panel.querySelector("[data-plan-success-panel]");
        if (sep?.classList.contains("is-open")) {
          planSuccessApi.close();
          return;
        }
        const ovp = panel.querySelector("[data-plan-overview-panel]");
        if (ovp?.classList.contains("is-open")) {
          planOverviewApi.close();
          return;
        }
        const bufP = panel.querySelector("[data-plan-buffer-panel]");
        if (bufP?.classList.contains("is-open")) {
          planBufferApi.close();
          return;
        }
        const ecP = panel.querySelector("[data-plan-end-condition-panel]");
        if (ecP?.classList.contains("is-open")) {
          planEndConditionApi.close();
          return;
        }
        setOpen(false);
      });
    });
    panel.addEventListener("click", (e) => {
      const addAssetsBtn = e.target.closest(".plan-detail-panel__add-assets");
      if (!addAssetsBtn) return;
      e.preventDefault();
      const emptyEntry = !!addAssetsBtn.closest(
        ".plan-detail-panel__alloc-empty",
      );
      allocPickerApi.open(emptyEntry ? { emptyEntry: true } : {});
    });

    document.querySelectorAll(".curated-portfolios__card").forEach((card) => {
      if (card.tagName !== "BUTTON") {
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
      }
      const openFromCard = () => {
        const key = card.getAttribute("data-curated-key");
        if (!key) return;
        setOpen(true, { source: "curated", curatedKey: key, card });
        setTimeout(() => {
          const inp = panel.querySelector("[data-plan-detail-amount-input]");
          inp?.focus();
        }, 380);
      };
      card.addEventListener("click", openFromCard);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFromCard();
        }
      });
    });

    const openThemeAllocPickerByCategory = (themeCategory) => {
      allocPickerApi.open({
        source: "finance",
        tab: "curated",
        themeCategory,
        emptyEntry: true,
      });
    };

    document.querySelectorAll(".start-theme__card").forEach((card) => {
      const openThemeAllocPicker = () => {
        const curatedKey = String(
          card.getAttribute("data-curated-key") || "",
        ).toLowerCase();
        const themeCategory = mapCuratedKeyToThemeCategory(curatedKey);
        openThemeAllocPickerByCategory(themeCategory);
      };
      card.addEventListener("click", openThemeAllocPicker);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openThemeAllocPicker();
        }
      });
    });

    const financeThemesPageEl = document.querySelector(
      "[data-finance-themes-page]",
    );
    const financeThemesListEl = financeThemesPageEl?.querySelector(
      "[data-finance-themes-list]",
    );
    const financeThemesShowAllBtn = document.querySelector(
      ".start-theme__show-all",
    );
    const financeThemeDescriptions = {
      all: "An overview of all coins available on XREX for DCA",
      ai: "{$descriptionSameAsMarkets}",
      rwa: "{$descriptionSameAsMarkets}",
      l1: "{$descriptionSameAsMarkets}",
      l2: "{$descriptionSameAsMarkets}",
      defi: "{$descriptionSameAsMarkets}",
      gaming: "{$descriptionSameAsMarkets}",
      storage: "{$descriptionSameAsMarkets}",
      restake: "{$descriptionSameAsMarkets}",
      meme: "{$descriptionSameAsMarkets}",
      nft: "{$descriptionSameAsMarkets}",
      metaverse: "{$descriptionSameAsMarkets}",
      gold: "{$descriptionSameAsMarkets}",
    };
    const financeThemeHeadSubtitles = {
      ai: "Artificial Intelligence",
      gold: "Tokenized gold",
      rwa: "Real World Assets",
      l1: "Layer1 solutions",
      l2: "Layer2 solutions",
      defi: "Decentralized Finance",
      gaming: "Play to Earn & more",
      storage: "Decentralised storage solutions",
      restake: "Reuse of staked asset innovations",
      meme: "Cultural coins",
      nft: "Non-fundigble tokens",
      metaverse: "VR, digital estate & more",
    };
    const initThemeGuideSheet = () => {
      const sheet = document.querySelector("[data-theme-guide-sheet]");
      const tabsEl = sheet?.querySelector("[data-theme-guide-tabs]");
      const cardsEl = sheet?.querySelector("[data-theme-guide-cards]");
      if (!sheet || !tabsEl || !cardsEl)
        return { open: () => {}, close: () => {} };
      const allCategories = [...themeCategories];
      let visibleCategories = [...allCategories];
      let activeCategory = "all";
      let suppressCardScrollSync = false;
      let cardScrollSyncTimer = 0;
      const bindHorizontalRailInteractions = (el, opts = {}) => {
        if (!el) return;
        if (el.dataset.themeGuideRailBound === "true") return;
        el.dataset.themeGuideRailBound = "true";
        const shouldSnapCards = opts.snapToCards === true;
        const dragClassName = opts.dragClassName || "";
        const usePointerCapture = opts.usePointerCapture !== false;
        let isDown = false;
        let startX = 0;
        let startLeft = 0;
        let moved = false;
        let activePointerId = null;
        const SNAP_THRESHOLD_PX = 3;
        let lastClientX = 0;
        let dragSettleTimer = 0;
        const snapToNearestCard = () => {
          if (!shouldSnapCards) return;
          const cards = Array.from(
            el.querySelectorAll("[data-theme-guide-card]"),
          );
          if (!cards.length) return;
          const firstOffset = cards[0].offsetLeft;
          const step =
            cards.length > 1
              ? cards[1].offsetLeft - cards[0].offsetLeft
              : cards[0].getBoundingClientRect().width + 12;
          const dragDelta = lastClientX - startX;
          const dragDirection = dragDelta < 0 ? 1 : dragDelta > 0 ? -1 : 0; // swipe left => next
          const SNAP_SENSITIVITY_RATIO = 0.25;
          const currentFloatIndex =
            step > 0 ? (el.scrollLeft - firstOffset) / step : 0;
          let targetIndex = Math.round(currentFloatIndex);
          if (Math.abs(dragDelta) > step * SNAP_SENSITIVITY_RATIO) {
            targetIndex = Math.round(currentFloatIndex) + dragDirection;
          }
          const maxIndex = cards.length - 1;
          targetIndex = Math.max(0, Math.min(maxIndex, targetIndex));
          const targetCard = cards[targetIndex];
          targetCard?.scrollIntoView({
            behavior: "smooth",
            inline: "start",
            block: "nearest",
          });
        };
        el.addEventListener("pointerdown", (e) => {
          if (e.button !== 0) return;
          isDown = true;
          activePointerId = e.pointerId;
          moved = false;
          lastClientX = e.clientX;
          if (dragSettleTimer) {
            window.clearTimeout(dragSettleTimer);
            dragSettleTimer = 0;
          }
          startX = e.clientX;
          startLeft = el.scrollLeft;
          if (dragClassName) el.classList.add(dragClassName);
          if (usePointerCapture) el.setPointerCapture?.(e.pointerId);
        });
        el.addEventListener("pointermove", (e) => {
          if (!isDown) return;
          if (activePointerId != null && e.pointerId !== activePointerId)
            return;
          lastClientX = e.clientX;
          const delta = e.clientX - startX;
          if (Math.abs(delta) > SNAP_THRESHOLD_PX) moved = true;
          el.scrollLeft = startLeft - delta;
        });
        const stop = (e) => {
          if (!isDown) return;
          if (
            activePointerId != null &&
            e?.pointerId != null &&
            e.pointerId !== activePointerId
          )
            return;
          isDown = false;
          if (
            usePointerCapture &&
            e?.pointerId != null &&
            el.hasPointerCapture?.(e.pointerId)
          ) {
            el.releasePointerCapture(e.pointerId);
          }
          activePointerId = null;
          if (moved) {
            snapToNearestCard();
            if (shouldSnapCards && dragClassName) {
              dragSettleTimer = window.setTimeout(() => {
                el.classList.remove(dragClassName);
                dragSettleTimer = 0;
              }, 260);
            } else if (dragClassName) {
              el.classList.remove(dragClassName);
            }
            return;
          }
          if (dragClassName) el.classList.remove(dragClassName);
        };
        el.addEventListener("pointerup", stop);
        el.addEventListener("pointercancel", stop);
        el.addEventListener("lostpointercapture", () => {
          if (!isDown) return;
          stop({});
        });
        window.addEventListener("pointerup", stop);
        window.addEventListener("blur", () => {
          if (!isDown) return;
          stop({});
        });
        el.addEventListener(
          "wheel",
          (e) => {
            if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
            e.preventDefault();
            el.scrollLeft += e.deltaY;
          },
          { passive: false },
        );
      };

      const resolveCategory = (key) => {
        const normalized = String(key || "").toLowerCase();
        if (visibleCategories.some((c) => c.key === normalized))
          return normalized;
        return visibleCategories[0]?.key || "all";
      };
      const renderTabs = () => {
        tabsEl.innerHTML = visibleCategories
          .map(
            (cat) => `
          <button class="theme-guide-sheet__tab ${cat.key === activeCategory ? "is-active" : ""}" type="button" data-theme-guide-tab="${cat.key}">
            ${cat.label}
          </button>
        `,
          )
          .join("");
      };
      const scrollActiveTabIntoView = (behavior = "auto") => {
        const activeTabEl = tabsEl.querySelector(
          `[data-theme-guide-tab="${activeCategory}"]`,
        );
        activeTabEl?.scrollIntoView({
          behavior,
          inline: "center",
          block: "nearest",
        });
      };
      const renderCards = () => {
        cardsEl.innerHTML = visibleCategories
          .map(
            (cat) => `
          <article class="theme-guide-sheet__card" data-theme-guide-card="${cat.key}">
            <div class="theme-guide-sheet__card-head">
              <img class="theme-guide-sheet__card-icon" src="${cat.iconOn}" alt="" />
              <div class="theme-guide-sheet__card-head-copy">
                <div class="theme-guide-sheet__card-title">${cat.label}</div>
                ${financeThemeHeadSubtitles[cat.key] ? `<div class="theme-guide-sheet__card-subtitle">${financeThemeHeadSubtitles[cat.key]}</div>` : ""}
              </div>
            </div>
            <p class="theme-guide-sheet__card-desc">${financeThemeDescriptions[cat.key] || `Learn more about ${cat.label}.`}</p>
          </article>
        `,
          )
          .join("");
      };
      const setActiveCategory = (key, opts = {}) => {
        const prevActiveCategory = activeCategory;
        activeCategory = resolveCategory(key);
        renderTabs();
        scrollActiveTabIntoView(opts.tabBehavior || "auto");
        if (opts.scrollCard !== false) {
          const idx = visibleCategories.findIndex(
            (cat) => cat.key === activeCategory,
          );
          const cardEls = Array.from(
            cardsEl.querySelectorAll("[data-theme-guide-card]"),
          );
          if (idx >= 0 && cardEls[idx]) {
            const prevIdx = visibleCategories.findIndex(
              (cat) => cat.key === prevActiveCategory,
            );
            const hopCount = prevIdx >= 0 ? Math.abs(idx - prevIdx) : 1;
            const settleMs = opts.lockActiveDuringScroll
              ? Math.min(1100, 260 + hopCount * 140)
              : 220;
            suppressCardScrollSync = true;
            cardEls[idx].scrollIntoView({
              behavior: opts.cardBehavior || "smooth",
              inline: "start",
              block: "nearest",
            });
            window.clearTimeout(cardScrollSyncTimer);
            cardScrollSyncTimer = window.setTimeout(() => {
              suppressCardScrollSync = false;
            }, settleMs);
          }
        }
      };

      tabsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-theme-guide-tab]");
        if (!btn) return;
        setActiveCategory(btn.getAttribute("data-theme-guide-tab"), {
          lockActiveDuringScroll: true,
          cardBehavior: "smooth",
          tabBehavior: "smooth",
        });
      });
      let scrollRaf = 0;
      cardsEl.addEventListener(
        "scroll",
        () => {
          if (suppressCardScrollSync) return;
          if (scrollRaf) cancelAnimationFrame(scrollRaf);
          scrollRaf = requestAnimationFrame(() => {
            const cards = Array.from(
              cardsEl.querySelectorAll("[data-theme-guide-card]"),
            );
            if (!cards.length) return;
            let nearestKey = activeCategory;
            let nearestDist = Infinity;
            const left = cardsEl.getBoundingClientRect().left;
            cards.forEach((card) => {
              const dist = Math.abs(card.getBoundingClientRect().left - left);
              if (dist < nearestDist) {
                nearestDist = dist;
                nearestKey =
                  card.getAttribute("data-theme-guide-card") || nearestKey;
              }
            });
            if (nearestKey !== activeCategory)
              setActiveCategory(nearestKey, {
                scrollCard: false,
                tabBehavior: "smooth",
              });
          });
        },
        { passive: true },
      );

      const open = (opts = {}) => {
        visibleCategories = opts.hideAll
          ? allCategories.filter((cat) => cat.key !== "all")
          : [...allCategories];
        activeCategory = resolveCategory(opts.category);
        renderTabs();
        renderCards();
        bindHorizontalRailInteractions(tabsEl, { usePointerCapture: false });
        bindHorizontalRailInteractions(cardsEl, {
          snapToCards: true,
          dragClassName: "is-dragging",
        });
        sheet.hidden = false;
        requestAnimationFrame(() => {
          sheet.classList.add("is-open");
          // Exception on open: jump to target tab/card position without animation.
          const prevTabScrollBehavior = tabsEl.style.scrollBehavior;
          const prevCardScrollBehavior = cardsEl.style.scrollBehavior;
          tabsEl.style.scrollBehavior = "auto";
          cardsEl.style.scrollBehavior = "auto";
          setActiveCategory(activeCategory, {
            cardBehavior: "auto",
            tabBehavior: "auto",
          });
          requestAnimationFrame(() => {
            tabsEl.style.scrollBehavior = prevTabScrollBehavior;
            cardsEl.style.scrollBehavior = prevCardScrollBehavior;
          });
        });
      };
      const close = () => {
        sheet.classList.remove("is-open");
        const onEnd = () => {
          if (!sheet.classList.contains("is-open")) sheet.hidden = true;
          sheet.removeEventListener("transitionend", onEnd);
        };
        sheet.addEventListener("transitionend", onEnd);
        setTimeout(onEnd, 320);
      };
      sheet
        .querySelectorAll("[data-theme-guide-close]")
        .forEach((btn) => btn.addEventListener("click", close));
      return { open, close };
    };
    const themeGuideApi = initThemeGuideSheet();
    const iconByTicker = {
      BTC: "assets/icon_currency_btc.svg",
      ETH: "assets/icon_currency_eth.svg",
      SOL: "assets/icon_solana.svg",
      XAUT: "assets/icon_currency_xaut.svg",
      RENDER: "assets/icon_currency_render.svg",
      NEAR: "assets/icon_currency_near.svg",
      LINK: "assets/icon_currency_link.svg",
      XRP: "assets/icon_currency_xrp.svg",
      FET: "assets/icon_currency_btc.svg",
      POL: "assets/icon_currency_matic.svg",
      DOGE: "assets/icon_currency_btc.svg",
    };
    const getThemeCoinStackMarkup = (themeCategory, variant = "start") => {
      const category = String(themeCategory || "").toLowerCase();
      const keys = pickableCoins
        .filter((c) => (c.categories || []).includes(category))
        .map((c) => c.key)
        .slice(0, 4);
      const visibles = keys.slice(0, 3);
      const extra = Math.max(0, keys.length - visibles.length);
      const coinClass =
        variant === "allthemes"
          ? "finance-themes-page__item-stack-coin"
          : "start-theme__stack-coin";
      const moreClass =
        variant === "allthemes"
          ? "finance-themes-page__item-stack-more"
          : "start-theme__stack-more";
      const chips = visibles
        .map((k) => {
          const match = pickableCoins.find((c) => c.key === k);
          const ticker = String(match?.ticker || k || "")
            .trim()
            .toUpperCase();
          const icon =
            match?.icon ||
            iconByTicker[ticker] ||
            "assets/icon_currency_btc.svg";
          return `<img class="${coinClass}" src="${icon}" alt="" />`;
        })
        .join("");
      const extraChip =
        extra > 0 ? `<span class="${moreClass}">+${extra}</span>` : "";
      return chips + extraChip;
    };

    document.querySelectorAll(".start-theme__card").forEach((card) => {
      const curatedKey = String(
        card.getAttribute("data-curated-key") || "",
      ).toLowerCase();
      const themeCategory = mapCuratedKeyToThemeCategory(curatedKey);
      const stackEl = card.querySelector("[data-start-theme-stack]");
      if (stackEl)
        stackEl.innerHTML = getThemeCoinStackMarkup(themeCategory, "start");
    });

    const closeFinanceThemesPage = (opts = {}) => {
      if (
        !financeThemesPageEl ||
        !financeThemesPageEl.classList.contains("is-open")
      )
        return;
      if (opts.instant) {
        financeThemesPageEl.classList.remove("is-open");
        financeThemesPageEl.hidden = true;
        return;
      }
      financeThemesPageEl.classList.remove("is-open");
      const onEnd = () => {
        if (!financeThemesPageEl.classList.contains("is-open"))
          financeThemesPageEl.hidden = true;
        financeThemesPageEl.removeEventListener("transitionend", onEnd);
      };
      financeThemesPageEl.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 320);
    };

    const openFinanceThemesPage = () => {
      if (!financeThemesPageEl) return;
      financeThemesPageEl.hidden = false;
      requestAnimationFrame(() => {
        financeThemesPageEl.classList.add("is-open");
      });
    };

    if (financeThemesListEl) {
      const visibleThemes = themeCategories.filter((cat) => cat.key !== "all");
      financeThemesListEl.innerHTML = visibleThemes
        .map(
          (cat) => `
        <button class="finance-themes-page__item" type="button" data-finance-theme-category="${cat.key}">
          <img class="finance-themes-page__item-icon" src="${cat.iconOn}" alt="" aria-hidden="true" />
          <span class="finance-themes-page__item-copy">
            <span class="finance-themes-page__item-title">${cat.label}</span>
              <span class="finance-themes-page__item-sub">${financeThemeHeadSubtitles[cat.key] || financeThemeDescriptions[cat.key] || `What is ${cat.label}`}</span>
          </span>
          <span class="finance-themes-page__item-right">
            <span class="finance-themes-page__item-stack" aria-hidden="true">
              ${getThemeCoinStackMarkup(cat.key, "allthemes")}
            </span>
            <span class="finance-themes-page__item-chev" aria-hidden="true">
              <img src="assets/icon_back.svg" alt="" />
            </span>
          </span>
        </button>
      `,
        )
        .join("");
      financeThemesListEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-finance-theme-category]");
        if (!btn) return;
        const category = String(
          btn.getAttribute("data-finance-theme-category") || "",
        ).toLowerCase();
        if (!category) return;
        // Keep All themes mounted underneath so allocation can slide over it.
        openThemeAllocPickerByCategory(category);
      });
    }

    financeThemesShowAllBtn?.addEventListener("click", openFinanceThemesPage);
    financeThemesShowAllBtn?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openFinanceThemesPage();
      }
    });
    financeThemesPageEl
      ?.querySelectorAll("[data-finance-themes-close]")
      .forEach((btn) => {
        btn.addEventListener("click", closeFinanceThemesPage);
      });
    financeThemesPageEl
      ?.querySelector("[data-theme-guide-open]")
      ?.addEventListener("click", () => {
        themeGuideApi.open({ category: "all", hideAll: true });
      });
    document
      .querySelector(".alloc-picker-panel__theme-info")
      ?.addEventListener("click", () => {
        const activeThemeCat = allocPickerPanel
          ?.querySelector("[data-alloc-picker-theme-cat].is-active")
          ?.getAttribute("data-alloc-picker-theme-cat");
        themeGuideApi.open({ category: activeThemeCat || "all" });
      });

    const spotlightShowAllBtn = document.querySelector(
      ".spotlight .curated-portfolios__show-all",
    );
    const openAllocPickerAllFromFinance = () => {
      allocPickerApi.open({
        source: "finance",
        tab: "curated",
        themeCategory: "all",
        emptyEntry: true,
      });
    };
    spotlightShowAllBtn?.addEventListener(
      "click",
      openAllocPickerAllFromFinance,
    );
    spotlightShowAllBtn?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAllocPickerAllFromFinance();
      }
    });

    // Spotlight crypto pills → open detail panel with empty auto-invest amount.
    const spotlightScrollEl = document.querySelector(".spotlight__scroll");
    document.querySelectorAll(".crypto-pill").forEach((pill) => {
      pill.setAttribute("role", "button");
      pill.setAttribute("tabindex", "0");
      const openFromPill = () => {
        // Suppress click if the user was dragging
        if (spotlightScrollEl?._getDidDrag?.()) return;
        const key = pill.getAttribute("data-spotlight-key");
        if (!key) return;
        setOpen(true, { source: "spotlight", spotlightKey: key, card: pill });
        setTimeout(() => {
          const inp = panel.querySelector("[data-plan-detail-amount-input]");
          inp?.focus();
        }, 380);
      };
      pill.addEventListener("click", openFromPill);
      pill.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openFromPill();
        }
      });
    });

    // ── Amount input ──────────────────────────────────────────────────────────
    const amountInput = panel.querySelector("[data-plan-detail-amount-input]");
    const detailBreakdownLinkBtn = panel.querySelector(
      ".plan-detail-panel__view-breakdown-link",
    );

    const formatWithCommas = (n) => n.toLocaleString("en-US");

    // Recalculate the footer return using the same logic as the main widget,
    // but reading the amount from this panel's input instead of the slider.
    // The observer is disconnected during the update to prevent infinite loops.
    let returnObserver = null;
    const mainReturnAbsEl = document.querySelector(
      ".plan-strategy__return-abs",
    );
    const observerOpts = {
      childList: true,
      characterData: true,
      subtree: true,
    };
    const syncDetailBreakdownLinkState = () => {
      if (!detailBreakdownLinkBtn) return;
      const amount = parseInt(
        amountInput?.value?.replace(/[^0-9]/g, "") || "0",
        10,
      );
      const allocCount =
        parseInt(
          panel
            .querySelector("[data-plan-detail-alloc-count]")
            ?.textContent?.trim() || "0",
          10,
        ) || 0;
      const hasAmount = Number.isFinite(amount) && amount > 0;
      const hasAssets = allocCount > 0;
      const allocRoot = getActiveAllocMultiRoot();
      let isPctAllocInvalid = false;
      if (
        allocRoot &&
        allocCount >= 2 &&
        !allocRoot.classList.contains("alloc-multi--amount-mode") &&
        !allocRoot.classList.contains("alloc-multi--auto")
      ) {
        const rows = allocRoot.querySelectorAll(
          ".alloc-multi__item [data-alloc-pct-input]",
        );
        let sumPct = 0;
        rows.forEach((inp) => {
          const v = parseInt(
            String(inp.value || "").replace(/[^0-9]/g, ""),
            10,
          );
          if (!isNaN(v)) sumPct += v;
        });
        isPctAllocInvalid = Math.abs(sumPct - 100) > 0.51;
      }
      const disabled = !(hasAmount && hasAssets) || isPctAllocInvalid;
      detailBreakdownLinkBtn.disabled = disabled;
    };

    const updateDetailReturn = () => {
      const ctx = panelOpenContext;
      const amount = parseInt(
        amountInput?.value?.replace(/[^0-9]/g, "") || "0",
        10,
      );
      const titleEl = panel.querySelector("[data-plan-detail-return-title]");
      const singleAssetPerBuyEl = panel.querySelector(
        "[data-plan-detail-single-asset-per-buy]",
      );
      const detailCurrencyEl = panel.querySelector(
        "[data-plan-detail-currency]",
      );
      syncDetailBreakdownLinkState();

      // Always recalculate coverage whenever amount or currency changes
      updateCoverageUI();
      syncPlanDetailContinueState();
      if (singleAssetPerBuyEl) {
        const currency =
          String(detailCurrencyEl?.textContent || "TWD").trim() || "TWD";
        singleAssetPerBuyEl.textContent = `${Math.max(0, amount || 0).toLocaleString("en-US")} ${currency}`;
      }

      if (ctx.source === "newplan" && !detailAllocOverride?.items?.length) {
        // No allocation yet — reset historic header + title (footer totals follow gate state)
        const histPctEl = panel.querySelector(
          "[data-plan-detail-return-historic-pct]",
        );
        const autoHistPctEl = panel.querySelector(
          "[data-plan-detail-alloc-auto-historic-pct]",
        );
        if (histPctEl) {
          histPctEl.textContent = "0.0%";
          histPctEl.removeAttribute("data-alloc-base-hist-pct");
        }
        if (autoHistPctEl) autoHistPctEl.textContent = "0.0%";
        if (titleEl)
          titleEl.textContent =
            document.querySelector("[data-plan-return-title]")?.textContent ||
            titleEl.textContent;
        const histTone = panel.querySelector(
          "[data-plan-detail-historic-performance-tone]",
        );
        if (histTone) {
          histTone.classList.remove("plan-return-metric__group--loss");
          histTone
            .querySelectorAll(".plan-return-metric__arrow")
            .forEach((a) => {
              a.classList.remove("plan-return-metric__arrow--down");
              if (a.classList.contains("plan-return-metric__arrow--historic")) {
                a.src = RETURN_METRIC_ARROW_HIST_POS;
              }
            });
        }
        return;
      }

      const overrideCuratedKey =
        detailAllocOverride?.kind === "curated" && detailAllocOverride.key
          ? String(detailAllocOverride.key).toLowerCase()
          : "";
      const effectiveCuratedKey =
        ctx.source === "curated" && ctx.curatedKey
          ? String(ctx.curatedKey).toLowerCase()
          : overrideCuratedKey;

      if (effectiveCuratedKey) {
        if (returnObserver) returnObserver.disconnect();
        const freqItemCurated = document.querySelector(
          "[data-plan-freq-item].is-active",
        );
        const freqCurated = (
          freqItemCurated?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: effectiveCuratedKey,
          freq: freqCurated,
          displayAssets: getCurrentPlanDisplayAssets(
            "assets/icon_currency_btc.svg",
          ),
        });
        if (titleEl) {
          titleEl.textContent =
            document.querySelector("[data-plan-return-title]")?.textContent ||
            titleEl.textContent;
        }
        if (returnObserver && mainReturnAbsEl)
          returnObserver.observe(mainReturnAbsEl, observerOpts);
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
        return;
      }

      if (ctx.source === "spotlight" && ctx.spotlightKey) {
        if (returnObserver) returnObserver.disconnect();
        const freqItemSpot = document.querySelector(
          "[data-plan-freq-item].is-active",
        );
        const freqSpot = (
          freqItemSpot?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: ctx.spotlightKey,
          freq: freqSpot,
          displayAssets: getCurrentPlanDisplayAssets(
            "assets/icon_currency_btc.svg",
          ),
        });
        if (titleEl) {
          titleEl.textContent =
            document.querySelector("[data-plan-return-title]")?.textContent ||
            titleEl.textContent;
        }
        if (returnObserver && mainReturnAbsEl)
          returnObserver.observe(mainReturnAbsEl, observerOpts);
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
        return;
      }

      const slider = document.querySelector("[data-plan-slider]");
      if (slider) {
        if (returnObserver) returnObserver.disconnect();
        const prev = slider.getAttribute("aria-valuenow");
        slider.setAttribute("aria-valuenow", String(amount));
        updatePlanStrategyHistoricalReturn();
        slider.setAttribute("aria-valuenow", prev);
        syncFooterFromMainWidget();
        const carousel = document.querySelector("[data-plan-carousel]");
        const activePlan = String(
          carousel?.getAttribute("data-active-plan") || "bitcoin",
        ).toLowerCase();
        const freqItem = document.querySelector(
          "[data-plan-freq-item].is-active",
        );
        const freqPlan = (
          freqItem?.getAttribute("data-plan-freq-item") || "monthly"
        ).toLowerCase();
        updatePlanStrategyHistoricalReturn({
          detailPanel: true,
          amount,
          planKey: activePlan,
          freq: freqPlan,
          displayAssets: getCurrentPlanDisplayAssets(
            "assets/icon_currency_btc.svg",
          ),
        });
        if (returnObserver && mainReturnAbsEl)
          returnObserver.observe(mainReturnAbsEl, observerOpts);
        snapshotFooterAllocBases();
        applyFooterAllocSliderTweak();
      }
    };

    document.addEventListener("plan-investment-currency-updated", () => {
      syncPlanDetailAmountHint();
      if (!panel.classList.contains("is-open")) return;
      updateDetailReturn();
      panel._planDetailAllocRefreshAmounts?.();
      panel._planDetailAutoAllocRefreshAmounts?.();
    });

    document.addEventListener("prototype-locale-changed", () => {
      syncPlanDetailAmountHint();
    });

    document.addEventListener("prototype-smart-allocation-toggle", () => {
      syncActiveAllocationVariant();
      if (!panel.classList.contains("is-open")) return;
      syncManualAllocHistoricInline();
      // Refresh allocation row values before return/continue sync so active variant inputs are current.
      panel._planDetailAllocRefreshAmounts?.();
      panel._planDetailAutoAllocRefreshAmounts?.();
      updateDetailReturn();
      if (
        panel
          .querySelector("[data-plan-overview-panel]")
          ?.classList.contains("is-open")
      ) {
        planOverviewApi.sync();
      }
      if (
        document
          .querySelector("[data-plan-breakdown-panel]")
          ?.classList.contains("is-open")
      ) {
        planBreakdownApi.sync();
      }
      if (
        document
          .querySelector("[data-plan-detail-continue-sheet]")
          ?.classList.contains("is-open")
      ) {
        syncContinueSheetSummary();
      }
    });

    document.addEventListener("plan-schedule-confirmed", () => {
      updatePlanStrategyHistoricalReturn();
      if (panel.classList.contains("is-open")) {
        updateCoverageUI();
        updateDetailReturn();
        if (
          panel
            .querySelector("[data-plan-overview-panel]")
            ?.classList.contains("is-open")
        ) {
          planOverviewApi.sync();
        }
      }
    });

    // Watch main widget's return-abs — fires when range or currency changes externally.
    if (mainReturnAbsEl) {
      returnObserver = new MutationObserver(() => {
        if (panel.classList.contains("is-open")) updateDetailReturn();
      });
      returnObserver.observe(mainReturnAbsEl, observerOpts);
    }

    if (amountInput) {
      // Apply live comma formatting, preserving cursor position.
      // Cursor math: track digit-index before the cursor, then re-find it in the
      // newly formatted string (commas shift absolute position).
      const applyLiveFormat = () => {
        const cursor = amountInput.selectionStart;
        const oldVal = amountInput.value;

        // How many digits sit before the cursor in the current (possibly formatted) value
        const digitsBeforeCursor = oldVal
          .slice(0, cursor)
          .replace(/[^0-9]/g, "").length;

        const MAX_AMOUNT = 99999999;
        const raw = oldVal.replace(/[^0-9]/g, "");
        if (!raw) {
          amountInput.value = "";
          syncPlanDetailAmountHint();
          return;
        }

        const clamped = Math.min(parseInt(raw, 10), MAX_AMOUNT);
        const formatted = clamped.toLocaleString("en-US");
        amountInput.value = formatted;
        syncPlanDetailAmountHint();

        // Walk the formatted string to find the new cursor position
        let newCursor = 0;
        let digitsSeen = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (digitsSeen === digitsBeforeCursor) {
            newCursor = i;
            break;
          }
          if (formatted[i] !== ",") digitsSeen++;
          newCursor = i + 1;
        }
        amountInput.setSelectionRange(newCursor, newCursor);
      };

      const setDisplayValue = (n) => {
        amountInput.value = isNaN(n) || n <= 0 ? "" : n.toLocaleString("en-US");
      };

      // Set initial formatted value
      const initialRaw = parseInt(amountInput.value.replace(/[^0-9]/g, ""), 10);
      setDisplayValue(initialRaw);
      syncPlanDetailAmountHint();
      syncDetailBreakdownLinkState();

      const amountRow = amountInput.closest(".plan-detail-panel__amount-row");
      if (amountRow) {
        amountRow.addEventListener("click", (e) => {
          if (e.target.closest(".plan-detail-panel__currency-pill")) return;
          if (e.target.closest("input")) return;
          amountInput.focus();
          document.dispatchEvent(new CustomEvent("fake-keyboard-show"));
        });
      }

      amountInput.addEventListener("focus", () => {
        const labelEl = amountInput
          .closest(".plan-detail-panel__amount-section")
          ?.querySelector(".plan-detail-panel__section-label");
        //scrollPlanDetailContentTo(labelEl, 0);
      });

      // Input: reformat live + update return
      amountInput.addEventListener("input", () => {
        applyLiveFormat();
        syncPlanDetailAmountHint();
        updateDetailReturn();
        panel._planDetailAllocRefreshAmounts?.();
        panel._planDetailAutoAllocRefreshAmounts?.();
        const bp = document.querySelector("[data-plan-breakdown-panel]");
        if (bp?.classList.contains("is-open")) planBreakdownApi.sync();
        const op = panel.querySelector("[data-plan-overview-panel]");
        if (op?.classList.contains("is-open")) planOverviewApi.sync();
      });

      // Blur: handle empty/invalid
      amountInput.addEventListener("blur", () => {
        const raw = parseInt(amountInput.value.replace(/[^0-9]/g, ""), 10);
        if (!isNaN(raw) && raw > 0) {
          setDisplayValue(raw);
        } else {
          // Keep 0/empty as empty; do not repopulate from the main page slider.
          amountInput.value = "";
        }
        syncPlanDetailAmountHint();
        updateDetailReturn();
        panel._planDetailAllocRefreshAmounts?.();
        panel._planDetailAutoAllocRefreshAmounts?.();
        const bp = document.querySelector("[data-plan-breakdown-panel]");
        if (bp?.classList.contains("is-open")) planBreakdownApi.sync();
        const op = panel.querySelector("[data-plan-overview-panel]");
        if (op?.classList.contains("is-open")) planOverviewApi.sync();
      });

      // Block non-numeric keys (commas are inserted programmatically, not typed)
      amountInput.addEventListener("keydown", (e) => {
        const allowed = [
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Enter",
          "Home",
          "End",
        ];
        if (allowed.includes(e.key)) return;
        if (e.ctrlKey || e.metaKey) return;
        if (!/^\d$/.test(e.key)) e.preventDefault();
      });
    }

    // Repeats card: collapsible "Details" (coverage rows) — Figma 8527:4738 / 8527:4757
    const detailsCollapse = panel.querySelector(
      "[data-plan-detail-details-collapse]",
    );
    const detailsToggle = panel.querySelector(
      "[data-plan-detail-details-toggle]",
    );
    const detailsChevron = panel.querySelector(
      "[data-plan-detail-details-chevron]",
    );
    if (detailsCollapse && detailsToggle && detailsChevron) {
      detailsToggle.addEventListener("click", () => {
        const expanded = detailsCollapse.classList.toggle(
          "plan-detail-panel__details-collapse--expanded",
        );
        detailsToggle.setAttribute(
          "aria-expanded",
          expanded ? "true" : "false",
        );
        detailsChevron.setAttribute(
          "src",
          expanded
            ? "assets/icon_chevron_up_white.svg"
            : "assets/icon_chevron_down_white.svg",
        );
      });
    }

    document.addEventListener("plan-schedule-confirmed", () => {
      syncPlanDetailSetLimitDetailRowsVisibility();
    });

    // ── Currency pill: trigger the shared investment currency bottom sheet ────
    // The pill already has data-currency-sheet-trigger="plan" in HTML, so
    // initCurrencySheet() will wire it up automatically. We only need to ensure
    // the panel's currency label and icon stay in sync after the sheet closes.
    // We hook into the existing updatePlanCurrencyUI by extending it.
    const _origUpdatePlanCurrencyUI =
      typeof updatePlanCurrencyUI === "function" ? updatePlanCurrencyUI : null;
    if (_origUpdatePlanCurrencyUI) {
      // Patch: after the main UI updates, also refresh the panel's currency pill + icon
      const origRef = updatePlanCurrencyUI;
      // Override at the outer closure level isn't possible here, so observe via MutationObserver
      const planCurrencyLabelMain = document.querySelector(
        "[data-plan-currency-label]",
      );
      if (planCurrencyLabelMain) {
        const obs = new MutationObserver(() => {
          const cur = planCurrencyLabelMain.textContent.trim();
          const detailCur = panel.querySelector("[data-plan-detail-currency]");
          const detailIcon = panel.querySelector(
            "[data-plan-detail-amount-icon]",
          );
          if (detailCur) detailCur.textContent = cur;
          if (detailIcon)
            detailIcon.src =
              cur === "USDT"
                ? "assets/icon_currency_usdt.svg"
                : "assets/icon_currency_TWD.svg";
          updateCoverageUI();
          syncPlanDetailAmountHint();
          panel._planDetailAllocRefreshAmounts?.();
          panel._planDetailAutoAllocRefreshAmounts?.();
        });
        obs.observe(planCurrencyLabelMain, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
    }
  };

  let financeModulesInited = false;
  ensureFinanceModulesInited = () => {
    if (financeModulesInited) return;
    financeModulesInited = true;
    initFinanceSectionNav();
    initFinanceEarnPage();
    initPlanStrategySlider();
    initPlanStrategyFreq();
    void initPlanStrategyCarousel();
    initCurrencySheet();
    applyFinanceSummaryMeta();
    initRangeSheet();
    initPlanBufferAutofillSheet();
    initSmartAllocInfoSheet();
    initPlanDetailHistoricPerfInfoSheet();
    initScheduleBuyNowInfoSheet();
    initFinanceSummaryInfoSheets();
    initPlanOverviewFundingInfoSheet();
    initMyPlansPrefundDetailSheets();
    initTopupSheet();
    initScheduleSheet();
    initScheduleTimePicker();
    initScheduleEndFollowupSheets();
    document
      .querySelector("[data-prototype-bottomsheet-stacking]")
      ?.addEventListener("change", () => {
        resetScheduleNestedScrimHard();
      });
    syncPrototypeScheduleBuyNowRowVisible();
    syncPrototypeFundingAmountPeriodSegVisible();
    syncPrototypeFinanceCurrencySelectorVisible();
    syncPrototypePrefundLogToDocument();
    initPlanDetailPanel({
      goFinanceAutoInvest,
      openMyPlansAfterPlanFlow: () => {
        myPlansPanelApi.open({ fromPlanSuccessView: true });
      },
    });
    initFinanceIntroLearnMorePanel();
    initFinanceIntroStateControls();
    initFinanceAutoStickyCta();
  };

  initPrototypeReset();
  syncPrototypeFinanceCurrencySelectorVisible();

  // Drag-to-scroll for spotlight crypto grid.
  // Uses document-level move/up listeners (NOT pointer capture) so that:
  //   a) dragging continues smoothly when the pointer leaves the element, and
  //   b) child .crypto-pill click events are never swallowed by capture.
  const spotlightScroll = document.querySelector(".spotlight__scroll");
  if (spotlightScroll) {
    const DRAG_THRESHOLD = 6; // px of movement before we call it a drag
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let didDrag = false;

    spotlightScroll.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      isDown = true;
      startX = e.clientX;
      scrollLeft = spotlightScroll.scrollLeft;
      didDrag = false;
      spotlightScroll.classList.add("is-dragging");
    });

    document.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const delta = startX - e.clientX;
      if (Math.abs(delta) > DRAG_THRESHOLD) {
        didDrag = true;
        spotlightScroll.scrollLeft = scrollLeft + delta;
      }
    });

    const stopDrag = () => {
      if (!isDown) return;
      isDown = false;
      spotlightScroll.classList.remove("is-dragging");
      // Reset after the click event has had a chance to fire
      setTimeout(() => {
        didDrag = false;
      }, 50);
    };

    document.addEventListener("pointerup", stopDrag);
    document.addEventListener("pointercancel", stopDrag);

    // Expose drag state for pill click guard
    spotlightScroll._getDidDrag = () => didDrag;
  }

  const initHeaderScrollSwap = () => {
    const header = document.querySelector(".app-header");
    const topChrome = document.querySelector(".top-chrome");
    const scroller = document.querySelector(".content");
    if (!header || !scroller) return;

    let isScrolled = false;
    let ticking = false;
    const threshold = 4;

    const apply = () => {
      const shouldBeScrolled = scroller.scrollTop > threshold;
      if (shouldBeScrolled !== isScrolled) {
        isScrolled = shouldBeScrolled;
        header.classList.toggle("is-scrolled", isScrolled);
        if (topChrome) topChrome.classList.toggle("is-scrolled", isScrolled);
      }
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    apply();
  };

  initHeaderScrollSwap();

  const initFinanceIntroLearnMorePanel = () => {
    const triggers = Array.from(
      document.querySelectorAll(
        ".finance-intro__link:not(.finance-loan-hero__link)",
      ),
    );
    const panelEl = document.querySelector(
      "[data-finance-intro-learn-more-panel]",
    );
    if (!triggers.length || !panelEl) return;
    const titleEl = panelEl.querySelector(
      "[data-finance-intro-learn-more-title]",
    );
    const descEl = panelEl.querySelector(
      "[data-finance-intro-learn-more-desc]",
    );
    const visualEl = panelEl.querySelector(
      "[data-finance-intro-learn-more-visual]",
    );
    const stepEls = Array.from(
      panelEl.querySelectorAll("[data-finance-intro-step]"),
    );
    const backBtn = panelEl.querySelector(
      "[data-finance-intro-learn-more-back]",
    );
    const nextBtn = panelEl.querySelector(
      "[data-finance-intro-learn-more-next]",
    );
    const slides = [
      {
        title: "Invest automatically: the easiest way to dollar-cost average",
        desc: "Set a fixed amount and invest on a schedule. No need to time the market, just stay consistent.",
        visual: "assets/featureintro_1.png",
      },
      {
        title:
          "Choose assets like Bitcoin, from themes like AI, or build your own!",
        desc: "Pick a single asset, or mix multiple assets and set your own allocation for each — you set the rules.",
        visual: "assets/featureintro_2.png",
      },
      {
        title: "Choose how to fund your plan: flexibly or in advance",
        desc: "Pay each time from your wallet, or pre-fund your plan to keep it running automatically. You’re always in control.",
        visual: "assets/featureintro_3.png",
      },
    ];
    let activeStep = 0;

    const renderStep = () => {
      const safe = Math.max(0, Math.min(slides.length - 1, activeStep));
      activeStep = safe;
      const slide = slides[safe];
      if (titleEl) titleEl.textContent = slide.title;
      if (descEl) descEl.textContent = slide.desc;
      if (visualEl && slide.visual) visualEl.setAttribute("src", slide.visual);
      stepEls.forEach((el, idx) =>
        el.classList.toggle("is-active", idx === safe),
      );
      if (backBtn) {
        backBtn.hidden = false;
        backBtn.disabled = false;
        backBtn.textContent = safe === 0 ? "Cancel" : "Back";
      }
      if (nextBtn)
        nextBtn.classList.remove("finance-intro-learn-more-panel__btn--full");
      if (nextBtn)
        nextBtn.textContent = safe === slides.length - 1 ? "Done" : "Next";
    };

    const open = () => {
      activeStep = 0;
      renderStep();
      panelEl.hidden = false;
      requestAnimationFrame(() => panelEl.classList.add("is-open"));
      document.dispatchEvent(
        new CustomEvent("finance-intro-learn-more-opened"),
      );
    };

    const close = (opts = {}) => {
      if (opts.instant) {
        panelEl.classList.remove("is-open");
        panelEl.hidden = true;
        return;
      }
      panelEl.classList.remove("is-open");
      const onEnd = () => {
        if (!panelEl.classList.contains("is-open")) panelEl.hidden = true;
        panelEl.removeEventListener("transitionend", onEnd);
      };
      panelEl.addEventListener("transitionend", onEnd);
      setTimeout(onEnd, 380);
    };

    triggers.forEach((trigger) => trigger.addEventListener("click", open));

    document
      .querySelectorAll("[data-finance-intro-open-learn-more]")
      .forEach((surface) => {
        surface.addEventListener("click", (e) => {
          if (e.target.closest("[data-finance-intro-dismiss]")) return;
          if (e.target.closest(".finance-intro__link")) return;
          open();
        });
      });
    backBtn?.addEventListener("click", () => {
      if (activeStep <= 0) {
        close();
        return;
      }
      activeStep -= 1;
      renderStep();
    });
    nextBtn?.addEventListener("click", () => {
      if (activeStep >= slides.length - 1) {
        close();
        return;
      }
      activeStep += 1;
      renderStep();
    });
    panelEl
      .querySelectorAll("[data-finance-intro-learn-more-close]")
      .forEach((btn) => btn.addEventListener("click", () => close()));
  };

  const initFinanceIntroStateControls = () => {
    let forceToCompactTimer = null;
    let dismissAnimating = false;
    const introEl = document.querySelector(".finance-intro");
    const firstStateEl = document.querySelector(
      '[data-finance-intro-state="1"]',
    );
    const compactStateEl = document.querySelector(
      '[data-finance-intro-state="2"]',
    );
    document
      .querySelector("[data-finance-intro-dismiss]")
      ?.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dismissAnimating) return;
        dismissAnimating = true;

        const roundPx = (n) => Math.max(0, Math.round(Number(n) || 0));
        const firstHeight = roundPx(
          firstStateEl?.getBoundingClientRect().height,
        );
        let compactHeight = firstHeight;

        if (introEl && firstHeight > 0) {
          introEl.style.height = `${firstHeight}px`;
          introEl.classList.add("is-transitioning");
          // Force sync layout so height transition runs on next write.
          void introEl.offsetHeight;
        }

        if (compactStateEl) {
          const wasHidden = compactStateEl.hidden;
          const prevStyle = compactStateEl.getAttribute("style") || "";
          compactStateEl.hidden = false;
          compactStateEl.style.visibility = "hidden";
          compactStateEl.style.pointerEvents = "none";
          compactHeight =
            roundPx(compactStateEl.getBoundingClientRect().height) ||
            firstHeight;
          if (wasHidden) compactStateEl.hidden = true;
          if (prevStyle) compactStateEl.setAttribute("style", prevStyle);
          else compactStateEl.removeAttribute("style");
        }

        setState("financeIntro", 2, { force: true });
        if (introEl && compactHeight > 0) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              introEl.style.height = `${compactHeight}px`;
            });
          });
        }

        let finishFallbackTimer = 0;
        let teardownDone = false;
        const onHeightTransitionEnd = (e) => {
          if (e.target !== introEl || e.propertyName !== "height") return;
          window.clearTimeout(finishFallbackTimer);
          finishDismiss();
        };
        const finishDismiss = () => {
          if (teardownDone) return;
          teardownDone = true;
          if (introEl) {
            introEl.removeEventListener("transitionend", onHeightTransitionEnd);
            introEl.classList.remove("is-transitioning");
            introEl.style.height = "";
          }
          dismissAnimating = false;
        };
        if (introEl)
          introEl.addEventListener("transitionend", onHeightTransitionEnd);
        // Match .finance-intro.is-transitioning height duration (0.26s) + small buffer
        finishFallbackTimer = window.setTimeout(finishDismiss, 360);
      });
    document.addEventListener("finance-intro-learn-more-opened", () => {
      const firstVisible = document.querySelector(
        '[data-finance-intro-state="1"]',
      );
      if (!firstVisible || firstVisible.hidden) return;
      if (forceToCompactTimer) clearTimeout(forceToCompactTimer);
      forceToCompactTimer = setTimeout(() => {
        setState("financeIntro", 2, { force: true });
      }, 260);
    });
  };

  const initFinanceAutoStickyCta = () => {
    const stickyWrap = document.querySelector("[data-finance-auto-sticky-cta]");
    const stickyBtn = stickyWrap?.querySelector(
      "[data-finance-auto-sticky-new-plan]",
    );
    const contentEl = document.querySelector("[data-content]");
    const container = document.querySelector(".phone-container");
    if (!stickyWrap || !stickyBtn || !contentEl || !container) return;

    const isFinanceAutoActive = () =>
      document.documentElement.dataset.activeTab === "finance" &&
      document.documentElement.dataset.financePage === "auto";

    let stickyShouldBeVisible = false;
    const setStickyVisible = (visible) => {
      stickyShouldBeVisible = !!visible;
      if (stickyShouldBeVisible) {
        if (stickyWrap.hidden) stickyWrap.hidden = false;
        requestAnimationFrame(() => {
          if (stickyShouldBeVisible) stickyWrap.classList.add("is-visible");
        });
        return;
      }
      stickyWrap.classList.remove("is-visible");
    };

    stickyWrap.addEventListener("transitionend", (e) => {
      if (e.propertyName !== "opacity") return;
      if (!stickyShouldBeVisible) stickyWrap.hidden = true;
    });

    const syncSticky = () => {
      const actionsEl = document.querySelector(
        '[data-finance-page="auto"] .finance-summary__actions',
      );
      if (
        !actionsEl ||
        !isFinanceAutoActive() ||
        container.classList.contains("is-plan-detail-open")
      ) {
        setStickyVisible(false);
        return;
      }
      const threshold = actionsEl.offsetTop + actionsEl.offsetHeight + 8;
      setStickyVisible(contentEl.scrollTop > threshold);
    };

    stickyBtn.addEventListener("click", () => {
      document
        .querySelector('[data-finance-page="auto"] [data-finance-new-plan]')
        ?.click();
      setStickyVisible(false);
    });

    contentEl.addEventListener("scroll", syncSticky, { passive: true });
    window.addEventListener("resize", syncSticky, { passive: true });
    document
      .querySelectorAll("[data-tab-target], [data-finance-header-tab]")
      .forEach((btn) => {
        btn.addEventListener("click", () => requestAnimationFrame(syncSticky));
      });

    const classObserver = new MutationObserver(() => syncSticky());
    classObserver.observe(container, {
      attributes: true,
      attributeFilter: ["class"],
    });

    syncSticky();
  };

  const initSideMenu = () => {
    const container = document.querySelector(".phone-container");
    const trigger = document.querySelector("[data-menu-trigger]");
    const overlay = document.querySelector(".side-menu-overlay");
    const scrollable = document.querySelector(".side-menu__content");
    if (!container || !trigger || !overlay) return;

    let snackbarTimeout = null;

    const showSnackbar = (message) => {
      const snackbar = container?.querySelector("[data-snackbar]");
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

    const openMenu = () => {
      container.classList.add("is-menu-open");
      if (scrollable) scrollable.scrollTop = 0;
    };
    const closeMenu = () => container.classList.remove("is-menu-open");

    trigger.addEventListener("click", () => {
      openMenu();
    });
    overlay.addEventListener("click", (event) => {
      if (event.target.closest("[data-menu-close]")) closeMenu();
    });

    document.querySelectorAll("[data-side-menu-not-in-prototype]").forEach((item) => {
      item.addEventListener("click", () => showSnackbar("Not in prototype"));
    });
  };

  initSideMenu();

  /** Desktop viewport only: sliding fake keyboards (Convert + allocation picker). */
  const initFakeKeyboard = () => {
    const container = document.querySelector(".phone-container");
    const convertKeyboard = document.querySelector('[data-fake-keyboard="convert"]');
    const allocKeyboard = document.querySelector(
      '[data-fake-keyboard="alloc-picker"]',
    );
    if (!container || !convertKeyboard) return;

    const keyboardPreviewBtn = convertKeyboard.querySelector(
      "[data-fake-keyboard-preview]",
    );
    const keyboardPctBtns = Array.from(
      convertKeyboard.querySelectorAll("[data-fake-keyboard-pct]"),
    );
    const allocKbHeading = allocKeyboard?.querySelector(
      "[data-fake-keyboard-alloc-heading]",
    );
    const allocKbChips = allocKeyboard?.querySelector(
      "[data-fake-keyboard-alloc-chips]",
    );
    const allocSearchInput = document.querySelector("[data-alloc-picker-search]");

    const mq = window.matchMedia("(min-width: 641px)");
    let suppressFocusShow = false;

    const isOnConvertPage = () =>
      String(document.documentElement.dataset.activeTab || "") === "trade" &&
      String(document.documentElement.dataset.tradePage || "") === "convert";

    const isConvertKeyboardField = (el) =>
      !!(
        el &&
        el.closest('[data-trade-page="convert"]') &&
        (el.matches(
          "[data-trade-convert-pay-input], [data-trade-convert-recv-input]",
        ) ||
          el.closest(".trade-convert-page__amount-row"))
      );

    const syncConvertKeyboardPctWrap = () => {};

    const isAllocPickerSearchField = (el) =>
      !!(
        el?.matches?.("[data-alloc-picker-search]") &&
        el.closest("[data-alloc-picker-panel].is-open")
      );

    const hideAllocKeyboard = () => {
      if (!allocKeyboard) return;
      allocKeyboard.classList.remove("is-visible");
      allocKeyboard.setAttribute("aria-hidden", "true");
      allocKeyboard.hidden = true;
      container.classList.remove("is-fake-keyboard-alloc-visible");
    };

    const syncAllocKeyboardSticky = () => {
      if (!allocKeyboard || !allocKbHeading || !allocKbChips) return;
      const headingEl = document.querySelector(
        "[data-alloc-picker-selected-heading]",
      );
      const chipsEl = document.querySelector("[data-alloc-picker-chips]");
      if (headingEl) allocKbHeading.textContent = headingEl.textContent || "";
      allocKbChips.replaceChildren();
      if (chipsEl) {
        chipsEl.querySelectorAll("[data-alloc-picker-chip-key]").forEach((chip) => {
          allocKbChips.appendChild(chip.cloneNode(true));
        });
      }
      const hasChips = allocKbChips.childElementCount > 0;
      allocKbChips.hidden = !hasChips;
    };

    const scrollConvertToTop = () => {
      if (!isOnConvertPage()) return;
      const scroller = document.querySelector("[data-content]");
      if (!scroller) return;
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    };

    const hideConvertKeyboard = (opts = {}) => {
      const wasVisible = convertKeyboard.classList.contains("is-visible");
      convertKeyboard.classList.remove("is-visible");
      convertKeyboard.setAttribute("aria-hidden", "true");
      if (!wasVisible) return;
      if (opts.scrollToTop === false) {
        container.classList.remove(
          "is-fake-keyboard-visible",
          "is-fake-keyboard-dismissing",
        );
        return;
      }
      container.classList.add("is-fake-keyboard-dismissing");
      scrollConvertToTop();
      setTimeout(() => {
        container.classList.remove(
          "is-fake-keyboard-visible",
          "is-fake-keyboard-dismissing",
        );
      }, 220);
    };

    const hideAllKeyboards = (opts = {}) => {
      hideAllocKeyboard();
      hideConvertKeyboard(opts);
    };

    const showAllocKeyboard = () => {
      if (!mq.matches || !allocKeyboard) return;
      if (!allocSearchInput?.closest("[data-alloc-picker-panel].is-open")) return;
      hideConvertKeyboard({ scrollToTop: false });
      syncAllocKeyboardSticky();
      allocKeyboard.hidden = false;
      allocKeyboard.classList.add("is-visible");
      allocKeyboard.setAttribute("aria-hidden", "false");
      container.classList.add("is-fake-keyboard-alloc-visible");
    };

    const showConvertKeyboard = () => {
      if (!mq.matches || !isOnConvertPage()) return;
      hideAllocKeyboard();
      container.classList.remove("is-fake-keyboard-dismissing");
      container.classList.add("is-fake-keyboard-visible");
      convertKeyboard.classList.add("is-visible");
      convertKeyboard.setAttribute("aria-hidden", "false");
      syncConvertKeyboardPctWrap();
    };

    container.addEventListener("focusin", (e) => {
      if (!mq.matches || suppressFocusShow) return;
      if (isAllocPickerSearchField(e.target)) return;
      if (isConvertKeyboardField(e.target) && isOnConvertPage()) {
        showConvertKeyboard();
        syncConvertKeyboardPctWrap();
      }
    });

    convertKeyboard
      .querySelector("[data-fake-keyboard-close]")
      ?.addEventListener("click", () => {
        hideConvertKeyboard();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });

    allocKeyboard
      ?.querySelector("[data-fake-keyboard-alloc-close]")
      ?.addEventListener("click", () => {
        hideAllocKeyboard();
        allocSearchInput?.blur();
      });

    keyboardPreviewBtn?.addEventListener("click", () => {
      hideConvertKeyboard({ scrollToTop: false });
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      document.dispatchEvent(new CustomEvent("auth-signup-open"));
    });

    const setPctActiveState = (selectedPct) => {
      keyboardPctBtns.forEach((b) => {
        const btnPct = Number(b.getAttribute("data-fake-keyboard-pct"));
        const isActive = Number.isFinite(btnPct) && btnPct <= selectedPct;
        b.classList.toggle("is-active", isActive);
        b.classList.remove("is-active-start", "is-active-end");
      });
      const activeBtns = keyboardPctBtns.filter((b) =>
        b.classList.contains("is-active"),
      );
      if (activeBtns.length > 0) {
        activeBtns[0].classList.add("is-active-start");
        activeBtns[activeBtns.length - 1].classList.add("is-active-end");
      }
    };

    const getConvertPayContext = () => {
      const root = document.querySelector("[data-trade-convert-root]");
      const payInp = root?.querySelector("[data-trade-convert-pay-input]");
      const payCode = (
        root?.querySelector("[data-trade-convert-pay-currency]")?.textContent ||
        "TWD"
      )
        .trim()
        .toUpperCase();
      const avail = Number(PROTOTYPE_BALANCES[payCode]);
      return { payInp, payCode, avail };
    };

    const getAmountForPct = (avail, payCode, pct) => {
      let next = (avail * pct) / 100;
      if (payCode === "BTC") next = Math.round(next * 1e6) / 1e6;
      else next = Math.round(next * 100) / 100;
      return next;
    };

    const getMatchedPctForPayInput = () => {
      const { payInp, payCode, avail } = getConvertPayContext();
      if (!payInp || !Number.isFinite(avail) || avail <= 0) return null;
      const typed = Number((payInp.value || "").replace(/,/g, "").trim());
      if (!Number.isFinite(typed) || typed <= 0) return null;
      const pctOptions = [25, 50, 75, 100];
      return (
        pctOptions.find((pct) => {
          const target = getAmountForPct(avail, payCode, pct);
          return Math.abs(typed - target) < 1e-9;
        }) ?? null
      );
    };

    const syncPctStateFromPayInput = () => {
      const matchedPct = getMatchedPctForPayInput();
      setPctActiveState(matchedPct ?? 0);
    };

    keyboardPctBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!isOnConvertPage()) return;
        const pct = Number(btn.getAttribute("data-fake-keyboard-pct"));
        if (!Number.isFinite(pct) || pct <= 0) return;
        setPctActiveState(pct);
        const { payInp, payCode, avail } = getConvertPayContext();
        if (!payInp) return;
        if (!Number.isFinite(avail) || avail <= 0) {
          payInp.value = "";
          payInp.dispatchEvent(new Event("input", { bubbles: true }));
          return;
        }
        const next = getAmountForPct(avail, payCode, pct);
        payInp.value = next > 0 ? String(next) : "";
        payInp.focus();
        payInp.dispatchEvent(new Event("input", { bubbles: true }));
      });
    });

    getConvertPayContext().payInp?.addEventListener("input", syncPctStateFromPayInput);
    syncPctStateFromPayInput();

    const appendAllocSearchChar = (ch) => {
      if (!allocSearchInput) return;
      allocSearchInput.value = `${allocSearchInput.value || ""}${ch}`;
      allocSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
      allocSearchInput.focus();
    };

    allocKeyboard
      ?.querySelectorAll("[data-fake-keyboard-char]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          const ch = btn.getAttribute("data-fake-keyboard-char");
          if (ch) appendAllocSearchChar(ch);
        });
      });

    allocKeyboard
      ?.querySelector('[data-fake-keyboard-action="space"]')
      ?.addEventListener("click", () => appendAllocSearchChar(" "));

    allocKeyboard
      ?.querySelector('[data-fake-keyboard-action="delete"]')
      ?.addEventListener("click", () => {
        if (!allocSearchInput) return;
        allocSearchInput.value = String(allocSearchInput.value || "").slice(0, -1);
        allocSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
        allocSearchInput.focus();
      });

    allocKeyboard
      ?.querySelector('[data-fake-keyboard-action="go"]')
      ?.addEventListener("click", () => {
        hideAllocKeyboard();
        allocSearchInput?.blur();
      });

    document.addEventListener("pointerdown", (e) => {
      if (!mq.matches) return;
      const convertOpen = convertKeyboard.classList.contains("is-visible");
      const allocOpen = allocKeyboard?.classList.contains("is-visible");
      if (!convertOpen && !allocOpen) return;
      if (e.target instanceof Element) {
        if (convertKeyboard.contains(e.target)) return;
        if (allocKeyboard?.contains(e.target)) return;
        if (e.target.closest(".trade-convert-page__amount-row")) return;
        if (e.target.closest(".alloc-picker-panel__search-wrap")) return;
      }

      suppressFocusShow = true;
      hideAllKeyboards(
        convertOpen ? {} : { scrollToTop: false },
      );
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      requestAnimationFrame(() => {
        suppressFocusShow = false;
      });
    });

    const onMqChange = () => {
      if (!mq.matches) hideAllKeyboards({ scrollToTop: false });
    };

    document.addEventListener("trade-page-changed", (e) => {
      if (e?.detail?.pageId !== "convert")
        hideConvertKeyboard({ scrollToTop: false });
    });

    new MutationObserver(() => {
      if (
        String(document.documentElement.dataset.activeTab || "") !== "trade"
      ) {
        hideAllKeyboards({ scrollToTop: false });
      }
    }).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-active-tab"],
    });

    document.addEventListener("fake-keyboard-show", () => {
      if (isOnConvertPage()) showConvertKeyboard();
    });
    document.addEventListener("fake-keyboard-hide", () => {
      hideConvertKeyboard({ scrollToTop: false });
    });
    document.addEventListener("fake-keyboard-alloc-show", showAllocKeyboard);
    document.addEventListener("fake-keyboard-alloc-hide", hideAllocKeyboard);
    document.addEventListener("fake-keyboard-alloc-sync", syncAllocKeyboardSticky);

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", onMqChange);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(onMqChange);
    }
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => initFakeKeyboard(), { timeout: 2500 });
  } else {
    setTimeout(() => initFakeKeyboard(), 1);
  }

  try {
    window.prototypeStates = {
      get: (group) => states[group],
      set: (group, value) => setState(group, value),
      change: (group, delta) => changeState(group, delta),
      label: (group, value) => getLabel(group, value),
      setPrefundLog: (v) => setPrototypePrefundLog(v),
      getPrefundLog: () => getPrototypePrefundLog(),
    };
  } catch (_) {
    // ignore exposure errors
  }
})();
