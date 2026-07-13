'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { IRecipientData, EmailStatus } from '@/lib/types';
import { sendBulkEmails } from '@/lib/actions';
import { toast } from '@/hooks/use-toast';
import { Send, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';

interface BulkEmailActionsProps {
  eventId: string;
  participants: IRecipientData[];
  selectedParticipantIds: string[];
  onEmailSent?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

interface EmailProgress {
  total: number;
  sent: number;
  failed: number;
  current: number;
  isComplete: boolean;
  errors: string[];
}

export function BulkEmailActions({
  eventId,
  participants,
  selectedParticipantIds,
  onEmailSent,
  disabled = false,
  children,
}: BulkEmailActionsProps) {
  const [open, setOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState<EmailProgress | null>(null);

  const selectedParticipants = participants.filter((p) =>
    selectedParticipantIds.includes(p.certification_id)
  );

  const participantsWithEmails = selectedParticipants.filter((p) => p.email);
  const participantsWithoutEmails = selectedParticipants.filter(
    (p) => !p.email
  );

  const getStatusCounts = () => {
    const counts = {
      not_sent: 0,
      pending: 0,
      sent: 0,
      failed: 0,
      bounced: 0,
    };

    participantsWithEmails.forEach((p) => {
      const status = p.emailStatus || 'not_sent';
      counts[status as EmailStatus]++;
    });

    return counts;
  };

  const handleBulkSend = async () => {
    if (participantsWithEmails.length === 0) {
      toast({
        title: 'No Valid Participants',
        description: 'No participants with email addresses selected.',
        variant: 'destructive',
      });
      return;
    }

    setIsSending(true);
    setProgress({
      total: participantsWithEmails.length,
      sent: 0,
      failed: 0,
      current: 0,
      isComplete: false,
      errors: [],
    });

    try {
      const participantIds = participantsWithEmails.map(
        (p) => p.certification_id
      );
      const result = await sendBulkEmails(eventId, participantIds);

      setProgress((prev) =>
        prev
          ? {
              ...prev,
              sent: result.sent,
              failed: result.failed,
              current: result.sent + result.failed,
              isComplete: true,
              errors: result.errors,
            }
          : null
      );

      if (result.success) {
        toast({
          title: 'Bulk Email Sent',
          description: `Successfully sent ${result.sent} emails. ${
            result.failed > 0 ? `${result.failed} failed.` : ''
          }`,
          variant: result.failed > 0 ? 'destructive' : 'default',
        });
      } else {
        toast({
          title: 'Bulk Email Failed',
          description: 'Failed to send bulk emails. Please try again.',
          variant: 'destructive',
        });
      }

      onEmailSent?.();
    } catch (error) {
      setProgress((prev) =>
        prev
          ? {
              ...prev,
              isComplete: true,
              errors: [
                error instanceof Error ? error.message : 'Unknown error',
              ],
            }
          : null
      );

      toast({
        title: 'Bulk Email Error',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const statusCounts = getStatusCounts();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled || selectedParticipantIds.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            Send Emails ({selectedParticipantIds.length})
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Bulk Email Sending
          </DialogTitle>
          <DialogDescription>
            Send certificates via email to selected participants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Selected Participants</h4>
                <div className="text-2xl font-bold">
                  {selectedParticipants.length}
                </div>
                <div className="text-sm text-gray-500">
                  {participantsWithEmails.length} with email addresses
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Email Status</h4>
                <div className="flex flex-wrap gap-1">
                  {statusCounts.sent > 0 && (
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800"
                    >
                      <CheckCircle className="w-3 h-3 mr-1" />
                      {statusCounts.sent} Sent
                    </Badge>
                  )}
                  {statusCounts.failed > 0 && (
                    <Badge variant="destructive">
                      <XCircle className="w-3 h-3 mr-1" />
                      {statusCounts.failed} Failed
                    </Badge>
                  )}
                  {statusCounts.not_sent > 0 && (
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      {statusCounts.not_sent} Not Sent
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Participants without emails warning */}
            {participantsWithoutEmails.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {participantsWithoutEmails.length} participant(s) don't have
                  email addresses and will be skipped:
                  <div className="mt-2 text-sm">
                    {participantsWithoutEmails
                      .slice(0, 3)
                      .map((p) => p.name)
                      .join(', ')}
                    {participantsWithoutEmails.length > 3 &&
                      ` and ${participantsWithoutEmails.length - 3} more...`}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <Progress
                  value={
                    progress.total > 0
                      ? (progress.current / progress.total) * 100
                      : 0
                  }
                  className="h-2"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-600">
                    {progress.sent}
                  </div>
                  <div className="text-sm text-gray-500">Sent</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">
                    {progress.failed}
                  </div>
                  <div className="text-sm text-gray-500">Failed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-600">
                    {progress.total - progress.current}
                  </div>
                  <div className="text-sm text-gray-500">Remaining</div>
                </div>
              </div>

              {/* Errors */}
              {progress.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Errors occurred:</div>
                      <div className="text-sm max-h-32 overflow-y-auto">
                        {progress.errors.slice(0, 5).map((error, index) => (
                          <div key={index} className="truncate">
                            {error}
                          </div>
                        ))}
                        {progress.errors.length > 5 && (
                          <div className="text-gray-500">
                            ... and {progress.errors.length - 5} more errors
                          </div>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Participant List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Participants to Email</h4>
            <div className="max-h-40 overflow-y-auto space-y-1">
              {participantsWithEmails.map((participant) => (
                <div
                  key={participant.certification_id}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div>
                    <div className="font-medium">{participant.name}</div>
                    <div className="text-gray-500">{participant.email}</div>
                  </div>
                  <div className="text-xs text-gray-500">
                    {participant.certification_id}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleBulkSend}
            disabled={isSending || participantsWithEmails.length === 0}
          >
            <Send className="h-4 w-4 mr-2" />
            {isSending
              ? 'Sending...'
              : `Send ${participantsWithEmails.length} Emails`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
