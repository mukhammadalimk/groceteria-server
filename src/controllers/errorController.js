const ErrorClass = require("../utils/errorClass");

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new ErrorClass(message, 400);
};

const handleDublicateFieldsDB = (err) => {
  const value = err.message.match(/(["'])(\\?.)*?\1/)[0];
  return new ErrorClass(
    `Dublicate field value: ${value}. Please use another value`,
    400
  );
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors).map((err) => err.message);

  return new ErrorClass(`Invalid input data. ${errors.join(". ")}`, 400);
};

const handleJWTError = (err) => {
  return new ErrorClass(`TokenError: Invalid token. Please log in again!`, 401);
};

const handleJWTExpireError = (err) =>
  new ErrorClass(`Your token has expired! Please log in again!`, 403);

const devErrors = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
  });
};

const prodErrors = (err, res) => {
  // Operational errors
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }
  // Pragramming or other unknown error
  // 1) Log error
  console.error("ERROR:", err);

  // 2) Send generic mesage
  return res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
};

// Global error handling middleware
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (process.env.NODE_ENV === "development") {
    devErrors(err, res);
  } else if (process.env.NODE_ENV === "production") {
    if (err.name === "CastError") err = handleCastErrorDB(err);

    if (err.code === 11000) err = handleDublicateFieldsDB(err);

    if (err.name === "ValidationError") err = handleValidationError(err);

    if (err.name === "JsonWebTokenError") err = handleJWTError(err);

    if (err.name === "TokenExpiredError") err = handleJWTExpireError(err);

    prodErrors(err, res);
  }
};
