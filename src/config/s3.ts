import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

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

// Downloads a backup object back down as a string. Restore previously never
// worked for S3-stored backups at all — it read fileUrl as if it were always
// a local filesystem path (path.join(process.cwd(), 's3://bucket/key') is not
// a real path), so a restore attempt just threw ENOENT for every backup that
// was actually written to durable off-server storage.
export const downloadBackupFromS3 = async (key: string): Promise<string> => {
    const bucket = process.env.AWS_S3_BUCKET!;
    const result = await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    return (await result.Body?.transformToString()) || '';
};

// Parses the "s3://bucket/key" URL this module itself produces back into a
// bare object key for a subsequent GetObjectCommand.
export const parseS3Key = (fileUrl: string): string => {
    const withoutScheme = fileUrl.replace(/^s3:\/\//, '');
    const slashIndex = withoutScheme.indexOf('/');
    return slashIndex === -1 ? withoutScheme : withoutScheme.slice(slashIndex + 1);
};
