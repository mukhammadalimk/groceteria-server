const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  updateCategoryImage,
  uploadCategoryImage,
} = require("../../middlewares/categoryMiddlewares");
const { multerCategoryImage } = require("../../middlewares/commonMiddlewares");

const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategory,
  getAllCategories,
  deleteAllCategories,
} = require("./categoryController");

const categoryRouter = express.Router();

categoryRouter
  .route("/")
  .get(getAllCategories)
  .post(
    protectRoutes,
    restrictTo("admin"),
    multerCategoryImage,
    uploadCategoryImage,
    createCategory
  )
  .delete(protectRoutes, restrictTo("admin"), deleteAllCategories);

categoryRouter
  .route("/:id")
  .patch(
    protectRoutes,
    restrictTo("admin"),
    multerCategoryImage,
    updateCategoryImage,
    updateCategory
  )
  .delete(protectRoutes, restrictTo("admin"), deleteCategory)
  .get(getCategory);

module.exports = categoryRouter;
