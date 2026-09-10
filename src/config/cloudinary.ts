import { v2 as cloudinary } from 'cloudinary';

let configured = false;

export const isCloudinaryConfigured = (): boolean => {
    return !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
};

export const getCloudinaryClient = () => {
    if (!isCloudinaryConfigured()) return null;
    if (!configured) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        configured = true;
    }
    return cloudinary;
};
