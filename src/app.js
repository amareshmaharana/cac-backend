import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}));

app.use(express.json({ limit: '30kb' })); // for json data receiiving with limit set
app.use(express.urlencoded({ extended: true, limit: '30kb' })); // for receive data from url like "+" and "%20" etc.
app.use(express.static('public')); // for store file/folders like images, pdf format in server as public asset etc.
app.use(cookieParser()); // for cookie work in server like set, get, delete etc.


export default app;