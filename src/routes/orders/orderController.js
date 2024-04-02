const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const Order = require("../../models/orderModel");
const ErrorClass = require("../../utils/errorClass");
const catchAsync = require("../../utils/catchAsync");
const APIFeatures = require("../../utils/APIFeatures");
const User = require("../../models/userModel");
const Cart = require("../../models/cartModel");
const base = "https://api-m.sandbox.paypal.com";
const {
  PAYPAL_CLIENT_ID,
  PAYPAL_CLIENT_SECRET,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PUBLISHABLE_KEY,
} = process.env;
const fetch = require("node-fetch");

////////////////////////////////////////////////
/// STRIPE INTEGRATION
const getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1. Get cart of the user
  const lineItems = req.body.orderedProducts.map((item) => {
    return {
      price_data: {
        currency: "usd",
        product_data: {
          name: item.name,
          images: [item.image],
        },
        unit_amount: item.price * 100,
      },
      quantity: item.quantity,
    };
  });

  // 2) Create checkout session
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      success_url: `https://groceteria-client.vercel.app/orders?alert=successful`,
      cancel_url: `https://groceteria-client.vercel.app/checkout`,
      customer_email: req.user.email,
      client_reference_id: `${req.user._id}/-@&$^$&@-/${req.body.address._id}/-@&$^$&@-/${req.body.notes}`,
      line_items: lineItems,
      shipping_options: [
        {
          shipping_rate_data: {
            display_name: "Groceteria delivery",
            fixed_amount: {
              amount: req.body.deliveryFee ? req.body.deliveryFee * 100 : 0,
              currency: "usd",
            },
            type: "fixed_amount",
          },
        },
      ],
    });

    // 3) Create session as response
    return res.status(200).json({
      status: "success",
      session,
    });
  } catch (error) {
    return next(new ErrorClass(error, 400));
  }
});

const webhookCheckout = (req, res) => {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    createBookingCheckout(event.data.object);
  }

  res.status(200).json({ received: true });
};

const createBookingCheckout = async (session) => {
  const arr = session.client_reference_id.split("/-@&$^$&@-/");
  const userId = arr[0];
  const addressId = arr[1];
  const notes = arr[2];
  const cart = await Cart.findOne({ user: userId });
  const user = await User.findById(userId);

  const shippingFee = cart.totalPrice < 50 ? 5.0 : 0;
  const total = cart.totalPrice + shippingFee;
  const orderData = {
    orderedProducts: cart.cartProducts,
    totalPrice: total,
    user: userId,
    paymentMethod: "Stripe",
    deliveryFee: shippingFee,
    address: user.addresses.find((i) => String(i._id) === addressId),
    notes: notes,
  };

  const order = await Order.create({
    ...orderData,
    status: "paid",
    isPaid: true,
  });

  await Cart.findOneAndDelete({
    user: userId,
  });

  let orderedProductsIds = user.orderedProducts || [];

  order.orderedProducts.forEach((i) => orderedProductsIds.push(i.productId));
  const uniqueArray = new Set(orderedProductsIds.map((i) => i.toString()));

  user.orderedProducts = [...uniqueArray];
  await user.save({ validateBeforeSave: false });
};

const getStripePublishableKey = catchAsync(async (req, res, next) => {
  return res.status(200).json({
    publishableKey: STRIPE_PUBLISHABLE_KEY,
  });
});

////////////////////////////////////////////////
/// PAYPAL INTEGRATION
const getPaypalClientId = catchAsync(async (req, res, next) => {
  return res.status(200).json({
    clientId: PAYPAL_CLIENT_ID,
  });
});

const generateAccessToken = async () => {
  try {
    if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
      throw new Error("MISSING_API_CREDENTIALS");
    }
    const auth = Buffer.from(
      PAYPAL_CLIENT_ID + ":" + PAYPAL_CLIENT_SECRET
    ).toString("base64");

    const response = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      body: "grant_type=client_credentials",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("Failed to generate Access Token:", error.response);
  }
};

const createOrder = async (order) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders`;
  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: order.totalPrice,
          breakdown: {
            item_total: {
              currency_code: "USD",
              value: order.totalPrice - order.deliveryFee,
            },
            shipping: {
              currency_code: "USD",
              value: order.deliveryFee,
            },
          },
        },
        items: order.orderedProducts.map((item) => {
          return {
            name: item.name,
            unit_amount: {
              currency_code: "USD",
              value: item.price,
            },
            quantity: item.quantity,
          };
        }),
      },
    ],
  };

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  return handleResponse(response);
};

const captureOrder = async (orderID) => {
  const accessToken = await generateAccessToken();
  const url = `${base}/v2/checkout/orders/${orderID}/capture`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return handleResponse(response);
};

async function handleResponse(response) {
  try {
    const jsonResponse = await response.json();
    return {
      jsonResponse,
      httpStatusCode: response.status,
    };
  } catch (err) {
    const errorMessage = await response.text();
    throw new Error(errorMessage);
  }
}

const createOrderInPaypal = async (req, res) => {
  try {
    // use the cart information passed from the front-end to calculate the order amount detals
    const { jsonResponse, httpStatusCode } = await createOrder(req.body);
    await Order.create({ ...req.body, paypalOrderId: jsonResponse.id });
    return res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error.response);
    return res.status(500).json({ error: "Failed to create order." });
  }
};

const captureOrderInPaypal = async (req, res) => {
  try {
    const { paypalOrderId } = req.params;
    const { jsonResponse, httpStatusCode } = await captureOrder(paypalOrderId);

    const order = await Order.findOneAndUpdate(
      { paypalOrderId },
      {
        isPaid: true,
        status: "paid",
      }
    );

    await Cart.findOneAndDelete({ user: req.user._id });
    const user = await User.findById(order.user);

    let orderedProductsIds = user.orderedProducts || [];

    order.orderedProducts.forEach((i) => orderedProductsIds.push(i.productId));
    const uniqueArray = new Set(orderedProductsIds.map((i) => i.toString()));

    user.orderedProducts = [...uniqueArray];
    await user.save({ validateBeforeSave: false });
    return res.status(httpStatusCode).json(jsonResponse);
  } catch (error) {
    console.error("Failed to create order:", error);
    return res.status(500).json({ error: "Failed to capture order." });
  }
};

const cancelOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findOneAndUpdate(
    { paypalOrderId: req.params.paypalOrderId },
    { status: "cancelled" },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!order) return next(new ErrorClass("Error with cancelling order", 404));

  return res.status(200).json({
    status: "success",
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
    return res.status(200).json({
      message: "No orders found for this user",
      data: [],
    });
  }

  return res.status(200).json({
    status: "success",
    data: orders,
  });
});

const getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return next(new ErrorClass(`No order found with this id.`, 404));
  }

  return res.status(200).json({
    status: "success",
    data: order,
  });
});

// This routes are for ADMINS
const getUserOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({ user: req.params.userId }).sort(
    "-createdAt"
  );

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
    { status: "on the way", isDelivered: false, $unset: { deliveredAt: "" } },
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

  if (!orders)
    return next(new ErrorClass("No orders found to show the statistics", 404));

  const toBePacked = orders.filter((i) => i.status == "paid");
  const onTheWay = orders.filter((i) => i.status == "on the way");
  const delivered = orders.filter((i) => i.status == "delivered");
  const cancelled = orders.filter((i) => i.status == "cancelled");

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

// TODO: Fix this week and last weeks revenue
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
    if (newPrice === 0 && oldPrice === 0) return 0;
    if (newPrice === 0) return -oldPrice;
    if (oldPrice === 0) return newPrice;
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
  cancelOrder,
  getPaypalClientId,
  webhookCheckout,
  getCheckoutSession,
  getStripePublishableKey,
  getMyOrders,
  getUserOrders,
  updateOrderToDelivered,
  updateOrderToOnTheWay,
  getRecentOrders,
  getOrdersStats,
  getOrdersRevenueStats,
  createOrderInPaypal,
  captureOrderInPaypal,
};
