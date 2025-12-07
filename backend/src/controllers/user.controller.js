import { asyncHandler } from "../utils/asyncHandler.js";   

// registerUser
const registerUser = asyncHandler(async (req,res)=>{
    res.status(400).json({
        message:"ok"

    })
})

export {registerUser,}