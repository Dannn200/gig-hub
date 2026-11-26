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

  function compressImage(file, maxSide, callback) {
    if (!file || !file.type || !file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement("canvas");
        var w = img.width, h = img.height;
        if (w > h) {
          if (w > maxSide) { h = Math.round(h * (maxSide / w)); w = maxSide; }
        } else {
          if (h > maxSide) { w = Math.round(w * (maxSide / h)); h = maxSide; }
        }
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
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
    var isProtected = ['dashboard', 'post', 'history', 'profile', 'notifications', 'admin'].indexOf(page) > -1;

    // Check protected page access
    if (isProtected && !token) {
      var nextPath = (location.pathname.split('/').pop() || 'dashboard.html') + location.search;
      location.href = 'login.html?next=' + encodeURIComponent(nextPath);
      return;
    }

    // Admin portal security guard
    if (page === 'admin') {
      if (!user || user.role !== 'admin') {
        toast("Admin privileges required to access Admin Portal");
        location.href = "dashboard.html";
        return;
      }
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
        var avatarContent = user.avatarUrl
          ? '<img src="' + esc(user.avatarUrl) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover" alt="' + esc(user.name) + '">'
          : esc(initials);
        var adminBadge = user.role === 'admin'
          ? '<a class="btn btn-small" href="admin.html" style="background:#fee2e2;color:#991b1b;font-weight:800;border:1px solid #fca5a5;padding:6px 11px">🛡️ Admin</a>'
          : '';

        navActions.innerHTML =
          adminBadge +
          '<a class="icon-link" href="notifications.html" aria-label="Notifications" title="Notifications">🔔</a>' +
          '<a class="profile-mini" href="profile.html" aria-label="Profile" title="' + esc(user.name) + '" style="overflow:hidden;padding:0">' + avatarContent + '</a>' +
          '<a class="btn btn-small btn-light" href="#" id="global-logout-btn">Log out</a>';

        var navLinks = $(".nav-links");
        if (navLinks && user.role === 'admin' && !navLinks.querySelector("a[href='admin.html']")) {
          var adminNavLink = document.createElement("a");
          adminNavLink.href = "admin.html";
          adminNavLink.textContent = "Admin Portal";
          navLinks.appendChild(adminNavLink);
        }

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

    var workerObj = (g.raw && g.raw.worker) || {};
    var workerName = workerObj.name || (isWorker ? user.name : "Assigned Student");
    var workerUpi = workerObj.upiId || "student@okhdfcbank";
    var upiUri = "upi://pay?pa=" + encodeURIComponent(workerUpi) + "&pn=" + encodeURIComponent(workerName) + "&am=" + g.price + "&cu=INR&tn=" + encodeURIComponent("Gig Reward: " + g.title);

    var upiCta = (g.price > 0 && !food)
      ? '<button class="btn btn-outline btn-full btn-small" id="open-upi-qr" style="margin-top:10px">📱 Scan UPI QR Code</button>'
      : '';

    box.innerHTML =
      '<a href="gigs.html" class="back-link">← Back to gigs</a><div class="detail-grid"><div class="stack">' +
      '<section class="panel"><div class="detail-hero"><span class="card-icon ' + (g.tone || "orange") + '">' + (g.icon || "💼") + '</span><div><span class="pill ' + (g.pill || c.pill) + '">' + esc(g.pillLabel || c.label) + '</span><h1>' + esc(g.title) + '</h1><p class="muted">Posted by ' + esc(g.by) + '</p></div></div>' +
      '<p style="color:var(--ink-2);margin-top:16px;line-height:1.6">' + esc(g.long || g.desc) + '</p>' +
      '<div class="info-grid"><div><small>Location</small><b>📍 ' + esc(g.loc) + '</b></div><div><small>When</small><b>🕒 ' + esc(g.when) + '</b></div><div><small>' + (food ? "Spots left" : "Category") + '</small><b>' + (food ? left + " of " + (g.total || 4) : esc(c.label)) + '</b></div></div>' +
      '<div class="tags">' + (g.tags || []).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("") + '</div></section>' +
      '<section class="suggest" style="margin-top:0"><div class="section-heading"><div><span class="eyebrow">YOU MAY ALSO LIKE</span><h2>Similar gigs</h2></div></div><div class="suggest-grid" id="similar"></div></section></div>' +
      '<aside class="sticky-side"><div class="panel price-card"><div class="big">' + rupee(g.price) + '</div><div class="unit">' + (food ? "per person" : "fixed reward") + '</div>' + cta + upiCta +
      '<div class="poster"><span class="avatar">' + esc(g.init) + '</span><div><b>' + esc(g.by) + '</b><small><span class="verified" style="display:inline-grid;width:15px;height:15px;font-size:9px">✓</span> Verified student</small></div></div>' +
      '<div class="safe">🔒 <span>Payments and rewards are safely completed when marked done by students.</span></div></div></aside></div>' +
      '<div class="modal" id="modal"><div class="modal-card"><h2>Apply for this gig</h2><p>Tell ' + esc(g.by) + ' why you\'re a great fit.</p><div class="field"><textarea id="msg" rows="4" placeholder="Hi! I can help with this because..."></textarea></div><div class="form-actions"><button class="btn btn-outline" id="cancel">Cancel</button><button class="btn btn-primary" id="send">Send application</button></div></div></div>' +
      '<div class="modal" id="upi-modal"><div class="modal-card" style="text-align:center;max-width:440px"><span class="card-icon green" style="margin:0 auto 12px;font-size:24px">📱</span><h2>Scan &amp; Pay via UPI QR</h2><p style="margin-bottom:14px;color:var(--ink-2);font-size:13px">Scan using Google Pay, PhonePe, Paytm, or BHIM.</p><div id="upi-qr-card" style="margin:16px auto;padding:12px;background:#fff;border-radius:16px;display:inline-block"></div><div style="background:var(--bg);padding:14px;border-radius:var(--r);margin:14px 0;text-align:left;font-size:13px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>Payee Student:</span><b>' + esc(workerName) + '</b></div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span>UPI ID:</span><b style="color:var(--brand)">' + esc(workerUpi) + '</b></div><div style="display:flex;justify-content:space-between"><span>Reward Amount:</span><b style="font-size:16px;color:#15803d">' + rupee(g.price) + '</b></div></div><div style="display:flex;flex-direction:column;gap:10px"><a href="' + upiUri + '" class="btn btn-primary btn-full" style="display:flex;align-items:center;justify-content:center;gap:8px">📱 Open in PhonePe / GPay / Paytm</a>' + ((isPoster && isInProgress) ? '<button class="btn btn-primary btn-full" id="confirm-payment-complete" style="background:#16a34a">✓ Payment Done — Complete Gig</button>' : '') + '<button class="btn btn-outline btn-full" id="close-upi-modal">Close</button></div></div></div>';

    $("#similar") && ($("#similar").innerHTML = suggestHTML(suggest(null, { like: g, exclude: g.id, n: 3 })));

    var upiModal = $("#upi-modal");
    function showUpiModal() {
      if (!upiModal) return;
      upiModal.classList.add("show");
      if (window.renderQRCode) {
        window.renderQRCode("#upi-qr-card", upiUri, 200);
      }
    }

    var openUpiBtn = $("#open-upi-qr");
    if (openUpiBtn) openUpiBtn.addEventListener("click", showUpiModal);

    var closeUpiBtn = $("#close-upi-modal");
    if (closeUpiBtn) closeUpiBtn.addEventListener("click", function () { upiModal.classList.remove("show"); });
    if (upiModal) upiModal.addEventListener("click", function (e) { if (e.target === upiModal) upiModal.classList.remove("show"); });

    async function executeComplete() {
      try {
        await API.gigs.complete(g.id);
        confetti();
        toast("Gig completed successfully!");
        setTimeout(function () { location.reload(); }, 600);
      } catch (err) {
        toast(err.message || "Failed to complete gig");
      }
    }

    var compBtn = $("#complete-btn");
    if (compBtn) {
      compBtn.addEventListener("click", async function () {
        if (isInProgress && isPoster && g.price > 0 && !food) {
          showUpiModal();
          return;
        }
        var actionText = food ? "close and complete this food order" : "mark this gig as completed";
        if (!confirm("Are you sure you want to " + actionText + "?")) return;
        compBtn.disabled = true;
        compBtn.textContent = "Completing...";
        await executeComplete();
        compBtn.disabled = false;
        compBtn.textContent = food ? "Close & Complete Food Order" : "✓ Mark Gig Completed";
      });
    }

    var confirmPayBtn = $("#confirm-payment-complete");
    if (confirmPayBtn) {
      confirmPayBtn.addEventListener("click", async function () {
        confirmPayBtn.disabled = true;
        confirmPayBtn.textContent = "Completing gig...";
        await executeComplete();
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
    var payeeUpi = (g.raw && g.raw.poster && g.raw.poster.upiId) || "cafeteria@upi";
    var payeeName = g.by || "Order Organizer";
    var upiUri = "upi://pay?pa=" + encodeURIComponent(payeeUpi) + "&pn=" + encodeURIComponent(payeeName) + "&am=" + g.price + "&cu=INR&tn=" + encodeURIComponent("Food Order: " + g.title);

    box.innerHTML =
      '<a href="gigs.html" class="back-link">← Back to gigs</a><div class="form-header"><span class="eyebrow">JOIN A FOOD ORDER</span><h1>Join the <em>' + esc(g.title) + '</em> order</h1><p>Confirm your share, choose a pickup time and you\'re done.</p></div>' +
      '<form id="join-form" class="order-grid"><div class="post-form">' +
      '<section class="form-section"><h2>Your share</h2><p>Reward: <b>' + rupee(g.price) + '</b> per person. ' + left + ' spots remaining.</p></section>' +
      '<section class="form-section"><h2>Pickup time</h2><div class="slots"><label class="slot"><input type="radio" name="slot" value="1:00 PM" checked><span>1:00 PM<small>' + esc(g.loc) + '</small></span></label><label class="slot"><input type="radio" name="slot" value="1:30 PM"><span>1:30 PM<small>' + esc(g.loc) + '</small></span></label></div></section>' +
      '<section class="form-section"><h2>Payment method: Scan &amp; Pay via UPI QR</h2>' +
      '<div style="background:#faf8ff;border:1.5px solid #dcd2ff;border-radius:var(--r);padding:20px;text-align:center">' +
      '<div id="join-upi-qr" style="margin:0 auto 12px"></div>' +
      '<p style="font-weight:700;font-size:14px;color:var(--brand-d)">Scan with Google Pay, PhonePe, Paytm or BHIM</p>' +
      '<small style="color:var(--ink-2);display:block;margin:6px 0">Payee: <b>' + esc(payeeName) + '</b> (' + esc(payeeUpi) + ') · Share: <b style="color:#15803d">' + rupee(g.price) + '</b></small>' +
      '<div style="margin-top:10px"><a href="' + upiUri + '" class="btn btn-small btn-primary" style="display:inline-flex;gap:6px">📱 Pay with UPI App</a></div>' +
      '</div></section>' +
      '<button class="btn btn-primary btn-lg btn-full" type="submit">Confirm &amp; join order →</button></div></form>';

    if (window.renderQRCode && $("#join-upi-qr")) {
      window.renderQRCode("#join-upi-qr", upiUri, 180);
    }

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

      var heroName = $("#profile-name-text") || $(".profile-name h1");
      if (heroName) heroName.textContent = u.name;

      var heroDept = $("#profile-dept-text") || $(".profile-name p");
      if (heroDept) heroDept.textContent = (u.department || "Student") + " · " + (u.college || "University");

      var heroBio = $("#profile-bio-text") || $(".profile-bio");
      if (heroBio) heroBio.textContent = u.bio || "Student who enjoys helping others with technology, design and campus activities.";

      var heroAvatar = $("#hero-avatar") || $(".profile-avatar");
      if (heroAvatar) {
        if (u.avatarUrl) {
          heroAvatar.innerHTML = '<img src="' + esc(u.avatarUrl) + '" style="width:100%;height:100%;border-radius:24px;object-fit:cover" alt="' + esc(u.name) + '">';
        } else {
          heroAvatar.textContent = u.initials || "ST";
        }
      }

      if (u.upiId) {
        var upiWrap = $("#profile-upi-wrap");
        var upiText = $("#profile-upi-text");
        if (upiWrap && upiText) {
          upiText.textContent = u.upiId;
          upiWrap.style.display = "";
        }
      }

      var tagsBox = $("#profile-tags");
      if (tagsBox && u.skills && u.skills.length) {
        tagsBox.innerHTML = u.skills.map(function (s) { return "<span>" + esc(s) + "</span>"; }).join("");
      }

      var statGrid = $$(".profile-stat-grid strong");
      if (statGrid.length >= 4) {
        statGrid[0].textContent = pad(stats.completedGigs || 0);
        statGrid[1].textContent = pad(stats.activeGigs || 0);
        statGrid[2].textContent = rupee(stats.totalEarned || 0);
        statGrid[3].textContent = (stats.trustScore || 96) + "%";
      }

      // Direct avatar photo upload
      var avatarInput = $("#avatar-file-input");
      if (avatarInput) {
        avatarInput.addEventListener("change", function (e) {
          var file = e.target.files && e.target.files[0];
          if (!file) return;
          compressImage(file, 240, async function (dataUrl) {
            try {
              var updated = await API.users.update({ avatarUrl: dataUrl });
              API.storage.setUser(updated.user, true);
              if (heroAvatar) heroAvatar.innerHTML = '<img src="' + esc(dataUrl) + '" style="width:100%;height:100%;border-radius:24px;object-fit:cover">';
              toast("Profile picture updated!");
              setTimeout(function () { location.reload(); }, 600);
            } catch (err) {
              toast(err.message || "Failed to update profile photo");
            }
          });
        });
      }

      // Edit Profile modal
      var editBtn = $("#edit-profile-btn") || $(".profile-hero>.btn");
      var editModal = $("#edit-modal");
      var editForm = $("#edit-profile-form");
      var editAvatarFile = $("#edit-avatar-file");
      var editAvatarPreview = $("#edit-avatar-preview");
      var currentNewAvatar = u.avatarUrl || "";

      if (editBtn && editModal) {
        editBtn.addEventListener("click", function (e) {
          e.preventDefault();
          if ($("#edit-name")) $("#edit-name").value = u.name || "";
          if ($("#edit-college")) $("#edit-college").value = u.college || "";
          if ($("#edit-department")) $("#edit-department").value = u.department || "";
          if ($("#edit-bio")) $("#edit-bio").value = u.bio || "";
          if ($("#edit-skills")) $("#edit-skills").value = (u.skills || []).join(", ");
          if ($("#edit-upi")) $("#edit-upi").value = u.upiId || "";

          if (editAvatarPreview) {
            if (currentNewAvatar) {
              editAvatarPreview.innerHTML = '<img src="' + esc(currentNewAvatar) + '" style="width:100%;height:100%;border-radius:18px;object-fit:cover">';
            } else {
              editAvatarPreview.textContent = u.initials || "ST";
            }
          }
          editModal.classList.add("show");
        });

        if (editAvatarFile) {
          editAvatarFile.addEventListener("change", function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            compressImage(file, 240, function (dataUrl) {
              currentNewAvatar = dataUrl;
              if (editAvatarPreview) {
                editAvatarPreview.innerHTML = '<img src="' + esc(dataUrl) + '" style="width:100%;height:100%;border-radius:18px;object-fit:cover">';
              }
            });
          });
        }

        $("#edit-modal-cancel") && $("#edit-modal-cancel").addEventListener("click", function () {
          editModal.classList.remove("show");
        });

        editModal.addEventListener("click", function (e) {
          if (e.target === editModal) editModal.classList.remove("show");
        });

        if (editForm) {
          editForm.addEventListener("submit", async function (e) {
            e.preventDefault();
            var payload = {
              name: ($("#edit-name").value || "").trim(),
              college: ($("#edit-college").value || "").trim(),
              department: ($("#edit-department").value || "").trim(),
              bio: ($("#edit-bio").value || "").trim(),
              upiId: ($("#edit-upi").value || "").trim(),
            };
            if (currentNewAvatar) payload.avatarUrl = currentNewAvatar;

            var skillsRaw = ($("#edit-skills").value || "").trim();
            if (skillsRaw) {
              payload.skills = skillsRaw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
            } else {
              payload.skills = [];
            }

            try {
              var updated = await API.users.update(payload);
              API.storage.setUser(updated.user, true);
              toast("Profile updated successfully!");
              editModal.classList.remove("show");
              setTimeout(function () { location.reload(); }, 600);
            } catch (err) {
              toast(err.message || "Failed to update profile");
            }
          });
        }
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

  // 14. Admin Portal (admin.html)
  pages.admin = async function () {
    var user = API ? API.storage.getUser() : null;
    if (!user || user.role !== 'admin') {
      toast("Admin privileges required");
      location.href = "dashboard.html";
      return;
    }

    var tbody = $("#admin-tbody");
    var searchInput = $("#admin-search");
    var roleSelect = $("#admin-role-filter");
    var countBadge = $("#accounts-count");

    // Load stats
    try {
      var stats = await API.admin.stats();
      if ($("#m-users")) $("#m-users").textContent = pad(stats.totalUsers);
      if ($("#m-active")) $("#m-active").textContent = pad(stats.activeGigs);
      if ($("#m-completed")) $("#m-completed").textContent = pad(stats.completedGigs);
      if ($("#m-volume")) $("#m-volume").textContent = rupee(stats.totalVolume);
    } catch (e) {
      console.warn("Admin stats failed", e);
    }

    async function loadAccounts() {
      if (!tbody) return;
      var q = searchInput ? searchInput.value.trim() : "";
      var role = roleSelect ? roleSelect.value : "all";
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--ink-3)">Loading accounts...</td></tr>';

      try {
        var res = await API.admin.users({ q: q, role: role });
        var users = res.users || [];
        if (countBadge) countBadge.textContent = users.length + " account" + (users.length === 1 ? "" : "s");

        if (!users.length) {
          tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--ink-3)">No student accounts found.</td></tr>';
          return;
        }

        tbody.innerHTML = users.map(function (u) {
          var avatar = u.avatar_url
            ? '<img src="' + esc(u.avatar_url) + '" class="admin-avatar" alt="' + esc(u.name) + '">'
            : '<div class="admin-avatar">' + esc(u.name ? u.name.slice(0, 2).toUpperCase() : "ST") + '</div>';
          var roleBadge = u.role === 'admin'
            ? '<span class="admin-badge">🛡️ Admin</span>'
            : '<span class="student-badge">🎓 Student</span>';
          var joined = u.created_at ? new Date(u.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "Recent";

          return '<tr>' +
            '<td><div style="display:flex;align-items:center;gap:10px">' + avatar + '<div><b>' + esc(u.name) + '</b>' + (u.verified ? ' <span style="color:var(--green)">✓</span>' : '') + '<small>' + esc(u.department || "Student") + '</small></div></div></td>' +
            '<td>' + esc(u.email) + '</td>' +
            '<td>' + roleBadge + '</td>' +
            '<td>' + esc(u.college || "Campus") + '</td>' +
            '<td><b>' + rupee(u.balance || 0) + '</b></td>' +
            '<td>' + pad(u.posted_gigs_count || 0) + '</td>' +
            '<td>' + pad(u.completed_gigs_count || 0) + '</td>' +
            '<td><small>' + joined + '</small></td>' +
            '<td><button class="btn btn-small btn-outline inspect-btn" data-id="' + u.id + '">Inspect & History →</button></td>' +
            '</tr>';
        }).join("");

        // Attach inspect handlers
        $$(".inspect-btn", tbody).forEach(function (btn) {
          btn.addEventListener("click", function () {
            openInspectModal(btn.dataset.id);
          });
        });
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:#ef4444">Failed to load accounts: ' + esc(err.message) + '</td></tr>';
      }
    }

    async function openInspectModal(id) {
      var modal = $("#admin-modal");
      var body = $("#admin-modal-body");
      if (!modal || !body) return;
      body.innerHTML = '<div style="text-align:center;padding:40px;color:var(--ink-3)">Loading full account history...</div>';
      modal.classList.add("show");

      try {
        var data = await API.admin.getUser(id);
        var u = data.user;
        var stats = data.stats || {};
        var posted = data.postedGigs || [];
        var worked = data.workedGigs || [];
        var txs = data.transactions || [];

        var avatar = u.avatarUrl
          ? '<img src="' + esc(u.avatarUrl) + '" alt="' + esc(u.name) + '">'
          : '<div class="big-avatar">' + esc(u.name ? u.name.slice(0, 2).toUpperCase() : "ST") + '</div>';

        var roleBtnText = u.role === 'admin' ? "Demote to Student" : "Promote to Admin";
        var nextRole = u.role === 'admin' ? "student" : "admin";

        body.innerHTML =
          '<div class="user-profile-header">' + avatar +
          '<div style="flex:1">' +
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">' +
          '<div><h3 style="font-size:20px;display:flex;align-items:center;gap:8px">' + esc(u.name) + ' <span class="' + (u.role === 'admin' ? 'admin-badge' : 'student-badge') + '">' + (u.role === 'admin' ? '🛡️ Admin' : '🎓 Student') + '</span></h3>' +
          '<p style="color:var(--ink-3);font-size:13px">' + esc(u.email) + ' · ' + esc(u.college) + ' (' + esc(u.department || "General") + ')</p></div>' +
          '<button class="role-btn" id="toggle-role-btn">' + roleBtnText + '</button>' +
          '</div>' +
          '<p style="font-size:13px;color:var(--ink-2);margin:8px 0">' + esc(u.bio || "No bio provided.") + '</p>' +
          '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
          (u.upiId ? '<span class="pill green-pill">📱 UPI: ' + esc(u.upiId) + '</span>' : '<span class="pill" style="background:#f3f4f6">No UPI ID</span>') +
          '<span class="pill purple-pill">Balance: ' + rupee(u.balance) + '</span>' +
          '<span class="pill blue-pill">Trust: ' + (stats.trustScore || 80) + '%</span>' +
          '</div>' +
          '</div></div>' +

          '<div class="modal-tabs">' +
          '<button class="modal-tab active" data-tab="posted">Posted Gigs (' + posted.length + ')</button>' +
          '<button class="modal-tab" data-tab="worked">Worked Gigs (' + worked.length + ')</button>' +
          '<button class="modal-tab" data-tab="txs">Transactions (' + txs.length + ')</button>' +
          '</div>' +

          '<div class="modal-content-box" id="admin-tab-content"></div>';

        function renderTab(tab) {
          var container = $("#admin-tab-content");
          if (!container) return;
          if (tab === 'posted') {
            if (!posted.length) { container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-3)">No gigs posted by this student.</div>'; return; }
            container.innerHTML = posted.map(function (g) {
              return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--line-2)">' +
                '<div><b>' + esc(g.title) + '</b><small style="display:block;color:var(--ink-3)">' + esc(g.category) + ' · ' + esc(g.location || "Campus") + ' · ' + (g.worker_name ? 'Worker: ' + esc(g.worker_name) : 'No worker yet') + '</small></div>' +
                '<div style="text-align:right"><span class="status ' + (g.status === 'completed' ? 'success' : g.status === 'open' ? 'active' : 'pending') + '">' + esc(g.status) + '</span><b style="display:block;margin-top:4px">' + rupee(g.reward) + '</b></div>' +
                '</div>';
            }).join("");
          } else if (tab === 'worked') {
            if (!worked.length) { container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-3)">No gigs accepted or completed by this student.</div>'; return; }
            container.innerHTML = worked.map(function (g) {
              return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--line-2)">' +
                '<div><b>' + esc(g.title) + '</b><small style="display:block;color:var(--ink-3)">Posted by ' + esc(g.poster_name) + ' · ' + esc(g.category) + '</small></div>' +
                '<div style="text-align:right"><span class="status ' + (g.status === 'completed' ? 'success' : 'pending') + '">' + esc(g.status) + '</span><b style="display:block;margin-top:4px">' + rupee(g.reward) + '</b></div>' +
                '</div>';
            }).join("");
          } else if (tab === 'txs') {
            if (!txs.length) { container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-3)">No wallet transactions recorded.</div>'; return; }
            container.innerHTML = txs.map(function (t) {
              var pos = t.type === 'earning';
              return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px;border-bottom:1px solid var(--line-2)">' +
                '<div><b>' + esc(t.gig_title || t.note || t.type) + '</b><small style="display:block;color:var(--ink-3)">' + esc(t.type) + ' · ' + (t.created_at ? new Date(t.created_at).toLocaleDateString() : '') + '</small></div>' +
                '<div style="text-align:right"><span class="status ' + (t.status === 'completed' ? 'success' : 'pending') + '">' + esc(t.status) + '</span><b class="amount ' + (pos ? 'positive' : '') + '" style="display:block;margin-top:4px">' + (pos ? '+' : '-') + rupee(t.amount) + '</b></div>' +
                '</div>';
            }).join("");
          }
        }

        renderTab('posted');

        $$(".modal-tab", body).forEach(function (tabBtn) {
          tabBtn.addEventListener("click", function () {
            $$(".modal-tab", body).forEach(function (t) { t.classList.remove("active"); });
            tabBtn.classList.add("active");
            renderTab(tabBtn.dataset.tab);
          });
        });

        var roleBtn = $("#toggle-role-btn");
        if (roleBtn) {
          roleBtn.addEventListener("click", async function () {
            if (!confirm("Are you sure you want to change this account's role to " + nextRole + "?")) return;
            try {
              await API.admin.setRole(id, nextRole);
              toast("User role updated to " + nextRole);
              openInspectModal(id);
              loadAccounts();
            } catch (err) {
              toast(err.message || "Failed to update role");
            }
          });
        }

      } catch (err) {
        body.innerHTML = '<div style="padding:24px;color:#ef4444">Failed to load account details: ' + esc(err.message) + '</div>';
      }
    }

    $("#admin-modal-close") && $("#admin-modal-close").addEventListener("click", function () {
      $("#admin-modal").classList.remove("show");
    });
    $("#admin-modal") && $("#admin-modal").addEventListener("click", function (e) {
      if (e.target === $("#admin-modal")) $("#admin-modal").classList.remove("show");
    });

    if (searchInput) {
      var timeout = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(timeout);
        timeout = setTimeout(loadAccounts, 250);
      });
    }
    if (roleSelect) roleSelect.addEventListener("change", loadAccounts);

    await loadAccounts();
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
