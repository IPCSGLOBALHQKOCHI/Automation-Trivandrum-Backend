const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const { google } = require("googleapis");
const { EmailTemplate } = require("./util/template");

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://automation-trivandrum-frontend.vercel.app",
    "http://campaign.ipcsglobal.com",
    "https://campaign.ipcsglobal.com",
  ],
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

const auth = new google.auth.GoogleAuth({
  keyFile: "./util/google.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function writeToSheet(values, form) {
  const sheets = google.sheets({ version: "v4", auth }); // Creates a Sheets API client instance.
  const spreadsheetId = "1dVt21D2FLrppFzKaaJDldv_8DeqRv_ovJfia8T3WUeE"; // The ID of the spreadsheet.

  try {
    // Get the current range of the sheet to determine the last filled row.
    const getRange = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${form}!A:A`, // Adjust this range based on the column where your data starts.
    });

    // Determine the next empty row.
    const numRows = getRange.data.values ? getRange.data.values.length : 0;
    const nextRow = numRows + 1;

    // Adjust the range to point to the next empty row.
    const range = `${form}!A${nextRow}`; // Starts writing at the next available row.
    const valueInputOption = "USER_ENTERED"; // How input data should be interpreted.

    const resource = { values }; // The data to be written.

    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption,
      resource,
    });

    return res; // Returns the response from the Sheets API.
  } catch (error) {
    console.error("error", error); // Logs errors.
  }
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

app.post("/api/verify-otp", async (req, res) => {
  try {
    const {
      otp,
      phone,
      name,
      email,
      qualification,
      location,
      form,
      formname,
      nearestLocation,
      receivingMail,
    } = req.body;

    const record = otpStore.get(phone);

    if (record && record.otp === otp && record.expires > Date.now()) {
      otpStore.delete(phone);

      const nearestLocationText = nearestLocation
        ? `Nearest Location: ${nearestLocation}<br>`
        : "";

      const emailSection =
        form !== "Offer" && form !== "Whatsapp" && form !== "Phone"
          ? `<p><strong>Email:</strong> ${email}</p>`
          : "";
      const qualificationSection =
        form === "Register"
          ? `<p><strong>Qualification:</strong> ${qualification}</p>`
          : "";

      let emailHtml = EmailTemplate.replace("{{formname}}", formname || "")
        .replace("{{name}}", name || "")
        .replace("{{phone}}", phone || "")
        .replace("{{emailSection}}", emailSection)
        .replace("{{qualificationSection}}", qualificationSection)
        .replace("{{nearestLocationSection}}", nearestLocationText);

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "ipcsglobalindia@gmail.com",
          pass: "nnpd xhea roak mbbk",
        },
      });

      const mailOptions = {
        from: "ipcsglobalindia@gmail.com",
        to: ["dmmanager.ipcs@gmail.com", receivingMail],
        // to: ["ipcsdeveloper@gmail.com"],
        subject: "New Lead Form Submission on ",
        html: emailHtml,
      };

      transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          res.status(500).send("Error sending email");
        } else {
          const date = new Date().toLocaleString();

          await writeToSheet([[name, phone, email, qualification, date]], form);

          res.status(200).json({ message: "Form submitted successfully.." });
        }
      });
    } else {
      res
        .status(400)
        .json({ success: false, message: "Invalid OTP or OTP expired!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error." });
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
  const {
    name,
    email,
    phone,
    qualification,
    location,
    form,
    formname,
    nearestLocation,
    receivingMail,
  } = req.body;

  const emailSection =
    form !== "Offer" && form !== "Whatsapp" && form !== "Phone"
      ? `<p><strong>Email:</strong> ${email}</p>`
      : "";
  const qualificationSection =
    form === "Register"
      ? `<p><strong>Qualification:</strong> ${qualification}</p>`
      : "";
  const locationSection =
    form === "Register" ? `<p><strong>Location:</strong> ${location}</p>` : "";
  const nearestLocationSection =
    form === "Register"
      ? `<p><strong>Nearest Location:</strong> ${nearestLocation}</p>`
      : "";

  let emailHtml = EmailTemplate.replace("{{formname}}", formname || "")
    .replace("{{name}}", name || "")
    .replace("{{phone}}", phone || "")
    .replace("{{emailSection}}", emailSection)
    .replace("{{qualificationSection}}", qualificationSection)
    .replace("{{locationSection}}", locationSection)
    .replace("{{nearestLocationSection}}", nearestLocationSection);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "ipcsglobalindia@gmail.com",
      pass: "nnpd xhea roak mbbk",
    },
  });

  const mailOptions = {
    from: "ipcsglobalindia@gmail.com",
    to: ["dmmanager.ipcs@gmail.com", receivingMail],
    // to: ["ipcsdeveloper@gmail.com"],sss
    subject: "New Lead Form Submission on ",
    html: emailHtml,
  };

  transporter.sendMail(mailOptions, async (error, info) => {
    if (error) {
      console.error("Error sending email:", error);
      res.status(500).send("Error sending email");
    } else {
      const date = new Date().toLocaleString();

      if (form === "Brochure") {
        await writeToSheet([[name, phone, email, date]], form);
      } else if (form === "Offer")
        await writeToSheet([[name, phone, email, qualification, date]], form);
      else if (form === "Whatsapp" || form === "Phone")
        await writeToSheet([[name, phone, date]], form);

      res.status(200).json({ message: "Form submitted successfully.." });
    }
  });
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
