// Help centre behaviour: theme, sidebar built from the page, reading time, search (/), scroll spy.
(function () {
    const root = document.documentElement;
    const store = {
        get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
    };

    // Theme: saved choice, else the system's
    const saved = store.get("doc-theme");
    if (saved) root.dataset.theme = saved;
    document.getElementById("theme").addEventListener("click", () => {
        const dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")) === "dark";
        root.dataset.theme = dark ? "light" : "dark";
        store.set("doc-theme", root.dataset.theme);
    });

    // Back to the listing the reader came from, for its Odoo version
    const back = document.getElementById("back");
    const from = /^https:\/\/apps\.odoo\.com\/apps\/modules\/\d+\.0\/tm_shopify_connector/.exec(document.referrer || "");
    if (back && from) back.href = from[0];

    const slug = (s) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const topics = [...document.querySelectorAll("section.topic-sec")];

    // Anchors on headings, reading time per topic
    topics.forEach((sec) => {
        const words = sec.innerText.split(/\s+/).length;
        const read = sec.querySelector(".read");
        if (read) read.textContent = Math.max(1, Math.round(words / 200)) + " min read";
        sec.querySelectorAll("h2, h3").forEach((h) => {
            if (!h.id) h.id = sec.id + "--" + slug(h.textContent);
            const a = document.createElement("a");
            a.className = "anchor"; a.href = "#" + h.id; a.textContent = "#"; a.setAttribute("aria-label", "Link to this section");
            h.appendChild(a);
        });
    });

    // Section ids exist only now: jump to the one in the address bar
    if (location.hash.length > 1) {
        const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) requestAnimationFrame(() => target.scrollIntoView());
    }

    // Sidebar from the topics' groups and h2s
    const side = document.getElementById("side");
    let group = null;
    topics.forEach((sec, i) => {
        if (sec.dataset.group !== group) {
            group = sec.dataset.group;
            const g = document.createElement("div"); g.className = "grp"; g.textContent = group; side.appendChild(g);
        }
        const t = document.createElement("a");
        t.className = "topic"; t.href = "#" + sec.id; t.dataset.target = sec.id;
        t.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span><span></span>`;
        t.lastChild.textContent = sec.querySelector("h1").textContent;
        side.appendChild(t);
        const subs = document.createElement("div"); subs.className = "subs";
        sec.querySelectorAll("h2").forEach((h) => {
            const a = document.createElement("a"); a.href = "#" + h.id; a.dataset.target = h.id;
            a.textContent = h.firstChild.textContent; subs.appendChild(a);
        });
        side.appendChild(subs);
    });
    side.addEventListener("click", (e) => { if (e.target.closest("a")) document.body.classList.remove("nav-open"); });
    document.getElementById("menu").addEventListener("click", () => document.body.classList.toggle("nav-open"));

    // Scroll spy: open the topic being read, highlight its section
    const marks = [...document.querySelectorAll("section.topic-sec, section.topic-sec h2")];
    let ticking = false;
    function spy() {
        ticking = false;
        let cur = null;
        for (const m of marks) { if (m.getBoundingClientRect().top < 120) cur = m; else break; }
        const sec = cur ? (cur.matches("section") ? cur : cur.closest("section")) : null;
        side.querySelectorAll(".topic").forEach((t) => t.classList.toggle("on", !!sec && t.dataset.target === sec.id));
        side.querySelectorAll(".subs a").forEach((a) => a.classList.toggle("on", !!cur && a.dataset.target === cur.id));
    }
    addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } }, { passive: true });
    spy();

    // Search over every h2/h3 section: title and text
    const index = [];
    topics.forEach((sec) => {
        const title = sec.querySelector("h1").textContent;
        sec.querySelectorAll("h2, h3").forEach((h) => {
            let text = "", n = h.nextElementSibling;
            while (n && !/^H[23]$/.test(n.tagName)) { text += " " + n.innerText; n = n.nextElementSibling; }
            index.push({ id: h.id, title: h.firstChild.textContent, topic: title, text: text.toLowerCase(), head: h.firstChild.textContent.toLowerCase() });
        });
    });
    const input = document.getElementById("q"), box = document.getElementById("results");
    let sel = 0;
    function render() {
        const q = input.value.trim().toLowerCase();
        if (!q) { box.classList.remove("open"); return; }
        const words = q.split(/\s+/);
        const hits = index.map((e) => {
            let score = 0;
            for (const w of words) {
                if (e.head.includes(w)) score += 5;
                else if (e.text.includes(w)) score += 1;
                else return null;
            }
            return { e, score };
        }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 12);
        sel = 0;
        box.innerHTML = hits.length ? "" : '<div class="e">No match. Try other words, or write to support.</div>';
        hits.forEach((h, i) => {
            const a = document.createElement("a"); a.href = "#" + h.e.id; if (i === 0) a.className = "sel";
            a.innerHTML = '<div class="t"></div><div class="p"></div>';
            a.firstChild.textContent = h.e.title; a.lastChild.textContent = h.e.topic;
            box.appendChild(a);
        });
        box.classList.add("open");
    }
    input.addEventListener("input", render);
    input.addEventListener("keydown", (e) => {
        const items = [...box.querySelectorAll("a")];
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault(); if (!items.length) return;
            items[sel].classList.remove("sel");
            sel = (sel + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length;
            items[sel].classList.add("sel"); items[sel].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter" && items[sel]) {
            location.hash = items[sel].getAttribute("href"); box.classList.remove("open"); input.blur();
        } else if (e.key === "Escape") { box.classList.remove("open"); input.blur(); }
    });
    box.addEventListener("click", () => { box.classList.remove("open"); });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) box.classList.remove("open"); });
    document.addEventListener("keydown", (e) => {
        if (e.key === "/" && document.activeElement !== input && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
            e.preventDefault(); input.focus(); input.select();
        }
    });
})();
