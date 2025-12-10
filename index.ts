import path from "path";
import express from "express";

const app = express();

// Serve PDFs from syllabus folder
app.use(
  "/syllabus",
  express.static(path.join(__dirname, "../syllabus"))
);

// ...existing code...

export default app;
