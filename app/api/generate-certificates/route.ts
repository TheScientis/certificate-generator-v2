import { NextRequest, NextResponse } from 'next/server';
import { generateCertificate } from '@/lib/canvas-utils';
import { parseCSV } from '@/lib/csv-utils';
import { ITextConfig } from '@/lib/types';
import archiver from 'archiver';
import { Readable } from 'node:stream';

export async function POST(request: NextRequest) {
  try {
    const { templateUrl, csvData, nameConfig, idConfig } = await request.json();

    if (!templateUrl || !csvData || !nameConfig || !idConfig) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Parse CSV data
    const recipients = parseCSV(csvData);

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients found' },
        { status: 400 }
      );
    }

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    // Set up event listeners BEFORE finalizing
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      throw err;
    });

    console.log('recipients', recipients);

    // Generate certificates for each recipient
    for (const recipient of recipients) {
      try {
        const certificateBuffer = await generateCertificate(
          `${
            process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
          }${templateUrl}`,
          recipient,
          nameConfig as ITextConfig,
          idConfig as ITextConfig
        );

        const filename = `certificate_${recipient.certification_id}.png`;
        console.log('filename', filename);

        archive.append(certificateBuffer, { name: filename });
      } catch (error) {
        console.error(
          `Error generating certificate for ${recipient.name}:`,
          error
        );
        // Continue with other certificates even if one fails
      }
    }

    // Finalize the archive and wait for completion
    await new Promise<void>((resolve, reject) => {
      archive.on('end', () => {
        console.log('Archive finalized successfully');
        resolve();
      });

      archive.on('error', (err) => {
        console.error('Archive finalization error:', err);
        reject(err);
      });

      archive.finalize();
    });

    const zipBuffer = Buffer.concat(chunks as unknown as Uint8Array[]);

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="certificates.zip"',
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Certificate generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate certificates' },
      { status: 500 }
    );
  }
}
