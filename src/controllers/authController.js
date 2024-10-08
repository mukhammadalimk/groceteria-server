const { promisify } = require("util");
const User = require("../models/userModel");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const catchAsync = require("../utils/catchAsync");
const ErrorClass = require("../utils/errorClass");
const { sendEmail, sendWelcomeEmail } = require("../utils/email");
require("dotenv").config();
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createSendToken = async (user, req, res) => {
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "5 days" }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "60 days" }
  );

  await User.findByIdAndUpdate(user._id, { refreshToken });

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true, // this ensures that cookie can not be modifed by the browser,
    sameSite: "none",
    secure: req.secure || req.headers["x-forwarded-proto"] === "https",
  };
  // if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", refreshToken, cookieOptions);

  // Remove password and refreshToken from output
  user.password = undefined;
  user.refreshToken = undefined;

  return res.status(200).json({
    status: "success",
    accessToken,
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

const protectRoutes = catchAsync(async (req, res, next) => {
  // 1) Get token and check if it exists
  let accessToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    accessToken = req.headers.authorization.split(" ")[1];
  }

  if (!accessToken) {
    return next(
      new ErrorClass(
        `TokenError: You are not logged in. Please log in to get access.`,
        401
      )
    );
  }

  // 2) accessToken verification
  await promisify(jwt.verify)(accessToken, process.env.ACCESS_TOKEN_SECRET);

  const refreshToken = req.cookies.jwt;

  const decoded = await promisify(jwt.verify)(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  // 3) Check if user still exists
  const loggingUser = await User.findOne({ refreshToken });

  if (!loggingUser)
    return next(
      new ErrorClass(
        `TokenError: The user belonging to the token no longer exists`,
        401
      )
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
  next();
});

const getNewAccessToken = catchAsync(async (req, res, next) => {
  // 1) Get JWT from the cookies
  const cookies = req.cookies;
  const refreshToken = cookies.jwt;

  if (!refreshToken) {
    return next(
      new ErrorClass(
        `TokenError: You are not loggin in! Please log in to get access.`,
        401
      )
    );
  }

  // 3) Check if user still exists
  const loggingUser = await User.findOne({ refreshToken });

  if (!loggingUser)
    return next(
      new ErrorClass(
        `TokenError: The user belonging to the token no longer exists`,
        401
      )
    );

  // 4) Evaluate JWT
  await promisify(jwt.verify)(refreshToken, process.env.REFRESH_TOKEN_SECRET);

  const accessToken = jwt.sign(
    { id: loggingUser._id },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: "5 days" }
  );

  return res.status(200).json({
    status: "success",
    accessToken,
  });
});

const login = catchAsync(async (req, res, next) => {
  // 1. Check if user is logging in with email or username
  const email = req.body.email ? req.body.email : null;
  const username = req.body.username ? req.body.username : null;
  const password = req.body.password;

  // GOOGLE LOGIN
  let user;
  if (req.query.token) {
    const ticket = await client.verifyIdToken({
      idToken: req.query.token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const { email } = ticket.getPayload();

    user = await User.findOne({ email }).select(
      "-createdAt -updatedAt -__v -passwordChangedAt"
    );

    if (!user) {
      return next(
        new ErrorClass(`No user found with this email: ${email}`, 401)
      );
    }

    // We do not need to verify the user via verification code if the user trie to log in with the google oauth.
    if (user.status === "pending") {
      user.verificationCode = undefined;
      user.verificationCodeExpires = undefined;
      user.status = "active";
      await user.save({ validateBeforeSave: false });
    }

    // If everything is okay, send token and log user in
    createSendToken(user, req, res);
    return;
  }

  /// MANUAL LOGIN
  // 2. Check if user exists and password is correct
  if (!req.query.token) {
    if (email)
      user = await User.findOne({ email }).select(
        "+password -createdAt -updatedAt -__v -passwordChangedAt"
      );
    if (username)
      user = await User.findOne({ username }).select(
        "+password -createdAt -updatedAt -__v -passwordChangedAt"
      );

    if (
      !user ||
      !(await user.checkCandidatePassword(password, user.password))
    ) {
      return next(
        new ErrorClass(`Password or email (username) is not correct`, 401)
      );
    }
  }

  // If user is in pending mode and the verificationcode expires, Send verification code again to user's email to make them active
  if (user.status === "pending" && user.verificationCodeExpires < Date.now()) {
    try {
      const randomNumber = Math.floor(100000 + Math.random() * 900000);
      user.verificationCode = randomNumber;
      user.verificationCodeExpires = Date.now() + 10 * 60 * 1000;
      await user.save({ validateBeforeSave: false });

      const message = `Your account is in pending mode. Your verification code is ${randomNumber}. Please enter this code make your account active`;
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
  createSendToken(user, req, res);
});

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
    const message = `Thanks for registering! \nYour verification code is ${randomNumber}. Please enter this code to log in.`;
    await sendEmail({
      email: newUser.email,
      subject: `Verification Code (valid only for 10 minutues!)`,
      message,
    });

    return res.status(201).json({
      status: "success",
      message: `Verification code was sent to ${newUser.email}. Please enter the code to get access`,
      username: newUser.username,
    });
  } catch (error) {
    await sendingEmailError(newUser);
  }
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

    const message = `Your account is in pending mode. Your verification code is ${randomNumber}. Please enter this code make your account active`;
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
    "-createdAt -updatedAt -__v -passwordChangedAt"
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

  // 2. Send welcome email
  await sendWelcomeEmail({
    userEmail: user.email,
    userName: user.name,
    productsLink: "https://www.groceteria.dev/shop",
    contactUsLink: "https://www.groceteria.dev/contact-us",
  });

  createSendToken(user, req, res);
});

const logout = catchAsync(async (req, res, next) => {
  // 1) Get JWT from the cookies

  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); // No content

  const refreshToken = cookies.jwt;

  const loggingOutUser = await User.findOne({ refreshToken });

  const cookieOptions = {
    expires: new Date(Date.now() + 10),
    httpOnly: true,
  };

  if (!loggingOutUser) {
    res.clearCookie("jwt", cookieOptions);
    return res.sendStatus(204); // No content
  }

  // Delete refreshToken from the database
  await User.updateOne({ refreshToken }, { $unset: { refreshToken: "" } });

  res.clearCookie("jwt", cookieOptions);

  return res.sendStatus(204); // No content
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
  \nIf you did not forget your password, just ignore this email.`;

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
        `Error occured with sending email. Please try again later.`,
        400
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
  createSendToken(user, req, res);
});

const updateMyPassword = catchAsync(async (req, res, next) => {
  // 1) Get user
  const user = await User.findById(req.user.id).select("+password");

  const { currentPassword, password, passwordConfirm } = req.body;

  // 2) Check if currentPassword is correct
  if (!(await user.checkCandidatePassword(currentPassword, user.password))) {
    return next(new ErrorClass(`Your current password is not correct.`, 401));
  }

  // 3. If the new password is the same with the current password, we send an error
  if (await user.checkCandidatePassword(password, user.password)) {
    return next(
      new ErrorClass(
        `The current password is the same with the new password. Please choose a different password.`,
        403
      )
    );
  }

  // 2) Update user password
  user.password = password;
  user.passwordConfirm = passwordConfirm;
  await user.save();

  // 4) Log user in, send JWT
  createSendToken(user, req, res);
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
  getNewAccessToken,
};
