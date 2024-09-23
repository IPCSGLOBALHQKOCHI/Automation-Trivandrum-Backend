const EmailTemplate = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background-color: #4CAF50;
      color: white;
      padding: 20px;
      text-align: center;
    }
    .content {
      padding: 20px;
    }
    .content p {
      margin: 0 0 20px;
    }
    .footer {
      background-color: #f1f1f1;
      color: #333333;
      text-align: center;
      padding: 10px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{formname}}</h1>
    </div>
    <div class="content">
      <p><strong>Name:</strong> {{name}}</p>
      {{emailSection}}
      <p><strong>Phone:</strong> {{phone}}</p>
      {{qualificationSection}}
    </div>
    <div class="footer">
      <p>&copy; 2024 IPCS GLOBAL. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

module.exports = { EmailTemplate };
