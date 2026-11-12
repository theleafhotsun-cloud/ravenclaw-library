let db = {};
function getMajor(subjectStr) {
let s = subjectStr.toLowerCase();
if (s.includes('charm') || s.includes('potion') || s.includes('arithmancy') || s.includes('transfiguration') || s.includes('defence') || s.includes('dark arts') || s.includes('herbolog')) return 'Auror';
if (s.includes('astronomy') || s.includes('divination') || s.includes('care of magical') || s.includes('ancient rune') || s.includes('muggle') || s.includes('history of magic')) return 'Ministry';
if (s.includes('quidditch') || s.includes('ekstra') || s.includes('extra')) return 'Extracurricular';
return 'Other';
}

function getLevel(subjectStr) {
let s = subjectStr.toLowerCase();
if (s.includes('advanced')) return 'Advanced';
if (s.includes('beginner')) return 'Beginner';
if (s.includes('quidditch') || s.includes('ekstra') || s.includes('extra')) return 'Extracurricular';
return 'All';
}

function getDaySchedule(subjectStr) {
let s = subjectStr.toLowerCase();
if (s.includes('charm') || s.includes('astronomy')) return 'Monday';
if (s.includes('potion') || s.includes('divination')) return 'Tuesday';
if (s.includes('care of magical') || s.includes('ancient rune')) return 'Wednesday';
if (s.includes('arithmancy') || s.includes('muggle')) return 'Thursday';
if (s.includes('transfiguration') || s.includes('history of magic')) return 'Friday';
if (s.includes('defence') || s.includes('dark arts') || s.includes('herbolog')) return 'Saturday';
if (s.includes('quidditch')) return 'Sunday';
return 'Unscheduled';
}

function getBookCoverStyle(subjectStr) {
let s = subjectStr.toLowerCase();
let icon = 'fa-book';
let bg = 'linear-gradient(135deg, var(--bg-panel), var(--bg-main))';
if (s.includes('charm')) { icon = 'fa-wand-magic-sparkles'; bg = 'linear-gradient(135deg, #b71540, #0c2461)'; }
else if (s.includes('potion')) { icon = 'fa-flask'; bg = 'linear-gradient(135deg, #079992, #0a3d62)'; }
else if (s.includes('arithmancy')) { icon = 'fa-calculator'; bg = 'linear-gradient(135deg, #3c6382, #0a3d62)'; }
else if (s.includes('transfiguration')) { icon = 'fa-cat'; bg = 'linear-gradient(135deg, #e58e26, #b71540)'; }
else if (s.includes('defence') || s.includes('dark')) { icon = 'fa-khanda'; bg = 'linear-gradient(135deg, #303952, #1e272e)'; }
else if (s.includes('herbolog')) { icon = 'fa-leaf'; bg = 'linear-gradient(135deg, #78e08f, #079992)'; }
else if (s.includes('astronomy')) { icon = 'fa-meteor'; bg = 'linear-gradient(135deg, #1e3799, #0c2461)'; }
else if (s.includes('divination')) { icon = 'fa-eye'; bg = 'linear-gradient(135deg, #82ccdd, #60a3bc)'; }
else if (s.includes('care of magical')) { icon = 'fa-dragon'; bg = 'linear-gradient(135deg, #fa983a, #e55039)'; }
else if (s.includes('ancient rune')) { icon = 'fa-gem'; bg = 'linear-gradient(135deg, #b8e994, #78e08f)'; }
else if (s.includes('muggle')) { icon = 'fa-car'; bg = 'linear-gradient(135deg, #f8c291, #e55039)'; }
else if (s.includes('history')) { icon = 'fa-hourglass-half'; bg = 'linear-gradient(135deg, #fad390, #e58e26)'; }
else if (s.includes('quidditch')) { icon = 'fa-broom'; bg = 'linear-gradient(135deg, #f6b93b, #e55039)'; }
return { icon, bg };
}
function extractLinkAndName(rawText) {
if (!rawText) return { name: "", url: "" };
let text = rawText.toString().trim();

// Regex untuk mencocokkan URL dengan/tanpa http, www, domain (x.com, twitter.com, t.me, dll), atau @username
let urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|io|me|co|ly|app|site|online|tech|xyz|info)(?:\/[^\s]*)?|@[a-zA-Z0-9_]+)/gi;
let matches = text.match(urlRegex);

if (matches && matches.length > 0) {
let rawUrl = matches[0];
let hrefUrl = rawUrl;
if (rawUrl.startsWith('@')) {
hrefUrl = 'https://x.com/' + rawUrl.substring(1);
} else if (!hrefUrl.startsWith('http://') && !hrefUrl.startsWith('https://')) {
hrefUrl = 'https://' + hrefUrl;
}

let name = text.replace(rawUrl, '').trim();
name = name.replace(/^[-–—:\s]+|[-–—:\s]+$/g, '').trim();
if (!name) name = rawUrl;
return { name: name, url: hrefUrl };
}

return { name: text, url: "" };
}

function extractAndRenderButton(text, btnLabel, iconClass, extraStyle = "") {
if (!text) return '';
let extracted = extractLinkAndName(text);
if (extracted.url) {
return `<a href="${extracted.url}" target="_blank" class="glowing-btn" style="${extraStyle}" onclick="event.stopPropagation();"><i class="fa-solid ${iconClass}"></i> ${btnLabel}</a>`;
}
return `<span style="font-size:0.85rem; color:var(--text-gold-light); opacity:0.6; font-style:italic;">${extracted.name}</span>`;
}

function formatTaskContent(text) {
if (!text) return '';
let urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|(?:[a-zA-Z0-9-]+\.)+(?:com|org|net|edu|gov|io|me|co|ly)(?:\/[^\s]*)?)/gi;
let linkedText = text.toString().replace(urlRegex, function(url) {
let href = url.startsWith('http') ? url : 'https://' + url;
return `<a href="${href}" target="_blank" style="color: var(--status-replace-class); text-decoration: none; border-bottom: 1px dashed var(--status-replace-class); font-weight: 500; transition: 0.3s;">[Open Link <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.7rem;"></i>]</a>`;
});
return `<ul class="task-content"><li>${linkedText}</li></ul>`;
}
function autoSelectCurrentDateFilters() {
const today = new Date();
const currentMonth = today.toLocaleString('en-US', { month: 'long' });
const weekNum = Math.ceil(today.getDate() / 7);
const weekSynonyms = [weekNum.toString(), `week ${weekNum}`, `${weekNum} week`];

['lib-month', 'cls-month'].forEach(id => {
const sel = document.getElementById(id);
if(sel) { for(let opt of sel.options) { if(opt.value.toLowerCase().includes(currentMonth.toLowerCase())) { sel.value = opt.value; break; } } }
});
['lib-week', 'cls-week'].forEach(id => {
const sel = document.getElementById(id);
if(sel) { for(let opt of sel.options) { let text = opt.value.toLowerCase(); if(weekSynonyms.some(syn => text.includes(syn))) { sel.value = opt.value; break; } } }
});
}
function getCombinedUnique(data1, col1, data2, col2) {
let s = new Set();
data1.forEach(r => { if(r[col1]) s.add(r[col1].trim()); });
data2.forEach(r => { if(r[col2]) s.add(r[col2].trim()); });
return Array.from(s).filter(Boolean);
}

function populateStaticDropdown(selectId, arr) {
const select = document.getElementById(selectId);
if(!select) return;
select.innerHTML = `<option value="All">All ${selectId.includes('month')?'Months':'Weeks'}</option>`;
arr.forEach(val => { select.innerHTML += `<option value="${val}">${val}</option>`; });
}

function populateDropdown(data, colIndex, selectId, defaultText) {
const select = document.getElementById(selectId);
if(!select) return;
let uniqueValues = new Set();
data.forEach(row => { if(row[colIndex]) uniqueValues.add(row[colIndex].trim()); });
select.innerHTML = `<option value="All">${defaultText}</option>`;
Array.from(uniqueValues).filter(Boolean).forEach(val => { select.innerHTML += `<option value="${val}">${val}</option>`; });
}

function toast(msg) {
const t = document.createElement('div');
t.className = 'toast'; t.setAttribute('role', 'alert'); t.textContent = String(msg);
document.body.appendChild(t);
setTimeout(function() { t.remove(); }, 4500);
}
window.alert = toast;

function showLoadError(msg) {
const l = document.getElementById('loader');
l.style.display = 'flex';
l.innerHTML = '<img src="https://lh3.googleusercontent.com/d/1itBW7VYne3TZcKNmiia7X2HxGn-LSD33=w256" alt=""><p>The archives did not answer.</p><p class="load-err"></p><button type="button" class="glowing-btn" style="width:auto;padding:10px 22px;" onclick="location.reload()">Try again</button>';
l.querySelector('.load-err').textContent = String(msg || 'Unknown error');
}
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c];});}
const CACHE_KEY = 'rc:library:v1';
const FILTER_IDS = ['lib-month', 'lib-week', 'lib-level', 'lib-major', 'cls-month', 'cls-week', 'cls-level', 'cls-major', 'rep-major', 'rep-month', 'rep-year', 'gui-level', 'gui-sub'];
let liveLoaded = false;
let applied = false;

async function callApi(action, params) {
const qs = new URLSearchParams(Object.assign({ action: action }, params || {})).toString();
const ctl = new AbortController();
const timer = setTimeout(function() { ctl.abort(); }, 30000);
let res;
try { res = await fetch(window.RC_API + '?' + qs, { signal: ctl.signal }); }
catch (e) { throw new Error(e && e.name === 'AbortError' ? 'The archives took too long to answer.' : 'Could not reach the archives. Check your connection and the API address.'); }
finally { clearTimeout(timer); }
if (!res.ok) throw new Error('The API answered with status ' + res.status + '.');
const text = await res.text();
try { return JSON.parse(text); }
catch (e) { throw new Error('The API did not return data. In Apps Script, deploy the web app with "Execute as: Me" and "Who has access: Anyone".'); }
}

// Vault codes and passcodes never go into persistent storage
function slim(d) {
const c = Object.assign({}, d);
c.masterData = [(d.masterData || [])[0] || ['ID', 'Vault Code']];
c.finalSummaries = (d.finalSummaries || []).map(function(r) { const x = r.slice(); x[5] = ''; return x; });
return c;
}
function applyData(d) {
const ids = FILTER_IDS.filter(function(id) { return document.getElementById(id); });
const keep = {};
if (applied) ids.forEach(function(id) { keep[id] = document.getElementById(id).value; });
db = d;
window.RC_POPULATE(d);
if (applied) {
ids.forEach(function(id) { const el = document.getElementById(id); if (keep[id] && Array.from(el.options).some(function(o) { return o.value === keep[id]; })) el.value = keep[id]; });
} else { autoSelectCurrentDateFilters(); }
applied = true;
window.RC_RENDER();
}
window.onload = () => {
if (typeof window.RC_POPULATE !== 'function') return;
let cached = false;
try {
const c = localStorage.getItem(CACHE_KEY);
if (c) { applyData(JSON.parse(c)); cached = true; document.getElementById('loader-msg').textContent = 'Syncing the latest scrolls...'; }
} catch (e) { applied = false; try { localStorage.removeItem(CACHE_KEY); } catch (e2) {} }

setTimeout(function() {
const m = document.getElementById('loader-msg');
if (m && !liveLoaded && document.getElementById('loader').style.display !== 'none') m.textContent = 'Still consulting the archives... the sheets are slow to answer.';
}, 15000);

callApi('getAllDatabase').then(function(res) {
if (!res || !res.success) throw new Error((res && res.error) || 'Unknown error from the archives.');
applyData(res);
liveLoaded = true;
document.getElementById('loader').style.display = 'none';
try { localStorage.setItem(CACHE_KEY, JSON.stringify(slim(res))); } catch (e) {}
}).catch(function(err) {
const msg = err && err.message ? err.message : String(err);
if (cached) { document.getElementById('loader').style.display = 'none'; alert('Could not refresh the archives. Showing the last saved scrolls. (' + msg + ')'); }
else showLoadError(msg);
});
};
(function() {
const c = document.getElementById('stars');
if (!c || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
const x = c.getContext('2d'); let S = [], w, h;
function fit() { w = c.width = innerWidth; h = c.height = innerHeight; S = [];
for (let i = 0, n = Math.min(110, Math.round(w * h / 9000)); i < n; i++) S.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + .3, p: Math.random() * 6.28, s: .4 + Math.random() * 1.2 }); }
function draw(t) { x.clearRect(0, 0, w, h);
S.forEach(o => { x.fillStyle = 'rgba(224,198,143,' + (.25 + .6 * Math.abs(Math.sin(o.p + t / 1000 * o.s))).toFixed(2) + ')'; x.beginPath(); x.arc(o.x, o.y, o.r, 0, 6.283); x.fill(); });
requestAnimationFrame(draw); }
fit(); addEventListener('resize', fit); requestAnimationFrame(draw);
})();
(()=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;const c=document.getElementById('sparks'),x=c.getContext('2d');let W,H,P=[];
const rs=()=>{W=c.width=innerWidth;H=c.height=innerHeight};rs();addEventListener('resize',rs);
addEventListener('pointermove',e=>{for(let i=0;i<3;i++)P.push({x:e.clientX,y:e.clientY,vx:(Math.random()-.5)*1.4,vy:Math.random()*1.2+.3,l:1,s:Math.random()*2+1,h:Math.random()<.5?190:42})},{passive:true});
(function f(){x.clearRect(0,0,W,H);P=P.filter(p=>p.l>0);for(const p of P){p.x+=p.vx;p.y+=p.vy;p.vy+=.03;p.l-=.02;x.globalAlpha=p.l;x.fillStyle='hsl('+p.h+',90%,75%)';x.shadowColor=x.fillStyle;x.shadowBlur=10;x.beginPath();x.arc(p.x,p.y,p.s*p.l,0,7);x.fill()}requestAnimationFrame(f)})()})();
['library-content','classes-content','report-content'].forEach(id=>{const el=document.getElementById(id);if(!el)return;new MutationObserver(()=>{[...el.querySelectorAll('.tome,.wz,.env')].forEach((n,i)=>n.style.setProperty('--i',i))}).observe(el,{childList:true,subtree:true})});
document.addEventListener('pointermove',e=>{const w=e.target.closest&&e.target.closest('.wz');if(!w||e.pointerType==='touch')return;const r=w.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height,f=w.querySelector('.wz-front');w.style.setProperty('--ry',(x-.5)*22+'deg');w.style.setProperty('--rx',(.5-y)*18+'deg');f.style.setProperty('--mx',x*100+'%');f.style.setProperty('--my',y*100+'%')});
document.addEventListener('pointerout',e=>{const w=e.target.closest&&e.target.closest('.wz');if(w&&!w.contains(e.relatedTarget)){w.style.setProperty('--ry','0deg');w.style.setProperty('--rx','0deg')}});
(()=>{const el=document.getElementById('classguide-content');if(el)new MutationObserver(()=>{[...el.querySelectorAll('.pt')].forEach((n,i)=>n.style.setProperty('--i',i))}).observe(el,{childList:true})})();
