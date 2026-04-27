/* =========================================================
   QuantumCV — templates.js v3
   20 resume templates, inline editing, skill variants,
   tables, drag handles, section controls.
   ========================================================= */
'use strict';

window.ACCENT      = window.ACCENT || '#2058e8';
window.ACTIVE_TPL  = null;
window.photoDataUrl = null;

// ─────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────

/** HTML-escape a value */
function e(s) {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

/** Contact chips joined by separator */
function contacts(data, sep = ' · ') {
  return ['email','phone','linkedin','github','location']
    .filter(f => data[f])
    .map(f => e(data[f]))
    .join(sep);
}

/** Photo placeholder or uploaded image */
function photoEl(style = '') {
  if (!document.getElementById('photo-toggle')?.checked) return '';
  const src = window.photoDataUrl;
  return `<div onclick="triggerPhotoUpload()" title="Click to change photo"
    style="width:68px;height:68px;border-radius:50%;overflow:hidden;cursor:pointer;
      flex-shrink:0;display:flex;align-items:center;justify-content:center;
      background:${src ? 'transparent' : '#f1f5f9'};border:2px solid #e2e8f0;${style}">
    ${src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover">`
      : `<span style="font-size:1.4rem">📷</span>`}
  </div>`;
}

/** Styled, editable section heading */
function secHead(title, ac, secId) {
  const handler = secId
    ? `oninput="typeof updateSecTitle!=='undefined'&&updateSecTitle('${secId}',this.textContent)"`
    : '';
  return `<div contenteditable="true" spellcheck="false" ${handler}
    style="font-size:0.67rem;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;
      color:${ac};border-bottom:1.5px solid ${ac}22;padding-bottom:3px;margin-bottom:8px;
      outline:none;border-radius:2px;cursor:text">${e(title)}</div>`;
}

/** Drag handle + move/delete controls */
function secCtrl(secId) {
  return `
  <div class="sec-drag-handle" title="Drag to reorder">
    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
      <circle cx="3" cy="2"  r="1.2" fill="currentColor"/>
      <circle cx="7" cy="2"  r="1.2" fill="currentColor"/>
      <circle cx="3" cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="7" cy="7"  r="1.2" fill="currentColor"/>
      <circle cx="3" cy="12" r="1.2" fill="currentColor"/>
      <circle cx="7" cy="12" r="1.2" fill="currentColor"/>
    </svg>
  </div>
  <div class="sec-controls">
    <button class="sec-ctrl-btn" onclick="typeof moveSection!=='undefined'&&moveSection('${secId}',-1)" title="Move up">▲</button>
    <button class="sec-ctrl-btn" onclick="typeof moveSection!=='undefined'&&moveSection('${secId}', 1)" title="Move down">▼</button>
    <button class="sec-ctrl-btn del" onclick="typeof deleteSection!=='undefined'&&deleteSection('${secId}')" title="Delete">✕</button>
  </div>`;
}

/** Single entry (experience / education / project) */
function entryHtml(en, ac, secId, compact = false) {
  const dateStr = [en.date_start, en.date_end].filter(Boolean).join(' – ');
  const fs  = compact ? '0.76' : '0.82';
  const bfs = compact ? '0.73' : '0.78';
  const mb  = compact ? '6px'  : '10px';

  return `<div style="margin-bottom:${mb}">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;min-width:0">
      <div contenteditable="true" spellcheck="false"
        style="font-size:${fs}rem;font-weight:700;color:#0f172a;flex:1;min-width:0;
          outline:none;border-radius:2px;word-break:break-word;cursor:text"
        oninput="typeof handleEdit!=='undefined'&&handleEdit('title','${secId}','${en.id}',-1,this.textContent)"
      >${e(en.title)}</div>
      <div contenteditable="true" spellcheck="false"
        style="font-size:0.69rem;color:#64748b;white-space:nowrap;flex-shrink:0;
          font-family:monospace;outline:none;border-radius:2px;cursor:text"
        oninput="typeof handleEdit!=='undefined'&&handleEdit('date','${secId}','${en.id}',-1,this.textContent)"
      >${e(dateStr)}</div>
    </div>
    ${en.subtitle ? `<div contenteditable="true" spellcheck="false"
      style="font-size:0.75rem;color:${ac};font-weight:600;margin:1px 0 3px;
        outline:none;border-radius:2px;word-break:break-word;cursor:text"
      oninput="typeof handleEdit!=='undefined'&&handleEdit('subtitle','${secId}','${en.id}',-1,this.textContent)"
    >${e(en.subtitle)}</div>` : ''}
    ${en.location ? `<div style="font-size:0.67rem;color:#94a3b8;margin-bottom:2px">📍 ${e(en.location)}</div>` : ''}
    ${(en.bullets || []).map((b, bi) => `
      <div style="display:flex;gap:5px;margin-bottom:2px;line-height:1.5;align-items:flex-start;position:relative"
        onmouseenter="this.querySelector('.bullet-actions').style.display='flex'"
        onmouseleave="this.querySelector('.bullet-actions').style.display='none'">
        <span style="color:${ac};flex-shrink:0;margin-top:3px;font-size:0.68rem">▸</span>
        <span contenteditable="true" spellcheck="false"
          style="flex:1;font-size:${bfs}rem;color:#334155;outline:none;border-radius:2px;
            word-break:break-word;cursor:text;line-height:1.55"
          oninput="typeof handleEdit!=='undefined'&&handleEdit('bullet','${secId}','${en.id}',${bi},this.textContent)"
        >${e(b)}</span>
        <div class="bullet-actions" style="display:none;gap:3px;flex-shrink:0;align-items:center">
          <button class="bullet-enhance-btn"
            onclick="typeof enhanceBullet!=='undefined'&&enhanceBullet('${secId}','${en.id}',${bi},this)">✦ AI</button>
        </div>
      </div>`).join('')}
    <div style="margin-top:3px">
      <button onclick="typeof addBullet!=='undefined'&&addBullet('${secId}','${en.id}')"
        class="add-item-btn" style="font-size:0.68rem;padding:2px 6px">+ bullet</button>
    </div>
  </div>`;
}

/** Skill groups (Category: skill1, skill2…) */
function skillGroupsHtml(sec, ac) {
  return (sec.skill_groups || []).map(g => `
    <div style="display:flex;gap:8px;margin-bottom:5px;align-items:flex-start;min-width:0">
      <div contenteditable="true" spellcheck="false"
        style="font-size:0.71rem;font-weight:700;color:#0f172a;min-width:70px;max-width:90px;
          flex-shrink:0;padding-top:1px;outline:none;border-radius:2px;cursor:text"
        oninput="typeof updateSkillGroup!=='undefined'&&updateSkillGroup('${sec.id}','${e(g.category)}',this.textContent,'cat')"
      >${e(g.category)}</div>
      <div contenteditable="true" spellcheck="false"
        style="font-size:0.73rem;color:#334155;line-height:1.6;flex:1;min-width:0;
          outline:none;border-radius:2px;cursor:text"
        oninput="typeof updateSkillGroup!=='undefined'&&updateSkillGroup('${sec.id}','${e(g.category)}',this.textContent,'skills')"
      >${e((g.skills || []).join(', '))}</div>
    </div>`).join('');
}

/** Summary / objective paragraph */
function summaryHtml(sec) {
  return `<p contenteditable="true" spellcheck="false"
    style="font-size:0.8rem;color:#334155;line-height:1.75;margin:0;
      outline:none;border-radius:2px;word-break:break-word;cursor:text;min-height:1.2em"
    oninput="typeof handleEdit!=='undefined'&&handleEdit('summary','${sec.id}',null,-1,this.textContent)"
  >${e(sec.summary_text || '')}</p>`;
}

/** Language entries */
function langHtml(sec) {
  return (sec.entries || []).map(en => `
    <div style="display:flex;justify-content:space-between;font-size:0.77rem;margin-bottom:3px;gap:8px">
      <span style="font-weight:600">${e(en.title)}</span>
      <span style="color:#64748b;flex-shrink:0">${e(en.subtitle || '')}</span>
    </div>`).join('');
}

/** Skill bars (horizontal progress bars) */
function skillBarsHtml(sec, ac) {
  return `<div style="display:flex;flex-direction:column;gap:7px">
    ${(sec.skills || []).map((s, i) => `
      <div class="rp-sbar-item">
        <div class="rp-sbar-row">
          <span class="rp-sbar-name" contenteditable="true" spellcheck="false"
            oninput="typeof editSkillBarName!=='undefined'&&editSkillBarName('${sec.id}',${i},this.textContent)"
          >${e(s.name)}</span>
          <div class="rp-sbar-right">
            <button class="skill-enhance-btn"
              onclick="typeof enhanceSkillItem!=='undefined'&&enhanceSkillItem('${sec.id}',${i},'bar',this)">✦</button>
            <span class="rp-sbar-pct">${s.level}%</span>
            <button onclick="typeof delSkillBar!=='undefined'&&delSkillBar('${sec.id}',${i})"
              style="font-size:.55rem;padding:1px 4px;border:1px solid #e2e8f0;
                border-radius:3px;background:none;cursor:pointer;color:#ef4444">✕</button>
          </div>
        </div>
        <div class="rp-sbar-track"
          onclick="typeof setSkillBarLevel!=='undefined'&&setSkillBarLevel('${sec.id}',${i},event)">
          <div class="rp-sbar-fill" style="width:${s.level}%;background:${ac}"></div>
        </div>
      </div>`).join('')}
    <button onclick="typeof addSkillBar!=='undefined'&&addSkillBar('${sec.id}')"
      class="add-item-btn">+ Add Skill</button>
  </div>`;
}

/** Skill dots (5-dot rating) */
function skillDotsHtml(sec, ac) {
  return `<div style="display:flex;flex-direction:column;gap:6px">
    ${(sec.skills || []).map((s, i) => `
      <div class="rp-sdot-item">
        <span class="rp-sdot-name" contenteditable="true" spellcheck="false"
          oninput="typeof editSkillDotName!=='undefined'&&editSkillDotName('${sec.id}',${i},this.textContent)"
        >${e(s.name)}</span>
        <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
          ${[1,2,3,4,5].map(d => `<div class="rp-dot ${s.level>=d?'filled':''}" style="color:${ac}"
            onclick="typeof setSkillDotLevel!=='undefined'&&setSkillDotLevel('${sec.id}',${i},${d})"></div>`).join('')}
          <button class="skill-enhance-btn"
            onclick="typeof enhanceSkillItem!=='undefined'&&enhanceSkillItem('${sec.id}',${i},'dot',this)">✦</button>
          <button onclick="typeof delSkillDot!=='undefined'&&delSkillDot('${sec.id}',${i})"
            style="font-size:.55rem;padding:1px 4px;border:1px solid #e2e8f0;
              border-radius:3px;background:none;cursor:pointer;color:#ef4444">✕</button>
        </div>
      </div>`).join('')}
    <button onclick="typeof addSkillDot!=='undefined'&&addSkillDot('${sec.id}')"
      class="add-item-btn">+ Add Skill</button>
  </div>`;
}

/** Skill tags (pill chips) */
function skillTagsHtml(sec, ac) {
  return `<div style="display:flex;flex-wrap:wrap;gap:6px">
    ${(sec.tags || []).map((tag, i) => `
      <div style="display:flex;align-items:center;gap:3px;background:${ac}15;
        border:1px solid ${ac}33;border-radius:20px;padding:3px 10px">
        <span contenteditable="true" spellcheck="false"
          style="font-size:0.72rem;font-weight:600;color:${ac};outline:none;cursor:text;min-width:20px"
          oninput="typeof editTag!=='undefined'&&editTag('${sec.id}',${i},this.textContent)"
        >${e(tag)}</span>
        <button onclick="typeof delTag!=='undefined'&&delTag('${sec.id}',${i})"
          style="font-size:.6rem;border:none;background:none;color:${ac};cursor:pointer;padding:0 2px;line-height:1">✕</button>
      </div>`).join('')}
    <button onclick="typeof addTag!=='undefined'&&addTag('${sec.id}')"
      style="font-size:0.72rem;padding:3px 10px;border:1.5px dashed ${ac}55;border-radius:20px;
        background:none;color:${ac};cursor:pointer;font-weight:600">+ Tag</button>
  </div>`;
}

/** Table section */
function tableHtml(sec, ac) {
  const td = sec.tableData || { hasHeader:true, colWidths:[50,50], rows:[['A','B'],['',''],['','']] };
  const cols = td.colWidths.map((w,i) => `<col style="width:${w}%">`).join('');
  const rows = td.rows.map((row, ri) => {
    const isHeader = td.hasHeader && ri === 0;
    const cells = row.map((cell, ci) => `
      <td style="padding:5px 8px;border:1px solid #e2e8f0;font-size:0.76rem;
        ${isHeader ? `background:${ac}18;font-weight:700;` : ''}
        position:relative;vertical-align:top">
        <span contenteditable="true" spellcheck="false" style="outline:none;display:block;cursor:text"
          oninput="typeof tableCellEdit!=='undefined'&&tableCellEdit('${sec.id}',${ri},${ci},this.textContent)"
        >${e(cell)}</span>
        ${ri === 0 && ci < row.length - 1
          ? `<div class="tbl-resize" onmousedown="typeof tableStartResize!=='undefined'&&tableStartResize(event,'${sec.id}',${ci})"
              style="position:absolute;right:-2px;top:0;bottom:0;width:4px;cursor:col-resize;z-index:2"></div>`
          : ''}
      </td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `<div>
    <table data-tbl-id="${sec.id}" style="width:100%;border-collapse:collapse">
      <colgroup>${cols}</colgroup>
      <tbody>${rows}</tbody>
    </table>
    <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap">
      <button onclick="typeof tableAddRow!=='undefined'&&tableAddRow('${sec.id}')" class="add-item-btn" style="flex:1">+ Row</button>
      <button onclick="typeof tableDelRow!=='undefined'&&tableDelRow('${sec.id}')" class="add-item-btn" style="flex:1">− Row</button>
      <button onclick="typeof tableAddCol!=='undefined'&&tableAddCol('${sec.id}')" class="add-item-btn" style="flex:1">+ Col</button>
      <button onclick="typeof tableDelCol!=='undefined'&&tableDelCol('${sec.id}')" class="add-item-btn" style="flex:1">− Col</button>
      <button onclick="typeof tableToggleHeader!=='undefined'&&tableToggleHeader('${sec.id}')" class="add-item-btn" style="flex:1">Header</button>
    </div>
  </div>`;
}

/** Dispatch section rendering by type */
function renderSection(sec, ac) {
  switch (sec.type) {
    case 'summary':
    case 'objective':
    case 'custom-text':
      return summaryHtml(sec);

    case 'skills':
      return skillGroupsHtml(sec, ac);

    case 'skills-bars':
      return skillBarsHtml(sec, ac);

    case 'skills-dots':
      return skillDotsHtml(sec, ac);

    case 'skills-tags':
      return skillTagsHtml(sec, ac);

    case 'languages':
      return langHtml(sec);

    case 'table':
      return tableHtml(sec, ac);

    case 'divider':
      return dividerHtml(sec.style, ac);

    default:
      // experience, education, projects, certifications, achievements, volunteer, publications…
      return `<div>${(sec.entries || []).map(en => entryHtml(en, ac, sec.id)).join('')}</div>
        <button onclick="typeof addEntry!=='undefined'&&addEntry('${sec.id}')"
          class="add-item-btn" style="margin-top:4px">+ Add Entry</button>`;
  }
}

function dividerHtml(style, ac) {
  const styles = {
    solid:  `border-top:1.5px solid ${ac};margin:4px 0`,
    dashed: `border-top:1.5px dashed ${ac}66;margin:4px 0`,
    double: `border-top:3px double ${ac};margin:4px 0`,
    none:   `margin:10px 0`,
  };
  return `<div style="${styles[style] || styles.solid}"></div>`;
}

// ─────────────────────────────────────────────────────────
// SKELETON DATA (blank template)
// ─────────────────────────────────────────────────────────

function getSkeletonData() {
  const uid  = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  const euid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2,5);
  return {
    name: 'Your Name', target_role: 'Job Title', email: 'email@example.com',
    phone: '+91 98765 43210', linkedin: 'linkedin.com/in/yourname',
    github: 'github.com/yourname', location: 'City, Country',
    career_stage: 'mid', country: 'India',
    layout_config: { accent_color:'#2058e8', font_style:'professional_clean', show_photo:false },
    sections: [
      { id:uid(), type:'summary',    title:'PROFESSIONAL SUMMARY', order:1, summary_text:'Results-driven professional seeking to leverage expertise in a challenging role. Click to edit this summary.' },
      { id:uid(), type:'experience', title:'EXPERIENCE',           order:2, entries:[{ id:euid(), title:'Job Title', subtitle:'Company Name', location:'City', date_start:'Jan 2022', date_end:'Present', bullets:['Led development of X resulting in Y% improvement','Collaborated with cross-functional teams of N+ members'] }] },
      { id:uid(), type:'education',  title:'EDUCATION',            order:3, entries:[{ id:euid(), title:'B.Tech Computer Science', subtitle:'University Name', location:'City', date_start:'2018', date_end:'2022', bullets:['CGPA: 8.5/10'] }] },
      { id:uid(), type:'skills',     title:'SKILLS',               order:4, skill_groups:[{ category:'Languages', skills:['Python','JavaScript','Java'] },{ category:'Frameworks', skills:['React','Django','Node.js'] },{ category:'Tools', skills:['Git','Docker','AWS'] }] },
      { id:uid(), type:'projects',   title:'PROJECTS',             order:5, entries:[{ id:euid(), title:'Project Name', subtitle:'React · Node.js', date_start:'2023', date_end:'', bullets:['Built X feature serving Y users','Reduced load time by Z%'] }] },
    ],
    ats_score: 0, ai_confidence: 0,
  };
}
window.getSkeletonData = getSkeletonData;

// ─────────────────────────────────────────────────────────
// TEMPLATE DEFINITIONS
// ─────────────────────────────────────────────────────────

const TEMPLATES = [

  // ── 01 Classic Clean ──────────────────────────────────
  {
    id: 'classic-clean',
    name: 'Classic Clean',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => {
        if (sec.type === 'divider') return `<div data-sec-id="${sec.id}" style="position:relative;margin:4px 0">${secCtrl(sec.id)}${dividerHtml(sec.style,ac)}</div>`;
        return `<div data-sec-id="${sec.id}" style="position:relative;margin-bottom:14px">
          ${secCtrl(sec.id)}
          ${secHead(sec.title, ac, sec.id)}
          ${renderSection(sec, ac)}
        </div>`;
      }).join('');

      return `
        <div style="margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid ${ac}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px">
            <div style="flex:1;min-width:0">
              <div contenteditable="true" spellcheck="false" style="font-size:1.5rem;font-weight:800;color:#0f172a;letter-spacing:-0.03em;outline:none;cursor:text;line-height:1.1"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
              >${e(data.name)}</div>
              <div contenteditable="true" spellcheck="false" style="font-size:0.78rem;color:${ac};font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-top:3px;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
              >${e(data.target_role||'')}</div>
              <div style="font-size:0.72rem;color:#475569;margin-top:5px;font-family:monospace">${contacts(data)}</div>
            </div>
            ${photoEl()}
          </div>
        </div>
        ${secs}`;
    }
  },

  // ── 02 Sidebar Split ──────────────────────────────────
  {
    id: 'sidebar-split',
    name: 'Sidebar Split',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const left  = sorted.filter((_,i) => i % 3 === 0);
      const right = sorted.filter((_,i) => i % 3 !== 0);

      const renderCol = (secs) => secs.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:14px">
          ${secCtrl(sec.id)}
          ${secHead(sec.title, ac, sec.id)}
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="background:${ac};padding:22px 20px;margin:-1px -1px 0;display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin-bottom:16px">
          <div>
            <div contenteditable="true" spellcheck="false" style="font-size:1.55rem;font-weight:800;color:white;letter-spacing:-0.03em;outline:none;cursor:text;line-height:1.1"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
            >${e(data.name)}</div>
            <div contenteditable="true" spellcheck="false" style="font-size:0.8rem;color:rgba(255,255,255,0.8);font-weight:600;letter-spacing:0.04em;margin-top:4px;outline:none;cursor:text"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
            >${e(data.target_role||'')}</div>
          </div>
          ${photoEl('border-color:rgba(255,255,255,0.5)')}
        </div>
        <div style="font-size:0.7rem;color:#475569;margin-bottom:14px;padding-bottom:10px;border-bottom:1.5px solid #e2e8f0;font-family:monospace">${contacts(data)}</div>
        <div style="display:grid;grid-template-columns:180px 1fr;gap:20px">
          <div>${renderCol(left)}</div>
          <div style="border-left:2px solid ${ac}22;padding-left:18px">${renderCol(right)}</div>
        </div>`;
    }
  },

  // ── 03 Minimal Line ───────────────────────────────────
  {
    id: 'minimal-line',
    name: 'Minimal Line',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;display:grid;grid-template-columns:90px 1fr;gap:16px;margin-bottom:14px;align-items:start">
          ${secCtrl(sec.id)}
          <div style="font-size:0.62rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:${ac};padding-top:1px;text-align:right;border-right:2px solid ${ac}33;padding-right:10px">${e(sec.title)}</div>
          <div>${renderSection(sec, ac)}</div>
        </div>`).join('');

      return `
        <div style="margin-bottom:20px">
          <div contenteditable="true" spellcheck="false" style="font-size:1.65rem;font-weight:800;color:#0f172a;letter-spacing:-0.04em;outline:none;cursor:text"
            oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
          >${e(data.name)}</div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
            <div contenteditable="true" spellcheck="false" style="font-size:0.78rem;color:${ac};font-weight:700;letter-spacing:0.05em;outline:none;cursor:text"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
            >${e(data.target_role||'')}</div>
            <div style="font-size:0.7rem;color:#475569;font-family:monospace">${contacts(data,' | ')}</div>
          </div>
          <div style="height:2px;background:${ac};margin-top:10px"></div>
        </div>
        ${secs}`;
    }
  },

  // ── 04 Bold Header ────────────────────────────────────
  {
    id: 'bold-header',
    name: 'Bold Header',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:14px">
          ${secCtrl(sec.id)}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <div style="width:4px;height:16px;background:${ac};border-radius:2px;flex-shrink:0"></div>
            <div contenteditable="true" spellcheck="false"
              style="font-size:0.72rem;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#0f172a;outline:none;cursor:text"
              oninput="typeof updateSecTitle!=='undefined'&&updateSecTitle('${sec.id}',this.textContent)"
            >${e(sec.title)}</div>
          </div>
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="background:linear-gradient(135deg,${ac} 0%,${ac}cc 100%);padding:26px 24px;margin:-1px;margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div contenteditable="true" spellcheck="false" style="font-size:1.6rem;font-weight:900;color:white;letter-spacing:-0.04em;outline:none;cursor:text;line-height:1.05"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
              >${e(data.name)}</div>
              <div contenteditable="true" spellcheck="false" style="font-size:0.82rem;color:rgba(255,255,255,0.85);font-weight:500;margin-top:5px;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
              >${e(data.target_role||'')}</div>
              <div style="font-size:0.7rem;color:rgba(255,255,255,0.7);margin-top:8px;font-family:monospace">${contacts(data)}</div>
            </div>
            ${photoEl('border-color:rgba(255,255,255,0.5)')}
          </div>
        </div>
        ${secs}`;
    }
  },

  // ── 05 Elegant Serif ──────────────────────────────────
  {
    id: 'elegant-serif',
    name: 'Elegant Serif',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:16px">
          ${secCtrl(sec.id)}
          <div contenteditable="true" spellcheck="false"
            style="font-family:Georgia,serif;font-size:0.7rem;font-weight:700;text-transform:uppercase;
              letter-spacing:0.18em;color:${ac};margin-bottom:4px;outline:none;cursor:text;border-bottom:0.5px solid ${ac}44;padding-bottom:3px"
            oninput="typeof updateSecTitle!=='undefined'&&updateSecTitle('${sec.id}',this.textContent)"
          >${e(sec.title)}</div>
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid ${ac}33">
          ${photoEl('margin:0 auto 10px')}
          <div contenteditable="true" spellcheck="false"
            style="font-family:Georgia,serif;font-size:1.75rem;font-weight:700;color:#0f172a;letter-spacing:-0.01em;outline:none;cursor:text"
            oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
          >${e(data.name)}</div>
          <div contenteditable="true" spellcheck="false"
            style="font-size:0.8rem;color:${ac};font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-top:5px;outline:none;cursor:text"
            oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
          >${e(data.target_role||'')}</div>
          <div style="font-size:0.71rem;color:#475569;margin-top:7px;font-family:monospace">${contacts(data)}</div>
        </div>
        ${secs}`;
    }
  },

  // ── 06 Dark Accent ────────────────────────────────────
  {
    id: 'dark-accent',
    name: 'Dark Accent',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:14px">
          ${secCtrl(sec.id)}
          <div style="background:#0f172a;padding:3px 8px;border-left:3px solid ${ac};margin-bottom:7px;display:inline-block;min-width:80px">
            <span contenteditable="true" spellcheck="false"
              style="font-size:0.62rem;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:white;outline:none;cursor:text"
              oninput="typeof updateSecTitle!=='undefined'&&updateSecTitle('${sec.id}',this.textContent)"
            >${e(sec.title)}</span>
          </div>
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="background:#0f172a;padding:24px;margin:-1px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div contenteditable="true" spellcheck="false" style="font-size:1.55rem;font-weight:900;color:white;letter-spacing:-0.04em;outline:none;cursor:text"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
            >${e(data.name)}</div>
            <div style="height:2px;background:${ac};width:60px;margin:6px 0"></div>
            <div contenteditable="true" spellcheck="false" style="font-size:0.78rem;color:${ac};font-weight:700;letter-spacing:0.04em;outline:none;cursor:text"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
            >${e(data.target_role||'')}</div>
            <div style="font-size:0.7rem;color:rgba(255,255,255,0.55);margin-top:8px;font-family:monospace">${contacts(data)}</div>
          </div>
          ${photoEl()}
        </div>
        ${secs}`;
    }
  },

  // ── 07 Compact Pro ────────────────────────────────────
  {
    id: 'compact-pro',
    name: 'Compact Pro',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:10px">
          ${secCtrl(sec.id)}
          ${secHead(sec.title, ac, sec.id)}
          ${renderSection({...sec}, ac)}
        </div>`).join('');

      return `
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:8px;padding-bottom:8px;border-bottom:2px solid ${ac}">
          <div>
            <div contenteditable="true" spellcheck="false" style="font-size:1.3rem;font-weight:800;color:#0f172a;letter-spacing:-0.03em;outline:none;cursor:text;line-height:1.1"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
            >${e(data.name)}</div>
            <div contenteditable="true" spellcheck="false" style="font-size:0.72rem;color:${ac};font-weight:700;margin-top:2px;outline:none;cursor:text"
              oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
            >${e(data.target_role||'')}</div>
          </div>
          <div style="font-size:0.67rem;color:#475569;text-align:right;font-family:monospace;line-height:1.7">${contacts(data,'<br>')}</div>
        </div>
        ${secs}`;
    }
  },

  // ── 08 Modern Two-Column ──────────────────────────────
  {
    id: 'two-column',
    name: 'Two Column',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      // First half left, second half right
      const mid   = Math.ceil(sorted.length / 2);
      const left  = sorted.slice(0, mid);
      const right = sorted.slice(mid);

      const col = (secs) => secs.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:14px">
          ${secCtrl(sec.id)}
          ${secHead(sec.title, ac, sec.id)}
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="background:${ac};padding:22px 20px;margin:-1px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div>
              <div contenteditable="true" spellcheck="false" style="font-size:1.55rem;font-weight:800;color:white;letter-spacing:-0.03em;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
              >${e(data.name)}</div>
              <div contenteditable="true" spellcheck="false" style="font-size:0.78rem;color:rgba(255,255,255,0.85);font-weight:500;margin-top:4px;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
              >${e(data.target_role||'')}</div>
              <div style="font-size:0.7rem;color:rgba(255,255,255,0.65);margin-top:8px;font-family:monospace">${contacts(data)}</div>
            </div>
            ${photoEl()}
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div>${col(left)}</div>
          <div>${col(right)}</div>
        </div>`;
    }
  },

  // ── 09 Boxed Sections ─────────────────────────────────
  {
    id: 'boxed',
    name: 'Boxed Sections',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:10px;border:1.5px solid ${ac}22;border-radius:6px;padding:12px 14px">
          ${secCtrl(sec.id)}
          ${secHead(sec.title, ac, sec.id)}
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="border:2px solid ${ac};border-radius:8px;padding:20px;margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div>
              <div contenteditable="true" spellcheck="false" style="font-size:1.45rem;font-weight:800;color:#0f172a;letter-spacing:-0.03em;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
              >${e(data.name)}</div>
              <div contenteditable="true" spellcheck="false" style="font-size:0.76rem;color:${ac};font-weight:700;margin-top:3px;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
              >${e(data.target_role||'')}</div>
              <div style="font-size:0.7rem;color:#475569;margin-top:6px;font-family:monospace">${contacts(data)}</div>
            </div>
            ${photoEl()}
          </div>
        </div>
        ${secs}`;
    }
  },

  // ── 10 Gradient Banner ────────────────────────────────
  {
    id: 'gradient-banner',
    name: 'Gradient Banner',
    render(data, ac) {
      const sorted = [...(data.sections||[])].sort((a,b)=>(a.order||0)-(b.order||0));
      const secs = sorted.map(sec => `
        <div data-sec-id="${sec.id}" style="position:relative;margin-bottom:14px">
          ${secCtrl(sec.id)}
          ${secHead(sec.title, ac, sec.id)}
          ${renderSection(sec, ac)}
        </div>`).join('');

      return `
        <div style="background:linear-gradient(135deg,${ac} 0%,#7c3aed 100%);padding:26px 24px;margin:-1px;margin-bottom:18px">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div>
              <div contenteditable="true" spellcheck="false" style="font-size:1.6rem;font-weight:900;color:white;letter-spacing:-0.04em;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.name=this.textContent,scheduleAutoSave())"
              >${e(data.name)}</div>
              <div contenteditable="true" spellcheck="false" style="font-size:0.8rem;color:rgba(255,255,255,0.85);font-weight:500;margin-top:5px;outline:none;cursor:text"
                oninput="typeof window.currentData!=='undefined'&&(window.currentData.target_role=this.textContent,scheduleAutoSave())"
              >${e(data.target_role||'')}</div>
              <div style="font-size:0.7rem;color:rgba(255,255,255,0.65);margin-top:8px;font-family:monospace">${contacts(data)}</div>
            </div>
            ${photoEl()}
          </div>
        </div>
        ${secs}`;
    }
  },

];

// ─────────────────────────────────────────────────────────
// TEMPLATE GALLERY RENDERER
// ─────────────────────────────────────────────────────────
async function sendAdvancedChat(instruction) {
  const btn = document.getElementById('chat-send-btn');
  setBtnLoading(btn, true);
  
  try {
    const response = await fetch('/resume/api/chat-detailed/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        resume_id: currentResumeId,
        instruction: instruction
      })
    });
    
    const result = await response.json();
    if (result.success) {
      // Update UI
      window.currentData = result.data;
      renderResume(result.data);
      updateScores(result.ats_score, result.ai_confidence);
      
      // Show AI response
      appendChatMsg('ai', result.message);
      
      // Auto-save
      scheduleAutoSave();
    } else {
      showToast('Error: ' + result.error, 'error');
    }
  } finally {
    setBtnLoading(btn, false);
  }
}

// Example prompts to show users:
const EXAMPLE_PROMPTS = [
  "Add Python skill at 92% and JavaScript at 85%",
  "Change all my percentages +5 but cap at 100%",
  "Add a table with my 3 biggest projects",
  "Create a Languages section: English (Native), Spanish (Intermediate)",
  "Add certifications for AWS and Google Cloud",
  "Move Skills section to position 2",
  "Make all my experience bullets more impactful",
  "Add 'Led team of 5' and '40% performance improvement' to first bullet"
];
async function showImprovementSuggestions() {
  const response = await fetch(`/resume/api/suggestions/?id=${currentResumeId}`);
  const result = await response.json();
  
  if (result.success) {
    const sugg = result.suggestions;
    const suggText = `
      📊 Overall Score: ${sugg.overall_score}/100
      🤖 ATS Readiness: ${sugg.ats_readiness}/100
      
      💡 Quick Wins:
      ${sugg.quick_wins.map(w => `• ${w}`).join('\n')}
      
      📝 Suggestions:
      ${sugg.suggestions.bullets.map(b => `• ${b}`).join('\n')}
    `;
    showToast(suggText, 'info', 8000);
  }
}
async function generateCoverLetter() {
  const jobDesc = prompt('Paste the job description:');
  if (!jobDesc) return;
  
  setBtnLoading(document.getElementById('export-btn'), true);
  
  try {
    const response = await fetch('/resume/api/cover-letter/', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        resume_id: currentResumeId,
        job_description: jobDesc
      })
    });
    
    const result = await response.json();
    if (result.success) {
      // Show in modal or download
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div style="padding: 20px; background: white; border-radius: 8px;">
          <h3>Your Cover Letter</h3>
          <textarea style="width: 100%; height: 400px;">${result.cover_letter}</textarea>
          <button onclick="copyToClipboard(this.previousElementSibling.value)">Copy</button>
          <button onclick="downloadCoverLetter(this.previousElementSibling.value)">Download</button>
        </div>
      `;
      showModal(modal);
    }
  } finally {
    setBtnLoading(document.getElementById('export-btn'), false);
  }
}
function renderTemplateGallery() {
  const container = document.getElementById('tpl-scroll');
  if (!container) return;

  container.innerHTML = TEMPLATES.map(tpl => `
    <div class="tpl-card ${window.ACTIVE_TPL?.id === tpl.id ? 'active' : ''}"
      data-tpl-id="${tpl.id}"
      onclick="typeof selectTemplate!=='undefined'&&selectTemplate('${tpl.id}')">
      <div class="tpl-thumb">
        <div style="transform:scale(0.14);transform-origin:top left;width:714%;height:714%;pointer-events:none;overflow:hidden;background:white;padding:14px">
          ${window.currentData ? tpl.render(window.currentData, window.ACCENT) : `
            <div style="background:#e2e8f0;height:8px;width:60%;margin-bottom:4px;border-radius:2px"></div>
            <div style="background:#2058e820;height:4px;width:40%;margin-bottom:8px;border-radius:2px"></div>
            ${Array(5).fill(0).map(() => `<div style="background:#e2e8f0;height:3px;width:${40+Math.random()*50}%;margin-bottom:3px;border-radius:1px"></div>`).join('')}
          `}
        </div>
      </div>
      <div class="tpl-name">${tpl.name}</div>
    </div>`).join('');
}

// Expose to window
window.TEMPLATES            = TEMPLATES;
window.renderTemplateGallery = renderTemplateGallery;
