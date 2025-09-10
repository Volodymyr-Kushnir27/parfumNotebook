// auth.js
import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const router = express.Router();
const SECRET = "supersecret"; // повинен збігатися з server.js

const dbPromise = open({
  filename: "./data.db",
  driver: sqlite3.Database,
});

// --- Registration ---
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: "Заповніть всі поля" });

  const db = await dbPromise;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.run(
      "INSERT INTO users (name, email, password) VALUES (?,?,?)",
      name,
      email,
      hashed
    );
    const token = jwt.sign({ email }, SECRET, { expiresIn: "1d" });
    res.json({ token, name });
  } catch (err) {
    if (err.message.includes("UNIQUE")) {
      res.status(409).json({ message: "Користувач вже існує" });
    } else {
      res.status(500).json({ message: "Помилка сервера" });
    }
  }
});

// --- Login ---
router.post("/login", async (req, res) => {
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

// --- Forgot password (генеруємо код) ---
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Введіть email" });

  const db = await dbPromise;
  const user = await db.get("SELECT * FROM users WHERE email=?", email);
  if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

  const resetCode = Math.floor(100000 + Math.random() * 900000); // 6-значний код
  const expiry = Date.now() + 15 * 60 * 1000; // код дійсний 15 хвилин

  await db.run("UPDATE users SET reset_code=?, reset_expiry=? WHERE email=?", resetCode, expiry, email);

  // Тут можна відправити код на email через поштовий сервіс
  console.log(`Reset code for ${email}: ${resetCode}`);

  res.json({ message: "Код для скидання пароля надіслано на email" });
});

// --- Reset password (вводимо код + новий пароль) ---
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword)
    return res.status(400).json({ message: "Заповніть всі поля" });

  const db = await dbPromise;
  const user = await db.get("SELECT * FROM users WHERE email=?", email);
  if (!user) return res.status(404).json({ message: "Користувача не знайдено" });

  if (!user.reset_code || !user.reset_expiry || Number(code) !== user.reset_code)
    return res.status(400).json({ message: "Невірний код" });

  if (Date.now() > user.reset_expiry)
    return res.status(400).json({ message: "Код протермінований" });

  const hashed = await bcrypt.hash(newPassword, 10);
  await db.run("UPDATE users SET password=?, reset_code=NULL, reset_expiry=NULL WHERE email=?", hashed, email);

  res.json({ message: "Пароль успішно оновлено" });
});

export default router;
