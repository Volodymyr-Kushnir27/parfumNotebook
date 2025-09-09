import React, { useEffect, useState } from "react";
import "./Dashboard.css";

export default function Dashboard({ onLogout }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [department, setDepartment] = useState("");
  const [seller, setSeller] = useState("");
  const [items, setItems] = useState([]);
  const [reportId, setReportId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Завантаження даних
  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(`/api/reports?date=${date}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          setItems([]);
          setReportId(null);
          return;
        }
        const data = await res.json();
        setReportId(data.report?.id || null);
        setDepartment(data.report?.department || "");
        setSeller(data.report?.seller || "");
        setItems((data.items || []).map(it => ({ ...it })));
      } catch (e) {
        setItems([]);
        setReportId(null);
      }
    };
    load();
  }, [date]);

  // Додавання рядка
  const addRow = () => {
    const pos = items.length + 1;
    setItems([...items, { position_no: pos, volume: "", bottle: "", color: "", quantity: 0, price: 0, sum: 0, remark: "" }]);
  };

  // Оновлення рядка
  const updateRow = (idx, changes) => {
    setItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...changes };
      next[idx].sum = (next[idx].quantity || 0) * (next[idx].price || 0);
      return next;
    });
  };

  // Збереження
  const saveReport = async () => {
    setLoading(true);
    const token = localStorage.getItem("token");
    try {
      const payload = { date, department, seller, items };
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      const data = await res.json();
      setReportId(data.report.id);
      alert("✅ Збережено");
    } catch (e) {
      alert("❌ Помилка: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  // Експорт CSV
  const exportCsv = () => {
    if (!reportId) return alert("Спочатку збережіть звіт");
    const token = localStorage.getItem("token");
    window.open(`/api/reports/${reportId}/export/csv?token=${token}`, "_blank");
  };

  // Загальна сума
  const total = items.reduce((s, i) => s + (i.sum || 0), 0);

  return (
    <div className="dashboard-container">
      {/* --- Хедер --- */}
      <div className="dashboard-header">
        <h1>ParfumNotebook — щоденний звіт</h1>
        <div className="header-buttons">
          <button className="btn primary" onClick={saveReport} disabled={loading}>
            {loading ? "Збереження..." : "Зберегти"}
          </button>
          <button className="btn" onClick={exportCsv}>Експорт CSV</button>
          <button className="btn red" onClick={onLogout}>Вийти</button>
        </div>
      </div>

      {/* --- Контрольні поля --- */}
      <div className="controls">
        <label>Дата: <input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
        <label>Відділ: <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Назва відділу" /></label>
        <label>Продавець: <input value={seller} onChange={e => setSeller(e.target.value)} placeholder="Ім'я продавця" /></label>
        <button className="btn" onClick={addRow}>+ Додати рядок</button>
      </div>

      {/* --- Таблиця --- */}
      <table>
        <thead>
          <tr>
            <th>#</th><th>Об'єм</th><th>Флакон</th><th>Колір</th><th>К-сть</th><th>Ціна</th><th>Сума</th><th>Примітка</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td>{it.position_no}</td>
              <td><input value={it.volume} onChange={e => updateRow(idx, { volume: e.target.value })} /></td>
              <td><input value={it.bottle} onChange={e => updateRow(idx, { bottle: e.target.value })} /></td>
              <td><input value={it.color} onChange={e => updateRow(idx, { color: e.target.value })} /></td>
              <td><input type="number" value={it.quantity} onChange={e => updateRow(idx, { quantity: parseFloat(e.target.value || '0') })} /></td>
              <td><input type="number" value={it.price} onChange={e => updateRow(idx, { price: parseFloat(e.target.value || '0') })} /></td>
              <td>{it.sum.toFixed(2)}</td>
              <td><input value={it.remark} onChange={e => updateRow(idx, { remark: e.target.value })} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="summary">Загальна сума: {total.toFixed(2)}</div>
    </div>
  );
}
