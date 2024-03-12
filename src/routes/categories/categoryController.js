const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");
const Category = require("../../models/categoryModel");
const cloudinary = require("../../utils/cloudinary");
const Product = require("../../models/productModel");

const getAllCategories = catchAsync(async (req, res, next) => {
  const categories = await Category.find();

  if (!categories) {
    return next(
      new ErrorClass(`Could not fetch categories. Please try again later.`, 400)
    );
  }

  return res.status(200).json({
    status: "success",
    data: categories,
  });
});

const deleteAllCategories = catchAsync(async (req, res, next) => {
  await Category.deleteMany();

  return res.status(204).json({
    status: "success",
    data: null,
  });
});

const getCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id).populate("products");

  if (!category) {
    return next(new ErrorClass(`No category found with this id`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: category,
  });
});

const deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findByIdAndDelete(req.params.id);
  const categoryProducts = await Product.find({ category: req.params.id });
  await Product.deleteMany({ category: req.params.id });

  try {
    //  Delete the image from the cloudinary
    await cloudinary.uploader.destroy(category.image.cloudinaryId);

    // Delete images of the category products from the cloudinary
    for (let i = 0; i < categoryProducts.length; i++) {
      await Promise.all(
        categoryProducts[i].images.map(
          async (image) => await cloudinary.uploader.destroy(image.cloudinaryId)
        )
      );
    }
  } catch (err) {
    return next(new ErrorClass(err, 400));
  }

  return res.status(204).json({
    status: "success",
    data: null,
  });
});

const createCategory = catchAsync(async (req, res, next) => {
  // Uploading image to the cloudinary is implemented through a middleware
  const category = await Category.create(req.body);

  return res.status(201).json({
    status: "success",
    data: category,
  });
});

const updateCategory = catchAsync(async (req, res, next) => {
  // Updating image in the cloudinary is implemented through a middleware
  const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({
    status: "success",
    data: category,
  });
});

module.exports = {
  getAllCategories,
  deleteAllCategories,
  getCategory,
  deleteCategory,
  createCategory,
  updateCategory,
};
