const nodemailer = require("nodemailer");
const { MailtrapClient } = require("mailtrap");

const sendEmail = async function (options) {
  // Create a transporter
  let transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  // Define email options
  const mailOptions = {
    from: `Groceteria <mailtrap@groceteria.dev>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
  };

  // Send email
  await transporter.sendMail(mailOptions);
};

const sendWelcomeEmail = async (options) => {
  const client = new MailtrapClient({
    endpoint: "https://send.api.mailtrap.io/",
    token: process.env.EMAIL_PASSWORD,
  });

  const sender = {
    email: "mailtrap@groceteria.dev",
    name: "Groceteria",
  };

  await client.send({
    from: sender,
    to: [{ email: options.userEmail }],
    template_uuid: process.env.WELCOME_EMAIL_UUID,
    template_variables: {
      user_name: options.userName,
      products_link: options.productsLink,
      contact_us_link: options.contactUsLink,
    },
  });
};

module.exports = { sendEmail, sendWelcomeEmail };
