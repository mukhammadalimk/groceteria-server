const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  getOrder,
  cancelOrder,
  getMyOrders,
  getAllOrders,
  getUserOrders,
  updateOrderToDelivered,
  updateOrderToOnTheWay,
  getRecentOrders,
  getOrdersStats,
  getOrdersRevenueStats,
  getCheckoutSession,
  getPaypalClientId,
  createOrderInPaypal,
  captureOrderInPaypal,
  getStripePublishableKey,
} = require("./orderController");

const orderRouter = express.Router();

// All routes that come after this will be protected
orderRouter.use(protectRoutes);

orderRouter.post("/checkout-session", getCheckoutSession);

// For Users Only
orderRouter.get("/my-orders", restrictTo("user"), getMyOrders);
orderRouter.get("/paypal-client-id", restrictTo("user"), getPaypalClientId);
orderRouter.get(
  "/stripe-publishable-key",
  restrictTo("user"),
  getStripePublishableKey
);
orderRouter.post(
  "/paypal/create-order",
  restrictTo("user"),
  createOrderInPaypal
);
orderRouter.patch(
  "/:paypalOrderId/paypal/capture",
  restrictTo("user"),
  captureOrderInPaypal
);

orderRouter.patch("/:paypalOrderId/cancel", restrictTo("user"), cancelOrder);
// orderRouter.post("/", restrictTo("user"), createOrder);

orderRouter.get("/recent", restrictTo("admin"), getRecentOrders);
orderRouter.get("/stats", restrictTo("admin"), getOrdersStats);
orderRouter.get("/revenue-stats", restrictTo("admin"), getOrdersRevenueStats);

/// General routes
orderRouter.get("/:orderId", getOrder);

// For Admin Only
orderRouter.use(restrictTo("admin"));
orderRouter.get("/", getAllOrders);
orderRouter.patch("/:orderId/on-the-way", updateOrderToOnTheWay);
orderRouter.patch("/:orderId/delivered", updateOrderToDelivered);
orderRouter.get("/user/:userId", getUserOrders);

module.exports = orderRouter;
