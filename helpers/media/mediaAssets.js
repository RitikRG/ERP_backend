import { v2 as cloudinary } from "cloudinary";

let cloudinaryConfigured = false;

const ensureCloudinaryConfigured = () => {
  if (cloudinaryConfigured) {
    return;
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  cloudinaryConfigured = true;
};

const hasCloudinaryCredentials = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

export const resolvePublicAssetUrl = (publicRelativePath) => {
  const baseUrl = (process.env.SERVER_PUBLIC_URL || "").replace(/\/$/, "");

  if (!baseUrl) {
    return null;
  }

  const normalizedPath = publicRelativePath.startsWith("/")
    ? publicRelativePath
    : `/${publicRelativePath}`;

  return `${baseUrl}${normalizedPath}`;
};

export const uploadAudioBuffer = async (audioBuffer) => {
  if (!hasCloudinaryCredentials()) {
    throw new Error("Cloudinary credentials are not configured.");
  }

  ensureCloudinaryConfigured();

  const result = await new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { resource_type: "video", format: "mp3" },
        (error, uploadResult) =>
          error ? reject(error) : resolve(uploadResult)
      )
      .end(audioBuffer);
  });

  return result.secure_url;
};

export const resolveImageMediaUrl = async ({
  localFilePath,
  publicRelativePath,
  folder = "order-receipts",
}) => {
  if (hasCloudinaryCredentials()) {
    try {
      ensureCloudinaryConfigured();

      const result = await cloudinary.uploader.upload(localFilePath, {
        resource_type: "image",
        folder,
      });

      return result.secure_url;
    } catch (error) {
      console.error(
        `[MediaAssets] Cloudinary upload failed for ${localFilePath}:`,
        error.message
      );
    }
  }

  return resolvePublicAssetUrl(publicRelativePath);
};
