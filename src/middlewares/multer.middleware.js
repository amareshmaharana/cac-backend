import { multer } from 'multer';

const storage = multer.diskStorage({ // storage as middleware
  destination: function (req, file, cb) {
    cb(null, './public/temp');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

export const upload = multer({ storage });


// for file uploading to backend