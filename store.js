/* 数据层：全部数据存于本机 localStorage，不联网传输 */
(function () {
  var KEY = 'xiangshe-tongxing.v1';

  // 以本地文件方式打开时（file:// 属于 opaque origin）localStorage 不可用，
  // 此时退化为内存存储：功能可用，关闭页面后不保留。
  var mem = {};
  var LS = (function () {
    try {
      localStorage.setItem('__probe', '1');
      localStorage.removeItem('__probe');
      return localStorage;
    } catch (e) {
      return {
        getItem: function (k) { return k in mem ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; }
      };
    }
  })();

  function today() {
    var d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day);
  }

  function newCase(cases) {
    var n = cases.length + 1;
    var code;
    do { code = 'A' + (n < 10 ? '0' + n : n); n++; }
    while (cases.some(function (c) { return c.id === code; }));
    return {
      id: code, grade: '', stage: '接案', note: '', createdAt: today(),
      family: { guardian: '祖辈', parentsMigrant: false, weeklyContact: false, guardianStatus: '弱化', careAdequacy: '充足' },
      school: { peerRelation: 3, academic: 3, supportLanded: false },
      emotion: { moodDrop: 1 },
      risk: { selfHarm: false, abuse: false, bullying: false, neglect: false, runaway: false },
      visits: [], assessments: [], plans: [], followUps: []
    };
  }

  var DB = {
    data: { cases: [], activeId: null },
    today: today,
    load: function () {
      try {
        var raw = LS.getItem(KEY);
        if (raw) {
          var d = JSON.parse(raw);
          if (d && Array.isArray(d.cases)) { this.data = d; return; }
        }
      } catch (e) { /* 数据损坏时按空库处理 */ }
      this.data = { cases: [], activeId: null };
    },
    save: function () { LS.setItem(KEY, JSON.stringify(this.data)); },
    add: function (c) { this.data.cases.push(c); this.data.activeId = c.id; this.save(); return c; },
    get: function (id) {
      for (var i = 0; i < this.data.cases.length; i++) if (this.data.cases[i].id === id) return this.data.cases[i];
      return null;
    },
    active: function () { return this.get(this.data.activeId) || this.data.cases[0] || null; },
    remove: function (id) {
      this.data.cases = this.data.cases.filter(function (c) { return c.id !== id; });
      if (this.data.activeId === id) this.data.activeId = this.data.cases.length ? this.data.cases[0].id : null;
      this.save();
    },
    wipe: function () { this.data = { cases: [], activeId: null }; this.save(); }
  };

  DB.newCase = function () { return newCase(this.data.cases); };
  window.DB = DB;
})();
