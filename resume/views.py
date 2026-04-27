"""
resume/views.py
All resume-related views for QuantumCV: dashboard, builder, CRUD,
AI generation, chat editing, PDF export, and version management.
"""
from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse, HttpResponse
from django.views.decorators.http import require_POST, require_GET
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone
import json
import logging

from .models import Resume, ResumeVersion
from ai_engine.gemini import generate_resume, enhance_bullet, chat_edit_resume
from pdf_engine.generator import generate_resume_pdf

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────

def _parse_body(request):
    """Parse JSON request body; raises ValueError on bad JSON."""
    try:
        return json.loads(request.body)
    except json.JSONDecodeError as exc:
        raise ValueError('Invalid JSON.') from exc


def _json_error(message, status=400):
    return JsonResponse({'success': False, 'message': message}, status=status)


def _pdf_filename(resume_data, resume_obj):
    name_slug = resume_data.get('name', 'resume').replace(' ', '_')
    role_slug = (resume_obj.target_role or '').replace(' ', '_')
    return f'QuantumCV_{name_slug}_{role_slug}.pdf'


# ─────────────────────────────────────────────────────────
# PAGE VIEWS
# ─────────────────────────────────────────────────────────

@login_required(login_url='/')
def dashboard(request):
    """Main resume listing / stats dashboard."""
    resumes = Resume.objects.filter(user=request.user)
    ats_scores = list(
        resumes.exclude(ats_score__isnull=True)
               .exclude(ats_score=0)
               .values_list('ats_score', flat=True)
    )
    stats = {
        'total':     resumes.count(),
        'generated': resumes.filter(status='generated').count(),
        'exported':  resumes.filter(status='exported').count(),
        'avg_ats':   int(sum(ats_scores) / len(ats_scores)) if ats_scores else 0,
    }
    return render(request, 'resume/dashboard.html', {
        'resumes': resumes[:20],
        'stats':   stats,
        'user':    request.user,
    })


@login_required(login_url='/')
def builder(request, resume_id=None):
    """Unified resume builder — handles both new and existing resumes."""
    resume = None
    if resume_id:
        resume = get_object_or_404(Resume, id=resume_id, user=request.user)

    return render(request, 'resume/builder.html', {
        'resume':      resume,
        'resume_json': json.dumps(resume.generated_data) if (resume and resume.generated_data) else 'null',
        'user':        request.user,
    })


# ─────────────────────────────────────────────────────────
# API — CRUD
# ─────────────────────────────────────────────────────────

@login_required(login_url='/')
@require_POST
@csrf_protect
def create_resume(request):
    """Create a bare-bones Resume record and return its ID."""
    try:
        data = _parse_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    resume = Resume.objects.create(
        user=request.user,
        title=data.get('title', 'Untitled Resume'),
        target_role=data.get('target_role', ''),
        country=data.get('country', 'India'),
        raw_data=data.get('raw_data', ''),
        job_description=data.get('job_description', ''),
        status='draft',
    )
    return JsonResponse({'success': True, 'resume_id': str(resume.id)})


@login_required(login_url='/')
@require_POST
@csrf_protect
def save_resume(request, resume_id):
    """Persist resume edits; auto-snapshots a version before overwriting."""
    resume = get_object_or_404(Resume, id=resume_id, user=request.user)

    try:
        data = _parse_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    # Snapshot before overwrite
    if resume.generated_data:
        resume.create_version(label='Auto-save')

    resume.title           = data.get('title', resume.title)
    resume.generated_data  = data.get('generated_data', resume.generated_data)
    resume.raw_data        = data.get('raw_data', resume.raw_data)
    resume.job_description = data.get('job_description', resume.job_description)
    resume.save()

    return JsonResponse({
        'success':    True,
        'message':    'Saved.',
        'updated_at': resume.updated_at.strftime('%b %d, %H:%M'),
    })


@login_required(login_url='/')
@require_POST
def delete_resume(request, resume_id):
    """Hard-delete a resume."""
    resume = get_object_or_404(Resume, id=resume_id, user=request.user)
    resume.delete()
    return JsonResponse({'success': True})


# ─────────────────────────────────────────────────────────
# API — AI OPERATIONS
# ─────────────────────────────────────────────────────────

@login_required(login_url='/')
@require_POST
@csrf_protect
def generate_resume_view(request):
    """Trigger Gemini AI to generate a structured resume from raw career data."""
    try:
        data = _parse_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    raw_data        = data.get('raw_data', '').strip()
    job_description = data.get('job_description', '').strip()
    country         = data.get('country', 'India')
    role            = data.get('role', 'Software Engineer')
    resume_id       = data.get('resume_id')

    if not raw_data:
        return _json_error('Career data is required.')

    try:
        result = generate_resume(raw_data, job_description, country, role)
    except ValueError as exc:
        return _json_error(str(exc))
    except RuntimeError as exc:
        return _json_error(str(exc), status=503)
    except Exception as exc:
        logger.error('AI generation error: %s', exc, exc_info=True)
        return _json_error('Generation failed. Please try again.', status=500)

    # Upsert the Resume record
    resume = None
    if resume_id:
        resume = Resume.objects.filter(id=resume_id, user=request.user).first()

    common_fields = dict(
        generated_data      = result,
        raw_data            = raw_data,
        job_description     = job_description,
        status              = 'generated',
        ai_confidence_score = result.get('ai_confidence', 0),
        ats_score           = result.get('ats_score', 0),
        title               = f"{result.get('name', 'Resume')} — {role}",
        target_role         = role,
    )

    if resume:
        for k, v in common_fields.items():
            setattr(resume, k, v)
        resume.save()
    else:
        resume = Resume.objects.create(
            user=request.user,
            country=country,
            **common_fields,
        )

    return JsonResponse({'success': True, 'resume_id': str(resume.id), 'data': result})


@login_required(login_url='/')
@require_POST
@csrf_protect
def enhance_bullet_view(request):
    """AI-enhance a single bullet point."""
    try:
        data = _parse_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    bullet  = data.get('bullet', '').strip()
    context = data.get('context', '').strip()

    if not bullet:
        return _json_error('Bullet text is required.')

    try:
        improved = enhance_bullet(bullet, context)
        return JsonResponse({'success': True, 'improved': improved})
    except Exception as exc:
        logger.error('Bullet enhance error: %s', exc, exc_info=True)
        return _json_error(str(exc), status=500)


@login_required(login_url='/')
@require_POST
@csrf_protect
def chat_resume_view(request):
    """Apply a natural-language instruction to the current resume via AI."""
    try:
        data = _parse_body(request)
    except ValueError as exc:
        return _json_error(str(exc))

    instruction  = data.get('message', '').strip()
    current_data = data.get('current_data')
    resume_id    = data.get('resume_id')

    if not instruction:
        return _json_error('Message is required.')
    if not current_data:
        return _json_error('No resume data to edit.')

    try:
        updated_data, reply = chat_edit_resume(current_data, instruction)
    except Exception as exc:
        logger.error('Chat edit error: %s', exc, exc_info=True)
        return _json_error('AI edit failed. Please try again.', status=500)

    # Persist if we know the resume
    if resume_id:
        resume = Resume.objects.filter(id=resume_id, user=request.user).first()
        if resume:
            resume.create_version(label=f'Chat: {instruction[:50]}')
            resume.generated_data = updated_data
            resume.ats_score      = updated_data.get('ats_score', resume.ats_score)
            resume.save()

    return JsonResponse({'success': True, 'data': updated_data, 'reply': reply})


# ─────────────────────────────────────────────────────────
# API — PDF EXPORT
# ─────────────────────────────────────────────────────────

@login_required(login_url='/')
def export_pdf(request, resume_id):
    """Export the stored resume_data as a PDF attachment."""
    resume = get_object_or_404(Resume, id=resume_id, user=request.user)
    if not resume.generated_data:
        return _json_error('No resume data to export.')

    return _build_pdf_response(resume, resume.generated_data)


@login_required(login_url='/')
@require_POST
@csrf_protect
def export_pdf_current(request, resume_id):
    """Export from the request body — uses the browser's latest state."""
    resume = get_object_or_404(Resume, id=resume_id, user=request.user)

    try:
        body        = _parse_body(request)
        resume_data = body.get('generated_data') or resume.generated_data
    except ValueError:
        resume_data = resume.generated_data

    if not resume_data:
        return _json_error('No resume data to export.')

    # Persist the latest state before generating PDF
    resume.generated_data = resume_data
    resume.save(update_fields=['generated_data', 'updated_at'])

    return _build_pdf_response(resume, resume_data)


def _build_pdf_response(resume, resume_data):
    """Generate PDF bytes and wrap in an HttpResponse."""
    try:
        pdf_bytes = generate_resume_pdf(resume_data, resume)
    except Exception as exc:
        logger.error('PDF generation error: %s', exc, exc_info=True)
        return _json_error('PDF generation failed.', status=500)

    resume.status        = 'exported'
    resume.last_exported = timezone.now()
    resume.save(update_fields=['status', 'last_exported'])

    filename = _pdf_filename(resume_data, resume)
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


# ─────────────────────────────────────────────────────────
# API — VERSION HISTORY
# ─────────────────────────────────────────────────────────

@login_required(login_url='/')
def version_history(request, resume_id):
    """Return the 15 most recent versions of a resume."""
    resume   = get_object_or_404(Resume, id=resume_id, user=request.user)
    versions = resume.versions.all()[:15]
    return JsonResponse({
        'versions': [
            {
                'id':             v.id,
                'version_number': v.version_number,
                'label':          v.label,
                'created_at':     v.created_at.strftime('%b %d, %Y %H:%M'),
            }
            for v in versions
        ]
    })


@login_required(login_url='/')
def restore_version(request, resume_id, version_id):
    """Restore a resume to a specific version snapshot."""
    resume  = get_object_or_404(Resume, id=resume_id, user=request.user)
    version = get_object_or_404(ResumeVersion, id=version_id, resume=resume)

    # Snapshot current state before restoring
    resume.create_version(label='Before restore')
    resume.generated_data = version.snapshot_data
    resume.save()

    return JsonResponse({'success': True, 'data': version.snapshot_data})


# ─────────────────────────────────────────────────────────
# ADVANCED AI EDITING
# ─────────────────────────────────────────────────────────

@require_POST
@login_required
@csrf_protect
def chat_edit_detailed(request):
    """
    Advanced resume editing with support for:
    - Tables (create, edit rows/columns)
    - Skill bars/dots/tags (add, modify percentages)
    - Batch operations
    - Complex edits
    """
    try:
        data = _parse_body(request)
        resume_id = data.get('resume_id')
        instruction = data.get('instruction', '').strip()

        if not instruction:
            return JsonResponse(
                {'success': False, 'error': 'Instruction is required'},
                status=400
            )

        resume = get_object_or_404(Resume, id=resume_id, user=request.user)

        # Call enhanced AI
        from ai_engine.gemini import chat_edit_resume
        updated_data, reply_message = chat_edit_resume(
            resume.generated_data,
            instruction
        )

        # Save changes
        resume.generated_data = updated_data
        resume.save()

        # Create version
        resume.create_version(f"AI edit: {instruction[:50]}")

        return JsonResponse({
            'success': True,
            'data': updated_data,
            'message': reply_message,
        })
    except Exception as ex:
        logger.error(f'Chat edit detailed error: {ex}', exc_info=True)
        return JsonResponse(
            {'success': False, 'error': str(ex)},
            status=400
        )


@require_GET
@login_required
def get_resume_suggestions(request):
    """Get AI-generated improvement suggestions for a resume."""
    try:
        resume_id = request.GET.get('id')
        if not resume_id:
            return JsonResponse(
                {'success': False, 'error': 'Resume ID required'},
                status=400
            )

        resume = get_object_or_404(Resume, id=resume_id, user=request.user)

        from ai_engine.gemini import analyze_resume_for_improvements
        suggestions = analyze_resume_for_improvements(resume.generated_data)

        return JsonResponse({
            'success': True,
            'suggestions': suggestions
        })
    except Exception as ex:
        logger.error(f'Suggestions error: {ex}', exc_info=True)
        return JsonResponse(
            {'success': False, 'error': str(ex)},
            status=400
        )


@require_POST
@login_required
@csrf_protect
def generate_cover_letter_endpoint(request):
    """Generate cover letter for a job based on resume."""
    try:
        data = _parse_body(request)
        resume_id = data.get('resume_id')
        job_description = data.get('job_description', '').strip()

        if not resume_id or not job_description:
            return JsonResponse(
                {'success': False, 'error': 'Resume ID and job description required'},
                status=400
            )

        resume = get_object_or_404(Resume, id=resume_id, user=request.user)

        from ai_engine.gemini import generate_cover_letter
        cover_letter = generate_cover_letter(
            resume.generated_data,
            job_description
        )

        return JsonResponse({
            'success': True,
            'cover_letter': cover_letter
        })
    except Exception as ex:
        logger.error(f'Cover letter generation error: {ex}', exc_info=True)
        return JsonResponse(
            {'success': False, 'error': str(ex)},
            status=400
        )
