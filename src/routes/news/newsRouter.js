const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  multerProductOrNewsImages,
} = require("../../middlewares/commonMiddlewares");

const {
  uploadNewsImages,
  updateNewsImages,
} = require("../../middlewares/newsMiddlewares");
const {
  getAllNews,
  getNews,
  createNews,
  updateNews,
  deleteNews,
} = require("./newsController");

const newsRouter = express.Router();

newsRouter.route("/").get(getAllNews);
newsRouter.route("/:newsId").get(getNews);

// All routes will be restricted to users after this
newsRouter.use(protectRoutes);
newsRouter.use(restrictTo("admin"));
newsRouter
  .route("/")
  .post(multerProductOrNewsImages, uploadNewsImages, createNews);
newsRouter
  .route("/:newsId")
  .patch(multerProductOrNewsImages, updateNewsImages, updateNews)
  .delete(deleteNews);

module.exports = newsRouter;
