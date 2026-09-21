"""
SMTP Email Dispatch Service for CyberGuardian AI.
Supports sending HTML & plain text verification emails via SMTP (Gmail, SendGrid, Mailgun, or custom relays).
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_verification_email_smtp(recipient_email: str, confirmation_link: str) -> bool:
    """
    Sends an ownership verification email to the user via SMTP if configured.
    Returns True if sent via SMTP, or False if SMTP settings are missing (fallback mode).
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.info(
            f"[EMAIL DEV FALLBACK] SMTP credentials not set in .env. Verification email for {recipient_email}:\n"
            f"Link: {confirmation_link}"
        )
        print("\n" + "=" * 60)
        print(f"[EMAIL DISPATCH] RECIPIENT: {recipient_email}")
        print(f"[EMAIL DISPATCH] CONFIRMATION LINK: {confirmation_link}")
        print("=" * 60 + "\n")
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Verify Ownership - CyberGuardian AI Breach Monitoring"
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = recipient_email

        plain_text = (
            f"Hello,\n\n"
            f"Please verify your email address to enable breach and identity monitoring on CyberGuardian AI.\n\n"
            f"Click the link below to confirm ownership:\n"
            f"{confirmation_link}\n\n"
            f"If you did not request this monitoring, please ignore this email.\n\n"
            f"Best regards,\n"
            f"CyberGuardian AI Security Team"
        )

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f5f6; margin: 0; padding: 40px 20px; }}
            .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
            .header {{ text-align: center; padding-bottom: 24px; border-bottom: 1px solid #f1f5f9; }}
            .brand {{ font-size: 20px; font-weight: 800; color: #1f57e7; letter-spacing: 1px; text-transform: uppercase; }}
            .content {{ padding: 32px 0; color: #1e293b; line-height: 1.6; font-size: 15px; }}
            .btn-container {{ text-align: center; margin: 32px 0; }}
            .btn {{ background: linear-gradient(135deg, #1f57e7, #3b82f6); color: #ffffff !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 4px 14px rgba(31, 87, 231, 0.35); }}
            .footer {{ font-size: 12px; color: #64748b; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 24px; margin-top: 24px; }}
            .link-alt {{ font-size: 12px; word-break: break-all; color: #3b82f6; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="brand">🛡️ CyberGuardian AI</div>
            </div>
            <div class="content">
              <h2 style="color: #0f172a; margin-top: 0;">Confirm Email Ownership</h2>
              <p>You recently added <strong>{recipient_email}</strong> to CyberGuardian AI for automated breach &amp; dark web exposure monitoring.</p>
              <p>Click the button below to confirm email ownership and activate live threat logs:</p>
              <div class="btn-container">
                <a href="{confirmation_link}" class="btn" target="_blank">Verify Email Address</a>
              </div>
              <p style="font-size: 13px; color: #475569;">If the button does not work, copy and paste this verification URL into your browser:</p>
              <p class="link-alt">{confirmation_link}</p>
            </div>
            <div class="footer">
              &copy; CyberGuardian AI. All rights reserved.<br>
              Automated Security Audit &amp; Threat Remediation Platform
            </div>
          </div>
        </body>
        </html>
        """

        msg.attach(MIMEText(plain_text, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        if settings.SMTP_SSL:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
            if settings.SMTP_TLS:
                server.starttls()

        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.EMAILS_FROM_EMAIL or settings.SMTP_USER, [recipient_email], msg.as_string())
        server.quit()

        logger.info(f"Verification email successfully dispatched via SMTP to {recipient_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to dispatch SMTP email to {recipient_email}: {str(e)}")
        print(f"[SMTP ERROR] {str(e)}")
        return False
