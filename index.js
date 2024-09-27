const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
const axios = require("axios");
const { google } = require("googleapis");
const { EmailTemplate } = require("./util/template");
const { location } = require("./util/location");

const app = express();
const PORT = process.env.PORT || 5000;

const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://automation-trivandrum-frontend.vercel.app",
    "http://campaign.ipcsglobal.com",
    "https://campaign.ipcsglobal.com",
    "http://192.168.1.4:3000/",
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

async function writeToSheet(values, form, path) {
  const GOOGLE_CLIENT_EMAIL = location[path].GOOGLE_CLIENT_EMAIL;
  const GOOGLE_PRIVATE_KEY = location[path].GOOGLE_PRIVATE_KEY;

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: GOOGLE_CLIENT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth }); // Creates a Sheets API client instance.
  const spreadsheetId = location[path].spreadsheetId;

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
    // console.log(otp);
    // res.status(200).json({ success: true, message: "OTP sent!" });
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
      path,
    } = req.body;

    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    const response = await axios.get(`https://ipinfo.io/${clientIp}/json?token=f4b525ba96205a`);
    // const response = await axios.get(
    //   `https://ipinfo.io/223.187.2.97/json?token=f4b525ba96205a`
    // );
    const ipDetails = response.data;

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

          await writeToSheet(
            [
              [
                name,
                phone,
                email,
                qualification,
                date,
                clientIp,
                ipDetails?.city,
                ipDetails?.region,
              ],
            ],
            form,
            path
          );

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
    path,
  } = req.body;

  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  console.log(clientIp);

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

      if (form === "Brochure") {
        await writeToSheet([[name, phone, email, date, clientIp]], form, path);
      } else if (form === "Offer")
        await writeToSheet(
          [[name, phone, email, qualification, date, clientIp]],
          form,
          path
        );
      else if (form === "Whatsapp" || form === "Phone")
        await writeToSheet([[name, phone, date, clientIp]], form, path);

      res.status(200).json({ message: "Form submitted successfully.." });
    }
  });
});

app.post("/api/v2/send-email", async (req, res) => {
  const {
    name,
    email,
    phone,
    otp, // Add OTP field to the request body
    qualification,
    location,
    form,
    formname,
    receivingMail,
    path,
  } = req.body;

  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const response = await axios.get(`https://ipinfo.io/${clientIp}/json?token=f4b525ba96205a`);
  // const response = await axios.get(
  //   `https://ipinfo.io/223.187.2.97/json?token=f4b525ba96205a`
  // );
  const ipDetails = response.data;

  // Step 1: Fetch the stored OTP for the phone number from otpStore
  const record = otpStore.get(phone);

  if (record && record.otp === otp && record.expires > Date.now()) {
    // OTP is valid
    otpStore.delete(phone); // Remove the OTP after successful verification

    // Step 2: Construct the email HTML content
    const emailSection =
      form !== "Offer" && form !== "Whatsapp" && form !== "Phone"
        ? `<p><strong>Email:</strong> ${email}</p>`
        : "";
    const qualificationSection =
      form === "Register"
        ? `<p><strong>Qualification:</strong> ${qualification}</p>`
        : "";
    const locationSection =
      form === "Register"
        ? `<p><strong>Location:</strong> ${location}</p>`
        : "";

    let emailHtml = EmailTemplate.replace("{{formname}}", formname || "")
      .replace("{{name}}", name || "")
      .replace("{{phone}}", phone || "")
      .replace("{{emailSection}}", emailSection)
      .replace("{{qualificationSection}}", qualificationSection)
      .replace("{{locationSection}}", locationSection);

    // Step 3: Setup email transport and send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "ipcsglobalindia@gmail.com",
        pass: "nnpd xhea roak mbbk",
      },
    });

    const mailOptions = {
      from: "ipcsglobalindia@gmail.com",
      to: [
        "dmmanager.ipcs@gmail.com",
        receivingMail,
      ],
      subject: "New Lead Form Submission on ",
      html: emailHtml,
    };

    transporter.sendMail(mailOptions, async (error, info) => {
      if (error) {
        console.error("Error sending email:", error);
        res.status(500).send("Error sending email");
      } else {
        const date = new Date().toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
        });

        // Step 4: Write data to sheet based on the form type
        if (form === "Brochure") {
          await writeToSheet(
            [
              [
                name,
                phone,
                email,
                date,
                clientIp,
                ipDetails?.city,
                ipDetails?.region,
              ],
            ],
            form,
            path
          );
        } else if (form === "Offer") {
          await writeToSheet(
            [
              [
                name,
                phone,
                date,
                clientIp,
                ipDetails?.city,
                ipDetails?.region,
              ],
            ],
            form,
            path
          );
        } else if (form === "Whatsapp" || form === "Phone") {
          await writeToSheet(
            [[name, phone, date, clientIp, ipDetails?.city, ipDetails?.region]],
            form,
            path
          );
        } else if (form === "Register") {
          await writeToSheet(
            [
              [
                name,
                phone,
                email,
                qualification,
                date,
                clientIp,
                ipDetails?.city,
                ipDetails?.region,
              ],
            ],
            form,
            path
          );
        }

        res.status(200).json({ message: "Form submitted successfully.." });
      }
    });
  } else {
    // Invalid OTP or OTP expired
    res
      .status(400)
      .json({ success: false, message: "Invalid OTP or OTP expired!" });
  }
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
