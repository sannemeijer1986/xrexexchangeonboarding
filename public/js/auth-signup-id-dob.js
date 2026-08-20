/**
 * Date of birth field — ID details step (Gregorian YYYY MM DD, StatusSlot).
 */
(function () {
  const ROC_EPOCH = 1911;
  const MIN_AGE = 18;

  const pad2 = (n) => String(parseInt(n, 10)).padStart(2, "0");
  const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const parsePastedDate = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return null;

    let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
      return {
        yearRaw: match[1],
        month: pad2(match[2]),
        day: pad2(match[3]),
        calendar: "gregorian",
      };
    }

    match = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return {
        yearRaw: match[1],
        month: match[2],
        day: match[3],
        calendar: "gregorian",
      };
    }

    match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (match) {
      return {
        yearRaw: match[3],
        month: pad2(match[1]),
        day: pad2(match[2]),
        calendar: "gregorian",
      };
    }

    return null;
  };

  const detectCalendarFromYearRaw = (yearRaw) => {
    const digits = onlyDigits(yearRaw);
    if (!digits) return { calendar: "gregorian", gregorianYear: null };
    if (digits.length <= 3) {
      const roc = parseInt(digits, 10);
      if (Number.isNaN(roc)) return { calendar: "roc", gregorianYear: null };
      return { calendar: "roc", gregorianYear: roc + ROC_EPOCH };
    }
    const gy = parseInt(digits, 10);
    return {
      calendar: "gregorian",
      gregorianYear: Number.isNaN(gy) ? null : gy,
    };
  };

  const resolveGregorianYear = (yearRaw, calendar) => {
    const digits = onlyDigits(yearRaw);
    if (!digits) return null;
    if (calendar === "roc") {
      if (digits.length === 4) return null;
      const roc = parseInt(digits, 10);
      return Number.isNaN(roc) ? null : roc + ROC_EPOCH;
    }
    if (digits.length !== 4) return null;
    const gy = parseInt(digits, 10);
    return Number.isNaN(gy) ? null : gy;
  };

  const formatDisplayDate = (year, month, day) =>
    `${year}/${pad2(month)}/${pad2(day)}`;

  const getTodayStart = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const computeAge = (year, month, day) => {
    const today = getTodayStart();
    const birth = new Date(year, month - 1, day);
    let age = today.getFullYear() - birth.getFullYear();
    const md = today.getMonth() - birth.getMonth();
    if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age -= 1;
    return age;
  };

  const validateFullDate = (state) => {
    const yearRaw = onlyDigits(state.yearRaw);
    const monthRaw = onlyDigits(state.month);
    const dayRaw = onlyDigits(state.day);

    if (!yearRaw || !monthRaw || !dayRaw) {
      return { status: "idle" };
    }

    if (state.calendar === "gregorian" && yearRaw.length !== 4) {
      return { status: "idle" };
    }

    const gregorianYear = resolveGregorianYear(yearRaw, "gregorian");
    if (gregorianYear == null) {
      return { status: "idle" };
    }

    const month = parseInt(monthRaw, 10);
    if (month < 1 || month > 12) {
      return {
        status: "error",
        errorCode: "invalid_date",
        errorSegment: "month",
        message: "Enter a valid month (1–12).",
      };
    }

    const day = parseInt(dayRaw, 10);
    const maxDay = daysInMonth(gregorianYear, month);
    if (day < 1 || day > maxDay) {
      return {
        status: "error",
        errorCode: "invalid_date",
        errorSegment: "day",
        message: "Enter a valid day for this month.",
      };
    }

    const birth = new Date(gregorianYear, month - 1, day);
    const today = getTodayStart();
    if (birth > today) {
      return {
        status: "error",
        errorCode: "future",
        errorSegment: "day",
        message: "Date of birth cannot be in the future.",
      };
    }

    if (computeAge(gregorianYear, month, day) < MIN_AGE) {
      return {
        status: "error",
        errorCode: "underage",
        errorSegment: "year",
        message: "You must be 18 or older to open an account. Check the year on your ID.",
        gregorianYear,
        month,
        day,
      };
    }

    const submitValue = `${gregorianYear}-${pad2(month)}-${pad2(day)}`;
    const message = `Saved as ${formatDisplayDate(gregorianYear, month, day)}`;

    return {
      status: "confirmed",
      message,
      submitValue,
      gregorianYear,
      month,
      day,
    };
  };

  const initAuthSignupIdDob = (root, opts = {}) => {
    if (!root) {
      return {
        isValid: () => false,
        reset: () => {},
        fillDummy: () => {},
        getSubmitValue: () => "",
      };
    }

    const onValidityChange =
      typeof opts.onValidityChange === "function" ? opts.onValidityChange : () => {};
    const assetBase = opts.assetBase || "assets/";

    const yearInput = root.querySelector('[data-auth-signup-id-dob-segment="year"]');
    const monthInput = root.querySelector('[data-auth-signup-id-dob-segment="month"]');
    const dayInput = root.querySelector('[data-auth-signup-id-dob-segment="day"]');
    const yearLabel = root.querySelector("[data-auth-signup-id-dob-year-label]");
    const statusSlot = root.querySelector("[data-auth-signup-id-dob-status-slot]");
    const statusText = root.querySelector("[data-auth-signup-id-dob-status-text]");
    const statusIcon = root.querySelector("[data-auth-signup-id-dob-status-icon]");
    const segmentsWrap = root.querySelector("[data-auth-signup-id-dob-segments]");
    const prototypeFillLabel = root.querySelector("[data-auth-signup-id-dob-prototype-fill]");

    const state = {
      yearRaw: "",
      month: "",
      day: "",
      calendar: "gregorian",
      calendarSource: "manual",
      gregorianYear: null,
      status: "idle",
      errorCode: undefined,
      errorSegment: undefined,
    };

    let submitValue = "";
    let isValid = false;
    let yearFocused = false;

    const segmentInputs = [yearInput, monthInput, dayInput].filter(Boolean);

    const syncToggleUi = () => {
      if (yearLabel) {
        yearLabel.textContent = "Year";
      }
      if (yearInput) {
        yearInput.maxLength = 4;
      }
    };

    const clearSegmentErrors = () => {
      segmentInputs.forEach((input) => input.classList.remove("is-error"));
    };

    const applySegmentError = (segment) => {
      clearSegmentErrors();
      if (!segment) return;
      const map = { year: yearInput, month: monthInput, day: dayInput };
      map[segment]?.classList.add("is-error");
    };

    const syncStatusSlot = () => {
      const showSlot = state.status === "hint" || state.status === "error";

      if (!statusSlot || !statusText) return;

      statusSlot.hidden = !showSlot;
      statusSlot.classList.remove("is-hint", "is-error");
      statusSlot.removeAttribute("role");
      statusSlot.removeAttribute("aria-live");

      if (!showSlot) {
        if (statusIcon) statusIcon.hidden = true;
        statusText.textContent = "";
        return;
      }

      if (state.status === "hint") {
        statusSlot.classList.add("is-hint");
        statusSlot.setAttribute("aria-live", "polite");
        if (statusIcon) statusIcon.hidden = true;
        statusText.textContent = state.hintMessage ? `✨ ${state.hintMessage}` : "";
        return;
      }

      if (state.status === "error") {
        statusSlot.classList.add("is-error");
        statusSlot.setAttribute("role", "alert");
        if (statusIcon) {
          statusIcon.src = `${assetBase}icon_info_circle_gray.svg`;
          statusIcon.hidden = false;
        }
        statusText.textContent = state.errorMessage || "";
      }
    };

    const emitValidity = () => {
      const nextValid = state.status === "confirmed";
      if (nextValid !== isValid) {
        isValid = nextValid;
        onValidityChange(isValid);
      }
    };

    const syncUi = () => {
      syncToggleUi();
      syncStatusSlot();
      root.classList.toggle("is-error", state.status === "error");
      emitValidity();
    };

    const handleYearInput = () => {
      state.yearRaw = onlyDigits(yearInput.value).slice(0, 4);
      yearInput.value = state.yearRaw;

      if (state.status === "error" || state.status === "confirmed") {
        state.status = "idle";
        state.errorMessage = "";
        state.confirmMessage = "";
        submitValue = "";
        clearSegmentErrors();
      }

      if (state.yearRaw.length >= 4) {
        commitYear({ advanceMonth: true });
        return;
      }

      emitValidity();
    };

    const handleYearBlur = () => {
      yearFocused = false;
      const digits = onlyDigits(state.yearRaw);
      if (digits) {
        commitYear();
      } else {
        runFullValidation();
      }
    };

    const commitYear = (optsCommit = {}) => {
      const digits = onlyDigits(state.yearRaw);
      if (!digits) {
        state.gregorianYear = null;
        if (state.status !== "idle") {
          state.status = "idle";
          state.errorMessage = "";
          clearSegmentErrors();
        }
        syncUi();
        return;
      }

      state.calendar = "gregorian";
      state.gregorianYear = digits.length === 4 ? parseInt(digits, 10) : null;

      if (optsCommit.advanceMonth && monthInput) {
        focusSegment(monthInput);
      }

      runFullValidation();
    };

    const padSegmentOnBlur = (segment) => {
      if (segment === "month" && state.month.length === 1) {
        state.month = pad2(state.month);
        if (monthInput) monthInput.value = state.month;
      }
      if (segment === "day" && state.day.length === 1) {
        state.day = pad2(state.day);
        if (dayInput) dayInput.value = state.day;
      }
    };

    const runFullValidation = () => {
      const result = validateFullDate(state);
      submitValue = result.submitValue || "";

      if (result.status === "confirmed") {
        state.status = "confirmed";
        state.confirmMessage = result.message.startsWith("✓")
          ? result.message
          : `✓ ${result.message}`;
        state.gregorianYear = result.gregorianYear;
        state.errorCode = undefined;
        state.errorSegment = undefined;
        state.errorMessage = "";
        state.hintMessage = "";
        clearSegmentErrors();
        syncUi();
        return;
      }

      if (result.status === "error") {
        state.status = "error";
        state.errorCode = result.errorCode;
        state.errorSegment = result.errorSegment;
        state.errorMessage = result.message;
        state.confirmMessage = "";
        state.hintMessage = "";
        submitValue = "";
        applySegmentError(result.errorSegment);
        syncUi();
        return;
      }

      if (state.status === "error" || state.status === "confirmed") {
        state.status = "idle";
        state.errorMessage = "";
        state.confirmMessage = "";
        clearSegmentErrors();
        syncUi();
      }
    };

    const focusSegment = (input) => {
      if (!input) return;
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    };

    const focusPreviousSegment = (current) => {
      const idx = segmentInputs.indexOf(current);
      if (idx > 0) focusSegment(segmentInputs[idx - 1]);
    };

    const shouldAdvanceMonth = (monthDigits) => {
      if (!monthDigits) return false;
      if (monthDigits.length >= 2) return true;
      const month = parseInt(monthDigits, 10);
      return month >= 2 && month <= 9;
    };

    const handleMonthInput = () => {
      state.month = onlyDigits(monthInput.value).slice(0, 2);
      monthInput.value = state.month;

      if (state.status === "error" || state.status === "confirmed") {
        state.status = "idle";
        state.errorMessage = "";
        state.confirmMessage = "";
        submitValue = "";
        clearSegmentErrors();
      }

      if (shouldAdvanceMonth(state.month)) {
        focusSegment(dayInput);
      }

      emitValidity();
    };

    const handleMonthBlur = () => {
      padSegmentOnBlur("month");
      runFullValidation();
    };

    const handleDayInput = () => {
      state.day = onlyDigits(dayInput.value).slice(0, 2);
      dayInput.value = state.day;

      if (state.status === "error" || state.status === "confirmed") {
        state.status = "idle";
        state.errorMessage = "";
        state.confirmMessage = "";
        submitValue = "";
        clearSegmentErrors();
      }

      emitValidity();
    };

    const handleDayBlur = () => {
      padSegmentOnBlur("day");
      runFullValidation();
    };

    const handlePaste = (event) => {
      const parsed = parsePastedDate(event.clipboardData?.getData("text") || "");
      if (!parsed) return;

      event.preventDefault();
      state.yearRaw = parsed.yearRaw;
      state.month = parsed.month;
      state.day = parsed.day;
      state.calendar = "gregorian";
      state.calendarSource = "manual";
      state.gregorianYear = resolveGregorianYear(state.yearRaw, "gregorian");
      if (yearInput) yearInput.value = state.yearRaw;
      if (monthInput) monthInput.value = state.month;
      if (dayInput) dayInput.value = state.day;
      syncToggleUi();
      runFullValidation();
      focusSegment(dayInput || monthInput || yearInput);
    };

    const handleSegmentKeyDown = (event, input) => {
      if (event.key !== "Backspace") return;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      if (!atStart || input.value.length > 0) return;
      event.preventDefault();
      focusPreviousSegment(input);
    };

    const handleBlurLeave = (event) => {
      const next = event.relatedTarget;
      if (next && root.contains(next)) return;
      runFullValidation();
    };

    if (yearInput) {
      yearInput.addEventListener("focus", () => {
        yearFocused = true;
      });
      yearInput.addEventListener("input", handleYearInput);
      yearInput.addEventListener("blur", handleYearBlur);
      yearInput.addEventListener("keydown", (e) => handleSegmentKeyDown(e, yearInput));
      yearInput.addEventListener("paste", handlePaste);
    }

    if (monthInput) {
      monthInput.addEventListener("input", handleMonthInput);
      monthInput.addEventListener("blur", handleMonthBlur);
      monthInput.addEventListener("keydown", (e) => handleSegmentKeyDown(e, monthInput));
      monthInput.addEventListener("paste", handlePaste);
    }

    if (dayInput) {
      dayInput.addEventListener("input", handleDayInput);
      dayInput.addEventListener("blur", handleDayBlur);
      dayInput.addEventListener("keydown", (e) => handleSegmentKeyDown(e, dayInput));
      dayInput.addEventListener("paste", handlePaste);
    }

    if (segmentsWrap) {
      segmentsWrap.addEventListener("focusout", handleBlurLeave);
    }

    const fillDummy = () => {
      state.yearRaw = "1986";
      state.month = "02";
      state.day = "21";
      state.calendar = "gregorian";
      state.calendarSource = "manual";
      state.gregorianYear = 1986;
      if (yearInput) yearInput.value = state.yearRaw;
      if (monthInput) monthInput.value = state.month;
      if (dayInput) dayInput.value = state.day;
      syncToggleUi();
      runFullValidation();
    };

    const handleSegmentClick = () => {
      if (isValid) return;
      fillDummy();
    };

    if (prototypeFillLabel) {
      prototypeFillLabel.addEventListener("click", fillDummy);
    }

    segmentInputs.forEach((input) => {
      input.addEventListener("click", handleSegmentClick);
    });

    const reset = () => {
      state.yearRaw = "";
      state.month = "";
      state.day = "";
      state.calendar = "gregorian";
      state.calendarSource = "manual";
      state.gregorianYear = null;
      state.status = "idle";
      state.errorCode = undefined;
      state.errorSegment = undefined;
      state.errorMessage = "";
      state.confirmMessage = "";
      state.hintMessage = "";
      submitValue = "";
      isValid = false;
      yearFocused = false;
      segmentInputs.forEach((input) => {
        input.value = "";
        input.classList.remove("is-error");
      });
      syncUi();
      onValidityChange(false);
    };

    syncUi();

    return {
      isValid: () => isValid,
      reset,
      fillDummy,
      getSubmitValue: () => submitValue,
    };
  };

  window.initAuthSignupIdDob = initAuthSignupIdDob;
})();
