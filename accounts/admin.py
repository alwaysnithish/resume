"""
accounts/admin.py
Django admin interface for User and OTPSession models.
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import User, OTPSession


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """Admin interface for User model."""

    list_display = (
        'email',
        'full_name',
        'google_id_badge',
        'is_staff',
        'date_joined',
        'last_login',
    )
    list_filter = ('is_staff', 'is_active', 'date_joined')
    search_fields = ('email', 'full_name')
    ordering = ('-date_joined',)
    readonly_fields = ('id', 'date_joined', 'last_login')

    fieldsets = (
        ('Identity', {
            'fields': ('id', 'email', 'full_name', 'password')
        }),
        ('Profile', {
            'fields': ('avatar_url',)
        }),
        ('Google OAuth', {
            'fields': ('google_id',),
            'classes': ('collapse',)
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
            'classes': ('collapse',)
        }),
        ('Dates', {
            'fields': ('date_joined', 'last_login'),
            'classes': ('collapse',)
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'is_staff', 'is_active'),
        }),
    )

    def google_id_badge(self, obj):
        """Display Google OAuth status as a colored badge."""
        if obj.google_id:
            return format_html(
                '<span style="background:#34d399;color:white;padding:3px 8px;border-radius:4px;'
                'font-size:0.75rem;font-weight:600">Google</span>'
            )
        return format_html(
            '<span style="background:#cbd5e1;color:#475569;padding:3px 8px;border-radius:4px;'
            'font-size:0.75rem;font-weight:600">OTP</span>'
        )

    google_id_badge.short_description = 'Auth Method'


@admin.register(OTPSession)
class OTPSessionAdmin(admin.ModelAdmin):
    """Admin interface for OTPSession model."""

    list_display = ('email', 'code', 'status_badge', 'expires_at', 'created_at')
    list_filter = ('used', 'created_at', 'expires_at')
    search_fields = ('email', 'code')
    ordering = ('-created_at',)
    readonly_fields = ('email', 'code', 'created_at', 'expires_at', 'full_name')

    fieldsets = (
        ('OTP Details', {
            'fields': ('email', 'code', 'full_name')
        }),
        ('Status', {
            'fields': ('used', 'expires_at', 'created_at')
        }),
    )

    def status_badge(self, obj):
        """Display OTP status as a colored badge."""
        if obj.used:
            return format_html(
                '<span style="background:#cbd5e1;color:#475569;padding:3px 8px;border-radius:4px;'
                'font-size:0.75rem;font-weight:600">✓ Used</span>'
            )
        elif not obj.is_valid():
            return format_html(
                '<span style="background:#fecaca;color:#991b1b;padding:3px 8px;border-radius:4px;'
                'font-size:0.75rem;font-weight:600">✗ Expired</span>'
            )
        return format_html(
            '<span style="background:#a7f3d0;color:#065f46;padding:3px 8px;border-radius:4px;'
            'font-size:0.75rem;font-weight:600">● Active</span>'
        )

    status_badge.short_description = 'Status'

    def has_delete_permission(self, request):
        """Admins can delete OTP records."""
        return request.user.is_staff

    def has_add_permission(self, request):
        """Prevent manual OTP creation — only via API."""
        return False
