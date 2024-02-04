const express = require("express");
const {
  protectRoutes,
  restrictTo,
} = require("../../controllers/authController");
const {
  getMyCart,
  updateCart,
  addToCart,
  deleteProductFromCart,
} = require("./cartController");

const orderRouter = express.Router();

// All routes that come after this will be protected
orderRouter.use(protectRoutes);
orderRouter.use(restrictTo("user", "admin", "manager"));

orderRouter.route("/").get(getMyCart).patch(updateCart).post(addToCart);
orderRouter.route("/delete-product").patch(deleteProductFromCart);

module.exports = orderRouter;
