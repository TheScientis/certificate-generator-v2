import { IEmailConfig, IEmailTemplate } from './types';

/**
 * Default email configuration
 */
export const DEFAULT_EMAIL_CONFIG: IEmailConfig = {
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: Number.parseInt(process.env.SMTP_PORT || '587'),
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  fromName: process.env.EMAIL_FROM_NAME || 'Certificate Generator',
  fromAddress: process.env.EMAIL_FROM_ADDRESS || '',
  subjectTemplate:
    process.env.EMAIL_SUBJECT_TEMPLATE || 'Your Certificate - {eventTitle}',
  enabled: process.env.EMAIL_ENABLED === 'true',
};

/**
 * Default email template
 */
export const DEFAULT_EMAIL_TEMPLATE: IEmailTemplate = {
  subject: 'Your Certificate - {eventTitle}',
  html: `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Certificate</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: #f8f9fa;
          padding: 20px;
          text-align: center;
          border-radius: 8px;
          margin-bottom: 20px;
        }
        .content {
          padding: 20px 0;
        }
        .certificate-info {
          background-color: #e9ecef;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          font-size: 14px;
          color: #6c757d;
        }
        .button {
          display: inline-block;
          background-color: #007bff;
          color: white;
          padding: 10px 20px;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Certificate of Completion</h1>
      </div>

      <div class="content">
        <p>Dear {participantName},</p>

        <p>Congratulations! You have successfully completed the event <strong>{eventTitle}</strong>.</p>

        <div class="certificate-info">
          <h3>Certificate Details</h3>
          <p><strong>Participant:</strong> {participantName}</p>
          <p><strong>Event:</strong> {eventTitle}</p>
          <p><strong>Certificate ID:</strong> {certificateId}</p>
          <p><strong>Date:</strong> {eventDate}</p>
        </div>

        <p>Your certificate is attached to this email. Please keep it safe as proof of your completion.</p>

        <p>If you have any questions, please don't hesitate to contact us.</p>

        <p>Best regards,<br>
        Certificate Generator Team</p>
      </div>

      <div class="footer">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `,
  text: `
    Certificate of Completion

    Dear {participantName},

    Congratulations! You have successfully completed the event "{eventTitle}".

    Certificate Details:
    - Participant: {participantName}
    - Event: {eventTitle}
    - Certificate ID: {certificateId}
    - Date: {eventDate}

    Your certificate is attached to this email. Please keep it safe as proof of your completion.

    If you have any questions, please don't hesitate to contact us.

    Best regards,
    Certificate Generator Team

    ---
    This is an automated message. Please do not reply to this email.
  `,
};

/**
 * Validate email configuration
 */
export function validateEmailConfig(config: Partial<IEmailConfig>): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.smtpHost) {
    errors.push('SMTP host is required');
  }

  if (!config.smtpPort || config.smtpPort < 1 || config.smtpPort > 65535) {
    errors.push('SMTP port must be between 1 and 65535');
  }

  if (!config.smtpUser) {
    errors.push('SMTP username is required');
  }

  if (!config.smtpPass) {
    errors.push('SMTP password is required');
  }

  if (!config.fromAddress) {
    errors.push('From email address is required');
  } else if (!isValidEmail(config.fromAddress)) {
    errors.push('From email address is invalid');
  }

  if (!config.fromName) {
    errors.push('From name is required');
  }

  if (!config.subjectTemplate) {
    errors.push('Subject template is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,24}$/;
  return emailRegex.test(email);
}

/**
 * Load email configuration from environment variables
 */
export function loadEmailConfigFromEnv(): IEmailConfig {
  return {
    smtpHost: process.env.SMTP_HOST || DEFAULT_EMAIL_CONFIG.smtpHost,
    smtpPort: Number.parseInt(
      process.env.SMTP_PORT || DEFAULT_EMAIL_CONFIG.smtpPort.toString()
    ),
    smtpSecure: process.env.SMTP_SECURE === 'true',
    smtpUser: process.env.SMTP_USER || DEFAULT_EMAIL_CONFIG.smtpUser,
    smtpPass: process.env.SMTP_PASS || DEFAULT_EMAIL_CONFIG.smtpPass,
    fromName: process.env.EMAIL_FROM_NAME || DEFAULT_EMAIL_CONFIG.fromName,
    fromAddress:
      process.env.EMAIL_FROM_ADDRESS || DEFAULT_EMAIL_CONFIG.fromAddress,
    subjectTemplate:
      process.env.EMAIL_SUBJECT_TEMPLATE ||
      DEFAULT_EMAIL_CONFIG.subjectTemplate,
    enabled: process.env.EMAIL_ENABLED === 'true',
  };
}

/**
 * Merge configuration with defaults
 */
export function mergeEmailConfig(
  userConfig: Partial<IEmailConfig>,
  defaultConfig: IEmailConfig = DEFAULT_EMAIL_CONFIG
): IEmailConfig {
  return {
    ...defaultConfig,
    ...userConfig,
  };
}

/**
 * Get email configuration for an event
 */
export function getEventEmailConfig(eventConfig?: IEmailConfig): IEmailConfig {
  if (eventConfig) {
    return mergeEmailConfig(eventConfig);
  }

  return loadEmailConfigFromEnv();
}

/**
 * Check if email is enabled
 */
export function isEmailEnabled(config?: IEmailConfig): boolean {
  const emailConfig = config || loadEmailConfigFromEnv();
  return (
    emailConfig.enabled && !!emailConfig.smtpHost && !!emailConfig.smtpUser
  );
}

/**
 * Sanitize email configuration for logging (remove sensitive data)
 */
export function sanitizeEmailConfigForLogging(
  config: IEmailConfig
): Partial<IEmailConfig> {
  return {
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    fromName: config.fromName,
    fromAddress: config.fromAddress,
    subjectTemplate: config.subjectTemplate,
    enabled: config.enabled,
    // Exclude smtpUser and smtpPass for security
  };
}
