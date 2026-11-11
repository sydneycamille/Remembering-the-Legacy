(() => {
  const $ = (s) => document.querySelector(s);
  const cfg = window.CONFIG || {};
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const sb = (path, opts = {}) => fetch(cfg.SUPABASE_URL + "/rest/v1/" + path, {
    ...opts,
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
      "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const year = (r) => +String(r.date || "").slice(0, 4) || null;
  const fmtDate = (d) => d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Date unknown";

  let records = [], index, byId = {};

  async function load() {
    $("#repo").href = cfg.REPO_URL || "#";
    if (live) {
      try {
        const res = await sb("v_records?select=*&order=full_name");
        if (!res.ok) throw new Error(res.status);
        records = await res.json();
      } catch (e) { console.warn("Database unavailable, using sample data.", e); }
    }
    if (!records.length) {
      records = await (await fetch("data/sample.json")).json();
      $("#sample-flag").hidden = false;
    }
    records.forEach((r) => (byId[r.id] = r));
    buildSearch(); buildFilters(); render();
  }

  function buildSearch() {
    index = new FlexSearch.Index({ tokenize: "forward", cache: true });
    records.forEach((r) => index.add(r.id, [r.full_name, r.county, r.state, r.date, (r.tags || []).join(" ")].join(" ")));
  }

  // Fuzzy fallback: bigram overlap on the name, for misspellings.
  const bigrams = (s) => { s = s.toLowerCase().replace(/\s+/g, " "); const o = new Set(); for (let i = 0; i < s.length - 1; i++) o.add(s.slice(i, i + 2)); return o; };
  function fuzzy(q) {
    const a = bigrams(q);
    return records.map((r) => { const b = bigrams(r.full_name); let n = 0; a.forEach((x) => b.has(x) && n++); return [r.id, (2 * n) / (a.size + b.size || 1)]; })
      .filter(([, s]) => s > 0.45).sort((x, y) => y[1] - x[1]).map(([id]) => id);
  }

  function buildFilters() {
    const states = [...new Set(records.map((r) => r.state).filter(Boolean))].sort();
    const decades = [...new Set(records.map(year).filter(Boolean).map((y) => Math.floor(y / 10) * 10))].sort();
    const tags = [...new Set(records.flatMap((r) => r.tags || []))].sort();
    $("#f-state").insertAdjacentHTML("beforeend", states.map((s) => `<option>${esc(s)}</option>`).join(""));
    $("#f-decade").insertAdjacentHTML("beforeend", decades.map((d) => `<option value="${d}">${d}s</option>`).join(""));
    $("#f-tags").insertAdjacentHTML("beforeend", tags.map((t) => `<label class="tag"><input type="checkbox" value="${esc(t)}"> ${esc(t)}</label>`).join(""));
  }

  function render() {
    const q = $("#q").value.trim(), st = $("#f-state").value, dc = $("#f-decade").value;
    const tg = [...document.querySelectorAll("#f-tags input:checked")].map((i) => i.value);
    let list = records;
    if (q) {
      let ids = index.search(q, 500);
      if (!ids.length) ids = fuzzy(q);
      list = ids.map((id) => byId[id]);
    }
    list = list.filter((r) => (!st || r.state === st) && (!dc || Math.floor(year(r) / 10) * 10 === +dc) && tg.every((t) => (r.tags || []).includes(t)));
    $("#count").textContent = list.length;
    $("#empty").hidden = list.length > 0;
    $("#results").innerHTML = list.map((r) => `
      <article class="card">
        <h3>${esc(r.full_name)}</h3>
        <p class="meta">${esc(fmtDate(r.date))}<br>${esc([r.county, r.state].filter(Boolean).join(", "))}</p>
        <div>${(r.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
        <button type="button" data-id="${r.id}">Open profile</button>
      </article>`).join("");
  }

  function openProfile(id) {
    const r = byId[id], d = $("#dlg");
    d.innerHTML = `
      <h2 id="dlg-title">${esc(r.full_name)}</h2>
      <p class="meta">${esc(fmtDate(r.date))} &middot; ${esc([r.county, r.state].filter(Boolean).join(", "))}</p>
      <div>${(r.tags || []).map((t) => `<span class="pill">${esc(t)}</span>`).join("")}</div>
      <div id="acct"><p>This profile includes a written account of racial terror violence.</p>
        <button type="button" class="btn" id="reveal">Show the written account</button></div>
      <h3>Sources</h3><ul class="sources">${(r.sources || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>
      <button type="button" class="btn" id="close">Close</button>`;
    d.showModal();
    $("#reveal").onclick = () => { $("#acct").innerHTML = `<div class="account">${esc(r.narrative)}</div>`; };
    $("#close").onclick = () => d.close();
  }

  $("#results").addEventListener("click", (e) => { const b = e.target.closest("button[data-id]"); if (b) openProfile(b.dataset.id); });
  $("#dlg").addEventListener("click", (e) => { if (e.target.id === "dlg") e.target.close(); });
  $("#search-form").addEventListener("submit", (e) => e.preventDefault());
  $("#q").addEventListener("input", render);
  document.querySelector(".filters").addEventListener("change", render);
  $("#reset").onclick = () => { $("#q").value = ""; $("#f-state").value = ""; $("#f-decade").value = ""; document.querySelectorAll("#f-tags input").forEach((i) => (i.checked = false)); render(); };

  $("#sub-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target), msg = $("#sub-msg");
    if (!live) { msg.textContent = "Submissions are off until the database is connected (see the README)."; return; }
    const res = await sb("submissions", { method: "POST", headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ type: f.get("type"), details: f.get("details"), contact: f.get("contact") || null }) });
    msg.textContent = res.ok ? "Received. A moderator will review it." : "Could not send. Try again later.";
    if (res.ok) e.target.reset();
  });

  load();
})();
