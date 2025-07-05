import { Request, Response, NextFunction } from "express";
import multer from "multer";
import { memoryStorage } from "../utils/multer";

// Custom interface to extend Express Request
interface RequestWithFile extends Request {
  fileInfo?: {
    originalName: string;
    size: number;
    mimeType: string;
    buffer?: Buffer;
  };
}

/**
 * Creates a middleware for handling file uploads
 * @param fieldName The name of the field that contains the file
 * @param optional Whether the file is optional (default: true)
 * @param maxSize Maximum file size in bytes (default: 50MB)
 * @returns Express middleware
 */
export const fileUpload = (
  fieldName: string,
  optional = true,
  maxSize = 50 * 1024 * 1024
) => {
  const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: maxSize },
    fileFilter: (req, file, cb) => {
      // You can add file type validation here if needed
      cb(null, true);
    },
  }).single(fieldName);

  return (req: RequestWithFile, res: Response, next: NextFunction) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        // A multer error occurred when uploading
        console.error("Multer error:", err);
        return res.status(400).json({
          success: false,
          error: "File Upload Error",
          message: err.message,
          field: err.field,
        });
      } else if (err) {
        // An unknown error occurred
        console.error("Unknown error during upload:", err);
        return res.status(500).json({
          success: false,
          error: "Server Error",
          message: "An error occurred during file upload",
        });
      }

      // No file was provided and it's required
      if (!req.file && !optional) {
        return res.status(400).json({
          success: false,
          error: "Missing File",
          message: `The file field '${fieldName}' is required`,
        });
      }

      // If file exists, add file info to request object for easy access
      if (req.file) {
        req.fileInfo = {
          originalName: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          buffer: req.file.buffer,
        };
        console.log(`File '${fieldName}' received:`, req.fileInfo.originalName);
      }

      next();
    });
  };
};
