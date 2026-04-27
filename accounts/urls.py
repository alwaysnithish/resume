"""
accounts/urls.py
User authentication routes.
"""
from django.urls import path
from . import views

app_name = 'accounts'

urlpatterns = [
    # Auth pages
    path('',                          views.login_view,           name='login'),

    # OTP API
    path('api/send-otp/',             views.send_otp,             name='send_otp'),
    path('api/resend-otp/',           views.resend_otp,           name='resend_otp'),
    path('api/verify-otp/',           views.verify_otp_view,      name='verify_otp'),

    # OAuth
    path('api/google-callback/',     views.google_auth_callback, name='google_callback'),

    # Account
    path('logout/',                   views.logout_view,          name='logout'),
    path('profile/',                  views.profile_view,         name='profile'),
    path('api/update-profile/',       views.update_profile,       name='update_profile'),
]
