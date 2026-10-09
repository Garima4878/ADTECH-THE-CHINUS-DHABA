/*
 * Chinu AI menu assistant - embeddable chat widget (no dependencies).
 *
 * Usage (any frontend - plain HTML, React, Vue):
 *   <script src="https://<ai-service>/widget/chat-widget.js"
 *           data-api-base="https://<ai-service>"
 *           data-table-id="5"            (optional - otherwise read from ?table= in the URL)
 *           data-bottom-offset="80"      (optional - px above a sticky cart bar)
 *           defer></script>
 *
 * "Add to cart" does NOT touch the cart itself. It dispatches a browser event the frontend handles.
 * detail.itemId is the backend menu id (MongoDB _id) when MENU_API_URL is connected, else our knowledge-base id:
 *   window.addEventListener('chinu:add-to-cart', (e) => addToCart(e.detail.itemId));
 * The widget is non-modal: the menu stays scrollable and usable while it is open.
 */
(function () {
  'use strict';
  if (window.ChinuAI) return;

  var script = document.currentScript;
  var params = new URLSearchParams(window.location.search);
  var cfg = {
    apiBase: ((script && script.dataset.apiBase) || '').replace(/\/$/, ''),
    tableId: (script && script.dataset.tableId) || params.get('table') || params.get('tableId') || null,
    bottomOffset: Number((script && script.dataset.bottomOffset) || 16),
  };

  var SUGGESTIONS = ['Suggest chicken for dinner', 'Best biryani?', 'Mutton dishes', 'Veg options', 'How long does food take?'];
  var history = [];
  var busy = false;

  var css = [
    '.chinu-ai{--c-brand:#7a1f2b;--c-accent:#e8772e;--c-bg:#fffaf5;--c-text:#2b1a14;--c-muted:#7b6a62;--c-bubble:#f3e6dc;--c-border:#ead8cb;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--c-text)}',
    '@media (prefers-color-scheme:dark){.chinu-ai{--c-bg:#1f1714;--c-text:#f6ece6;--c-muted:#bba99f;--c-bubble:#33251f;--c-border:#4a3830}}',
    '.chinu-ai *{box-sizing:border-box}',
    '.chinu-ai-fab{position:fixed;right:16px;z-index:9998;display:flex;align-items:center;gap:8px;padding:12px 16px;border:0;border-radius:999px;background:var(--c-brand);color:#fff;font:600 15px/1 inherit;box-shadow:0 6px 18px rgba(0,0,0,.25);cursor:pointer}',
    '.chinu-ai-fab:focus-visible,.chinu-ai button:focus-visible,.chinu-ai input:focus-visible{outline:3px solid var(--c-accent);outline-offset:2px}',
    '.chinu-ai-panel{position:fixed;z-index:9999;display:none;flex-direction:column;background:var(--c-bg);box-shadow:0 -4px 24px rgba(0,0,0,.25);left:0;right:0;bottom:0;height:72vh;max-height:600px;border-radius:18px 18px 0 0}',
    '.chinu-ai-panel.open{display:flex}',
    '@media (min-width:640px){.chinu-ai-panel{left:auto;right:16px;bottom:16px;width:380px;height:560px;border-radius:18px}}',
    '.chinu-ai-head{display:flex;align-items:center;gap:10px;padding:14px 16px;background:var(--c-brand);color:#fff;border-radius:inherit;border-bottom-left-radius:0;border-bottom-right-radius:0}',
    '.chinu-ai-head b{display:block;font-size:15px}.chinu-ai-head small{opacity:.85;font-size:12px}',
    '.chinu-ai-close{margin-left:auto;background:transparent;border:0;color:#fff;font-size:24px;line-height:1;width:40px;height:40px;cursor:pointer;border-radius:50%}',
    '.chinu-ai-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}',
    '.chinu-ai-msg{max-width:85%;padding:10px 12px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-line;word-wrap:break-word}',
    '.chinu-ai-msg.bot{background:var(--c-bubble);align-self:flex-start;border-bottom-left-radius:4px}',
    '.chinu-ai-msg.user{background:var(--c-brand);color:#fff;align-self:flex-end;border-bottom-right-radius:4px}',
    '.chinu-ai-msg.typing{color:var(--c-muted);font-style:italic}',
    '.chinu-ai-cards{display:flex;flex-direction:column;gap:6px;align-self:stretch}',
    '.chinu-ai-card{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--c-border);border-radius:12px;background:var(--c-bg)}',
    '.chinu-ai-card .dot{width:12px;height:12px;border:2px solid #b3261e;border-radius:2px;flex:none;position:relative}.chinu-ai-card .dot.veg{border-color:#1e7b34}',
    '.chinu-ai-card .dot::after{content:"";position:absolute;inset:2px;border-radius:50%;background:currentColor;color:#b3261e}.chinu-ai-card .dot.veg::after{color:#1e7b34}',
    '.chinu-ai-card .info{flex:1;min-width:0}.chinu-ai-card .name{font-weight:600;font-size:14px}.chinu-ai-card .price{font-size:12px;color:var(--c-muted)}',
    '.chinu-ai-add{border:0;background:var(--c-accent);color:#fff;font:600 13px/1 inherit;padding:10px 12px;border-radius:10px;cursor:pointer;min-height:40px}',
    '.chinu-ai-add[disabled]{opacity:.6;cursor:default}',
    '.chinu-ai-chips{display:flex;gap:8px;overflow-x:auto;padding:0 14px 10px;scrollbar-width:none}',
    '.chinu-ai-chip{flex:none;border:1px solid var(--c-border);background:transparent;color:var(--c-text);border-radius:999px;padding:8px 12px;font:13px/1 inherit;cursor:pointer;min-height:36px}',
    '.chinu-ai-form{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));border-top:1px solid var(--c-border)}',
    '.chinu-ai-input{flex:1;min-width:0;border:1px solid var(--c-border);background:var(--c-bg);color:var(--c-text);border-radius:12px;padding:10px 12px;font:16px/1.2 inherit}',
    '.chinu-ai-send{border:0;background:var(--c-brand);color:#fff;border-radius:12px;padding:0 16px;font:600 14px/1 inherit;cursor:pointer;min-height:44px}',
    '.chinu-ai-send[disabled]{opacity:.6}',
    '.chinu-ai-note{font-size:11px;color:var(--c-muted);text-align:center;padding:0 12px 6px}',
  ].join('\n');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  var root = el('div', 'chinu-ai');
  var style = el('style');
  style.textContent = css;

  var fab = el('button', 'chinu-ai-fab');
  fab.type = 'button';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-expanded', 'false');
  fab.style.bottom = cfg.bottomOffset + 'px';
  fab.appendChild(el('span', null, '🍗'));
  fab.appendChild(el('span', null, 'Ask Chinu AI'));

  var panel = el('section', 'chinu-ai-panel');
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Menu assistant');

  var head = el('div', 'chinu-ai-head');
  var title = el('div');
  title.appendChild(el('b', null, 'Chinu AI · Menu help'));
  title.appendChild(el('small', null, cfg.tableId ? 'Table ' + cfg.tableId : 'Ask about any dish'));
  var closeBtn = el('button', 'chinu-ai-close', '×');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close assistant');
  head.appendChild(title);
  head.appendChild(closeBtn);

  var log = el('div', 'chinu-ai-log');
  log.setAttribute('aria-live', 'polite');

  var chips = el('div', 'chinu-ai-chips');
  SUGGESTIONS.forEach(function (text) {
    var chip = el('button', 'chinu-ai-chip', text);
    chip.type = 'button';
    chip.addEventListener('click', function () { send(text); });
    chips.appendChild(chip);
  });

  var form = el('form', 'chinu-ai-form');
  var input = el('input', 'chinu-ai-input');
  input.type = 'text';
  input.maxLength = 500;
  input.placeholder = 'e.g. mutton under ₹300';
  input.setAttribute('aria-label', 'Type your question');
  input.autocomplete = 'off';
  var sendBtn = el('button', 'chinu-ai-send', 'Send');
  sendBtn.type = 'submit';
  form.appendChild(input);
  form.appendChild(sendBtn);

  var note = el('div', 'chinu-ai-note', 'AI answers use the restaurant menu. Please confirm prices with staff if unsure.');

  panel.appendChild(head);
  panel.appendChild(log);
  panel.appendChild(chips);
  panel.appendChild(form);
  panel.appendChild(note);
  root.appendChild(style);
  root.appendChild(fab);
  root.appendChild(panel);

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function addBubble(role, text) {
    var bubble = el('div', 'chinu-ai-msg ' + role, text);
    log.appendChild(bubble);
    scrollDown();
    return bubble;
  }

  function addCards(items) {
    if (!items || !items.length) return;
    var wrap = el('div', 'chinu-ai-cards');
    items.forEach(function (item) {
      var card = el('div', 'chinu-ai-card');
      var dot = el('span', 'dot' + (item.is_veg ? ' veg' : ''));
      dot.setAttribute('aria-label', item.is_veg ? 'Veg' : 'Non-veg');
      var info = el('div', 'info');
      info.appendChild(el('div', 'name', item.name));
      info.appendChild(el('div', 'price', item.price != null ? '₹' + item.price : 'Price: ask staff'));
      var add = el('button', 'chinu-ai-add', 'Add');
      add.type = 'button';
      add.setAttribute('aria-label', 'Add ' + item.name + ' to cart');
      if (!item.available) { add.disabled = true; add.textContent = 'Unavailable'; }
      add.addEventListener('click', function () {
        window.dispatchEvent(new CustomEvent('chinu:add-to-cart', { detail: { itemId: item.menu_item_id || item.id, aiItemId: item.id, name: item.name, source: 'ai-assistant' } }));
        add.textContent = 'Added ✓';
        add.disabled = true;
        setTimeout(function () { add.textContent = 'Add'; add.disabled = false; }, 1500);
      });
      card.appendChild(dot);
      card.appendChild(info);
      card.appendChild(add);
      wrap.appendChild(card);
    });
    log.appendChild(wrap);
    scrollDown();
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    input.disabled = value;
  }

  function send(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    addBubble('user', text);
    input.value = '';
    setBusy(true);
    var typing = addBubble('bot typing', 'Checking the menu…');

    fetch(cfg.apiBase + '/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, history: history.slice(-6), tableId: cfg.tableId }),
    })
      .then(function (res) {
        return res.json().then(function (body) {
          if (!res.ok) throw new Error(body.error || 'Request failed');
          return body;
        });
      })
      .then(function (data) {
        typing.remove();
        addBubble('bot', data.reply);
        addCards(data.items);
        history.push({ role: 'user', content: text }, { role: 'assistant', content: data.reply });
      })
      .catch(function (err) {
        typing.remove();
        addBubble('bot', (err && err.message && err.message.indexOf('Too many') === 0)
          ? err.message
          : 'Sorry, I can’t reach the assistant right now. You can still order from the menu, or ask the staff.');
      })
      .then(function () {
        setBusy(false);
        if (panel.classList.contains('open')) input.focus();
      });
  }

  function open() {
    panel.classList.add('open');
    fab.style.display = 'none';
    fab.setAttribute('aria-expanded', 'true');
    if (!log.childElementCount) {
      addBubble('bot', 'Namaste! 🙏 I can help you pick dishes, check what’s available, or answer menu questions.');
    }
    input.focus();
  }

  function close() {
    panel.classList.remove('open');
    fab.style.display = '';
    fab.setAttribute('aria-expanded', 'false');
    fab.focus();
  }

  fab.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  panel.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });

  function mount() { document.body.appendChild(root); }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  window.ChinuAI = { open: open, close: close, ask: function (q) { open(); send(q); }, setTableId: function (id) { cfg.tableId = id; } };
})();
