(() => {
  "use strict";

  /* ===================== DATA LAYER ===================== */

  const STORAGE_KEY = "hufkarte_data_v1";

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { horses: [] };
      const parsed = JSON.parse(raw);
      if (!parsed.horses) return { horses: [] };
      return parsed;
    } catch (e) {
      console.error("Fehler beim Laden der Daten", e);
      return { horses: [] };
    }
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  const state = {
    data: loadData(),
    currentHorseId: null,
    currentVisitId: null,
    editingHorseId: null, // set when horse form is in edit mode
  };

  function getHorse(id) {
    return state.data.horses.find(h => h.id === id);
  }

  function sortedVisits(horse) {
    return [...horse.visits].sort((a, b) => b.date.localeCompare(a.date));
  }

  /* ===================== NAVIGATION ===================== */

  const screens = document.querySelectorAll(".screen");
  const pageTitle = document.getElementById("pageTitle");
  const backBtn = document.getElementById("backBtn");
  const addBtn = document.getElementById("addBtn");
  const navBtns = document.querySelectorAll(".nav-btn");

  const navStack = [];

  function showScreen(id, { title, showBack = false, showAdd = false, onAdd = null, push = true } = {}) {
    screens.forEach(s => s.classList.toggle("active", s.id === id));
    pageTitle.textContent = title || "Hufkarte";
    backBtn.hidden = !showBack;
    addBtn.hidden = !showAdd;
    addBtn.onclick = onAdd;

    navBtns.forEach(b => b.classList.toggle("active", b.dataset.nav === id || (id !== "screen-horses" && id !== "screen-settings" && b.dataset.nav === "screen-horses")));

    if (push) navStack.push({ id, opts: { title, showBack, showAdd, onAdd, push: false } });
  }

  backBtn.addEventListener("click", () => {
    navStack.pop(); // remove current
    const prev = navStack.pop();
    if (prev) {
      navigate(prev.id, prev.opts);
    } else {
      navigate("screen-horses");
    }
  });

  function navigate(id, opts) {
    if (id === "screen-horses") renderHorseList();
    showScreen(id, opts);
  }

  navBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      navStack.length = 0;
      if (btn.dataset.nav === "screen-horses") {
        renderHorseList();
        showScreen("screen-horses", { title: "Meine Pferde", showAdd: true, onAdd: () => openHorseForm(null) });
      } else {
        showScreen("screen-settings", { title: "Einstellungen" });
      }
    });
  });

  /* ===================== TOAST ===================== */

  function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  /* ===================== HORSE LIST ===================== */

  const horseListEl = document.getElementById("horseList");
  const horseEmptyEl = document.getElementById("horseEmpty");
  const horseSearch = document.getElementById("horseSearch");

  function formatCost(value) {
    const n = parseFloat(value);
    if (isNaN(n)) return "";
    return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  }

  function renderHorseList() {
    const query = (horseSearch.value || "").trim().toLowerCase();
    const horses = state.data.horses
      .filter(h => {
        if (!query) return true;
        return [h.name, h.besitzer, h.stall].some(v => (v || "").toLowerCase().includes(query));
      })
      .sort((a, b) => a.name.localeCompare(b.name, "de"));

    horseListEl.innerHTML = "";
    horseEmptyEl.hidden = state.data.horses.length !== 0;

    horses.forEach(h => {
      const visits = sortedVisits(h);
      const last = visits[0];
      const btn = document.createElement("button");
      btn.className = "horse-card";
      btn.innerHTML = `
        <p class="name">${escapeHtml(h.name)}</p>
        <p class="sub">${escapeHtml(h.besitzer || "")}${h.stall ? " · " + escapeHtml(h.stall) : ""}</p>
        ${last ? `<p class="last">Letzter Termin: ${formatDate(last.date)}</p>` : `<p class="last muted">Noch kein Termin</p>`}
      `;
      btn.addEventListener("click", () => openHorseDetail(h.id));
      horseListEl.appendChild(btn);
    });

    if (query && horses.length === 0 && state.data.horses.length > 0) {
      horseListEl.innerHTML = `<p class="muted" style="text-align:center;margin-top:20px;">Keine Treffer.</p>`;
    }
  }

  horseSearch.addEventListener("input", renderHorseList);

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  /* ===================== HORSE FORM ===================== */

  const horseForm = document.getElementById("horseForm");
  const hfDelete = document.getElementById("hf-delete");

  function openHorseForm(horseId) {
    state.editingHorseId = horseId;
    const h = horseId ? getHorse(horseId) : null;

    document.getElementById("hf-name").value = h ? h.name : "";
    document.getElementById("hf-rasse").value = h ? h.rasse || "" : "";
    document.getElementById("hf-geschlecht").value = h ? h.geschlecht || "" : "";
    document.getElementById("hf-jahr").value = h ? h.jahr || "" : "";
    document.getElementById("hf-besitzer").value = h ? h.besitzer || "" : "";
    document.getElementById("hf-stall").value = h ? h.stall || "" : "";
    document.getElementById("hf-notizen").value = h ? h.notizen || "" : "";

    hfDelete.hidden = !h;

    navigate("screen-horse-form", { title: h ? "Pferd bearbeiten" : "Neues Pferd", showBack: true });
  }

  horseForm.addEventListener("submit", e => {
    e.preventDefault();
    const name = document.getElementById("hf-name").value.trim();
    const besitzer = document.getElementById("hf-besitzer").value.trim();
    if (!name || !besitzer) return;

    if (state.editingHorseId) {
      const h = getHorse(state.editingHorseId);
      h.name = name;
      h.rasse = document.getElementById("hf-rasse").value.trim();
      h.geschlecht = document.getElementById("hf-geschlecht").value;
      h.jahr = document.getElementById("hf-jahr").value;
      h.besitzer = besitzer;
      h.stall = document.getElementById("hf-stall").value.trim();
      h.notizen = document.getElementById("hf-notizen").value.trim();
      saveData();
      toast("Pferd aktualisiert");
      openHorseDetail(h.id, { replace: true });
    } else {
      const h = {
        id: uid(),
        name,
        rasse: document.getElementById("hf-rasse").value.trim(),
        geschlecht: document.getElementById("hf-geschlecht").value,
        jahr: document.getElementById("hf-jahr").value,
        besitzer,
        stall: document.getElementById("hf-stall").value.trim(),
        notizen: document.getElementById("hf-notizen").value.trim(),
        visits: [],
      };
      state.data.horses.push(h);
      saveData();
      toast("Pferd angelegt");
      openHorseDetail(h.id, { replace: true });
    }
  });

  hfDelete.addEventListener("click", () => {
    if (!state.editingHorseId) return;
    if (!confirm("Dieses Pferd inkl. aller Termine wirklich löschen?")) return;
    state.data.horses = state.data.horses.filter(h => h.id !== state.editingHorseId);
    saveData();
    toast("Pferd gelöscht");
    navStack.length = 0;
    navigate("screen-horses", { title: "Meine Pferde", showAdd: true, onAdd: () => openHorseForm(null) });
  });

  /* ===================== HORSE DETAIL ===================== */

  function openHorseDetail(horseId, { replace = false } = {}) {
    state.currentHorseId = horseId;
    const h = getHorse(horseId);
    if (!h) { navigate("screen-horses"); return; }

    document.getElementById("hd-name").textContent = h.name;
    const metaParts = [];
    if (h.rasse) metaParts.push(h.rasse);
    if (h.geschlecht) metaParts.push(h.geschlecht);
    if (h.jahr) metaParts.push("geb. " + h.jahr);
    document.getElementById("hd-meta").textContent = metaParts.join(" · ");
    document.getElementById("hd-besitzer").textContent = "Besitzer: " + (h.besitzer || "—") + (h.stall ? " · " + h.stall : "");
    document.getElementById("hd-notizen").textContent = h.notizen || "";
    document.getElementById("hd-notizen").hidden = !h.notizen;

    const visits = sortedVisits(h);
    const last = visits[0];
    const lastInfo = document.getElementById("hd-lastVisitInfo");
    if (last) {
      const kleberInfo = visits.find(v => v.kleberDatum);
      lastInfo.innerHTML = `<strong>${formatDate(last.date)}</strong>${last.treatment ? "<br>" + escapeHtml(last.treatment) : ""}` +
        (last.cost ? `<br><span class="muted small">Kosten: ${formatCost(last.cost)}</span>` : "") +
        (kleberInfo ? `<br><span class="muted small">Klebebeschläge zuletzt: ${formatDate(kleberInfo.kleberDatum)}</span>` : "");
    } else {
      lastInfo.textContent = "Noch kein Termin erfasst.";
    }

    const visitListEl = document.getElementById("visitList");
    visitListEl.innerHTML = "";
    if (visits.length === 0) {
      visitListEl.innerHTML = `<p class="muted" style="text-align:center;margin-top:10px;">Noch keine Termine.</p>`;
    }
    visits.forEach(v => {
      const btn = document.createElement("button");
      btn.className = "visit-card";
      btn.innerHTML = `
        <p class="vdate">${formatDate(v.date)}${v.cost ? ` · ${formatCost(v.cost)}` : ""}</p>
        <p class="vmeta">${escapeHtml(v.treatment || "Keine Angabe zur Behandlung")}</p>
      `;
      btn.addEventListener("click", () => openVisitDetailOrEdit(v.id));
      visitListEl.appendChild(btn);
    });

    document.getElementById("hd-editBtn").onclick = () => openHorseForm(h.id);
    document.getElementById("hd-newVisitBtn").onclick = () => openVisitForm(h.id, null);

    if (replace) {
      navStack.length = 0;
    }
    navigate("screen-horse-detail", { title: h.name, showBack: true });
  }

  function openVisitDetailOrEdit(visitId) {
    openVisitForm(state.currentHorseId, visitId);
  }

  /* ===================== VISIT FORM (hoof measurements) ===================== */

  const HOOVES = [
    { key: "vl", label: "Vorderhuf links" },
    { key: "vr", label: "Vorderhuf rechts" },
    { key: "hl", label: "Hinterhuf links" },
    { key: "hr", label: "Hinterhuf rechts" },
  ];
  const POSITIONS = [
    { key: "oben", label: "Oben" },
    { key: "mitte", label: "Mitte" },
    { key: "unten", label: "Unten" },
  ];

  const hoofGrid = document.getElementById("hoofGrid");
  const visitForm = document.getElementById("visitForm");
  const vfDelete = document.getElementById("vf-delete");

  const QUERBALANCE_OPTIONS = [
    { value: "", label: "— Querbalance —" },
    { value: "gut", label: "Gut" },
    { value: "gleich", label: "Gleich wie zuvor" },
    { value: "schlecht", label: "Schlecht" },
  ];

  function emptyHooves() {
    const obj = {};
    HOOVES.forEach(hf => {
      obj[hf.key] = { querbalance: "" };
      POSITIONS.forEach(p => { obj[hf.key][p.key] = { anfang: "", ende: "" }; });
    });
    return obj;
  }

  function buildHoofGrid(hooves, prevHooves) {
    hoofGrid.innerHTML = "";
    HOOVES.forEach(hf => {
      const block = document.createElement("div");
      block.className = "hoof-block";
      block.innerHTML = `<h4>${hf.label}</h4>`;

      const qbRow = document.createElement("div");
      qbRow.className = "querbalance-row";
      const currentQb = hooves[hf.key].querbalance || "";
      qbRow.innerHTML = `
        <label>Querbalance</label>
        <select data-hoof-qb="${hf.key}" class="${currentQb ? "qb-" + currentQb : ""}">
          ${QUERBALANCE_OPTIONS.map(o => `<option value="${o.value}" ${o.value === currentQb ? "selected" : ""}>${o.label}</option>`).join("")}
        </select>
      `;
      block.appendChild(qbRow);

      POSITIONS.forEach(p => {
        const val = hooves[hf.key][p.key];
        const prevVal = prevHooves ? prevHooves[hf.key][p.key] : null;

        if (prevVal && prevVal.ende) {
          const hint = document.createElement("div");
          hint.className = "prev-hint";
          hint.textContent = `${p.label} – letztes Mal (Ende): ${prevVal.ende}°`;
          block.appendChild(hint);
        }

        const row = document.createElement("div");
        row.className = "hoof-row";
        row.innerHTML = `
          <label>${p.label}</label>
          <div style="display:flex; gap:6px;">
            <input type="number" step="0.1" inputmode="decimal" placeholder="Anfang" data-hoof="${hf.key}" data-pos="${p.key}" data-field="anfang" value="${val.anfang}">
            <input type="number" step="0.1" inputmode="decimal" placeholder="Ende" data-hoof="${hf.key}" data-pos="${p.key}" data-field="ende" value="${val.ende}">
          </div>
          <span class="delta same" data-delta-for="${hf.key}-${p.key}"></span>
        `;
        block.appendChild(row);
      });

      hoofGrid.appendChild(block);
    });

    hoofGrid.querySelectorAll("input").forEach(inp => {
      inp.addEventListener("input", () => updateDelta(inp, prevHooves));
    });

    hoofGrid.querySelectorAll("select[data-hoof-qb]").forEach(sel => {
      sel.addEventListener("change", () => {
        sel.className = sel.value ? "qb-" + sel.value : "";
      });
    });

    if (prevHooves) {
      hoofGrid.querySelectorAll("input[data-field='anfang']").forEach(inp => updateDelta(inp, prevHooves));
    }
  }

  function updateDelta(inp, prevHooves) {
    if (!prevHooves) return;
    const hoofKey = inp.dataset.hoof, posKey = inp.dataset.pos, field = inp.dataset.field;
    if (field !== "anfang") return;
    const deltaEl = hoofGrid.querySelector(`[data-delta-for="${hoofKey}-${posKey}"]`);
    const prevEnde = parseFloat(prevHooves[hoofKey][posKey].ende);
    const curAnfang = parseFloat(inp.value);
    if (isNaN(prevEnde) || isNaN(curAnfang)) {
      deltaEl.textContent = "";
      return;
    }
    const diff = +(curAnfang - prevEnde).toFixed(1);
    if (diff > 0) {
      deltaEl.textContent = `+${diff}°`;
      deltaEl.className = "delta up";
    } else if (diff < 0) {
      deltaEl.textContent = `${diff}°`;
      deltaEl.className = "delta down";
    } else {
      deltaEl.textContent = `±0°`;
      deltaEl.className = "delta same";
    }
  }

  function readHoofGrid() {
    const hooves = emptyHooves();
    hoofGrid.querySelectorAll("input").forEach(inp => {
      hooves[inp.dataset.hoof][inp.dataset.pos][inp.dataset.field] = inp.value.trim();
    });
    hoofGrid.querySelectorAll("select[data-hoof-qb]").forEach(sel => {
      hooves[sel.dataset.hoofQb].querbalance = sel.value;
    });
    return hooves;
  }

  function openVisitForm(horseId, visitId) {
    state.currentHorseId = horseId;
    state.currentVisitId = visitId;
    const h = getHorse(horseId);
    const visits = sortedVisits(h);
    const visit = visitId ? h.visits.find(v => v.id === visitId) : null;

    // find previous visit (chronologically before this one, or the most recent if creating new)
    let prevVisit = null;
    if (visit) {
      const idx = visits.findIndex(v => v.id === visit.id);
      prevVisit = visits[idx + 1] || null;
    } else {
      prevVisit = visits[0] || null;
    }

    document.getElementById("vf-date").value = visit ? visit.date : new Date().toISOString().slice(0, 10);
    document.getElementById("vf-treatment").value = visit ? visit.treatment || "" : "";
    document.getElementById("vf-notes").value = visit ? visit.notes || "" : "";
    document.getElementById("vf-nextdate").value = visit ? visit.nextdate || "" : "";

    document.getElementById("vf-cost").value = visit ? visit.cost || "" : "";

    const kleberPositionSel = document.getElementById("vf-kleber-position");
    kleberPositionSel.value = visit ? visit.kleberPosition || "keine" : "keine";
    document.getElementById("vf-kleber-groesse-vorne").value = visit ? visit.kleberGroesseVorne || "" : "";
    document.getElementById("vf-kleber-groesse-hinten").value = visit ? visit.kleberGroesseHinten || "" : "";
    updateKleberGroesseVisibility();

    let kleberDatum = visit ? visit.kleberDatum || "" : "";
    if (!kleberDatum) {
      const others = visit ? visits.filter(v => v.id !== visit.id) : visits;
      const lastKnown = others.find(v => v.kleberDatum);
      kleberDatum = lastKnown ? lastKnown.kleberDatum : "";
    }
    document.getElementById("vf-kleber-datum").value = kleberDatum;

    buildHoofGrid(visit ? visit.hooves : emptyHooves(), prevVisit ? prevVisit.hooves : null);

    vfDelete.hidden = !visit;

    navigate("screen-visit-form", { title: visit ? "Termin bearbeiten" : "Neuer Termin", showBack: true });
  }

  function updateKleberGroesseVisibility() {
    const position = document.getElementById("vf-kleber-position").value;
    document.getElementById("vf-kleber-groesse-vorne-wrap").hidden = !(position === "vorne" || position === "beide");
    document.getElementById("vf-kleber-groesse-hinten-wrap").hidden = !(position === "hinten" || position === "beide");
  }
  document.getElementById("vf-kleber-position").addEventListener("change", updateKleberGroesseVisibility);

  visitForm.addEventListener("submit", e => {
    e.preventDefault();
    const h = getHorse(state.currentHorseId);
    if (!h) return;
    const date = document.getElementById("vf-date").value;
    if (!date) return;

    const kleberPosition = document.getElementById("vf-kleber-position").value;
    const kleberDatum = kleberPosition !== "keine" ? date : document.getElementById("vf-kleber-datum").value;

    const payload = {
      date,
      treatment: document.getElementById("vf-treatment").value.trim(),
      notes: document.getElementById("vf-notes").value.trim(),
      nextdate: document.getElementById("vf-nextdate").value,
      cost: document.getElementById("vf-cost").value,
      hooves: readHoofGrid(),
      kleberPosition,
      kleberGroesseVorne: document.getElementById("vf-kleber-groesse-vorne").value,
      kleberGroesseHinten: document.getElementById("vf-kleber-groesse-hinten").value,
      kleberDatum,
    };

    if (state.currentVisitId) {
      const v = h.visits.find(v => v.id === state.currentVisitId);
      Object.assign(v, payload);
      toast("Termin aktualisiert");
    } else {
      payload.id = uid();
      h.visits.push(payload);
      toast("Termin gespeichert");
    }
    saveData();
    navStack.length = 0;
    openHorseDetail(h.id, { replace: true });
  });

  vfDelete.addEventListener("click", () => {
    if (!confirm("Diesen Termin wirklich löschen?")) return;
    const h = getHorse(state.currentHorseId);
    h.visits = h.visits.filter(v => v.id !== state.currentVisitId);
    saveData();
    toast("Termin gelöscht");
    navStack.length = 0;
    openHorseDetail(h.id, { replace: true });
  });

  /* ===================== BACKUP / EXPORT / IMPORT ===================== */

  document.getElementById("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `hufkarte-backup-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Backup wird gespeichert…");
  });

  document.getElementById("importInput").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed.horses) throw new Error("Ungültiges Format");
        if (!confirm("Aktuelle Daten auf diesem Gerät werden ersetzt. Fortfahren?")) return;
        state.data = parsed;
        saveData();
        toast("Backup importiert");
        navStack.length = 0;
        navigate("screen-horses", { title: "Meine Pferde", showAdd: true, onAdd: () => openHorseForm(null) });
      } catch (err) {
        alert("Diese Datei konnte nicht gelesen werden. Ist es eine gültige Backup-Datei?");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  /* ===================== INIT ===================== */

  renderHorseList();
  showScreen("screen-horses", { title: "Meine Pferde", showAdd: true, onAdd: () => openHorseForm(null) });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register("sw.js").then(reg => {
        if (!hadController) return; // first-ever install, nothing to reload
        reg.addEventListener("updatefound", () => {
          let reloaded = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (reloaded) return;
            reloaded = true;
            location.reload();
          });
        });
      }).catch(() => {});
    });
  }
})();
