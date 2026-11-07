/* オートウェビナー（プロトタイプ）
 * データはブラウザの localStorage に保存。後で Firebase 等に差し替えられるよう、
 * 読み書きは DB オブジェクトに集約している。
 */
(() => {
'use strict';

// ---------- storage ----------
const KEY = 'autowebinar:v1';
const DEFAULT_USER = { id: 'admin', pw: 'webinar2026', name: '管理者' };
const ROLES = {
  owner: { label: 'オーナー', desc: '全ての操作が可能（支払い設定・スタッフ管理・コンテンツ管理など）' },
  admin: { label: '管理者', desc: '支払い以外の操作が可能（スタッフ管理・コンテンツ管理など）' },
  editor: { label: '編集者', desc: 'コンテンツの編集が可能（ウェビナーの作成・編集・削除など）' },
  viewer: { label: '閲覧者', desc: '閲覧のみ可能' },
};

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => Date.now();

function load() {
  try { const d = JSON.parse(localStorage.getItem(KEY)); if (d && d.users) return d; } catch (e) {}
  return seed();
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (e) { toast('保存に失敗しました。画像サイズを小さくしてください（ブラウザ保存容量の上限）'); return false; }
}

function seed() {
  const accId = uid();
  const wid = 'sample';
  const d = {
    users: [DEFAULT_USER],
    accounts: [{ id: accId, name: 'サンプル公式アカウント', pageLimit: 3, createdAt: now(),
      staff: [{ id: uid(), name: '管理者', role: 'owner', createdAt: now() }], invites: [] }],
    webinars: [sampleWebinar(wid, accId)],
    events: [],
  };
  return d;
}
function sampleWebinar(id, accountId) {
  const n = new Date(); n.setMinutes(n.getMinutes() + 2);
  return {
    id, accountId, createdAt: now(),
    adminName: 'サンプル｜集客セミナー',
    title: '【無料】LINE集客で月商を2倍にする3つのステップ',
    headerImage: sampleHeader(),
    videoUrl: 'https://vimeo.com/76979871',
    durationSec: 3600,
    startTime: pad(n.getHours() < 6 ? 20 : n.getHours()) + ':' + pad(n.getMinutes()),
    cta: { sec: 60, text: '今すぐ個別相談に申し込む', link: 'https://example.com/', color: '#06c755' },
    sections: [
      { id: uid(), blocks: [
        { type: 'text', text: 'このウェビナーでわかること\n・LINE公式アカウントで反応が取れる配信の型\n・自動化で毎日セミナーを開催する方法\n・個別相談につなげる導線づくり' },
      ] },
    ],
  };
}
function sampleHeader() {
  const c = document.createElement('canvas'); c.width = 800; c.height = 420;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 800, 420); gr.addColorStop(0, '#0b6e8a'); gr.addColorStop(1, '#073b4c');
  g.fillStyle = gr; g.fillRect(0, 0, 800, 420);
  g.fillStyle = '#ffd166'; g.font = 'bold 30px sans-serif'; g.fillText('FREE WEBINAR', 48, 120);
  g.fillStyle = '#ffffff'; g.font = 'bold 52px sans-serif';
  g.fillText('LINE集客で', 48, 210); g.fillText('月商を2倍にする', 48, 280);
  g.font = '26px sans-serif'; g.fillText('毎日開催｜参加無料', 48, 350);
  return c.toDataURL('image/jpeg', 0.85);
}

const DB = {
  account: id => state.accounts.find(a => a.id === id),
  webinar: id => state.webinars.find(w => w.id === id),
  webinarsOf: aid => state.webinars.filter(w => w.accountId === aid),
  eventsOf: wid => state.events.filter(e => e.wid === wid),
};

// ---------- helpers ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function pad(n) { return String(n).padStart(2, '0'); }
const hms = s => { s = Math.max(0, Math.floor(s)); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };
const fmtDate = t => { const d = new Date(t); return d.getFullYear() + '/' + pad(d.getMonth() + 1) + '/' + pad(d.getDate()); };
const WD = ['日', '月', '火', '水', '木', '金', '土'];
let toastTimer;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => t.hidden = true, 2600); }
function viewerUrl(w) { return location.href.split('#')[0] + '#/w/' + w.id; }
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('URLをコピーしました'); }
  catch (e) { modal(`<h2>URL</h2><div class="copybox">${esc(text)}</div><div class="row"><button class="btn" data-close>閉じる</button></div>`); }
}
function modal(html) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="card">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) m.remove(); });
  document.body.appendChild(m); return m;
}
function confirmBox(title, body, okLabel, onOk) {
  const m = modal(`<h2>${esc(title)}</h2><p>${body}</p><div class="row"><button class="btn" data-close>キャンセル</button><button class="btn danger pri" id="okBtn">${esc(okLabel)}</button></div>`);
  m.querySelector('#okBtn').onclick = () => { m.remove(); onOk(); };
}
function readImage(file, maxW = 800) {
  return new Promise((res, rej) => {
    if (!file || !/^image\//.test(file.type)) return rej('選択されたファイルが無効です');
    if (file.size > 1.5 * 1024 * 1024) return rej('選択したファイルが大きすぎます。1.5MB以内のファイルを選択してください。');
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxW / img.width);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => rej('選択されたファイルが無効です');
      img.src = r.result;
    };
    r.readAsDataURL(file);
  });
}
function vimeoId(url) {
  const m = String(url || '').match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/);
  return m ? { id: m[1], hash: m[2] } : null;
}
const isFile = url => /\.(mp4|webm|m3u8)(\?|$)/i.test(url || '');

// ---------- auth ----------
const session = {
  get() { try { return sessionStorage.getItem('aw:user'); } catch (e) { return window.__awUser; } },
  set(v) { try { v ? sessionStorage.setItem('aw:user', v) : sessionStorage.removeItem('aw:user'); } catch (e) { window.__awUser = v; } },
};

// ---------- router ----------
let cleanup = [];
function onLeave(fn) { cleanup.push(fn); }
function route() {
  cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = [];
  const h = location.hash.replace(/^#\/?/, '');
  const p = h.split('/').filter(Boolean);
  const app = $('#app');
  window.scrollTo(0, 0);
  if (p[0] === 'w' && p[1]) return viewerPage(app, p[1], false);
  if (p[0] === 'invite' && p[1]) return invitePage(app, p[1]);
  if (!session.get()) return loginPage(app);
  if (p[0] === 'sample') return viewerPage(app, 'sample', true);
  if (p[0] === 'new') return newAccountPage(app);
  if (p[0] === 'settings') return settingsPage(app);
  if (p[0] === 'accounts' && p[1]) {
    const acc = DB.account(p[1]);
    if (!acc) return shell(app, '', `<div class="card empty">該当するアカウントは存在しません</div>`);
    if (p[2] === 'staff') return staffPage(app, acc);
    if (p[2] === 'mypage') return myPage(app, acc);
    if (p[2] === 'webinars' && p[3] === 'new') return editorPage(app, acc, null);
    if (p[2] === 'webinars' && p[3] && p[4] === 'edit') return editorPage(app, acc, DB.webinar(p[3]));
    if (p[2] === 'webinars' && p[3] && p[4] === 'analysis') return analysisPage(app, acc, DB.webinar(p[3]));
    return webinarListPage(app, acc);
  }
  return accountListPage(app);
}
window.addEventListener('hashchange', route);

function shell(app, nav, body) {
  app.innerHTML = `
  <header class="bar"><div class="bar-in">
    <a class="brand" href="#/"><i></i>オートウェビナー</a>
    <nav class="nav">
      <a href="#/" class="${nav === 'list' ? 'on' : ''}">アカウント一覧</a>
      <a href="#/sample" class="${nav === 'sample' ? 'on' : ''}">サンプル</a>
      <a href="#/new" class="${nav === 'new' ? 'on' : ''}">新規作成</a>
      <a href="#/settings" class="${nav === 'settings' ? 'on' : ''}">設定</a>
      <a href="#" id="logout">ログアウト</a>
    </nav>
  </div></header>
  <main class="wrap">${body}</main>`;
  $('#logout').onclick = e => { e.preventDefault(); session.set(null); location.hash = '#/'; route(); };
}

// ---------- pages ----------
function loginPage(app) {
  app.innerHTML = `
  <div class="login"><form class="card" id="lf">
    <a class="brand" href="#/"><i></i>オートウェビナー</a>
    <h1>管理画面ログイン</h1>
    <label class="f">ログインID<input id="lid" autocomplete="username" required></label>
    <label class="f">パスワード<input id="lpw" type="password" autocomplete="current-password" required></label>
    <div class="err" id="lerr" hidden>IDまたはパスワードが違います</div>
    <button class="btn pri" type="submit">ログイン</button>
    <p class="muted">プロトタイプ版です。データはこのブラウザ内に保存されます。</p>
  </form></div>`;
  $('#lf').onsubmit = e => {
    e.preventDefault();
    const u = state.users.find(u => u.id === $('#lid').value.trim() && u.pw === $('#lpw').value);
    if (!u) { $('#lerr').hidden = false; return; }
    session.set(u.id); route();
  };
}

function accountListPage(app) {
  const list = state.accounts.map(a => {
    const ws = DB.webinarsOf(a.id);
    return `<div class="card acc">
      <h2>${esc(a.name)}</h2>
      <div class="meta"><span>ウェビナー ${ws.length} / ${a.pageLimit} ページ</span><span>スタッフ ${a.staff.length}名</span></div>
      <div class="meta"><span>登録日 ${fmtDate(a.createdAt)}</span></div>
      <div class="row"><a class="btn pri" href="#/accounts/${a.id}/webinars">管理画面を開く</a><a class="btn" href="#/accounts/${a.id}/mypage">マイページ</a></div>
    </div>`;
  }).join('');
  shell(app, 'list', `
    <div class="head"><h1>アカウント一覧</h1><span class="sp"></span><a class="btn pri" href="#/new">＋ アカウント追加</a></div>
    ${list ? `<div class="acc-list">${list}</div>` : `<div class="card empty">アカウントが登録されていません。<br>「アカウント追加」ボタンから新しいアカウントを追加してください。</div>`}
  `);
}

function newAccountPage(app) {
  shell(app, 'new', `
    <div class="head"><h1>アカウント追加</h1></div>
    <div class="grid2">
      <form class="card stack" id="af">
        <h2>基本情報</h2>
        <label class="f">アカウント管理名<input id="aname" required placeholder="例：〇〇スクール公式LINE"></label>
        <label class="f">契約者名<input id="aowner" required></label>
        <label class="f">メールアドレス<input id="amail" type="email" required></label>
        <label class="f">電話番号<input id="atel" type="tel" required></label>
        <label class="f">契約ページ数<small>作成できるウェビナーページ数の上限</small><input id="alimit" type="number" min="1" max="50" value="1" required></label>
        <div class="err" id="aerr" hidden></div>
        <button class="btn pri" type="submit">アカウントを作成</button>
        <p class="muted">決済（Stripe）連携は未実装です。契約ページ数は手動で設定します。</p>
      </form>
      <div class="card stack">
        <h2>オートウェビナーご利用までの流れ</h2>
        <ol class="stack" style="margin:0;padding-left:1.2em">
          <li><b>サンプル確認</b><br><span class="muted">完成イメージを確認します</span></li>
          <li><b>動画の準備</b><br><span class="muted">Vimeoに動画をアップロードします（推奨: 1080p以上）</span></li>
          <li><b>ヘッダー画像準備</b><br><span class="muted">推奨: 400×210px 以上の横長画像</span></li>
          <li><b>ページ作成</b><br><span class="muted">エディターで開始時間・CTAを設定して公開します</span></li>
        </ol>
        <a class="btn" href="#/sample">サンプルを見る</a>
      </div>
    </div>`);
  $('#af').onsubmit = e => {
    e.preventDefault();
    const a = { id: uid(), name: $('#aname').value.trim(), pageLimit: Math.max(1, +$('#alimit').value || 1), createdAt: now(),
      contact: { owner: $('#aowner').value.trim(), mail: $('#amail').value.trim(), tel: $('#atel').value.trim() },
      staff: [{ id: uid(), name: $('#aowner').value.trim(), role: 'owner', createdAt: now() }], invites: [] };
    state.accounts.push(a); save(); toast('アカウントを作成しました'); location.hash = `#/accounts/${a.id}/webinars`;
  };
}

function accHead(acc, title) {
  return `<div class="crumb"><a href="#/">アカウント一覧</a> / ${esc(acc.name)}</div>
  <div class="head"><h1>${esc(title)}</h1><span class="sp"></span>
    <nav class="nav" style="margin:0">
      <a href="#/accounts/${acc.id}/webinars" class="${title === 'ウェビナー一覧' ? 'on' : ''}">ウェビナー一覧</a>
      <a href="#/accounts/${acc.id}/staff" class="${title === 'スタッフ管理' ? 'on' : ''}">スタッフ管理</a>
      <a href="#/accounts/${acc.id}/mypage" class="${title === 'アカウントマイページ' ? 'on' : ''}">マイページ</a>
    </nav></div>`;
}

function status(w) {
  const st = phase(w, new Date());
  if (st.kind === 'live') return `<span class="chip live">配信中</span>`;
  if (st.kind === 'before') return `<span class="chip">本日 ${esc(w.startTime)} 開始</span>`;
  return `<span class="chip">本日終了</span>`;
}

function webinarListPage(app, acc) {
  const ws = DB.webinarsOf(acc.id);
  const full = ws.length >= acc.pageLimit;
  const rows = ws.map(w => `<tr>
    <td><img class="thumb" src="${w.headerImage || ''}" alt=""></td>
    <td><b>${esc(w.adminName)}</b><div class="muted">${esc(w.title)}</div></td>
    <td>${status(w)}<div class="muted num">毎日 ${esc(w.startTime)}〜</div></td>
    <td><div class="row">
      <a class="btn sm" href="#/w/${w.id}" target="_blank" rel="noopener">開く</a>
      <button class="btn sm" data-copy="${w.id}">URLコピー</button>
      <a class="btn sm" href="#/accounts/${acc.id}/webinars/${w.id}/edit">編集</a>
      <a class="btn sm" href="#/accounts/${acc.id}/webinars/${w.id}/analysis">分析</a>
      <button class="btn sm" data-dup="${w.id}">複製</button>
      <button class="btn sm danger" data-del="${w.id}">削除</button>
    </div></td></tr>`).join('');
  shell(app, 'list', `
    ${accHead(acc, 'ウェビナー一覧')}
    <div class="row"><span class="muted">契約ページ数: ${ws.length} / ${acc.pageLimit}（あと ${Math.max(0, acc.pageLimit - ws.length)} ページ作成できます）</span><span style="flex:1"></span>
      <button class="btn pri" id="newW">＋ 新規作成</button></div>
    <div class="card">${ws.length ? `<div class="tbl-wrap"><table><thead><tr><th>サムネイル</th><th>管理名 / ページタイトル</th><th>状態</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<div class="empty">ウェビナーがありません<br>「新規作成」ボタンから、新しいウェビナーを作成してください。</div>`}</div>`);
  const limitModal = () => modal(`<h2>作成可能なページ数が上限に達しています</h2><p>現在の契約ページ数（${acc.pageLimit}ページ）が上限に達しています。新しいウェビナーを作成するには、契約ページ数の追加が必要です。</p><div class="row"><button class="btn" data-close>閉じる</button><a class="btn pri" href="#/accounts/${acc.id}/mypage" data-close>ページ数を追加する</a></div>`);
  $('#newW').onclick = () => full ? limitModal() : (location.hash = `#/accounts/${acc.id}/webinars/new`);
  app.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => copy(viewerUrl(DB.webinar(b.dataset.copy))));
  app.querySelectorAll('[data-dup]').forEach(b => b.onclick = () => {
    if (full) return limitModal();
    const src = DB.webinar(b.dataset.dup);
    const c = JSON.parse(JSON.stringify(src)); c.id = uid(); c.adminName += '（コピー）'; c.createdAt = now();
    state.webinars.push(c); save() && toast('複製しました'); route();
  });
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmBox('ウェビナーの削除', 'このウェビナーを削除してもよろしいですか？<br>この操作は取り消すことができません。', '削除する', () => {
    state.webinars = state.webinars.filter(w => w.id !== b.dataset.del);
    state.events = state.events.filter(e => e.wid !== b.dataset.del);
    save(); toast('削除しました'); route();
  }));
}

function myPage(app, acc) {
  const used = DB.webinarsOf(acc.id).length;
  const fee = n => 5000 + Math.max(0, n - 1) * 1000;
  shell(app, 'list', `
    ${accHead(acc, 'アカウントマイページ')}
    <div class="grid2">
      <div class="card stack">
        <h2>契約情報</h2>
        <table><tbody>
          <tr><th>アカウント管理名</th><td>${esc(acc.name)}</td></tr>
          <tr><th>契約状態</th><td><span class="chip">有効</span></td></tr>
          <tr><th>現在の契約ページ数</th><td class="num">${acc.pageLimit} ページ（使用中 ${used}）</td></tr>
          <tr><th>月額料金（目安）</th><td class="num">¥${fee(acc.pageLimit).toLocaleString()}（税抜）</td></tr>
        </tbody></table>
        <p class="muted">料金は参考サイトの体系（基本5,000円＋追加1ページ1,000円）を仮置き。決済は未連携です。</p>
      </div>
      <form class="card stack" id="pf">
        <h2>契約ページ数の変更</h2>
        <label class="f">契約ページ数<input id="plim" type="number" min="${Math.max(1, used)}" max="50" value="${acc.pageLimit}"></label>
        <div class="muted" id="pfee"></div>
        <label class="f">アカウント管理名<input id="pname" value="${esc(acc.name)}"></label>
        <button class="btn pri" type="submit">変更する</button>
      </form>
      <div class="card stack">
        <h2>アカウントの削除</h2>
        <p class="muted">アカウントと配下のウェビナー・分析データがすべて削除されます。</p>
        <div><button class="btn danger" id="delAcc">アカウントを削除</button></div>
      </div>
    </div>`);
  const upd = () => $('#pfee').textContent = `変更後の月額料金: ¥${fee(+$('#plim').value || 1).toLocaleString()}（税抜）`;
  $('#plim').oninput = upd; upd();
  $('#pf').onsubmit = e => { e.preventDefault(); acc.pageLimit = Math.max(used, 1, +$('#plim').value || 1); acc.name = $('#pname').value.trim() || acc.name; save(); toast('契約ページ数を更新しました'); route(); };
  $('#delAcc').onclick = () => confirmBox('アカウントの削除', `「${esc(acc.name)}」を削除します。この操作は取り消すことができません。`, '削除する', () => {
    const ids = DB.webinarsOf(acc.id).map(w => w.id);
    state.accounts = state.accounts.filter(a => a.id !== acc.id);
    state.webinars = state.webinars.filter(w => w.accountId !== acc.id);
    state.events = state.events.filter(e => !ids.includes(e.wid));
    save(); location.hash = '#/';
  });
}

function staffPage(app, acc) {
  const rows = acc.staff.map(s => `<tr><td>${esc(s.name)}</td>
    <td>${s.role === 'owner' ? ROLES.owner.label : `<select data-role="${s.id}">${Object.entries(ROLES).filter(([k]) => k !== 'owner').map(([k, r]) => `<option value="${k}" ${k === s.role ? 'selected' : ''}>${r.label}</option>`).join('')}</select>`}</td>
    <td class="num">${fmtDate(s.createdAt)}</td>
    <td>${s.role === 'owner' ? '' : `<button class="btn sm danger" data-rm="${s.id}">削除</button>`}</td></tr>`).join('');
  shell(app, 'list', `
    ${accHead(acc, 'スタッフ管理')}
    <div class="row"><span style="flex:1"></span><button class="btn" id="roleInfo">権限レベルについて</button><button class="btn pri" id="invite">スタッフを招待</button></div>
    <div class="card">${acc.staff.length ? `<div class="tbl-wrap"><table><thead><tr><th>スタッフ名</th><th>権限</th><th>登録日</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<div class="empty">スタッフが登録されていません</div>'}</div>`);
  $('#roleInfo').onclick = () => modal(`<h2>権限レベルについて</h2><table><tbody>${Object.values(ROLES).map(r => `<tr><th>${r.label}</th><td>${r.desc}</td></tr>`).join('')}</tbody></table><div class="row"><button class="btn" data-close>閉じる</button></div>`);
  $('#invite').onclick = () => {
    const m = modal(`<h2>スタッフを招待</h2>
      <label class="f">権限<select id="irole">${Object.entries(ROLES).filter(([k]) => k !== 'owner').map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('')}</select></label>
      <div id="ilink"></div>
      <div class="row"><button class="btn" data-close>閉じる</button><button class="btn pri" id="igen">招待リンクを生成</button></div>`);
    m.querySelector('#igen').onclick = () => {
      const inv = { token: uid() + uid(), role: m.querySelector('#irole').value, used: false, createdAt: now() };
      acc.invites.push(inv); save();
      const url = location.href.split('#')[0] + '#/invite/' + acc.id + '.' + inv.token;
      m.querySelector('#ilink').innerHTML = `<p class="muted">以下の招待リンクを共有してください：</p><div class="copybox">${esc(url)}</div><button class="btn sm" id="icopy">コピー</button>`;
      m.querySelector('#icopy').onclick = () => copy(url);
      toast('招待リンクを生成しました');
    };
  };
  app.querySelectorAll('[data-role]').forEach(s => s.onchange = () => { acc.staff.find(x => x.id === s.dataset.role).role = s.value; save(); toast('スタッフ権限を更新しました'); });
  app.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => confirmBox('スタッフの削除', 'このスタッフを削除してもよろしいですか？', '削除する', () => { acc.staff = acc.staff.filter(s => s.id !== b.dataset.rm); save(); toast('スタッフを削除しました'); route(); }));
}

function invitePage(app, key) {
  const [aid, token] = key.split('.');
  const acc = DB.account(aid); const inv = acc && acc.invites.find(i => i.token === token);
  let body;
  if (!inv) body = `<p class="err">招待情報の取得に失敗しました</p>`;
  else if (inv.used) body = `<p class="err">この招待は既に使用されています</p>`;
  else body = `<p>「${esc(acc.name)}」から<b>${ROLES[inv.role].label}</b>権限でのスタッフ招待を受け取りました。</p>
    <label class="f">お名前<input id="iname" required></label>
    <label class="f">ログインID<input id="iid" required autocomplete="username"></label>
    <label class="f">パスワード<input id="ipw" type="password" required minlength="6" autocomplete="new-password"></label>
    <div class="err" id="ierr" hidden></div>
    <button class="btn pri" type="submit">招待を承認</button>`;
  app.innerHTML = `<div class="login"><form class="card" id="invf"><a class="brand" href="#/"><i></i>オートウェビナー</a><h1>スタッフ招待</h1>${body}</form></div>`;
  if (!inv || inv.used) return;
  $('#invf').onsubmit = e => {
    e.preventDefault();
    const id = $('#iid').value.trim();
    if (state.users.some(u => u.id === id)) { $('#ierr').textContent = 'このログインIDは使用されています'; $('#ierr').hidden = false; return; }
    state.users.push({ id, pw: $('#ipw').value, name: $('#iname').value.trim() });
    acc.staff.push({ id: uid(), name: $('#iname').value.trim(), role: inv.role, createdAt: now(), userId: id });
    inv.used = true; save(); session.set(id); toast('招待を承認しました'); location.hash = `#/accounts/${acc.id}/webinars`;
  };
}

function settingsPage(app) {
  const me = state.users.find(u => u.id === session.get()) || state.users[0];
  shell(app, 'settings', `
    <div class="head"><h1>設定</h1></div>
    <div class="grid2">
      <form class="card stack" id="sf">
        <h2>ログイン情報の変更</h2>
        <label class="f">ログインID<input id="sid" value="${esc(me.id)}" required></label>
        <label class="f">新しいパスワード<input id="spw" type="password" minlength="6" placeholder="変更しない場合は空欄" autocomplete="new-password"></label>
        <button class="btn pri" type="submit">保存</button>
      </form>
      <div class="card stack">
        <h2>データ</h2>
        <p class="muted">プロトタイプのため、データはこのブラウザに保存されています。バックアップや別PCへの移行に使えます。</p>
        <div class="row"><button class="btn" id="exp">書き出し（JSON）</button><label class="btn">読み込み<input type="file" id="imp" accept="application/json" hidden></label></div>
        <div class="row"><button class="btn danger" id="reset">初期状態に戻す</button></div>
      </div>
    </div>`);
  $('#sf').onsubmit = e => { e.preventDefault(); const nid = $('#sid').value.trim(); if (nid !== me.id && state.users.some(u => u.id === nid)) return toast('このログインIDは使用されています'); me.id = nid; if ($('#spw').value) me.pw = $('#spw').value; save(); session.set(me.id); toast('保存しました'); };
  $('#exp').onclick = () => { const b = new Blob([JSON.stringify(state)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'autowebinar-backup.json'; a.click(); };
  $('#imp').onchange = async e => { try { const d = JSON.parse(await e.target.files[0].text()); if (!d.users) throw 0; state = d; save(); toast('読み込みました'); } catch (_) { toast('ファイルの形式が正しくありません'); } };
  $('#reset').onclick = () => confirmBox('初期状態に戻す', 'すべてのデータを削除して初期状態に戻します。', '初期化する', () => { state = seed(); save(); session.set(null); route(); });
}

// ---------- editor ----------
function editorPage(app, acc, w) {
  if (!w && DB.webinarsOf(acc.id).length >= acc.pageLimit) { location.hash = `#/accounts/${acc.id}/webinars`; return; }
  const isNew = !w;
  const d = w ? JSON.parse(JSON.stringify(w)) : { id: uid(), accountId: acc.id, adminName: '', title: '', headerImage: '', videoUrl: '', durationSec: 0, startTime: '20:00', cta: { sec: 1800, text: '', link: '', color: '#06c755' }, sections: [] };
  const ctaH = Math.floor(d.cta.sec / 3600), ctaM = Math.floor(d.cta.sec % 3600 / 60), ctaS = d.cta.sec % 60;
  const durM = Math.floor((d.durationSec || 0) / 60), durS = (d.durationSec || 0) % 60;
  shell(app, 'list', `
    <div class="crumb"><a href="#/">アカウント一覧</a> / <a href="#/accounts/${acc.id}/webinars">${esc(acc.name)}</a> / ${isNew ? '新規作成' : '編集'}</div>
    <div class="head"><h1>${isNew ? 'ウェビナー新規作成' : 'ウェビナー編集'}</h1><span class="sp"></span>
      <a class="btn" href="#/accounts/${acc.id}/webinars">キャンセル</a><button class="btn pri" id="saveW">保存</button></div>
    <div class="editor">
      <div class="stack">
        <section class="card stack"><h2>基本情報</h2>
          <label class="f">管理名<small>管理画面でのみ表示されます</small><input id="eAdmin" value="${esc(d.adminName)}"></label>
          <label class="f">ウェビナータイトル<small>視聴ページの見出し・ブラウザタブに表示</small><input id="eTitle" value="${esc(d.title)}"></label>
          <div class="f hdr-pick"><span>ヘッダー画像 <small class="muted">推奨: 400×210px／1.5MB以内</small></span>
            <img id="eHdrImg" src="${d.headerImage}" alt="選択された画像" ${d.headerImage ? '' : 'hidden'}>
            <label class="btn" style="justify-self:start">ヘッダー画像を選択<input type="file" id="eHdr" accept="image/*" hidden></label></div>
        </section>
        <section class="card stack"><h2>動画設定</h2>
          <label class="f">Vimeo動画URL<small>例: https://vimeo.com/123456789/abcdef1234（MP4の直リンクも可）</small><input id="eVideo" value="${esc(d.videoUrl)}" placeholder="https://vimeo.com/..."></label>
          <div class="f"><span>動画の長さ <small class="muted">終了判定に使用。プレビュー読込時に自動入力されます</small></span>
            <div class="hms"><input id="eDurM" type="number" min="0" value="${durM}"> 分 <input id="eDurS" type="number" min="0" max="59" value="${durS}"> 秒</div></div>
          <details><summary class="muted">動画URLの取得の仕方</summary><ol class="muted"><li>https://vimeo.com/ にアクセスしてログイン</li><li>動画をアップロード</li><li>動画ページの「共有」からリンクをコピー</li><li>プライバシー設定で埋め込みを「どこでも」または公開ドメインに許可</li></ol></details>
        </section>
        <section class="card stack"><h2>時間設定</h2>
          <label class="f">開始時間<small>毎日この時刻に配信開始（6:00〜23:59）</small><input id="eStart" type="time" value="${esc(d.startTime)}" min="06:00" max="23:59"></label>
        </section>
        <section class="card stack"><h2>CTA設定</h2>
          <div class="f"><span>CTAを表示する時間 <small class="muted">動画開始からの経過時間</small></span>
            <div class="hms"><input id="eCtaH" type="number" min="0" value="${ctaH}"> 時 <input id="eCtaM" type="number" min="0" max="59" value="${ctaM}"> 分 <input id="eCtaS" type="number" min="0" max="59" value="${ctaS}"> 秒</div></div>
          <label class="f">CTAボタンのテキスト<input id="eCtaText" value="${esc(d.cta.text)}" placeholder="例：今すぐ申し込む"></label>
          <label class="f">CTAリンク先URL<input id="eCtaLink" value="${esc(d.cta.link)}" placeholder="https://..."></label>
          <label class="f">CTAボタンの色<input id="eCtaColor" type="color" value="${esc(d.cta.color)}"></label>
        </section>
        <section class="card stack"><div class="row"><h2 style="flex:1">レイアウト</h2><button class="btn" id="addSec">＋ レイアウト追加</button></div>
          <p class="muted">動画の下に表示するテキスト・画像のセクションです。</p>
          <div id="secs" class="stack"></div>
        </section>
        <div class="err" id="eErr" hidden></div>
      </div>
      <aside class="preview-pane stack"><div class="row"><h2 style="flex:1">プレビュー</h2>
        <select id="pvMode" style="width:auto"><option value="live">配信中</option><option value="before">開始前</option><option value="after-cta">CTA表示後</option><option value="ended">終了後</option></select></div>
        <div class="phone" id="pv"></div></aside>
    </div>`);

  const val = id => $('#' + id).value;
  function collect() {
    d.adminName = val('eAdmin').trim(); d.title = val('eTitle').trim(); d.videoUrl = val('eVideo').trim();
    d.durationSec = (+val('eDurM') || 0) * 60 + (+val('eDurS') || 0);
    d.startTime = val('eStart');
    d.cta = { sec: (+val('eCtaH') || 0) * 3600 + (+val('eCtaM') || 0) * 60 + (+val('eCtaS') || 0), text: val('eCtaText').trim(), link: val('eCtaLink').trim(), color: val('eCtaColor') };
  }
  function renderSecs() {
    $('#secs').innerHTML = d.sections.map((s, si) => `<div class="sec">
      <div class="row"><b style="flex:1">セクション: ${si + 1}</b><button class="btn sm" data-addt="${si}">テキストを追加</button><label class="btn sm">画像を追加<input type="file" accept="image/*" data-addi="${si}" hidden></label><button class="btn sm danger" data-dels="${si}">セクションを削除</button></div>
      ${s.blocks.map((b, bi) => `<div class="blk">${b.type === 'text' ? `<textarea data-t="${si}.${bi}" placeholder="ここにテキストを入力してください">${esc(b.text)}</textarea>` : `<img src="${b.src}" alt="">`}<button class="btn sm danger" data-delb="${si}.${bi}" title="アイテムを削除">×</button></div>`).join('') || '<p class="muted">テキストか画像を追加してください。</p>'}
    </div>`).join('') || '<p class="muted">セクションはまだありません。</p>';
  }
  let pvTimer;
  function renderPreview() {
    collect();
    const mode = val('pvMode');
    const fake = { before: -125, live: Math.min(30, Math.max(0, d.cta.sec - 1)), 'after-cta': d.cta.sec + 1, ended: (d.durationSec || 1) + 1 }[mode];
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => { $('#pv').innerHTML = ''; mountViewer($('#pv'), d, { preview: true, fakeElapsed: fake, onDuration: s => { if (!(+val('eDurM') || +val('eDurS'))) { $('#eDurM').value = Math.floor(s / 60); $('#eDurS').value = Math.floor(s % 60); } } }); }, 300);
  }
  renderSecs(); renderPreview();
  onLeave(() => clearTimeout(pvTimer));

  app.querySelector('.editor').addEventListener('input', e => {
    if (e.target.dataset.t) { const [si, bi] = e.target.dataset.t.split('.'); d.sections[si].blocks[bi].text = e.target.value; }
    if (e.target.type !== 'file') renderPreview();
  });
  $('#pvMode').onchange = renderPreview;
  $('#eHdr').onchange = async e => { try { d.headerImage = await readImage(e.target.files[0]); $('#eHdrImg').src = d.headerImage; $('#eHdrImg').hidden = false; renderPreview(); } catch (m) { toast(m); } };
  $('#addSec').onclick = () => { d.sections.push({ id: uid(), blocks: [{ type: 'text', text: '新しいテキスト' }] }); renderSecs(); renderPreview(); };
  $('#secs').addEventListener('click', e => {
    const t = e.target;
    if (t.dataset.addt) { d.sections[t.dataset.addt].blocks.push({ type: 'text', text: '' }); }
    else if (t.dataset.dels) { d.sections.splice(+t.dataset.dels, 1); }
    else if (t.dataset.delb) { const [si, bi] = t.dataset.delb.split('.'); d.sections[si].blocks.splice(+bi, 1); }
    else return;
    renderSecs(); renderPreview();
  });
  $('#secs').addEventListener('change', async e => {
    if (!e.target.dataset.addi) return;
    try { const src = await readImage(e.target.files[0]); d.sections[e.target.dataset.addi].blocks.push({ type: 'image', src }); renderSecs(); renderPreview(); } catch (m) { toast(m); }
  });
  $('#saveW').onclick = () => {
    collect();
    const errs = [];
    if (!d.adminName) errs.push('管理名は必須です');
    if (!d.title) errs.push('ウェビナータイトルは必須です');
    if (!d.headerImage) errs.push('ヘッダー画像は必須です');
    if (!d.videoUrl) errs.push('動画URLは必須です');
    else if (!vimeoId(d.videoUrl) && !isFile(d.videoUrl)) errs.push('VimeoのURLを入力してください');
    if (!d.durationSec) errs.push('動画の長さを入力してください');
    if (!d.startTime) errs.push('開始時間は必須です');
    else if (d.startTime < '06:00') errs.push('開始時間は6:00〜23:59の間で指定してください（24時〜6時には設定できません）');
    if (!d.cta.text) errs.push('CTAテキストは必須です');
    if (!/^https?:\/\//.test(d.cta.link)) errs.push('CTAリンクは必須です（https://〜）');
    if (errs.length) { $('#eErr').innerHTML = '入力に誤りがあります:<br>・' + errs.map(esc).join('<br>・'); $('#eErr').hidden = false; $('#eErr').scrollIntoView({ block: 'center' }); return; }
    const i = state.webinars.findIndex(x => x.id === d.id);
    if (i >= 0) state.webinars[i] = d; else { d.createdAt = now(); state.webinars.push(d); }
    if (save()) { toast('保存しました'); location.hash = `#/accounts/${acc.id}/webinars`; }
  };
}

// ---------- viewer ----------
function startAt(w, date) { const [h, m] = (w.startTime || '20:00').split(':').map(Number); const s = new Date(date); s.setHours(h, m, 0, 0); return s; }
function phase(w, date) {
  const el = (date - startAt(w, date)) / 1000;
  if (el < 0) return { kind: 'before', elapsed: el };
  if (el < (w.durationSec || 0)) return { kind: 'live', elapsed: el };
  return { kind: 'ended', elapsed: el };
}
function visitorId() {
  try { let v = localStorage.getItem('aw:vid'); if (!v) { v = uid(); localStorage.setItem('aw:vid', v); } return v; } catch (e) { return 'anon'; }
}
function track(w, type, offset) {
  state = load();
  state.events.push({ wid: w.id, vid: visitorId(), type, ts: now(), offset: Math.round(offset || 0) });
  if (state.events.length > 20000) state.events = state.events.slice(-20000);
  save();
}

function viewerPage(app, id, sample) {
  const w = DB.webinar(id);
  if (!w) { app.innerHTML = `<div class="login"><div class="card"><h1>ページが見つかりません</h1><p class="muted">URLをご確認ください。</p></div></div>`; return; }
  document.title = w.title || 'オートウェビナー';
  onLeave(() => document.title = 'オートウェビナー');
  if (sample) {
    shell(app, 'sample', `<div class="head"><h1>サンプル</h1><span class="sp"></span><a class="btn" href="#/w/${w.id}" target="_blank" rel="noopener">視聴ページを別タブで開く</a></div><div class="card" style="padding:0;overflow:hidden" id="vs"></div>`);
    mountViewer($('#vs'), w, {});
  } else {
    app.innerHTML = `<div id="vs"></div>`;
    track(w, 'view', phase(w, new Date()).elapsed);
    mountViewer($('#vs'), w, { onCta: off => track(w, 'cta', off) });
  }
}

/* 視聴ページ本体。opts.fakeElapsed を渡すとその経過秒で固定表示（エディタのプレビュー用） */
function mountViewer(root, w, opts) {
  root.innerHTML = `<div class="lp"><img src="${w.headerImage || ''}" alt="" ${w.headerImage ? '' : 'hidden'}>
    <div class="in">
      <h1>${esc(w.title || 'ウェビナータイトル')}</h1>
      <div class="count" data-v="count" hidden><div class="left">あと <span data-v="left"></span></div><div>本日の${esc(w.startTime)}から開始します！</div></div>
      <div data-v="liveWrap" hidden><div class="live-badge">LIVE 配信中</div>
        <div class="player" data-v="player"></div>
        <div class="unmute" data-v="unmute" hidden><span class="muted">🔇 音声がミュートになっています。</span><button class="btn pri" data-v="unmuteBtn">▶ ウェビナーを視聴</button></div></div>
      <div class="ended" data-v="ended" hidden>ウェビナーは終了しました。</div>
      <div class="cta" data-v="cta" hidden><a href="${esc(w.cta?.link || '#')}" target="_blank" rel="noopener noreferrer" style="background:${esc(w.cta?.color || '#06c755')}">${esc(w.cta?.text || 'CTAボタン')}</a></div>
      ${(w.sections || []).map(s => `<section class="stack">${s.blocks.map(b => b.type === 'text' ? `<div class="lp-text">${esc(b.text)}</div>` : `<img src="${b.src}" alt="">`).join('')}</section>`).join('')}
    </div></div>`;
  const v = n => root.querySelector(`[data-v="${n}"]`);
  const fixed = typeof opts.fakeElapsed === 'number';
  const t0 = Date.now();
  let player = null, kind = null, built = false;

  v('cta').querySelector('a').addEventListener('click', e => {
    if (opts.preview) { e.preventDefault(); return; }
    opts.onCta && opts.onCta(elapsed());
  });

  function elapsed() {
    if (fixed) return opts.fakeElapsed + (Date.now() - t0) / 1000 * (opts.fakeElapsed < 0 || opts.fakeElapsed >= (w.durationSec || 1) ? 0 : 1);
    return phase(w, new Date()).elapsed;
  }
  function buildPlayer(at) {
    built = true;
    const box = v('player');
    const vm = vimeoId(w.videoUrl);
    if (isFile(w.videoUrl)) {
      kind = 'file';
      const el = document.createElement('video');
      el.src = w.videoUrl; el.muted = true; el.playsInline = true; el.autoplay = true; el.controls = false;
      el.addEventListener('loadedmetadata', () => { opts.onDuration && opts.onDuration(el.duration); try { el.currentTime = at; } catch (e) {} el.play().catch(() => {}); });
      box.appendChild(el); player = el;
    } else if (vm) {
      kind = 'vimeo';
      const f = document.createElement('iframe');
      const q = new URLSearchParams({ autoplay: 1, muted: 1, playsinline: 1, controls: 0, title: 0, byline: 0, portrait: 0, dnt: 1 });
      if (vm.hash) q.set('h', vm.hash);
      f.src = `https://player.vimeo.com/video/${vm.id}?${q}#t=${Math.floor(at)}s`;
      f.allow = 'autoplay; fullscreen; picture-in-picture'; f.setAttribute('allowfullscreen', '');
      box.appendChild(f);
      if (window.Vimeo) {
        player = new Vimeo.Player(f);
        player.ready().then(() => { player.getDuration().then(d => opts.onDuration && opts.onDuration(d)).catch(() => {}); player.setCurrentTime(Math.max(0, elapsed())).catch(() => {}); }).catch(() => {});
      }
    } else {
      box.innerHTML = `<div style="position:absolute;inset:0;display:grid;place-items:center;color:#ccc;text-align:center;padding:16px">動画URLを入力すると、ここにプレビューが表示されます</div>`;
      return;
    }
    // 疑似ライブなのでシーク操作を防ぐ透明シールド
    const sh = document.createElement('div'); sh.className = 'shield'; box.appendChild(sh);
    v('unmute').hidden = false;
  }
  v('unmuteBtn').onclick = () => {
    const at = Math.max(0, elapsed());
    if (kind === 'file') { player.muted = false; try { player.currentTime = at; } catch (e) {} player.play().catch(() => {}); }
    if (kind === 'vimeo' && player) { player.setMuted(false).catch(() => {}); player.setVolume(1).catch(() => {}); player.setCurrentTime(at).catch(() => {}); player.play().catch(() => {}); }
    v('unmute').hidden = true;
  };

  function tick() {
    const el = elapsed();
    const dur = w.durationSec || 0;
    const k = el < 0 ? 'before' : el < dur ? 'live' : 'ended';
    v('count').hidden = k !== 'before';
    if (k === 'before') v('left').textContent = hms(-el);
    v('liveWrap').hidden = k !== 'live';
    v('ended').hidden = k !== 'ended';
    if (k === 'live' && !built) buildPlayer(el);
    if (k !== 'live' && built && !fixed) { v('player').innerHTML = ''; built = false; player = null; v('unmute').hidden = true; }
    v('cta').hidden = !(k !== 'before' && el >= (w.cta?.sec || 0));
  }
  tick();
  const iv = setInterval(() => { if (!root.isConnected) return clearInterval(iv); tick(); }, 1000);
  onLeave(() => clearInterval(iv));
}

// ---------- analysis ----------
function analysisPage(app, acc, w) {
  if (!w) return shell(app, 'list', `<div class="card empty">ウェビナーが取得できませんでした</div>`);
  let range = 30;
  function draw() {
    const all = DB.eventsOf(w.id);
    const since = range ? now() - range * 864e5 : 0;
    const ev = all.filter(e => e.ts >= since);
    const views = ev.filter(e => e.type === 'view'), ctas = ev.filter(e => e.type === 'cta');
    const uv = new Set(views.map(e => e.vid)).size, uc = new Set(ctas.map(e => e.vid)).size;
    const ctr = uv ? uc / uv * 100 : 0;
    const grade = ctr >= 10 ? ['優秀', 'g1'] : ctr >= 5 ? ['良好', 'g2'] : ['改善要', 'g3'];

    // 日別
    const days = {};
    ev.forEach(e => { const k = fmtDate(e.ts); days[k] = days[k] || { v: new Set(), c: new Set(), tv: 0, tc: 0 }; if (e.type === 'view') { days[k].v.add(e.vid); days[k].tv++; } else { days[k].c.add(e.vid); days[k].tc++; } });
    const dkeys = Object.keys(days).sort().reverse();
    const dmax = Math.max(1, ...dkeys.map(k => days[k].v.size));
    // 曜日別
    const wd = WD.map(() => ({ v: new Set(), c: new Set() }));
    ev.forEach(e => { const g = wd[new Date(e.ts).getDay()]; (e.type === 'view' ? g.v : g.c).add(e.vid + fmtDate(e.ts)); });
    const wdr = wd.map(g => g.v.size ? g.c.size / g.v.size * 100 : 0);
    const wdmax = Math.max(1, ...wdr);
    const best = wdr.indexOf(Math.max(...wdr));
    // CTAクリック時間分布（5分刻み）
    const bucket = 300, hist = {};
    ctas.forEach(e => { const b = Math.floor(Math.max(0, e.offset) / bucket); hist[b] = (hist[b] || 0) + 1; });
    const hk = Object.keys(hist).map(Number).sort((a, b) => a - b);
    const hmax = Math.max(1, ...Object.values(hist));
    const peak = hk.length ? hk.reduce((a, b) => hist[b] > hist[a] ? b : a) : null;
    const before = ctas.filter(e => e.offset < (w.cta?.sec || 0)).length;

    $('#ana').innerHTML = `
      <div class="kpis">
        <div class="kpi"><span>総アクセス数</span><b>${views.length}</b><span>同じユーザーの複数回アクセスも含む</span></div>
        <div class="kpi"><span>ユニークアクセス数</span><b>${uv}</b><span>重複を除いた実際の訪問者数</span></div>
        <div class="kpi"><span>総CTAクリック数</span><b>${ctas.length}</b></div>
        <div class="kpi"><span>ユニークCTAクリック数</span><b>${uc}</b><span>CTAをクリックしたユニークユーザー数</span></div>
        <div class="kpi"><span>CTAクリック率</span><b>${ctr.toFixed(1)}%</b><span class="grade ${grade[1]}">${uv ? grade[0] : 'データ不足'}</span></div>
      </div>
      <div class="grid2">
        <div class="card stack"><h2>日別アクセス・CTAクリック</h2>
          <div class="legend"><span><i></i>ユニークアクセス</span><span><i class="b"></i>ユニークCTA</span></div>
          ${dkeys.length ? `<div class="bars">${dkeys.slice(0, 31).map(k => `<div class="r"><span class="num">${k.slice(5)}</span><div class="t"><i style="width:${days[k].c.size / dmax * 100}%" class="b"></i><i style="width:${(days[k].v.size - days[k].c.size) / dmax * 100}%"></i></div><span class="num">${days[k].v.size} / ${days[k].c.size}</span></div>`).join('')}</div>` : '<p class="muted">選択した期間内にアクセスデータがありません。</p>'}
        </div>
        <div class="card stack"><h2>曜日別CTAクリック率</h2>
          <div class="bars">${WD.map((n, i) => `<div class="r"><span>${n}曜日</span><div class="t"><i style="width:${wdr[i] / wdmax * 100}%"></i></div><span class="num">${wdr[i].toFixed(1)}%</span></div>`).join('')}</div>
          <p class="muted">${views.length >= 20 ? `${WD[best]}曜日のCTAクリック率が${wdr[best].toFixed(1)}%で最も高くなっています。` : '曜日別の分析を行うには、より多くのデータが必要です。'}</p>
        </div>
        <div class="card stack"><h2>CTAクリック時間分布</h2>
          <p class="muted">動画開始からの経過時間（5分刻み）。CTA表示設定時刻: <span class="num">${hms(w.cta?.sec || 0)}</span></p>
          ${hk.length ? `<div class="bars">${hk.map(b => `<div class="r"><span class="num">${hms(b * bucket).slice(0, 5)}</span><div class="t"><i style="width:${hist[b] / hmax * 100}%"></i></div><span class="num">${hist[b]}回</span></div>`).join('')}</div>
          <p class="muted">ピーク: <span class="num">${hms(peak * bucket)}〜</span>（${hist[peak]}回）／ CTA表示前のクリック: ${before}回</p>` : '<p class="muted">CTAクリックデータがありません。</p>'}
        </div>
        <div class="card stack"><h2>クリック率評価基準（目安）</h2>
          <table><tbody><tr><th class="grade g1">優秀</th><td>10%以上</td></tr><tr><th class="grade g2">良好</th><td>5%以上</td></tr><tr><th class="grade g3">改善要</th><td>5%未満</td></tr></tbody></table>
          <p class="muted">参考サイトの表示形式に合わせた仮の基準値です。実績が溜まったら自社データで見直してください。</p>
        </div>
      </div>`;
  }
  shell(app, 'list', `
    <div class="crumb"><a href="#/">アカウント一覧</a> / <a href="#/accounts/${acc.id}/webinars">${esc(acc.name)}</a> / 分析</div>
    <div class="head"><h1>ウェビナー分析</h1><span class="muted">${esc(w.adminName)}</span><span class="sp"></span>
      <select id="rng" style="width:auto"><option value="7">7日間</option><option value="30" selected>30日間</option><option value="90">90日間</option><option value="0">全期間</option></select>
      <button class="btn" id="demo">サンプルデータを生成</button><button class="btn danger" id="clr">データを消去</button></div>
    <div id="ana" class="stack"></div>`);
  $('#rng').onchange = e => { range = +e.target.value; draw(); };
  $('#demo').onclick = () => { demoEvents(w); save(); toast('サンプルデータを生成しました'); draw(); };
  $('#clr').onclick = () => confirmBox('データを消去', 'このウェビナーの分析データを削除します。', '消去する', () => { state.events = state.events.filter(e => e.wid !== w.id); save(); draw(); });
  draw();
}
function demoEvents(w) {
  const dur = w.durationSec || 3600, ctaAt = w.cta?.sec || 0;
  for (let d = 0; d < 30; d++) {
    const day = new Date(); day.setDate(day.getDate() - d);
    const start = startAt(w, day).getTime();
    const n = 15 + Math.floor(Math.random() * 30);
    for (let i = 0; i < n; i++) {
      const vid = 'demo' + d + '_' + i; const off = Math.random() * dur * 0.5;
      state.events.push({ wid: w.id, vid, type: 'view', ts: start + off * 1000, offset: off, demo: true });
      if (Math.random() < 0.11) { const c = ctaAt + Math.random() * Math.max(60, dur - ctaAt) * 0.6; state.events.push({ wid: w.id, vid, type: 'cta', ts: start + c * 1000, offset: c, demo: true }); }
    }
  }
}

route();
})();
