const Category = require("../models/categoryModel");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const cloudinary = require("../utils/cloudinary");

const validateCategory = (name, file, dontValidateFile) => {
  const isNameValid = /^[a-zA-Z ]+$/.test(name);
  /// Category validation;
  let errorText = "";

  if (!dontValidateFile) {
    if (name === "" && file) errorText = "enter a name.";
    if (name && !isNameValid)
      errorText = "enter a category name using only characters.";
    if (!file && name && isNameValid) errorText = "upload an image.";
    if (name === "" && !file) errorText = "enter required fields.";
  }

  if (dontValidateFile) {
    if (name && !isNameValid)
      errorText = "enter a category name using only characters.";
    if (name === "") errorText = "enter a name.";
  }

  return errorText;
};

const updateCategoryImage = catchAsync(async (req, res, next) => {
  const { name } = req.body;

  const errorText = validateCategory(name, req.file, true);
  if (errorText !== "")
    return next(new ErrorClass(`Please, ${errorText}`, 400));

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

  const categories = await Category.find();

  const nameExist = categories.find(
    (i) => i.name.toLowerCase() === name.toLowerCase()
  );

  if (nameExist)
    return next(new ErrorClass(`The category (${name}) already exists.`, 400));

  const errorText = validateCategory(name, req.file, false);
  if (errorText !== "")
    return next(new ErrorClass(`Please, ${errorText}`, 400));

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
