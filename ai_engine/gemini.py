"""
ai_engine/gemini.py
Advanced Gemini AI integration for resume generation, editing, and manipulation.
Supports: tables, skill bars, sections, percentages, batch edits, and more.
"""
import google.generativeai as genai
from django.conf import settings
import json
import re
import logging
from typing import Dict, List, Tuple, Any

logger = logging.getLogger(__name__)

# Model fallback chain
MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
]


def _get_model():
    """Initialize and return Gemini model."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise ValueError('GEMINI_API_KEY not configured.')

    genai.configure(api_key=api_key)

    for model_name in MODELS:
        try:
            return genai.GenerativeModel(model_name)
        except Exception:
            continue

    raise RuntimeError('No Gemini model available. Check your API key.')


def _detect_profile(raw_data: str) -> dict:
    """Detect career stage and profile type from raw text."""
    raw_lower = raw_data.lower()

    # Fresher indicators
    is_fresher = any(w in raw_lower for w in [
        'fresher', 'final year', 'b.tech', 'btech', 'b.e.', 'be student',
        'pursuing', 'currently studying', 'expected graduation', '1st year',
        '2nd year', '3rd year', '4th year',
    ])

    # Experience indicators
    has_experience = any(w in raw_lower for w in [
        'years of experience', 'yrs experience', 'worked at', 'employed',
        'full time', 'permanent', 'senior', 'lead', 'manager', 'architect',
    ])

    has_internship = any(w in raw_lower for w in [
        'intern', 'internship', 'trainee', 'apprentice',
    ])

    has_projects = any(w in raw_lower for w in [
        'project', 'built', 'developed', 'created', 'github', 'deployed',
    ])

    # Extract years of experience
    years_exp = 0
    exp_match = re.search(r'(\d+)\s*\+?\s*years?\s+(?:of\s+)?experience', raw_lower)
    if exp_match:
        years_exp = int(exp_match.group(1))

    # Determine stage
    if is_fresher or (not has_experience and years_exp == 0):
        stage = 'fresher'
    elif years_exp <= 3:
        stage = 'junior'
    elif years_exp <= 7:
        stage = 'mid'
    else:
        stage = 'senior'

    return {
        'stage': stage,
        'is_fresher': is_fresher,
        'has_experience': has_experience,
        'has_internship': has_internship,
        'has_projects': has_projects,
        'years_exp': years_exp,
    }


def _get_country_rules(country: str) -> dict:
    """Return country-specific resume guidance."""
    return {
        'India': {
            'include_photo': False,
            'include_dob': False,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': True,
            'include_languages': True,
            'objective_type': 'objective',
            'ats_note': 'Optimized for Naukri.com and LinkedIn India ATS systems.',
            'font_style': 'professional_clean',
        },
        'United States': {
            'include_photo': False,
            'include_dob': False,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': False,
            'include_languages': False,
            'objective_type': 'summary',
            'ats_note': 'Optimized for Workday, Greenhouse, and Lever ATS systems.',
            'font_style': 'modern_minimal',
        },
        'United Kingdom': {
            'include_photo': False,
            'include_dob': False,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': True,
            'include_languages': False,
            'objective_type': 'personal_statement',
            'ats_note': 'Optimized for Reed, TotalJobs, and LinkedIn UK ATS.',
            'font_style': 'professional_clean',
        },
        'UAE': {
            'include_photo': True,
            'include_dob': True,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': True,
            'include_languages': True,
            'objective_type': 'objective',
            'ats_note': 'Optimized for Bayt.com and GulfTalent ATS.',
            'font_style': 'formal_classic',
        },
        'Canada': {
            'include_photo': False,
            'include_dob': False,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': False,
            'include_languages': True,
            'objective_type': 'summary',
            'ats_note': 'Optimized for Workday and Indeed Canada ATS.',
            'font_style': 'modern_minimal',
        },
        'Germany': {
            'include_photo': True,
            'include_dob': True,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': True,
            'include_languages': True,
            'objective_type': 'profile',
            'ats_note': 'German Lebenslauf format. Optimized for XING and StepStone.',
            'font_style': 'formal_classic',
        },
        'Australia': {
            'include_photo': False,
            'include_dob': False,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': False,
            'include_languages': False,
            'objective_type': 'summary',
            'ats_note': 'Optimized for SEEK and LinkedIn Australia ATS.',
            'font_style': 'modern_minimal',
        },
        'Singapore': {
            'include_photo': True,
            'include_dob': True,
            'date_format': 'Mon YYYY',
            'emphasize_cgpa': True,
            'include_languages': True,
            'objective_type': 'summary',
            'ats_note': 'Optimized for JobsDB and LinkedIn Singapore ATS.',
            'font_style': 'professional_clean',
        },
    }.get(country, {
        'include_photo': False,
        'include_dob': False,
        'date_format': 'Mon YYYY',
        'emphasize_cgpa': True,
        'include_languages': True,
        'objective_type': 'objective',
        'ats_note': 'ATS-optimized for global job boards.',
        'font_style': 'professional_clean',
    })


def build_resume_prompt(raw_data: str, job_description: str, country: str, role: str) -> str:
    """Build comprehensive prompt for Gemini."""
    profile = _detect_profile(raw_data)
    rules = _get_country_rules(country)
    stage = profile['stage']

    if stage == 'fresher':
        section_order = ['Objective', 'Education', 'Projects', 'Skills', 'Internships', 'Achievements']
    elif stage == 'junior':
        section_order = ['Summary', 'Experience', 'Projects', 'Skills', 'Education', 'Certifications']
    elif stage == 'mid':
        section_order = ['Summary', 'Experience', 'Skills', 'Projects', 'Education', 'Certifications']
    else:
        section_order = ['Executive Summary', 'Experience', 'Key Achievements', 'Skills', 'Education']

    return f"""You are QuantumCV, an expert resume architect. Generate a highly tailored resume in JSON format.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown, no backticks, no explanation.
- Include all required fields. Do NOT omit any field.
- Sort sections by "order" field in ascending order.
- Generate unique snake_case IDs for all sections and entries.

═══ INPUT ═══
Career Data:
{raw_data}

Job Description:
{job_description or 'Not provided — generate a strong general-purpose resume.'}

═══ CONTEXT ═══
Country: {country}
Target Role: {role}
Career Stage: {stage} ({profile['years_exp']} years detected)
Has Projects: {profile['has_projects']}
Has Internship: {profile['has_internship']}

═══ RULES FOR {country.upper()} ═══
- Include photo: {rules['include_photo']}
- Include DOB: {rules['include_dob']}
- Include languages: {rules['include_languages']}
- Emphasize CGPA: {rules['emphasize_cgpa']}
- Intro type: {rules['objective_type']}
- {rules['ats_note']}

═══ SECTION ORDER ═══
{' → '.join(section_order)}

═══ OUTPUT JSON SCHEMA ═══
{{
  "name": "Full Name",
  "email": "email@example.com",
  "phone": "+91 98765 43210",
  "linkedin": "linkedin.com/in/username",
  "github": "github.com/username",
  "location": "City, Country",
  "target_role": "{role}",
  "country": "{country}",
  "career_stage": "{stage}",
  "ai_confidence": 85,
  "ats_score": 82,
  
  "layout_config": {{
    "intro_section_type": "{rules['objective_type']}",
    "show_photo_placeholder": {str(rules['include_photo']).lower()},
    "show_dob": {str(rules['include_dob']).lower()},
    "show_languages": {str(rules['include_languages']).lower()},
    "font_style": "{rules['font_style']}",
    "accent_color": "#2563EB",
    "section_order": {json.dumps(section_order)},
    "emphasize_cgpa": {str(rules['emphasize_cgpa']).lower()},
    "ats_platform": "{rules['ats_note'][:50]}"
  }},

  "sections": [
    {{
      "id": "s-unique-id",
      "type": "summary|objective|experience|education|projects|skills|skills-bars|skills-dots|skills-tags|certifications|languages",
      "title": "SECTION TITLE",
      "order": 1,
      "entries": [
        {{
          "id": "e-unique-id",
          "title": "Position/Degree Title",
          "subtitle": "Company/University/Tech Stack",
          "location": "City, Country",
          "date_start": "Mon YYYY",
          "date_end": "Mon YYYY or Present",
          "bullets": ["Action verb + impact", "Another bullet"]
        }}
      ],
      "skill_groups": [
        {{
          "category": "Languages",
          "skills": ["Python", "JavaScript"]
        }}
      ],
      "skills": [
        {{
          "name": "Python",
          "level": 90
        }}
      ],
      "tags": ["Python", "Django"],
      "summary_text": "Professional summary paragraph"
    }}
  ]
}}

═══ BULLET RULES ═══
- Start with strong past-tense action verbs
- Include quantified metrics: %, numbers, time, users, revenue
- Use STAR format: Situation → Task → Action → Result
- Align keywords with the job description for ATS
- 2-4 bullets per entry maximum
"""


def generate_resume(raw_data: str, job_description: str, country: str, role: str) -> dict:
    """Generate structured resume data using Gemini."""
    if not raw_data.strip():
        raise ValueError('Career data is required.')

    prompt = build_resume_prompt(raw_data, job_description, country, role)
    model = _get_model()

    config = genai.GenerationConfig(
        temperature=0.3,
        top_p=0.9,
        max_output_tokens=8192,
    )

    try:
        response = model.generate_content(prompt, generation_config=config)
        raw_text = response.text.strip()
    except Exception as ex:
        logger.error(f'Gemini API error: {ex}', exc_info=True)
        raise RuntimeError(f'Resume generation failed: {str(ex)}')

    raw_text = re.sub(r'^```(?:json)?\s*', '', raw_text)
    raw_text = re.sub(r'\s*```$', '', raw_text).strip()

    try:
        data = json.loads(raw_text)
    except json.JSONDecodeError as ex:
        logger.error(f'JSON decode error: {ex}\nText: {raw_text[:500]}')
        match = re.search(r'\{.*\}', raw_text, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError('AI returned malformed JSON. Please try again.')

    if 'sections' in data:
        data['sections'].sort(key=lambda s: s.get('order', 99))

    return data


def enhance_bullet(bullet: str, context: str = '') -> str:
    """Enhance a single bullet point with Gemini."""
    if not bullet.strip():
        return bullet

    model = _get_model()
    prompt = f"""Rewrite this resume bullet to be more impactful, quantified, and ATS-optimized.

Context: {context}
Original: {bullet}

Return ONLY the improved bullet. No explanation. Start with a strong action verb. Add metrics if missing."""

    try:
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as ex:
        logger.error(f'Bullet enhance error: {ex}')
        return bullet


def chat_edit_resume(resume_data: dict, instruction: str) -> Tuple[dict, str]:
    """
    Edit resume using natural-language instruction.
    Can add/remove/edit sections, tables, skills, percentages, and more.
    Returns (updated_data, reply_message).
    """
    if not instruction.strip():
        raise ValueError('Instruction is required.')

    model = _get_model()
    
    # Build comprehensive editing prompt
    prompt = f"""You are QuantumCV's expert resume editor. Apply this user instruction to the resume.

CURRENT RESUME (JSON):
{json.dumps(resume_data, indent=2)[:8000]}

USER INSTRUCTION: {instruction}

═══ YOU CAN PERFORM THESE EDITS ═══

1. ADD SECTIONS - Create new sections of any type:
   - "Add a Skills section with bars" → Create skills-bars section
   - "Add a table for projects" → Create table section
   - "Add certifications" → Create certifications section
   Example: {{"type": "skills-bars", "title": "SKILLS", "order": 5, "skills": [{{"name": "Python", "level": 90}}]}}

2. EDIT TABLES - Modify table structure and data:
   - "Change the 3rd row to X" → Update table row
   - "Add a column for dates" → Extend tableData.colWidths and rows
   - "Make first column 40%" → Adjust colWidths
   Example: {{"tableData": {{"hasHeader": true, "colWidths": [40, 30, 30], "rows": [["Col1", "Col2", "Col3"]]}}}}

3. SKILL BARS - Modify percentages and skills:
   - "Change Python to 85%" → Update skill.level
   - "Add Java at 70%" → Append to skills array
   - "Remove React" → Filter skills array
   Example: {{"skills": [{{"name": "Python", "level": 85}}]}}

4. SKILL DOTS (5-dot rating):
   - "Change Design to 4 dots" → Set skill.level = 4
   - "Add Communication at 5 stars" → Append skill

5. SKILL TAGS (pill chips):
   - "Add 'Machine Learning' tag" → Append to tags array
   - "Remove 'Docker' tag" → Filter tags array

6. EDIT ENTRIES (experience, education, projects):
   - "Change the title to Senior Dev" → Update entry.title
   - "Add bullet: Led team of 5" → Append to bullets
   - "Remove last bullet" → Filter bullets
   - "Change date to Jan 2024" → Update entry.date_start/date_end

7. EDIT BULLETS - Improve or change:
   - "Make first bullet more impactful" → Enhance bullet[0]
   - "Add metrics to bullets" → Enhance with numbers
   - "Rewrite bullets for SDE role" → Rewrite for context

8. REORDER SECTIONS:
   - "Move Skills to position 3" → Update section.order
   - "Put Education last" → Set order to 99

9. RENAME SECTIONS:
   - "Rename to 'Tech Stack'" → Update section.title

10. ADD ENTRIES:
    - "Add experience at Google" → Append to section.entries
    - "Add AWS certification" → Create new entry in certifications

11. DELETE CONTENT:
    - "Remove Skills section" → Delete section
    - "Remove last bullet" → Filter bullets
    - "Delete that project" → Remove entry

═══ RULES FOR JSON OUTPUT ═══
- PRESERVE all existing "id" values exactly
- Generate unique IDs for NEW sections: s-{{type}}-{{suffix}}
- Generate unique IDs for NEW entries: e-{{suffix}}
- Maintain proper nesting and field types
- Keep sections sorted by order
- Validate all JSON before returning
- Return ONLY valid JSON, no markdown
- After JSON, write on NEW LINE: REPLY: <description of what changed>

═══ COMMON OPERATIONS ═══

ADD SKILL BAR:
"skills": [{{"name": "NewSkill", "level": 75}}]

ADD TABLE ROW:
"tableData": {{"rows": [...existing..., ["new", "row", "data"]]}}

ADD BULLET:
"bullets": [...existing..., "New achievement bullet"]

UPDATE PERCENTAGE:
"skills": [{{"name": "Python", "level": 88}}]

ADD CERTIFICATION:
{{
  "id": "e-cert1",
  "title": "AWS Solutions Architect",
  "subtitle": "Amazon Web Services",
  "date_start": "Mar 2023",
  "date_end": "",
  "bullets": []
}}

Output format:
{{resume_json_here}}
REPLY: Brief description of what changed"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.2, max_output_tokens=10000)
        )
        raw = response.text.strip()
    except Exception as ex:
        logger.error(f'Chat edit error: {ex}')
        raise RuntimeError(f'Resume edit failed: {str(ex)}')

    # Extract reply message
    reply = 'Resume updated.'
    if 'REPLY:' in raw:
        parts = raw.rsplit('REPLY:', 1)
        raw = parts[0].strip()
        reply = parts[1].strip()

    # Remove markdown fences
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise ValueError('AI returned malformed JSON.')

    # Ensure sections are sorted
    if 'sections' in data and isinstance(data['sections'], list):
        data['sections'].sort(key=lambda s: s.get('order', 99))

    return data, reply


def analyze_resume_for_improvements(resume_data: dict) -> dict:
    """
    Analyze resume and suggest improvements.
    Returns dict with suggestions for each section.
    """
    model = _get_model()
    
    prompt = f"""Analyze this resume and provide specific, actionable improvement suggestions.

RESUME:
{json.dumps(resume_data, indent=2)[:5000]}

For each section, suggest:
1. What's working well
2. What could be improved
3. Specific examples of better phrasing
4. ATS optimization tips

Return ONLY a JSON object with this structure:
{{
  "overall_score": 75,
  "ats_readiness": 80,
  "suggestions": {{
    "bullets": ["Suggestion 1", "Suggestion 2"],
    "structure": ["Structure suggestion"],
    "keywords": ["Missing keyword suggestion"],
    "format": ["Format improvement"]
  }},
  "quick_wins": ["Quick improvement 1"]
}}"""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.3, max_output_tokens=2000)
        )
        raw = response.text.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw).strip()
        return json.loads(raw)
    except Exception as ex:
        logger.error(f'Analysis error: {ex}')
        return {"error": "Could not analyze resume"}


def generate_cover_letter(resume_data: dict, job_description: str) -> str:
    """
    Generate a cover letter based on resume and job description.
    """
    if not job_description.strip():
        raise ValueError('Job description is required.')

    model = _get_model()
    
    prompt = f"""Write a compelling cover letter based on this resume and job description.

RESUME:
Name: {resume_data.get('name', 'Candidate')}
Role: {resume_data.get('target_role', '')}
Experience: {resume_data.get('career_stage', '')}

RESUME DATA:
{json.dumps(resume_data, indent=2)[:4000]}

JOB DESCRIPTION:
{job_description[:2000]}

Write a 3-4 paragraph cover letter that:
1. Opens with enthusiasm for the role
2. Highlights relevant experience with metrics
3. Shows alignment with company values
4. Closes with call to action

Professional tone, no placeholder brackets."""

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=0.4, max_output_tokens=800)
        )
        return response.text.strip()
    except Exception as ex:
        logger.error(f'Cover letter generation error: {ex}')
        raise RuntimeError(f'Failed to generate cover letter: {str(ex)}')
