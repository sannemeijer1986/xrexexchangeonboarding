/**
 * Auth Sign up – visitor sign-up page (Figma 13256:20205).
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

  const goBack = () => {
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

  const referralSheet = document.querySelector("[data-auth-referral-sheet]");
  const referralPanel = referralSheet?.querySelector(".currency-sheet__panel");
  const referralInput = referralSheet?.querySelector("[data-auth-referral-sheet-input]");

  const openReferralSheet = () => {
    if (!referralSheet) return;
    referralSheet.hidden = false;
    if (referralInput) referralInput.value = "";
    requestAnimationFrame(() => referralSheet.classList.add("is-open"));
  };

  const closeReferralSheet = () => {
    if (!referralSheet || !referralSheet.classList.contains("is-open")) return;
    referralSheet.classList.remove("is-open");
    const onEnd = () => {
      if (!referralSheet.classList.contains("is-open")) referralSheet.hidden = true;
      referralPanel?.removeEventListener("transitionend", onEnd);
    };
    referralPanel?.addEventListener("transitionend", onEnd);
    setTimeout(onEnd, 300);
  };

  if (referralSheet) {
    referralSheet
      .querySelector("[data-auth-referral-sheet-close]")
      ?.addEventListener("click", closeReferralSheet);
    referralSheet
      .querySelector("[data-auth-referral-sheet-paste]")
      ?.addEventListener("click", showNotInPrototype);
    referralSheet
      .querySelector("[data-auth-referral-sheet-skip]")
      ?.addEventListener("click", showNotInPrototype);
    referralSheet
      .querySelector("[data-auth-referral-sheet-next]")
      ?.addEventListener("click", showNotInPrototype);
    referralInput?.addEventListener("focus", showNotInPrototype);
    referralInput?.addEventListener("click", showNotInPrototype);
  }

  document.querySelector("[data-auth-signup-back]")?.addEventListener("click", goBack);
  document.querySelector("[data-auth-signup-login]")?.addEventListener("click", goLogin);
  document
    .querySelector("[data-auth-signup-continue]")
    ?.addEventListener("click", openReferralSheet);
})();
