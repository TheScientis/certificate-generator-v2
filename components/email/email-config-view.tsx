'use client';

import { useState, useEffect } from 'react';
import { IEvent, IEmailConfig, IEmailTemplate } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  ArrowLeft,
  Mail,
  Settings,
  TestTube,
  CheckCircle,
  XCircle,
  Save,
} from 'lucide-react';
import {
  testEmailConfiguration,
  updateEventEmailConfig,
  updateEventEmailTemplate,
} from '@/lib/actions';
import { toast } from '@/hooks/use-toast';

// Utility function to validate if template HTML has unscoped styles
function validateTemplateStyles(html: string): {
  isValid: boolean;
  errors: string[];
  unscopedSelectors: string[];
} {
  const errors: string[] = [];
  const unscopedSelectors: string[] = [];

  // Check if template has styles
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) {
    return { isValid: true, errors: [], unscopedSelectors: [] };
  }

  const styleContent = styleMatch[1];
  const hasWrapper = html.includes('email-template-wrapper');

  // Check for unscoped body selector
  if (styleContent.match(/\bbody\s*\{/)) {
    unscopedSelectors.push('body');
    errors.push('Unscoped "body" selector found - will affect entire page');
  }

  // Check for unscoped generic selectors (h1, h2, p, div, etc.)
  const genericSelectors = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'div',
    'span',
    'a',
    'ul',
    'ol',
    'li',
    'table',
    'tr',
    'td',
    'th',
  ];
  genericSelectors.forEach((selector) => {
    const regex = new RegExp(`(^|\\n|\\s|,)\\s*${selector}\\s*\\{`, 'g');
    if (
      regex.test(styleContent) &&
      !styleContent.includes(`.email-template-wrapper ${selector}`)
    ) {
      unscopedSelectors.push(selector);
    }
  });

  // Check for unscoped class/id selectors that aren't prefixed
  const classIdRegex = /([.#][a-zA-Z][\w-]*)\s*\{/g;
  let match;
  while ((match = classIdRegex.exec(styleContent)) !== null) {
    const selector = match[1];
    // Skip if already scoped or is the wrapper itself
    if (
      !selector.includes('email-template-wrapper') &&
      !styleContent.includes(`.email-template-wrapper ${selector}`) &&
      !styleContent.includes(`.email-template-wrapper${selector}`)
    ) {
      unscopedSelectors.push(selector);
    }
  }

  if (unscopedSelectors.length > 0 && !hasWrapper) {
    errors.push(
      `Found ${unscopedSelectors.length} unscoped style selector(s) that may affect the entire page`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    unscopedSelectors: Array.from(new Set(unscopedSelectors)),
  };
}

// Utility function to scope template HTML styles to prevent leaking to the page
function scopeTemplateStyles(html: string): string {
  // If already scoped, return as is
  if (html.includes('email-template-wrapper')) {
    return html;
  }

  // Extract style tag content
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) {
    // No styles found, just wrap content
    return `<div class="email-template-wrapper">${html}</div>`;
  }

  const styleContent = styleMatch[1];
  const scopedStyleContent = styleContent
    // Scope body selector
    .replace(/\bbody\s*\{/g, '.email-template-wrapper {')
    // Scope other selectors that aren't already scoped
    .replace(
      /(^|\n)(\s*)([.#]?[a-zA-Z][\w-]*)\s*\{/g,
      (match, prefix, indent, selector) => {
        // Skip if already scoped
        if (selector.includes('email-template-wrapper')) {
          return match;
        }
        // Skip if it's a class/id that starts with email-template
        if (selector.startsWith('email-template')) {
          return match;
        }
        // Scope the selector
        return `${prefix}${indent}.email-template-wrapper ${selector} {`;
      }
    );

  // Replace style tag with scoped version
  const scopedHtml = html.replace(
    /<style[^>]*>[\s\S]*?<\/style>/i,
    `<style>${scopedStyleContent}</style>`
  );

  // Wrap entire content if not already wrapped
  if (!scopedHtml.includes('email-template-wrapper')) {
    return `<div class="email-template-wrapper">${scopedHtml}</div>`;
  }

  return scopedHtml;
}

interface EmailConfigViewProps {
  event: IEvent;
  onBack: () => void;
  onConfigUpdate?: () => void;
}

export function EmailConfigView({
  event,
  onBack,
  onConfigUpdate,
}: EmailConfigViewProps) {
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates'>('smtp');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [templateValidationError, setTemplateValidationError] = useState<{
    hasError: boolean;
    message: string;
    autoFixed: boolean;
  } | null>(null);

  const [config, setConfig] = useState<IEmailConfig>({
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: Number.parseInt(process.env.SMTP_PORT || '587'),
    smtpSecure: false,
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Certificate Generator',
    fromAddress: process.env.EMAIL_FROM_ADDRESS || '',
    subjectTemplate: 'Your Certificate - {eventTitle}',
    enabled: process.env.EMAIL_ENABLED === 'true',
  });

  const [template, setTemplate] = useState<IEmailTemplate>({
    subject: 'Your Certificate - {eventTitle}',
    html: `
      <div class="email-template-wrapper">
        <style>
          .email-template-wrapper {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .email-template-wrapper .header {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            border-radius: 8px;
            margin-bottom: 20px;
          }
          .email-template-wrapper .content {
            padding: 20px 0;
          }
          .email-template-wrapper .certificate-info {
            background-color: #e9ecef;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .email-template-wrapper .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            font-size: 14px;
            color: #6c757d;
          }
          .email-template-wrapper .button {
            display: inline-block;
            background-color: #007bff;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin: 10px 0;
          }
        </style>
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
          <p>Best regards,<br>Certificate Generator Team</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    `,
    text: `
      Dear {participantName},

      Congratulations! Your certificate for {eventTitle} is attached.
      Your Certificate ID is: {certificateId}

      Thank you for your participation.

      Best regards,
      The Certificate Generator Team
    `,
  });

  useEffect(() => {
    if (event.emailConfig) {
      setConfig(event.emailConfig);
    }
    if (event.emailTemplate) {
      setTemplate(event.emailTemplate);
    }
  }, [event.emailConfig, event.emailTemplate]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testEmailConfiguration(config);
      setTestResult({
        success: result.success,
        message: result.success
          ? 'Connection successful!'
          : result.error || 'Connection failed',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsLoading(true);

    try {
      await updateEventEmailConfig(event._id!.toString(), config);
      await updateEventEmailTemplate(event._id!.toString(), template);

      toast({
        title: 'Configuration Saved',
        description: 'Email configuration has been updated successfully.',
        variant: 'default',
      });

      onConfigUpdate?.();
    } catch (error) {
      toast({
        title: 'Save Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigChange = (field: keyof IEmailConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateChange = (field: keyof IEmailTemplate, value: string) => {
    // Validate HTML template for unscoped styles
    if (field === 'html' && value.trim()) {
      const validation = validateTemplateStyles(value);

      if (!validation.isValid) {
        // Auto-fix the template by scoping styles
        const fixedHtml = scopeTemplateStyles(value);
        const fixedValidation = validateTemplateStyles(fixedHtml);

        if (fixedValidation.isValid) {
          // Auto-fix successful
          setTemplate((prev) => ({ ...prev, [field]: fixedHtml }));
          setTemplateValidationError({
            hasError: false,
            message: `Template auto-fixed: ${validation.unscopedSelectors.length} unscoped selector(s) were automatically scoped to prevent page styling conflicts.`,
            autoFixed: true,
          });
          // Clear message after 5 seconds
          setTimeout(() => setTemplateValidationError(null), 5000);
          return;
        } else {
          // Auto-fix failed, show error
          setTemplateValidationError({
            hasError: true,
            message: `Template validation failed: ${validation.errors.join(
              '; '
            )}. Found unscoped selectors: ${validation.unscopedSelectors
              .slice(0, 5)
              .join(', ')}${
              validation.unscopedSelectors.length > 5 ? '...' : ''
            }. Please wrap your styles in a scoped container (e.g., .email-template-wrapper).`,
            autoFixed: false,
          });
          // Still set the template but warn the user
          setTemplate((prev) => ({ ...prev, [field]: value }));
          return;
        }
      } else {
        // Template is valid, clear any previous errors
        setTemplateValidationError(null);
      }
    } else if (field === 'html') {
      // Clear validation error if template is empty
      setTemplateValidationError(null);
    }

    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  const getConfigStatus = () => {
    if (!config.smtpHost || !config.smtpUser) return 'not-configured';
    if (!config.enabled) return 'disabled';
    if (!config.smtpHost || !config.smtpUser) return 'incomplete';
    return 'configured';
  };

  const configStatus = getConfigStatus();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4 flex-wrap">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Email Settings
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Configure email settings for {event.title}
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Configuration Status
          </CardTitle>
          <CardDescription>
            Current email configuration status for this event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {configStatus === 'configured' && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              {configStatus === 'disabled' && (
                <XCircle className="h-5 w-5 text-yellow-500" />
              )}
              {configStatus === 'incomplete' && (
                <XCircle className="h-5 w-5 text-orange-500" />
              )}
              {configStatus === 'not-configured' && (
                <XCircle className="h-5 w-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium">
                  {configStatus === 'configured' &&
                    'Email is configured and enabled'}
                  {configStatus === 'disabled' &&
                    'Email is configured but disabled'}
                  {configStatus === 'incomplete' &&
                    'Email configuration is incomplete'}
                  {configStatus === 'not-configured' &&
                    'Email is not configured'}
                </p>
                <p className="text-sm text-gray-500">
                  {configStatus === 'configured' &&
                    'Ready to send emails to participants'}
                  {configStatus === 'disabled' &&
                    'Enable email sending to start sending certificates'}
                  {configStatus === 'incomplete' &&
                    'Complete the configuration to enable email sending'}
                  {configStatus === 'not-configured' &&
                    'Set up email configuration to send certificates via email'}
                </p>
              </div>
            </div>
            <Badge
              variant={
                configStatus === 'configured'
                  ? 'default'
                  : configStatus === 'disabled'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {configStatus === 'configured' && 'Ready'}
              {configStatus === 'disabled' && 'Disabled'}
              {configStatus === 'incomplete' && 'Incomplete'}
              {configStatus === 'not-configured' && 'Not Set Up'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Email Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Email Configuration
          </CardTitle>
          <CardDescription>
            Configure SMTP settings and email templates for certificate
            distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
            <button
              type="button"
              onClick={() => setActiveTab('smtp')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'smtp'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              SMTP Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('templates')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Email Templates
            </button>
          </div>

          {/* SMTP Settings Content */}
          <div className={`space-y-6 ${activeTab !== 'smtp' ? 'hidden' : ''}`}>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled" className="text-sm font-medium">
                  Enable Email Sending
                </Label>
                <Switch
                  id="enabled"
                  checked={config.enabled}
                  onCheckedChange={(checked) =>
                    handleConfigChange('enabled', checked)
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={config.smtpHost}
                    onChange={(e) =>
                      handleConfigChange('smtpHost', e.target.value)
                    }
                    placeholder="smtp.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPort">SMTP Port</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={config.smtpPort}
                    onChange={(e) =>
                      handleConfigChange('smtpPort', Number.parseInt(e.target.value))
                    }
                    placeholder="587"
                  />
                </div>
              </div>

              {/* <div className="flex items-center space-x-2">
                <Switch
                  id="smtpSecure"
                  checked={config.smtpSecure}
                  onCheckedChange={(checked) =>
                    handleConfigChange('smtpSecure', checked)
                  }
                />
                <Label htmlFor="smtpSecure">Use SSL/TLS</Label>
              </div> */}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smtpUser">SMTP Username</Label>
                  <Input
                    id="smtpUser"
                    value={config.smtpUser}
                    onChange={(e) =>
                      handleConfigChange('smtpUser', e.target.value)
                    }
                    placeholder="your-email@gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="smtpPass">SMTP Password</Label>
                  <Input
                    id="smtpPass"
                    type="password"
                    value={config.smtpPass}
                    onChange={(e) =>
                      handleConfigChange('smtpPass', e.target.value)
                    }
                    placeholder="Your app password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    value={config.fromName}
                    onChange={(e) =>
                      handleConfigChange('fromName', e.target.value)
                    }
                    placeholder="Certificate Generator"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fromAddress">From Email Address</Label>
                  <Input
                    id="fromAddress"
                    type="email"
                    value={config.fromAddress}
                    onChange={(e) =>
                      handleConfigChange('fromAddress', e.target.value)
                    }
                    placeholder="noreply@yourdomain.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subjectTemplate">Subject Template</Label>
                <Input
                  id="subjectTemplate"
                  value={config.subjectTemplate}
                  onChange={(e) =>
                    handleConfigChange('subjectTemplate', e.target.value)
                  }
                  placeholder="Your Certificate - {eventTitle}"
                />
                <p className="text-xs text-gray-500">
                  Available variables: {'{eventTitle}'}, {'{participantName}'},{' '}
                  {'{certificateId}'}
                </p>
              </div>

              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'}>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleTestConnection}
                  disabled={isTesting || !config.smtpHost || !config.smtpUser}
                  variant="outline"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTesting ? 'Testing...' : 'Test Connection'}
                </Button>
              </div>
            </div>
          </div>

          {/* Email Templates Content */}
          <div
            className={`space-y-8 ${activeTab !== 'templates' ? 'hidden' : ''}`}
          >
            {/* Template Variables Info */}
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="flex-shrink-0 mt-0.5">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">
                    Available Template Variables
                  </h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    Use these variables in your templates to personalize emails:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      '{eventTitle}',
                      '{participantName}',
                      '{certificateId}',
                      '{eventDate}',
                    ].map((variable) => (
                      <code
                        key={variable}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded text-xs font-mono"
                      >
                        {variable}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Content Layout */}
            <div className="flex flex-col xl:flex-row gap-8">
              {/* Left Column - Template Inputs */}
              <div className="flex-1 space-y-6">
                {/* Email Subject */}
                <div className="space-y-2">
                  <Label
                    htmlFor="templateSubject"
                    className="text-sm font-semibold"
                  >
                    Email Subject
                  </Label>
                  <Input
                    id="templateSubject"
                    value={template.subject}
                    onChange={(e) =>
                      handleTemplateChange('subject', e.target.value)
                    }
                    placeholder="Your Certificate - {eventTitle}"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    The subject line that recipients will see in their inbox
                  </p>
                </div>

                {/* HTML Template */}
                <div className="space-y-2">
                  <Label
                    htmlFor="templateHtml"
                    className="text-sm font-semibold"
                  >
                    HTML Template
                  </Label>
                  <Textarea
                    id="templateHtml"
                    value={template.html}
                    onChange={(e) =>
                      handleTemplateChange('html', e.target.value)
                    }
                    placeholder="<html>...</html>"
                    rows={12}
                    className={`font-mono text-sm w-full resize-y ${
                      templateValidationError?.hasError
                        ? 'border-red-500 focus-visible:ring-red-500'
                        : ''
                    }`}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Rich HTML email template with full styling support
                  </p>
                  {templateValidationError && (
                    <Alert
                      variant={
                        templateValidationError.hasError
                          ? 'destructive'
                          : 'default'
                      }
                      className="mt-2"
                    >
                      <AlertDescription>
                        {templateValidationError.message}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {/* Plain Text Template */}
                <div className="space-y-2">
                  <Label
                    htmlFor="templateText"
                    className="text-sm font-semibold"
                  >
                    Plain Text Template
                    <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                      (Fallback)
                    </span>
                  </Label>
                  <Textarea
                    id="templateText"
                    value={template.text}
                    onChange={(e) =>
                      handleTemplateChange('text', e.target.value)
                    }
                    placeholder="Plain text email template..."
                    rows={8}
                    className="font-mono text-sm w-full resize-y"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Fallback template for email clients that don't support HTML.
                    Used for better accessibility and compatibility.
                  </p>
                </div>
              </div>

              {/* Right Column - Live Preview */}
              <div className="flex-1 space-y-4 xl:max-w-lg">
                <div className="sticky top-6">
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                    {/* Preview Header */}
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500"></div>
                        Live Preview
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Preview with sample data
                      </p>
                    </div>

                    {/* Email Preview Container */}
                    <div className="p-4 space-y-4">
                      {/* Email Headers */}
                      <div className="space-y-2 pb-4 border-b border-gray-200 dark:border-gray-700">
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            From
                          </div>
                          <div className="text-sm text-gray-900 dark:text-gray-100">
                            {config.fromName || 'Certificate Generator'}{' '}
                            <span className="text-gray-500 dark:text-gray-400">
                              &lt;
                              {config.fromAddress || 'noreply@example.com'}
                              &gt;
                            </span>
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                            Subject
                          </div>
                          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {template.subject
                              .replaceAll(/\{eventTitle\}/g, 'Sample Event 2024')
                              .replaceAll(/\{participantName\}/g, 'John Doe')
                              .replaceAll(/\{certificateId\}/g, 'CERT-2024-001')
                              .replaceAll(/\{eventDate\}/g, 'September 17, 2024')}
                          </div>
                        </div>
                      </div>

                      {/* HTML Content Preview */}
                      <div>
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                          HTML Content
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 overflow-hidden">
                          <div
                            className="p-4 min-h-[200px] max-h-[400px] overflow-y-auto text-sm email-template-preview"
                            dangerouslySetInnerHTML={{
                              __html: scopeTemplateStyles(
                                template.html
                                  .replaceAll(
                                    /\{eventTitle\}/g,
                                    'Sample Event 2024'
                                  )
                                  .replaceAll(/\{participantName\}/g, 'John Doe')
                                  .replaceAll(
                                    /\{certificateId\}/g,
                                    'CERT-2024-001'
                                  )
                                  .replaceAll(
                                    /\{eventDate\}/g,
                                    'September 17, 2024'
                                  )
                              ),
                            }}
                          />
                        </div>
                      </div>

                      {/* Plain Text Preview */}
                      <div>
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">
                          Plain Text Version
                        </div>
                        <div className="border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900/50 p-4">
                          <div className="text-xs font-mono whitespace-pre-wrap text-gray-800 dark:text-gray-200 max-h-[150px] overflow-y-auto">
                            {template.text
                              .replaceAll(/\{eventTitle\}/g, 'Sample Event 2024')
                              .replaceAll(/\{participantName\}/g, 'John Doe')
                              .replaceAll(/\{certificateId\}/g, 'CERT-2024-001')
                              .replaceAll(/\{eventDate\}/g, 'September 17, 2024')}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <Button onClick={handleSaveConfig} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Event Information */}
      <Card>
        <CardHeader>
          <CardTitle>Event Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Event Title:
              </span>
              <p className="text-gray-900 dark:text-gray-100">{event.title}</p>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Participants:
              </span>
              <p className="text-gray-900 dark:text-gray-100">
                {event.participants.length}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Event Date:
              </span>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(event.eventDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Status:
              </span>
              <p className="text-gray-900 dark:text-gray-100 capitalize">
                {event.status}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
