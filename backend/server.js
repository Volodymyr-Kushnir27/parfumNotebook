import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const app = express();
const PORT = 4000;
const SECRET = "supersecret"; // заміни на свій ключ

app.use(cors());
app.use(bodyParser.json());

// DB init
const dbPromise = open({
  filename: "./data.db",
  driver: sqlite3.Database,
});

async function initDb() {
  const db = await dbPromise;
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT UNIQUE,
      password TEXT
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      department TEXT,
      seller TEXT,
      prevDayBalance REAL,
      cashless REAL,
      remaining REAL,
      safeTerminal REAL
    );
  `);
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
      FOREIGN KEY (report_id) REFERENCES reports(id)
    );
  `);
}
initDb();

// Middleware auth
function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  if (!token) return res.sendStatus(401);
  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// ✅ Реєстрація
app.post("/api/register", async (req, res) => {
  const { name, phone, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ message: "Заповніть всі поля" });
  }
  const db = await dbPromise;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.run(
      "INSERT INTO users (name, phone, password) VALUES (?,?,?)",
      name,
      phone,
      hashedPassword
    );
    const token = jwt.sign({ phone }, SECRET, { expiresIn: "1d" });
    res.json({ token, name });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.status(409).json({ message: "Користувач вже існує" });
    } else {
      res.status(500).json({ message: "Помилка сервера" });
    }
  }
});

// ✅ Логін
app.post("/api/login", async (req, res) => {
  const { phone, password } = req.body;
  const db = await dbPromise;
  const user = await db.get("SELECT * FROM users WHERE phone=?", phone);
  if (!user) return res.status(400).json({ message: "Користувача не знайдено" });

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) return res.status(400).json({ message: "Невірний пароль" });

  const token = jwt.sign({ phone }, SECRET, { expiresIn: "1d" });
  res.json({ token, name: user.name });
});

// ✅ Хто я
app.get("/api/me", authMiddleware, async (req, res) => {
  res.json({ user: req.user });
});

// ✅ Отримати звіт за датою
app.get("/api/reports", authMiddleware, async (req, res) => {
  const { date } = req.query;
  const db = await dbPromise;
  const report = await db.get("SELECT * FROM reports WHERE date=?", date);
  if (!report) return res.status(404).end();
  const items = await db.all("SELECT * FROM items WHERE report_id=?", report.id);
  res.json({ report, items });
});

// ✅ Отримати всі звіти
app.get("/api/reports/all", authMiddleware, async (req, res) => {
  const db = await dbPromise;
  const reports = await db.all("SELECT * FROM reports ORDER BY date DESC");
  res.json(reports);
});

// ✅ Зберегти/оновити звіт
app.post("/api/reports", authMiddleware, async (req, res) => {
  const {
    date,
    department,
    seller,
    items,
    prevDayBalance,
    cashless,
    remaining,
    safeTerminal,
  } = req.body;
  const db = await dbPromise;

  let report = await db.get("SELECT * FROM reports WHERE date=?", date);
  if (report) {
    await db.run(
      "UPDATE reports SET department=?, seller=?, prevDayBalance=?, cashless=?, remaining=?, safeTerminal=? WHERE id=?",
      department,
      seller,
      prevDayBalance,
      cashless,
      remaining,
      safeTerminal,
      report.id
    );
    await db.run("DELETE FROM items WHERE report_id=?", report.id);
  } else {
    const result = await db.run(
      "INSERT INTO reports (date, department, seller, prevDayBalance, cashless, remaining, safeTerminal) VALUES (?,?,?,?,?,?,?)",
      date,
      department,
      seller,
      prevDayBalance,
      cashless,
      remaining,
      safeTerminal
    );
    report = { id: result.lastID, date, department, seller };
  }

  for (const it of items) {
    await db.run(
      `INSERT INTO items (report_id, position_no, volume, bottle, color, quantity, price, sum, remark)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      report.id,
      it.position_no,
      it.volume,
      it.bottle,
      it.color,
      it.quantity,
      it.price,
      it.sum,
      it.remark
    );
  }

  res.json({ report });
});

// ✅ Видалити звіт
app.delete("/api/reports/:id", authMiddleware, async (req, res) => {
  const db = await dbPromise;
  await db.run("DELETE FROM items WHERE report_id=?", req.params.id);
  await db.run("DELETE FROM reports WHERE id=?", req.params.id);
  res.json({ success: true });
});

// ✅ Експорт у CSV
app.get("/api/reports/:id/export/csv", async (req, res) => {
  const db = await dbPromise;
  const report = await db.get("SELECT * FROM reports WHERE id=?", req.params.id);
  if (!report) return res.status(404).end();
  const items = await db.all("SELECT * FROM items WHERE report_id=?", report.id);

  const header = "№;Об'єм;Флакон;Колір;К-сть;Ціна;Сума;Примітка\n";
  const rows = items
    .map(
      (it) =>
        `${it.position_no};${it.volume || ""};${it.bottle || ""};${it.color || ""};${it.quantity};${it.price};${it.sum};${it.remark || ""}`
    )
    .join("\n");

  const csv = header + rows;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=report_${report.date}.csv`
  );
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
