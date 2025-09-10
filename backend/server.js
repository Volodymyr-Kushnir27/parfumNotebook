import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import authRouter from "./auth.js"; 

const app = express();
const PORT = 4000;
const SECRET = "supersecret"; // твій JWT секрет

app.use(cors());
app.use(bodyParser.json());
app.use("/api", authRouter);

// --- DB init ---
const dbPromise = open({
  filename: "./data.db",
  driver: sqlite3.Database,
});

async function initDb() {
  const db = await dbPromise;

  // Таблиця користувачів
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      password TEXT
    );
  `);

  // Таблиця звітів
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      date TEXT,
      department TEXT,
      seller TEXT,
      prevDayBalance REAL,
      cashless REAL,
      remaining REAL,
      safeTerminal REAL,
      UNIQUE(user_id, date),
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Таблиця items
  await db.exec(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      position_no INTEGER,
      volume TEXT,
      bottle TEXT,
      color TEXT,
      quantity REAL,
      price REAL,
      sum REAL,
      remark TEXT,
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );
  `);

  // Таблиця tasks
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      text TEXT,
      done INTEGER,
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );
  `);

  // Таблиця tester_items
  await db.exec(`
    CREATE TABLE IF NOT EXISTS tester_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      text TEXT,
      quantity REAL,
      FOREIGN KEY(report_id) REFERENCES reports(id)
    );
  `);

  console.log("✅ DB initialized");
}

initDb();

// --- Middleware auth ---
async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, async (err, payload) => {
    if (err) return res.sendStatus(403);
    const db = await dbPromise;
    const user = await db.get("SELECT * FROM users WHERE email=?", payload.email);
    if (!user) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// --- Registration ---
// --- Reset password ---
app.post("/api/reset-password", async (req, res) => {
   console.log("🔑 Reset-password запит отримано:", req.body);
  const { email, newPassword } = req.body;
  if (!email || !newPassword)
    return res.status(400).json({ message: "Заповніть всі поля" });

  try {
    const db = await dbPromise;
    const user = await db.get("SELECT * FROM users WHERE email=?", email);
    if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.run("UPDATE users SET password=? WHERE email=?", hashed, email);

    res.json({ message: "Пароль успішно оновлено" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ message: "Помилка сервера" });
  }
});



// --- Save ---

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: "Заповніть всі поля" });

  const db = await dbPromise;
  const user = await db.get("SELECT * FROM users WHERE email=?", email);
  if (!user) return res.status(400).json({ message: "Користувача не знайдено" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: "Невірний пароль" });

  const token = jwt.sign({ email }, SECRET, { expiresIn: "1d" });
  res.json({ token, name: user.name });
});

// --- Get last report ---
// --- GET last report ---
// --- POST save / update report ---
app.post("/api/reports", authMiddleware, async (req, res) => {
  try {
    const { date, department, seller, items = [], tasks = [], testerWriteOffItems = [], prevDayBalance, cashless, remaining, safeTerminal } = req.body;
    if (!date) return res.status(400).json({ message: "Не вказана дата" });

    const db = await dbPromise;

    // Видаляємо старий звіт, якщо він існує
    const oldReport = await db.get("SELECT * FROM reports WHERE user_id=? AND date=?", req.user.id, date);
    if (oldReport) {
      await db.run("DELETE FROM items WHERE report_id=?", oldReport.id);
      await db.run("DELETE FROM tasks WHERE report_id=?", oldReport.id);
      await db.run("DELETE FROM tester_items WHERE report_id=?", oldReport.id);
      await db.run("DELETE FROM reports WHERE id=?", oldReport.id);
    }

    // Створюємо новий звіт
    const result = await db.run(
      `INSERT INTO reports (user_id, date, department, seller, prevDayBalance, cashless, remaining, safeTerminal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      req.user.id, date, department || "", seller || "",
      Number(prevDayBalance || 0), Number(cashless || 0),
      Number(remaining || 0), Number(safeTerminal || 0)
    );

    const reportId = result.lastID;

    // Додаємо items
    for (const it of items) {
      await db.run(
        `INSERT INTO items (report_id, position_no, volume, bottle, color, quantity, price, sum, remark)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        reportId, Number(it.position_no) || 0, it.volume || "", it.bottle || "",
        it.color || "", Number(it.quantity) || 0, Number(it.price) || 0,
        Number(it.sum) || 0, it.remark || ""
      );
    }

    // Додаємо tasks
    for (const t of tasks) {
      await db.run(`INSERT INTO tasks (report_id, text, done) VALUES (?,?,?)`, reportId, t.text || "", t.done ? 1 : 0);
    }

    // Додаємо tester_items
    for (const t of testerWriteOffItems) {
      await db.run(`INSERT INTO tester_items (report_id, text, quantity) VALUES (?,?,?)`, reportId, t.text || "", Number(t.quantity) || 0);
    }

    res.json({ report: { id: reportId } });
  } catch (err) {
    console.error("Save report error:", err);
    res.status(500).json({ message: err.message });
  }
});





// --- Export CSV ---
app.get("/api/reports", authMiddleware, async (req, res) => {
 

  const { date } = req.query;
   console.log("Fetching report for user:", req.user.id, "date:", date);
  if (!date) return res.status(400).json({ message: "Не вказана дата" });

  const db = await dbPromise;
  const report = await db.get("SELECT * FROM reports WHERE user_id=? AND date=?", [req.user.id, date]);
  if (!report) return res.status(404).json({ message: "Звіт не знайдено" });

  const items = await db.all("SELECT * FROM items WHERE report_id=?", report.id);
  const tasks = await db.all("SELECT * FROM tasks WHERE report_id=?", report.id);
  const testerItems = await db.all("SELECT * FROM tester_items WHERE report_id=?", report.id);

  res.json({ report, items, tasks, testerItems });
});


// --- Delete report ---
app.delete("/api/reports/:id", authMiddleware, async (req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM items WHERE report_id=?", req.params.id);
  await db.run("DELETE FROM tasks WHERE report_id=?", req.params.id);
  await db.run("DELETE FROM tester_items WHERE report_id=?", req.params.id);
  await db.run("DELETE FROM reports WHERE id=?", req.params.id);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`✅ Backend running at http://localhost:${PORT}`));

