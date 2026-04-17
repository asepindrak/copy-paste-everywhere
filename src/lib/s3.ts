import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_REGION = process.env.S3_REGION;
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY;
const S3_SECRET_KEY = process.env.S3_SECRET_KEY;
const S3_ENDPOINT_URL = process.env.S3_ENDPOINT_URL;

export const MAX_S3_UPLOAD_SIZE = 5 * 1024 ** 3; // 5GB

export const useS3 =
  !!S3_BUCKET_NAME && !!S3_REGION && !!S3_ACCESS_KEY && !!S3_SECRET_KEY;

export const s3Client = useS3
  ? new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY!,
        secretAccessKey: S3_SECRET_KEY!,
      },
      ...(S3_ENDPOINT_URL
        ? {
            endpoint: S3_ENDPOINT_URL,
            forcePathStyle: true,
          }
        : {}),
    })
  : null;

if (S3_ENDPOINT_URL && !useS3) {
  console.warn(
    "S3 endpoint is set, but S3 credentials or bucket name are missing. S3 uploads are disabled.",
  );
}

export const isImageDataUrl = (value: string) =>
  /^data:image\/[a-zA-Z]+;base64,/.test(value);

export const isRemoteFileUrl = (value: string) => /^https?:\/\//i.test(value);

export const isRemoteImageUrl = (value: string) =>
  /^https?:\/\/.+\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(value);

export const getS3ObjectUrl = (key: string) => {
  if (!S3_BUCKET_NAME || !S3_REGION) {
    throw new Error("S3 is not configured.");
  }

  if (S3_ENDPOINT_URL) {
    return `${S3_ENDPOINT_URL.replace(/\/$/, "")}/${S3_BUCKET_NAME}/${key}`;
  }

  return `https://${S3_BUCKET_NAME}.s3.${S3_REGION}.amazonaws.com/${key}`;
};

const sanitizeKeyPath = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]/g, "_");

export const uploadBase64ImageToS3 = async (
  userId: string,
  dataUrl: string,
): Promise<string> => {
  if (!s3Client) {
    throw new Error("S3 is not configured.");
  }

  const match = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid data URL image format.");
  }

  const mime = match[1];
  const base64 = match[2];
  const extension = mime.split("/")[1] === "jpeg" ? "jpg" : mime.split("/")[1];
  const buffer = Buffer.from(base64, "base64");
  const key = `clipboard-images/${sanitizeKeyPath(userId)}/${Date.now()}-${randomUUID()}.${extension}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: mime,
      ACL: "public-read",
    }),
  );

  return getS3ObjectUrl(key);
};

export const uploadFileToS3 = async (
  userId: string,
  file: File,
): Promise<string> => {
  if (!s3Client) {
    throw new Error("S3 is not configured.");
  }

  const fileName = sanitizeKeyPath(file.name || "file");
  const extension = fileName.includes(".") ? fileName.split(".").pop() : "bin";
  const key = `clipboard-files/${sanitizeKeyPath(userId)}/${Date.now()}-${randomUUID()}.${extension}`;

  const contentType = file.type || "application/octet-stream";
  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
      ACL: "public-read",
    }),
  );

  return getS3ObjectUrl(key);
};

export const uploadAvatarToS3 = async (
  userId: string,
  file: File,
): Promise<string> => {
  if (!s3Client) {
    throw new Error("S3 is not configured.");
  }

  const extension = file.type.split("/")[1] || "png";
  const key = `avatars/${sanitizeKeyPath(userId)}/${Date.now()}-${randomUUID()}.${sanitizeKeyPath(extension)}`;
  const contentType = file.type || "image/png";
  const arrayBuffer = await file.arrayBuffer();
  const body = Buffer.from(arrayBuffer);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: body.length,
      ACL: "public-read",
    }),
  );

  return getS3ObjectUrl(key);
};
