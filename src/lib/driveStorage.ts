import path from "path";
import fs from "fs";
import { promises as fsPromises } from "fs";
import { randomUUID } from "crypto";
import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, useS3, getS3ObjectUrl } from "./s3";

const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;

// Local storage path: inside public/uploads/drive
const LOCAL_STORAGE_DIR = path.join(process.cwd(), "public", "uploads", "drive");

export {
  sanitizeFileName,
  type FileCategory,
  getFileCategory,
  formatBytes,
  getTimeGroup,
} from "./driveUtils";
import { sanitizeFileName } from "./driveUtils";


export interface SaveFileResult {
  url: string;
  storageType: "s3" | "local";
  storageKey: string;
  size: number;
  mimeType: string;
  name: string;
}

export async function saveDriveFile(
  userId: string,
  file: File,
  customName?: string
): Promise<SaveFileResult> {
  const originalName = customName || file.name || "file";
  const sanitized = sanitizeFileName(originalName);
  const ext = sanitized.includes(".") ? sanitized.split(".").pop() : "bin";
  const baseName = sanitized.includes(".")
    ? sanitized.slice(0, sanitized.lastIndexOf("."))
    : sanitized;
  const mimeType = file.type || "application/octet-stream";
  const size = file.size;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // If S3 is configured, upload to S3
  const bucketName = process.env.S3_BUCKET_NAME || S3_BUCKET_NAME;
  if (useS3 && s3Client && bucketName) {
    const key = `drive-files/${sanitizeFileName(userId)}/${Date.now()}-${randomUUID()}.${ext}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ContentLength: buffer.length,
        ACL: "public-read",
      })
    );

    return {
      url: getS3ObjectUrl(key),
      storageType: "s3",
      storageKey: key,
      size,
      mimeType,
      name: originalName,
    };
  }

  // Fallback to Local Storage in public/uploads/drive/${userId}/
  const userDir = path.join(LOCAL_STORAGE_DIR, sanitizeFileName(userId));
  await fsPromises.mkdir(userDir, { recursive: true });

  const uniqueFileName = `${Date.now()}-${randomUUID()}-${sanitized}`;
  const filePath = path.join(userDir, uniqueFileName);
  await fsPromises.writeFile(filePath, buffer);

  // Accessible via Next.js static asset or download API
  const publicUrl = `/uploads/drive/${sanitizeFileName(userId)}/${uniqueFileName}`;

  return {
    url: publicUrl,
    storageType: "local",
    storageKey: filePath,
    size,
    mimeType,
    name: originalName,
  };
}

export async function deleteDriveStorageFile(
  storageType: string,
  storageKey?: string | null,
  url?: string | null
): Promise<void> {
  try {
    if (storageType === "s3" && useS3 && s3Client && S3_BUCKET_NAME) {
      const key = storageKey || (url ? new URL(url).pathname.replace(/^\//, "") : null);
      if (key) {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: key,
          })
        );
      }
    } else if (storageType === "local") {
      let targetPath = storageKey;
      if (!targetPath && url && url.startsWith("/uploads/drive/")) {
        targetPath = path.join(process.cwd(), "public", url);
      }
      if (targetPath && fs.existsSync(targetPath)) {
        await fsPromises.unlink(targetPath);
      }
    }
  } catch (err) {
    console.error("Failed to delete drive file from storage:", err);
  }
}
