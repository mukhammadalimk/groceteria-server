const Product = require("../models/productModel");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const cloudinary = require("../utils/cloudinary");
const { updateProductOrNewsImages } = require("./commonMiddlewares");

const uploadProductImages = catchAsync(async (req, res, next) => {
  // 1) Check the validity of the creating product properties.
  const { name, price, description, discountPercent, category, store } =
    req.body;

  if (
    !name ||
    !price ||
    Number(price) <= 0 ||
    !description ||
    !category ||
    !store ||
    !req.files
  ) {
    return next(new ErrorClass("Please check properties of the product", 400));
  }

  if (discountPercent) {
    if (Number(discountPercent) > 100 || Number(discountPercent) < 0) {
      return next(
        new ErrorClass("Please check properties of the product", 400)
      );
    }
  }

  // 2) Upload images to cloudinary
  const images = [];
  try {
    await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          upload_preset: "products",
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

const updateProductImages = updateProductOrNewsImages(
  Product,
  "products",
  "productId"
);

module.exports = {
  updateProductImages,
  uploadProductImages,
};
