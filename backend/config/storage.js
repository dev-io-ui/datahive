const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const ALLOWED_TYPES = {
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  text: ['text/plain', 'application/json'],
};
const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

const fileFilter = (req, file, cb) => {
  const taskType = req.body.taskType || req.query.taskType || 'image';
  const allowedMimes = ALLOWED_TYPES[taskType] || ALLOWED_TYPES.image;
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} not allowed for task type ${taskType}`), false);
  }
};

// Check if we should use AWS based on the .env variable
const useS3 = process.env.USE_AWS === 'true';

let storage;
let s3Client = null;

if (useS3) {
  // ONLY initialize S3 and multerS3 if USE_AWS is 'true'
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  storage = multerS3({
    s3: s3Client,
    bucket: process.env.AWS_S3_BUCKET,
    acl: 'private', 
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: (req, file, cb) => {
      cb(null, {
        fieldName: file.fieldname,
        uploadedBy: req.user?.id || 'anonymous',
        taskId: req.body.taskId || 'unknown',
      });
    },
    key: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      const userId = req.user?.id || 'unknown';
      const taskId = req.body.taskId || 'unknown';
      const filename = `submissions/${userId}/${taskId}/${uuidv4()}${ext}`;
      cb(null, filename);
    },
  });
} else {
  // Fallback to local storage
  storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

const upload = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

module.exports = { upload, s3Client, ALLOWED_TYPES };



// const { S3Client } = require('@aws-sdk/client-s3');
// const multer = require('multer');
// const multerS3 = require('multer-s3');
// const path = require('path');
// const { v4: uuidv4 } = require('uuid');

// const s3Client = new S3Client({
//   region: process.env.AWS_REGION,
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

// const ALLOWED_TYPES = {
//   audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4'],
//   image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
//   text: ['text/plain', 'application/json'],
// };

// const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB) || 50) * 1024 * 1024;

// /**
//  * Dynamic file filter based on task type
//  */
// const fileFilter = (req, file, cb) => {
//   const taskType = req.body.taskType || req.query.taskType || 'image';
//   const allowedMimes = ALLOWED_TYPES[taskType] || ALLOWED_TYPES.image;

//   if (allowedMimes.includes(file.mimetype)) {
//     cb(null, true);
//   } else {
//     cb(new Error(`File type ${file.mimetype} not allowed for task type ${taskType}`), false);
//   }
// };

// /**
//  * Multer-S3 storage engine
//  * Files are stored under: submissions/{userId}/{taskId}/{uuid}.ext
//  */
// const storage = multerS3({
//   s3: s3Client,
//   bucket: process.env.AWS_S3_BUCKET,
//   acl: 'private', // signed URLs only - no public access
//   contentType: multerS3.AUTO_CONTENT_TYPE,
//   metadata: (req, file, cb) => {
//     cb(null, {
//       fieldName: file.fieldname,
//       uploadedBy: req.user?.id || 'anonymous',
//       taskId: req.body.taskId || 'unknown',
//     });
//   },
//   key: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     const userId = req.user?.id || 'unknown';
//     const taskId = req.body.taskId || 'unknown';
//     const filename = `submissions/${userId}/${taskId}/${uuidv4()}${ext}`;
//     cb(null, filename);
//   },
// });

// // For local dev when S3 is not configured
// const localStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/');
//   },
//   filename: (req, file, cb) => {
//     const ext = path.extname(file.originalname);
//     cb(null, `${uuidv4()}${ext}`);
//   },
// });

// const useS3 = process.env.USE_AWS === 'true' && process.env.AWS_ACCESS_KEY_ID;
// const upload = multer({
//   storage: useS3 ? storage : localStorage,
//   fileFilter,
//   limits: { fileSize: MAX_FILE_SIZE },
// });

// module.exports = { upload, s3Client, ALLOWED_TYPES };
