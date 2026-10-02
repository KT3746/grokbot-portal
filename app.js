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

  /* ---- Wave 2: jogados hoje / último jogado (PT-BR, non-spammy) ---- */
  const PLAYED_KEY = "sala-hub-played-v1";
  const todayKey = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const readPlayed = () => {
    try {
      const raw = localStorage.getItem(PLAYED_KEY);
      if (!raw) return { day: todayKey(), ids: [], last: null };
      const data = JSON.parse(raw);
      if (!data || data.day !== todayKey()) {
        return { day: todayKey(), ids: [], last: data?.last || null };
      }
      return {
        day: data.day,
        ids: Array.isArray(data.ids) ? data.ids : [],
        last: data.last || null,
      };
    } catch (_) {
      return { day: todayKey(), ids: [], last: null };
    }
  };

  const writePlayed = (data) => {
    try {
      localStorage.setItem(PLAYED_KEY, JSON.stringify(data));
    } catch (_) {}
  };

  const markPlayed = (gameId) => {
    if (!gameId) return;
    const data = readPlayed();
    data.day = todayKey();
    if (!data.ids.includes(gameId)) data.ids.push(gameId);
    data.last = gameId;
    writePlayed(data);
    paintPlayed(data);
  };

  const paintPlayed = (data) => {
    const cards = document.querySelectorAll(".card-live[data-game]");
    cards.forEach((card) => {
      const id = card.getAttribute("data-game");
      const today = data.ids.includes(id);
      const isLast = data.last === id;
      card.classList.toggle("is-played-today", today);
      card.classList.toggle("is-last-played", isLast);

      let badge = card.querySelector(".played-badge");
      if (today || isLast) {
        if (!badge) {
          const meta = card.querySelector(".card-meta");
          if (!meta) return;
          badge = document.createElement("span");
          badge.className = "played-badge";
          const status = meta.querySelector(".status");
          if (status) status.insertAdjacentElement("afterend", badge);
          else meta.appendChild(badge);
        }
        badge.textContent = isLast ? "Último" : "Hoje";
        badge.hidden = false;
      } else if (badge) {
        badge.hidden = true;
      }
    });

    const note = document.getElementById("hub-played-note");
    if (note) {
      if (data.ids.length > 0) {
        const n = data.ids.length;
        note.textContent =
          n === 1
            ? "1 jogo tocado hoje — destaque suave nos cards."
            : `${n} jogos tocados hoje — destaque suave nos cards.`;
        note.hidden = false;
        note.removeAttribute("hidden");
      } else {
        note.hidden = true;
        note.setAttribute("hidden", "");
      }
    }
  };

  paintPlayed(readPlayed());

  document.querySelectorAll(".card-live[data-game]").forEach((card) => {
    const gameId = card.getAttribute("data-game");
    card.querySelectorAll("a[href]").forEach((link) => {
      link.addEventListener(
        "click",
        () => {
          markPlayed(gameId);
        },
        { passive: true }
      );
    });
  });

  /* ---- Wave 2: genre filter chips + Surpresa ---- */
  const chips = document.querySelectorAll(".genre-chips .chip");
  const gridItems = document.querySelectorAll(".grid-live > li");

  const applyFilter = (genre) => {
    gridItems.forEach((li) => {
      const card = li.querySelector(".card-live");
      const g = card?.getAttribute("data-genre") || "";
      const show = genre === "todos" || g === genre;
      li.hidden = !show;
      li.classList.toggle("is-filtered-out", !show);
      if (card) {
        card.toggleAttribute("aria-hidden", !show);
      }
    });
  };

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const genre = chip.getAttribute("data-filter") || "todos";
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      applyFilter(genre);
    });
  });

  const surpresa = document.getElementById("hub-surpresa");
  if (surpresa) {
    surpresa.addEventListener("click", () => {
      const visible = [...document.querySelectorAll(".grid-live > li:not([hidden]) .card-live[data-game]")];
      if (!visible.length) return;
      const pick = visible[Math.floor(Math.random() * visible.length)];
      const gameId = pick.getAttribute("data-game");
      markPlayed(gameId);

      // Prefer primary play link
      let link =
        pick.querySelector("a.btn-primary") ||
        pick.querySelector("a.card-hit") ||
        pick.querySelector("a[href]");
      if (!link) return;

      if (!reduce) {
        pick.classList.add("is-surprise-flash");
        window.setTimeout(() => pick.classList.remove("is-surprise-flash"), 700);
      }

      const href = link.getAttribute("href");
      if (href) {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    });
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
