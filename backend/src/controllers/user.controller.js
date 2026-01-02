import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

// method for generatting accessa nd refresh token 
const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId) // jo ye userId lega, yadi vo data ke User mein hoga to ham us user ke document ko new user mein store karenge
        // console.log("User :", user);
        // console.log("ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET);
        // console.log("REFRESH_TOKEN_SECRET:", process.env.REFRESH_TOKEN_SECRET);
        // console.log("ACCESS_TOKEN_EXPIRY:", process.env.ACCESS_TOKEN_EXPIRY);
        // console.log("REFRESH_TOKEN_EXPIRY:", process.env.REFRESH_TOKEN_EXPIRY);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        // console.log("Generated Access Token:", accessToken);
        // console.log("Generated Refresh Token:", refreshToken);
        // ham accessToken to user ko de dete hai but ham refreshToken backend mein bhi rakhte h
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }


    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}
// registerUser
const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exits: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { fullName, email, username, password } = req.body
    //console.log("email:",email);

    if (
        [fullName, email, username, password].some((field) =>
            field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }

    // console.log("req.files:",req.files);
    // console.log("req.files.avatar:",req.body);

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path
    // other method because cover image is optional and may not be present

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    //console.log("req.files:",req.files);
    //console.log("req.body:",req.body); 

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar files is required 1")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // console.log("avatarLoacalPath:",avatarLocalPath);  
    // console.log("avatarCloudinary:",avatar);
    // console.log("coverImageLoacalPath:",coverImageLocalPath);
    // console.log("coverImageCloudinary:",coverImage);
    if (!avatar || !avatar.url) {
        throw new ApiError(400, "Avatar files is required 2")
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )
})
// loginUser
const loginUser = asyncHandler(async (req, res) => {
    // req body -> data, data lana 
    // username or email, check karna yehai ya nahi hogi to inme se access denge 
    // find the user // hai ya nahi 
    //password check 
    //access and referesh token 
    // send cookie // user ko cookie send karna

    const { email, username, password } = req.body
    // console.log(email);
    if (!username && !email) {
        throw new ApiError(400, "username or email is required")
    }
    // hamare pas User ka data hai ya nahi vo dhoodte hai ya to username ya email koi bhi mile  
    const user = await User.findOne({
        $or: [{ username }, { email }] // value ko find karega ya to usernaem or email ke base mein mil jaye object type mein
    })
    // ye user mein email and username dono,ya koi ek honge 
    if (!user) {
        throw new ApiError(404, "User does not exits")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)// ye true false return karega

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials")
    }
    // console.log("User logged in:", user._id);
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken") // yeha mein refreshtoke and password ko hata raha hu response se

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )
})
// logoutUser
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id, // yeha logout karte  time uski id mil gayi
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200, {}, "User logged out")
        )
})
// refreshAccessToken
const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401, "Invalid refresh token")
        }
    
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "refresh token is expired or used")
        }
    
        const  options ={
            httpOnly:true,
            secure:true
        }
        const { accessToken, newRefreshToken } =  await generateAccessAndRefereshTokens(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken", newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken, newRefreshToken
                },
                "Access token refreshed successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, "Invalid refresh token")
    }
})
// changeCurrentPasssword
const changeCurrentPassword = asyncHandler(async (req, res) =>{
    const {oldPassword, newPassword, confirmPassword} = req.body

    if(!(newPassword === confirmPassword)){
        throw new ApiError(400, "New password and confirm password do not match")
    }
    const user = await User.findById(req.user?._id)
    const isPasswordCurrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCurrect){
        throw new ApiError(400, "Invalid old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(
        new ApiResponse(200, {},"Password changed successfully")
    )
})
// getCurrentuser
const getCurrentUser = asyncHandler(async (req, re) =>{
    return res
    .status(200)
    .json(200 , req.user,"Current user fetched successfully")
})
// updateAccountDetails
const updateAccountDetails = asyncHandler(async(req, res)=>{
    const {fullName,username} = req.body

    if(!fullName || !username){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName: fullName,
                email:email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})
// updateUserAvatar
const updateUserAvatar = asyncHandler(async (req, res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new ApiError(400, "Error while uploading avatar on cloudinary")
    }

    const user  = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user, "User avatar updated successfully")
    )


})
// updateUserCoverImage
const updateUserCoverImage = asyncHandler(async (req, res)=>{
    const coverImageLocalPath =  req.user?.path

    if(!coverImageLocalPath){
        throw new ApiError(400, "cover image file is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new ApiError(400, "Error while uploading coverImage on cloundinary")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200, user, "User cover image updated successfully")
    )
})
// getUserChannelProfile
const getUserChannelProfile = asyncHandler(async (req, res)=>{
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }
    // pipeline aggregation
    const channel = await User.aggregate([
        {
            $match:{ // jo username milega vo match karenge
                username: username?.toLowerCase()
            }
        },
        {
            $lookup:{ // join operation
                from:"subscriptions",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers"
            }
        },
        {
            $lookup:{ // join operation
                from:"subscriptions",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
          $addFields:{ // additional fields with existing fields
            subscribersCount: {
                $size:"$subscribers"
            },
            channelsSubscribedToCount: { 
                $size:"$subscribedTo"
            },
            isSubscribed: { // check if the logged in user is subscribed to this channel
                $cond:{
                    if:{$in: [req.user?._id, "$subscribers.subscriber"]}, // check if the logged in user id is present in the subscribers list
                    then:true,
                    else:false
                }
            }
          }  
        },
        {
            $project:{ // jo fields chahiye vo milenge
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribedTo:1,
                avatar:1,
                coverImage:1,
                email:1,
            }
        }
    ])

    if(!channel?.length){
            throw new ApiError(404, "channel does not exists")
        }
    
    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully" )
    )
})
// getWatchHistory
const getWatchHistory = asyncHandler(async (req, res)=>{
    const user = await User.aggregate([ // aggregation pipeline
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id) // jo user id milega vo match karenge
            }
        },
        { 
            $lookup:{ // join operation
                from: "videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline: [
                    { // additional operations on the joined collection
                        $lookup:{
                            from: "users",
                            localField:"owner",
                            foreignField:"_id",
                            as:"owner",
                            pipeline:[ // jo fields chahiye owner ke vo milenge
                                {
                                    $project:{
                                        fullName:1,
                                        username:1,
                                        avatar:1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{ // flatten the owner array to object
                            owner:{
                                $first:"$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
})

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}