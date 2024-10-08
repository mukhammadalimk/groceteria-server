const hpp = require("hpp");
const cors = require("cors");
const xss = require("xss-clean");
const helmet = require("helmet");
const express = require("express");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const ErrorClass = require("./utils/errorClass");
const cartRouter = require("./routes/cart/cartRouter");
const newsRouter = require("./routes/news/newsRouter");
const mongoSanitize = require("express-mongo-sanitize");
const userRouter = require("./routes/users/userRouter");
const orderRouter = require("./routes/orders/orderRouter");
const reviewRouter = require("./routes/reviews/reviewRouter");
const productRouter = require("./routes/products/productRouter");
const globalErrorHandler = require("./controllers/errorController");
const categoryRouter = require("./routes/categories/categoryRouter");
const { webhookCheckout } = require("./routes/orders/orderController");

const app = express();

const allowedDomains = [
  "https://groceteria-mk.vercel.app",
  "https://www.groceteria.dev",
  "http://localhost:3000",
  "https://checkout.stripe.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedDomains.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, new Error("Not allowed by cors"));
    }
  },
  credentials: true, //access-control-allow-credentials:true,
  exposedHeaders: ["Set-Cookie"],
};
app.use(cors(corsOptions));

// Set security HTTP headers
app.use(helmet());

// Limit requests from one API
const limiter = rateLimit({
  max: 10000,
  windowMs: 60 * 60 * 1000,
  message: "Too many requests sent from this IP, please try again in an hour!",
});
app.use("/api", limiter);

app.post(
  "/webhook-checkout",
  express.raw({ type: "application/json" }),
  webhookCheckout
);

// Body parser
app.use(express.json());

// Middleware for cookies
app.use(cookieParser());

// Data sanitization against NoSQL query injection
app.use(mongoSanitize()); // this filters out all the $ signs from req.params, req.body, req.queryString

// Data sanitization against XSS
app.use(xss()); // this will clean any user input from malicious HTML code

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: ["price", "ratingsAverage", "ratingsQuantity", "inStock"],
  })
);

// Routes
app.use("/api/v1/products", productRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/categories", categoryRouter);
app.use("/api/v1/reviews", reviewRouter);
app.use("/api/v1/orders", orderRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/news", newsRouter);

// Handling Unhandled Routes
app.all("*", (req, res, next) => {
  next(new ErrorClass(`Can't find ${req.originalUrl} on this sever!`, 404));
});

// Global error handling middleware
app.use(globalErrorHandler);

module.exports = app;
