"""
accounts/utils.py
OTP generation, sending, and verification utilities.
"""
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
from .models import OTPSession
import random
import string
import logging

logger = logging.getLogger(__name__)


def generate_otp(length: int = 6) -> str:
    """Generate a random numeric OTP."""
    return ''.join(random.choices(string.digits, k=length))


def send_otp_email(email: str, code: str) -> bool:
    """
    Send OTP via email.
    Returns True if sent successfully, False otherwise.
    """
    subject = '🔐 Your QuantumCV Verification Code'
    
    plain_message = f"""Your QuantumCV verification code is:

{code}

This code expires in {settings.OTP_EXPIRY_MINUTES} minutes.
If you didn't request this, you can safely ignore this email.

— QuantumCV Team
"""

    html_message = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }}
    .card {{
      max-width: 480px;
      margin: 40px auto;
      background: white;
      border-radius: 16px;
      padding: 40px;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
    }}
    .logo {{
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 28px;
    }}
    .logo-icon {{
      width: 38px;
      height: 38px;
      background: #2563EB;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 1rem;
      font-weight: 700;
    }}
    .logo-text {{
      font-size: 1.1rem;
      font-weight: 800;
      color: #0f172a;
      letter-spacing: -0.5px;
    }}
    h2 {{
      font-size: 1.4rem;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
    }}
    .subtitle {{
      color: #64748b;
      margin: 0 0 28px;
      line-height: 1.6;
      font-size: 0.95rem;
    }}
    .otp-box {{
      background: #eff6ff;
      border: 2px dashed #bfdbfe;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin-bottom: 24px;
    }}
    .otp-code {{
      font-size: 2.5rem;
      font-weight: 800;
      color: #2563EB;
      letter-spacing: 0.3em;
      font-family: 'Monaco', 'Courier New', monospace;
      margin: 0;
    }}
    .expiry {{
      color: #94a3b8;
      font-size: 0.8rem;
      margin-top: 12px;
    }}
    .footer {{
      margin-top: 32px;
      padding-top: 20px;
      border-top: 1px solid #f1f5f9;
      font-size: 0.8rem;
      color: #cbd5e1;
      line-height: 1.6;
    }}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <div class="logo-icon">✦</div>
      <span class="logo-text">QuantumCV</span>
    </div>
    <h2>Your Verification Code</h2>
    <p class="subtitle">Use this code to sign in to QuantumCV. It expires in {settings.OTP_EXPIRY_MINUTES} minutes.</p>
    <div class="otp-box">
      <p class="otp-code">{code}</p>
      <div class="expiry">⏱ Expires in {settings.OTP_EXPIRY_MINUTES} minutes</div>
    </div>
    <div class="footer">
      <p>If you didn't request this code, you can safely ignore this email. Your account remains secure.</p>
      <p style="margin-top: 16px; font-size: 0.7rem;">
        © 2026 QuantumCV. All rights reserved. | 
        <a href="#" style="color: #64748b; text-decoration: none;">Privacy Policy</a>
      </p>
    </div>
  </div>
</body>
</html>"""

    try:
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            html_message=html_message,
            fail_silently=False,
        )
        return True
    except Exception as ex:
        logger.error(f'Failed to send OTP email to {email}: {ex}')
        return False


def create_and_send_otp(email: str, full_name: str = '') -> tuple[bool, str]:
    """
    Create OTP session and send email.
    Returns (success, message).
    """
    # Rate limit: max 3 OTPs per email per 15 minutes
    recent_count = OTPSession.objects.filter(
        email=email.lower(),
        created_at__gte=timezone.now() - timedelta(minutes=15)
    ).count()

    if recent_count >= 3:
        return False, 'Too many attempts. Please wait 15 minutes before trying again.'

    # Generate OTP and create session
    code = generate_otp()
    expires_at = timezone.now() + timedelta(minutes=settings.OTP_EXPIRY_MINUTES)

    OTPSession.objects.create(
        email=email.lower(),
        code=code,
        full_name=full_name,
        expires_at=expires_at
    )

    # Send email
    sent = send_otp_email(email.lower(), code)
    if not sent:
        # In development, log the OTP to console
        logger.warning(f'[DEV] OTP for {email}: {code}')
        return False, 'Failed to send email. Please try again later.'

    return True, 'Verification code sent to your email.'


def verify_otp(email: str, code: str) -> tuple[bool, str]:
    """
    Verify OTP code and mark as used.
    Returns (success, message).
    """
    email = email.lower()

    try:
        session = OTPSession.objects.filter(
            email=email,
            code=code,
            used=False
        ).latest('created_at')
    except OTPSession.DoesNotExist:
        return False, 'No matching OTP found. Please request a new code.'

    if not session.is_valid():
        session.used = True
        session.save(update_fields=['used'])
        return False, 'Code has expired. Please request a new one.'

    # Mark as used
    session.used = True
    session.save(update_fields=['used'])

    return True, 'Verified successfully.'


def cleanup_expired_otps() -> int:
    """
    Delete expired OTP sessions.
    Returns count of deleted sessions.
    """
    deleted_count, _ = OTPSession.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()
    return deleted_count
