/* Gig Hub — Integrated Client Application */
(function () {
  "use strict";

  var D = window.GH_DATA || { user: {}, cats: {}, ideas: {}, gigs: [] };
  var API = window.GigHubApi;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage fallback ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem("gh_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("gh_" + k, JSON.stringify(v)); } catch (e) {} }
  };

  var rupee = function (n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var qs = function (k) { return new URLSearchParams(location.search).get(k); };
  var pad = function (n) { return (Number(n) < 10 ? "0" : "") + Number(n); };

  /* ---------- Data helpers ---------- */
  function saved() { return store.get("saved", []); }
  function catOf(g) {
    var c = g.cat || g.category || "skills";
    if (c === "task") c = "tasks";
    if (c === "event") c = "events";
    return (D.cats && D.cats[c]) || { label: "Gig", icon: "💼", pill: "purple-pill" };
  }

  function spotsLeft(g) {
    if (g.cat !== "food" && g.rawCat !== "food") return null;
    if (g.spots != null) return g.spots;
    return 4;
  }

  /* ---------- Suggestion engine ---------- */
  function suggest(allGigsList, opts) {
    opts = opts || {};
    var user = (API && API.storage.getUser()) || D.user || {};
    var userSkills = user.skills || ["html", "python", "design"];
    var sv = saved();
    var list = allGigsList || D.gigs || [];

    return list.filter(function (g) {
      if (opts.exclude && String(opts.exclude) === String(g.id)) return false;
      if (opts.cat && g.cat !== opts.cat) return false;
      if (opts.notFood && (g.cat === "food" || g.rawCat === "food")) return false;
      if (opts.onlyFood && g.cat !== "food" && g.rawCat !== "food") return false;
      return true;
    }).map(function (g) {
      var s = 0, why = "Popular on campus";
      var hit = (g.tags || []).filter(function (t) { return userSkills.indexOf(String(t).toLowerCase()) > -1; });
      if (hit.length) { s += 4; why = "Matches your " + hit[0] + " skills"; }
      if (opts.like && g.cat === opts.like.cat) { s += 3; why = "Similar to this gig"; }
      if (sv.indexOf(String(g.id)) > -1) { s += 2; why = "From your saved gigs"; }
      s += Math.random() * 0.5;
      return { g: g, s: s, why: why };
    }).sort(function (a, b) { return b.s - a.s; }).slice(0, opts.n || 3);
  }

  function suggestHTML(list) {
    return list.map(function (x) {
      var g = x.g, href = "gig-details.html?id=" + encodeURIComponent(g.id);
      return '<a class="suggest-item" href="' + href + '"><span class="mini-icon ' + (g.tone || "orange") + '">' + (g.icon || "💡") + '</span><div><b>' + esc(g.title) + '</b><small>' + esc(g.loc || "Campus") + ' · ' + esc(g.when || "Flexible") + '</small><br><span class="why">✨ ' + esc(x.why) + '</span></div><strong>' + rupee(g.price) + '</strong></a>';
    }).join("");
  }

  /* ---------- Card renderers ---------- */
  function foodCard(g) {
    var left = spotsLeft(g);
    var tot = g.total || 4;
    var pct = Math.min(100, Math.round(((tot - left) / tot) * 100));
    var btn = left > 0
      ? '<a class="btn btn-small btn-primary" href="join-order.html?id=' + encodeURIComponent(g.id) + '">Join order</a>'
      : '<span class="btn btn-small btn-light" style="pointer-events:none">Order full</span>';
    return '<article class="food-card"><div class="food-image ' + esc(g.img || "biryani") + '">' + (g.icon || "🍛") + '<span class="spots">' + (left > 0 ? left + ' spots left' : 'Full') + '</span></div>' +
      '<div class="food-info"><div class="food-title"><h3>' + esc(g.title) + '</h3><span>' + rupee(g.price) + '/person</span></div>' +
      '<p>🍴 ' + esc(g.loc || "Main Cafeteria") + ' · ' + left + ' spots left</p><div class="meter" aria-hidden="true"><i style="width:' + pct + '%"></i></div>' +
      '<div style="display:flex;gap:8px;align-items:center">' + btn + '<a class="btn btn-small btn-outline" href="gig-details.html?id=' + encodeURIComponent(g.id) + '">Details</a></div></div></article>';
  }

  function gigCard(g) {
    var c = catOf(g);
    var on = saved().indexOf(String(g.id)) > -1;
    var isNew = String(g.id).indexOf("u_") === 0 || g.status === 'open';
    var meta = g.loc && g.when ? "📍 " + g.loc + " · " + g.when : (g.loc ? "📍 " + g.loc : "⏱ Flexible");

    return '<article class="gig-card"><div class="top"><span class="card-icon ' + (g.tone || "purple") + '">' + (g.icon || "🎨") + '</span><div style="display:flex;gap:8px;align-items:center">' + (isNew ? '<span class="new-tag">ACTIVE</span>' : '') +
      '<button class="save-btn' + (on ? " on" : "") + '" data-save="' + g.id + '" aria-label="Save gig" title="Save gig">' + (on ? "♥" : "♡") + '</button></div></div>' +
      '<div><span class="pill ' + (g.pill || c.pill) + '">' + esc(g.pillLabel || c.label) + '</span></div><h3>' + esc(g.title) + '</h3><p>' + esc(g.desc) + '</p>' +
      '<div class="card-meta"><span>' + esc(meta) + '</span><strong>' + rupee(g.price) + '</strong></div><a class="btn btn-outline btn-full" href="gig-details.html?id=' + encodeURIComponent(g.id) + '">View gig</a></article>';
  }

  function bindSave(root) {
    $$("[data-save]", root || document).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        var id = String(b.getAttribute("data-save")), s = saved(), i = s.indexOf(id);
        if (i > -1) {
          s.splice(i, 1);
          b.classList.remove("on");
          b.textContent = "♡";
          toast("Removed from saved gigs");
        } else {
          s.push(id);
          b.classList.add("on");
          b.textContent = "♥";
          toast("Saved! We'll suggest similar gigs");
        }
        store.set("saved", s);
      });
    });
  }

  /* ---------- UI helpers ---------- */
  function toast(msg) {
    var t = $(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._t);
    t._t = setTimeout(function () { t.classList.remove("show"); }, 3000);
  }

  function confetti() {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    var w = document.createElement("div");
    w.className = "confetti";
    var cols = ["#6544e6", "#ff7a59", "#25a06a", "#f2a413", "#3b73d1", "#e0476b"];
    for (var i = 0; i < 60; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = cols[i % cols.length];
      p.style.animationDuration = 2 + Math.random() * 2.5 + "s";
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      w.appendChild(p);
    }
    document.body.appendChild(w);
    setTimeout(function () { w.remove(); }, 6000);
  }

  function ago(t) {
    var m = Math.round((Date.now() - new Date(t).getTime()) / 60000);
    return m < 1 ? "Just now" : m < 60 ? m + " minutes ago" : m < 1440 ? Math.round(m / 60) + " hours ago" : "Yesterday";
  }

  /* ---------- Global navigation & auth guard ---------- */
  async function initGlobal() {
    var mb = $(".menu-btn"), nl = $(".nav-links");
    if (mb && nl) {
      mb.addEventListener("click", function () {
        var o = nl.classList.toggle("open");
        mb.setAttribute("aria-expanded", o);
      });
    }

    var token = API ? API.storage.getToken() : null;
    var user = API ? API.storage.getUser() : null;
    var page = document.body.dataset.page;
    var isAuthPage = page === 'login' || page === 'register';
    var isProtected = ['dashboard', 'post', 'history', 'profile', 'notifications'].indexOf(page) > -1;

    // Check protected page access
    if (isProtected && !token) {
      var nextPath = (location.pathname.split('/').pop() || 'dashboard.html') + location.search;
      location.href = 'login.html?next=' + encodeURIComponent(nextPath);
      return;
    }

    // Redirect already logged-in users away from auth pages
    if (isAuthPage && token && user) {
      location.href = qs("next") || "dashboard.html";
      return;
    }

    // Dynamic Navbar sync across all pages based on real login state
    var navActions = $(".nav-actions");
    if (navActions) {
      if (token && user) {
        var initials = user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : "ST");
        navActions.innerHTML =
          '<a class="icon-link" href="notifications.html" aria-label="Notifications" title="Notifications">🔔</a>' +
          '<a class="profile-mini" href="profile.html" aria-label="Profile" title="' + esc(user.name) + '">' + esc(initials) + '</a>' +
          '<a class="btn btn-small btn-light" href="#" id="global-logout-btn">Log out</a>';

        var navLogout = $("#global-logout-btn");
        if (navLogout) {
          navLogout.addEventListener("click", async function (e) {
            e.preventDefault();
            if (API) await API.auth.logout();
            toast("Logged out successfully");
            setTimeout(function () { location.href = "index.html"; }, 300);
          });
        }
      } else {
        navActions.innerHTML =
          '<a class="btn btn-light" href="login.html">Log in</a>' +
          '<a class="btn btn-primary" href="register.html">Join Gig Hub</a>';
      }
    }

    // Add Logout handling for any other logout links (e.g. in footers)
    $$("a").forEach(function (link) {
      if (link.textContent.trim().toLowerCase() === 'log out' && link.id !== 'global-logout-btn') {
        link.addEventListener("click", async function (e) {
          e.preventDefault();
          if (API) await API.auth.logout();
          toast("Logged out successfully");
          setTimeout(function () { location.href = "index.html"; }, 300);
        });
      }
    });

    // Scroll reveal observer
    function revealAll() {
      $$(".reveal").forEach(function (el) { el.classList.add("in"); });
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.05, rootMargin: "60px" });
      $$(".reveal").forEach(function (el) { io.observe(el); });
    } else {
      revealAll();
    }
    // Safety fallback: ensure all reveal elements are visible after 1.2s
    setTimeout(revealAll, 1200);

    // Check notifications for bell badge (non-blocking)
    if (token && API) {
      API.notifications.unreadCount().then(function (notifRes) {
        var bell = $(".icon-link");
        if (bell && notifRes && notifRes.unreadCount > 0 && !$(".ping", bell)) {
          var p = document.createElement("span");
          p.className = "ping";
          bell.appendChild(p);
        }
      }).catch(function () {});
    }
  }

  /* ---------- Page controllers ---------- */
  var pages = {};

  // 1. Home Page (index.html)
  pages.home = async function () {
    var t = $("#trending");
    if (!t) return;

    var gigs = [];
    if (API) {
      try {
        var res = await API.gigs.list({ limit: 4, sort: 'newest' });
        if (res.gigs && res.gigs.length) {
          gigs = res.gigs.map(API.formatGig);
        }
      } catch (e) {}
    }
    if (!gigs.length) {
      gigs = ["g4", "f1", "g1"].map(function (id) {
        return (D.gigs || []).filter(function (x) { return x.id === id; })[0];
      }).filter(Boolean);
    }

    t.innerHTML = gigs.map(function (g) {
      return g.cat === "food" || g.rawCat === "food" ? foodCard(g) : gigCard(g);
    }).join("");
    t.classList.add("latest-grid", "in");
    bindSave(t);

    // Dynamic animated counters
    $$("[data-count]").forEach(function (el) {
      var end = parseFloat(el.dataset.count),
          suf = el.dataset.suffix || "",
          pre = el.dataset.prefix || "",
          dec = el.dataset.dec ? 1 : 0,
          st = null;
      if (matchMedia("(prefers-reduced-motion:reduce)").matches) return;
      function step(ts) {
        st = st || ts;
        var p = Math.min(1, (ts - st) / 1200);
        var v = end * (1 - Math.pow(1 - p, 3));
        el.textContent = pre + (dec ? v.toFixed(1) : Math.round(v).toLocaleString("en-IN")) + suf;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  };

  // Helper for Google Authentication on Login & Register
  async function initGoogleAuth(opts) {
    opts = opts || {};
    var customBtn = $(opts.buttonId);
    var isRegister = !!opts.isRegister;
    var showAlert = opts.showAlert || function () {};

    var googleClientId = "";
    if (API && API.auth && API.auth.getConfig) {
      try {
        var cfg = await API.auth.getConfig();
        googleClientId = cfg.googleClientId || "";
      } catch (e) {}
    }

    // Success callback when user signs in through Google
    window.handleGoogleCredential = async function (response) {
      if (!response || !response.credential) return;
      try {
        var res = await API.auth.googleLogin({ credential: response.credential, remember: true });
        toast("Welcome, " + res.user.name + "!");
        var nextUrl = qs("next") || "dashboard.html";
        setTimeout(function () { location.href = nextUrl; }, 400);
      } catch (err) {
        showAlert(err.message, true);
      }
    };

    // Check for Google OAuth redirect hash parameters (e.g. #access_token=... or #id_token=... or #error=...)
    if (window.location.hash && window.location.hash.length > 1) {
      try {
        var hashParams = new URLSearchParams(window.location.hash.substring(1));
        var token = hashParams.get("access_token") || hashParams.get("id_token");
        var oauthErr = hashParams.get("error");
        var errDesc = hashParams.get("error_description");

        if (token) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
          toast("Authenticated with Google! Logging in...");
          window.handleGoogleCredential({ credential: token });
          return;
        } else if (oauthErr) {
          showAlert("Google Sign-In Error: " + (errDesc || oauthErr) + " (Check Authorized redirect URIs in Google Cloud Console)", true);
        }
      } catch (e) {}
    }

    function openGoogleOAuth() {
      if (!googleClientId) {
        showDemoPrompt();
        return;
      }
      var redirectUri = window.location.origin + window.location.pathname;
      var authUrl = "https://accounts.google.com/o/oauth2/v2/auth?" +
        "client_id=" + encodeURIComponent(googleClientId) +
        "&redirect_uri=" + encodeURIComponent(redirectUri) +
        "&response_type=token" +
        "&scope=" + encodeURIComponent("openid email profile") +
        "&prompt=select_account";

      window.location.href = authUrl;
    }

    function showDemoPrompt() {
      var defaultEmail = isRegister ? "newstudent@university.edu" : "ayush@university.edu";
      var mockEmail = prompt("Sign in with Google Account (University email):", defaultEmail);
      if (!mockEmail) return;
      var mockName = prompt("Your Name:", "Google Student") || "Google Student";

      API.auth.googleLogin({ mockEmail: mockEmail, mockName: mockName, remember: true })
        .then(function (res) {
          toast("Signed in as " + res.user.name);
          setTimeout(function () { location.href = qs("next") || "dashboard.html"; }, 400);
        })
        .catch(function (err) {
          showAlert(err.message, true);
        });
    }

    if (customBtn) {
      customBtn.addEventListener("click", function (e) {
        e.preventDefault();
        openGoogleOAuth();
      });
    }
  }

  // 2. Login Page (login.html)
  pages.login = async function () {
    var form = $("#login-form");
    var alertBox = $("#auth-alert");

    function showAlert(msg, isError) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className = "auth-alert " + (isError ? "error" : "success");
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Standard Form Login
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var email = $("#email").value.trim();
        var password = $("#password").value;
        var remember = $("#remember") ? $("#remember").checked : true;
        var submitBtn = $("#login-submit-btn");

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Logging in..."; }

        try {
          var res = await API.auth.login({ email: email, password: password, remember: remember });
          showAlert("Welcome back, " + res.user.name + "! Redirecting...", false);
          toast("Logged in successfully!");
          var nextUrl = qs("next") || "dashboard.html";
          setTimeout(function () { location.href = nextUrl; }, 600);
        } catch (err) {
          showAlert(err.message, true);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Log in →"; }
        }
      });
    }

    // Google Sign-In setup
    await initGoogleAuth({
      buttonId: "#google-btn",
      isRegister: false,
      showAlert: showAlert
    });
  };

  // 3. Register Page (register.html)
  pages.register = async function () {
    var form = $("#register-form");
    var alertBox = $("#auth-alert");

    function showAlert(msg, isError) {
      if (!alertBox) return;
      alertBox.textContent = msg;
      alertBox.className = "auth-alert " + (isError ? "error" : "success");
      alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var name = $("#reg-name").value.trim();
        var email = $("#reg-email").value.trim();
        var college = $("#reg-college").value.trim();
        var password = $("#reg-password").value;
        var submitBtn = $("#reg-submit-btn");

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Creating account..."; }

        try {
          var res = await API.auth.register({ name: name, email: email, college: college, password: password });
          showAlert("Account created! Redirecting...", false);
          toast("Welcome to Gig Hub, " + res.user.name + "!");
          setTimeout(function () { location.href = "dashboard.html"; }, 600);
        } catch (err) {
          showAlert(err.message, true);
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = "Create account →"; }
        }
      });
    }

    // Google Sign-Up setup
    await initGoogleAuth({
      buttonId: "#reg-google-btn",
      isRegister: true,
      showAlert: showAlert
    });
  };

  // 4. Dashboard (dashboard.html)
  pages.dashboard = async function () {
    var dashData = null;
    try {
      dashData = await API.dashboard.get();
    } catch (e) {
      console.warn("Dashboard API fallback", e);
    }

    if (dashData) {
      // User greeting
      var head = $(".page-head h1");
      if (head && dashData.user) {
        head.innerHTML = "Good evening, <em>" + esc(dashData.user.firstName || dashData.user.name) + "</em> 👋";
      }

      // Metrics
      var m = dashData.metrics || {};
      var activeEl = $("#m-active");
      if (activeEl) activeEl.textContent = pad(m.activeGigs || 4);

      var cards = $$(".metric-card strong");
      if (cards.length >= 4) {
        cards[0].textContent = pad(m.activeGigs || 4);
        cards[1].textContent = pad(m.completedGigs || 18);
        cards[2].textContent = rupee(m.totalEarned || 4850);
        cards[3].textContent = (m.rating ? m.rating.toFixed(1) : "4.8");
      }

      // Balance Card
      var balStrong = $(".balance-card strong");
      if (balStrong && dashData.wallet) {
        balStrong.textContent = rupee(dashData.wallet.balance);
      }
      var balP = $(".balance-card p");
      if (balP && dashData.wallet) {
        balP.textContent = "+" + rupee(dashData.wallet.earnedThisWeek || 0) + " earned this week";
      }

      // Recommended gigs
      if (dashData.recommended && dashData.recommended.length) {
        var recBox = $(".dashboard-grid .gig-list");
        if (recBox) {
          recBox.innerHTML = dashData.recommended.map(function (g) {
            var formatted = API.formatGig(g);
            return '<article class="gig-row"><span class="mini-icon ' + (formatted.tone || "purple") + '">' + (formatted.icon || "💻") + '</span><div class="gig-main"><h3>' + esc(formatted.title) + '</h3><p>' + esc(formatted.loc) + ' · ' + esc(formatted.when) + '</p><div class="tags"><span>' + esc(formatted.pillLabel) + '</span><span>' + rupee(formatted.price) + '</span></div></div><strong>' + rupee(formatted.price) + '</strong><a class="btn btn-small btn-outline" href="gig-details.html?id=' + encodeURIComponent(formatted.id) + '">View</a></article>';
          }).join("");
        }
      }
    }

    // User's own gigs & orders
    try {
      var mineRes = await API.gigs.mine({ role: 'all' });
      var mineSec = $("#mine");
      var mineList = $("#mine-list");
      if (mineSec && mineList && mineRes.gigs && mineRes.gigs.length) {
        mineSec.style.display = "";
        mineList.innerHTML = mineRes.gigs.map(function (g) {
          var fg = API.formatGig(g);
          return '<article class="gig-row"><span class="mini-icon ' + (fg.tone || "purple") + '">' + (fg.icon || "⚡") + '</span><div class="gig-main"><h3>' + esc(fg.title) + '</h3><p>' + esc(fg.loc) + ' · ' + esc(fg.when) + '</p><div class="tags"><span>' + (fg.status === 'open' ? 'Active' : fg.status) + '</span></div></div><strong>' + rupee(fg.price) + '</strong><a class="btn btn-small btn-outline" href="gig-details.html?id=' + encodeURIComponent(fg.id) + '">View</a></article>';
        }).join("");
      }
    } catch (e) {}

    // Wallet Withdraw interaction
    var withdrawLinks = $$(".balance-actions a");
    withdrawLinks.forEach(function (link) {
      if (link.textContent.trim().toLowerCase().includes("withdraw")) {
        link.addEventListener("click", async function (e) {
          e.preventDefault();
          var amt = prompt("Enter amount to withdraw (min ₹100):", "250");
          if (!amt) return;
          var upi = prompt("Enter your UPI ID (e.g. name@okhdfcbank):", "student@upi");
          if (!upi) return;
          try {
            var res = await API.wallet.withdraw({ amount: Number(amt), upiId: upi });
            toast("Withdrawal of ₹" + amt + " requested! Balance: ₹" + res.balance);
            var bal = $(".balance-card strong");
            if (bal) bal.textContent = rupee(res.balance);
          } catch (err) {
            toast(err.message);
          }
        });
      }
    });

    $("#sugg") && ($("#sugg").innerHTML = suggestHTML(suggest(null, { n: 3 })));
  };

  // 5. Explore Gigs (gigs.html)
  pages.gigs = async function () {
    var cat = qs("cat") || "all", q = (qs("q") || "").toLowerCase(), sort = "new";
    var input = $("#q"),
        foodBox = $("#food-grid"),
        latestBox = $("#latest-grid"),
        count = $("#count"),
        foodSec = $("#food-sec"),
        latSec = $("#latest-sec");

    if (input) input.value = qs("q") || "";

    async function loadAndRender() {
      var backendGigs = [];
      try {
        var res = await API.gigs.list({ category: cat, q: q, sort: sort });
        backendGigs = (res.gigs || []).map(API.formatGig);
      } catch (e) {
        console.warn("Backend fetch failed, using fallback data", e);
        backendGigs = (D.gigs || []).filter(function (g) {
          if (cat !== "all" && g.cat !== cat) return false;
          if (!q) return true;
          return (g.title + " " + g.desc + " " + g.loc).toLowerCase().indexOf(q) > -1;
        });
      }

      var foods = backendGigs.filter(function (g) { return g.cat === "food" || g.rawCat === "food"; });
      var others = backendGigs.filter(function (g) { return g.cat !== "food" && g.rawCat !== "food"; });

      if (foodBox) foodBox.innerHTML = foods.map(foodCard).join("");
      if (latestBox) latestBox.innerHTML = others.map(gigCard).join("");

      if (foodSec) foodSec.style.display = foods.length ? "" : "none";
      if (latSec) latSec.style.display = others.length ? "" : "none";

      var n = foods.length + others.length;
      if (count) {
        count.textContent = n + (n === 1 ? " result" : " results") + (q ? ' for "' + q + '"' : "");
      }
      var em = $("#empty");
      if (em) em.style.display = n ? "none" : "block";

      bindSave(document);
      $$(".category-tabs [data-cat]").forEach(function (b) {
        b.classList.toggle("selected", b.dataset.cat === cat);
      });
    }

    $$(".category-tabs [data-cat]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        cat = b.dataset.cat;
        history.replaceState(null, "", cat === "all" ? "gigs.html" : "gigs.html?cat=" + cat);
        loadAndRender();
      });
    });

    var searchForm = $("#search-form");
    if (searchForm) {
      searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        q = input.value.trim().toLowerCase();
        loadAndRender();
      });
    }
    if (input) {
      input.addEventListener("input", function () {
        q = input.value.trim().toLowerCase();
        loadAndRender();
      });
    }
    var sortSelect = $("#sort");
    if (sortSelect) {
      sortSelect.addEventListener("change", function (e) {
        sort = e.target.value;
        loadAndRender();
      });
    }
    var resetBtn = $("#reset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        cat = "all"; q = ""; if (input) input.value = "";
        loadAndRender();
      });
    }

    await loadAndRender();
    if ($("#sugg")) $("#sugg").innerHTML = suggestHTML(suggest(null, { n: 3 }));
  };

  // 6. Gig Details (gig-details.html)
  pages.detail = async function () {
    var id = qs("id"), box = $("#detail");
    if (!id || !box) return;

    var g = null;
    try {
      var res = await API.gigs.get(id);
      g = API.formatGig(res.gig);
    } catch (e) {
      g = (D.gigs || []).filter(function (x) { return String(x.id) === String(id); })[0];
    }

    if (!g) {
      box.innerHTML = '<div class="empty"><span style="font-size:40px">🔍</span><b>Gig not found</b>It may have been removed.<br><br><a class="btn btn-primary" href="gigs.html">Browse gigs</a></div>';
      return;
    }

    document.title = g.title + " | Gig Hub";
    var c = catOf(g);
    var food = g.cat === "food" || g.rawCat === "food";
    var left = spotsLeft(g);
    var user = (API && API.storage.getUser()) || null;
    var isPoster = (g.viewer && g.viewer.isPoster) || (user && g.posterId && String(user.id) === String(g.posterId));
    var isWorker = (g.viewer && g.viewer.isWorker) || (user && g.workerId && String(user.id) === String(g.workerId));
    var isCompleted = g.status === 'completed';
    var isInProgress = g.status === 'in_progress';

    var cta = "";
    if (isCompleted) {
      cta = '<div class="btn btn-light btn-lg btn-full" style="background:#dcfce7;color:#166534;font-weight:700;pointer-events:none;text-align:center">✓ Gig Completed</div>';
    } else if (isPoster) {
      if (isInProgress) {
        cta = '<button class="btn btn-primary btn-lg btn-full" id="complete-btn" style="background:#16a34a">✓ Mark Gig Completed</button>';
      } else if (food) {
        cta = '<button class="btn btn-primary btn-lg btn-full" id="complete-btn">Close & Complete Food Order</button>';
      } else {
        cta = '<div class="btn btn-light btn-lg btn-full" style="pointer-events:none;text-align:center">Waiting for a student to accept</div>';
      }
    } else if (isWorker) {
      cta = '<div class="btn btn-light btn-lg btn-full" style="background:#eff6ff;color:#1d4ed8;font-weight:700;pointer-events:none;text-align:center">⚡ You are working on this gig</div>';
    } else if (food) {
      cta = left > 0
        ? '<a class="btn btn-primary btn-lg btn-full" href="join-order.html?id=' + encodeURIComponent(g.id) + '">Join this order →</a>'
        : '<span class="btn btn-light btn-lg btn-full">Order is full</span>';
    } else {
      cta = '<button class="btn btn-primary btn-lg btn-full" id="apply">Apply for this gig →</button>';
    }

    box.innerHTML =
      '<a href="gigs.html" class="back-link">← Back to gigs</a><div class="detail-grid"><div class="stack">' +
      '<section class="panel"><div class="detail-hero"><span class="card-icon ' + (g.tone || "orange") + '">' + (g.icon || "💼") + '</span><div><span class="pill ' + (g.pill || c.pill) + '">' + esc(g.pillLabel || c.label) + '</span><h1>' + esc(g.title) + '</h1><p class="muted">Posted by ' + esc(g.by) + '</p></div></div>' +
      '<p style="color:var(--ink-2);margin-top:16px;line-height:1.6">' + esc(g.long || g.desc) + '</p>' +
      '<div class="info-grid"><div><small>Location</small><b>📍 ' + esc(g.loc) + '</b></div><div><small>When</small><b>🕒 ' + esc(g.when) + '</b></div><div><small>' + (food ? "Spots left" : "Category") + '</small><b>' + (food ? left + " of " + (g.total || 4) : esc(c.label)) + '</b></div></div>' +
      '<div class="tags">' + (g.tags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + '</div></section>' +
      '<section class="suggest" style="margin-top:0"><div class="section-heading"><div><span class="eyebrow">YOU MAY ALSO LIKE</span><h2>Similar gigs</h2></div></div><div class="suggest-grid" id="similar"></div></section></div>' +
      '<aside class="sticky-side"><div class="panel price-card"><div class="big">' + rupee(g.price) + '</div><div class="unit">' + (food ? "per person" : "fixed reward") + '</div>' + cta +
      '<div class="poster"><span class="avatar">' + esc(g.init) + '</span><div><b>' + esc(g.by) + '</b><small><span class="verified" style="display:inline-grid;width:15px;height:15px;font-size:9px">✓</span> Verified student</small></div></div>' +
      '<div class="safe">🔒 <span>Payments and rewards are safely completed when marked done by students.</span></div></div></aside></div>' +
      '<div class="modal" id="modal"><div class="modal-card"><h2>Apply for this gig</h2><p>Tell ' + esc(g.by) + ' why you\'re a great fit.</p><div class="field"><textarea id="msg" rows="4" placeholder="Hi! I can help with this because..."></textarea></div><div class="form-actions"><button class="btn btn-outline" id="cancel">Cancel</button><button class="btn btn-primary" id="send">Send application</button></div></div></div>';

    $("#similar") && ($("#similar").innerHTML = suggestHTML(suggest(null, { like: g, exclude: g.id, n: 3 })));

    var compBtn = $("#complete-btn");
    if (compBtn) {
      compBtn.addEventListener("click", async function () {
        var actionText = food ? "close and complete this food order" : "mark this gig as completed";
        if (!confirm("Are you sure you want to " + actionText + "?")) return;
        compBtn.disabled = true;
        compBtn.textContent = "Completing...";
        try {
          await API.gigs.complete(g.id);
          confetti();
          toast("Gig completed successfully!");
          setTimeout(function () { location.reload(); }, 600);
        } catch (err) {
          toast(err.message || "Failed to complete gig");
          compBtn.disabled = false;
          compBtn.textContent = food ? "Close & Complete Food Order" : "✓ Mark Gig Completed";
        }
      });
    }

    var ap = $("#apply");
    if (ap) {
      var m = $("#modal");
      ap.addEventListener("click", function () {
        if (!user) {
          location.href = "login.html?next=" + encodeURIComponent("gig-details.html?id=" + g.id);
          return;
        }
        m.classList.add("show");
        $("#msg").focus();
      });
      $("#cancel").addEventListener("click", function () { m.classList.remove("show"); });
      m.addEventListener("click", function (e) { if (e.target === m) m.classList.remove("show"); });
      $("#send").addEventListener("click", async function () {
        try {
          await API.gigs.accept(g.id);
          toast("Application sent to " + g.by + "!");
          m.classList.remove("show");
          ap.textContent = "✓ Application sent";
          ap.disabled = true;
          setTimeout(function () { location.reload(); }, 600);
        } catch (e) {
          toast(e.message || "Application recorded!");
          m.classList.remove("show");
        }
      });
    }
  };

  // 7. Post a Gig (post-gig.html)
  pages.post = function () {
    var form = $("#post-form"), prev = $("#preview"), box = $("#idea-box");
    if (!form) return;
    var f = function (n) { return form.elements[n]; };

    function draft() {
      var cat = (form.querySelector("[name=category]:checked") || {}).value || "skills";
      var map = { task: "tasks", event: "events" };
      var key = map[cat] || cat;
      var c = D.cats[key] || { icon: "💡", pill: "purple-pill", label: "Skills" };
      return {
        cat: key,
        title: (f("title").value || "").trim() || "Your gig title appears here",
        desc: (f("description").value || "").trim() || "Your description will show up here.",
        price: Number(f("budget").value) || 0,
        loc: (f("location").value || "").trim() || "Campus",
        when: f("date").value ? f("date").value : "Flexible",
        icon: c.icon,
        tone: key === "food" ? "orange" : key === "events" ? "blue" : key === "tasks" ? "orange" : "purple",
        pill: c.pill,
        pillLabel: c.label
      };
    }

    function render() {
      var d = draft();
      if (prev) {
        prev.innerHTML = gigCard(Object.assign({ id: "preview", tags: [] }, d))
          .replace(/<a class="btn[^>]*>View gig<\/a>/, '<span class="btn btn-outline btn-full">View gig</span>')
          .replace(/<button class="save-btn[\s\S]*?<\/button>/, "");
      }
      var ok = function (n, v) { var el = $("#ck-" + n); if (el) el.classList.toggle("ok", v); };
      ok("cat", !!form.querySelector("[name=category]:checked"));
      ok("title", (f("title").value || "").trim().length >= 3);
      ok("desc", (f("description").value || "").trim().length >= 10);
      ok("price", Number(f("budget").value) >= 0);
      ok("loc", (f("location").value || "").trim().length >= 1);
    }

    function showIdeas() {
      var sel = form.querySelector("[name=category]:checked");
      if (!sel || !box || !D.ideas) return;
      var I = D.ideas[sel.value];
      if (!I) return;
      box.classList.add("show");
      box.innerHTML = '<b>✨ Suggestions for this category</b><div class="chips">' +
        I.titles.map(function (t) { return '<button type="button" class="chip" data-title="' + esc(t) + '">' + esc(t) + '</button>'; }).join("") +
        '</div><p class="hint" style="margin-top:12px">Suggested reward: <b>' + rupee(I.range[0]) + ' – ' + rupee(I.range[1]) + '</b> <button type="button" class="chip" id="use-price">Use ' + rupee(I.price) + '</button></p>';
      $$("[data-title]", box).forEach(function (b) { b.onclick = function () { f("title").value = b.dataset.title; render(); }; });
      var up = $("#use-price");
      if (up) up.onclick = function () { f("budget").value = I.price; render(); };
    }

    form.addEventListener("input", render);
    $$("[name=category]", form).forEach(function (r) {
      r.addEventListener("change", function () { showIdeas(); render(); });
    });

    if (f("date")) f("date").min = new Date().toISOString().slice(0, 10);

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var d = draft();
      var rawCategory = (form.querySelector("[name=category]:checked") || {}).value || "skills";
      var gigPayload = {
        title: (f("title").value || "").trim(),
        category: rawCategory,
        description: (f("description").value || "").trim(),
        reward: Number(f("budget").value) || 0,
        location: (f("location").value || "").trim() || "Campus",
        date: f("date").value || undefined,
        time: f("time").value || undefined,
        spots: rawCategory === 'food' ? 4 : undefined
      };

      try {
        var res = await API.gigs.create(gigPayload);
        toast("Gig published successfully!");
        location.href = "post-success.html?id=" + encodeURIComponent(res.gig.id);
      } catch (err) {
        toast("Error: " + err.message);
      }
    });

    render();
  };

  // 8. Post Success (post-success.html)
  pages.postSuccess = async function () {
    var id = qs("id");
    confetti();
    var g = null;
    try {
      var res = await API.gigs.get(id);
      g = API.formatGig(res.gig);
    } catch (e) {}

    var rcpt = $("#receipt");
    if (!g) {
      if ($("#ps-title")) $("#ps-title").textContent = "Your gig is live!";
      if (rcpt) rcpt.style.display = "none";
    } else if (rcpt) {
      rcpt.innerHTML = '<div class="receipt-top"><span class="card-icon ' + (g.tone || "purple") + '">' + (g.icon || "🚀") + '</span><div><h3>' + esc(g.title) + '</h3><small>Gig ID · #' + esc(g.id) + '</small></div></div><div class="receipt-body">' +
        '<div class="line"><span>Category</span><b>' + esc(g.pillLabel) + '</b></div><div class="line"><span>Reward</span><b>' + rupee(g.price) + '</b></div><div class="line"><span>Location</span><b>' + esc(g.loc) + '</b></div><div class="line"><span>When</span><b>' + esc(g.when) + '</b></div><div class="line"><span>Status</span><b><span class="status success">Live in marketplace</span></b></div></div>';
      var vb = $("#view-btn");
      if (vb) vb.href = "gig-details.html?id=" + encodeURIComponent(g.id);
    }
    if ($("#sugg")) $("#sugg").innerHTML = suggestHTML(suggest(null, { n: 3 }));
  };

  // 9. Join Food Order (join-order.html)
  pages.join = async function () {
    var id = qs("id"), box = $("#order");
    if (!id || !box) return;

    var g = null;
    try {
      var res = await API.gigs.get(id);
      g = API.formatGig(res.gig);
    } catch (e) {}

    if (!g) {
      box.innerHTML = '<div class="empty"><b>Order not found</b><a class="btn btn-primary" href="gigs.html?cat=food">Browse orders</a></div>';
      return;
    }

    var left = spotsLeft(g);
    document.title = "Join " + g.title + " | Gig Hub";
    box.innerHTML =
      '<a href="gigs.html" class="back-link">← Back to gigs</a><div class="form-header"><span class="eyebrow">JOIN A FOOD ORDER</span><h1>Join the <em>' + esc(g.title) + '</em> order</h1><p>Confirm your share, choose a pickup time and you\'re done.</p></div>' +
      '<form id="join-form" class="order-grid"><div class="post-form">' +
      '<section class="form-section"><h2>Your share</h2><p>Reward: <b>' + rupee(g.price) + '</b> per person. ' + left + ' spots remaining.</p></section>' +
      '<section class="form-section"><h2>Pickup time</h2><div class="slots"><label class="slot"><input type="radio" name="slot" value="1:00 PM" checked><span>1:00 PM<small>' + esc(g.loc) + '</small></span></label><label class="slot"><input type="radio" name="slot" value="1:30 PM"><span>1:30 PM<small>' + esc(g.loc) + '</small></span></label></div></section>' +
      '<section class="form-section"><h2>Payment method</h2><div class="pay-list"><label class="pay"><input type="radio" name="pay" value="UPI" checked><span><i>📱</i><div><b>UPI</b><small>Pay instantly on pickup</small></div></span></label></div></section>' +
      '<button class="btn btn-primary btn-lg btn-full" type="submit">Confirm &amp; join order →</button></div></form>';

    var form = $("#join-form");
    if (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        try {
          await API.gigs.join(g.id);
          toast("Joined order successfully!");
          location.href = "join-success.html?id=" + encodeURIComponent(g.id);
        } catch (err) {
          toast(err.message);
        }
      });
    }
  };

  // 10. Join Success (join-success.html)
  pages.joinSuccess = async function () {
    confetti();
    var id = qs("id");
    var g = null;
    try {
      var res = await API.gigs.get(id);
      g = API.formatGig(res.gig);
    } catch (e) {}

    var box = $("#receipt");
    if (box && g) {
      box.innerHTML = '<div class="receipt-top"><span class="card-icon orange">' + (g.icon || "🍱") + '</span><div><h3>' + esc(g.title) + '</h3><small>Order Confirmed</small></div></div><div class="receipt-body">' +
        '<div class="line"><span>Location</span><b>' + esc(g.loc) + '</b></div><div class="line"><span>Total</span><b>' + rupee(g.price) + '</b></div><div class="line"><span>Status</span><b><span class="status success">Confirmed</span></b></div></div>';
    }
    if ($("#sugg")) $("#sugg").innerHTML = suggestHTML(suggest(null, { onlyFood: true, n: 3 }));
  };

  // 11. History (history.html)
  pages.history = async function () {
    var tb = $("#tbody");
    if (!tb) return;

    try {
      var res = await API.history.get();
      var summary = res.summary || {};
      var cards = $$(".metric-card strong");
      if (cards.length >= 3) {
        cards[0].textContent = rupee(summary.totalEarned);
        cards[1].textContent = pad(summary.completedGigs);
        cards[2].textContent = (summary.averageRating ? summary.averageRating.toFixed(1) : "4.8");
      }

      if (res.transactions && res.transactions.length) {
        tb.innerHTML = res.transactions.map(function (tx) {
          var isPos = tx.signedAmount > 0;
          return '<tr><td><b>' + esc(tx.title) + '</b><small>' + esc(tx.subtitle) + '</small></td><td><span class="pill purple-pill">' + esc(tx.category || "General") + '</span></td><td>' + new Date(tx.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + '</td><td><span class="status ' + (tx.status === 'completed' ? 'success' : 'pending') + '">' + esc(tx.status) + '</span></td><td class="amount ' + (isPos ? 'positive' : '') + '">' + (isPos ? '+' : '') + rupee(tx.signedAmount) + '</td></tr>';
        }).join("");
      }

      var repLink = $(".table-panel .panel-head a");
      if (repLink) {
        repLink.href = API.history.getReportUrl();
        repLink.setAttribute("download", "gighub-report.csv");
      }
    } catch (e) {
      console.warn("History API failed", e);
    }
  };

  // 12. Profile (profile.html)
  pages.profile = async function () {
    try {
      var res = await API.users.me();
      var u = res.user;
      var stats = res.stats || {};

      var heroName = $(".profile-name h1");
      if (heroName) heroName.innerHTML = esc(u.name) + ' <span class="verified-badge">✓ Verified student</span>';

      var heroDept = $(".profile-name p");
      if (heroDept) heroDept.textContent = (u.department || "Student") + " · " + (u.college || "University");

      var heroBio = $(".profile-bio");
      if (heroBio && u.bio) heroBio.textContent = u.bio;

      var heroAvatar = $(".profile-avatar");
      if (heroAvatar) heroAvatar.textContent = u.initials || "ST";

      var statGrid = $$(".profile-stat-grid strong");
      if (statGrid.length >= 4) {
        statGrid[0].textContent = pad(stats.completedGigs || 0);
        statGrid[1].textContent = pad(stats.activeGigs || 0);
        statGrid[2].textContent = rupee(stats.totalEarned || 0);
        statGrid[3].textContent = (stats.trustScore || 96) + "%";
      }

      var editBtn = $(".profile-hero>.btn");
      if (editBtn) {
        editBtn.addEventListener("click", async function (e) {
          e.preventDefault();
          var newBio = prompt("Update your bio:", u.bio || "");
          if (newBio == null) return;
          try {
            var updated = await API.users.update({ bio: newBio });
            if (heroBio) heroBio.textContent = updated.user.bio;
            toast("Profile updated successfully!");
          } catch (err) {
            toast(err.message);
          }
        });
      }
    } catch (e) {
      console.warn("Profile API failed", e);
    }
  };

  // 13. Notifications (notifications.html)
  pages.notifications = async function () {
    var list = $("#notif-list");
    if (!list) return;

    async function loadNotifs(unreadOnly) {
      try {
        var res = await API.notifications.list(unreadOnly);
        if (res.notifications && res.notifications.length) {
          list.innerHTML = res.notifications.map(function (n) {
            return '<article class="notification' + (!n.read ? " unread" : "") + '" data-id="' + n.id + '"><span class="notification-icon purple">🔔</span><div><b>' + esc(n.title) + '</b><p>' + esc(n.body) + '</p><small>' + ago(n.createdAt) + '</small></div></article>';
          }).join("");

          $$(".notification", list).forEach(function (item) {
            item.addEventListener("click", async function () {
              var nid = item.dataset.id;
              if (item.classList.contains("unread")) {
                item.classList.remove("unread");
                try { await API.notifications.markRead(nid); } catch (e) {}
              }
            });
          });
        } else {
          list.innerHTML = '<div class="empty"><b>No notifications right now.</b></div>';
        }
      } catch (e) {
        console.warn("Notifications API failed", e);
      }
    }

    $("#mark-all") && $("#mark-all").addEventListener("click", async function (e) {
      e.preventDefault();
      try {
        await API.notifications.readAll();
        $$(".notification.unread", list).forEach(function (n) { n.classList.remove("unread"); });
        var pg = $(".ping");
        if (pg) pg.remove();
        toast("All notifications marked as read");
      } catch (e) {}
    });

    $$("[data-f]").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        $$("[data-f]").forEach(function (x) { x.classList.remove("selected"); });
        b.classList.add("selected");
        loadNotifs(b.dataset.f === "unread");
      });
    });

    await loadNotifs(false);
  };

  /* ---------- Initialization on DOM ready ---------- */
  function boot() {
    initGlobal();
    var p = document.body.dataset.page;
    if (p && pages[p]) pages[p]();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
