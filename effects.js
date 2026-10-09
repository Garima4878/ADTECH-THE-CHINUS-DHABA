// Visual effects for the customer website: hero entrance, steam, tilt, rotating seal, scrolling ticker,
// scroll reveals, fly-to-cart and a count-up. Purely decorative: the site works the same without this
// file (remove it and effects.css from index.html to switch everything off). Styles live in effects.css.
(() => {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const root = document.documentElement;
  root.classList.add("fx");
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  // Header turns to frosted glass after a little scrolling.
  const header = $(".site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Seal: circular text around "100% desi dil se", sized to fit the circle exactly (decorative, hidden from screen readers).
  const seal = $(".seal");
  if (seal) {
    seal.insertAdjacentHTML(
      "afterbegin",
      '<svg class="fx-seal-ring" viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
        '<defs><path id="fx-seal-path" d="M50,50 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0"/></defs>' +
        '<text><textPath href="#fx-seal-path" textLength="258" lengthAdjust="spacing">The Nonveg King of Multai • Swad ke saath •</textPath></text></svg>'
    );
  }

  if (reduceMotion) return;

  // Hero headline: each line rises in, one after another.
  const heading = $(".hero h1");
  if (heading) {
    heading.innerHTML = heading.innerHTML
      .split(/<br\s*\/?>/i)
      .map((line, i) => `<span class="fx-line" style="--i:${i}"><span>${line}</span></span>`)
      .join("");
  }

  // Hero photo: slow zoom layer, rising steam, and a gentle tilt toward the pointer on desktops.
  const photo = $(".hero-photo");
  if (photo) {
    const zoom = document.createElement("div");
    zoom.className = "fx-photo-zoom";
    const steam = document.createElement("div");
    steam.className = "fx-steam";
    steam.innerHTML = "<span></span><span></span><span></span>";
    zoom.setAttribute("aria-hidden", "true");
    steam.setAttribute("aria-hidden", "true");
    photo.append(zoom, steam);

    const hero = $(".hero");
    const canTilt = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px)");
    if (hero) {
      hero.addEventListener("pointermove", (event) => {
        if (!canTilt.matches) return;
        const box = photo.getBoundingClientRect();
        const x = (event.clientX - (box.left + box.width / 2)) / box.width;
        const y = (event.clientY - (box.top + box.height / 2)) / box.height;
        photo.style.setProperty("--tilt-x", `${(-y * 6).toFixed(2)}deg`);
        photo.style.setProperty("--tilt-y", `${(x * 8).toFixed(2)}deg`);
      });
      hero.addEventListener("pointerleave", () => {
        photo.style.setProperty("--tilt-x", "0deg");
        photo.style.setProperty("--tilt-y", "0deg");
      });
    }
  }

  // Ticker: an endless scrolling strip (two identical halves; the second is hidden from screen readers).
  const ticker = $(".ticker");
  if (ticker) {
    const items = $$("span", ticker);
    const track = document.createElement("div");
    track.className = "fx-marquee";
    for (let copy = 0; copy < 2; copy += 1) {
      for (let repeat = 0; repeat < 3; repeat += 1) {
        items.forEach((item) => {
          const clone = item.cloneNode(true);
          if (copy || repeat) clone.setAttribute("aria-hidden", "true");
          track.append(clone);
        });
      }
    }
    ticker.replaceChildren(track);
  }

  // Scroll reveals: sections and dishes slide in as they come into view.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-in");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.1 }
  );
  const reveal = (element, delay = 0) => {
    if (element.dataset.fxReveal) return;
    element.dataset.fxReveal = "1";
    element.classList.add("fx-reveal");
    element.style.setProperty("--d", `${delay}ms`);
    observer.observe(element);
  };
  $$(".section-heading, .menu-toolbar, .story-photo, .story-content").forEach((element) => reveal(element));
  $$(".visit-card").forEach((card, i) => reveal(card, i * 120));

  // Menu cards are created by app.js (and again when a category tab is picked).
  const grid = $("#menu-grid");
  if (grid) {
    const revealCards = () => $$(".menu-card", grid).forEach((card, i) => reveal(card, (i % 6) * 70));
    new MutationObserver(revealCards).observe(grid, { childList: true });
    revealCards();
  }

  // "~15 minutes" counts up when the story section comes into view.
  const minutes = $(".years strong");
  if (minutes) {
    const match = minutes.textContent.match(/^(\D*)(\d+)(.*)$/);
    if (match) {
      const [, prefix, value, suffix] = match;
      const target = Number(value);
      const counter = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        counter.disconnect();
        const start = performance.now();
        const step = (now) => {
          const progress = Math.min(1, (now - start) / 1200);
          const eased = 1 - (1 - progress) ** 3;
          minutes.textContent = `${prefix}${Math.round(target * eased)}${suffix}`;
          if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }, { threshold: 0.6 });
      counter.observe(minutes);
    }
  }

  // Adding a dish: its photo flies into the cart button. The cart itself is handled by app.js.
  const cartButton = $("#cart-open");
  document.addEventListener("click", (event) => {
    const button = event.target.closest(".add-button");
    if (!button || button.disabled || !cartButton) return;
    const image = $(".menu-image", button.closest(".menu-card") || document.body);
    if (!image || !image.complete) return;
    const from = image.getBoundingClientRect();
    const to = cartButton.getBoundingClientRect();
    if (!from.width || !to.width) return;
    const flyer = image.cloneNode(false);
    flyer.className = "fx-fly";
    flyer.removeAttribute("loading");
    flyer.alt = "";
    Object.assign(flyer.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
    document.body.append(flyer);
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);
    flyer
      .animate(
        [
          { transform: "translate(0, 0) scale(1)", opacity: 1 },
          { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(.6)`, opacity: 1, offset: 0.55 },
          { transform: `translate(${dx}px, ${dy}px) scale(.15)`, opacity: 0.2 }
        ],
        { duration: 750, easing: "cubic-bezier(.5, 0, .3, 1)" }
      )
      .finished.finally(() => flyer.remove());
  });

  // Cart badge bounces whenever the item count goes up (menu, item sheet or AI chat).
  const count = $("#cart-count");
  if (count) {
    let last = Number(count.textContent) || 0;
    new MutationObserver(() => {
      const now = Number(count.textContent) || 0;
      if (now > last) {
        count.classList.remove("fx-bump");
        void count.offsetWidth; // restart the animation
        count.classList.add("fx-bump");
      }
      last = now;
    }).observe(count, { childList: true, characterData: true, subtree: true });
  }
})();
