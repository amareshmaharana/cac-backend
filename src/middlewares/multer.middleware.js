import multer from 'multer';

const storage = multer.diskStorage({ // storage as middleware
  destination: function (req, file, cb) {
    cb(null, './public/temp');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

export default upload;


// for file uploading to backend