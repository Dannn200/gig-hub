/**
 * Gig Hub API Client
 * Connects frontend pages to the backend REST API
 */
(function (global) {
  'use strict';

  // Resolve API Base URL
  function resolveApiBase() {
    if (global.GIGHUB_API_BASE) return global.GIGHUB_API_BASE;
    try {
      var meta = document.querySelector('meta[name="api-base"]');
      if (meta && meta.content) return meta.content;
      var stored = localStorage.getItem('gh_api_url');
      if (stored) return stored;
    } catch (e) {}

    // When served over http/https (e.g. Render, production, or local server),
    // always use relative '/api' on the same origin so it connects properly everywhere
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      return '/api';
    }
    // Default fallback (e.g. file:// protocol)
    return 'http://localhost:4000/api';
  }

  var API_BASE = resolveApiBase();

  var storage = {
    getToken: function () {
      try { return localStorage.getItem('gh_token') || sessionStorage.getItem('gh_token'); } catch (e) { return null; }
    },
    setToken: function (token, remember) {
      try {
        if (remember) {
          localStorage.setItem('gh_token', token);
          sessionStorage.removeItem('gh_token');
        } else {
          sessionStorage.setItem('gh_token', token);
          localStorage.removeItem('gh_token');
        }
      } catch (e) {}
    },
    getUser: function () {
      try {
        var u = localStorage.getItem('gh_user') || sessionStorage.getItem('gh_user');
        return u ? JSON.parse(u) : null;
      } catch (e) { return null; }
    },
    setUser: function (user, remember) {
      try {
        var str = JSON.stringify(user);
        if (remember) {
          localStorage.setItem('gh_user', str);
          sessionStorage.removeItem('gh_user');
        } else {
          sessionStorage.setItem('gh_user', str);
          localStorage.removeItem('gh_user');
        }
      } catch (e) {}
    },
    clearAuth: function () {
      try {
        localStorage.removeItem('gh_token');
        sessionStorage.removeItem('gh_token');
        localStorage.removeItem('gh_user');
        sessionStorage.removeItem('gh_user');
      } catch (e) {}
    }
  };

  async function request(endpoint, options) {
    options = options || {};
    var url = API_BASE + endpoint;
    var headers = options.headers || {};
    var token = storage.getToken();

    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    var config = {
      method: options.method || 'GET',
      headers: headers,
      body: options.body
    };

    var res;
    try {
      res = await fetch(url, config);
    } catch (netErr) {
      throw new Error('Could not connect to backend server at ' + API_BASE + '. Please ensure the backend is running.');
    }

    var isJson = (res.headers.get('content-type') || '').includes('application/json');
    var data = isJson ? await res.json() : await res.text();

    if (!res.ok) {
      var msg = 'Request failed (' + res.status + ')';
      if (data && data.error && data.error.message) {
        msg = data.error.message;
        if (data.error.details && Array.isArray(data.error.details)) {
          msg += ': ' + data.error.details.map(function (d) { return d.message || d.path; }).join(', ');
        }
      } else if (typeof data === 'string') {
        msg = data;
      }
      var err = new Error(msg);
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // Visual metadata mapping for categories
  var CAT_META = {
    food:     { label: 'Food',     icon: '🍱', tone: 'orange', pill: 'orange-pill' },
    skills:   { label: 'Skills',   icon: '💡', tone: 'purple', pill: 'purple-pill' },
    event:    { label: 'Event',    icon: '🎪', tone: 'blue',   pill: 'blue-pill' },
    events:   { label: 'Events',   icon: '🎪', tone: 'blue',   pill: 'blue-pill' },
    task:     { label: 'Task',     icon: '🛵', tone: 'orange', pill: 'orange-pill' },
    tasks:    { label: 'Tasks',    icon: '🛵', tone: 'orange', pill: 'orange-pill' },
    academic: { label: 'Academic', icon: '📚', tone: 'purple', pill: 'purple-pill' }
  };

  function formatBackendGig(g) {
    if (!g) return null;
    var cat = (g.category || 'skills').toLowerCase();
    var meta = CAT_META[cat] || CAT_META.skills;
    var when = 'Flexible';
    if (g.scheduledAt) {
      try {
        var dt = new Date(g.scheduledAt);
        when = dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ' · ' +
               dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        when = g.scheduledAt;
      }
    }

    return {
      id: g.id,
      cat: cat === 'academic' ? 'academic' : cat === 'food' ? 'food' : cat === 'task' ? 'tasks' : cat === 'event' ? 'events' : 'skills',
      rawCat: cat,
      title: g.title,
      desc: g.description,
      long: g.description,
      price: g.reward,
      loc: g.location || 'Campus',
      when: when,
      icon: meta.icon,
      tone: meta.tone,
      pill: meta.pill,
      pillLabel: meta.label,
      tags: [meta.label.toLowerCase()],
      by: g.poster ? g.poster.name : 'Verified Student',
      init: g.poster ? g.poster.initials : 'ST',
      posterId: g.posterId || (g.poster ? g.poster.id : null),
      workerId: g.workerId || (g.worker ? g.worker.id : null),
      spots: g.spotsLeft != null ? g.spotsLeft : (g.spotsTotal || 4),
      total: g.spotsTotal || 4,
      status: g.status,
      viewer: g.viewer || {},
      raw: g
    };
  }

  var api = {
    getBaseUrl: function () { return API_BASE; },
    setBaseUrl: function (url) { API_BASE = url; localStorage.setItem('gh_api_url', url); },
    storage: storage,
    formatGig: formatBackendGig,
    request: request,

    // Health check
    health: function () {
      return request('/health');
    },

    // Auth
    auth: {
      getConfig: function () {
        return request('/auth/config');
      },
      register: async function (data) {
        var res = await request('/auth/register', { method: 'POST', body: data });
        storage.setToken(res.token, true);
        storage.setUser(res.user, true);
        return res;
      },
      login: async function (data) {
        var res = await request('/auth/login', { method: 'POST', body: data });
        storage.setToken(res.token, data.remember);
        storage.setUser(res.user, data.remember);
        return res;
      },
      googleLogin: async function (data) {
        var res = await request('/auth/google', { method: 'POST', body: data });
        storage.setToken(res.token, data.remember !== false);
        storage.setUser(res.user, data.remember !== false);
        return res;
      },
      me: async function () {
        var res = await request('/auth/me');
        if (res.user) storage.setUser(res.user, true);
        return res;
      },
      logout: async function () {
        try {
          await request('/auth/logout', { method: 'POST' });
        } catch (e) {}
        storage.clearAuth();
      },
      forgotPassword: function (email) {
        return request('/auth/forgot-password', { method: 'POST', body: { email: email } });
      },
      resetPassword: function (token, password) {
        return request('/auth/reset-password', { method: 'POST', body: { token: token, password: password } });
      }
    },

    // Dashboard
    dashboard: {
      get: function () {
        return request('/dashboard');
      }
    },

    // Gigs
    gigs: {
      list: function (params) {
        params = params || {};
        var q = new URLSearchParams();
        if (params.category && params.category !== 'all') {
          // Normalize frontend category values ('tasks' -> 'task', 'events' -> 'event')
          var c = params.category;
          if (c === 'tasks') c = 'task';
          if (c === 'events') c = 'event';
          q.set('category', c);
        }
        if (params.q) q.set('q', params.q);
        if (params.sort) {
          var s = params.sort;
          if (s === 'low') s = 'reward_asc';
          if (s === 'high') s = 'reward_desc';
          if (s === 'new') s = 'newest';
          q.set('sort', s);
        }
        if (params.page) q.set('page', params.page);
        if (params.limit) q.set('limit', params.limit);
        var qs = q.toString();
        return request('/gigs' + (qs ? '?' + qs : ''));
      },
      mine: function (params) {
        params = params || {};
        var q = new URLSearchParams(params).toString();
        return request('/gigs/mine' + (q ? '?' + q : ''));
      },
      get: function (id) {
        return request('/gigs/' + encodeURIComponent(id));
      },
      create: function (data) {
        return request('/gigs', { method: 'POST', body: data });
      },
      join: function (id) {
        return request('/gigs/' + encodeURIComponent(id) + '/join', { method: 'POST' });
      },
      accept: function (id) {
        return request('/gigs/' + encodeURIComponent(id) + '/accept', { method: 'POST' });
      },
      complete: function (id) {
        return request('/gigs/' + encodeURIComponent(id) + '/complete', { method: 'POST' });
      },
      leave: function (id) {
        return request('/gigs/' + encodeURIComponent(id) + '/leave', { method: 'POST' });
      },
      abandon: function (id) {
        return request('/gigs/' + encodeURIComponent(id) + '/abandon', { method: 'POST' });
      }
    },

    // History & Earnings
    history: {
      get: function (params) {
        params = params || {};
        var q = new URLSearchParams(params).toString();
        return request('/history' + (q ? '?' + q : ''));
      },
      getReportUrl: function () {
        return API_BASE + '/history/report.csv';
      }
    },

    // Wallet
    wallet: {
      get: function () {
        return request('/wallet');
      },
      withdraw: function (data) {
        return request('/wallet/withdraw', { method: 'POST', body: data });
      }
    },

    // Users & Profile
    users: {
      me: function () {
        return request('/users/me');
      },
      update: function (data) {
        return request('/users/me', { method: 'PATCH', body: data });
      },
      get: function (id) {
        return request('/users/' + encodeURIComponent(id));
      },
      reviews: function (id, params) {
        params = params || {};
        var q = new URLSearchParams(params).toString();
        return request('/users/' + encodeURIComponent(id) + '/reviews' + (q ? '?' + q : ''));
      }
    },

    // Notifications
    notifications: {
      list: function (unreadOnly) {
        return request('/notifications' + (unreadOnly ? '?unread=true' : ''));
      },
      unreadCount: function () {
        return request('/notifications/unread-count');
      },
      readAll: function () {
        return request('/notifications/read-all', { method: 'POST' });
      },
      markRead: function (id) {
        return request('/notifications/' + encodeURIComponent(id) + '/read', { method: 'PATCH' });
      },
      delete: function (id) {
        return request('/notifications/' + encodeURIComponent(id), { method: 'DELETE' });
      }
    },

    // Admin Portal
    admin: {
      stats: function () {
        return request('/admin/stats');
      },
      users: function (params) {
        params = params || {};
        var q = new URLSearchParams(params).toString();
        return request('/admin/users' + (q ? '?' + q : ''));
      },
      getUser: function (id) {
        return request('/admin/users/' + encodeURIComponent(id));
      },
      setRole: function (id, role) {
        return request('/admin/users/' + encodeURIComponent(id) + '/role', { method: 'PATCH', body: { role: role } });
      }
    }
  };

  global.GigHubApi = api;
})(window);
