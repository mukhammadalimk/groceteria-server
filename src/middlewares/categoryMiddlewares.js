const Category = require("../models/categoryModel");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const cloudinary = require("../utils/cloudinary");

const updateCategoryImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  // 1) Find the updating product
  const updatingCategory = await Category.findById(req.params.id);

  let imageObj = {};
  try {
    // 2) Delete the image from the cloudinary
    await cloudinary.uploader.destroy(updatingCategory.image.cloudinaryId);

    // 3) Upload new iamge to the cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      upload_preset: "categories",
    });
    imageObj.imageUrl = result.secure_url;
    imageObj.cloudinaryId = result.public_id;
  } catch (err) {
    return next(new ErrorClass(err.message, 400));
  }

  // 3) Put it in req.body.image which updateCategory will have access
  req.body.image = imageObj;

  next();
});

const uploadCategoryImage = catchAsync(async (req, res, next) => {
  // 1) Check the validity of the creating category properties.
  const { name } = req.body;

  if (!name || !req.file) {
    return next(new ErrorClass("Please check properties of the category", 400));
  }

  // 2) Upload image to cloudinary
  let imageObj = {};
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      upload_preset: "categories",
    });
    imageObj.imageUrl = result.secure_url;
    imageObj.cloudinaryId = result.public_id;
  } catch (err) {
    return next(new ErrorClass(err.message, 400));
  }

  // 3) Put the image object into the req.body.image which createCategory will have access to
  req.body.image = imageObj;

  next();
});

module.exports = {
  updateCategoryImage,
  uploadCategoryImage,
};
