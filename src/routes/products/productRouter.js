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
} = require("./productController");

const productRouter = express.Router();

// All routes after this middleware will be protected
// productRouter.use(protectRoutes);

// This is for creating a review on a tour without manually passing tour and user ids
productRouter.use("/:productId/reviews", reviewRouter);

productRouter
  .route("/")
  .get(getAllProducts)
  .post(
    protectRoutes,
    restrictTo("admin", "manager"),
    multerProductOrNewsImages,
    validateProductProperties,
    uploadProductImages,
    createProduct
  )
  .patch(protectRoutes, restrictTo("admin", "manager"), updateAllProducts)
  .delete(protectRoutes, restrictTo("admin", "manager"), deleteAllProducts);

productRouter
  .route("/:productId")
  .patch(
    protectRoutes,
    restrictTo("admin", "manager"),
    multerProductOrNewsImages,
    validateProductProperties,
    updateProductImages,
    updateProduct
  )
  .delete(protectRoutes, restrictTo("admin", "manager"), deleteProduct)
  .get(getProduct);

module.exports = productRouter;
