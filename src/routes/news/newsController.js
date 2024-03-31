const News = require("../../models/newsModel");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");
const cloudinary = require("../../utils/cloudinary");
const APIFeatures = require("../../utils/APIFeatures");

const getAllNews = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(News.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const news = await features.query;

  return res.status(200).json({
    status: "success",
    data: news.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
  });
});

const getNews = catchAsync(async (req, res, next) => {
  const news = await News.findById(req.params.newsId);

  if (!news) {
    return next(new ErrorClass(`No news found with this id`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: news,
  });
});

const deleteNews = catchAsync(async (req, res, next) => {
  const news = await News.findByIdAndDelete(req.params.newsId);

  if (!news) {
    return next(new ErrorClass(`No news found with this id`, 404));
  }

  // Destroy images in cloudinary too
  try {
    await Promise.all(
      news.images.map(
        async (item) => await cloudinary.uploader.destroy(item.cloudinaryId)
      )
    );
  } catch (err) {
    return next(new ErrorClass(err, 400));
  }

  return res.status(204).json({ status: "success" });
});

const createNews = catchAsync(async (req, res, next) => {
  const news = await News.create(req.body);

  return res.status(201).json({
    status: "success",
    data: news,
  });
});

const updateNews = catchAsync(async (req, res, next) => {
  const news = await News.findByIdAndUpdate(req.params.newsId, req.body, {
    new: true,
    runValidators: true,
  });

  return res.status(200).json({
    status: "success",
    data: news,
  });
});

module.exports = {
  getAllNews,
  getNews,
  deleteNews,
  createNews,
  updateNews,
};
