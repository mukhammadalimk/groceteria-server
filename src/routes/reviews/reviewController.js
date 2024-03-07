const Review = require("../../models/reviewModel");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");
const Product = require("../../models/productModel");
const APIFeatures = require("../../utils/APIFeatures");

exports.getReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.reviewId);

  if (!review) {
    return next(new ErrorClass(`No review found with this id`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: review,
  });
});

////////////////////////////////////////////////////////////////
exports.getAllReviews = catchAsync(async (req, res, next) => {
  let filter = {};
  if (req.params.productId) filter = { product: req.params.productId };
  if (req.params.userId) filter = { user: req.params.userId };

  let userReview;
  if (req.query.userId && req.query.page == 1) {
    userReview = await Review.findOne({
      product: req.params.productId,
      user: req.query.userId,
    });
    req.query.userId = undefined;
  }

  const features = new APIFeatures(Review.find(filter), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query;

  let filteredReviews = JSON.parse(JSON.stringify(reviews));
  if (userReview) filteredReviews.unshift(userReview);

  return res.status(200).json({
    status: "success",
    data: filteredReviews,
  });
});

exports.createReview = catchAsync(async (req, res, next) => {
  // This is for creating a review on product without passing manually product and user ids
  if (!req.body.product) req.body.product = req.params.productId;
  if (!req.body.user) req.body.user = req.user.id;

  const review = await Review.create(req.body);
  let user = {};
  user.name = req.user.name;
  user.photo = req.user.photo;
  user.username = req.user.username;
  user._id = req.user.id;

  const product = await Product.findById(req.body.product).populate("category");

  const newRatingsQuantity = product.ratingsQuantity + 1;
  const oldAllRatingsSum = product.ratingsAverage
    ? product.ratingsAverage * product.ratingsQuantity
    : review.rating;
  const newRatingsAverage = product.ratingsAverage
    ? (oldAllRatingsSum + review.rating) / newRatingsQuantity
    : review.rating / newRatingsQuantity;
  product.ratingsAverage = Math.round(newRatingsAverage * 10) / 10;
  product.ratingsQuantity = newRatingsQuantity;

  return res.status(201).json({
    status: "success",
    data: { product, review: { ...JSON.parse(JSON.stringify(review)), user } },
  });
});

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.reviewId);
  // Restricing user from deleting others's reviews
  if (
    req.user.role === "user" &&
    review.user._id.toString() !== req.user._id.toString()
  ) {
    return next(new ErrorClass(`You can not delete others's review`, 403));
  }

  const deletedReview = await Review.findByIdAndDelete(req.params.reviewId);

  if (!deletedReview) {
    return next(new AppError("No review found with that ID", 404));
  }

  const product = await Product.findById(review.product).populate("category");

  return res.status(201).json({
    status: "success",
    data: { product, reviewId: deletedReview._id },
  });
});

exports.updateReview = catchAsync(async (req, res, next) => {
  const updatingReview = await Review.findById(req.params.reviewId);
  // Restricing user from updating others's reviews
  if (updatingReview.user._id.toString() !== req.user._id.toString()) {
    return next(new ErrorClass(`You can not update others's review`, 403));
  }

  const review = await Review.findByIdAndUpdate(req.params.reviewId, req.body, {
    new: true,
    runValidators: true,
  });

  const product = await Product.findById(req.body.product).populate("category");

  return res.status(200).json({
    status: "success",
    data: { product, review },
  });
});

////////////////////////////////////////////////////////////////
exports.writeReply = catchAsync(async (req, res, next) => {
  const updatingReview = await Review.findById(req.params.reviewId);

  updatingReview.replies = updatingReview.replies || [];
  const creatingReply = req.body;
  creatingReply.createdAt = Date.now();
  updatingReview.replies.push(req.body);
  await updatingReview.save();

  const updatedReview = await Review.findById(req.params.reviewId);

  return res.status(200).json({
    status: "success",
    data: updatedReview,
  });
});

exports.updateReply = catchAsync(async (req, res, next) => {
  const reviewId = req.params.reviewId;
  const replyId = req.params.replyId;
  const updatingReview = await Review.findById(reviewId);

  const updatingReply = updatingReview.replies.find(
    (i) => String(i._id) === String(replyId)
  );
  updatingReply.text = req.body.text;

  const updatingReplyIndex = updatingReview.replies.findIndex(
    (i) => String(i._id) === String(replyId)
  );
  updatingReply.updatedAt = Date.now();
  updatingReview.replies[updatingReplyIndex] = updatingReply;
  await updatingReview.save();

  const updatedReview = await Review.findById(req.params.reviewId);

  return res.status(200).json({
    status: "success",
    data: updatedReview,
  });
});

exports.deleteReply = catchAsync(async (req, res, next) => {
  const updatingReview = await Review.findById(req.params.reviewId);

  updatingReview.replies = updatingReview.replies.filter(
    (i) => String(i._id) !== String(req.params.replyId)
  );
  await updatingReview.save();

  const updatedReview = await Review.findById(req.params.reviewId);

  return res.status(200).json({
    status: "success",
    data: updatedReview,
  });
});
