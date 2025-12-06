const l10n = (function() {
    function getMessage(key, args) {
      try {
        return (typeof browser !== 'undefined' && browser.i18n)
          ? browser.i18n.getMessage(key, args)
          : (typeof chrome !== 'undefined' && chrome.i18n)
            ? chrome.i18n.getMessage(key, args)
            : key;
      } catch (e) { return key; }
    }
  
    function applyToElement(el) {
      // 属性指定: data-l10n-attr="placeholder:msgKey, title:otherKey"
      const attrSpec = el.getAttribute('data-l10n-attr');
      if (attrSpec) {
        attrSpec.split(',').forEach(pair => {
          const [attr, msgKey] = pair.split(':').map(s => s.trim());
          if (!attr || !msgKey) return;
          el.setAttribute(attr, getMessage(msgKey));
        });
      }
  
      // テキストノード等の置換
      const key = el.getAttribute('data-l10n') || el.getAttribute('data-l10n-key');
      if (key) {
        // input/textarea は value、それ以外は textContent
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = getMessage(key);
        else el.textContent = getMessage(key);
      }
    }
  
    function localize(root = document) {
      const nodes = root.querySelectorAll('[data-l10n-attr], [data-l10n], [data-l10n-key]');
      nodes.forEach(applyToElement);
      const title = root.querySelector('title[data-l10n], title[data-l10n-key]');
      if (title) applyToElement(title);
    }
  
    return { getMessage, localize };
  })();
  