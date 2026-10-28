/* 风险评估引擎：规则计分，可解释、可复现；硬触发优先于一切计分 */
(function () {
  var HARD = [
    { key: 'selfHarm', label: '自伤 / 自杀风险' },
    { key: 'abuse', label: '遭受虐待' },
    { key: 'bullying', label: '遭受欺凌' },
    { key: 'neglect', label: '严重忽视' },
    { key: 'runaway', label: '离家出走' }
  ];

  var GUARD = { '健全': 0, '弱化': 2, '缺失': 4 };
  var CARE = { '充足': 0, '不足': 2, '严重不足': 4 };

  var PATH = {
    '绿': {
      title: '常态关注',
      text: '班级层面持续观察，暂无须启动个案服务计划。',
      steps: [
        '班主任每月记录一次观察到的具体行为（不写主观评价）；',
        '维持常规家校沟通，确认监护人联系方式有效；',
        '若出现情绪、同伴关系或监护状况变化，随时重新评估。'
      ]
    },
    '黄': {
      title: '重点关注，需制定个案服务计划',
      text: '已进入需个案介入区间，应在校内启动服务计划并知会监护人。',
      steps: [
        '两周内制定《个案服务计划书》（可用模块③生成）；',
        '知会监护人并约定配合事项，留存沟通记录；',
        '协调校内资源：心理老师 / 德育处 / 科任教师，明确各自分工；',
        '每月复评一次；连续两次复评风险上升，升级为红色并考虑转介。'
      ]
    },
    '红': {
      title: '立即介入',
      text: '须立即处置并依法履行强制报告义务，同时启动转介。',
      steps: [
        '立即确保儿童人身安全，不要让其独处；',
        '立即报告学校负责人，并按规定向公安、民政或卫生健康部门报告；',
        '同步联系监护人；监护人失联或本人即为侵害人时，直接上报，不通过监护人转达；',
        '转介属地乡镇（街道）社工站 / 未成年人保护工作站；',
        '记录时间、事实与处置过程，完整留痕。'
      ]
    }
  };

  function round1(n) { return Math.round(n * 10) / 10; }

  function assess(c) {
    var f = c.family, s = c.school, e = c.emotion;
    var items = [
      { label: '情绪低落程度', raw: e.moodDrop + '（1–5）', score: e.moodDrop * 2, max: 10 },
      { label: '同伴关系（反向）', raw: s.peerRelation + '（1–5）', score: (5 - s.peerRelation) * 1.5, max: 6 },
      { label: '监护状况', raw: f.guardianStatus, score: GUARD[f.guardianStatus], max: 4 },
      { label: '生活照料', raw: f.careAdequacy, score: CARE[f.careAdequacy], max: 4 },
      { label: '学业与在校状态（反向）', raw: s.academic + '（1–5）', score: (5 - s.academic) * 0.5, max: 2 },
      { label: '学校支持是否落实', raw: s.supportLanded ? '已落实' : '未落实', score: s.supportLanded ? 0 : 2, max: 2 }
    ];
    var total = 0;
    items.forEach(function (i) { total += i.score; });
    total = round1(total);

    var hard = HARD.filter(function (h) { return !!c.risk[h.key]; }).map(function (h) { return h.label; });
    var level = total >= 17 ? '红' : total >= 9 ? '黄' : '绿';
    if (hard.length) level = '红';

    return {
      items: items, total: total, level: level, hard: hard,
      interrupted: hard.length > 0, path: PATH[level], date: DB.today()
    };
  }

  window.RISK = { HARD: HARD, assess: assess, PATH: PATH };
})();
