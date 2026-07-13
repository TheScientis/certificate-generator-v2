'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { EmailErrorType } from '@/lib/email-error-handler';
import {
  AlertTriangle,
  RefreshCw,
  Bug,
  Mail,
  Settings,
  XCircle,
  Info,
} from 'lucide-react';

interface EmailErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

interface EmailErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  maxRetries?: number;
  context?: string;
}

export class EmailErrorBoundary extends Component<
  EmailErrorBoundaryProps,
  EmailErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: EmailErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<EmailErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${crypto.randomUUID().slice(0, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Email Error Boundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error to monitoring service
    this.logError(error, errorInfo);
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private logError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error monitoring service
    const errorData = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      context: this.props.context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Email Error Details:', errorData);
    }

    // TODO: Send to error monitoring service (Sentry, LogRocket, etc.)
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prevState.retryCount + 1,
    }));

    // Call the onRetry callback if provided
    this.props.onRetry?.();
  };

  private handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  private getErrorType = (error: Error): EmailErrorType => {
    const message = error.message.toLowerCase();

    if (message.includes('smtp') || message.includes('connection')) {
      return EmailErrorType.SMTP_CONNECTION_ERROR;
    }
    if (message.includes('auth') || message.includes('login')) {
      return EmailErrorType.AUTHENTICATION_ERROR;
    }
    if (message.includes('rate limit') || message.includes('throttle')) {
      return EmailErrorType.RATE_LIMIT_ERROR;
    }
    if (message.includes('template') || message.includes('render')) {
      return EmailErrorType.TEMPLATE_ERROR;
    }
    if (message.includes('attachment') || message.includes('file')) {
      return EmailErrorType.ATTACHMENT_ERROR;
    }
    if (message.includes('delivery') || message.includes('send')) {
      return EmailErrorType.DELIVERY_ERROR;
    }
    if (message.includes('network') || message.includes('timeout')) {
      return EmailErrorType.NETWORK_ERROR;
    }
    if (message.includes('config') || message.includes('setting')) {
      return EmailErrorType.CONFIGURATION_ERROR;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return EmailErrorType.VALIDATION_ERROR;
    }

    return EmailErrorType.UNKNOWN_ERROR;
  };

  private getErrorIcon = (errorType: EmailErrorType) => {
    switch (errorType) {
      case EmailErrorType.SMTP_CONNECTION_ERROR:
      case EmailErrorType.AUTHENTICATION_ERROR:
        return <Settings className="h-5 w-5 text-red-500" />;
      case EmailErrorType.RATE_LIMIT_ERROR:
        return <RefreshCw className="h-5 w-5 text-yellow-500" />;
      case EmailErrorType.TEMPLATE_ERROR:
        return <Mail className="h-5 w-5 text-orange-500" />;
      case EmailErrorType.ATTACHMENT_ERROR:
        return <Bug className="h-5 w-5 text-purple-500" />;
      case EmailErrorType.DELIVERY_ERROR:
        return <XCircle className="h-5 w-5 text-red-500" />;
      case EmailErrorType.NETWORK_ERROR:
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case EmailErrorType.CONFIGURATION_ERROR:
        return <Settings className="h-5 w-5 text-red-500" />;
      case EmailErrorType.VALIDATION_ERROR:
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bug className="h-5 w-5 text-gray-500" />;
    }
  };

  private getErrorTitle = (errorType: EmailErrorType) => {
    switch (errorType) {
      case EmailErrorType.SMTP_CONNECTION_ERROR:
        return 'Email Server Connection Failed';
      case EmailErrorType.AUTHENTICATION_ERROR:
        return 'Email Authentication Failed';
      case EmailErrorType.RATE_LIMIT_ERROR:
        return 'Email Rate Limit Exceeded';
      case EmailErrorType.TEMPLATE_ERROR:
        return 'Email Template Error';
      case EmailErrorType.ATTACHMENT_ERROR:
        return 'Certificate Attachment Failed';
      case EmailErrorType.DELIVERY_ERROR:
        return 'Email Delivery Failed';
      case EmailErrorType.NETWORK_ERROR:
        return 'Network Connection Error';
      case EmailErrorType.CONFIGURATION_ERROR:
        return 'Email Configuration Error';
      case EmailErrorType.VALIDATION_ERROR:
        return 'Email Validation Error';
      default:
        return 'Email Error';
    }
  };

  private getErrorDescription = (errorType: EmailErrorType, error: Error) => {
    switch (errorType) {
      case EmailErrorType.SMTP_CONNECTION_ERROR:
        return 'Unable to connect to the email server. Please check your SMTP settings and try again.';
      case EmailErrorType.AUTHENTICATION_ERROR:
        return 'Email authentication failed. Please verify your username and password.';
      case EmailErrorType.RATE_LIMIT_ERROR:
        return 'Too many emails sent in a short time. Please wait before sending more emails.';
      case EmailErrorType.TEMPLATE_ERROR:
        return 'There was an error processing the email template. Please check your template configuration.';
      case EmailErrorType.ATTACHMENT_ERROR:
        return 'Failed to attach the certificate to the email. Please try again.';
      case EmailErrorType.DELIVERY_ERROR:
        return 'The email could not be delivered. Please check the recipient email address.';
      case EmailErrorType.NETWORK_ERROR:
        return 'A network error occurred. Please check your internet connection and try again.';
      case EmailErrorType.CONFIGURATION_ERROR:
        return 'There is an issue with your email configuration. Please check your settings.';
      case EmailErrorType.VALIDATION_ERROR:
        return 'The email data is invalid. Please check the information and try again.';
      default:
        return (
          error.message ||
          'An unexpected error occurred while processing the email.'
        );
    }
  };

  private getErrorSeverity = (
    errorType: EmailErrorType
  ): 'low' | 'medium' | 'high' => {
    switch (errorType) {
      case EmailErrorType.VALIDATION_ERROR:
      case EmailErrorType.TEMPLATE_ERROR:
        return 'low';
      case EmailErrorType.RATE_LIMIT_ERROR:
      case EmailErrorType.NETWORK_ERROR:
      case EmailErrorType.ATTACHMENT_ERROR:
        return 'medium';
      case EmailErrorType.SMTP_CONNECTION_ERROR:
      case EmailErrorType.AUTHENTICATION_ERROR:
      case EmailErrorType.DELIVERY_ERROR:
      case EmailErrorType.CONFIGURATION_ERROR:
        return 'high';
      default:
        return 'medium';
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, retryCount } = this.state;
      const { maxRetries = 3, context } = this.props;

      if (this.props.fallback) {
        return this.props.fallback;
      }

      const errorType = error
        ? this.getErrorType(error)
        : EmailErrorType.UNKNOWN_ERROR;
      const severity = this.getErrorSeverity(errorType);
      const canRetry = retryCount < maxRetries;

      return (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
              {this.getErrorIcon(errorType)}
              {this.getErrorTitle(errorType)}
              <Badge variant="destructive" className="ml-auto">
                {severity.toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription className="text-red-700 dark:text-red-300">
              {this.getErrorDescription(errorType, error!)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Error Details */}
            {process.env.NODE_ENV === 'development' && error && (
              <Alert>
                <Bug className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-medium">Error Details:</div>
                    <div className="text-sm font-mono bg-gray-100 p-2 rounded">
                      {error.message}
                    </div>
                    {context && (
                      <div className="text-sm text-gray-600">
                        Context: {context}
                      </div>
                    )}
                    <div className="text-sm text-gray-600">
                      Error ID: {this.state.errorId}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Retry Information */}
            {retryCount > 0 && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Retry attempt {retryCount} of {maxRetries}
                </AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              {canRetry && (
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              )}

              <Button
                onClick={this.handleReset}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <XCircle className="h-4 w-4" />
                Reset
              </Button>
            </div>

            {/* Help Text */}
            <div className="text-sm text-gray-600">
              {errorType === EmailErrorType.SMTP_CONNECTION_ERROR && (
                <p>
                  Check your SMTP server settings in the email configuration.
                </p>
              )}
              {errorType === EmailErrorType.AUTHENTICATION_ERROR && (
                <p>Verify your email username and password are correct.</p>
              )}
              {errorType === EmailErrorType.RATE_LIMIT_ERROR && (
                <p>Wait a few minutes before trying to send emails again.</p>
              )}
              {errorType === EmailErrorType.TEMPLATE_ERROR && (
                <p>Check your email template for any syntax errors.</p>
              )}
              {errorType === EmailErrorType.ATTACHMENT_ERROR && (
                <p>Ensure the certificate file is valid and not corrupted.</p>
              )}
              {errorType === EmailErrorType.DELIVERY_ERROR && (
                <p>Verify the recipient email address is correct and active.</p>
              )}
              {errorType === EmailErrorType.NETWORK_ERROR && (
                <p>Check your internet connection and try again.</p>
              )}
              {errorType === EmailErrorType.CONFIGURATION_ERROR && (
                <p>Review your email configuration settings.</p>
              )}
              {errorType === EmailErrorType.VALIDATION_ERROR && (
                <p>Check that all required fields are filled correctly.</p>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
