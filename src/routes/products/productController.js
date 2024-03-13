const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const Product = require("../../models/productModel");
const APIFeatures = require("../../utils/APIFeatures");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");
const cloudinary = require("../../utils/cloudinary");
const Category = require("../../models/categoryModel");

////////////////////////////////////////////////////////////////////////
const getAllProducts = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Product.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query.populate({
    path: "category",
    select: "name",
  });

  if (!products) {
    return next(
      new ErrorClass(
        `Sorry, we could not get products. Please, come back later or refresh the page.`,
        400
      )
    );
  }

  for (let i = products.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [products[i], products[j]] = [products[j], products[i]];
  }

  return res.status(200).json({
    status: "success",
    data: products,
  });
});

const getProduct = catchAsync(async (req, res, next) => {
  const result = await Product.aggregate([
    { $match: { _id: ObjectId(req.params.productId) } },
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "product",
        as: "reviewsCount",
      },
    },
    { $addFields: { reviewsCount: { $size: "$reviewsCount" } } },
  ]);

  const product = await Product.populate(result, { path: "category" });

  if (!product[0]) {
    return next(new ErrorClass(`No product found with this id`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: product[0],
  });
});

const deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndDelete({
    _id: req.params.productId,
  });

  if (!product) {
    return next(new ErrorClass(`No product found with this id`, 404));
  }

  // Destroy images in cloudinary too
  try {
    await Promise.all(
      product.images.map(
        async (item) => await cloudinary.uploader.destroy(item.cloudinaryId)
      )
    );
  } catch (err) {
    return next(new ErrorClass(err, 400));
  }

  return res.status(204).json({
    status: "success",
    data: null,
  });
});

const createProduct = catchAsync(async (req, res, next) => {
  // Uploading images to the cloudinary is implemented through a middleware
  const product = await Product.create(req.body);

  return res.status(201).json({
    status: "success",
    data: product,
  });
});

const updateProduct = catchAsync(async (req, res, next) => {
  // Updating images in the cloudinary is implemented through a middleware

  // If the admin changes the category of the product.
  if (req.body.category.startsWith("New")) {
    req.body.category = req.body.category.split(" ")[1];
    const updatingProduct = await Product.findById(req.params.productId);

    const currentCategory = await Category.findById(updatingProduct.category);

    // 1. First: we decrement the numberOfProducts of the category the updatingProduct is in now.
    await Category.findByIdAndUpdate(
      currentCategory._id,
      { numberOfProducts: currentCategory.numberOfProducts - 1 },
      { runValidators: true, new: true }
    );
    // 2. Second: we increment the numberOfProducts of the new category the product is being added to.
    const newCategory = await Category.findById(req.body.category);
    await Category.findByIdAndUpdate(
      newCategory._id,
      { numberOfProducts: newCategory.numberOfProducts + 1 },
      { runValidators: true, new: true }
    );
  }

  // inStock comes as string from frontend and we convert it to boolean here.
  req.body.inStock = JSON.parse(req.body.inStock);

  const product = await Product.findByIdAndUpdate(
    req.params.productId,
    req.body,
    {
      new: true,
      runValidators: true,
    }
  ).populate("category");

  product.reviewsCount = req.body.reviewsCount;

  return res.status(200).json({
    status: "success",
    data: product,
  });
});

const updateAllProducts = catchAsync(async (req, res, next) => {
  const products = await Product.updateMany({}, req.body);

  return res.status(200).json({
    status: "success",
    data: products,
  });
});

const deleteAllProducts = catchAsync(async (req, res, next) => {
  await Product.deleteMany();

  return res.status(204).json({
    status: "success",
    data: null,
  });
});

module.exports = {
  getAllProducts,
  deleteAllProducts,
  getProduct,
  deleteProduct,
  createProduct,
  updateProduct,
  updateAllProducts,
};
