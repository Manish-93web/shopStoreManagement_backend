import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

let client: S3Client | null = null;

export const isS3Configured = (): boolean => {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET);
};

const getClient = (): S3Client => {
    if (!client) {
        client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
            },
        });
    }
    return client;
};

// Uploads a buffer to S3 and returns the object's key (not a public URL — the bucket
// is expected to be private; use a presigned URL or the AWS console to retrieve backups).
export const uploadBackupToS3 = async (key: string, body: Buffer, contentType: string): Promise<string> => {
    const bucket = process.env.AWS_S3_BUCKET!;
    await getClient().send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: contentType,
        })
    );
    return `s3://${bucket}/${key}`;
};
