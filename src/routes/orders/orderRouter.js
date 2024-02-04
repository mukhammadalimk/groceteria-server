const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  createOrder,
  getMyOneOrder,
  getOrder,
  cancelOrder,
  getMyOrders,
  getAllOrders,
  getUserOrders,
  updateOrderToDelivered,
  updateOrderToOnTheWay,
  getOrdersByStatus,
  getTodaysOrders,
} = require("./orderController");

const orderRouter = express.Router();

// All routes that come after this will be protected
orderRouter.use(protectRoutes);

// For Users Only
orderRouter.get("/my-orders", restrictTo("user"), getMyOrders);
orderRouter.patch("/:orderId/cancel", restrictTo("user"), cancelOrder);
orderRouter.post("/", restrictTo("user"), createOrder);
orderRouter.post("/my-order", restrictTo("user"), getMyOneOrder);

// For Admin Only
orderRouter.use(restrictTo("admin"));
orderRouter.get("/", getAllOrders);
orderRouter.get("/today", getTodaysOrders);
orderRouter.patch("/:orderId/on-the-way", updateOrderToOnTheWay);
orderRouter.patch("/:orderId/delivered", updateOrderToDelivered);
orderRouter.get("/status", getOrdersByStatus);
orderRouter.get("/:orderId", getOrder);
orderRouter.get("/user/:userId", getUserOrders);

module.exports = orderRouter;
