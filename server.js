import dotenv from 'dotenv';
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from './routes/userRouter.js';

dotenv.config();



const app = express();

app.use(cors());
app.use(express.json())
app.use(cookieParser())

app.use('/user', userRouter)

const PORT = process.env.PORT || 8000


app.listen(PORT, () => console.log(`Run on port ${PORT}`))