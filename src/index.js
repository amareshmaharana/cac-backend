// require("dotenv").config({path: "./env"}); -------->>>>>> for information
import dotenv from 'dotenv';
import { connectDB } from './db/index.js';

dotenv.config({
    path: "./env"
})


connectDB()
.then(() => {
  app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port ${process.env.PORT}`);
  });
})
.catch((err) => {
  console.error('MONGO DB connection Failed !!! ', err);
})







/* <---------------- 1st APPROACH of connecting to database ---------------->
<---------========== Connect and excuting of database in one file ==========--------->
import express from 'express';
const app = express();

(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
    app.on('errror', (error) => {
      console.log('ERRR: ' + error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error('ERROR: ' + error);
    throw error;
  }
})();

*/