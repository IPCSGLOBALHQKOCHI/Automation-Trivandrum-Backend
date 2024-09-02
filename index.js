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

// const auth = new google.auth.GoogleAuth({
//   keyFile: "./util/google.json",
//   scopes: ["https://www.googleapis.com/auth/spreadsheets"],
// });

const GOOGLE_CLIENT_EMAIL="lead-612@smtp-global-site.iam.gserviceaccount.com"
const GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDyad6o8NsHTKWL\nm5zycu1uPCt85eC4iSNRhWXbm2Fx28fc+PuH1DqTK2PqgeDKPZBrT8k4KsHVee4+\n3oONhMI6Ik9Pec1HFGczgETTdcqWdFLinYV1KofhNnC7oJmubf6FS1AlFyAVegjC\ndbefj5JiDJY7pwz6ySb/THr/+2n2O5WE7VP8LKrDpN24L474aYYTINnGBSrICgxS\nzVduZD5HKfqtVZayEkgsvcYcshyXkX50XD8VhQ8IaH0LzcakcmbHmX2F8014c1Mr\nr2SWVwqtq/gJi/QeIAd0twCKlEIVa9Z1dlwPO7xq11QIqs4RBO5EVPGeyfAa9FfU\nXndqHLPzAgMBAAECggEAEd4QzdX25upU113wawRikLn5oJqW/jMJeeRBtjaVL525\n9QUbEQ9pA9jyY+IPzghMoUQ/uhaYs+HpWBPxkVhEMqG9w8dgBImx859UM1vew0ku\npMpkgFbSrhxjoci8Gxm7ZVrAPQOf10Vn6OFhV+7upLB10E7HS6LQ74dVF5IR5Nap\nuYlzvQ5skow1UqqhRNiSNsIj0lRDxp6npOitGnz5lyS4KrdJoYNXDNjoeIzKZMMz\nTnqbVnsj9Rq6Erh9Ys21QXyhAu8Lu9E8/TVwPKhsuD5RVa0gwR7g5U9sp3vkIYPj\nvTygo3ozE3Y7ExZdbnO2Wk+esqe4gIquKUud0WVx8QKBgQD/9tyAaamXuC5QrluN\n9klzxslbUU4iAYu2GZVYYBoahcHKRDDkMkWC45J2z/uiC+d5Je9MNjwFhWxhZTh4\nTaJIHOAM2Ci+W832cRmqavAwsXiOY2B/2SKcd1Rfn6G+2aaiKT1uVSpTa3sFjgWN\ntyvY2Ypy6rBbkVIz4y2lkpke4wKBgQDycoZOJyinx/vKjCz9FnwEctn+avWC/doj\nsBl/AeJeQehD8YGHZaXJzp3l5ETo9gy/7J/+gBP9p2kBr2dg+nYg4eZhn+BpR5Md\nevCXvj8p3lydB5RWjT5kEFCIOejqBnsuWv0ue6xQ+0N5yXRjNLdclx/EFoTWRBeY\nuK5+vhaTsQKBgBmf/Ck66siOnsxi+DV5H5dgok3rENhksTj0zLfBPzvCgkkelIpz\n4fOdls8gOT/a0zyUqKVHlLC0z8ncWU/p7cIsad2/UizkgfUXE4u1EwC886XFmyaR\ndV6Wr7K3B3lUztLTMBw4mHkrfHBs7G9olBIsjSi+CBPSs5kQOESoLX4jAoGAVzlw\nrElWTRabtcE8pkkikQ8o8mlUrq3ZfyFp6tGouTSI9Xi7mxSs0q/tCrpXOGDdMWdW\nIF+/0XAbTSnnzXIOccIT+mdkezvu55pFWLJvUwbW1v/VFFZ4bdOYxYngC+INCx5d\nHA4ObowXOIeLwe1DUqJkIU3guJ2Cx8UZsit9P+ECgYEA8YJ04Jp6CKZkz50XAgAN\nOHEvhjrttVFVvCvEpllu/g3Jr9OMpxxGW6HfczaXrrwDAt+CJPqV/Ye+pyJ4sN/S\niHpChLRh8WVBGNyRCFYcZQQL1h1866WLTGe92L4k/EIbKSZsxuxN11Gh+V2kEO+F\n0zEQWljFW6GRWFLhZcdmlxk=\n-----END PRIVATE KEY-----\n"

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: GOOGLE_CLIENT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
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
