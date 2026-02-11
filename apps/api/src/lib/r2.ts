import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const requiredEnvVars = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

function getR2Config() {
  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(`Missing required R2 environment variables: ${missing.join(", ")}`);
  }
  return {
    accountId: process.env.R2_ACCOUNT_ID!,
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    bucketName: process.env.R2_BUCKET_NAME!,
    publicUrl: process.env.R2_PUBLIC_URL!,
  };
}

export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "";

let _s3: S3Client | null = null;

function getS3Client(): S3Client {
  if (!_s3) {
    const config = getR2Config();
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return _s3;
}

export async function createPresignedUploadUrl(
  key: string,
  contentType: string,
  contentLength: number
) {
  const config = getR2Config();
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const presignedUrl = await getSignedUrl(getS3Client(), command, { expiresIn: 600 });
  const publicUrl = `${config.publicUrl}/${key}`;

  return { presignedUrl, publicUrl };
}

export async function deleteR2Object(key: string) {
  const config = getR2Config();
  const command = new DeleteObjectCommand({
    Bucket: config.bucketName,
    Key: key,
  });
  await getS3Client().send(command);
}
