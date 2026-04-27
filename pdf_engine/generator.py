from io import BytesIO
from xhtml2pdf import pisa
import logging, re

logger = logging.getLogger(__name__)


def generate_resume_pdf(resume_data: dict, resume_obj) -> bytes:
    html_string = _build_adaptive_html(resume_data)
    buffer = BytesIO()
    result = pisa.CreatePDF(html_string, dest=buffer, encoding='utf-8')
    if result.err:
        raise RuntimeError(f"PDF rendering error code: {result.err}")
    return buffer.getvalue()


def _get_layout(data: dict) -> dict:
    lc = data.get('layout_config', {})
    return {
        'intro_type':     lc.get('intro_section_type', 'summary'),
        'show_photo':     lc.get('show_photo_placeholder', False),
        'show_dob':       lc.get('show_dob', False),
        'show_languages': lc.get('show_languages', False),
        'font_style':     lc.get('font_style', 'professional_clean'),
        'accent_color':   lc.get('accent_color', '#2563EB'),
        'emphasize_cgpa': lc.get('emphasize_cgpa', False),
        'section_order':  lc.get('section_order', []),
        'career_stage':   data.get('career_stage', 'fresher'),
        'country':        data.get('country', 'India'),
    }


FONT_THEMES = {
    'professional_clean': {
        'name_size': '20pt', 'section_size': '7.5pt', 'body_size': '9pt',
        'contact_size': '8pt', 'entry_title_size': '9.5pt', 'bullet_size': '8.5pt',
        'name_font': 'Helvetica', 'body_font': 'Helvetica', 'mono_font': 'Courier',
    },
    'modern_minimal': {
        'name_size': '22pt', 'section_size': '7pt', 'body_size': '8.5pt',
        'contact_size': '7.5pt', 'entry_title_size': '9pt', 'bullet_size': '8pt',
        'name_font': 'Helvetica', 'body_font': 'Helvetica', 'mono_font': 'Courier',
    },
    'formal_classic': {
        'name_size': '18pt', 'section_size': '8pt', 'body_size': '9.5pt',
        'contact_size': '8.5pt', 'entry_title_size': '10pt', 'bullet_size': '9pt',
        'name_font': 'Times', 'body_font': 'Times', 'mono_font': 'Courier',
    },
}


def _build_adaptive_html(data: dict) -> str:
    layout = _get_layout(data)
    theme  = FONT_THEMES.get(layout['font_style'], FONT_THEMES['professional_clean'])
    accent = layout['accent_color']
    accent_light = _lighten_hex(accent)

    contacts = [_esc(data.get(f, '')) for f in ['email','phone','linkedin','github','location'] if data.get(f)]
    contact_html = '  ·  '.join(contacts)

    optional_header = ''
    if layout['show_photo']:
        optional_header += '<div class="photo-placeholder">Photo</div>'
    if layout['show_dob'] and data.get('dob'):
        optional_header += f'<div class="dob-line">Date of Birth: {_esc(data["dob"])}</div>'

    sections_html = _build_sections(data, layout, theme, accent)

    return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page {{ size: A4; margin: 15mm 13mm 13mm 13mm; }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: {theme['body_font']}, sans-serif; font-size: {theme['body_size']}; color: #0f172a; line-height: 1.5; }}
  .photo-placeholder {{ width: 58pt; height: 68pt; border: 1pt solid #e2e8f0; text-align: center; font-size: 7pt; color: #94a3b8; padding-top: 26pt; float: right; margin-left: 10pt; background: #f8fafc; }}
  .resume-name {{ font-family: {theme['name_font']}, sans-serif; font-size: {theme['name_size']}; font-weight: bold; color: #0f172a; letter-spacing: -0.5pt; display: block; }}
  .resume-role {{ font-size: {theme['contact_size']}; color: {accent}; font-weight: bold; display: block; margin-top: 2pt; margin-bottom: 4pt; letter-spacing: 0.3pt; }}
  .resume-contact {{ font-size: {theme['contact_size']}; color: #475569; font-family: {theme['mono_font']}, monospace; }}
  .header-rule {{ border: none; border-top: 2pt solid {accent}; margin-top: 8pt; margin-bottom: 10pt; display: block; }}
  .section {{ margin-bottom: 10pt; }}
  .section-title {{ font-family: {theme['name_font']}, sans-serif; font-size: {theme['section_size']}; font-weight: bold; text-transform: uppercase; letter-spacing: 1.2pt; color: {accent}; margin-bottom: 2pt; }}
  .section-rule {{ border: none; border-top: 0.75pt solid {accent_light}; margin-bottom: 6pt; display: block; }}
  .entry {{ margin-bottom: 8pt; }}
  .entry-header-table {{ width: 100%; border-collapse: collapse; }}
  .entry-title-cell {{ font-size: {theme['entry_title_size']}; font-weight: bold; color: #0f172a; }}
  .entry-date-cell {{ font-size: {theme['contact_size']}; color: #64748b; text-align: right; white-space: nowrap; font-family: {theme['mono_font']}, monospace; }}
  .entry-sub {{ font-size: {theme['contact_size']}; color: {accent}; font-style: italic; margin-bottom: 3pt; margin-top: 1pt; }}
  .entry-location {{ font-size: 7.5pt; color: #94a3b8; margin-bottom: 2pt; }}
  ul {{ padding-left: 11pt; margin-top: 3pt; margin-bottom: 2pt; }}
  ul li {{ font-size: {theme['bullet_size']}; color: #334155; margin-bottom: 2.5pt; line-height: 1.45; }}
  .intro-text {{ font-size: {theme['body_size']}; color: #334155; line-height: 1.7; }}
  .skill-table {{ width: 100%; border-collapse: collapse; }}
  .skill-cat {{ font-size: {theme['contact_size']}; font-weight: bold; color: #0f172a; width: 85pt; vertical-align: top; padding: 1.5pt 0; }}
  .skill-val {{ font-size: {theme['bullet_size']}; color: #334155; padding: 1.5pt 0; line-height: 1.5; }}
  .lang-table {{ width: 100%; border-collapse: collapse; }}
  .lang-name {{ font-size: {theme['body_size']}; font-weight: bold; color: #0f172a; width: 120pt; padding: 1pt 0; }}
  .lang-level {{ font-size: {theme['bullet_size']}; color: #64748b; padding: 1pt 0; }}
  .cgpa-highlight {{ font-weight: bold; color: {accent}; }}
  .watermark {{ position: fixed; bottom: 5mm; right: 8mm; font-size: 6pt; color: #e2e8f0; letter-spacing: 0.5pt; }}
</style>
</head>
<body>
  {optional_header}
  <span class="resume-name">{_esc(data.get('name',''))}</span>
  {f'<span class="resume-role">{_esc(data.get("target_role",""))}</span>' if data.get('target_role') else ''}
  <div class="resume-contact">{contact_html}</div>
  <hr class="header-rule"/>
  {sections_html}
  <div class="watermark">QuantumCV · {_esc(data.get('country',''))} · {_esc(data.get('target_role',''))}</div>
</body>
</html>"""


def _build_sections(data, layout, theme, accent):
    sections = sorted(data.get('sections', []), key=lambda s: s.get('order', 99))
    html = ''
    for sec in sections:
        sec_type = sec.get('type', '')
        title    = sec.get('title', '')
        inner    = ''

        if sec_type in ('summary','objective','profile','personal_statement') and sec.get('summary_text'):
            inner = f'<p class="intro-text">{_esc(sec["summary_text"])}</p>'
            html += _wrap_section(title, inner)

        elif sec_type == 'skills' and sec.get('skill_groups'):
            rows = ''.join(
                f'<tr><td class="skill-cat">{_esc(g.get("category",""))}:</td>'
                f'<td class="skill-val">{_esc(", ".join(g.get("skills",[])))}</td></tr>'
                for g in sec['skill_groups']
            )
            html += _wrap_section(title, f'<table class="skill-table">{rows}</table>')

        elif sec_type == 'languages' and sec.get('entries'):
            rows = ''.join(
                f'<tr><td class="lang-name">{_esc(e.get("title",""))}</td>'
                f'<td class="lang-level">{_esc(e.get("subtitle","") or ", ".join(e.get("bullets",[])))}</td></tr>'
                for e in sec['entries']
            )
            html += _wrap_section(title, f'<table class="lang-table">{rows}</table>')

        elif sec.get('entries'):
            inner = ''.join(_render_entry(e, sec_type, layout) for e in sec['entries'])
            html += _wrap_section(title, inner)

    return html


def _render_entry(entry, sec_type, layout):
    title    = entry.get('title', '')
    subtitle = entry.get('subtitle', '')
    location = entry.get('location', '')
    date_str = entry.get('date_start', '')
    if date_str and entry.get('date_end'):
        date_str += f' – {entry["date_end"]}'

    bullets_html = ''
    for b in entry.get('bullets', []):
        text = _esc(b)
        if layout['emphasize_cgpa'] and re.search(r'cgpa|gpa', b, re.IGNORECASE):
            text = re.sub(
                r'((?:CGPA|GPA)\s*[:\-]?\s*[\d.]+(?:\s*/\s*[\d.]+)?)',
                r'<b class="cgpa-highlight">\1</b>',
                text, flags=re.IGNORECASE
            )
        bullets_html += f'<li>{text}</li>'

    return f'''<div class="entry">
  <table class="entry-header-table"><tr>
    <td class="entry-title-cell">{_esc(title)}</td>
    <td class="entry-date-cell">{_esc(date_str)}</td>
  </tr></table>
  {f'<div class="entry-location">{_esc(location)}</div>' if location and sec_type in ("experience","education") else ""}
  {f'<div class="entry-sub">{_esc(subtitle)}</div>' if subtitle else ""}
  {"<ul>" + bullets_html + "</ul>" if bullets_html else ""}
</div>'''


def _wrap_section(title, inner_html):
    return f'''<div class="section">
  <div class="section-title">{_esc(title)}</div>
  <hr class="section-rule"/>
  {inner_html}
</div>'''


def _esc(text) -> str:
    if not text:
        return ''
    return str(text).replace('&','&amp;').replace('<','&lt;').replace('>','&gt;').replace('"','&quot;')


def _lighten_hex(hex_color: str) -> str:
    try:
        h = hex_color.lstrip('#')
        r, g, b = int(h[0:2],16), int(h[2:4],16), int(h[4:6],16)
        return f'#{min(255,r+140):02x}{min(255,g+140):02x}{min(255,b+140):02x}'
    except Exception:
        return '#bfdbfe'
