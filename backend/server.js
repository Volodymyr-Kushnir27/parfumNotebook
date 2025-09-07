import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { promises as fs } from "fs";

const app = express();
const PORT = 4000;

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
    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      department TEXT,
      seller TEXT
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

// ---- API ----

// Отримати звіт за датою
app.get("/api/reports", async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date required" });
  const db = await dbPromise;
  const report = await db.get("SELECT * FROM reports WHERE date = ?", date);
  if (!report) return res.status(404).end();
  const items = await db.all("SELECT * FROM items WHERE report_id = ?", report.id);
  res.json({ report, items });
});

// Створити/оновити звіт
app.post("/api/reports", async (req, res) => {
  const { date, department, seller, items } = req.body;
  const db = await dbPromise;

  let report = await db.get("SELECT * FROM reports WHERE date = ?", date);
  if (report) {
    await db.run("UPDATE reports SET department=?, seller=? WHERE id=?", department, seller, report.id);
    await db.run("DELETE FROM items WHERE report_id=?", report.id);
  } else {
    const result = await db.run("INSERT INTO reports (date, department, seller) VALUES (?,?,?)", date, department, seller);
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

// Експорт у CSV
app.get("/api/reports/:id/export/csv", async (req, res) => {
  const db = await dbPromise;
  const report = await db.get("SELECT * FROM reports WHERE id=?", req.params.id);
  if (!report) return res.status(404).end();
  const items = await db.all("SELECT * FROM items WHERE report_id=?", report.id);

  const header = "№;Об'єм;Флакон;Колір;К-сть;Ціна;Сума;Примітка\n";
  const rows = items
    .map(it => `${it.position_no};${it.volume||""};${it.bottle||""};${it.color||""};${it.quantity};${it.price};${it.sum};${it.remark||""}`)
    .join("\n");

  const csv = header + rows;
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=report_${report.date}.csv`);
  res.send(csv);
});

app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});
