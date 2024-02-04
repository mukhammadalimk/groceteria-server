const Order = require("../../models/orderModel");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");

// This routes are for both admin and users

// This routes are for users
const createOrder = catchAsync(async (req, res, next) => {
  const order = await Order.create({ ...req.body, user: req.user.id });

  return res.status(201).json({
    status: "success",
    data: order,
  });
});

const cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndUpdate(
    req.params.orderId,
    { status: "Cancelled" },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!order) return next(new ErrorClass("Error with cancelling order", 404));

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

const getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.user.id });

  if (orders.length === 0) {
    return res.status(404).json({
      status: "fail",
      data: "No orders found for this user",
    });
  }

  return res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

const getMyOneOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById({ user: req.user.id });

  if (!order) return next(new ErrorClass("No order found for this user", 404));

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

// This routes are for ADMINS
const getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return next(new ErrorClass(`No order found with this id`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

const getUserOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.findOne({ user: req.params.userId });

  if (!orders) {
    return next(new ErrorClass(`No orders found for this user`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: orders,
  });
});

const getAllOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find();

  if (!orders) return next(new ErrorClass("Error with getting orders", 404));

  return res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

const updateOrderToDelivered = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) return next(new ErrorClass("No order found with that id", 404));

  order.isDelivered = true;
  order.deliveredAt = Date.now();
  order.status = "Delivered";
  await order.save();

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

const updateOrderToOnTheWay = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) return next(new ErrorClass("No order found with that id", 404));

  order.status = "On the way";
  await order.save();

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

const getOrdersByStatus = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ status: req.body.status });

  if (!orders)
    return next(new ErrorClass("No orders found for the query", 404));

  if (orders.length === 0) {
    return res.status(404).json({
      message: "No orders found with that status",
    });
  }

  return res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

// These should be updated
const getTodaysOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find()
    .where("createdAt")
    .lt(new Date(Date.now()).toISOString());

  if (!orders)
    return next(new ErrorClass("No orders found for the query", 404));

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

const getOrderByMonth = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ createdAt: { $gte: "" } });

  if (!orders)
    return next(new ErrorClass("No orders found for the query", 404));

  res.status(200).json({
    status: "success",
    data: orders,
  });
});

module.exports = {
  getAllOrders,
  getOrder,
  createOrder,
  getMyOneOrder,
  getMyOrders,
  cancelOrder,
  getUserOrders,
  updateOrderToDelivered,
  updateOrderToOnTheWay,
  getOrdersByStatus,
  getTodaysOrders,
};
