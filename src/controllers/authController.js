const { promisify } = require("util");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const sendEmail = require("../utils/email");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // this ensures that cookie can not be modifed by the browser
  };
  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  // Remove password from output
  user.password = undefined;

  res.cookie("jwt", token, cookieOptions);

  return res.status(statusCode).json({
    status: "success",
    token,
    user,
  });
};

const sendingEmailError = async (user) => {
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  await user.save({ validateBeforeSave: false });

  return next(
    new ErrorClass("There was an error sending the email. Try again later!"),
    500
  );
};

const signup = catchAsync(async (req, res, next) => {
  // 1. Check if email or username already exists
  let userWithEmail = await User.findOne({ email: req.body.email });
  let userWithUsername = await User.findOne({ username: req.body.username });
  if (userWithEmail || userWithUsername)
    return next(
      new ErrorClass(
        `User with this ${
          userWithEmail ? "email" : "username"
        } already exists. Please log in if it is you`,
        400
      )
    );

  // 2. We create a user but they will be in pending status, which means they can not log in
  const randomNumber = Math.floor(100000 + Math.random() * 900000);
  const newUser = await User.create({
    name: req.body.name,
    username: req.body.username,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    verificationCode: randomNumber,
    verificationCodeExpires: Date.now() + 10 * 60 * 1000,
  });

  // 3. Send verification code to user's email
  try {
    const message = `Thanks for registering! \nYour vefification code is ${randomNumber}. Please enter this code to log in.`;
    await sendEmail({
      email: newUser.email,
      subject: `Verification Code (valid only for 10 minutues!)`,
      message,
    });

    return res.status(201).json({
      status: "success",
      message: `You are successfully registered. Vefification code was sent to ${newUser.email}. Please enter the code to get access`,
      username: newUser.username,
    });
  } catch (error) {
    await sendingEmailError(newUser);
  }
});

const login = catchAsync(async (req, res, next) => {
  // 1. Check if user is logging in with email or username
  const email = req.body.email ? req.body.email : null;
  const username = req.body.username ? req.body.username : null;
  const password = req.body.password;

  let user;
  // 2. Check if user exists and password is correct
  if (email)
    user = await User.findOne({ email }).select(
      "+password +status -wishlisted -orders -compare -createdAt -updatedAt -__v -passwordChangedAt"
    );
  if (username)
    user = await User.findOne({ username }).select(
      "+password +status -wishlisted -orders -compare -createdAt -updatedAt -__v -passwordChangedAt"
    );

  if (!user || !(await user.checkCandidatePassword(password, user.password))) {
    return next(
      new ErrorClass(`Password or email (username) is not correct`, 401)
    );
  }

  // If user is in pending mode and the verificationcode expires, Send verification code to user's email to make them active
  if (user.status === "pending" && user.verificationCodeExpires < Date.now()) {
    try {
      const randomNumber = Math.floor(100000 + Math.random() * 900000);
      user.verificationCode = randomNumber;
      user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
      await user.save({ validateBeforeSave: false });

      const message = `Your account is in pending mode. Your vefification code is ${randomNumber}. Please enter this code make your account active`;
      await sendEmail({
        email: user.email,
        subject: `Verification Code (valid only for 10 minutues!)`,
        message,
      });

      return res.status(401).json({
        status: "failure",
        message: `Your account is in pending mode. Verification code was sent to yout email (${user.email}). Please enter the code to get access`,
        username: user.username,
      });
    } catch (error) {
      await sendingEmailError(user);
    }
  }

  // If user is in pending mode but verification code's not expired yet, we just inform the user about the verification code
  if (user.status === "pending" && user.verificationCodeExpires > Date.now()) {
    return res.status(401).json({
      status: "failure",
      message: `Your account is in pending mode. Please enter the code sent "${user.email}" to get access.`,
      username: user.username,
    });
  }

  // 3. If everything is okay, send token and log user in
  createSendToken(user, 200, res);
});

const sendVerificationCodeAgain = catchAsync(async (req, res, next) => {
  const { username } = req.body;

  // 1. Check if user with entered email exists
  const user = await User.findOne({ username });
  if (!user) {
    return next(new ErrorClass(`User with entered username not found`, 401));
  }

  // 2. Send verification code
  try {
    const randomNumber = Math.floor(100000 + Math.random() * 900000);
    user.verificationCode = randomNumber;
    user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
    await user.save({ validateBeforeSave: false });

    const message = `Your account is in pending mode. Your vefification code is ${randomNumber}. Please enter this code make your account active`;
    await sendEmail({
      email: user.email,
      subject: `Verification Code (valid only for 10 minutues!)`,
      message,
    });

    return res.status(200).json({
      status: "success",
      message: `Verification code was sent to yout email (${user.email}). Please enter the code to get access`,
    });
  } catch (error) {
    await sendingEmailError(user);
  }
});

const verify = catchAsync(async (req, res, next) => {
  // 1. Get user based on verification code
  const { verificationCode } = req.body;
  let user = await User.findOne({ verificationCode }).select(
    "-wishlisted -orders -compare -createdAt -updatedAt -__v -passwordChangedAt"
  );

  // 2. If verification code expired or verification code is invalid, send error
  if (!user) return next(new ErrorClass(`Verification code is invalid`, 400));
  if (user.verificationCodeExpires < Date.now())
    return next(
      new ErrorClass(
        `Verification code has expired. Please get a new code`,
        400
      )
    );

  // 3. If everything is okay, verify user and send token
  user.verificationCode = undefined;
  user.verificationCodeExpires = undefined;
  user.status = "active";
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 201, res);
});

const logout = catchAsync(async (req, res, next) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  return res.status(200).json({
    status: "success",
    message: "You are successfully logged out",
  });
});

const protectRoutes = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return next(
      new ErrorClass(`You are not logged in. Please log in to get access`, 401)
    );
  }

  // 2) Token verification
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists
  const loggingUser = await User.findById(decoded.id);

  if (!loggingUser)
    return next(
      new ErrorClass(`The user belonging to the token no longer exists`, 401)
    );

  // 4) Check if user changed password after jwt token was issued
  if (loggingUser.changePasswordAfterToken(decoded.iat)) {
    return next(
      new ErrorClass(
        `The user has recently changed password. Please log in again!`,
        401
      )
    );
  }

  // Allow access
  req.user = loggingUser;
  req.token = token;

  next();
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorClass("You do not have permission to do this action", 403)
      );
    }
    next();
  };
};

const forgotPassword = catchAsync(async (req, res, next) => {
  const { email, searchLink } = req.body; // searchLink is what page a user is redirected after successfully resetting password.
  if (!email) return next(new ErrorClass("Please provide your email!", 404));

  // 1) Get user based on email on req.body
  const user = await User.findOne({ email });
  if (!user) return next(new ErrorClass("No user found with this email!", 404));

  // 2) Generate random reset token
  const resetToken = user.createResetPasswordToken();
  await user.save({ validateBeforeSave: false });

  // 3) Send it to user's email

  const resetUrl = `${req.get("origin")}/auth/reset-password/${resetToken}${
    searchLink ? searchLink : ""
  }`;

  const message = `Forgot your password? Please click the link below to reset your password: ${resetUrl}
  \n If you did not forget your password, just ignore this email.`;

  try {
    await sendEmail({
      email: user.email,
      subject: `Your password reset token is valid only for 10 minutes!`,
      message,
    });

    return res.status(200).json({
      status: "success",
      message: `Reset token was sent to ${user.email}`,
    });
  } catch (err) {
    user.resetToken = undefined;
    user.resetTokenExpires = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new ErrorClass(
        `Error occured with send email! Please try again later.`,
        404
      )
    );
  }
});

const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    resetToken: hashedToken,
    resetTokenExpires: { $gt: Date.now() },
  }).select("+password");

  if (!user)
    return next(new ErrorClass(`Token is invalid or has expired`, 400));

  // If the new password is the same as the old one, send an error

  if (await user.checkCandidatePassword(req.body.password, user.password)) {
    return next(
      new ErrorClass(
        `The current password is the same with the new password. Please choose a different password.`,
        403
      )
    );
  }

  // 2) If token has not expired and there is user, set the new password
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  await user.save();

  // 3) Update passwordChangedAt property for the user
  // This logic is implemented in userModel with middleware

  // 4) Log the user in
  createSendToken(user, 200, res);
});

const updateMyPassword = catchAsync(async (req, res, next) => {
  // 1) Get user
  const user = await User.findById(req.user.id).select("+password");

  const { currentPassword, password, passwordConfirm } = req.body;

  // 2) Check if currentPassword is correct
  if (!(await user.checkCandidatePassword(currentPassword, user.password))) {
    return next(new ErrorClass(`Your current password is not correct.`, 401));
  }

  // 2) Update user password
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, 200, res);
});

const checkResetTokenExist = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  // 2) Check if the user with this token exists in database
  const user = await User.findOne({ resetToken: hashedToken });

  if (!user) return next(new ErrorClass(`Invalid token`, 404));

  // If token expires
  if (user.resetTokenExpires < Date.now()) {
    return next(new ErrorClass(`Expired token`, 400));
  }

  // If everthing is okay, we just send ok response
  return res.status(200).json({ status: "success" });
});

module.exports = {
  signup,
  login,
  logout,
  verify,
  protectRoutes,
  restrictTo,
  resetPassword,
  forgotPassword,
  updateMyPassword,
  sendVerificationCodeAgain,
  checkResetTokenExist,
};
