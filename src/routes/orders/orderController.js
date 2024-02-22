const Order = require("../../models/orderModel");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");
const APIFeatures = require("../../utils/APIFeatures");

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
    { status: "cancelled" },
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
  const features = new APIFeatures(Order.find({ user: req.user.id }), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query;

  if (orders.length === 0) {
    return res.status(204).json({
      data: "No orders found for this user",
    });
  }

  return res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

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

// This routes are for ADMINS
const getUserOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.params.userId });

  if (!orders) {
    return next(new ErrorClass(`No orders found for this user`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: orders,
  });
});

const getAllOrders = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(Order.find(), req.query)
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query;

  if (!orders) return next(new ErrorClass("Error with getting orders", 404));

  return res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

const getRecentOrders = catchAsync(async (req, res, next) => {
  const features = new APIFeatures(
    Order.find({
      $or: [{ status: "paid" }, { status: "on the way" }],
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const orders = await features.query;

  if (!orders) return next(new ErrorClass("Error with getting orders", 404));

  return res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

const updateOrderToDelivered = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndUpdate(
    req.params.orderId,
    { status: "delivered", isDelivered: true, deliveredAt: Date.now() },
    { new: true, runValidators: true }
  );

  if (!order) return next(new ErrorClass("No order found with that id", 404));

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

const updateOrderToOnTheWay = catchAsync(async (req, res, next) => {
  await Order.updateOne(
    { _id: req.params.orderId },
    { status: "on the way", $unset: { deliveredAt: "" } },
    { new: true, runValidators: true }
  );

  const updatedOrder = await Order.findById(req.params.orderId);

  if (!updatedOrder)
    return next(new ErrorClass("No order found with that id", 404));

  return res.status(200).json({
    status: "success",
    data: updatedOrder,
  });
});

const getOrdersStats = catchAsync(async (req, res, next) => {
  const orders = await Order.find();

  const toBePacked = orders.filter((i) => i.status == "paid");
  const onTheWay = orders.filter((i) => i.status == "on the way");
  const delivered = orders.filter((i) => i.status == "delivered");
  const cancelled = orders.filter((i) => i.status == "cancelled");

  if (!orders)
    return next(new ErrorClass("No orders found for the query", 404));

  return res.status(200).json({
    status: "success",
    data: {
      total: orders.length,
      toBePacked: toBePacked.length,
      onTheWay: onTheWay.length,
      delivered: delivered.length,
      cancelled: cancelled.length,
    },
  });
});

const getOrdersRevenueStats = catchAsync(async (req, res, next) => {
  const orders = await Order.find();
  if (!orders)
    return next(new ErrorClass("No orders found for the query", 404));

  const filteredOrders = orders.filter((i) => i.status !== "cancelled");
  const cancelledOrders = orders.filter((i) => i.status === "cancelled");

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  const dateObj = new Date();
  const month = dateObj.getUTCMonth() + 1;
  const day = dateObj.getUTCDate();
  const year = dateObj.getUTCFullYear();

  function convertToLocal(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  }

  const updatedMonth = month < 10 ? `0${month}` : month;
  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  const todayRevenue = filteredOrders
    .filter(
      (i) =>
        convertToLocal(i.createdAt) > new Date(`${year}-${updatedMonth}-${day}`)
    )
    .reduce((sum, order) => sum + order.totalPrice, 0);
  const yesterdayRevenue = filteredOrders
    .filter(
      (i) =>
        convertToLocal(i.createdAt) <
          new Date(`${year}-${updatedMonth}-${day}`) &&
        convertToLocal(i.createdAt) >=
          new Date(`${year}-${updatedMonth}-${day - 1}`)
    )
    .reduce((sum, order) => sum + order.totalPrice, 0);

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  const thisWeekPassedDays = convertToLocal(new Date(Date.now())).getDay();
  const thisWeekStartDate = new Date(
    `${year}-${updatedMonth}-${day - thisWeekPassedDays}`
  );
  const lastWeekStartDate = new Date(
    `${year}-${updatedMonth}-${day - thisWeekPassedDays - 7}`
  );

  const thisWeekRevenue = filteredOrders
    .filter((i) => convertToLocal(i.createdAt) >= thisWeekStartDate)
    .reduce((sum, order) => sum + order.totalPrice, 0);

  const lastWeekRevenue = filteredOrders
    .filter(
      (i) =>
        convertToLocal(i.createdAt) >= lastWeekStartDate &&
        convertToLocal(i.createdAt) < thisWeekStartDate
    )
    .reduce((sum, order) => sum + order.totalPrice, 0);

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  const thisMonthStartDate = new Date(`${year}-${updatedMonth}-01`);
  let lastMonthStartDate;
  if (month === 1) {
    lastMonthStartDate = new Date(`${year - 1}-12-01`);
  } else {
    const updatedLastMonth = month < 10 ? `0${month - 1}` : month;
    lastMonthStartDate = new Date(`${year}-${updatedLastMonth}-01`);
  }

  const thisMonthRevenue = filteredOrders
    .filter((i) => convertToLocal(i.createdAt) >= thisMonthStartDate)
    .reduce((sum, order) => sum + order.totalPrice, 0);

  const lastMonthRevenue = filteredOrders
    .filter(
      (i) =>
        convertToLocal(i.createdAt) >= lastMonthStartDate &&
        convertToLocal(i.createdAt) < thisMonthStartDate
    )
    .reduce((sum, order) => sum + order.totalPrice, 0);

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  const thisYearStartDate = new Date(`${year}-01-01`);
  const thisYearRevenue = filteredOrders
    .filter((i) => convertToLocal(i.createdAt) >= thisYearStartDate)
    .reduce((sum, order) => sum + order.totalPrice, 0);

  const lastYearRevenue = filteredOrders
    .filter(
      (i) =>
        convertToLocal(i.createdAt) >= new Date(`${year - 1}-01-01`) &&
        convertToLocal(i.createdAt) < thisYearStartDate
    )
    .reduce((sum, order) => sum + order.totalPrice, 0);

  //////////////////////////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////////////
  const totalRevenue = filteredOrders.reduce(
    (sum, order) => sum + order.totalPrice,
    0
  );

  const calculateDifference = (newPrice, oldPrice) => {
    if (newPrice >= oldPrice) {
      return Number(((newPrice - oldPrice) / (oldPrice / 100)).toFixed(2));
    } else {
      return -Number(((oldPrice - newPrice) / (newPrice / 100)).toFixed(2));
    }
  };

  return res.status(200).json({
    status: "success",
    data: {
      dayStats: {
        new: todayRevenue,
        old: yesterdayRevenue,
        difference: calculateDifference(todayRevenue, yesterdayRevenue),
      },
      weekStats: {
        new: thisWeekRevenue,
        old: lastWeekRevenue,
        difference: calculateDifference(thisWeekRevenue, lastWeekRevenue),
      },
      monthStats: {
        new: thisMonthRevenue,
        old: lastMonthRevenue,
        difference: calculateDifference(thisMonthRevenue, lastMonthRevenue),
      },
      yearStats: {
        new: thisYearRevenue,
        old: lastYearRevenue,
        difference: calculateDifference(thisYearRevenue, lastYearRevenue),
      },
      totalRevenue,
      total: orders.length,
      cancelled: cancelledOrders.length,
    },
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
  getMyOrders,
  cancelOrder,
  getUserOrders,
  updateOrderToDelivered,
  updateOrderToOnTheWay,
  getRecentOrders,
  getOrdersStats,
  getOrdersRevenueStats,
};
