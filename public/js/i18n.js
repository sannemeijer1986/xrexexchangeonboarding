(() => {
  const STORAGE_KEY = 'xrexexchange.prototype.locale.v1';
  const SUPPORTED = ['en', 'zh'];
  const DEFAULT_LOCALE = 'en';
  const EXTERNAL_ZH_PATH = 'i18n/zh.json';

  /** Single source of truth for UI translations.
   *  Key = canonical English source string/template.
   *  Value = localized string/template.
   */
  const translations = {
    en: {},
    zh: {
      // Add ZH translations here incrementally.
      // Example:
      // 'How it works': '運作方式',
      // 'Not enough balance for {count} {periodLabel}': '餘額不足，無法支應 {count} {periodLabel}',
    },
  };

  let locale = DEFAULT_LOCALE;
  const textSourceMap = new WeakMap(); // Text -> canonical EN source
  const attrSourceMap = new WeakMap(); // Element -> { attrName: canonical EN source }
  const discoveredSources = new Set(); // Canonical EN strings seen in UI
  const missingByLocale = {
    zh: new Set(),
  };
  let observer = null;
  let isApplying = false;

  const normalizeLocale = (value) => {
    const next = String(value || '').trim().toLowerCase();
    return SUPPORTED.includes(next) ? next : DEFAULT_LOCALE;
  };

  const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const toCanonicalSource = (value) => String(value || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const toTemplatedSource = (value) => {
    let s = toCanonicalSource(value);
    if (!s) return s;
    // Domain-specific dynamic phrases first (most reliable).
    s = s.replace(
      /^Not enough balance for \d+ (buy|buys|day|days|week|weeks|month|months)$/i,
      'Not enough balance for {count} {periodLabel}',
    );
    s = s.replace(
      /^Covers \d+ (buy|buys|day|days|week|weeks|month|months) · Runs out [A-Za-z]{3} \d{1,2}, \d{4}$/i,
      'Covers {count} {periodLabel} · Runs out {date}',
    );
    s = s.replace(
      /^Runs out [A-Za-z]{3} \d{1,2}, \d{4}$/i,
      'Runs out {date}',
    );
    s = s.replace(
      /^When these reserved funds run out, we'll automatically pre-fund (.+?) again to keep your plan running\.$/i,
      "When these reserved funds run out, we'll automatically pre-fund {amount} again to keep your plan running.",
    );
    s = s.replace(
      /^This will resume your automated buys: The next buy will be on .+\.$/i,
      'This will resume your automated buys: The next buy will be on {date}.',
    );
    s = s.replace(
      /^Max \d[\d,]* (USDT|TWD|USD|BTC|ETH|XRP|XAUT|LINK|NEAR|MATIC|ONDO|AAVE|RENDER)$/i,
      'Max {amount} {currency}',
    );
    s = s.replace(
      /^Max \d[\d,]*$/i,
      'Max {count}',
    );
    s = s.replace(
      /^Avail\. \d[\d,]* (USDT|TWD|USD|BTC|ETH|XRP|XAUT|LINK|NEAR|MATIC|ONDO|AAVE|RENDER)$/i,
      'Avail. {amount} {currency}',
    );
    s = s.replace(
      /^Invest \d[\d,]* (USDT|TWD|USD|BTC|ETH|XRP|XAUT|LINK|NEAR|MATIC|ONDO|AAVE|RENDER)$/i,
      'Invest {amount} {currency}',
    );
    s = s.replace(
      /^Active \(\d+\)$/i,
      'Active ({count})',
    );
    s = s.replace(
      /^Paused \(\d+\)$/i,
      'Paused ({count})',
    );
    s = s.replace(
      /^Ended \(\d+\)$/i,
      'Ended ({count})',
    );
    s = s.replace(
      /^My plans \(\d+\)$/i,
      'My plans ({count})',
    );
    s = s.replace(
      /^every month on the \d{1,2}(st|nd|rd|th)$/i,
      'every month on the {dayOrdinal}',
    );
    s = s.replace(
      /^(\d+)\s+buys$/i,
      '{count} buys',
    );
    s = s.replace(
      /^(\d+)\s+buy$/i,
      '{count} buy',
    );
    s = s.replace(
      /^(\d+)\s+coins selected$/i,
      '{count} coins selected',
    );
    s = s.replace(
      /^(\d+)\s+coin selected$/i,
      '{count} coin selected',
    );
    s = s.replace(
      /^Allocation \((\d+)\)$/i,
      'Allocation ({count})',
    );
    s = s.replace(
      /^\d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) · (\d+) buys$/i,
      '{amount} {currency} · {count} buys',
    );
    s = s.replace(
      /^\d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) · (\d+) buy$/i,
      '{amount} {currency} · {count} buy',
    );
    s = s.replace(
      /^Auto-refill coming up: Keep at least \d[\d,]* ([A-Z]{3,5}) in your wallet\.$/i,
      'Auto-refill coming up: Keep at least {amount} {currency} in your wallet.',
    );
    s = s.replace(
      /^Auto-refill failed: Add \d[\d,]* ([A-Z]{3,5}) to your wallet to continue\.$/i,
      'Auto-refill failed: Add {amount} {currency} to your wallet to continue.',
    );
    s = s.replace(
      /^Auto-refill triggers soon — keep \d[\d,]* ([A-Z]{3,5}) in your wallet\.$/i,
      'Auto-refill triggers soon — keep {amount} {currency} in your wallet.',
    );
    s = s.replace(
      /^Automatically refill \d[\d,]* ([A-Z]{3,5}) when pre-funded amount drops below \d[\d,]* ([A-Z]{3,5})$/i,
      'Automatically refill {amount} {currency} when pre-funded amount drops below {thresholdAmount} {thresholdCurrency}',
    );
    s = s.replace(
      /^\d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) returned$/i,
      '{amount} {currency} returned',
    );
    s = s.replace(
      /^\d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) pre-funded$/i,
      '{amount} {currency} pre-funded',
    );
    s = s.replace(
      /^\d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) invested$/i,
      '{amount} {currency} invested',
    );
    s = s.replace(
      /^[\d.,]+(?:萬|億|K|M|B|k|m|b)? ([A-Z]{3,5}) invested$/i,
      '{amount} {currency} invested',
    );
    s = s.replace(
      /^[\d.,]+(?:萬|億|K|M|B|k|m|b)? ([A-Z]{3,5}) invested →$/i,
      '{amount} {currency} invested →',
    );
    s = s.replace(
      /^\d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) left$/i,
      '{amount} {currency} left',
    );
    s = s.replace(
      /^Pre-funded: \d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) left$/i,
      'Pre-funded: {amount} {currency} left',
    );
    s = s.replace(
      /^Past (\d+)Y simulation based on your monthly plan setup$/i,
      'Past {years}Y simulation based on your monthly plan setup',
    );
    s = s.replace(
      /^Past (\d+)Y simulation based on your weekly plan setup$/i,
      'Past {years}Y simulation based on your weekly plan setup',
    );
    s = s.replace(
      /^Past (\d+)Y simulation based on your daily plan setup$/i,
      'Past {years}Y simulation based on your daily plan setup',
    );
    s = s.replace(
      /^Past (\d+)Y simulation based on your plan setup$/i,
      'Past {years}Y simulation based on your plan setup',
    );
    s = s.replace(
      /^Simulated value \(([^)]+)\)$/i,
      'Simulated value ({tickers})',
    );
    s = s.replace(
      /^Returned \d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) from this plan to your wallet, auto-refill for pre-funding has been disabled\.$/i,
      'Returned {amount} {currency} from this plan to your wallet, auto-refill for pre-funding has been disabled.',
    );
    s = s.replace(
      /^Reserved \d[\d,]*(?:\.\d+)? ([A-Z]{3,5}) from your wallet for this plan, auto-refill for pre-funding has been enabled\.$/i,
      'Reserved {amount} {currency} from your wallet for this plan, auto-refill for pre-funding has been enabled.',
    );
    // Generic fallback for count + period label patterns.
    s = s.replace(
      /^(\d+) (buy|buys|day|days|week|weeks|month|months)$/i,
      '{count} {periodLabel}',
    );
    return s;
  };
  const hasLetters = (value) => /[A-Za-z\u00C0-\u024F\u4E00-\u9FFF]/.test(value);
  const isMostlyNumericOrSymbols = (value) => /^[-+≈~•/\\%().,:\d\s]+$/.test(value);
  const isDynamicMoneyLike = (value) => /^[-+]?\d[\d,]*(?:\.\d+)?\s+[A-Z]{3,5}(?:\b|$)/.test(value);
  const looksLikeTicker = (value) => /^[A-Z]{2,8}$/.test(value);
  const looksLikePair = (value) => /^[A-Z]{2,8}\s*\/\s*[A-Z]{2,8}$/.test(value);
  const looksLikeRangeChip = (value) => /^\d+Y$/i.test(value);
  const looksLikeOrdinal = (value) => /^\d{1,2}(st|nd|rd|th)$/i.test(value);
  const looksLikeValueSnippet = (value) => /^(~|≈|\+|-|•|\/|%|\(|\)|\{|\$)/.test(value);
  const noisyFragments = new Set([
    '{$value}',
    '• Plan ID',
    '/TWD',
    '/USDT',
    '/ — buys',
    '/ — months',
    '(Basic limits)',
  ]);
  const shouldCollectSource = (value) => {
    const s = toCanonicalSource(value);
    if (!s) return false;
    if (noisyFragments.has(s)) return false;
    if (!hasLetters(s)) return false;
    if (isMostlyNumericOrSymbols(s)) return false;
    if (isDynamicMoneyLike(s)) return false;
    if (looksLikeTicker(s)) return false;
    if (looksLikePair(s)) return false;
    if (looksLikeRangeChip(s)) return false;
    if (looksLikeOrdinal(s)) return false;
    if (looksLikeValueSnippet(s) && s.length < 32) return false;
    if (/^@\w+$/.test(s)) return false;
    return true;
  };

  const interpolate = (template, params) => {
    if (!params || typeof params !== 'object') return template;
    let out = String(template);
    Object.entries(params).forEach(([key, value]) => {
      out = out.replace(new RegExp(`\\{${escapeRegExp(key)}\\}`, 'g'), String(value));
    });
    return out;
  };

  // Extract template param values from a raw string by matching it against its canonical template.
  // e.g. raw="Active (3)", canonical="Active ({count})" → { count: "3" }
  // e.g. raw="Avail. 5,000 USDT", canonical="Avail. {amount} {currency}" → { amount: "5,000", currency: "USDT" }
  const extractParamsFromTemplate = (raw, canonical) => {
    if (!canonical || !canonical.includes('{') || canonical === raw) return null;
    const paramNames = [];
    let pattern = '^';
    let lastIdx = 0;
    const ph = /\{(\w+)\}/g;
    let m;
    while ((m = ph.exec(canonical)) !== null) {
      pattern += canonical.slice(lastIdx, m.index).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      paramNames.push(m[1]);
      pattern += '(.+?)';
      lastIdx = m.index + m[0].length;
    }
    pattern += canonical.slice(lastIdx).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$';
    try {
      const result = new RegExp(pattern, 'i').exec(raw);
      if (!result) return null;
      const out = {};
      paramNames.forEach((name, i) => { out[name] = result[i + 1]; });
      return out;
    } catch (_) {
      return null;
    }
  };

  const reverseLookupSource = (text, forLocale = locale) => {
    const current = String(text ?? '');
    if (!current) return current;
    const target = normalizeLocale(forLocale);
    if (target === 'en') return current;
    const table = translations[target] || {};
    for (const [source, localized] of Object.entries(table)) {
      if (String(localized) === current) return source;
    }
    return current;
  };

  const translate = (source, params) => {
    const raw = String(source ?? '');
    if (!raw) return raw;
    const canonical = toTemplatedSource(raw);
    if (shouldCollectSource(canonical)) discoveredSources.add(canonical);
    if (locale === 'en') return interpolate(raw, params);
    const table = translations[locale] || {};
    const hasRaw = Object.prototype.hasOwnProperty.call(table, raw);
    const hasCanonical = Object.prototype.hasOwnProperty.call(table, canonical);
    if (shouldCollectSource(canonical) && !hasRaw && !hasCanonical) {
      if (!missingByLocale[locale]) missingByLocale[locale] = new Set();
      missingByLocale[locale].add(canonical);
    }
    const localized = hasRaw ? table[raw] : (hasCanonical ? table[canonical] : raw);
    // If no explicit params were supplied but the localized string still has {placeholders},
    // extract the dynamic values from the original raw string using the canonical template.
    const autoParams = (!params && canonical !== raw && /\{[^}]+\}/.test(String(localized)))
      ? extractParamsFromTemplate(toCanonicalSource(raw), canonical)
      : null;
    const mergedParams = autoParams ? { ...autoParams, ...(params || {}) } : params;
    return interpolate(localized, mergedParams);
  };

  const shouldTranslateText = (node) => {
    if (!node || node.nodeType !== Node.TEXT_NODE) return false;
    const parent = node.parentElement;
    if (!parent) return false;
    const tag = parent.tagName?.toLowerCase() || '';
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return false;
    const value = String(node.nodeValue || '');
    if (!value.trim()) return false;
    return true;
  };

  const rememberAttrSource = (el, attrName, sourceText) => {
    const prev = attrSourceMap.get(el) || {};
    prev[attrName] = sourceText;
    attrSourceMap.set(el, prev);
  };

  const applyTextNodeLocale = (node) => {
    if (!shouldTranslateText(node)) return;
    const currentText = String(node.nodeValue || '');
    const source = textSourceMap.get(node) || reverseLookupSource(currentText);
    if (!textSourceMap.has(node)) textSourceMap.set(node, source);
    const translated = translate(source);
    if (translated !== currentText) node.nodeValue = translated;
  };

  const TRANSLATABLE_ATTRS = ['aria-label', 'title', 'placeholder'];

  const applyElementAttrLocale = (el) => {
    if (!(el instanceof Element)) return;
    TRANSLATABLE_ATTRS.forEach((attrName) => {
      if (!el.hasAttribute(attrName)) return;
      const current = String(el.getAttribute(attrName) || '');
      if (!current.trim()) return;
      const remembered = (attrSourceMap.get(el) || {})[attrName];
      const source = remembered || reverseLookupSource(current);
      if (!remembered) rememberAttrSource(el, attrName, source);
      const translated = translate(source);
      if (translated !== current) el.setAttribute(attrName, translated);
    });
  };

  const syncDocumentLang = () => {
    document.documentElement.setAttribute('lang', locale === 'zh' ? 'zh-Hant' : 'en');
  };

  const applyLocaleToTree = (root = document.body) => {
    if (!root) return;
    syncDocumentLang();
    if (locale === 'en') return;
    isApplying = true;
    try {
      if (root instanceof Element) applyElementAttrLocale(root);
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let node = walker.nextNode();
      while (node) {
        applyTextNodeLocale(node);
        node = walker.nextNode();
      }
      if (root instanceof Element) {
        root.querySelectorAll('*').forEach((el) => applyElementAttrLocale(el));
      }
    } finally {
      isApplying = false;
    }
  };

  const ensureLocaleObserver = () => {
    if (observer || locale === 'en') return;
    initObserver();
  };

  const setLocale = async (nextLocale) => {
    const wasZh = locale === 'zh';
    locale = normalizeLocale(nextLocale);
    localStorage.setItem(STORAGE_KEY, locale);
    const select = document.querySelector('[data-prototype-language]');
    if (select instanceof HTMLSelectElement && select.value !== locale) {
      select.value = locale;
    }
    if (locale === 'zh' && !wasZh) {
      await loadExternalZhTranslations();
    }
    ensureLocaleObserver();
    applyLocaleToTree(document.body);
    document.dispatchEvent(new CustomEvent('prototype-locale-changed', { detail: { locale } }));
    // Second pass: catch any DOM updates main.js makes synchronously in response to the
    // locale-changed event or state changes triggered by it.
    requestAnimationFrame(() => applyLocaleToTree(document.body));
  };

  const getLocale = () => locale;

  const initLocale = () => {
    locale = normalizeLocale(localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCALE);
  };

  const parseJsonc = (raw) => {
    const src = String(raw || '');
    let out = '';
    let inString = false;
    let quote = '';
    let escaped = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let i = 0; i < src.length; i += 1) {
      const ch = src[i];
      const next = src[i + 1];

      if (inLineComment) {
        if (ch === '\n') {
          inLineComment = false;
          out += ch;
        }
        continue;
      }
      if (inBlockComment) {
        if (ch === '*' && next === '/') {
          inBlockComment = false;
          i += 1;
        }
        continue;
      }

      if (inString) {
        out += ch;
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          escaped = true;
          continue;
        }
        if (ch === quote) {
          inString = false;
          quote = '';
        }
        continue;
      }

      if ((ch === '"' || ch === "'") && !inString) {
        inString = true;
        quote = ch;
        out += ch;
        continue;
      }

      if (ch === '/' && next === '/') {
        inLineComment = true;
        i += 1;
        continue;
      }
      if (ch === '/' && next === '*') {
        inBlockComment = true;
        i += 1;
        continue;
      }

      out += ch;
    }

    return JSON.parse(out);
  };

  const loadExternalZhTranslations = async () => {
    try {
      const response = await fetch(EXTERNAL_ZH_PATH, { cache: 'no-store' });
      if (!response.ok) return;
      const raw = await response.text();
      const data = parseJsonc(raw);
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      const next = { ...data };
      delete next['_meta.locale'];
      delete next['_meta.note'];
      Object.assign(translations.zh, next);
    } catch (_) {
      // Keep runtime resilient if file is missing/invalid.
    }
  };

  const bindLocaleSelector = () => {
    const select = document.querySelector('[data-prototype-language]');
    if (!(select instanceof HTMLSelectElement)) return;
    select.value = locale;
    select.addEventListener('change', () => setLocale(select.value));
  };

  const initObserver = () => {
    observer = new MutationObserver((records) => {
      if (isApplying) return;
      isApplying = true;
      try {
        records.forEach((record) => {
          if (record.type === 'characterData') {
            const node = record.target;
            if (!shouldTranslateText(node)) return;
            // Treat runtime updates as canonical EN source strings.
            textSourceMap.set(node, reverseLookupSource(String(node.nodeValue || '')));
            applyTextNodeLocale(node);
            return;
          }
          if (record.type === 'attributes') {
            const el = record.target;
            if (!(el instanceof Element)) return;
            const attrName = record.attributeName;
            if (!attrName || !TRANSLATABLE_ATTRS.includes(attrName)) return;
            const current = String(el.getAttribute(attrName) || '');
            if (!current.trim()) return;
            rememberAttrSource(el, attrName, reverseLookupSource(current));
            applyElementAttrLocale(el);
            return;
          }
          if (record.type === 'childList') {
            record.addedNodes.forEach((node) => {
              if (node.nodeType === Node.TEXT_NODE) {
                textSourceMap.set(node, reverseLookupSource(String(node.nodeValue || '')));
                applyTextNodeLocale(node);
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                applyLocaleToTree(node);
              }
            });
          }
        });
      } finally {
        isApplying = false;
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRS,
    });
  };

  const init = async () => {
    initLocale();
    bindLocaleSelector();
    if (locale === 'zh') {
      await loadExternalZhTranslations();
      applyLocaleToTree(document.body);
      initObserver();
      // Second pass: catch any DOM updates main.js made during its own DOMContentLoaded
      // initialization that ran after (or interleaved with) our first applyLocaleToTree pass.
      requestAnimationFrame(() => applyLocaleToTree(document.body));
      return;
    }
    syncDocumentLang();
  };

  const getDiscoveredStrings = () => Array.from(discoveredSources).sort((a, b) => a.localeCompare(b));

  const getMissingStrings = (forLocale = locale) => {
    const key = normalizeLocale(forLocale);
    const set = missingByLocale[key];
    return set ? Array.from(set).sort((a, b) => a.localeCompare(b)) : [];
  };

  const buildCatalog = (forLocale = 'zh') => {
    const target = normalizeLocale(forLocale);
    const table = translations[target] || {};
    return getDiscoveredStrings().reduce((acc, source) => {
      acc[source] = Object.prototype.hasOwnProperty.call(table, source) ? table[source] : '';
      return acc;
    }, {});
  };

  const seedLocaleFromDiscovered = (forLocale = 'zh', { overwrite = false } = {}) => {
    const target = normalizeLocale(forLocale);
    if (!translations[target]) translations[target] = {};
    const table = translations[target];
    getDiscoveredStrings().forEach((source) => {
      if (!Object.prototype.hasOwnProperty.call(table, source) || overwrite) {
        table[source] = overwrite ? table[source] ?? '' : '';
      }
    });
    return table;
  };

  const exportCatalogJson = (forLocale = 'zh') => JSON.stringify(buildCatalog(forLocale), null, 2);

  const shouldIncludeInUiCatalog = (source) => {
    const s = toCanonicalSource(source);
    if (!s) return false;
    if (!shouldCollectSource(s)) return false;
    // Extra strict pass for translation deliverables.
    if (looksLikeTicker(s) || looksLikePair(s) || looksLikeRangeChip(s) || looksLikeOrdinal(s)) return false;
    if (/^\d/.test(s) && !/\s/.test(s)) return false;
    return true;
  };

  const buildUiCatalog = (forLocale = 'zh') => {
    const target = normalizeLocale(forLocale);
    const table = translations[target] || {};
    return getDiscoveredStrings()
      .filter(shouldIncludeInUiCatalog)
      .reduce((acc, source) => {
        acc[source] = Object.prototype.hasOwnProperty.call(table, source) ? table[source] : '';
        return acc;
      }, {});
  };

  const exportUiCatalogJson = (forLocale = 'zh') => JSON.stringify(buildUiCatalog(forLocale), null, 2);

  window.I18N = {
    getLocale,
    setLocale,
    t: translate,
    translations,
    applyLocaleToTree: (root) => applyLocaleToTree(root || document.body),
    getDiscoveredStrings,
    getMissingStrings,
    buildCatalog,
    seedLocaleFromDiscovered,
    exportCatalogJson,
    buildUiCatalog,
    exportUiCatalogJson,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); }, { once: true });
  } else {
    init();
  }
})();

