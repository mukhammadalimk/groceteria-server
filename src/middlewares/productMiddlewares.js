const Product = require("../models/productModel");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const cloudinary = require("../utils/cloudinary");
const { updateProductOrNewsImages } = require("./commonMiddlewares");

function clean(obj) {
  for (const propName in obj) if (obj[propName] === "") delete obj[propName];
  return obj;
}

const validateProductProperties = catchAsync(async (req, res, next) => {
  // 1) Check if all required properties come from frontend.
  const { name, price, description, discountedPrice, category, store } =
    req.body;

  req.body = clean(req.body);

  let validatedOnPost = false;
  if (req.method === "POST") {
    validatedOnPost =
      !name ||
      !price ||
      Number(price) <= 0 ||
      !description ||
      !category ||
      !store ||
      !req.files;
  }

  let validatedOnPatch = false;
  if (req.method === "PATCH") {
    validatedOnPatch =
      !name ||
      !price ||
      Number(price) <= 0 ||
      !description ||
      !category ||
      !store;
  }

  if (validatedOnPost || validatedOnPatch) {
    return next(new ErrorClass("Please check properties of the product", 400));
  }

  // 2. Check if discountPrice is not higher than the actual price
  if (discountedPrice) {
    if (
      Number(discountedPrice) > Number(price) ||
      Number(discountedPrice) < 0
    ) {
      return next(
        new ErrorClass(
          "Sale price should be lower than the actual price or higher than 0.",
          400
        )
      );
    }
  }

  next();
});

const uploadProductImages = catchAsync(async (req, res, next) => {
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
  const updatedBody = clean(req.body);
  req.body = updatedBody;
  req.body.images = images;

  next();
});

const updateProductImages = updateProductOrNewsImages(
  Product,
  "products",
  "productId"
);

module.exports = {
  validateProductProperties,
  updateProductImages,
  uploadProductImages,
};
