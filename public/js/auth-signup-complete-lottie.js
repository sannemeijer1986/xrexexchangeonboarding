/**
 * Sign-up complete page — success checkmark + celebration confetti (.lottie).
 */
const DOTLOTTIE_CDN =
  "https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.46.0/+esm";

const initAuthSignupCompleteLottie = () => {
  const page = document.querySelector("[data-auth-signup-complete-page]");
  if (!page) return null;

  const successCanvas = page.querySelector("[data-auth-signup-complete-success-canvas]");
  const confettiCanvas = page.querySelector("[data-auth-signup-complete-confetti-canvas]");
  const confettiWrap = page.querySelector("[data-auth-signup-complete-confetti]");
  const successSrc = page.dataset.lottieSuccess || "";
  const confettiSrc = page.dataset.lottieConfetti || "";

  let dotLottieModulePromise = null;
  let successPlayer = null;
  let confettiPlayer = null;
  let playersPromise = null;
  let hasPlayedThisOpen = false;

  const loadDotLottie = () => {
    if (!dotLottieModulePromise) {
      dotLottieModulePromise = import(/* webpackIgnore: true */ DOTLOTTIE_CDN);
    }
    return dotLottieModulePromise;
  };

  const createPlayer = async (canvas, src, { loop = false } = {}) => {
    if (!canvas || !src) return null;
    const { DotLottie } = await loadDotLottie();
    return new DotLottie({
      canvas,
      src,
      autoplay: false,
      loop,
      renderConfig: { autoResize: true },
    });
  };

  const ensurePlayers = () => {
    if (!playersPromise) {
      playersPromise = Promise.all([
        createPlayer(successCanvas, successSrc, { loop: false }),
        createPlayer(confettiCanvas, confettiSrc, { loop: false }),
      ]).then(([success, confetti]) => {
        successPlayer = success;
        confettiPlayer = confetti;
      });
    }
    return playersPromise;
  };

  const replay = async () => {
    await ensurePlayers();
    successPlayer?.stop();
    successPlayer?.setFrame?.(0);
    successPlayer?.play();
    if (confettiWrap) confettiWrap.hidden = false;
    confettiPlayer?.stop();
    confettiPlayer?.setFrame?.(0);
    confettiPlayer?.play();
  };

  const reset = () => {
    hasPlayedThisOpen = false;
    successPlayer?.stop();
    successPlayer?.setFrame?.(0);
    confettiPlayer?.stop();
    confettiPlayer?.setFrame?.(0);
    if (confettiWrap) confettiWrap.hidden = true;
  };

  const play = async () => {
    if (hasPlayedThisOpen) return;
    hasPlayedThisOpen = true;
    await replay();
  };

  const successTrigger = page.querySelector("[data-auth-signup-complete-success]");
  successTrigger?.addEventListener("click", () => {
    replay();
  });

  ensurePlayers().catch(() => {
    // CDN unavailable — page still works without animations.
  });

  return { play, replay, reset };
};

window.__authSignupCompleteLottie = initAuthSignupCompleteLottie();
