"""
accounts/views.py
Passwordless email OTP authentication and Google OAuth integration.
"""
from django.shortcuts import render, redirect
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone
from django.conf import settings
import json
import logging
import requests

from .models import User, OTPSession
from .utils import create_and_send_otp, verify_otp

logger = logging.getLogger(__name__)


def login_view(request):
    """Render login page with Google OAuth client ID."""
    if request.user.is_authenticated:
        return redirect('resume:dashboard')

    return render(request, 'accounts/login.html', {
        'google_client_id': getattr(settings, 'GOOGLE_CLIENT_ID', ''),
    })


@require_POST
@csrf_protect
def send_otp(request):
    """
    API: Generate OTP and send to email.
    POST /api/send-otp/
    """
    try:
        data = json.loads(request.body)
        email = data.get('email', '').strip().lower()
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse(
            {'success': False, 'message': 'Invalid request.'},
            status=400
        )

    # Validate email format
    if not email or '@' not in email or '.' not in email.split('@')[1]:
        return JsonResponse(
            {'success': False, 'message': 'Please enter a valid email address.'},
            status=400
        )

    # Create and send OTP
    success, message = create_and_send_otp(email)
    if not success:
        return JsonResponse({'success': False, 'message': message}, status=429)

    # Store email in session for next step
    request.session['pending_otp_email'] = email
    request.session.set_expiry(600)  # 10 minutes

    return JsonResponse({
        'success': True,
        'message': message,
    })


@require_POST
@csrf_protect
def resend_otp(request):
    """
    API: Resend OTP to the email from current session.
    POST /api/resend-otp/
    """
    email = request.session.get('pending_otp_email', '').lower()
    if not email:
        return JsonResponse(
            {'success': False, 'message': 'Session expired. Please start again.'},
            status=400
        )

    success, message = create_and_send_otp(email)
    return JsonResponse({
        'success': success,
        'message': message,
    })


@require_POST
@csrf_protect
def verify_otp_view(request):
    """
    API: Verify OTP code and sign in user.
    POST /api/verify-otp/
    """
    try:
        data = json.loads(request.body)
        code = data.get('otp', '').strip()
        full_name = data.get('full_name', '').strip()
    except (json.JSONDecodeError, AttributeError):
        return JsonResponse({'success': False, 'message': 'Invalid request.'}, status=400)

    email = request.session.get('pending_otp_email', '').lower()
    if not email:
        return JsonResponse(
            {'success': False, 'message': 'Session expired. Please start again.'},
            status=400
        )

    # Verify OTP
    success, message = verify_otp(email, code)
    if not success:
        return JsonResponse({'success': False, 'message': message}, status=401)

    # Get or create user
    user, created = User.objects.get_or_create(email=email)

    # Update name if provided and not already set
    if full_name:
        if created or not user.full_name:
            user.full_name = full_name
            user.save(update_fields=['full_name'])

    # Update last login
    user.last_login = timezone.now()
    user.save(update_fields=['last_login'])

    # Sign in user
    login(request, user, backend='django.contrib.auth.backends.ModelBackend')

    # Clean up session
    if 'pending_otp_email' in request.session:
        del request.session['pending_otp_email']

    return JsonResponse({
        'success': True,
        'redirect': '/resume/dashboard/',
    })


@csrf_protect
def google_auth_callback(request):
    """
    Handle Google One Tap / OAuth callback.
    POST /api/google-callback/
    """
    credential = request.POST.get('credential') or request.GET.get('credential')
    if not credential:
        return redirect('/?error=no_credential')

    try:
        user_info = _verify_google_token(credential)
        if not user_info:
            logger.warning('Google token verification failed')
            return redirect('/?error=invalid_token')

        google_id = user_info.get('sub')
        email = user_info.get('email', '').lower()
        name = user_info.get('name', '')
        picture = user_info.get('picture', '')

        if not email or not google_id:
            logger.warning('Missing email or google_id in token')
            return redirect('/?error=missing_fields')

        # Find or create user
        user = User.objects.filter(google_id=google_id).first()
        if not user:
            user = User.objects.filter(email=email).first()

        if not user:
            user = User.objects.create_user(email=email, full_name=name)

        # Update Google fields
        user.google_id = google_id
        if name and not user.full_name:
            user.full_name = name
        if picture:
            user.avatar_url = picture
        user.last_login = timezone.now()
        user.save()

        # Sign in
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        return redirect('/resume/dashboard/')

    except Exception as ex:
        logger.error(f'Google OAuth error: {ex}', exc_info=True)
        return redirect('/?error=auth_failed')


def _verify_google_token(credential: str) -> dict:
    """
    Verify Google OAuth2 JWT token.
    Returns decoded token info or None if invalid.
    """
    try:
        # Try using google-auth library if available
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests

            client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
            if not client_id:
                return None

            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                client_id
            )
            return idinfo
        except ImportError:
            pass

        # Fallback: use Google's tokeninfo endpoint
        response = requests.get(
            f'https://oauth2.googleapis.com/tokeninfo?id_token={credential}',
            timeout=10
        )

        if response.status_code != 200:
            return None

        data = response.json()

        # Verify audience matches our client ID
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
        if client_id and data.get('aud') != client_id:
            logger.warning('Google token audience mismatch')
            return None

        return data

    except Exception as ex:
        logger.error(f'Token verification error: {ex}')
        return None


def logout_view(request):
    """Sign out user and redirect to login."""
    logout(request)
    return redirect('/')


@login_required(login_url='/')
def profile_view(request):
    """Display user profile page."""
    return render(request, 'accounts/profile.html', {
        'user': request.user,
    })


@login_required(login_url='/')
@require_POST
@csrf_protect
def update_profile(request):
    """
    API: Update user profile.
    POST /api/update-profile/
    """
    try:
        data = json.loads(request.body)
        full_name = data.get('full_name', '').strip()

        if full_name:
            request.user.full_name = full_name
            request.user.save(update_fields=['full_name'])

        return JsonResponse({'success': True})
    except Exception as ex:
        logger.error(f'Profile update error: {ex}')
        return JsonResponse({'success': False, 'message': str(ex)}, status=400)
