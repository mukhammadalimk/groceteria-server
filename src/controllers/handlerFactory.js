const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");

const getCompareOrWishList = (Modal, type) =>
  catchAsync(async (req, res, next) => {
    const user = await Modal.findById(req.user._id).populate({
      path: type,
    });

    if (!user)
      return next(new ErrorClass("Could not find user with that id", 404));

    const listType = type === "compare" ? user.compare : user.wishlisted;

    return res.status(200).json({
      status: "success",
      results: listType.length,
      data: type === "compare" ? user.compare : user.wishlisted,
    });
  });

const addToCompareOrWishlist = (User, Product, type) =>
  catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.body.productId);

    if (!product)
      return next(new ErrorClass("Could not find wanted product", 404));

    const user = await User.findById(req.user._id);
    const listType = type === "compare" ? user.compare : user.wishlisted;
    const existingProduct = listType.find(
      (productId) => productId.toString() == product._id.toString()
    );

    if (existingProduct) {
      return next(
        new ErrorClass(
          `You have already added this product to your ${
            type === "wishlisted" ? "wishlist" : type + "list"
          }`,
          403
        )
      );
    }

    listType.push(product._id);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      data: product,
    });
  });

const removeFromCompareOrWishlist = (User, Product, type) =>
  catchAsync(async (req, res, next) => {
    const product = await Product.findById(req.body.productId);

    if (product === null)
      return next(new ErrorClass("Could not find wanted product", 404));

    const user = await User.findById(req.user._id);
    const listType = type === "compare" ? user.compare : user.wishlisted;
    const removingProductIndex = listType.findIndex(
      (productId) => productId.toString() === product._id.toString()
    );

    // When a user tries to remove a product that has already been removed
    if (removingProductIndex === -1) {
      return next(
        new ErrorClass(
          `You have already removed this product from your ${
            type === "wishlisted" ? "wishlist" : type + "list"
          }`,
          404
        )
      );
    }

    listType.splice(removingProductIndex, 1);
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      data: product._id,
    });
  });

module.exports = {
  getCompareOrWishList,
  addToCompareOrWishlist,
  removeFromCompareOrWishlist,
};
