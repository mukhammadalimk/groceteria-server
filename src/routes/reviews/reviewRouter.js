const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  createReview,
  updateReview,
  deleteReview,
  getReview,
  getAllReviews,
} = require("./reviewController");

const reviewRouter = express.Router({ mergeParams: true });

// All routes that come after this will be protected
reviewRouter.use(protectRoutes);

reviewRouter
  .route("/")
  .get(getAllReviews)
  .post(restrictTo("user"), createReview);

reviewRouter
  .route("/:reviewId")
  .patch(restrictTo("user"), updateReview)
  .delete(restrictTo("user"), deleteReview)
  .get(getReview);

module.exports = reviewRouter;
