
import multer from "multer";
import path from "path";

const allowedExtensions = [".csv", ".xlsx", ".xls", ".json"];

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only CSV, XLSX, XLS and JSON files are allowed."
      )
    );
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

export default upload;
