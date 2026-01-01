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
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
}