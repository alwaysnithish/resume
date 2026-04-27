"""
accounts/apps.py
Django app configuration for user authentication.
"""
from django.apps import AppConfig


class AccountsConfig(AppConfig):
    """Configuration for the accounts app."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'
    verbose_name = 'User Accounts'

    def ready(self):
        """Import signals when app is ready."""
        pass
