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

  const emailPage = document.querySelector("[data-auth-signup-email-page]");
  const emailField = emailPage?.querySelector("[data-auth-signup-email-field]");
  const emailInput = emailPage?.querySelector("[data-auth-signup-email-input]");
  const emailCursor = emailPage?.querySelector("[data-auth-signup-email-cursor]");
  const emailContinueBtn = emailPage?.querySelector("[data-auth-signup-email-continue]");
  const signupEmailKeyboard = document.querySelector('[data-fake-keyboard="signup-email"]');
  const keyboardContinueBtn = signupEmailKeyboard?.querySelector(
    "[data-fake-keyboard-signup-email-continue]",
  );
  const signupEmailMq = window.matchMedia("(min-width: 641px)");
  const SIGNUP_DUMMY_EMAIL = "mail@sanne.com";
  const SIGNUP_EMAIL_KEYBOARD_DELAY_MS = 350;

  const setContinueEnabled = (enabled) => {
    if (emailContinueBtn) emailContinueBtn.disabled = !enabled;
    if (keyboardContinueBtn) keyboardContinueBtn.disabled = !enabled;
  };

  const hideSignupEmailKeyboard = () => {
    if (!signupEmailKeyboard) return;
    const wasVisible = signupEmailKeyboard.classList.contains("is-visible");
    signupEmailKeyboard.classList.remove("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "true");
    if (!wasVisible) return;
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-dismissing");
    window.setTimeout(() => {
      phoneContainer?.classList.remove(
        "is-fake-keyboard-signup-email-visible",
        "is-fake-keyboard-signup-email-dismissing",
      );
    }, 360);
  };

  const showSignupEmailKeyboard = () => {
    if (!signupEmailMq.matches || !signupEmailKeyboard) return;
    phoneContainer?.classList.remove("is-fake-keyboard-signup-email-dismissing");
    signupEmailKeyboard.hidden = false;
    signupEmailKeyboard.classList.add("is-visible");
    signupEmailKeyboard.setAttribute("aria-hidden", "false");
    phoneContainer?.classList.add("is-fake-keyboard-signup-email-visible");
  };

  const resetEmailField = () => {
    if (emailInput) emailInput.value = "";
    emailField?.classList.remove("is-focused", "is-filled");
    emailCursor?.setAttribute("hidden", "");
    setContinueEnabled(false);
  };

  const focusSignupEmail = () => {
    emailField?.classList.add("is-focused");
    emailInput?.focus({ preventScroll: true });
  };

  const fillSignupEmail = () => {
    if (!emailInput || !emailField) return;
    emailInput.value = SIGNUP_DUMMY_EMAIL;
    emailField.classList.add("is-focused", "is-filled");
    emailCursor?.removeAttribute("hidden");
    setContinueEnabled(true);
    emailInput.focus({ preventScroll: true });
  };

  const closeEmailPage = () => {
    if (!emailPage || (!emailPage.classList.contains("is-open") && emailPage.hidden)) return;
    hideSignupEmailKeyboard();
    emailPage.classList.remove("is-open");
    const onEnd = () => {
      if (!emailPage.classList.contains("is-open")) {
        emailPage.hidden = true;
        resetEmailField();
      }
      emailPage.removeEventListener("transitionend", onEnd);
    };
    emailPage.addEventListener("transitionend", onEnd);
    setTimeout(onEnd, 360);
  };

  const openEmailPage = () => {
    if (!emailPage) return;
    resetEmailField();
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
    if (!emailField?.classList.contains("is-filled")) {
      fillSignupEmail();
    } else {
      focusSignupEmail();
    }
    showSignupEmailKeyboard();
  };

  if (emailPage) {
    emailPage
      .querySelector("[data-auth-signup-email-back]")
      ?.addEventListener("click", closeEmailPage);
    emailField?.addEventListener("click", handleEmailFieldInteraction);
    emailInput?.addEventListener("click", handleEmailFieldInteraction);
    emailContinueBtn?.addEventListener("click", showNotInPrototype);
    keyboardContinueBtn?.addEventListener("click", showNotInPrototype);

    signupEmailKeyboard
      ?.querySelector("[data-fake-keyboard-signup-email-close]")
      ?.addEventListener("click", hideSignupEmailKeyboard);

    signupEmailKeyboard
      ?.querySelectorAll("[data-fake-keyboard-signup-email-key]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!emailField?.classList.contains("is-filled")) {
            fillSignupEmail();
          }
          showSignupEmailKeyboard();
        });
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
