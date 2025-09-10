import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import "./Dashboard.css";

export default function Dashboard() {
    const navigate = useNavigate();

    const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [department, setDepartment] = useState("");
    const [seller, setSeller] = useState("");
    const [items, setItems] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [testerItems, setTesterItems] = useState([]);
    const [prevDayBalance, setPrevDayBalance] = useState("");
    const [cashless, setCashless] = useState("");
    const [remaining, setRemaining] = useState("");
    const [safeTerminal, setSafeTerminal] = useState("");
    const [reportId, setReportId] = useState(null);
    const [loading, setLoading] = useState(false);

    // --- Перевірка токена ---
    useEffect(() => {
  const token = localStorage.getItem("token");
  const sellerName = localStorage.getItem("sellerName");
  if (!token || !sellerName) {
    navigate("/login");
    return;
  }
  setSeller(sellerName);

  const loadReport = async () => {
    try {
      const res = await fetch(`http://localhost:4000/api/reports?date=${date}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) {
        console.warn("Звіт не знайдено — показую пусту форму");
        setReportId(null);
        setItems([]);
        setTasks([]);
        setTesterItems([]);
        return;
      }

      if (!res.ok) throw new Error("Помилка завантаження");

      const data = await res.json();
      setReportId(data.report.id);
      setItems(data.items || []);
      setTasks(data.tasks || []);
      setTesterItems(data.testerItems || []);
    } catch (err) {
      console.error("Load failed:", err.message);
      alert("Помилка завантаження: " + err.message);
    }
  };

  loadReport();
}, [date, navigate]);


    // --- Вихід ---
    const handleLogout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("sellerName");
        navigate("/login");
    };

    // --- Утиліти ---
    const normalizeNumber = (val) => (val === "" ? "" : String(Number(val) || 0));

    // --- Таблиця товарів ---
    const addRow = () => {
        setItems((prev) => [
            ...prev,
            { position_no: prev.length + 1, volume: "", bottle: "", color: "", quantity: "", price: "", sum: 0, remark: "" },
        ]);
    };

    const updateRow = (idx, changes) => {
        setItems((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...changes };
            copy[idx].sum = (Number(copy[idx].quantity) || 0) * (Number(copy[idx].price) || 0);
            return copy;
        });
    };

    const removeRow = (idx) => {
        setItems((prev) =>
            prev.filter((_, i) => i !== idx).map((item, i) => ({ ...item, position_no: i + 1 }))
        );
    };

    // --- Задачі ---
    const addTask = () => setTasks([...tasks, { text: "", done: false }]);
    const updateTask = (idx, changes) => {
        setTasks((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...changes };
            return copy;
        });
    };
    const removeTask = (idx) => setTasks((prev) => prev.filter((_, i) => i !== idx));

    // --- Тестери ---
    const addTester = () => setTesterItems([...testerItems, { text: "", quantity: "" }]);
    const updateTester = (idx, changes) => {
        setTesterItems((prev) => {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...changes };
            return copy;
        });
    };
    const removeTester = (idx) => setTesterItems((prev) => prev.filter((_, i) => i !== idx));

    // --- Збереження ---
    const saveReport = async () => {
        const token = localStorage.getItem("token");
        setLoading(true);
        try {
            const payload = {
                date,
                department,
                seller,
                items: items.map(it => ({
                    position_no: it.position_no,
                    volume: it.volume || "",
                    bottle: it.bottle || "",
                    color: it.color || "",
                    quantity: Number(it.quantity || 0),
                    price: Number(it.price || 0),
                    sum: (Number(it.quantity || 0)) * (Number(it.price || 0)),
                    remark: it.remark || "",
                })),
                prevDayBalance: Number(prevDayBalance || 0),
                cashless: Number(cashless || 0),
                remaining: Number(remaining || 0),
                safeTerminal: Number(safeTerminal || 0),
                tasks,
                testerWriteOffItems: testerItems,
            };

            const res = await fetch("http://localhost:4000/api/reports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Save failed");
            const data = await res.json();
            setReportId(data.report.id);
            alert("✅ Збережено");
        } catch (err) {
            alert("❌ Помилка: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    // --- Експорт CSV ---
    const exportCsv = async () => {
        if (!reportId) return alert("Спочатку збережіть звіт");
        const token = localStorage.getItem("token");

        const res = await fetch(`http://localhost:4000/api/reports/${reportId}/export/csv`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) return alert("Помилка експорту");

        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");у
        a.href = url;
        a.download = `report_${date}.csv`;
        a.click();
    };


    // --- Підрахунки ---
    const total = items.reduce((s, i) => s + (i.sum || 0), 0);
    const testerTotal = testerItems.reduce((s, t) => s + (Number(t.quantity) || 0), 0);

    return (
        <div className="container">
            {/* --- Хедер --- */}
            <div className="header">
                <h2>ParfumNotebook — щоденний звіт</h2>
                <div className="header-buttons">
                    <button className="btn primary" onClick={saveReport} disabled={loading}>
                        {loading ? "Збереження..." : "Зберегти"}
                    </button>
                    <button className="btn" onClick={exportCsv}>Експорт CSV</button>
                    <button className="btn red" onClick={handleLogout}>Вийти</button>
                </div>
            </div>

            {/* --- Загальні поля --- */}
            <div className="controls">
                <label>Дата: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                <label>Відділ: <input value={department} onChange={(e) => setDepartment(e.target.value)} /></label>
                <label>Продавець: <input value={seller} onChange={(e) => setSeller(e.target.value)} /></label>
            </div>

            <div className="prev-day-balance">
                <label><span className="yellow-label">Залишок попереднього дня:</span>
                    <input type="number" value={prevDayBalance} onChange={(e) => setPrevDayBalance(e.target.value)} /> грн.
                </label>
            </div>

            {/* --- Таблиця товарів --- */}
            <table>
                <thead>
                    <tr>
                        <th></th><th>#</th><th>Об'єм</th><th>Флакон</th><th>Колір</th><th>К-сть</th><th>Ціна</th><th>Сума</th><th>Примітка</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((it, idx) => (
                        <tr key={idx}>
                            <td><button className="btn small" onClick={() => removeRow(idx)}>✖</button></td>
                            <td>{it.position_no}</td>
                            <td><input value={it.volume} onChange={(e) => updateRow(idx, { volume: e.target.value })} /></td>
                            <td><input value={it.bottle} onChange={(e) => updateRow(idx, { bottle: e.target.value })} /></td>
                            <td><input value={it.color} onChange={(e) => updateRow(idx, { color: e.target.value })} /></td>
                            <td><input type="number" value={it.quantity} onChange={(e) => updateRow(idx, { quantity: e.target.value })} /></td>
                            <td><input type="number" value={it.price} onChange={(e) => updateRow(idx, { price: e.target.value })} /></td>
                            <td>{(it.sum || 0).toFixed(2)}</td>
                            <td><input value={it.remark} onChange={(e) => updateRow(idx, { remark: e.target.value })} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="summary">
                <button className="btn" onClick={addRow}>Додати рядок</button>
                <div>Загальна сума: {total.toFixed(2)} грн.</div>
            </div>

            {/* --- Задачі --- */}
            <div className="tasks">
                <h3>Задачі на день</h3>
                <button className="btn small" onClick={addTask}>Додати задачу</button>
                <ul>
                    {tasks.map((t, idx) => (
                        <li key={idx}>
                            <button className="btn small" onClick={() => removeTask(idx)}>✖</button>
                            <input type="checkbox" checked={t.done} onChange={(e) => updateTask(idx, { done: e.target.checked })} />
                            <input type="text" value={t.text} placeholder="Опис задачі" onChange={(e) => updateTask(idx, { text: e.target.value })} />
                        </li>
                    ))}
                </ul>
            </div>

            {/* --- Тестери --- */}
            <div className="tester-writeoff">
                <h3>Списання тестерів</h3>
                <button className="btn small" onClick={addTester}>Додати рядок</button>
                <ul>
                    {testerItems.map((t, idx) => (
                        <li key={idx}>
                            <button className="btn small" onClick={() => removeTester(idx)}>✖</button>
                            <input type="text" value={t.text} placeholder="Назва тестера" onChange={(e) => updateTester(idx, { text: e.target.value })} />
                            <input type="number" value={t.quantity} placeholder="К-сть" onChange={(e) => updateTester(idx, { quantity: e.target.value })} />
                        </li>
                    ))}
                </ul>
                {testerItems.length > 0 && <div>Загальна к-сть тестерів: {testerTotal}</div>}
            </div>

            {/* --- Фінансові поля --- */}
            <div className="financials">
                <label>Безготівка: <input type="number" value={cashless} onChange={(e) => setCashless(normalizeNumber(e.target.value))} /> грн.</label>
                <label>Залишок: <input type="number" value={remaining} onChange={(e) => setRemaining(normalizeNumber(e.target.value))} /> грн.</label>
                <label>Сейф/термінал: <input type="number" value={safeTerminal} onChange={(e) => setSafeTerminal(normalizeNumber(e.target.value))} /> грн.</label>
            </div>
        </div>
    );
}
