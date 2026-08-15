import multer from "multer";
import path from "path";

const storage =
  multer.memoryStorage();

const fileFilter:
  multer.Options["fileFilter"] = (
    _req,
    file,
    cb
  ) => {
    const extension =
      path
        .extname(
          file.originalname
        )
        .toLowerCase();

    const validExtension =
      extension === ".pdf";

    const validMimeType =
      file.mimetype ===
        "application/pdf" ||
      file.mimetype ===
        "application/x-pdf" ||
      file.mimetype ===
        "application/octet-stream";

    if (
      validExtension &&
      validMimeType
    ) {
      cb(null, true);

      return;
    }

    cb(
      new Error(
        "Only valid PDF resume files are allowed"
      )
    );
  };

export const uploadResume =
  multer({
    storage,

    limits: {
      fileSize:
        10 *
        1024 *
        1024,
    },

    fileFilter,
  });