import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))
// json type  of request accepting 
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser())

//routes import 

import userRouter from "./routes/user.routes.js"

//routes declaration
// this act as a prefix
app.use("/api/v1/users",userRouter)
// ex.
// http://localhost:8000/api/v1/users/register
// http://localhost:8000/api/v1/users/login

export {app}
