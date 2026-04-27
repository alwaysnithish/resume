/* =========================================================
   QuantumCV — builder.js v3
   AI generate, inline editing, undo/redo, drag-and-drop,
   AI chat, auto-save, PDF export, template switcher.
   ========================================================= */
'use strict';

// ── CSRF Helper ──────────────────────────────────────────
const CSRF = () => document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';

// ── Global State ─────────────────────────────────────────
let currentResumeId = (window.RESUME_ID && window.RESUME_ID !== '') ? window.RESUME_ID : null;
window.currentData  = null;
window.ACCENT       = '#2058e8';
window.ACTIVE_TPL   = null;
window.photoDataUrl = null;

let saveTimer   = null;
let isDirty     = false;
let chatOpen    = false;
let currentFont = 'dm-sans';
let fontScale   = 1;

// Undo / Redo (max 50 steps)
const undoStack = [];
const redoStack = [];

// ─────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────

function showToast(msg, type = 'info') {
  let c = document.getElementById('toast-container');
  if (!c) { c = document.createElement('div'); c.id = 'toast-container'; document.body.appendChild(c); }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<div class="toast-icon"></div><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 4200);
}

function updateCharCount(el, id) {
  const cel = document.getElementById(id);
  if (cel) cel.textContent = el.value.length.toLocaleString();
}

function setBtnLoading(id, on) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.toggle('loading', on);
  btn.disabled = on;
}

function uid()  { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function euid() { return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function maxOrder() {
  return Math.max(0, ...(window.currentData?.sections || []).map(s => s.order || 0));
}

function el$(id) { return document.getElementById(id); }

// ─────────────────────────────────────────────────────────
// UNDO / REDO
// ─────────────────────────────────────────────────────────

function pushUndo() {
  if (!window.currentData) return;
  undoStack.push(JSON.stringify(window.currentData));
  if (undoStack.length > 50) undoStack.shift();
  redoStack.length = 0;
  refreshUndoBtns();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(window.currentData));
  window.currentData = JSON.parse(undoStack.pop());
  refreshUndoBtns();
  rerenderResume();
  syncStyleFields();
  showToast('Undone', 'info');
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(window.currentData));
  window.currentData = JSON.parse(redoStack.pop());
  refreshUndoBtns();
  rerenderResume();
  syncStyleFields();
  showToast('Redone', 'info');
}

function refreshUndoBtns() {
  const ub = el$('undo-btn'), rb = el$('redo-btn');
  if (ub) ub.disabled = !undoStack.length;
  if (rb) rb.disabled = !redoStack.length;
}

window.undo = undo;
window.redo = redo;

// ─────────────────────────────────────────────────────────
// PANEL TABS
// ─────────────────────────────────────────────────────────

function switchPanelTab(tab) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelector(`.panel-tab[data-tab="${tab}"]`)?.classList.add('active');
  el$(`tab-${tab}`)?.classList.add('active');
}
window.switchPanelTab = switchPanelTab;

// ─────────────────────────────────────────────────────────
// MOBILE PANEL TOGGLE
// ─────────────────────────────────────────────────────────

function toggleMobilePanel() {
  const panel   = el$('input-panel');
  const overlay = el$('panel-overlay');
  const open    = panel?.classList.toggle('mobile-open');
  overlay?.classList.toggle('active', open);
}
window.toggleMobilePanel = toggleMobilePanel;

// Inject overlay if missing
(function ensureOverlay() {
  const setup = () => {
    if (!el$('panel-overlay')) {
      const ov = document.createElement('div');
      ov.id = 'panel-overlay';
      ov.className = 'panel-overlay';
      ov.onclick = toggleMobilePanel;
      document.body.appendChild(ov);
    }
  };
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', setup)
    : setup();
})();

// ─────────────────────────────────────────────────────────
// PHOTO UPLOAD
// ─────────────────────────────────────────────────────────

function onPhotoToggle(checked) {
  if (checked && !window.photoDataUrl) {
    el$('photo-file-input')?.click();
  } else {
    rerenderResume();
  }
}

function triggerPhotoUpload() { el$('photo-file-input')?.click(); }

function handlePhotoUpload(input) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    window.photoDataUrl = ev.target.result;
    const toggle = el$('photo-toggle');
    if (toggle) toggle.checked = true;
    rerenderResume();
    scheduleAutoSave();
  };
  reader.readAsDataURL(file);
}

window.onPhotoToggle     = onPhotoToggle;
window.triggerPhotoUpload = triggerPhotoUpload;
window.handlePhotoUpload  = handlePhotoUpload;

// ─────────────────────────────────────────────────────────
// COLOUR PICKER
// ─────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  '#2058e8','#1e293b','#059669','#991b1b','#4338ca',
  '#0d9488','#b45309','#7c3aed','#be123c','#475569',
  '#0284c7','#0f1f3d','#c2410c','#166534','#374151',
];

function initColorPicker() {
  const swatchHtml = COLOR_PRESETS.map(hex =>
    `<div class="color-swatch ${hex === window.ACCENT ? 'active' : ''}"
      data-hex="${hex}" style="background:${hex}"
      onclick="applyColor('${hex}')" title="${hex}"></div>`
  ).join('');

  ['color-swatches', 'style-swatches'].forEach(id => {
    const el = el$(id);
    if (el) el.innerHTML = swatchHtml;
  });

  ['color-input-top', 'custom-color-input'].forEach(id => {
    const el = el$(id);
    if (el) el.value = window.ACCENT;
  });
}

function applyColor(hex) {
  window.ACCENT = hex;
  initColorPicker();
  rerenderResume();
  scheduleAutoSave();
}
window.applyColor = applyColor;

function applyCustomColor(val) {
  if (/^#[0-9a-f]{6}$/i.test(val)) applyColor(val);
}
window.applyCustomColor = applyCustomColor;

// ─────────────────────────────────────────────────────────
// FONT PICKER
// ─────────────────────────────────────────────────────────

const FONTS = [
  { id:'dm-sans',     name:'DM Sans',         css:"'DM Sans',system-ui,sans-serif",           gUrl:'DM+Sans:wght@400;500;600;700' },
  { id:'syne',        name:'Syne',            css:"'Syne',system-ui,sans-serif",              gUrl:'Syne:wght@400;600;700;800' },
  { id:'merriweather',name:'Merriweather',    css:"'Merriweather',Georgia,serif",             gUrl:'Merriweather:wght@300;400;700' },
  { id:'playfair',    name:'Playfair Display',css:"'Playfair Display',Georgia,serif",         gUrl:'Playfair+Display:wght@400;600;700' },
  { id:'georgia',     name:'Georgia',         css:"Georgia,'Times New Roman',serif",          gUrl:null },
  { id:'jetbrains',   name:'JetBrains Mono',  css:"'JetBrains Mono',monospace",              gUrl:'JetBrains+Mono:wght@400;500' },
];

function initFontPicker() {
  const el = el$('font-list');
  if (!el) return;
  el.innerHTML = FONTS.map(f => `
    <div class="font-opt ${currentFont === f.id ? 'active' : ''}"
      onclick="setFont('${f.id}')" style="font-family:${f.css}">
      <span>${f.name}</span>
      <span style="font-size:0.67rem;color:var(--text4);font-weight:400">
        ${f.css.split(',')[0].replace(/'/g, '')}
      </span>
    </div>`).join('');
}

function setFont(id) {
  currentFont = id;
  const f = FONTS.find(x => x.id === id);
  if (!f) return;
  const paper = el$('resume-paper');
  if (paper) paper.style.fontFamily = f.css;
  if (f.gUrl) {
    const existing = document.getElementById('dyn-font-link');
    const link = existing || document.createElement('link');
    link.id   = 'dyn-font-link';
    link.rel  = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${f.gUrl}&display=swap`;
    if (!existing) document.head.appendChild(link);
  }
  initFontPicker();
  scheduleAutoSave();
}

function setFontScale(scale, btn) {
  fontScale = scale;
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const paper = el$('resume-paper');
  if (paper) paper.style.fontSize = scale + 'em';
  scheduleAutoSave();
}

window.setFont      = setFont;
window.setFontScale = setFontScale;

// ─────────────────────────────────────────────────────────
// STYLE TAB — HEADER FIELD SYNC
// ─────────────────────────────────────────────────────────

function syncStyleFields() {
  if (!window.currentData) return;
  const d   = window.currentData;
  const set = (id, val) => { const el = el$(id); if (el) el.value = val || ''; };
  set('hdr-name',     d.name);
  set('hdr-role',     d.target_role);
  set('hdr-email',    d.email);
  set('hdr-phone',    d.phone);
  set('hdr-linkedin', d.linkedin);
  set('hdr-github',   d.github);
  set('hdr-location', d.location);
}

function updateHeader() {
  if (!window.currentData) return;
  const g = id => el$(id)?.value || '';
  Object.assign(window.currentData, {
    name:        g('hdr-name'),
    target_role: g('hdr-role'),
    email:       g('hdr-email'),
    phone:       g('hdr-phone'),
    linkedin:    g('hdr-linkedin'),
    github:      g('hdr-github'),
    location:    g('hdr-location'),
  });
  rerenderResume();
  scheduleAutoSave();
}
window.updateHeader = updateHeader;

// ─────────────────────────────────────────────────────────
// INLINE EDIT HANDLERS (invoked from templates.js HTML)
// ─────────────────────────────────────────────────────────

window.handleEdit = function(field, secId, entryId, bulIdx, value) {
  if (!window.currentData?.sections) return;
  const sec = window.currentData.sections.find(s => s.id === secId);
  if (!sec) return;

  if (field === 'summary') {
    sec.summary_text = value;
  } else {
    const en = sec.entries?.find(e => e.id === entryId);
    if (!en) return;
    if      (field === 'title')    en.title = value;
    else if (field === 'subtitle') en.subtitle = value;
    else if (field === 'date') {
      const parts = value.split(/\s*[–\-]\s*/);
      en.date_start = parts[0]?.trim() || '';
      en.date_end   = parts[1]?.trim() || '';
    } else if (field === 'bullet' && bulIdx >= 0 && en.bullets) {
      en.bullets[bulIdx] = value;
    }
  }
  scheduleAutoSave();
};

window.updateSecTitle = function(secId, val) {
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (sec) { sec.title = val; scheduleAutoSave(); }
};

window.updateSkillGroup = function(secId, catKey, newVal, which) {
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  const grp = sec?.skill_groups?.find(g => g.category === catKey);
  if (!grp) return;
  if (which === 'skills')  grp.skills   = newVal.split(',').map(s => s.trim()).filter(Boolean);
  else if (which === 'cat') grp.category = newVal;
  scheduleAutoSave();
};

// ── Skill bars ───────────────────────────────────────────
window.setSkillBarLevel = function(secId, idx, e) {
  const sec  = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec?.skills) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct  = Math.max(5, Math.min(100, Math.round(((e.clientX - rect.left) / rect.width) * 100)));
  sec.skills[idx].level = pct;
  rerenderResume();
  scheduleAutoSave();
};
window.editSkillBarName = function(secId, idx, val) {
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (sec?.skills?.[idx]) { sec.skills[idx].name = val; scheduleAutoSave(); }
};
window.addSkillBar = function(secId) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec) return;
  (sec.skills = sec.skills || []).push({ name:'New Skill', level:75 });
  rerenderResume(); scheduleAutoSave();
};
window.delSkillBar = function(secId, idx) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  sec?.skills?.splice(idx, 1);
  rerenderResume(); scheduleAutoSave();
};

// ── Skill dots ───────────────────────────────────────────
window.setSkillDotLevel = function(secId, idx, level) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (sec?.skills?.[idx]) { sec.skills[idx].level = level; rerenderResume(); scheduleAutoSave(); }
};
window.editSkillDotName = function(secId, idx, val) {
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (sec?.skills?.[idx]) { sec.skills[idx].name = val; scheduleAutoSave(); }
};
window.addSkillDot = function(secId) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec) return;
  (sec.skills = sec.skills || []).push({ name:'New Skill', level:3 });
  rerenderResume(); scheduleAutoSave();
};
window.delSkillDot = function(secId, idx) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  sec?.skills?.splice(idx, 1);
  rerenderResume(); scheduleAutoSave();
};

// ── Skill tags ───────────────────────────────────────────
window.editTag = function(secId, idx, val) {
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (sec?.tags?.[idx] !== undefined) { sec.tags[idx] = val; scheduleAutoSave(); }
};
window.addTag = function(secId) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec) return;
  (sec.tags = sec.tags || []).push('New Tag');
  rerenderResume(); scheduleAutoSave();
};
window.delTag = function(secId, idx) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  sec?.tags?.splice(idx, 1);
  rerenderResume(); scheduleAutoSave();
};

// ── AI enhance skill / tag ───────────────────────────────
window.enhanceSkillItem = async function(secId, idx, type, btn) {
  const sec  = window.currentData?.sections?.find(s => s.id === secId);
  const name = (type === 'bar' || type === 'dot') ? sec?.skills?.[idx]?.name : sec?.tags?.[idx];
  if (!name) return;
  const orig = btn.innerHTML;
  btn.innerHTML = '⟳'; btn.disabled = true;
  try {
    const res  = await fetch('/resume/api/enhance-bullet/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body: JSON.stringify({ bullet:`Skill: ${name}`, context:`Skill for ${window.currentData?.target_role||'professional'}` }),
    });
    const data = await res.json();
    if (data.success && data.improved) {
      const cleaned = data.improved.replace(/^skill:\s*/i,'').replace(/^[•▸\-]\s*/,'').trim();
      pushUndo();
      if ((type==='bar'||type==='dot') && sec?.skills?.[idx]) sec.skills[idx].name = cleaned;
      else if (type==='tag' && sec?.tags?.[idx]!==undefined) sec.tags[idx] = cleaned;
      rerenderResume(); scheduleAutoSave();
      showToast('Skill updated!', 'success');
    }
  } catch { /* silent */ }
  finally { btn.innerHTML = orig; btn.disabled = false; }
};

// ─────────────────────────────────────────────────────────
// TABLE OPERATIONS
// ─────────────────────────────────────────────────────────

window.tableCellEdit    = function(secId, ri, ci, val) {
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (sec?.tableData?.rows?.[ri]) { sec.tableData.rows[ri][ci] = val; scheduleAutoSave(); }
};
window.tableAddRow     = function(secId) { pushUndo(); const s=_tbl(secId); if(!s)return; s.rows.push(Array(s.colWidths.length).fill('')); rerenderResume(); scheduleAutoSave(); };
window.tableDelRow     = function(secId) { pushUndo(); const s=_tbl(secId); if(!s||s.rows.length<=1)return; s.rows.pop(); rerenderResume(); scheduleAutoSave(); };
window.tableAddCol     = function(secId) { pushUndo(); const s=_tbl(secId); if(!s)return; const n=s.colWidths.length; s.colWidths=Array(n+1).fill(Math.floor(100/(n+1))); s.rows=s.rows.map(r=>[...r,'']); rerenderResume(); scheduleAutoSave(); };
window.tableDelCol     = function(secId) { pushUndo(); const s=_tbl(secId); if(!s||s.colWidths.length<=1)return; s.colWidths.pop(); s.rows=s.rows.map(r=>{r.pop();return r;}); rerenderResume(); scheduleAutoSave(); };
window.tableToggleHeader = function(secId) { pushUndo(); const s=_tbl(secId); if(s){s.hasHeader=!s.hasHeader; rerenderResume(); scheduleAutoSave();} };

function _tbl(secId) {
  return window.currentData?.sections?.find(s => s.id === secId)?.tableData;
}

// Column resize via drag
let _resizing = null;
window.tableStartResize = function(e, secId, ci) {
  e.preventDefault();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec?.tableData) return;
  _resizing = { secId, ci, startX: e.clientX, startWidths: [...sec.tableData.colWidths] };

  const onMove = ev => {
    if (!_resizing) return;
    const dx   = ev.clientX - _resizing.startX;
    const tbl  = document.querySelector(`[data-tbl-id="${_resizing.secId}"]`);
    if (!tbl) return;
    const dPct = (dx / tbl.offsetWidth) * 100;
    const s2   = window.currentData?.sections?.find(s => s.id === _resizing.secId);
    if (!s2?.tableData) return;
    const nw = [..._resizing.startWidths];
    const ni = _resizing.ci + 1;
    if (ni >= nw.length) return;
    nw[_resizing.ci] = Math.max(8, _resizing.startWidths[_resizing.ci] + dPct);
    nw[ni]           = Math.max(8, _resizing.startWidths[ni] - dPct);
    s2.tableData.colWidths = nw;
    tbl.querySelectorAll('col').forEach((c, i) => { c.style.width = nw[i] + '%'; });
  };
  const onUp = () => {
    _resizing = null;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    scheduleAutoSave();
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
};

// ─────────────────────────────────────────────────────────
// ADD SECTIONS
// ─────────────────────────────────────────────────────────

const SECTION_DEFS = {
  summary:       () => ({ id:uid(),type:'summary',title:'PROFESSIONAL SUMMARY',order:0,summary_text:'Results-driven professional with a proven track record. Click to edit.' }),
  objective:     () => ({ id:uid(),type:'objective',title:'CAREER OBJECTIVE',order:0,summary_text:'Motivated professional seeking to leverage skills in a challenging new role. Click to edit.' }),
  experience:    () => ({ id:uid(),type:'experience',title:'EXPERIENCE',order:0,entries:[{id:euid(),title:'Job Title',subtitle:'Company Name',location:'City',date_start:'Jan 2024',date_end:'Present',bullets:['Quantify impact — e.g. "Reduced latency by 40%, serving 100K daily users"','Led cross-functional team to deliver project 2 weeks early','Click any bullet to edit with a strong action verb']}] }),
  education:     () => ({ id:uid(),type:'education',title:'EDUCATION',order:0,entries:[{id:euid(),title:'Degree Programme',subtitle:'University Name',location:'City',date_start:'Sep 2020',date_end:'Jun 2024',bullets:['GPA — include only if 3.5+/4.0 or 8.5+/10','Relevant coursework, honours, or thesis topic']}] }),
  projects:      () => ({ id:uid(),type:'projects',title:'PROJECTS',order:0,entries:[{id:euid(),title:'Project Name',subtitle:'React · Node.js · PostgreSQL',date_start:'Jan 2024',date_end:'Mar 2024',bullets:['Built and deployed full-stack app serving X active users','Improved performance by Y% through algorithmic optimisation','github.com/yourname/project']}] }),
  certifications:() => ({ id:uid(),type:'certifications',title:'CERTIFICATIONS',order:0,entries:[{id:euid(),title:'Certification Name',subtitle:'Issuing Organisation',date_start:'2024',date_end:'No Expiry',bullets:['Credential ID: add here']}] }),
  skills:        () => ({ id:uid(),type:'skills',title:'SKILLS',order:0,skill_groups:[{category:'Languages',skills:['Python','JavaScript','Java']},{category:'Frameworks',skills:['React','Django','Node.js']},{category:'Tools',skills:['Git','Docker','AWS']}] }),
  'skills-bars': () => ({ id:uid(),type:'skills-bars',title:'SKILLS',order:0,skills:[{name:'Python',level:90},{name:'JavaScript',level:82},{name:'React',level:78},{name:'Django',level:85},{name:'SQL',level:74}] }),
  'skills-tags': () => ({ id:uid(),type:'skills-tags',title:'TECHNOLOGIES',order:0,tags:['Python','JavaScript','React','Django','PostgreSQL','Docker','AWS','Git'] }),
  'skills-dots': () => ({ id:uid(),type:'skills-dots',title:'COMPETENCIES',order:0,skills:[{name:'Problem Solving',level:5},{name:'Communication',level:4},{name:'Team Leadership',level:4},{name:'Project Management',level:3}] }),
  languages:     () => ({ id:uid(),type:'languages',title:'LANGUAGES',order:0,entries:[{id:euid(),title:'English',subtitle:'Native'},{id:euid(),title:'Hindi',subtitle:'Professional'}] }),
  achievements:  () => ({ id:uid(),type:'achievements',title:'ACHIEVEMENTS',order:0,entries:[{id:euid(),title:'Award / Achievement',subtitle:'Organisation',date_start:'2024',bullets:['Describe the award and your accomplishment']}] }),
  hobbies:       () => ({ id:uid(),type:'custom-text',title:'HOBBIES & INTERESTS',order:0,summary_text:'Photography, hiking, open-source contributions — click to edit.' }),
  volunteer:     () => ({ id:uid(),type:'experience',title:'VOLUNTEER WORK',order:0,entries:[{id:euid(),title:'Volunteer Role',subtitle:'Organisation',date_start:'2023',date_end:'Present',bullets:['Describe your contribution and impact']}] }),
  references:    () => ({ id:uid(),type:'custom-text',title:'REFERENCES',order:0,summary_text:'Available upon request.' }),
  'custom-text': () => ({ id:uid(),type:'custom-text',title:'CUSTOM SECTION',order:0,summary_text:'Click here to write your custom content.' }),
  table:         () => ({ id:uid(),type:'table',title:'TABLE SECTION',order:0,tableData:{hasHeader:true,colWidths:[34,33,33],rows:[['Column A','Column B','Column C'],['Row 1A','Row 1B','Row 1C'],['Row 2A','Row 2B','Row 2C']]} }),
};

function addSection(type) {
  if (!window.currentData) window.currentData = { sections:[], layout_config:{} };
  pushUndo();
  const defFn = SECTION_DEFS[type];
  if (!defFn) return;
  const sec = defFn();
  sec.order = maxOrder() + 1;
  window.currentData.sections = [...(window.currentData.sections || []), sec];
  showResumePaper();
  rerenderResume();
  scheduleAutoSave();
  showToast(`${sec.title} section added — click to edit`, 'success');
  switchPanelTab('generate');
}
window.addSection = addSection;

function addCustomSection(contentType) {
  const titleEl  = el$('new-sec-title');
  const rawTitle = (titleEl?.value?.trim() || 'CUSTOM SECTION').toUpperCase();
  if (!window.currentData) window.currentData = { sections:[], layout_config:{} };
  pushUndo();
  const id = uid(), order = maxOrder() + 1;
  let sec;
  switch (contentType) {
    case 'text':
      sec = { id, type:'custom-text', title:rawTitle, order, summary_text:'Click to write your content here.' };
      break;
    case 'bullets':
      sec = { id, type:'experience', title:rawTitle, order, entries:[{id:euid(),title:'Sub-heading',subtitle:'',bullets:['First point','Second point']}] };
      break;
    case 'table':
      sec = { id, type:'table', title:rawTitle, order, tableData:{hasHeader:true,colWidths:[50,50],rows:[['Header 1','Header 2'],['Row 1','Row 2']]} };
      break;
    default:
      sec = { id, type:'custom-text', title:rawTitle, order, summary_text:'Your content here.' };
  }
  window.currentData.sections.push(sec);
  if (titleEl) titleEl.value = '';
  showResumePaper();
  rerenderResume();
  scheduleAutoSave();
  showToast(`${rawTitle} added`, 'success');
}
window.addCustomSection = addCustomSection;

function addDivider(style) {
  if (!window.currentData) window.currentData = { sections:[], layout_config:{} };
  pushUndo();
  window.currentData.sections.push({ id:uid(), type:'divider', style, order:maxOrder()+1 });
  showResumePaper();
  rerenderResume();
  scheduleAutoSave();
}
window.addDivider = addDivider;

// ─────────────────────────────────────────────────────────
// SECTION CONTROLS
// ─────────────────────────────────────────────────────────

window.deleteSection = function(secId) {
  pushUndo();
  window.currentData.sections = window.currentData.sections.filter(s => s.id !== secId);
  rerenderResume();
  scheduleAutoSave();
};

window.moveSection = function(secId, dir) {
  const secs = [...window.currentData.sections].sort((a,b) => (a.order||0) - (b.order||0));
  const idx  = secs.findIndex(s => s.id === secId);
  const si   = idx + dir;
  if (si < 0 || si >= secs.length) return;
  pushUndo();
  const tmp = secs[idx].order;
  secs[idx].order = secs[si].order;
  secs[si].order  = tmp;
  window.currentData.sections = secs;
  rerenderResume();
  scheduleAutoSave();
};

// ─────────────────────────────────────────────────────────
// DRAG & DROP SECTIONS
// ─────────────────────────────────────────────────────────

let dragSrcId = null;

function initDragSections() {
  document.querySelectorAll('[data-sec-id]').forEach(el => {
    const handle = el.querySelector('.sec-drag-handle');
    if (!handle) return;

    handle.setAttribute('draggable', 'true');

    handle.addEventListener('dragstart', ev => {
      dragSrcId = el.getAttribute('data-sec-id');
      ev.dataTransfer.effectAllowed = 'move';
      ev.dataTransfer.setData('text/plain', dragSrcId);
      setTimeout(() => el.classList.add('dragging'), 0);
    });

    handle.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      document.querySelectorAll('[data-sec-id]').forEach(x => x.classList.remove('drag-over'));
      dragSrcId = null;
    });

    el.addEventListener('dragover', ev => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('[data-sec-id]').forEach(x => x.classList.remove('drag-over'));
      if (el.getAttribute('data-sec-id') !== dragSrcId) el.classList.add('drag-over');
    });

    el.addEventListener('dragleave', ev => {
      if (!el.contains(ev.relatedTarget)) el.classList.remove('drag-over');
    });

    el.addEventListener('drop', ev => {
      ev.preventDefault();
      el.classList.remove('drag-over');
      const targetId = el.getAttribute('data-sec-id');
      if (!dragSrcId || !targetId || dragSrcId === targetId) return;
      pushUndo();
      const s1 = window.currentData.sections.find(s => s.id === dragSrcId);
      const s2 = window.currentData.sections.find(s => s.id === targetId);
      if (s1 && s2) {
        const tmp = s1.order; s1.order = s2.order; s2.order = tmp;
        rerenderResume();
        scheduleAutoSave();
      }
    });
  });
}
window.initDragSections = initDragSections;

// ─────────────────────────────────────────────────────────
// BULLET ENTRY OPERATIONS
// ─────────────────────────────────────────────────────────

window.addBullet = function(secId, entryId) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  const en  = sec?.entries?.find(e => e.id === entryId);
  if (!en) return;
  (en.bullets = en.bullets || []).push('New bullet point — click to edit');
  rerenderResume(); scheduleAutoSave();
};

window.deleteBullet = function(secId, entryId, bulIdx) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  const en  = sec?.entries?.find(e => e.id === entryId);
  if (!en?.bullets) return;
  en.bullets.splice(bulIdx, 1);
  rerenderResume(); scheduleAutoSave();
};

window.addEntry = function(secId) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec) return;
  (sec.entries = sec.entries || []).push({ id:euid(), title:'New Entry', subtitle:'', bullets:['Add details here'] });
  rerenderResume(); scheduleAutoSave();
};

window.deleteEntry = function(secId, entryId) {
  pushUndo();
  const sec = window.currentData?.sections?.find(s => s.id === secId);
  if (!sec?.entries) return;
  sec.entries = sec.entries.filter(e => e.id !== entryId);
  rerenderResume(); scheduleAutoSave();
};

// ── AI Enhance Bullet ────────────────────────────────────
window.enhanceBullet = async function(secId, entryId, bulIdx, btn) {
  const sec    = window.currentData?.sections?.find(s => s.id === secId);
  const en     = sec?.entries?.find(e => e.id === entryId);
  const bullet = en?.bullets?.[bulIdx];
  if (!bullet) return;

  const orig = btn.innerHTML;
  btn.innerHTML = '⟳'; btn.disabled = true;

  try {
    const res  = await fetch('/resume/api/enhance-bullet/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body: JSON.stringify({ bullet, context: `${en.title||''} at ${en.subtitle||''}` }),
    });
    const data = await res.json();
    if (data.success && data.improved) {
      pushUndo();
      en.bullets[bulIdx] = data.improved;
      rerenderResume();
      scheduleAutoSave();
      showToast('Bullet enhanced!', 'success');
    }
  } catch { /* silent */ }
  finally { btn.innerHTML = orig; btn.disabled = false; }
};

// ─────────────────────────────────────────────────────────
// AI GENERATE
// ─────────────────────────────────────────────────────────

async function generateResume() {
  const rawData = el$('raw-data')?.value?.trim();
  if (!rawData) {
    showToast('Paste your career data first.', 'error');
    el$('raw-data')?.focus();
    return;
  }

  setBtnLoading('generate-btn', true);
  setBtnLoading('mobile-generate-btn', true);

  const progress = el$('gen-progress');
  if (progress) progress.classList.add('visible');

  const previewEmpty = el$('preview-empty');
  if (previewEmpty) previewEmpty.style.display = 'none';

  // Animate progress steps
  const steps = document.querySelectorAll('.progress-step');
  let si = 0;
  const iv = setInterval(() => {
    steps.forEach((s, i) => {
      s.classList.remove('active', 'done');
      if (i < si)  s.classList.add('done');
      if (i === si) s.classList.add('active');
    });
    if (si < steps.length - 1) si++;
  }, 700);

  try {
    const res  = await fetch('/resume/api/generate/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body: JSON.stringify({
        raw_data:        rawData,
        job_description: el$('job-desc')?.value?.trim() || '',
        country:         el$('sel-country')?.value || 'India',
        role:            el$('sel-role')?.value || 'Software Engineer',
        resume_id:       currentResumeId || null,
      }),
    });
    const data = await res.json();
    clearInterval(iv);

    if (!res.ok || !data.success) throw new Error(data.message || 'Generation failed.');

    steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
    currentResumeId = data.resume_id;

    if (data.data?.layout_config?.accent_color) {
      window.ACCENT = data.data.layout_config.accent_color;
    }

    showActionBtns();
    initColorPicker();

    setTimeout(() => {
      if (progress) progress.classList.remove('visible');
      streamRevealResume(data.data);
      updateScores(data.data.ats_score || 0, data.data.ai_confidence || 0);
      syncStyleFields();
      undoStack.length = 0; redoStack.length = 0; refreshUndoBtns();
      showToast('Resume generated! Click any text to edit.', 'success');
    }, 400);

  } catch (err) {
    clearInterval(iv);
    if (progress) progress.classList.remove('visible');
    if (!window.currentData && previewEmpty) previewEmpty.style.display = 'flex';
    showToast(err.message, 'error');
  } finally {
    setBtnLoading('generate-btn', false);
    setBtnLoading('mobile-generate-btn', false);
  }
}
window.generateResume = generateResume;

// ─────────────────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────────────────

function showResumePaper() {
  const wrap  = el$('resume-paper-wrap');
  const empty = el$('preview-empty');
  if (wrap)  wrap.style.display  = 'block';
  if (empty) empty.style.display = 'none';
}

function renderResume(data, animate = true) {
  window.currentData = data;
  if (data?.layout_config?.accent_color) window.ACCENT = data.layout_config.accent_color;
  showResumePaper();
  initColorPicker();
  initFontPicker();

  const tpl = window.ACTIVE_TPL || (typeof TEMPLATES !== 'undefined' ? TEMPLATES[0] : null);
  if (!tpl) return;
  window.ACTIVE_TPL = tpl;

  const content = el$('rp-content');
  if (!content) return;

  if (animate) {
    content.style.transition = 'opacity 0.18s ease';
    content.style.opacity    = '0.3';
    setTimeout(() => {
      content.innerHTML = tpl.render(data, window.ACCENT);
      content.style.opacity = '1';
      initDragSections();
    }, 150);
  } else {
    content.innerHTML = tpl.render(data, window.ACCENT);
    initDragSections();
  }
}

function rerenderResume() {
  if (!window.currentData || !window.ACTIVE_TPL) return;
  const content = el$('rp-content');
  if (!content) return;
  content.innerHTML = window.ACTIVE_TPL.render(window.currentData, window.ACCENT);
  initDragSections();
}
window.rerenderResume = rerenderResume;

// Streaming reveal — staggered section animation
function streamRevealResume(data) {
  window.currentData = data;
  showResumePaper();
  initColorPicker();
  initFontPicker();

  const tpl = window.ACTIVE_TPL || (typeof TEMPLATES !== 'undefined' ? TEMPLATES[0] : null);
  if (!tpl) { renderResume(data, true); return; }
  window.ACTIVE_TPL = tpl;

  const content = el$('rp-content');
  if (!content) return;

  content.innerHTML = tpl.render(data, window.ACCENT);
  initDragSections();

  // Animate sections in
  const secs = content.querySelectorAll('[data-sec-id]');
  secs.forEach((sec, i) => {
    sec.style.opacity   = '0';
    sec.style.transform = 'translateY(10px)';
    sec.style.transition = `opacity 0.3s ease ${i * 80}ms, transform 0.3s ease ${i * 80}ms`;
    setTimeout(() => {
      sec.style.opacity   = '1';
      sec.style.transform = 'translateY(0)';
    }, 50 + i * 80);
  });
}

// Start from blank template
function startFromTemplate() {
  if (typeof getSkeletonData !== 'function') return;
  window.currentData = getSkeletonData();
  window.ACCENT = '#2058e8';
  renderResume(window.currentData, true);
  showActionBtns();
  syncStyleFields();
  initColorPicker();
  initFontPicker();
  undoStack.length = 0; redoStack.length = 0; refreshUndoBtns();
  showToast('Ready! Click any text to edit.', 'info');
  switchPanelTab('elements');
}
window.startFromTemplate = startFromTemplate;

function showActionBtns() {
  ['save-btn','version-btn'].forEach(id => {
    const el = el$(id);
    if (el) el.style.display = '';
  });
  const eb = el$('export-btn');
  if (eb) {
    eb.style.display = '';
    if (currentResumeId) eb.href = `/resume/api/export/${currentResumeId}/`;
  }
}

function updateScores(ats, ai) {
  const chips = el$('score-chips');
  if (chips) chips.style.display = 'flex';
  const atsEl = el$('ats-score-val');
  const aiEl  = el$('ai-score-val');
  if (atsEl) atsEl.textContent = ats;
  if (aiEl)  aiEl.textContent  = ai;
  setTimeout(() => {
    const atsBar = el$('ats-bar');
    const aiBar  = el$('ai-bar');
    if (atsBar) atsBar.style.width = ats + '%';
    if (aiBar)  aiBar.style.width  = ai + '%';
  }, 120);
}

// ─────────────────────────────────────────────────────────
// AI CHAT
// ─────────────────────────────────────────────────────────

function toggleChat() {
  chatOpen = !chatOpen;
  el$('chat-panel')?.classList.toggle('open', chatOpen);
  if (chatOpen) setTimeout(() => el$('chat-input')?.focus(), 300);
}
window.toggleChat = toggleChat;

function chatQ(msg) {
  const input = el$('chat-input');
  if (!input) return;
  input.value = msg;
  sendChat();
}
window.chatQ = chatQ;

async function sendChat() {
  const input = el$('chat-input');
  const msg   = input?.value?.trim();
  if (!msg) return;

  if (!window.currentData) {
    showToast('Generate a resume first.', 'error');
    return;
  }

  appendChatMsg(msg, 'user');
  input.value = '';
  el$('chat-send-btn').disabled = true;

  const typId = 'typ-' + Date.now();
  appendChatMsg(null, 'ai', typId, true);

  try {
    const res  = await fetch('/resume/api/chat/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body: JSON.stringify({
        message:      msg,
        current_data: window.currentData,
        resume_id:    currentResumeId,
      }),
    });
    const data = await res.json();
    el$(typId)?.remove();

    if (data.success) {
      appendChatMsg(data.reply || 'Done! Resume updated.', 'ai');
      pushUndo();
      window.currentData = data.data;
      syncStyleFields();

      const content = el$('rp-content');
      const tpl = window.ACTIVE_TPL || TEMPLATES[0];
      content.style.transition = 'opacity 0.15s ease';
      content.style.opacity    = '0.3';
      setTimeout(() => {
        content.innerHTML = tpl.render(window.currentData, window.ACCENT);
        content.style.opacity = '1';
        initDragSections();
      }, 150);

      if (data.data.ats_score) updateScores(data.data.ats_score, data.data.ai_confidence || 0);
      scheduleAutoSave();
    } else {
      appendChatMsg('Sorry — ' + (data.message || 'something went wrong.'), 'ai');
    }
  } catch {
    el$(typId)?.remove();
    appendChatMsg('Network error. Please try again.', 'ai');
  } finally {
    el$('chat-send-btn').disabled = false;
  }
}
window.sendChat = sendChat;

function appendChatMsg(text, role, id, typing = false) {
  const c = el$('chat-msgs');
  if (!c) return;
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg-${role === 'user' ? 'user' : 'ai'}`;
  if (id) div.id = id;
  const safe = text ? text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : '';
  div.innerHTML = typing
    ? '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>'
    : safe;
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

// ─────────────────────────────────────────────────────────
// AUTO-SAVE & MANUAL SAVE
// ─────────────────────────────────────────────────────────

function scheduleAutoSave() {
  isDirty = true;
  setSaveStatus('saving');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveResume(true), 2400);
}
window.scheduleAutoSave = scheduleAutoSave;

function setSaveStatus(status) {
  const txt  = el$('save-status-text');
  const dot  = el$('save-status-dot');
  if (!txt) return;
  const labels = { saving:'Saving…', saved:'Saved', error:'Save failed' };
  txt.textContent = labels[status] || '';
  if (dot) {
    dot.className = 'save-dot';
    if (status === 'saved') dot.classList.add('saved');
    if (status === 'error') dot.classList.add('error');
  }
}

async function saveResume(silent = false) {
  if (!window.currentData) return;

  // Auto-create if no server record yet
  if (!currentResumeId) {
    try {
      const res  = await fetch('/resume/api/create/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
        body: JSON.stringify({
          title:           window.currentData.name ? `${window.currentData.name} — Resume` : 'My Resume',
          target_role:     window.currentData.target_role || '',
          country:         window.currentData.country || 'India',
          raw_data:        el$('raw-data')?.value || '',
          job_description: el$('job-desc')?.value || '',
        }),
      });
      const r = await res.json();
      if (r.success) {
        currentResumeId = r.resume_id;
        history.replaceState({}, '', `/resume/builder/${currentResumeId}/`);
        showActionBtns();
      }
    } catch { /* ignore */ }
  }

  if (!currentResumeId) return;

  try {
    const res = await fetch(`/resume/api/save/${currentResumeId}/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': CSRF() },
      body: JSON.stringify({
        generated_data:  window.currentData,
        raw_data:        el$('raw-data')?.value || '',
        job_description: el$('job-desc')?.value || '',
      }),
    });
    const r = await res.json();
    if (r.success) {
      isDirty = false;
      setSaveStatus('saved');
      if (!silent) showToast('Saved.', 'success');
    } else {
      setSaveStatus('error');
    }
  } catch {
    setSaveStatus('error');
    if (!silent) showToast('Save failed.', 'error');
  }
}
window.saveResume = saveResume;

// ─────────────────────────────────────────────────────────
// PDF EXPORT (print window)
// ─────────────────────────────────────────────────────────

function handleExport(ev) {
  if (ev) ev.preventDefault();
  const content = el$('rp-content');
  if (!content || !window.currentData) { showToast('Generate a resume first.', 'error'); return false; }

  const name    = window.currentData.name || 'Resume';
  const fontObj = FONTS.find(f => f.id === currentFont) || FONTS[0];
  const gLink   = fontObj.gUrl
    ? `<link href="https://fonts.googleapis.com/css2?family=${fontObj.gUrl}&display=swap" rel="stylesheet">`
    : '';

  const win = window.open('', '_blank');
  if (!win) { showToast('Allow popups to export PDF.', 'error'); return false; }

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${name} — Resume</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ${gLink}
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    html,body{background:white}
    body{
      font-family:${fontObj.css};
      font-size:${fontScale}em;
      color:#0f172a;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .resume-wrap{width:210mm;min-height:297mm;padding:14mm 13mm;margin:0 auto;background:white}
    .sec-drag-handle,.sec-controls,.bullet-actions,.add-item-btn,.sec-ctrl-btn{display:none!important}
    [contenteditable]{outline:none!important;cursor:default!important}
    @media print{
      body{margin:0}
      .resume-wrap{width:100%;padding:10mm 12mm;min-height:unset}
    }
  </style>
</head>
<body>
  <div class="resume-wrap">
    ${content.innerHTML}
  </div>
  <script>
    window.onload=()=>{
      window.print();
      setTimeout(()=>window.close(),800);
    };
  <\/script>
</body>
</html>`);
  win.document.close();
  return false;
}
window.handleExport = handleExport;

// ─────────────────────────────────────────────────────────
// VERSION HISTORY
// ─────────────────────────────────────────────────────────

async function showVersionHistory() {
  if (!currentResumeId) { showToast('Save the resume first.', 'info'); return; }

  const modal = el$('version-modal');
  const list  = el$('version-list');
  if (!modal || !list) return;

  list.innerHTML = '<div style="padding:16px;color:var(--text4);font-size:0.85rem">Loading…</div>';
  modal.style.display = 'flex';

  try {
    const res  = await fetch(`/resume/api/versions/${currentResumeId}/`);
    const data = await res.json();
    if (!data.versions?.length) {
      list.innerHTML = '<div style="padding:16px;color:var(--text4);font-size:0.85rem">No versions yet.</div>';
      return;
    }
    list.innerHTML = data.versions.map(v => `
      <div class="version-item">
        <div>
          <div class="version-label">${v.label || 'Version ' + v.version_number}</div>
          <div class="version-date">${v.created_at}</div>
        </div>
        <button class="btn btn-sm btn-secondary"
          onclick="restoreVersion(${v.id})">Restore</button>
      </div>`).join('');
  } catch {
    list.innerHTML = '<div style="padding:16px;color:var(--red)">Failed to load.</div>';
  }
}
window.showVersionHistory = showVersionHistory;

async function restoreVersion(versionId) {
  if (!currentResumeId) return;
  try {
    const res  = await fetch(`/resume/api/restore/${currentResumeId}/${versionId}/`);
    const data = await res.json();
    if (data.success) {
      pushUndo();
      window.currentData = data.data;
      rerenderResume();
      syncStyleFields();
      closeModal('version-modal');
      showToast('Version restored.', 'success');
    }
  } catch {
    showToast('Restore failed.', 'error');
  }
}
window.restoreVersion = restoreVersion;

function closeModal(id) {
  const el = el$(id);
  if (el) el.style.display = 'none';
}
window.closeModal = closeModal;

// ─────────────────────────────────────────────────────────
// TEMPLATE PANEL
// ─────────────────────────────────────────────────────────

function toggleTemplatePanel() {
  const panel = el$('tpl-panel');
  panel?.classList.toggle('open');
}
window.toggleTemplatePanel = toggleTemplatePanel;

function selectTemplate(tplId) {
  if (typeof TEMPLATES === 'undefined') return;
  const tpl = TEMPLATES.find(t => t.id === tplId);
  if (!tpl) return;
  window.ACTIVE_TPL = tpl;
  document.querySelectorAll('.tpl-card').forEach(c => c.classList.toggle('active', c.dataset.tplId === tplId));
  if (window.currentData) rerenderResume();
  showToast(`Template: ${tpl.name}`, 'info');
}
window.selectTemplate = selectTemplate;

// ─────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ─────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return;

  if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  if (e.key === 'z' &&  e.shiftKey) { e.preventDefault(); redo(); }
  if (e.key === 'y')                { e.preventDefault(); redo(); }
  if (e.key === 's')                { e.preventDefault(); saveResume(false); }
});

// ─────────────────────────────────────────────────────────
// INIT ON DOM READY
// ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Load existing resume if editing
  if (window.RESUME_DATA) {
    renderResume(window.RESUME_DATA, false);
    showActionBtns();
    syncStyleFields();
    initColorPicker();
    initFontPicker();
    refreshUndoBtns();
  }

  // Set default template
  if (typeof TEMPLATES !== 'undefined' && TEMPLATES.length) {
    window.ACTIVE_TPL = TEMPLATES[0];
  }

  // Init pickers
  initColorPicker();
  initFontPicker();

  // Chat enter-to-send
  el$('chat-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  });

  // Warn on unload if dirty
  window.addEventListener('beforeunload', e => {
    if (isDirty) e.preventDefault();
  });
});
