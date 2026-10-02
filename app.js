(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* First-visit tip — dismiss once via localStorage */
  const TIP_KEY = "sala-hub-tip-dismissed-v1";
  const tip = document.getElementById("hub-tip");
  if (tip) {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(TIP_KEY) === "1";
    } catch (_) {}
    if (!dismissed) {
      tip.hidden = false;
      tip.removeAttribute("hidden");
    }
    const dismiss = () => {
      tip.hidden = true;
      tip.setAttribute("hidden", "");
      try {
        localStorage.setItem(TIP_KEY, "1");
      } catch (_) {}
    };
    tip.querySelector(".hub-tip-dismiss")?.addEventListener("click", dismiss);
  }

  /* Card press juice: scale + ripple (gated by reduced-motion) */
  const pressTargets = document.querySelectorAll(".card-live");
  pressTargets.forEach((card) => {
    card.classList.add("card-press");
    if (reduce) return;

    const spawnRipple = (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX ?? event.touches?.[0]?.clientX ?? box.left + box.width / 2) - box.left;
      const y = (event.clientY ?? event.touches?.[0]?.clientY ?? box.top + box.height / 2) - box.top;
      const rip = document.createElement("span");
      rip.className = "card-ripple";
      rip.style.left = `${x}px`;
      rip.style.top = `${y}px`;
      card.appendChild(rip);
      rip.addEventListener("animationend", () => rip.remove());
      window.setTimeout(() => rip.remove(), 600);
    };

    card.addEventListener(
      "pointerdown",
      (event) => {
        if (event.button != null && event.button !== 0) return;
        card.classList.add("is-pressed");
        spawnRipple(event);
      },
      { passive: true }
    );

    const clearPress = () => card.classList.remove("is-pressed");
    card.addEventListener("pointerup", clearPress, { passive: true });
    card.addEventListener("pointercancel", clearPress, { passive: true });
    card.addEventListener("pointerleave", clearPress, { passive: true });
  });

  /* Desktop tilt only (skip coarse pointer / reduced motion) */
  if (reduce || window.matchMedia("(pointer: coarse)").matches) return;

  const cards = document.querySelectorAll("[data-tilt]");
  cards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const box = card.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width;
      const y = (event.clientY - box.top) / box.height;
      card.style.setProperty("--mx", x.toFixed(3));
      card.style.setProperty("--my", y.toFixed(3));
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--mx", "0.5");
      card.style.setProperty("--my", "0.35");
    });
  });
})();
