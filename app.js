(function () {
  "use strict";

  const STORAGE_KEY = "watchlist-watched-v1";
  const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };

  const els = {
    title: document.getElementById("site-title"),
    meta: document.getElementById("site-meta"),
    stats: document.getElementById("stats"),
    categoryFilters: document.getElementById("category-filters"),
    priorityFilters: document.getElementById("priority-filters"),
    watchedFilters: document.getElementById("watched-filters"),
    clearFilters: document.getElementById("clear-filters"),
    error: document.getElementById("error"),
    loading: document.getElementById("loading"),
    list: document.getElementById("list"),
  };

  let data = null;
  let selectedCategories = new Set();
  let selectedPriorities = new Set();
  let watchedFilter = "all"; // all | watched | unwatched

  function loadWatchedMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveWatchedMap(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function isWatched(id) {
    return !!loadWatchedMap()[id];
  }

  function setWatched(id, value) {
    const map = loadWatchedMap();
    if (value) map[id] = true;
    else delete map[id];
    saveWatchedMap(map);
  }

  function watchedCount(items) {
    const map = loadWatchedMap();
    return items.reduce((n, it) => n + (map[it.id] ? 1 : 0), 0);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sortItems(items) {
    return items.slice().sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return (b.date || "").localeCompare(a.date || "");
    });
  }

  function getFiltered() {
    if (!data) return [];
    return sortItems(data.items).filter((it) => {
      if (selectedCategories.size && !selectedCategories.has(it.category)) {
        return false;
      }
      if (selectedPriorities.size && !selectedPriorities.has(it.priority)) {
        return false;
      }
      const w = isWatched(it.id);
      if (watchedFilter === "watched" && !w) return false;
      if (watchedFilter === "unwatched" && w) return false;
      return true;
    });
  }

  function updateStats() {
    if (!data) return;
    const total = data.items.length;
    const done = watchedCount(data.items);
    const shown = getFiltered().length;
    els.stats.textContent =
      `共 ${total} 条 · 已看 ${done} · 当前显示 ${shown}`;
  }

  function renderFilters() {
    els.categoryFilters.innerHTML = "";
    (data.categories || []).forEach((cat) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip" + (selectedCategories.has(cat) ? " active" : "");
      btn.textContent = cat;
      btn.dataset.category = cat;
      btn.addEventListener("click", () => {
        if (selectedCategories.has(cat)) selectedCategories.delete(cat);
        else selectedCategories.add(cat);
        renderFilters();
        renderList();
      });
      els.categoryFilters.appendChild(btn);
    });

    els.priorityFilters.innerHTML = "";
    (data.priorities || ["P0", "P1", "P2"]).forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "chip" + (selectedPriorities.has(p) ? " active" : "");
      btn.dataset.priority = p;
      btn.textContent = p;
      btn.addEventListener("click", () => {
        if (selectedPriorities.has(p)) selectedPriorities.delete(p);
        else selectedPriorities.add(p);
        renderFilters();
        renderList();
      });
      els.priorityFilters.appendChild(btn);
    });
  }

  function renderCard(it) {
    const watched = isWatched(it.id);
    const card = document.createElement("article");
    card.className = "card" + (watched ? " is-watched" : "");
    card.dataset.id = it.id;

    const linksHtml = (it.urls || [])
      .map(
        (u) =>
          `<a href="${escapeHtml(u.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u.label)}</a>`
      )
      .join("");

    card.innerHTML = `
      <div class="card-top">
        <div class="card-guest">${escapeHtml(it.guest || "")}</div>
        <div class="card-badges">
          <span class="badge badge-${escapeHtml((it.priority || "").toLowerCase())}">${escapeHtml(it.priority || "")}</span>
          <span class="badge badge-cat">${escapeHtml(it.category || "")}</span>
        </div>
      </div>
      <h2 class="card-title">${escapeHtml(it.title || "")}</h2>
      <div class="card-meta">
        <span>${escapeHtml(it.show || "")}</span>
        <span>${escapeHtml(it.date || "")}</span>
        <span>${escapeHtml(it.duration || "")}</span>
      </div>
      <p class="card-summary">${escapeHtml(it.summary || "")}</p>
      ${it.advice ? `<p class="card-advice">${escapeHtml(it.advice)}</p>` : ""}
      <div class="card-footer">
        <div class="links">${linksHtml}</div>
        <label class="watched-toggle${watched ? " is-on" : ""}">
          <input type="checkbox" ${watched ? "checked" : ""} data-id="${escapeHtml(it.id)}" />
          已看
        </label>
      </div>
    `;

    const cb = card.querySelector('input[type="checkbox"]');
    cb.addEventListener("change", () => {
      setWatched(it.id, cb.checked);
      renderList();
    });

    return card;
  }

  function renderList() {
    const items = getFiltered();
    els.list.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "没有符合条件的条目。";
      els.list.appendChild(empty);
    } else {
      items.forEach((it) => els.list.appendChild(renderCard(it)));
    }
    updateStats();
  }

  function clearAllFilters() {
    selectedCategories.clear();
    selectedPriorities.clear();
    watchedFilter = "all";
    els.watchedFilters.querySelectorAll(".chip").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.watched === "all");
    });
    renderFilters();
    renderList();
  }

  els.clearFilters.addEventListener("click", clearAllFilters);

  els.watchedFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    watchedFilter = btn.dataset.watched;
    els.watchedFilters.querySelectorAll(".chip").forEach((b) => {
      b.classList.toggle("active", b === btn);
    });
    renderList();
  });

  function showError(msg) {
    els.loading.hidden = true;
    els.list.hidden = true;
    els.error.hidden = false;
    els.error.textContent = msg;
  }

  async function init() {
    try {
      const res = await fetch("./data.json", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`无法加载 data.json（HTTP ${res.status}）`);
      }
      data = await res.json();
      if (!data || !Array.isArray(data.items)) {
        throw new Error("data.json 格式无效：缺少 items 数组");
      }

      els.title.textContent = data.title || "观看列表";
      document.title = data.title || "观看列表";
      const parts = [];
      if (data.lastUpdated) parts.push(`更新于 ${data.lastUpdated}`);
      if (data.maintainer) parts.push(`维护 ${data.maintainer}`);
      els.meta.textContent = parts.join(" · ");

      els.loading.hidden = true;
      els.list.hidden = false;
      renderFilters();
      renderList();
    } catch (err) {
      console.error(err);
      showError(
        "加载失败：" +
          (err && err.message ? err.message : String(err)) +
          "。请检查网络或 data.json 是否可访问。"
      );
    }
  }

  init();
})();
