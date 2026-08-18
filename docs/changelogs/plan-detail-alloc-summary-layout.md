# Plan detail — allocation summary layout

Portable changelog for the multi-asset allocation summary in the plan-detail header (Figma Visitor-mode 1.0). **Current source of truth** for `xrexexchangeonboarding` and `xrexexchangedca`.

## Design reference

| Item | Value |
|------|-------|
| Figma file | `Visitor-mode-1.0` (`0QRDsD2sOU5Qsoq7F2mfZw`) |
| Node | `13659:11419` (allocation section frame) |
| Inner summary frame | `13659:16172` |
| Reference repos | `xrexexchangeonboarding`, `xrexexchangedca` |

### Target layout (multi-asset, % mode, valid)

1. **Left:** `Allocation (n)` with **Set equal** stacked under it
2. **Right:** green check + **`100%`** (20px bold, `#5ac47d`)
3. **Card:** asset list (`#151718`, 16px radius, `4px 16px 12px` padding)
4. **Removed:** separate “Remaining allocation (of 100%)” label row below the list
5. **Removed:** historic performance block from this summary area (multi-asset)

### Invalid % state

- Right: remaining/over percentage in `#eb5347` (no check), **right-aligned**
- Under the %: error hint, **right-aligned**
  - under 100%: `Increase {pct} to continue`
  - over 100%: `Decrease {pct} to continue`
  - near 100% but invalid: `Allocation should add up to 100%`
- Left still shows Set equal (not the error)

---

## Files to touch

| File | Change |
|------|--------|
| `public/index.html` | Restructure allocation header; remove bottom historic-performance row |
| `src/scss/_layout.scss` | New summary layout; drop historic-performance-row rules; preserve `[hidden]` |
| `public/js/main.js` | `updateAllocHeaderSubtitle`, `syncAllocSummaryChrome`, remove historic-row refs |
| `public/js/i18n.js` | Template patterns for Increase/Decrease copy |
| `public/i18n/zh.json` | New keys; drop Add/Reduce keys |
| `public/css/main.css` | Recompile from SCSS |

---

## 1. HTML (`public/index.html`)

**Find:** allocation section inside plan detail panel (`plan-detail-panel__allocation-section`).

**Replace the header title group** with `plan-detail-panel__alloc-header-summary`. Keep the historic-inline block for single-asset tone plumbing (hidden in CSS for multi).

```html
<div class="plan-detail-panel__alloc-header-main">
  <div class="plan-detail-panel__alloc-header-summary">
    <div class="plan-detail-panel__alloc-total" data-plan-detail-alloc-subtitle>
      <div class="plan-detail-panel__alloc-total-row">
        <div class="plan-detail-panel__alloc-total-leading">
          <div class="plan-detail-panel__section-label">
            Allocation (<span data-plan-detail-alloc-count>1</span>)
          </div>
          <div class="plan-detail-panel__alloc-total-hint-row"
               data-plan-detail-alloc-total-hint hidden>
            <button type="button" class="plan-detail-panel__alloc-reset"
                    data-alloc-reset hidden>Set equal</button>
          </div>
        </div>
        <div class="plan-detail-panel__alloc-total-trailing">
          <div class="plan-detail-panel__alloc-total-value"
               data-plan-detail-alloc-total-value-wrap hidden aria-live="polite">
            <img class="plan-detail-panel__alloc-total-check"
                 src="assets/icon_check_green.svg" alt="" width="16" height="16"
                 data-plan-detail-alloc-total-check hidden />
            <span class="plan-detail-panel__alloc-total-current"
                  data-plan-detail-alloc-total-current>0%</span>
            <span class="plan-detail-panel__alloc-total-target"
                  data-plan-detail-alloc-total-target hidden> / 100%</span>
          </div>
          <div class="plan-detail-panel__alloc-total-error"
               data-plan-detail-alloc-total-error hidden></div>
        </div>
      </div>
    </div>
    <!-- historic-inline stays for single-asset tone plumbing; hidden in CSS for multi -->
    ...
  </div>
</div>
```

**Remove entirely** (between allocation list and add-assets wrap):

```html
<div class="plan-detail-panel__historic-performance-row">…</div>
```

**Key DOM moves:**

- `data-plan-detail-alloc-subtitle` moves **up** into the header (was in historic-performance-row). Do **not** leave `hidden` on it — `Allocation (n)` lives inside it.
- `data-alloc-reset` lives in `data-plan-detail-alloc-total-hint` (left column, under the label)
- `data-plan-detail-alloc-total-error` lives in `plan-detail-panel__alloc-total-trailing` (under the %)
- Drop label text “Remaining allocation (of 100%)” (`plan-detail-panel__alloc-total-label`)

---

## 2. SCSS (`src/scss/_layout.scss`)

### Add / update

```scss
.plan-detail-panel__allocation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;

  // display:flex beats UA [hidden]; keep manual/auto variants mutually exclusive
  &[hidden] {
    display: none !important;
  }
}

.plan-detail-panel__alloc-header-summary {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  width: 100%;
  padding-bottom: 12px;
}

.plan-detail-panel__alloc-total-row {
  justify-content: space-between;
  align-items: flex-start;
}

.plan-detail-panel__alloc-total-leading {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  min-width: 0;
  flex: 1 1 auto;
}

.plan-detail-panel__alloc-total-trailing {
  display: flex;
  flex-direction: column;
  align-items: flex-end; // % + error stack on the right
  gap: 2px;
  flex-shrink: 0;
  min-width: 0;
}

.plan-detail-panel__alloc-total-value {
  justify-content: flex-end;
  align-self: flex-end; // do not use flex-start — error is wider than the %
}

.plan-detail-panel__alloc-total-error {
  text-align: right;
}

.plan-detail-panel__alloc-total-label { display: none; }
.plan-detail-panel__alloc-total-target { display: none; }

.plan-detail-panel__allocation-list {
  padding: 4px 16px 12px;
}

.plan-detail-panel__allocation-section.is-multi-asset
  .plan-detail-panel__alloc-header-historic-inline {
  display: none !important; // no historic perf in multi summary
}
```

### Empty / single-asset visibility

```scss
.plan-detail-panel__allocation-section.is-empty,
.plan-detail-panel__allocation-section.is-single-asset {
  [data-plan-detail-alloc-total-value-wrap],
  [data-plan-detail-alloc-total-hint] {
    display: none !important;
  }
}
```

Recompile: `npm run compile:css`

---

## 3. JavaScript (`public/js/main.js`)

### Invalid copy (i18n keys = English source)

```js
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
```

Replace any `Add … to continue` / `Reduce … to continue` strings.

---

## 4. i18n

### `public/js/i18n.js` — `toTemplatedSource()`

```js
s = s.replace(
  /^Increase \d[\d,]*(?:\.\d+)?% to continue$/i,
  'Increase {pct} to continue',
);
s = s.replace(
  /^Decrease \d[\d,]*(?:\.\d+)?% to continue$/i,
  'Decrease {pct} to continue',
);
```

### `public/i18n/zh.json`

```json
"Increase {pct} to continue": "增加 {pct} 以繼續",
"Decrease {pct} to continue": "減少 {pct} 以繼續"
```

Remove `"Add {pct} to continue"` / `"Reduce {pct} to continue"` if present.

---

## 5. Behaviour matrix

| State | Left | Right | Under % |
|-------|------|-------|---------|
| Empty | Allocation (0) | hidden | hidden |
| Single asset | Allocation (1) | hidden | hidden |
| Multi, % valid | Allocation (n) + Set equal | ✓ 100% | hidden |
| Multi, % under | Allocation (n) + Set equal | red remainder | Increase {pct} to continue |
| Multi, % over | Allocation (n) + Set equal | red over | Decrease {pct} to continue |
| Multi, amount | Allocation (n) + Set equal | `{total} {cur}` | hidden |

---

## 6. Delta vs earlier onboarding manifesto

If a repo already applied an older version of this doc (error left-aligned under Set equal; Add/Reduce copy), only these extras are needed:

1. Wrap value + error in `plan-detail-panel__alloc-total-trailing`; keep Set equal in `…-leading`
2. Trailing column `align-items: flex-end`; value `align-self: flex-end`; error `text-align: right`
3. Rename copy Add → Increase, Reduce → Decrease (+ zh.json + i18n templates)

---

*Updated Aug 2026*
