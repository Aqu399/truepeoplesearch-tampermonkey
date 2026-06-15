// ==UserScript==
// @name         TruePeopleSearch 批量搜索
// @namespace    tps
// @version      1.6
// @updateURL    https://raw.githubusercontent.com/Aqu399/truepeoplesearch-tampermonkey/main/truepeoplesearch.user.js
// @downloadURL  https://raw.githubusercontent.com/Aqu399/truepeoplesearch-tampermonkey/main/truepeoplesearch.user.js
// @description  By.阿趣制作 · TruePeopleSearch 自动搜索
// @match        https://www.truepeoplesearch.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// ==/UserScript==

(function () {
  'use strict';
  console.log('[TPS] v1.1 loaded');

  const NS = 'tps_v1';

  // ────────────────────────── 水印标记 ──────────────────────
  const WATERMARK = {
    source: 'By.阿趣制作',
    tool: 'By.阿趣制作',
    generated: new Date().toISOString().slice(0, 10),
    footer: 'By.阿趣制作',
  };

  // ────────────────────────── 配置 ──────────────────────────
  const CFG = {
    delay_ms: 1500,
    detail_delay_ms: 2000,
    auto_download: true,   // 搜索完成后自动下载
  };

  // ────────────────────────── 存储 ──────────────────────────
  function getList(key) {
    try {
      const raw = GM_getValue(key, '[]');
      return JSON.parse(raw);
    } catch { return []; }
  }

  function saveList(key, arr) {
    GM_setValue(key, JSON.stringify(arr, null, 2));
  }
  function getStr(key)      { return GM_getValue(key, ''); }
  function setStr(key, v)   { GM_setValue(key, v); }

  function getQueue()        { return getList(NS + '_queue'); }
  function saveQueue(q)      { saveList(NS + '_queue', q); }
  function getResults()      { return getList(NS + '_results'); }
  function saveResults(r)    { saveList(NS + '_results', r); }
  function getDone()         { return getList(NS + '_done_urls'); }
  function saveDone(d)       { saveList(NS + '_done_urls', d); }
  // 详情URL队列（当前搜索结果页的所有详情链接）
  function getDetailUrls()   { return getList(NS + '_detail_urls'); }
  function saveDetailUrls(d) { saveList(NS + '_detail_urls', d); }
  function getDetailDone()   { return getList(NS + '_detail_done'); }
  function saveDetailDone(d) { saveList(NS + '_detail_done', d); }
  function getResultsUrl()   { return getStr(NS + '_results_url'); }
  function setResultsUrl(u)  { setStr(NS + '_results_url', u); }

  // ────────────────────────── UI ────────────────────────────
  function createUI() {
    if (document.getElementById('tps-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'tps-panel';
    panel.innerHTML = `
      <style>
        #tps-panel {
          position: fixed; top: 80px; right: 0; z-index: 99999;
          width: 340px; background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 50%, #80deea 100%);
          color: #37474f;
          border-radius: 16px 0 0 16px;
          box-shadow: -3px 3px 20px rgba(0, 150, 200, 0.25);
          font: 13px/1.5 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
          padding: 14px;
          max-height: 90vh; overflow-y: auto;
          border-left: 3px solid #4dd0e1;
        }
        #tps-panel ::-webkit-scrollbar { width: 5px; }
        #tps-panel ::-webkit-scrollbar-thumb { background: #4dd0e1; border-radius: 10px; }
        #tps-panel h3 {
          margin: 0 0 10px; color: #00838f; font-size: 16px;
          display: flex; align-items: center; gap: 8px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .tps-gradient-text {
          background: linear-gradient(90deg, #ff6b6b, #ffa94d, #ffd93d, #6bcb77, #4d96ff, #a66cff, #ff6b6b);
          background-size: 200% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: tps-rainbow 3s linear infinite;
        }
        @keyframes tps-rainbow {
          0%   { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        #tps-panel textarea, #tps-panel input {
          width: 100%; box-sizing: border-box; margin: 4px 0;
          background: rgba(255,255,255,0.85); color: #37474f; border: 2px solid #b2ebf2;
          border-radius: 10px; padding: 8px 10px; font-size: 12px;
          transition: border-color 0.2s;
        }
        #tps-panel textarea:focus, #tps-panel input:focus {
          border-color: #4dd0e1; outline: none;
          box-shadow: 0 0 8px rgba(77, 208, 225, 0.4);
        }
        #tps-panel textarea { height: 120px; font-family: monospace; resize: vertical; }
        #tps-panel button {
          background: linear-gradient(135deg, #4dd0e1, #26c6da); color: #fff; border: none;
          border-radius: 20px; padding: 7px 18px; margin: 4px 4px 0 0;
          cursor: pointer; font-size: 12px; font-weight: 600;
          box-shadow: 0 2px 6px rgba(77, 208, 225, 0.4);
          transition: all 0.2s;
        }
        #tps-panel button:hover {
          opacity: 0.9; transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(77, 208, 225, 0.5);
        }
        #tps-panel button.sec { background: linear-gradient(135deg, #90a4ae, #78909c); box-shadow: 0 2px 6px rgba(144, 164, 174, 0.4); }
        #tps-panel button.ok  { background: linear-gradient(135deg, #81c784, #66bb6a); box-shadow: 0 2px 6px rgba(129, 199, 132, 0.4); }
        #tps-panel .status { margin-top: 8px; font-size: 12px; color: #607d8b; font-style: italic; }
        #tps-panel .result-item {
          background: rgba(255,255,255,0.85); border: 1px solid #b2ebf2; border-radius: 10px;
          padding: 8px 10px; margin: 4px 0;
          font-size: 11px; line-height: 1.4; word-break: break-all;
          box-shadow: 0 1px 4px rgba(0,150,200,0.08);
        }
        #tps-panel .result-item strong { color: #00838f; }
        #tps-panel .badge {
          display: inline-block; background: linear-gradient(135deg, #4dd0e1, #26c6da); color: #fff; border-radius: 12px;
          padding: 2px 9px; font-size: 11px; margin-left: 4px; font-weight: 600;
        }
        #tps-panel input[type="checkbox"] {
          width: auto; margin-right: 4px;
          accent-color: #26c6da;
        }
        #tps-panel label { font-size: 12px; cursor: pointer; color: #546e7a; }
        #tps-watermark {
          margin-top: 10px; padding: 8px 10px;
          background: rgba(255,255,255,0.7);
          border-radius: 12px; border: 1px dashed #80deea;
          font-size: 12px; text-align: center;
          font-weight: 700; letter-spacing: 1px;
        }
        #tps-progress-bar {
          height: 6px; background: rgba(255,255,255,0.5); border-radius: 3px;
          margin: 6px 0; overflow: hidden;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
        }
        #tps-progress-fill {
          height: 100%; width: 0%;
          background: linear-gradient(90deg, #4dd0e1, #26c6da, #00acc1);
          border-radius: 3px;
          transition: width 0.4s ease;
        }
      </style>

      <h3>🌈 超级牛逼的TPS爬虫</h3>
      <div class="tps-gradient-text" style="font-size:12px;font-weight:700;letter-spacing:1px;margin:-4px 0 8px 0;padding-left:2px;">✨ By.阿趣制作 ✨</div>

      <label>搜索列表 (每行一条)</label>
      <textarea id="tps-input" placeholder="John Smith, Dallas, TX&#10;Jane Doe, Austin, TX&#10;Bob Wilson, 123 Main St, Dallas, TX"></textarea>

      <div style="margin:4px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <div style="flex:1;min-width:70px;">
          <label style="font-size:11px;color:#546e7a;">年龄筛选</label>
          <div style="display:flex;gap:4px;align-items:center;">
            <input type="number" id="tps-age-min" min="0" max="120" value="" placeholder="最小" style="width:60px;text-align:center;padding:4px;">
            <span style="color:#546e7a;font-weight:bold;">—</span>
            <input type="number" id="tps-age-max" min="0" max="120" value="" placeholder="最大" style="width:60px;text-align:center;padding:4px;">
          </div>
        </div>
      </div>
      <div style="margin:4px 0;">
        <input type="checkbox" id="tps-only-wireless" checked>
        <label for="tps-only-wireless">只提取 Wireless (手机号)</label>
        <br>
        <input type="checkbox" id="tps-auto-download" checked>
        <label for="tps-auto-download">完成后自动下载</label>
      </div>

      <div id="tps-progress-bar"><div id="tps-progress-fill"></div></div>

      <div>
        <button id="tps-start">▶ 开始搜索</button>
        <button id="tps-stop" class="sec">■ 停止</button>
        <button id="tps-export" class="ok">📥 导出 CSV</button>
        <button id="tps-clear" class="sec">🗑 清理</button>
      </div>

      <div class="status" id="tps-status">就绪</div>
      <div id="tps-results" style="margin-top:6px;"></div>
      <div id="tps-watermark" class="tps-gradient-text">🌸 ${WATERMARK.footer} 🌸</div>
    `;

    document.body.appendChild(panel);
    bindUI();
  }

  function bindUI() {
    document.getElementById('tps-start').onclick = startSearch;
    document.getElementById('tps-stop').onclick = () => { window.__tps_stop = true; setStatus('已停止'); };
    document.getElementById('tps-export').onclick = exportCSV;
    document.getElementById('tps-clear').onclick = () => {
      if (!confirm('清空所有搜索结果队列？')) return;
      GM_deleteValue(NS + '_queue');
      GM_deleteValue(NS + '_results');
      GM_deleteValue(NS + '_done_urls');
      renderResults();
      setStatus('已清空');
      updateProgressBar(0, 1);
    };
  }

  function setStatus(msg) {
    const el = document.getElementById('tps-status');
    if (el) el.textContent = msg;
  }

  function updateProgressBar(current, total) {
    const fill = document.getElementById('tps-progress-fill');
    if (!fill) return;
    const pct = total > 0 ? (current / total) * 100 : 0;
    fill.style.width = Math.min(pct, 100) + '%';
  }

  function renderResults() {
    const container = document.getElementById('tps-results');
    if (!container) return;
    const results = getResults();
    const q = getQueue();

    container.innerHTML = `<div style="font-size:11px;color:#aaa;margin-bottom:4px;">
      队列: ${q.length} 条 | 已完成: ${results.length} 条
      <span class="badge">${getDone().length}</span>
      <span style="float:right;font-size:10px;">${WATERMARK.source}</span>
    </div>`;

    const show = results.slice(-20).reverse();
    show.forEach(r => {
      const div = document.createElement('div');
      div.className = 'result-item';
      div.innerHTML = `<strong>${esc(r.name)}</strong> — ${esc(r.phone || '无电话')}` +
        (r.email ? ` · ${esc(r.email)}` : '') +
        (r.address ? `<br><span style="color:#aaa">${esc(r.address)}</span>` : '') +
        `<br><span class="tps-gradient-text" style="font-size:10px;font-weight:600;">🄀 ${WATERMARK.source}</span>`;
      container.appendChild(div);
    });
  }

  function esc(s) { return String(s || '').replace(/[<>]/g, c => ({ '<': '&lt;', '>': '&gt;' }[c])); }

  // ────────────────────────── 搜索逻辑 ──────────────────────
  function sleep(ms) {
    return new Promise(r => {
      window.__tps_timer = setTimeout(r, ms);
    });
  }

  async function startSearch() {
    window.__tps_stop = false;

    // ── 保存年龄配置到 CFG（供 resumeIfNeeded 使用） ──
    const ageMinEl = document.getElementById('tps-age-min');
    const ageMaxEl = document.getElementById('tps-age-max');
    CFG._ageMin = ageMinEl?.value || '';
    CFG._ageMax = ageMaxEl?.value || '';

    const raw = document.getElementById('tps-input').value.trim();
    if (!raw) { setStatus('请先输入搜索列表'); return; }

    const lines = raw.split('\n').map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const queries = lines.map(line => parseQuery(line)).filter(Boolean);
    if (queries.length === 0) { setStatus('未解析到有效条目'); return; }

    // 读取自动下载选项
    CFG.auto_download = document.getElementById('tps-auto-download').checked;

    saveQueue(queries);
    setStatus(`队列 ${queries.length} 条，开始搜索...`);

    // ── 保存队列到存储，跳转到第一个搜索URL ──
    // 后续由页面加载时的 resumeIfNeeded() 自动恢复处理
    const first = queries[0];
    const params = new URLSearchParams();
    params.set('name', first.name);
    if (first.citystate) params.set('citystatezip', first.citystate);
    if (CFG._ageMin || CFG._ageMax) {
      params.set('agerange', `${CFG._ageMin || '0'}-${CFG._ageMax || '120'}`);
    }
    setStatus(`跳转到搜索页: ${first.name}`);
    window.location.href = `https://www.truepeoplesearch.com/results?${params.toString()}`;
  }

  function parseQuery(line) {
    const parts = line.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) {
      return { name: parts[0], citystate: '', query: line };
    }
    if (parts.length === 2) {
      return { name: parts[0], citystate: parts[1], query: line };
    }
    const name = parts[0];
    return { name, citystate: parts.slice(1).join(', '), query: line };
  }

  async function processQueue() {
    // 已不再使用 - 由 resumeIfNeeded 在页面加载时自动处理
    console.log('[TPS] processQueue 废弃, 使用 resumeIfNeeded');
  }

  function dismissConsent() {
    try {
      const btn = document.querySelector('button.fc-cta-consent');
      if (btn) { btn.click(); return true; }
      const alt = document.querySelector('.fc-dialog button');
      if (alt) { alt.click(); return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  function findPersonLinks() {
    // View Details 按钮结构（实际测试确认）:
    // <a class="btn btn-success btn-lg detail-link shadow-form"
    //    href="/find/person/p6uu4ru9u4r4946402un"
    //    aria-label="View All Details">View Details ...</a>

    const links = [];

    // ── 方式1: 通过 detail-link class（最精确） ──
    document.querySelectorAll('a.detail-link').forEach(a => {
      const href = a.getAttribute('href');
      if (href && !links.includes(href)) {
        links.push(href.startsWith('http') ? href : location.origin + href);
        console.log('[TPS] detail-link:', href);
      }
    });

    // ── 方式2: 通过 /find/person/ 路径 ──
    if (links.length === 0) {
      document.querySelectorAll('a[href*="/find/person/"]').forEach(a => {
        const href = a.getAttribute('href');
        if (href && !links.includes(href)) {
          links.push(href.startsWith('http') ? href : location.origin + href);
        }
      });
    }

    // ── 方式3: btn-success + View Details 文本 ──
    if (links.length === 0) {
      document.querySelectorAll('a.btn-success, a[class*="btn-success"]').forEach(a => {
        const href = a.getAttribute('href');
        if (href && href.includes('/find/person/') && !links.includes(href)) {
          links.push(href.startsWith('http') ? href : location.origin + href);
        }
      });
    }

    window.__tps_view_btn = null;
    console.log('[TPS] 找到', links.length, '个详情链接');
    return links.filter(l => l);
  }

  function extractDetailPage(name, onlyWireless) {
    const bodyText = document.body.innerText || document.body.textContent || '';

    // ── 提取姓名 (cap.py 模式: 第一个逗号前的文本) ──
    let verifiedName = '';
    const nameMatch = bodyText.match(/^([^,\n]+),/m);
    if (nameMatch) verifiedName = nameMatch[1].trim();

    // ── 提取地址 (cap.py 模式) ──
    let address = '';
    // 方式1: cap.py 使用的正则
    const addrPattern = /Current Address[\s\S]*?This is the most recently reported address[\s\S]*?\n\n([^\n]+)/i;
    const addrMatch = bodyText.match(addrPattern);
    if (addrMatch) {
      address = addrMatch[1].trim();
      // 清理多余信息
      address = address.replace(/\$.*/, '').trim();
    }
    // 方式2: 备用
    if (!address) {
      const altMatch = bodyText.match(/Current Address[\s\S]*?(?:\n\n)([^\n]+)/);
      if (altMatch) address = altMatch[1].trim();
    }

    // ── 提取电话 (cap.py 模式: 按段落分区搜索) ──
    const phones = [];

    // 方式1: 先找 "Phone Numbers" 段落, 只在段落内搜 Wireless
    const phoneSectionPattern = /Phone Numbers[\s\S]*?Includes the current and past phone numbers[\s\S]*?([\s\S]*?)(?=\s*Email Addresses|\s*Background Report|$)/i;
    const phoneSectionMatch = bodyText.match(phoneSectionPattern);
    let phoneSearchText = bodyText;
    if (phoneSectionMatch) {
      phoneSearchText = phoneSectionMatch[1]; // 只搜 Phone Numbers 段落的内容
      console.log('[TPS] 找到 Phone Numbers 段落');
    }

    // 在目标文本中搜 phone - Wireless
    const phonePattern = /(\(\d{3}\)\s*\d{3}-\d{4})\s*-\s*(Wireless|Landline|Cell)/g;
    let match;
    while ((match = phonePattern.exec(phoneSearchText)) !== null) {
      const phone = match[1].trim();
      const type = match[2];
      if (onlyWireless && type !== 'Wireless') continue;
      if (!phones.includes(phone)) phones.push(phone);
    }

    // 如果只搜 Wireless 但没找到, 回退到所有电话
    if (onlyWireless && phones.length === 0) {
      phonePattern.lastIndex = 0;
      while ((match = phonePattern.exec(phoneSearchText)) !== null) {
        const phone = match[1].trim();
        if (!phones.includes(phone)) phones.push(phone);
      }
    }

    // 如果段落搜索没找到, 在全文中搜
    if (phones.length === 0) {
      phonePattern.lastIndex = 0;
      while ((match = phonePattern.exec(bodyText)) !== null) {
        const phone = match[1].trim();
        if (!phones.includes(phone)) phones.push(phone);
      }
    }

    // ── 提取邮箱 (cap.py 模式: 按段落分区搜索) ──
    const emails = [];

    // 方式1: 先找 "Email Addresses" 段落
    const emailSectionPattern = /Email Addresses[\s\S]*?Includes all known email addresses[\s\S]*?([\s\S]*?)(?=\s*Current Address Property Details|$)/i;
    const emailSectionMatch = bodyText.match(emailSectionPattern);
    let emailSearchText = bodyText;
    if (emailSectionMatch) {
      emailSearchText = emailSectionMatch[1];
      console.log('[TPS] 找到 Email Addresses 段落');
    }

    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    let emailMatch;
    const seen = new Set();
    while ((emailMatch = emailPattern.exec(emailSearchText)) !== null) {
      const e = emailMatch[0].toLowerCase();
      if (!seen.has(e) && !e.includes('truepeoplesearch') && !e.endsWith('.png') && !e.endsWith('.jpg')) {
        seen.add(e);
        emails.push(e);
      }
    }

    // 如果段落搜索没找到, 回退到全文
    if (emails.length === 0) {
      seen.clear();
      emailPattern.lastIndex = 0;
      while ((emailMatch = emailPattern.exec(bodyText)) !== null) {
        const e = emailMatch[0].toLowerCase();
        if (!seen.has(e) && !e.includes('truepeoplesearch') && !e.endsWith('.png') && !e.endsWith('.jpg')) {
          seen.add(e);
          emails.push(e);
        }
      }
    }

    const result = {
      name: verifiedName || name,
      address: address || '',
      phone: phones.join(' / '),
      phones: phones,
      email: emails.join(' / '),
      emails: emails,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      _watermark: WATERMARK.source,       // ← 水印字段
      _tool: WATERMARK.tool,              // ← 工具标记
    };

    console.log('[TPS] 提取结果:', result);
    return result;
  }

  // ────────────────────────── CSV 导出 + 水印 ──────────────
  function exportCSV() {
    const results = getResults();
    if (results.length === 0) { setStatus('无数据可导出'); return; }

    // ── 水印头 ──
    let csv = '';
    csv += `# 数据来源: ${WATERMARK.source}\n`;
    csv += `# 生成工具: ${WATERMARK.tool}\n`;
    csv += `# 生成日期: ${WATERMARK.generated}\n`;
    csv += `# ─────────────────────────────────────\n`;

    // ── 列头 ──
    csv += 'Name,Address,Phone,Phone2,Phone3,Email,Email2,Email3,URL,Timestamp,Source\n';

    // ── 数据行 ──
    results.forEach(r => {
      const phones = r.phones || [];
      const emails = r.emails || [];
      const row = [
        csvEsc(r.name),
        csvEsc(r.address),
        csvEsc(phones[0] || ''),
        csvEsc(phones[1] || ''),
        csvEsc(phones[2] || ''),
        csvEsc(emails[0] || ''),
        csvEsc(emails[1] || ''),
        csvEsc(emails[2] || ''),
        csvEsc(r.url || ''),
        csvEsc(r.timestamp || ''),
        csvEsc(r._watermark || WATERMARK.source),  // 每行都带水印
      ];
      csv += row.join(',') + '\n';
    });

    // ── 水印尾 ──
    csv += `# ─────────────────────────────────────\n`;
    csv += `# 合计 ${results.length} 条记录 | ${WATERMARK.footer}\n`;

    // ── 下载 ──
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fn = 'truepeoplesearch_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.download = fn;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setStatus(`✅ 已导出 ${results.length} 条 → ${fn}`);
  }

  function csvEsc(v) {
    const s = String(v || '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  // ────────────────────────── 页面级自动恢复 ──────────────
  // 当页面跳转（搜索页→详情页→搜索页...），每次页面加载时自动检查并恢复
  async function resumeIfNeeded() {
    const queue = getQueue();
    const personDone = getDone();
    if (queue.length === 0) return;

    // 全部完成？
    const allDone = queue.every(item => personDone.includes(item.query));
    if (allDone) {
      console.log('[TPS] 队列全部完成');
      if (CFG.auto_download) {
        const results = getResults();
        if (results.length > 0) { await sleep(500); exportCSV(); }
      }
      return;
    }

    const path = window.location.pathname;
    const detailUrls = getDetailUrls();
    const detailDone = getDetailDone();

    console.log('[TPS] resume path:', path, 'detailUrls:', detailUrls.length, 'detailDone:', detailDone.length);

    // ────────────────── 详情页 ──────────────────
    if (path.includes('/find/person/')) {
      console.log('[TPS] 详情页 → 提取');
      await sleep(1500);
      dismissConsent();
      await sleep(500);

      // 找到当前人名
      let currentItem = null;
      for (const item of queue) {
        if (!personDone.includes(item.query)) { currentItem = item; break; }
      }

      if (currentItem) {
        const onlyWireless = document.getElementById('tps-only-wireless')?.checked ?? true;
        const data = extractDetailPage(currentItem.name, onlyWireless);
        if (data) {
          const results = getResults();
          results.push(data);
          saveResults(results);
          console.log('[TPS] 提取成功:', data.phone || '无电话');
        }
      }

      // 标记当前详情URL为已处理
      const curPath = window.location.pathname;
      const newDD = getDetailDone();
      if (!newDD.includes(curPath)) newDD.push(curPath);
      saveDetailDone(newDD);

      renderResults();
      await sleep(500);

      // 回搜索结果页继续
      const rUrl = getResultsUrl();
      if (rUrl) { window.location.href = rUrl; return; }
      return;
    }

    // ────────────────── 搜索结果页 ──────────────────
    if (path.includes('/results') || path.includes('/find/') || path === '/') {
      console.log('[TPS] 搜索页 → 采集链接');
      await sleep(2500);
      dismissConsent();
      await sleep(500);

      // 保存当前搜索结果页URL（供详情页提取后返回）
      setResultsUrl(window.location.href);

      // 获取当前页所有 View Details 链接
      const allLinks = findPersonLinks();
      console.log('[TPS] 本页详情链接数:', allLinks.length);

      if (allLinks.length === 0) {
        // 无结果 → 跳过当前人
        console.log('[TPS] 本页无结果，跳转下一个人');
        let currentItem = null;
        for (const item of queue) {
          if (!getDone().includes(item.query)) { currentItem = item; break; }
        }
        if (currentItem) {
          const nd = getDone(); nd.push(currentItem.query); saveDone(nd);
          renderResults();
        }
        goNextPerson();
        return;
      }

      // 保存所有详情链接（去重）
      saveDetailUrls(allLinks);

      // 找到第一个未处理的详情链接
      const curDD = getDetailDone();
      let nextDetail = null;
      for (const link of allLinks) {
        const linkPath = new URL(link).pathname;
        if (!curDD.includes(linkPath)) { nextDetail = link; break; }
      }

      if (nextDetail) {
        console.log('[TPS] 跳转详情:', nextDetail);
        window.location.href = nextDetail;
        return;
      }

      // 所有详情已处理 → 点Next翻页
      const nextBtn = document.getElementById('btnNextPage') || document.querySelector('a.btn-paging');
      if (nextBtn) {
        const nextHref = nextBtn.getAttribute('href');
        console.log('[TPS] 本页全部提取完，翻页:', nextHref);
        // 清空当前详情记录（新页面有新的链接）
        saveDetailUrls([]);
        saveDetailDone([]);
        const fullUrl = nextHref.startsWith('http') ? nextHref : location.origin + nextHref;
        window.location.href = fullUrl;
        return;
      }

      // 没有Next → 当前人全部搜完
      console.log('[TPS] 当前人全部提取完');
      let currentItem = null;
      for (const item of queue) {
        if (!getDone().includes(item.query)) { currentItem = item; break; }
      }
      if (currentItem) {
        const nd = getDone(); nd.push(currentItem.query); saveDone(nd);
        renderResults();
      }
      saveDetailUrls([]);
      saveDetailDone([]);
      goNextPerson();
      return;
    }
  }

  function goNextPerson() {
    const queue = getQueue();
    const personDone = getDone();
    // 找下一个人
    for (const item of queue) {
      if (!personDone.includes(item.query)) {
        const params = new URLSearchParams();
        params.set('name', item.name);
        if (item.citystate) params.set('citystatezip', item.citystate);
        if (CFG._ageMin || CFG._ageMax) {
          params.set('agerange', `${CFG._ageMin || '0'}-${CFG._ageMax || '120'}`);
        }
        const url = `https://www.truepeoplesearch.com/results?${params.toString()}`;
        setResultsUrl(url);
        window.location.href = url;
        return;
      }
    }
    // 全部完成
    console.log('[TPS] 全部完成!');
    setStatus('✅ 搜索完成！');
    if (CFG.auto_download) {
      setTimeout(() => {
        const results = getResults();
        if (results.length > 0) exportCSV();
      }, 800);
    }
  }

  // ────────────────────────── 初始化 ────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createUI();
      resumeIfNeeded();
    });
  } else {
    createUI();
    resumeIfNeeded();
  }

  console.log('[TPS] v1.4 ready | WM:', WATERMARK.source);
})();
