
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import fs from "fs/promises";
import path from "path";

const bucket = process.env.AWS_S3_BUCKET;

export const s3 = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
});

const getBucket = (): string => {
  if (!bucket) {
    throw new Error("AWS_S3_BUCKET is not configured");
  }

  return bucket;
};

// Upload a file to AWS S3
export const uploadToS3 = async (
  userId: string,
  filename: string,
  buffer: Buffer,
  contentType = "application/octet-stream"
): Promise<string> => {
  const key = `datasets/${userId}/${filename}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return `s3:${key}`;
};

// Read a dataset from S3 or legacy local storage
export const readDatasetBuffer = async (
  storageKey: string
): Promise<Buffer> => {
  if (storageKey.startsWith("s3:")) {
    const key = storageKey.slice(3);

    if (!key) {
      throw new Error("Invalid S3 storage key");
    }

    const result = await s3.send(
      new GetObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );

    if (!result.Body) {
      throw new Error("S3 object has no content");
    }

    const bytes = await result.Body.transformToByteArray();

    return Buffer.from(bytes);
  }

  // Support existing locally stored datasets
  if (
    !storageKey ||
    path.basename(storageKey) !== storageKey
  ) {
    throw new Error("Invalid local storage key");
  }

  const filePath = path.join(
    process.cwd(),
    "uploads",
    "datasets",
    storageKey
  );

  return fs.readFile(filePath);
};

// Delete an S3 object or legacy local file
export const deleteStoredDataset = async (
  storageKey: string
): Promise<void> => {
  if (storageKey.startsWith("s3:")) {
    const key = storageKey.slice(3);

    if (!key) {
      throw new Error("Invalid S3 storage key");
    }

    await s3.send(
      new DeleteObjectCommand({
        Bucket: getBucket(),
        Key: key,
      })
    );

    return;
  }

  if (!storageKey || path.basename(storageKey) !== storageKey) {
    throw new Error("Invalid local storage key");
  }

  const filePath = path.join(
    process.cwd(),
    "uploads",
    "datasets",
    storageKey
  );

  await fs.unlink(filePath).catch((error) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
};
