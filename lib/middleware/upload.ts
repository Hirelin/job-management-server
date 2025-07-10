import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { memoryStorage } from "../utils/multer";

// Custom interface to extend Express Request
interface RequestWithFiles extends Request {
  filesInfo?: {
    [fieldName: string]: {
      originalName: string;
      size: number;
      mimeType: string;
      buffer?: Buffer;
    };
  };
}

/**
 * Creates a middleware for handling multiple file uploads
 * @param fields Array of field configurations
 * @param maxSize Maximum file size in bytes (default: 50MB)
 * @returns Express middleware
 */
export const multipleFileUpload = (
  fields: Array<{ name: string; maxCount?: number; required?: boolean }>,
  maxSize = 50 * 1024 * 1024
) => {
  const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      cb(null, true);
    },
  }).fields(
    fields.map((field) => ({
      name: field.name,
      maxCount: field.maxCount || 1,
    }))
  );

  return (req: RequestWithFiles, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error("Multer error:", err);
        return res.status(400).json({
          success: false,
          error: "File Upload Error",
          message: err.message,
          field: err.field,
        });
      } else if (err) {
        console.error("Unknown error during upload:", err);
        return res.status(500).json({
          success: false,
          error: "Server Error",
          message: "An error occurred during file upload",
        });
      }

      // Check for required files
      for (const field of fields) {
        if (field.required) {
          const files = (req.files as any)?.[field.name];
          if (!files || files.length === 0) {
            return res.status(400).json({
              success: false,
              error: "Missing Required File",
              message: `The file field '${field.name}' is required`,
            });
          }
        }
      }

      // Add files info to request object for easy access
      if (req.files) {
        req.filesInfo = {};
        const files = req.files as {
          [fieldname: string]: Express.Multer.File[];
        };

        for (const [fieldName, fileArray] of Object.entries(files)) {
          if (fileArray && fileArray.length > 0) {
            const file = fileArray[0]; // Take first file if multiple
            req.filesInfo[fieldName] = {
              originalName: file.originalname,
              size: file.size,
              mimeType: file.mimetype,
              buffer: file.buffer,
            };
            console.log(`File '${fieldName}' received:`, file.originalname);
          }
        }
      }

      next();
    });
  };
};

// Keep the original function for backward compatibility
export const fileUpload = (
  fieldName: string,
  optional = true,
  maxSize = 50 * 1024 * 1024
) => {
  return multipleFileUpload(
    [{ name: fieldName, required: !optional }],
    maxSize
  );
};
