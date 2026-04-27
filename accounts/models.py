"""
accounts/models.py
User authentication model and OTP session storage.
"""
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone
import uuid


class UserManager(BaseUserManager):
    """Custom user manager for email-based authentication."""

    def create_user(self, email, full_name='', **extra_fields):
        """Create and save a regular user."""
        if not email:
            raise ValueError('Email is required.')
        email = self.normalize_email(email.lower())
        user = self.model(email=email, full_name=full_name, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Create and save a superuser (admin)."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        user = self.model(email=self.normalize_email(email.lower()), **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model with email-based auth, Google OAuth, and OTP support.
    No password required — auth via OTP or Google.
    """

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email        = models.EmailField(unique=True)
    full_name    = models.CharField(max_length=255, blank=True)

    # Google OAuth
    google_id    = models.CharField(max_length=255, blank=True, unique=True, null=True)
    avatar_url   = models.URLField(blank=True)

    # Account status
    is_active    = models.BooleanField(default=True)
    is_staff     = models.BooleanField(default=False)
    date_joined  = models.DateTimeField(default=timezone.now)
    last_login   = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = []
    objects         = UserManager()

    class Meta:
        ordering = ['-date_joined']
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return self.email

    @property
    def avatar_initials(self):
        """Generate initials from full_name for avatar display."""
        if self.full_name:
            parts = self.full_name.strip().split()
            if len(parts) >= 2:
                return (parts[0][0] + parts[-1][0]).upper()
            return parts[0][0].upper() if parts else 'U'
        return self.email[0].upper()

    @property
    def display_name(self):
        """Return full_name if set, otherwise email prefix."""
        return self.full_name or self.email.split('@')[0]


class OTPSession(models.Model):
    """
    Temporary OTP storage for passwordless email sign-in.
    Auto-cleaned after expiry.
    """

    email      = models.EmailField(db_index=True)
    code       = models.CharField(max_length=6)
    full_name  = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(db_index=True)
    used       = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'OTP Session'
        verbose_name_plural = 'OTP Sessions'
        indexes = [
            models.Index(fields=['email', 'used', 'expires_at']),
        ]

    def __str__(self):
        return f'{self.email} ({self.code})'

    def is_valid(self):
        """Check if OTP is still valid and unused."""
        return not self.used and self.expires_at > timezone.now()
