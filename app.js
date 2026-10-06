(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const haptic = (pattern = 12) => {
    try {
      if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) {}
  };

  /* First-visit tip — dismiss once (v2 = onda 4 copy) */
  const TIP_KEY = "sala-hub-tip-dismissed-v2";
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
      haptic(8);
      try {
        localStorage.setItem(TIP_KEY, "1");
      } catch (_) {}
    };
    tip.querySelector(".hub-tip-dismiss")?.addEventListener("click", dismiss);
  }

  /* ---- Wave 2: jogados hoje / último jogado (PT-BR, non-spammy) ---- */
  const PLAYED_KEY = "sala-hub-played-v1";
  const FAV_KEY = "sala-hub-favs-v1";
  const SORT_KEY = "sala-hub-sort-v1";

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
      if (!raw) return { day: todayKey(), ids: [], last: null, order: [] };
      const data = JSON.parse(raw);
      if (!data || data.day !== todayKey()) {
        return {
          day: todayKey(),
          ids: [],
          last: data?.last || null,
          order: Array.isArray(data?.order) ? data.order : [],
        };
      }
      return {
        day: data.day,
        ids: Array.isArray(data.ids) ? data.ids : [],
        last: data.last || null,
        order: Array.isArray(data.order) ? data.order : [],
      };
    } catch (_) {
      return { day: todayKey(), ids: [], last: null, order: [] };
    }
  };

  const writePlayed = (data) => {
    try {
      localStorage.setItem(PLAYED_KEY, JSON.stringify(data));
    } catch (_) {}
  };

  const readFavs = () => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data.filter((x) => typeof x === "string") : [];
    } catch (_) {
      return [];
    }
  };

  const writeFavs = (ids) => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(ids));
    } catch (_) {}
  };

  let favIds = readFavs();

  const gameTitle = (card) => {
    const h3 = card?.querySelector("h3");
    return h3 ? h3.textContent.trim() : "";
  };

  const gameBlurb = (card) => {
    const p = card?.querySelector(".blurb");
    return p ? p.textContent.trim() : "";
  };

  const playLinkFor = (card) => {
    if (!card) return null;
    return (
      card.querySelector("a.btn-primary") ||
      card.querySelector("a.btn-celular") ||
      card.querySelector("a.card-hit") ||
      card.querySelector("a[href]")
    );
  };

  /* ---- Wave 3/4: Continuar (último jogado) + blurb ---- */
  const paintContinuar = (data) => {
    const strip = document.getElementById("hub-continuar");
    const nameEl = document.getElementById("hub-continuar-name");
    const blurbEl = document.getElementById("hub-continuar-blurb");
    const btn = document.getElementById("hub-continuar-btn");
    if (!strip || !nameEl || !btn) return;

    const lastId = data?.last;
    const card = lastId
      ? document.querySelector(`.card-live[data-game="${CSS.escape(lastId)}"]`)
      : null;
    const link = playLinkFor(card);
    const title = gameTitle(card);

    if (!lastId || !card || !link || !title) {
      strip.hidden = true;
      strip.setAttribute("hidden", "");
      return;
    }

    nameEl.textContent = title;
    if (blurbEl) blurbEl.textContent = gameBlurb(card);
    strip.hidden = false;
    strip.removeAttribute("hidden");
    strip.setAttribute("data-game", lastId);
    btn.onclick = () => {
      haptic([18, 30, 18]);
      markPlayed(lastId);
      const href = link.getAttribute("href");
      if (href) window.open(href, "_blank", "noopener,noreferrer");
    };
  };

  const markPlayed = (gameId) => {
    if (!gameId) return;
    const data = readPlayed();
    data.day = todayKey();
    if (!data.ids.includes(gameId)) data.ids.push(gameId);
    data.last = gameId;
    data.order = [gameId, ...(data.order || []).filter((id) => id !== gameId)].slice(0, 24);
    writePlayed(data);
    paintPlayed(data);
    paintContinuar(data);
    if (currentSort === "recent") applySort(currentSort);
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

  /* ---- Wave 3: selo Novo nos cards data-fresh ---- */
  document.querySelectorAll('.card-live[data-fresh="1"]').forEach((card) => {
    const meta = card.querySelector(".card-meta");
    if (!meta || meta.querySelector(".fresh-badge")) return;
    const badge = document.createElement("span");
    badge.className = "fresh-badge";
    badge.textContent = "Novo";
    const genre = meta.querySelector(".genre");
    if (genre) genre.insertAdjacentElement("afterend", badge);
    else meta.prepend(badge);
  });

  /* ---- Wave 4: favoritos (★) ---- */
  const paintFavs = () => {
    document.querySelectorAll(".card-live[data-game]").forEach((card) => {
      const id = card.getAttribute("data-game");
      const on = favIds.includes(id);
      card.classList.toggle("is-fav", on);
      const btn = card.querySelector(".fav-btn");
      if (btn) {
        btn.setAttribute("aria-pressed", on ? "true" : "false");
        btn.setAttribute("aria-label", on ? "Remover dos favoritos" : "Adicionar aos favoritos");
        btn.classList.toggle("is-on", on);
        btn.textContent = on ? "★" : "☆";
      }
    });
  };

  document.querySelectorAll(".card-live[data-game]").forEach((card) => {
    if (card.querySelector(".fav-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fav-btn";
    btn.textContent = "☆";
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("aria-label", "Adicionar aos favoritos");
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = card.getAttribute("data-game");
      if (!id) return;
      if (favIds.includes(id)) {
        favIds = favIds.filter((x) => x !== id);
        haptic(10);
      } else {
        favIds = [...favIds, id];
        haptic([12, 40, 18]);
      }
      writeFavs(favIds);
      paintFavs();
      if (currentFilter === "favoritos") applyFilter(currentFilter);
    });
    card.appendChild(btn);
  });

  const playedNow = readPlayed();
  paintPlayed(playedNow);
  paintContinuar(playedNow);
  paintFavs();

  document.querySelectorAll(".card-live[data-game]").forEach((card) => {
    const gameId = card.getAttribute("data-game");
    card.querySelectorAll("a[href]").forEach((link) => {
      link.addEventListener(
        "click",
        () => {
          haptic(10);
          markPlayed(gameId);
        },
        { passive: true }
      );
    });
  });

  /* ---- Wave 2/3/4: genre filter + Favoritos + Surpresa ---- */
  const chips = document.querySelectorAll(".genre-chips .chip");
  const grid = document.querySelector(".grid-live");
  const gridItems = () => [...document.querySelectorAll(".grid-live > li")];
  const filterCount = document.getElementById("hub-filter-count");
  let currentFilter = "todos";
  let currentSort = "fresh";
  try {
    const saved = localStorage.getItem(SORT_KEY);
    if (saved === "az" || saved === "recent" || saved === "fresh") currentSort = saved;
  } catch (_) {}

  const updateFilterCount = (genre) => {
    if (!filterCount) return;
    const items = gridItems();
    const visible = items.filter((li) => !li.hidden).length;
    const total = items.length;
    if ((genre === "todos" || !genre) && visible === total) {
      filterCount.hidden = true;
      filterCount.setAttribute("hidden", "");
      return;
    }
    if (genre === "favoritos") {
      filterCount.textContent =
        visible === 0
          ? "Nenhum favorito ainda — toque no ★ do card"
          : visible === 1
            ? "Mostrando 1 favorito"
            : `Mostrando ${visible} favoritos`;
    } else {
      filterCount.textContent =
        visible === 1
          ? "Mostrando 1 jogo neste gênero"
          : `Mostrando ${visible} jogos neste gênero`;
    }
    filterCount.hidden = false;
    filterCount.removeAttribute("hidden");
  };

  const applyFilter = (genre) => {
    currentFilter = genre;
    gridItems().forEach((li) => {
      const card = li.querySelector(".card-live");
      const g = card?.getAttribute("data-genre") || "";
      const id = card?.getAttribute("data-game") || "";
      let show;
      if (genre === "todos") show = true;
      else if (genre === "favoritos") show = favIds.includes(id);
      else show = g === genre;
      li.hidden = !show;
      li.classList.toggle("is-filtered-out", !show);
      if (card) {
        card.toggleAttribute("aria-hidden", !show);
      }
    });
    updateFilterCount(genre);
  };

  const applySort = (mode) => {
    currentSort = mode;
    try {
      localStorage.setItem(SORT_KEY, mode);
    } catch (_) {}
    if (!grid) return;
    const items = gridItems();
    const data = readPlayed();
    const orderIndex = (id) => {
      const i = (data.order || []).indexOf(id);
      return i === -1 ? 999 : i;
    };
    items.sort((a, b) => {
      const ca = a.querySelector(".card-live");
      const cb = b.querySelector(".card-live");
      const ida = ca?.getAttribute("data-game") || "";
      const idb = cb?.getAttribute("data-game") || "";
      const ta = gameTitle(ca);
      const tb = gameTitle(cb);
      if (mode === "az") return ta.localeCompare(tb, "pt-BR");
      if (mode === "recent") {
        const da = orderIndex(ida);
        const db = orderIndex(idb);
        if (da !== db) return da - db;
        return ta.localeCompare(tb, "pt-BR");
      }
      // fresh: keep original DOM order via data-fresh then title
      const fa = ca?.getAttribute("data-fresh") === "1" ? 0 : 1;
      const fb = cb?.getAttribute("data-fresh") === "1" ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return 0; // preserve relative order among fresh
    });
    if (mode === "fresh") {
      // restore document order using original index attributes
      items.sort((a, b) => {
        const ia = Number(a.getAttribute("data-ord") || 0);
        const ib = Number(b.getAttribute("data-ord") || 0);
        return ia - ib;
      });
    }
    items.forEach((li) => grid.appendChild(li));
  };

  // stamp original order once
  gridItems().forEach((li, i) => li.setAttribute("data-ord", String(i)));

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const genre = chip.getAttribute("data-filter") || "todos";
      haptic(8);
      chips.forEach((c) => {
        const on = c === chip;
        c.classList.toggle("is-active", on);
        c.setAttribute("aria-pressed", on ? "true" : "false");
      });
      applyFilter(genre);
      try {
        chip.scrollIntoView({
          inline: "center",
          block: "nearest",
          behavior: reduce ? "auto" : "smooth",
        });
      } catch (_) {}
    });
  });

  document.querySelectorAll(".chip-sort").forEach((chip) => {
    const mode = chip.getAttribute("data-sort") || "fresh";
    const on = mode === currentSort;
    chip.classList.toggle("is-active", on);
    chip.setAttribute("aria-pressed", on ? "true" : "false");
    chip.addEventListener("click", () => {
      haptic([8, 20, 8]);
      document.querySelectorAll(".chip-sort").forEach((c) => {
        const active = c === chip;
        c.classList.toggle("is-active", active);
        c.setAttribute("aria-pressed", active ? "true" : "false");
      });
      applySort(mode);
    });
  });

  applySort(currentSort);

  const surpresa = document.getElementById("hub-surpresa");
  if (surpresa) {
    surpresa.addEventListener("click", () => {
      const visible = [
        ...document.querySelectorAll(
          ".grid-live > li:not([hidden]) .card-live[data-game]"
        ),
      ];
      if (!visible.length) return;
      haptic([16, 40, 16, 40, 24]);
      const pick = visible[Math.floor(Math.random() * visible.length)];
      const gameId = pick.getAttribute("data-game");
      markPlayed(gameId);

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
      const x =
        (event.clientX ?? event.touches?.[0]?.clientX ?? box.left + box.width / 2) -
        box.left;
      const y =
        (event.clientY ?? event.touches?.[0]?.clientY ?? box.top + box.height / 2) -
        box.top;
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
        if (event.target?.closest?.(".fav-btn")) return;
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
