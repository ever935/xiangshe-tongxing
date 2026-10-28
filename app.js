/* 交互层：路由、表单绑定、渲染 */
(function () {
  var el = function (id) { return document.getElementById(id); };
  var dismissed = {};          // 已确认处置的个案，本次会话内不再置顶
  var lastAssess = null;       // 最近一次评估结果
  var lastVisitText = '';
  var lastPlanText = '';

  /* ---------- 复选框组 ---------- */
  function buildChecks(container, list) {
    container.innerHTML = list.map(function (o) {
      return '<label><input type="checkbox" data-key="' + o.key + '"><span>' + o.label + '</span></label>';
    }).join('');
  }
  function readChecks(container) {
    return Array.prototype.map.call(container.querySelectorAll('input:checked'), function (i) { return i.dataset.key; });
  }
  function setChecks(container, keys) {
    Array.prototype.forEach.call(container.querySelectorAll('input'), function (i) {
      i.checked = keys.indexOf(i.dataset.key) >= 0;
    });
  }

  /* ---------- 渲染：个案选择 / 列表 / 统计 ---------- */
  function renderCaseUI() {
    var cases = DB.data.cases, act = DB.active();

    el('caseSelect').innerHTML = cases.map(function (c) {
      return '<option value="' + c.id + '"' + (act && c.id === act.id ? ' selected' : '') + '>' + c.id + '　' + (c.grade || '未填年级') + '　' + c.stage + '</option>';
    }).join('');

    el('caseList').innerHTML = cases.length ? cases.map(function (c) {
      var lv = RISK.assess(c).level;
      var n = c.visits.length + c.assessments.length + c.plans.length + c.followUps.length;
      return '<div class="item' + (act && c.id === act.id ? ' on' : '') + '" data-id="' + c.id + '">' +
        '<div><b>' + c.id + '</b> <span class="badge ' + lv + '">' + lv + '</span>　<span class="meta">' +
        (c.grade || '未填年级') + ' · ' + c.stage + ' · 记录 ' + n + ' 条</span></div>' +
        '<span class="meta">' + c.createdAt + '</span></div>';
    }).join('') : '<div class="empty">还没有个案，点击「新建个案」开始。</div>';

    var s = { '绿': 0, '黄': 0, '红': 0 };
    cases.forEach(function (c) { s[RISK.assess(c).level]++; });
    el('stats').innerHTML =
      '<div class="stat"><b>' + cases.length + '</b><span>在跟个案</span></div>' +
      '<div class="stat"><b style="color:var(--red)">' + s['红'] + '</b><span>红 · 立即介入</span></div>' +
      '<div class="stat"><b style="color:var(--amber)">' + s['黄'] + '</b><span>黄 · 重点关注</span></div>' +
      '<div class="stat"><b style="color:var(--green)">' + s['绿'] + '</b><span>绿 · 常态关注</span></div>';

    fillCaseForm(act);
    renderAlert();
    renderLedger();
  }

  function fillCaseForm(c) {
    if (!c) return;
    el('c_code').value = c.id;
    el('c_grade').value = c.grade;
    el('c_stage').value = c.stage;
    el('c_created').value = c.createdAt;
    el('c_note').value = c.note;
    el('caseStamp').textContent = '建档 ' + c.createdAt;
    el('a_mood').value = c.emotion.moodDrop;
    el('a_peer').value = c.school.peerRelation;
    el('a_acad').value = c.school.academic;
    el('a_guard').value = c.family.guardianStatus;
    el('a_care').value = c.family.careAdequacy;
    el('a_support').value = c.school.supportLanded ? 'yes' : 'no';
    setChecks(el('a_risks'), RISK.HARD.filter(function (h) { return c.risk[h.key]; }).map(function (h) { return h.key; }));
    if (!el('v_date').value) el('v_date').value = DB.today();
    if (!el('f_date').value) el('f_date').value = DB.today();
  }

  /* ---------- 全局警示条 ---------- */
  function renderAlert() {
    var c = DB.active(), bar = el('alertBar');
    if (!c) { bar.hidden = true; return; }
    var hard = RISK.HARD.filter(function (h) { return c.risk[h.key]; }).map(function (h) { return h.label; });
    if (!hard.length || dismissed[c.id]) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML =
      '<h3>⚠ 强制报告警示：' + c.id + '　' + hard.join('、') + '</h3>' +
      '<ol>' +
      '<li>立即确保儿童人身安全，不要让其独处；</li>' +
      '<li>立即报告学校负责人，并按规定向公安、民政或卫生健康部门报告；</li>' +
      '<li>同步联系监护人；监护人失联或本人即为侵害人时，直接上报，不通过监护人转达；</li>' +
      '<li>记录时间、事实与处置过程，完整留痕；</li>' +
      '<li>本工具不提供诊断，处置以专业机构判断为准。</li>' +
      '</ol>' +
      '<div class="row-btns"><button class="btn primary" id="btnAlertAck">我已按流程处置并留痕</button></div>';
    el('btnAlertAck').onclick = function () { dismissed[c.id] = true; renderAlert(); };
  }

  /* ---------- 台账 ---------- */
  function ledgerEntries(c) {
    var out = [];
    c.visits.forEach(function (v) { out.push({ date: v.date, type: '家访', text: v.text, ref: { kind: 'visits', id: v.id } }); });
    c.assessments.forEach(function (a) { out.push({ date: a.date, type: '评估', text: '风险等级 ' + a.level + '，总分 ' + a.total + '/28' + (a.hard.length ? '，硬触发：' + a.hard.join('、') : ''), ref: { kind: 'assessments', id: a.id } }); });
    c.plans.forEach(function (p) { out.push({ date: p.date, type: '方案', text: p.summary, ref: { kind: 'plans', id: p.id } }); });
    c.followUps.forEach(function (f) { out.push({ date: f.date, type: '跟进', text: '【' + f.riskLevel + '】' + f.adjustment, ref: { kind: 'followUps', id: f.id } }); });
    out.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return out;
  }

  function renderLedger() {
    var c = DB.active(), box = el('ledger');
    if (!c) { box.innerHTML = '<div class="empty">请先新建个案。</div>'; el('ledgerCount').textContent = ''; return; }
    var list = ledgerEntries(c);
    el('ledgerCount').textContent = '共 ' + list.length + ' 条记录';
    box.innerHTML = list.length ? list.map(function (e, i) {
      return '<div class="tl"><div class="date">' + e.date + '</div><div class="body">' +
        '<div class="t">' + e.type + '</div><div class="c">' + escapeHtml(e.text) + '</div></div>' +
        '<button class="btn ghost noprint" data-del="' + e.ref.kind + '|' + e.ref.id + '">删除</button></div>';
    }).join('') : '<div class="empty">暂无记录。</div>';
    Array.prototype.forEach.call(box.querySelectorAll('[data-del]'), function (b) {
      b.onclick = function () {
        var p = b.dataset.del.split('|');
        c[p[0]] = c[p[0]].filter(function (x) { return x.id !== p[1]; });
        DB.save(); renderCaseUI();
      };
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]; });
  }

  /* ---------- ① 家访快记 ---------- */
  function buildVisitText(c, v) {
    var L = [];
    L.push('家访记录表');
    L.push('────────────────────────────────');
    L.push('个案编号：' + c.id + '　记录日期：' + v.date);
    L.push('家访方式：' + v.method + '　参与人：' + (v.staff || '—'));
    L.push('在场人员：' + (v.present || '—'));
    L.push('');
    L.push('一、客观观察（只写看到的事实，不写推测）');
    L.push('　' + (v.observed || '（未填写）'));
    L.push('');
    L.push('二、监护人表述');
    L.push('　' + (v.guardian || '（未填写）'));
    L.push('');
    L.push('三、该生表述');
    L.push('　' + (v.student || '（未填写）'));
    L.push('');
    L.push('四、本次发现的风险线索');
    L.push('　' + (v.risks.length ? v.risks.map(function (k) {
      var h = RISK.HARD.filter(function (x) { return x.key === k; })[0]; return h ? h.label : k;
    }).join('、') : '无'));
    L.push('');
    L.push('五、已做处置');
    L.push('　' + (v.done || '（未填写）'));
    L.push('');
    L.push('六、下一步约定');
    L.push('　' + (v.next || '（未填写）'));
    L.push('');
    L.push('记录人：' + (v.writer || '　　　　') + '　　　　日期：' + v.date);
    if (v.risks.length) {
      L.push('');
      L.push('⚠ 强制报告提示（本次存在硬触发线索）');
      L.push('1. 立即确保儿童人身安全，不要让其独处；');
      L.push('2. 立即报告学校负责人，并按规定向公安、民政或卫生健康部门报告；');
      L.push('3. 同步联系监护人；监护人失联或本人即为侵害人时，直接上报，不通过监护人转达；');
      L.push('4. 记录时间、事实与处置过程，完整留痕；');
      L.push('5. 本工具不提供诊断，处置以专业机构判断为准。');
    }
    return L.join('\n');
  }

  function readVisitForm() {
    return {
      date: el('v_date').value || DB.today(),
      method: el('v_method').value,
      staff: el('v_staff').value.trim(),
      present: el('v_present').value.trim(),
      observed: el('v_observed').value.trim(),
      guardian: el('v_guardian').value.trim(),
      student: el('v_student').value.trim(),
      risks: readChecks(el('v_risks')),
      done: el('v_done').value.trim(),
      next: el('v_next').value.trim(),
      writer: el('v_writer').value.trim()
    };
  }

  /* ---------- 复制 ---------- */
  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = '已复制'; setTimeout(function () { btn.textContent = t; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else fallback();
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { alert('复制失败，请手动选择文本。'); }
      document.body.removeChild(ta);
    }
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  /* ---------- 导出 / 导入 ---------- */
  function download(name, text) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }

  /* ---------- 路由 ---------- */
  function route() {
    var h = (location.hash || '#cases').slice(1);
    var ids = ['cases', 'visit', 'assess', 'plan', 'ledger', 'expert', 'cards', 'about'];
    if (ids.indexOf(h) < 0) h = 'cases';
    ids.forEach(function (id) { el('view-' + id).hidden = (id !== h); });
    Array.prototype.forEach.call(document.querySelectorAll('.menu a'), function (a) {
      a.classList.toggle('active', a.getAttribute('href') === '#' + h);
    });
  }

  /* ---------- 绑定 ---------- */
  function init() {
    DB.load();
    if (!DB.data.cases.length) { DB.add(DB.newCase()); }

    buildChecks(el('v_risks'), RISK.HARD);
    buildChecks(el('a_risks'), RISK.HARD);
    buildChecks(el('p_focus'), PLAN.FOCUS);

    window.addEventListener('hashchange', route);
    route();

    el('caseSelect').onchange = function () { DB.data.activeId = this.value; DB.save(); renderCaseUI(); };
    el('caseList').onclick = function (e) {
      var it = e.target.closest('.item'); if (!it) return;
      DB.data.activeId = it.dataset.id; DB.save(); renderCaseUI();
    };
    el('btnNewCase').onclick = function () { DB.add(DB.newCase()); renderCaseUI(); };

    el('btnSaveCase').onclick = function () {
      var c = DB.active(); if (!c) return;
      var code = el('c_code').value.trim();
      if (!code) { alert('请填写个案编号。'); return; }
      if (code !== c.id && DB.get(code)) { alert('编号 ' + code + ' 已存在。'); return; }
      c.id = code; c.grade = el('c_grade').value.trim(); c.stage = el('c_stage').value;
      c.createdAt = el('c_created').value || c.createdAt; c.note = el('c_note').value.trim();
      DB.data.activeId = code; DB.save(); renderCaseUI();
    };
    el('btnDelCase').onclick = function () {
      var c = DB.active(); if (!c) return;
      if (!confirm('确认删除个案 ' + c.id + ' 及其全部记录？此操作不可撤销。')) return;
      DB.remove(c.id);
      if (!DB.data.cases.length) DB.add(DB.newCase());
      renderCaseUI();
    };

    // 评估维度：改动即写入个案
    ['a_mood', 'a_peer', 'a_acad', 'a_guard', 'a_care', 'a_support'].forEach(function (id) {
      el(id).onchange = function () {
        var c = DB.active(); if (!c) return;
        c.emotion.moodDrop = +el('a_mood').value;
        c.school.peerRelation = +el('a_peer').value;
        c.school.academic = +el('a_acad').value;
        c.family.guardianStatus = el('a_guard').value;
        c.family.careAdequacy = el('a_care').value;
        c.school.supportLanded = el('a_support').value === 'yes';
        DB.save(); renderCaseUI();
      };
    });
    el('a_risks').onchange = function () {
      var c = DB.active(); if (!c) return;
      var keys = readChecks(el('a_risks'));
      RISK.HARD.forEach(function (h) { c.risk[h.key] = keys.indexOf(h.key) >= 0; });
      if (keys.length) dismissed[c.id] = false;
      DB.save(); renderCaseUI();
    };

    el('btnAssess').onclick = function () {
      var c = DB.active(); if (!c) return;
      var a = RISK.assess(c); lastAssess = a;
      var rows = a.items.map(function (i) {
        return '<tr><td>' + i.label + '</td><td>' + i.raw + '</td><td>' + i.score + ' / ' + i.max + '</td></tr>';
      }).join('');
      var html =
        '<div class="signal ' + a.level + '"><span class="dot"></span><div class="txt">' +
        '<b>' + a.level + '灯 · ' + a.path.title + '</b>' +
        '<p>总分 ' + a.total + ' / 28' + (a.interrupted ? '　｜　硬触发：' + a.hard.join('、') + '（常规流程已中断）' : '') + '</p>' +
        '</div></div>' +
        '<table class="table"><thead><tr><th>维度</th><th>取值</th><th>得分</th></tr></thead><tbody>' + rows +
        '<tr><td><b>合计</b></td><td></td><td><b>' + a.total + ' / 28</b></td></tr></tbody></table>' +
        '<h3>转介与处置路径</h3><p class="hint">' + a.path.text + '</p><ol class="steps">' +
        a.path.steps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
        '<p class="hint">本评估为规则计分结果，供参考；最终判断与处置由教师与学校作出。</p>';
      el('assessResult').innerHTML = html;
      el('assessOut').hidden = false;
    };
    el('btnAssessSave').onclick = function () {
      var c = DB.active(); if (!c || !lastAssess) return;
      c.assessments.push({ id: uid(), date: lastAssess.date, total: lastAssess.total, level: lastAssess.level, hard: lastAssess.hard });
      DB.save(); renderCaseUI(); alert('评估已保存，可在④成效复盘台账查看。');
    };

    el('btnVisitGen').onclick = function () {
      var c = DB.active(); if (!c) return;
      var v = readVisitForm();
      lastVisitText = buildVisitText(c, v);
      el('visitDoc').textContent = lastVisitText;
      el('visitOut').hidden = false;
    };
    el('btnVisitSave').onclick = function () {
      var c = DB.active(); if (!c) return;
      var v = readVisitForm();
      v.id = uid(); v.text = buildVisitText(c, v);
      c.visits.push(v);
      v.risks.forEach(function (k) { c.risk[k] = true; });   // 家访新发现的风险同步到个案
      if (v.risks.length) dismissed[c.id] = false;
      DB.save(); renderCaseUI(); alert('家访记录已保存，可在④成效复盘台账查看。');
    };
    el('btnVisitCopy').onclick = function () { copy(lastVisitText, this); };
    el('btnVisitPrint').onclick = function () { window.print(); };

    el('btnPlanGen').onclick = function () {
      var c = DB.active(); if (!c) return;
      var opt = {
        method: el('p_method').value,
        weeks: el('p_weeks').value.trim() || '—',
        freq: el('p_freq').value.trim() || '—',
        owner: el('p_owner').value.trim(),
        focus: readChecks(el('p_focus'))
      };
      lastPlanText = PLAN.build(c, RISK.assess(c), opt);
      el('planDoc').textContent = lastPlanText;
      el('planOut').hidden = false;
    };
    el('btnPlanSave').onclick = function () {
      var c = DB.active(); if (!c || !lastPlanText) return;
      var a = RISK.assess(c);
      c.plans.push({
        id: uid(), date: DB.today(),
        summary: (el('p_method').value === 'group' ? '小组工作' : '个案工作') + '计划书，风险等级 ' + a.level + '，焦点：' +
          (readChecks(el('p_focus')).map(function (k) {
            var f = PLAN.FOCUS.filter(function (x) { return x.key === k; })[0]; return f ? f.label : k;
          }).join('、') || '未指定'),
        text: lastPlanText
      });
      DB.save(); renderCaseUI(); alert('方案已保存，可在④成效复盘台账查看。');
    };
    el('btnPlanCopy').onclick = function () { copy(lastPlanText, this); };
    el('btnPlanPrint').onclick = function () { window.print(); };

    el('btnFollowSave').onclick = function () {
      var c = DB.active(); if (!c) return;
      var t = el('f_adjust').value.trim();
      if (!t) { alert('请填写本阶段变化与调整。'); return; }
      c.followUps.push({ id: uid(), date: el('f_date').value || DB.today(), riskLevel: el('f_level').value, adjustment: t });
      el('f_adjust').value = '';
      DB.save(); renderCaseUI();
    };
    el('btnLedgerExport').onclick = function () {
      var c = DB.active(); if (!c) return;
      var L = ['个案台账　编号：' + c.id + '　年级：' + (c.grade || '—') + '　阶段：' + c.stage,
        '建档日期：' + c.createdAt, '导出日期：' + DB.today(),
        '────────────────────────────────', ''];
      ledgerEntries(c).slice().reverse().forEach(function (e) {
        L.push('[' + e.date + ']（' + e.type + '）');
        L.push(e.text); L.push('');
      });
      L.push('────────────────────────────────');
      L.push('本台账由工具按记录汇总生成，不构成诊断或专业意见。');
      download(c.id + '-个案台账-' + DB.today() + '.txt', L.join('\n'));
    };

    el('btnExport').onclick = function () {
      download('乡社同行-备份-' + DB.today() + '.json', JSON.stringify(DB.data, null, 2));
    };
    el('btnImport').onclick = function () { el('fileImport').click(); };
    el('fileImport').onchange = function () {
      var f = this.files[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try {
          var d = JSON.parse(r.result);
          if (!d || !Array.isArray(d.cases)) throw new Error('格式不符');
          if (!confirm('导入将覆盖当前本机数据，确认继续？')) return;
          DB.data = d; DB.save(); renderCaseUI(); alert('导入完成。');
        } catch (e) { alert('导入失败：文件不是有效的备份 JSON。'); }
      };
      r.readAsText(f); this.value = '';
    };
    el('btnWipe').onclick = function () {
      if (!confirm('将清空本机全部个案数据，且无法恢复。确认继续？')) return;
      DB.wipe(); DB.add(DB.newCase()); renderCaseUI();
    };

    renderCaseUI();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
