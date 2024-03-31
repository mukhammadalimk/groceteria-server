const News = require("../models/newsModel");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const cloudinary = require("../utils/cloudinary");
const { updateProductOrNewsImages } = require("./commonMiddlewares");

const uploadNewsImages = catchAsync(async (req, res, next) => {
  // 1) Check the validity of the creating news properties.
  const { title, text } = req.body;

  if (!title || !text || req.files.length === 0) {
    return next(new ErrorClass("Please check properties of the news", 400));
  }

  // 2) Upload images to cloudinary
  const images = [];
  try {
    await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          upload_preset: "news",
        });

        images.push({
          imageUrl: result.secure_url,
          cloudinaryId: result.public_id,
        });
      })
    );
  } catch (err) {
    return next(new ErrorClass(err.message, 400));
  }

  // 3) Put images into the req.body.images
  req.body.images = images;

  next();
});

const updateNewsImages = updateProductOrNewsImages(News, "news", "newsId");

module.exports = {
  uploadNewsImages,
  updateNewsImages,
};
