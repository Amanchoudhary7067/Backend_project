// require("dotenv").config({path: './env'});
import dotenv from "dotenv"
import connnectDB from "./db/index.js"


dotenv.config({
    path: './env'
})
connnectDB()
.then(()=>{
    
    app.on("error", (error) =>{
        console.log("ERROR IN CONNECTIONDB",error);
        throw error
    })

    app.listen(process.env.PORT || 8000, () =>{
        console.log(`server is running on port : ${process.env.PORT}`)
    })
})
.catch((error)=>{
    console.log("MONGODB CONNECTIONS failed", error);
})

/*
import express from "express"
const app = express()

( async ()=>{

    try {
       await mongoose.connect(`${Process.env.MONGO_URI}/${DB_NAME}`)
       app.on("error",(error) =>{
        console.log("ERROR",error);
        throw errror
       })

    app.listen(process.env.PORT,()=>{
        console.log(`App is listening on port ${process.env.PORT}`);
    })
    } catch (error) {
        console.log("Error in DB connection", error)
        throw error  
    }

})() 
*/