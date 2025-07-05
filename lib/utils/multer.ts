import multer from "multer";

// Memory storage configuration
export const memoryStorage = multer.memoryStorage();

// Helper function to get file information
export const getFileInfo = (file?: Express.Multer.File) => {
  if (!file) return null;

  return {
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    buffer: file.buffer, // Only available with memoryStorage
  };
};
