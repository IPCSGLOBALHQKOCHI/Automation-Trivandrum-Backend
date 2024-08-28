const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const {
  emailTemplate1,
  emailTemplate2,
  emailTemplate3,
} = require("./util/template");

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:3000","https://automation-trivandrum-frontend.vercel.app","http://campaign.ipcsglobal.com","https://campaign.ipcsglobal.com"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
const accountSid = "AC2776c6a162fda0e2ea3a7843d3c61e17";
const authToken = "3d65b952958c34ad8f065ab374b7a67d";
const client = require("twilio")(accountSid, authToken);

const otpStore = new Map();

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

function formatPhoneNumber(phoneNumber) {
  if (phoneNumber.length === 10) {
    phoneNumber = "91" + phoneNumber;
  } else if (phoneNumber.length === 12 && phoneNumber.startsWith("91")) {
  } else {
    throw new Error("Invalid phone number length");
  }

  let country = phoneNumber.slice(0, 2);
  let part1 = phoneNumber.slice(2, 7);
  let part2 = phoneNumber.slice(7, 12);

  return `+${country} ${part1} ${part2}`;
}

app.post("/api/request-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    const otp = generateOTP();

    otpStore.set(phone, { otp, expires: Date.now() + 300000 });

    let formattedNumber = await formatPhoneNumber(phone.trim());

    client.messages
      .create({
        body: `Your IPCS Global Verification code is  ${otp}`,
        from: "+12283356266",
        to: formattedNumber,
      })
      .then((message) =>
        res.status(200).json({ success: true, message: "OTP sent!" })
      )
      .catch((err) => {
        console.log(err);

        res.status(500).json({ success: false, message: err.message });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/verify-otp", (req, res) => {
  const { otp, phone, name, email, qualification, location, form } = req.body;

  const record = otpStore.get(phone);

  if (record && record.otp === otp && record.expires > Date.now()) {
    otpStore.delete(phone);

    let emailHtml;
    if (form === "Register") {
      emailHtml = emailTemplate1
        .replace("{{name}}", name)
        .replace("{{email}}", email)
        .replace("{{phone}}", phone)
        .replace("{{qualification}}", qualification)
        .replace("{{location}}", location);
    } else if (form === "Offer") {
      emailHtml = emailTemplate2
        .replace("{{name}}", name)
        .replace("{{phone}}", phone);
    } else if (form === "Brochure") {
      emailHtml = emailTemplate3
        .replace("{{name}}", name)
        .replace("{{email}}", email)
        .replace("{{phone}}", phone);
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "ipcsglobalindia@gmail.com",
        pass: "nnpd xhea roak mbbk",
      },
    });

    const mailOptions = {
      from: "ipcsglobalindia@gmail.com",
      to: ["ipcsdeveloper@gmail.com"],
      subject: "New Lead Form Submission on ",
      html: emailHtml,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        res.status(500).send("Error sending email");
      } else {
        console.log("Email sent:", info.response);
        res.status(200).send("Email sent successfully");
      }
    });
  } else {
    res
      .status(400)
      .json({ success: false, message: "Invalid OTP or OTP expired!" });
  }
});

app.post("/api/resend-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    const existingOtpData = otpStore.get(phone);
    if (existingOtpData && existingOtpData.expires > Date.now()) {
      return res.status(429).json({
        success: false,
        message: "OTP was already sent recently. Please wait before resending.",
      });
    }

    const otp = generateOTP();

    otpStore.set(phone, { otp, expires: Date.now() + 300000 });

    let formattedNumber = await formatPhoneNumber(phone.trim());

    client.messages
      .create({
        body: `Your IPCS Global Verification code is ${otp}`,
        from: "+12283356266",
        to: formattedNumber,
      })
      .then((message) =>
        res.status(200).json({ success: true, message: "OTP resent!" })
      )
      .catch((err) => {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
      });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/send-email2", (req, res) => {
  const { name, email, phone, qualification, location, form } = req.body;

  let emailHtml;
  if (form === "Register") {
    emailHtml = emailTemplate1
      .replace("{{name}}", name)
      .replace("{{email}}", email)
      .replace("{{phone}}", phone)
      .replace("{{qualification}}", qualification)
      .replace("{{location}}", location);
  } else if (form === "Offer") {
    emailHtml = emailTemplate2
      .replace("{{name}}", name)
      .replace("{{phone}}", phone);
  } else if (form === "Brochure") {
    emailHtml = emailTemplate3
      .replace("{{name}}", name)
      .replace("{{email}}", email)
      .replace("{{phone}}", phone);
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ipcsglobalindia@gmail.com",
      pass: "nnpd xhea roak mbbk",
    },
  });

  const mailOptions = {
    from: "ipcsglobalindia@gmail.com",
    to: [ "dmmanager.ipcs@gmail.com","seema@ipcsglobal.com"],
    subject: "New Lead Form Submission on ",
    html: emailHtml,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      res.status(500).send("Error sending email");
    } else {
      console.log("Email sent:", info.response);
      res.status(200).send("Email sent successfully");
    }
  });
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
