import {v2 as cloudinary} from 'cloudinary';
import fs from 'fs'; // file system module to handle file operations

// Configuration
    cloudinary.config({ 
        cloud_name:process.env.CLOUDINARY_CLOUD_NAME, 
        api_key: process.env.CLOUDINARY_API_KEY, 
        api_secret:process.env.CLOUDINARY_API_SECRET
    });

    const uploadOnCloudinary = async (localFilePath) =>{
        try {
            if(!localFilePath) return null;
            // upload the file on cloudinary
            const fixedPath = localFilePath.replace(/\\/g, "/"); // to handle windows file path issue   
           const response = await cloudinary.uploader.upload(fixedPath,{
                resource_type: "auto"
            })
            // file has been uploaded successfully
            //console.log('File uploaded successfully', response.url);
           fs.unlinkSync(fixedPath)
            return response;
        } catch (error) {
            fs.unlinkSync(fixedPath) // remove the locally saved temporary file as the upload operation got failed
            return null;
        }
    }

    export {uploadOnCloudinary}