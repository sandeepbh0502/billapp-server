const express = require("express");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { Twilio } = require("twilio");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from the /temp directory so PDFs are publicly accessible.
app.use("/temp", express.static(path.join(__dirname, "temp")));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFrom = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., "whatsapp:+14155238886"
const twilioClient = new Twilio(accountSid, authToken);

// Ensure the temp folder exists.
const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// Function to generate a PDF for a bill.
const generatePDF = (bill) => {
  const doc = new PDFDocument();
  const fileName = `bill_${bill.id}.pdf`;
  const filePath = path.join(tempDir, fileName);

  doc.pipe(fs.createWriteStream(filePath));

  // Add bill details to the PDF.
  doc.fontSize(20).text("Bill Details", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Bill ID: ${bill.id}`);
  doc.text(`Buyer Type: ${bill.buyerType}`);
  doc.text(`Amount: ${bill.amount}`);
  doc.text(`Date: ${bill.date}`);

  // Finish the PDF.
  doc.end();

  return { filePath, fileName };
};

// Function to send a bill PDF via Twilio WhatsApp.
const sendBillToWhatsApp = async (bill, publicUrl) => {
  try {
    const message = await twilioClient.messages.create({
      body: "Here is your bill (PDF).",
      from: twilioFrom,
      to: `whatsapp:${bill.phone}`,
      mediaUrl: [publicUrl], // The public URL of the PDF file.
    });
    console.log(`Sent to ${bill.phone}: ${message.sid}`);
  } catch (error) {
    console.error("Error sending message:", error);
  }
};

// API endpoint to process bills and send PDFs via WhatsApp.
app.post("/api/send-bills", async (req, res) => {
  const { bills } = req.body; // Expect each bill to have: id, buyerType, amount, date, phone.

  for (const bill of bills) {
    const { filePath, fileName } = generatePDF(bill);
    // Construct the public URL. For local testing, we use localhost; in production, use your domain.
    const publicUrl = `http://localhost:5000/temp/${fileName}`;

    await sendBillToWhatsApp(bill, publicUrl);

    // Optionally, delete the file after a delay (here we wait 5 minutes).
    setTimeout(() => {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting file:", err);
      });
    }, 5 * 60 * 1000);
  }

  res.status(200).send("Bills sent successfully.");
});

app.listen(5000, () => {
  console.log("Server running on http://localhost:5000");
});
