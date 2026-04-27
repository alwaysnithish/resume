"""resume/urls.py"""
from django.urls import path
from . import views

app_name = 'resume'

urlpatterns = [
    # ── Pages ─────────────────────────────────────────────
    path('dashboard/',                views.dashboard, name='dashboard'),
    path('builder/',                  views.builder,   name='builder_new'),
    path('builder/<uuid:resume_id>/', views.builder,   name='builder'),

    # ── CRUD ──────────────────────────────────────────────
    path('api/create/',                       views.create_resume, name='create'),
    path('api/save/<uuid:resume_id>/',        views.save_resume,   name='save'),
    path('api/delete/<uuid:resume_id>/',      views.delete_resume, name='delete'),

    # ── AI ────────────────────────────────────────────────
    path('api/generate/',             views.generate_resume_view, name='generate'),
    path('api/enhance-bullet/',       views.enhance_bullet_view,  name='enhance_bullet'),
    path('api/chat/',                 views.chat_resume_view,     name='chat'),
    path('api/chat-detailed/',        views.chat_edit_detailed,   name='chat_edit_detailed'),
    path('api/suggestions/',          views.get_resume_suggestions, name='suggestions'),
    path('api/cover-letter/',         views.generate_cover_letter_endpoint, name='cover_letter'),

    # ── Export ────────────────────────────────────────────
    path('api/export/<uuid:resume_id>/',         views.export_pdf,         name='export_pdf'),
    path('api/export-current/<uuid:resume_id>/', views.export_pdf_current, name='export_pdf_current'),

    # ── Versions ──────────────────────────────────────────
    path('api/versions/<uuid:resume_id>/',                 views.version_history, name='versions'),
    path('api/restore/<uuid:resume_id>/<int:version_id>/', views.restore_version, name='restore'),
]
