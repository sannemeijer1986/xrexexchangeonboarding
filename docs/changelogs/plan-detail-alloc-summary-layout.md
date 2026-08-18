# Plan detail — allocation summary layout migration

Portable changelog for moving the multi-asset allocation summary from the bottom `plan-detail-panel__historic-performance-row` into the allocation header (Figma Visitor-mode 1.0).

## Design reference

| Item | Value |
|------|-------|
| Figma file | `Visitor-mode-1.0` (`0QRDsD2sOU5Qsoq7F2mfZw`) |
| Node | `13659:11419` (allocation section frame) |
| Inner summary frame | `13659:16172` |
| Reference repo | `xrexexchangedca` (same DOM/JS patterns) |

### Target layout (multi-asset, % mode, valid)

1. **Row 1:** `Allocation (n)` + `Set equal` stacked left · green check + **`100%`** right (20px bold, `#5ac47d`)
2. **Row 2 (invalid only):** error hint below, left-aligned
3. **Card:** asset list (`#151718`, 16px radius, `4px 16px 12px` padding)
4. **Removed:** separate “Remaining allocation (of 100%)” label row below the list
5. **Removed:** historic performance block from this summary area (multi-asset)

### Invalid % state

- Row 1 right: remaining/over percentage in `#eb5347` (no check)
- Row 2: error hint + `Set equal` (existing copy: “Add X% to continue”, etc.)

---

## Files to touch

| File | Change |
|------|--------|
| `public/index.html` | Restructure allocation header HTML; remove bottom historic-performance row |
| `src/scss/_layout.scss` | New summary layout styles; drop historic-performance-row rules |
| `public/js/main.js` | Update `updateAllocHeaderSubtitle`, visibility helpers, remove historic-row refs |
| `public/css/main.css` | Recompile from SCSS |

---

## 1. HTML (`public/index.html`)

**Find:** allocation section inside plan detail panel (`plan-detail-panel__allocation-section`).

**Replace header structure** — wrap summary in `plan-detail-panel__alloc-header-summary`:

```html
<div class="plan-detail-panel__alloc-header-main">
  <div class="plan-detail-panel__alloc-header-summary">
    <div class="plan-detail-panel__alloc-total" data-plan-detail-alloc-subtitle>
      <div class="plan-detail-panel__alloc-total-row">
        <div class="plan-detail-panel__section-label">
          Allocation (<span data-plan-detail-alloc-count>1</span>)
        </div>
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
      </div>
      <div class="plan-detail-panel__alloc-total-hint-row"
           data-plan-detail-alloc-total-hint hidden>
        <button type="button" class="plan-detail-panel__alloc-reset"
                data-alloc-reset hidden>Set equal</button>
        <div class="plan-detail-panel__alloc-total-error"
             data-plan-detail-alloc-total-error hidden></div>
      </div>
    </div>
    <!-- historic-inline block stays for single-asset tone plumbing; hidden in CSS for multi -->
    ...
  </div>
</div>
```

**Remove entirely:**

```html
<div class="plan-detail-panel__historic-performance-row">…</div>
```

(between allocation list and add-assets wrap)

**Key DOM moves:**

- `data-plan-detail-alloc-subtitle` moves **up** into header (was in historic-performance-row)
- `data-alloc-reset` moves into `data-plan-detail-alloc-total-hint` (row 2)
- Drop label text “Remaining allocation (of 100%)” (`plan-detail-panel__alloc-total-label`)

---

## 2. SCSS (`src/scss/_layout.scss`)

### Add / update

```scss
.plan-detail-panel__allocation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-detail-panel__alloc-header-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding-bottom: 12px;
}

.plan-detail-panel__alloc-total {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
}

.plan-detail-panel__alloc-total-row {
  justify-content: space-between; // was flex-end
  align-items: center;
}

.plan-detail-panel__alloc-total-label { display: none; }
.plan-detail-panel__alloc-total-target { display: none; }

.plan-detail-panel__allocation-list {
  padding: 4px 16px 12px; // multi-asset card
}

.plan-detail-panel__allocation-section.is-multi-asset
  .plan-detail-panel__alloc-header-historic-inline {
  display: none !important; // no historic perf in multi summary
}
```

### Remove

- `.plan-detail-panel__historic-performance-row` and related bottom-row rules
- `.is-empty` / `.is-single-asset` selectors targeting historic-performance-row
- Old `margin-bottom: 12px` on `.plan-detail-panel__alloc-total-hint-row`

### Important: preserve `[hidden]` on allocation sections

Adding `display: flex` to `.plan-detail-panel__allocation-section` overrides the browser’s `[hidden]` behaviour. Manual and auto sections would stack unless you add:

```scss
.plan-detail-panel__allocation-section[hidden] {
  display: none !important;
}
```

(`syncActiveAllocationVariant()` toggles `hidden` on the manual vs auto section — only one should show.)

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

### A. `updateAllocHeaderSubtitle()` (inside `initAllocSliders`)

**% mode — valid total:**

```diff
- currentEl.textContent = "0%";
+ currentEl.textContent = "100%";
  checkEl.hidden = false;
```

**% mode — remove `/ 100%` suffix:**

```diff
- targetEl.textContent = " / 100%";
+ targetEl.textContent = "";
```

**Show summary chrome when updating:**

```js
if (valueWrap) valueWrap.hidden = false; // pct mode
if (hintRow) hintRow.hidden = false;
```

### B. Replace `allocSubtitleEl.hidden = …` with `syncAllocSummaryChrome(count)`

```js
const syncAllocSummaryChrome = (assetCount) => {
  const valueWrap = panel.querySelector("[data-plan-detail-alloc-total-value-wrap]");
  const hintRow = panel.querySelector("[data-plan-detail-alloc-total-hint]");
  const showSummaryExtras = assetCount >= 2;
  if (valueWrap) valueWrap.hidden = !showSummaryExtras;
  if (hintRow) hintRow.hidden = !showSummaryExtras;
};
```

Call sites in `populatePanel`:

- Empty new plan: `syncAllocSummaryChrome(0)`
- Has assets: `syncAllocSummaryChrome(allocItems.length)`

Do **not** hide `[data-plan-detail-alloc-subtitle]` entirely — the `Allocation (n)` label lives inside it.

### C. Remove historic-performance-row references

```diff
- const historicRow = panel.querySelector(".plan-detail-panel__historic-performance-row");
- const historicAllocSubtitle = historicRow?.querySelector("[data-plan-detail-alloc-subtitle]");
- if (allocSection && historicRow && historicTone) {
+ if (allocSection && historicTone) {
```

Historic tone placement for single-asset (in alloc item row) is unchanged.

---

## 4. Porting checklist

Use this when applying the same change to another project (e.g. `xrexexchangedca`):

- [ ] Update plan detail allocation HTML per section 1
- [ ] Remove bottom `plan-detail-panel__historic-performance-row` block
- [ ] Apply SCSS changes; delete obsolete historic-performance-row rules
- [ ] Run `npm run compile:css` (or project equivalent)
- [ ] Patch `updateAllocHeaderSubtitle`: valid → `100%`, no `/ 100%`
- [ ] Add `syncAllocSummaryChrome`; remove `allocSubtitleEl.hidden` toggles
- [ ] Remove JS queries for `.plan-detail-panel__historic-performance-row`
- [ ] Manual QA:
  - [ ] New plan empty: only “Allocation (0)” + empty card CTA
  - [ ] Single asset: label only, historic % in asset row
  - [ ] Multi-asset valid: check + `100%`, `Set equal` below
  - [ ] Multi-asset invalid: red remainder/over %, error on row 2
  - [ ] Amount mode: total per buy on row 1, no check
  - [ ] Slider/input updates refresh header live

---

## 5. Behaviour matrix

| State | Row 1 left | Row 1 right | Row 2 |
|-------|------------|-------------|-------|
| Empty | Allocation (0) | hidden | hidden |
| Single asset | Allocation (1) | hidden | hidden |
| Multi, % valid | Allocation (n) | ✓ 100% | Set equal |
| Multi, % invalid | Allocation (n) | red remainder | Set equal + error |
| Multi, amount | Allocation (n) | `{total} {cur}` | Set equal |

---

*Generated for xrexexchangeonboarding — Aug 2026*
