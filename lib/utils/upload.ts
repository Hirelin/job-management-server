import { UploadType } from "../../generated/prisma";
import { db } from "../db/db";
import { env } from "../env";

interface UploadFileReturn {
  uploadId: string;
  url: string;
  buffer: Blob;
}

export async function uploadFile(
  file: Express.Multer.File,
  bucket: UploadType,
  userId: string
): Promise<UploadFileReturn | null> {
  const buffer = new Blob([file.buffer], { type: file.mimetype });
  const formData = new FormData();
  formData.append("file", buffer, file.originalname);
  formData.append("bucket", bucket);

  //   TODO: secure the request
  const fileUpload = await fetch(`${env.SERVER_URL}/api/files/upload`, {
    method: "POST",
    body: formData,
  });

  if (fileUpload.status !== 201) {
    return null;
  }

  try {
    const filedata = await fileUpload.json();
    const newFile = await db.$queryRawUnsafe<any>(
      `
              INSERT INTO "Uploads" (name, file_type, "uploadType", url, user_id)
              VALUES ($1, $2, $3::\"UploadType\", $4, $5::uuid)
              RETURNING *;
              `,
      file.originalname,
      file.mimetype,
      bucket,
      filedata.file.url,
      userId
    );

    return {
      uploadId: newFile[0].id,
      url: filedata.file.url,
      buffer: buffer,
    };
  } catch (error) {
    return null;
  }
}
