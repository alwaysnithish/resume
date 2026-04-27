"""
resume/models.py
Resume and ResumeVersion models for QuantumCV.
"""
from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid


class Resume(models.Model):
    """A user's AI-generated resume with versioning support."""

    STATUS_CHOICES = [
        ('draft',     'Draft'),
        ('generated', 'Generated'),
        ('exported',  'Exported'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='resumes',
    )

    # Metadata
    title           = models.CharField(max_length=200, default='Untitled Resume')
    target_role     = models.CharField(max_length=200, blank=True)
    target_company  = models.CharField(max_length=200, blank=True)
    country         = models.CharField(max_length=100, default='India')

    # Input data
    raw_data        = models.TextField(blank=True)
    job_description = models.TextField(blank=True)

    # AI output
    generated_data  = models.JSONField(null=True, blank=True)

    # Lifecycle
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)
    last_exported   = models.DateTimeField(null=True, blank=True)

    # Scores
    ats_score           = models.IntegerField(null=True, blank=True)
    ai_confidence_score = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        owner = self.user.email if self.user_id else 'No user'
        return f'{self.title} — {owner}'

    @property
    def is_generated(self):
        return bool(self.generated_data)

    @property
    def ats_label(self):
        """Human-readable ATS quality label."""
        score = self.ats_score or 0
        if score >= 85:
            return 'Excellent'
        if score >= 70:
            return 'Good'
        if score >= 50:
            return 'Fair'
        return 'Needs Work'

    def create_version(self, label=''):
        """Snapshot current generated_data as a new ResumeVersion."""
        if not self.generated_data:
            return None
        last = self.versions.first()
        v_num = (last.version_number + 1) if last else 1
        return ResumeVersion.objects.create(
            resume=self,
            version_number=v_num,
            snapshot_data=self.generated_data,
            label=label or f'Version {v_num}',
        )


class ResumeVersion(models.Model):
    """Point-in-time snapshot of a Resume's generated_data."""

    resume         = models.ForeignKey(Resume, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField(default=1)
    snapshot_data  = models.JSONField()
    label          = models.CharField(max_length=120, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']

    def __str__(self):
        return f'{self.resume.title} v{self.version_number}'
