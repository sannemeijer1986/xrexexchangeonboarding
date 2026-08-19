/**
 * Date of birth field — ID details step (Western / ROC toggle, segmented numeric inputs).
 */
(function () {
  const ROC_EPOCH = 1911;
  const MIN_WESTERN_YEAR = 1900;

  const pad2 = (n) => String(n).padStart(2, "0");

  const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

  const getAgeBounds = () => {
    const now = new Date();
    const maxWesternYear = now.getFullYear() - 18;
    const currentRocYear = now.getFullYear() - ROC_EPOCH;
    const maxRocYear = currentRocYear - 18;
    return { maxWesternYear, maxRocYear, currentRocYear };
  };

  const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

  const parsePastedDate = (text) => {
    const raw = String(text || "").trim();
    if (!raw) return null;

    let match = raw.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
      return { year: match[1], month: pad2(parseInt(match[2], 10)), day: pad2(parseInt(match[3], 10)) };
    }

    match = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return { year: match[1], month: match[2], day: match[3] };
    }

    match = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (match) {
      return {
        year: match[3],
        month: pad2(parseInt(match[1], 10)),
        day: pad2(parseInt(match[2], 10)),
      };
    }

    return null;
  };

  const toWesternYear = (yearDigits, calendar) => {
    if (!yearDigits) return null;
    const parsed = parseInt(yearDigits, 10);
    if (Number.isNaN(parsed)) return null;
    if (calendar === "western") {
      if (yearDigits.length !== 4) return null;
      return parsed;
    }
    if (yearDigits.length === 4) return null;
    if (yearDigits.length < 1) return null;
    return parsed + ROC_EPOCH;
  };

  const toRocDisplay = (westernYear) => {
    if (westernYear == null) return "";
    return String(westernYear - ROC_EPOCH);
  };

  const toWesternDisplay = (westernYear) => {
    if (westernYear == null) return "";
    return String(westernYear);
  };

  const convertYearDigitsForCalendar = (yearDigits, fromCalendar, toCalendar) => {
    if (!yearDigits) return "";
    if (fromCalendar === toCalendar) return yearDigits;

    const western = toWesternYear(yearDigits, fromCalendar);
    if (western == null) {
      if (fromCalendar === "roc" && yearDigits.length === 4) return yearDigits;
      return yearDigits;
    }

    return toCalendar === "roc" ? toRocDisplay(western) : toWesternDisplay(western);
  };

  const validate = (state) => {
    const { maxWesternYear, maxRocYear } = getAgeBounds();
    const yearDigits = onlyDigits(state.year);
    const monthDigits = onlyDigits(state.month);
    const dayDigits = onlyDigits(state.day);

    if (!yearDigits && !monthDigits && !dayDigits) {
      return { valid: false, error: "" };
    }

    if (state.calendar === "roc" && yearDigits.length === 4) {
      return {
        valid: false,
        error: "That looks like a Western year — switch to 西元 or enter a 民國 year",
      };
    }

    const westernYear = toWesternYear(yearDigits, state.calendar);
    if (westernYear == null) {
      return { valid: false, error: "" };
    }

    if (state.calendar === "western") {
      if (yearDigits.length !== 4) return { valid: false, error: "" };
      if (westernYear < MIN_WESTERN_YEAR || westernYear > maxWesternYear) {
        return { valid: false, error: `Enter a year between ${MIN_WESTERN_YEAR} and ${maxWesternYear}` };
      }
    } else {
      const rocYear = parseInt(yearDigits, 10);
      if (rocYear < 1 || rocYear > maxRocYear) {
        return { valid: false, error: `Enter a 民國 year between 1 and ${maxRocYear}` };
      }
    }

    if (!monthDigits) return { valid: false, error: "" };
    const month = parseInt(monthDigits, 10);
    if (month < 1 || month > 12) {
      return { valid: false, error: "Enter a valid month (1–12)" };
    }

    if (!dayDigits) return { valid: false, error: "" };
    const day = parseInt(dayDigits, 10);
    const maxDay = daysInMonth(westernYear, month);
    if (day < 1 || day > maxDay) {
      return { valid: false, error: "Enter a valid day for this month" };
    }

    return {
      valid: true,
      error: "",
      submitValue: `${westernYear}-${pad2(month)}-${pad2(day)}`,
      westernYear,
      month,
      day,
    };
  };

  const shouldAdvanceYear = (yearDigits, calendar) => {
    if (!yearDigits) return false;
    if (calendar === "western") return yearDigits.length >= 4;
    if (yearDigits.length === 4) return false;
    const roc = parseInt(yearDigits, 10);
    if (yearDigits.length >= 3) return true;
    if (yearDigits.length === 2 && roc >= 10) return true;
    return false;
  };

  const shouldAdvanceMonth = (monthDigits) => {
    if (!monthDigits) return false;
    if (monthDigits.length >= 2) return true;
    const month = parseInt(monthDigits, 10);
    return month > 1;
  };

  const shouldAdvanceDay = (dayDigits) => {
    if (!dayDigits) return false;
    if (dayDigits.length >= 2) return true;
    const day = parseInt(dayDigits, 10);
    return day > 3;
  };

  const isYearValidForHelper = (state) => {
    const yearDigits = onlyDigits(state.year);
    if (!yearDigits) return false;
    if (state.calendar === "roc" && yearDigits.length === 4) return false;
    const westernYear = toWesternYear(yearDigits, state.calendar);
    if (westernYear == null) return false;
    const { maxWesternYear, maxRocYear } = getAgeBounds();
    if (state.calendar === "western") {
      return yearDigits.length === 4 && westernYear >= MIN_WESTERN_YEAR && westernYear <= maxWesternYear;
    }
    const rocYear = parseInt(yearDigits, 10);
    return rocYear >= 1 && rocYear <= maxRocYear;
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
    const helperRow = root.querySelector("[data-auth-signup-id-dob-helper]");
    const helperText = root.querySelector("[data-auth-signup-id-dob-helper-text]");
    const helperIcon = root.querySelector("[data-auth-signup-id-dob-helper-icon]");
    const errorEl = root.querySelector("[data-auth-signup-id-dob-error]");
    const toggleBtns = Array.from(
      root.querySelectorAll("[data-auth-signup-id-dob-calendar]"),
    );
    const segmentsWrap = root.querySelector("[data-auth-signup-id-dob-segments]");
    const prototypeFillLabel = root.querySelector("[data-auth-signup-id-dob-prototype-fill]");

    const state = {
      calendar: "western",
      year: "",
      month: "",
      day: "",
    };

    let submitValue = "";
    let isValid = false;
    let hasBlurred = false;

    const segmentInputs = [yearInput, monthInput, dayInput].filter(Boolean);

    const syncToggleUi = () => {
      toggleBtns.forEach((btn) => {
        const cal = btn.getAttribute("data-auth-signup-id-dob-calendar");
        const active = cal === state.calendar;
        btn.classList.toggle("is-active", active);
        btn.setAttribute("aria-selected", active ? "true" : "false");
      });
      if (yearLabel) {
        yearLabel.textContent = state.calendar === "roc" ? "民國年" : "Year";
      }
      if (yearInput) {
        yearInput.maxLength = state.calendar === "western" ? 4 : 3;
      }
    };

    const syncValidity = (optsSync = {}) => {
      const result = validate(state);
      isValid = result.valid;
      submitValue = result.valid ? result.submitValue : "";

      if (errorEl) {
        const showError = hasBlurred && !optsSync.skipError && result.error;
        errorEl.hidden = !showError;
        errorEl.textContent = showError ? result.error : "";
      }

      root.classList.toggle("is-valid", isValid);
      root.classList.toggle("is-error", Boolean(errorEl && !errorEl.hidden));

      syncHelper(result);
      if (!optsSync.silent) onValidityChange(isValid);
    };

    const syncHelper = (result) => {
      if (!helperRow || !helperText) return;

      if (!isYearValidForHelper(state)) {
        helperRow.hidden = true;
        return;
      }

      const westernYear = toWesternYear(onlyDigits(state.year), state.calendar);
      if (westernYear == null) {
        helperRow.hidden = true;
        return;
      }

      helperRow.hidden = false;

      if (state.calendar === "western") {
        if (helperIcon) {
          helperIcon.src = `${assetBase}icon_info_circle_gray.svg`;
          helperIcon.hidden = false;
        }
        helperText.textContent = `民國 ${toRocDisplay(westernYear)} 年 · switch above to enter it`;
        return;
      }

      const month = onlyDigits(state.month);
      const day = onlyDigits(state.day);
      const monthDisplay = month ? pad2(parseInt(month, 10) || 0) : "MM";
      const dayDisplay = day ? pad2(parseInt(day, 10) || 0) : "DD";

      if (helperIcon) {
        helperIcon.src = `${assetBase}icon_check_green_s.svg`;
        helperIcon.hidden = false;
      }
      helperText.textContent = `Saved as ${westernYear} / ${monthDisplay} / ${dayDisplay}`;
    };

    const focusSegment = (input) => {
      if (!input) return;
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    };

    const focusNextSegment = (current) => {
      const idx = segmentInputs.indexOf(current);
      if (idx >= 0 && idx < segmentInputs.length - 1) {
        focusSegment(segmentInputs[idx + 1]);
      }
    };

    const focusPreviousSegment = (current) => {
      const idx = segmentInputs.indexOf(current);
      if (idx > 0) {
        focusSegment(segmentInputs[idx - 1]);
      }
    };

    const handleSegmentInput = (input, segment) => {
      hasBlurred = false;
      const digits = onlyDigits(input.value);
      input.value = digits;

      if (segment === "year") state.year = digits;
      if (segment === "month") state.month = digits.slice(0, 2);
      if (segment === "day") state.day = digits.slice(0, 2);

      if (segment === "month") input.value = state.month;
      if (segment === "day") input.value = state.day;

      syncValidity({ skipError: true });

      if (segment === "year" && shouldAdvanceYear(state.year, state.calendar)) {
        focusNextSegment(input);
      } else if (segment === "month" && shouldAdvanceMonth(state.month)) {
        focusNextSegment(input);
      } else if (segment === "day" && shouldAdvanceDay(state.day)) {
        input.blur();
      }
    };

    const handleSegmentKeyDown = (event, input) => {
      if (event.key !== "Backspace") return;
      const atStart = input.selectionStart === 0 && input.selectionEnd === 0;
      if (!atStart) return;
      event.preventDefault();
      focusPreviousSegment(input);
    };

    const handlePaste = (event) => {
      const pasted = event.clipboardData?.getData("text") || "";
      const parsed = parsePastedDate(pasted);
      if (!parsed) return;

      event.preventDefault();
      state.calendar = "western";
      state.year = parsed.year;
      state.month = parsed.month;
      state.day = parsed.day;
      if (yearInput) yearInput.value = state.year;
      if (monthInput) monthInput.value = state.month;
      if (dayInput) dayInput.value = state.day;
      syncToggleUi();
      syncValidity({ skipError: true });
      focusSegment(dayInput || monthInput || yearInput);
    };

    const handleCalendarToggle = (nextCalendar) => {
      if (!nextCalendar || nextCalendar === state.calendar) return;
      state.year = convertYearDigitsForCalendar(state.year, state.calendar, nextCalendar);
      state.calendar = nextCalendar;
      if (yearInput) yearInput.value = state.year;
      syncToggleUi();
      syncValidity({ skipError: true });
    };

    const handleBlur = (event) => {
      const next = event.relatedTarget;
      if (next && root.contains(next)) return;
      hasBlurred = true;
      syncValidity();
    };

    toggleBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        handleCalendarToggle(btn.getAttribute("data-auth-signup-id-dob-calendar"));
      });
    });

    segmentInputs.forEach((input) => {
      const segment = input.getAttribute("data-auth-signup-id-dob-segment");
      input.addEventListener("input", () => handleSegmentInput(input, segment));
      input.addEventListener("keydown", (event) => handleSegmentKeyDown(event, input));
      input.addEventListener("paste", handlePaste);
    });

    if (segmentsWrap) {
      segmentsWrap.addEventListener("focusout", handleBlur);
    }

    const fillDummy = () => {
      state.calendar = "western";
      state.year = "1986";
      state.month = "02";
      state.day = "21";
      if (yearInput) yearInput.value = state.year;
      if (monthInput) monthInput.value = state.month;
      if (dayInput) dayInput.value = state.day;
      hasBlurred = true;
      syncToggleUi();
      syncValidity();
    };

    if (prototypeFillLabel) {
      prototypeFillLabel.addEventListener("click", () => {
        fillDummy();
      });
    }

    const reset = () => {
      state.calendar = "western";
      state.year = "";
      state.month = "";
      state.day = "";
      submitValue = "";
      isValid = false;
      hasBlurred = false;
      segmentInputs.forEach((input) => {
        input.value = "";
      });
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = "";
      }
      if (helperRow) helperRow.hidden = true;
      root.classList.remove("is-valid", "is-error");
      syncToggleUi();
      onValidityChange(false);
    };

    syncToggleUi();
    syncValidity({ skipError: true, silent: true });

    return {
      isValid: () => isValid,
      reset,
      fillDummy,
      getSubmitValue: () => submitValue,
    };
  };

  window.initAuthSignupIdDob = initAuthSignupIdDob;
})();
