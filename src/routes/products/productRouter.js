const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  multerProductOrNewsImages,
} = require("../../middlewares/commonMiddlewares");
const {
  updateProductImages,
  uploadProductImages,
  validateProductProperties,
} = require("../../middlewares/productMiddlewares");
const reviewRouter = require("../reviews/reviewRouter");
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getProduct,
  getAllProducts,
  updateAllProducts,
  deleteAllProducts,
  getTopProducts,
  getSaleProducts,
  getNewProducts,
  getProductsYouMayLike,
  getCategoryProducts,
} = require("./productController");

const productRouter = express.Router();

// All routes after this middleware will be protected
// productRouter.use(protectRoutes);

// This is for creating a review on a tour without manually passing tour and user ids
productRouter.use("/:productId/reviews", reviewRouter);

// Most of these will not be needed. Need to update it
productRouter.get("/category/:categoryId", getCategoryProducts);
productRouter.get("/top-rated", getTopProducts);
productRouter.get("/sale", getSaleProducts);
productRouter.get("/new", getNewProducts);
productRouter.get("/you-may-like", getProductsYouMayLike);

productRouter
  .route("/")
  .get(getAllProducts)
  .post(
    protectRoutes,
    restrictTo("admin"),
    multerProductOrNewsImages,
    validateProductProperties,
    uploadProductImages,
    createProduct
  )
  .patch(protectRoutes, restrictTo("admin"), updateAllProducts)
  .delete(protectRoutes, restrictTo("admin"), deleteAllProducts);

productRouter
  .route("/:productId")
  .patch(
    protectRoutes,
    restrictTo("admin"),
    multerProductOrNewsImages,
    validateProductProperties,
    updateProductImages,
    updateProduct
  )
  .delete(protectRoutes, restrictTo("admin"), deleteProduct)
  .get(getProduct);

module.exports = productRouter;
