import { Db, Collection } from 'mongodb';
import { IEmailLog, IEvent, IRecipientData } from './types';

/**
 * Database migration utilities for email functionality
 */

export interface MigrationResult {
  success: boolean;
  message: string;
  collectionsUpdated: string[];
  recordsUpdated: number;
}

/**
 * Migrate existing events to include email configuration
 */
export async function migrateEventsForEmail(db: Db): Promise<MigrationResult> {
  try {
    const eventsCollection = db.collection<IEvent>('events');

    // Find events that don't have email configuration
    const eventsWithoutEmailConfig = await eventsCollection
      .find({
        $or: [
          { emailConfig: { $exists: false } },
          { emailTemplate: { $exists: false } },
          { emailSettings: { $exists: false } },
        ],
      })
      .toArray();

    let updatedCount = 0;

    for (const event of eventsWithoutEmailConfig) {
      const updateData: Partial<IEvent> = {};

      // Add email configuration if missing
      if (!event.emailConfig) {
        updateData.emailConfig = {
          smtpHost: '',
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: '',
          smtpPass: '',
          fromName: 'Certificate Generator',
          fromAddress: '',
          subjectTemplate: 'Your Certificate - {eventTitle}',
          enabled: false,
        };
      }

      // Add email template if missing
      if (!event.emailTemplate) {
        updateData.emailTemplate = {
          subject: 'Your Certificate - {eventTitle}',
          html: `
            <p>Dear {participantName},</p>
            <p>Congratulations! Your certificate for <strong>{eventTitle}</strong> is attached.</p>
            <p>Your Certificate ID is: <strong>{certificateId}</strong></p>
            <p>Thank you for your participation.</p>
            <p>Best regards,<br>The Certificate Generator Team</p>
          `,
          text: `
            Dear {participantName},

            Congratulations! Your certificate for {eventTitle} is attached.
            Your Certificate ID is: {certificateId}

            Thank you for your participation.

            Best regards,
            The Certificate Generator Team
          `,
        };
      }

      // Add email settings if missing
      if (!event.emailSettings) {
        updateData.emailSettings = {
          enabled: false,
          requireEmail: false,
          autoSend: false,
        };
      }

      // Update participants to include email fields if missing
      if (event.participants && event.participants.length > 0) {
        const updatedParticipants = event.participants.map((participant) => ({
          ...participant,
          email: participant.email || '',
          lastEmailSent: participant.lastEmailSent || undefined,
          emailStatus: participant.emailStatus || 'not_sent',
          emailError: participant.emailError || undefined,
          emailRetryCount: participant.emailRetryCount || 0,
        }));

        updateData.participants = updatedParticipants;
      }

      // Update the event
      await eventsCollection.updateOne(
        { _id: event._id },
        {
          $set: updateData,
          $setOnInsert: { updatedAt: new Date() },
        }
      );

      updatedCount++;
    }

    return {
      success: true,
      message: `Successfully migrated ${updatedCount} events for email functionality`,
      collectionsUpdated: ['events'],
      recordsUpdated: updatedCount,
    };
  } catch (error) {
    return {
      success: false,
      message: `Migration failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      collectionsUpdated: [],
      recordsUpdated: 0,
    };
  }
}

/**
 * Create email logs collection with proper indexes
 */
export async function createEmailLogsCollection(
  db: Db
): Promise<MigrationResult> {
  try {
    const emailLogsCollection = db.collection<IEmailLog>('emailLogs');

    // Create indexes for better query performance
    await emailLogsCollection.createIndex({ eventId: 1 });
    await emailLogsCollection.createIndex({ participantId: 1 });
    await emailLogsCollection.createIndex({ status: 1 });
    await emailLogsCollection.createIndex({ createdAt: -1 });
    await emailLogsCollection.createIndex({ sentAt: -1 });

    // Compound index for common queries
    await emailLogsCollection.createIndex({
      eventId: 1,
      status: 1,
    });

    // Check if collection exists and has data
    const count = await emailLogsCollection.countDocuments();

    return {
      success: true,
      message: `Email logs collection created with indexes. ${count} existing records found.`,
      collectionsUpdated: ['emailLogs'],
      recordsUpdated: count,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create email logs collection: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      collectionsUpdated: [],
      recordsUpdated: 0,
    };
  }
}

/**
 * Create indexes for events collection to support email queries
 */
export async function createEventEmailIndexes(
  db: Db
): Promise<MigrationResult> {
  try {
    const eventsCollection = db.collection<IEvent>('events');

    // Create indexes for email-related queries
    await eventsCollection.createIndex({ 'emailSettings.enabled': 1 });
    await eventsCollection.createIndex({ 'participants.emailStatus': 1 });
    await eventsCollection.createIndex({ 'participants.email': 1 });
    await eventsCollection.createIndex({ updatedAt: -1 });

    return {
      success: true,
      message: 'Event email indexes created successfully',
      collectionsUpdated: ['events'],
      recordsUpdated: 0,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to create event email indexes: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      collectionsUpdated: [],
      recordsUpdated: 0,
    };
  }
}

/**
 * Run all email-related database migrations
 */
export async function runEmailMigrations(db: Db): Promise<MigrationResult[]> {
  const results: MigrationResult[] = [];

  // Run migrations in order
  results.push(await migrateEventsForEmail(db));
  results.push(await createEmailLogsCollection(db));
  results.push(await createEventEmailIndexes(db));

  return results;
}

/**
 * Validate email data integrity
 */
export async function validateEmailDataIntegrity(db: Db): Promise<{
  isValid: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const issues: string[] = [];
  const recommendations: string[] = [];

  try {
    const eventsCollection = db.collection<IEvent>('events');
    const emailLogsCollection = db.collection<IEmailLog>('emailLogs');

    // Check for events with invalid email configurations
    const eventsWithInvalidEmailConfig = await eventsCollection
      .find({
        $or: [
          { 'emailConfig.smtpHost': { $exists: true, $eq: '' } },
          { 'emailConfig.smtpUser': { $exists: true, $eq: '' } },
          { 'emailConfig.fromAddress': { $exists: true, $eq: '' } },
        ],
      })
      .toArray();

    if (eventsWithInvalidEmailConfig.length > 0) {
      issues.push(
        `${eventsWithInvalidEmailConfig.length} events have incomplete email configuration`
      );
      recommendations.push('Complete email configuration for all events');
    }

    // Check for participants with invalid email addresses
    const participantsWithInvalidEmails = await eventsCollection
      .aggregate([
        { $unwind: '$participants' },
        {
          $match: {
            'participants.email': {
              $exists: true,
              $ne: '',
              $not: /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{1,24}$/,
            },
          },
        },
        { $count: 'count' },
      ])
      .toArray();

    if (participantsWithInvalidEmails.length > 0) {
      issues.push(
        `${participantsWithInvalidEmails[0].count} participants have invalid email addresses`
      );
      recommendations.push('Validate and fix invalid email addresses');
    }

    // Check for orphaned email logs
    const orphanedLogs = await emailLogsCollection
      .aggregate([
        {
          $lookup: {
            from: 'events',
            localField: 'eventId',
            foreignField: '_id',
            as: 'event',
          },
        },
        { $match: { event: { $size: 0 } } },
        { $count: 'count' },
      ])
      .toArray();

    if (orphanedLogs.length > 0) {
      issues.push(
        `${orphanedLogs[0].count} email logs reference non-existent events`
      );
      recommendations.push('Clean up orphaned email logs');
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    };
  } catch (error) {
    return {
      isValid: false,
      issues: [
        `Validation failed: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      ],
      recommendations: ['Fix validation errors and try again'],
    };
  }
}

/**
 * Clean up old email logs (older than specified days)
 */
export async function cleanupOldEmailLogs(
  db: Db,
  olderThanDays: number = 90
): Promise<MigrationResult> {
  try {
    const emailLogsCollection = db.collection<IEmailLog>('emailLogs');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await emailLogsCollection.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    return {
      success: true,
      message: `Cleaned up ${result.deletedCount} email logs older than ${olderThanDays} days`,
      collectionsUpdated: ['emailLogs'],
      recordsUpdated: result.deletedCount,
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to cleanup old email logs: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      collectionsUpdated: [],
      recordsUpdated: 0,
    };
  }
}
