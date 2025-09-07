import React, { useEffect, useState } from 'react'

export default function App() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10))
  const [department, setDepartment] = useState('')
  const [seller, setSeller] = useState('')
  const [items, setItems] = useState([])
  const [reportId, setReportId] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/reports?date=${date}`)
        if (!res.ok) { setItems([]); setReportId(null); return }
        const data = await res.json()
        setReportId(data.report.id)
        setDepartment(data.report.department || '')
        setSeller(data.report.seller || '')
        setItems((data.items || []).map(it => ({ ...it })))
      } catch (e) {
        setItems([])
        setReportId(null)
      }
    }
    load()
  }, [date])

  const addRow = () => {
    const pos = items.length + 1
    setItems([...items, { position_no: pos, volume: '', bottle: '', color: '', quantity: 0, price: 0, sum: 0, remark: '', carry_from_prev: false }])
  }

  const updateRow = (idx, changes) => {
    setItems(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], ...changes }
      next[idx].sum = (next[idx].quantity || 0) * (next[idx].price || 0)
      return next
    })
  }

  const saveReport = async () => {
    setLoading(true)
    try {
      const payload = { date, department, seller, items }
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error('Save failed')
      const data = await res.json()
      setReportId(data.report.id)
      alert('Збережено')
    } catch (e) {
      alert('Помилка збереження: ' + (e.message || e))
    } finally {
      setLoading(false)
    }
  }

  const exportCsv = () => {
    if (!reportId) return alert('Спочатку збережіть звіт')
    window.open(`/api/reports/${reportId}/export/csv`, '_blank')
  }

  const total = items.reduce((s,i) => s + ((i.quantity || 0) * (i.price || 0)), 0)

  return (
    <div className="container">
      <div className="header">
        <h2>ParfumNotebook — щоденний звіт</h2>
        <div className="small">Веб-версія &middot; {new Date().getFullYear()}</div>
      </div>

      <div className="controls">
        <label>Дата: <input type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
        <label>Відділ: <input value={department} onChange={e=>setDepartment(e.target.value)} placeholder="Назва відділу" /></label>
        <label>Продавець: <input value={seller} onChange={e=>setSeller(e.target.value)} placeholder="Ім'я продавця" /></label>

        <button className="btn" onClick={addRow}>Додати рядок</button>
        <button className="btn primary" onClick={saveReport} disabled={loading}>{loading ? 'Збереження...' : 'Зберегти'}</button>
        <button className="btn" onClick={exportCsv}>Експорт CSV</button>
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th><th>Об'єм</th><th>Флакон</th><th>Колір</th><th>К-сть</th><th>Ціна</th><th>Сума</th><th>Примітка</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{width:40}}>{it.position_no}</td>
              <td><input value={it.volume} onChange={e=>updateRow(idx,{volume:e.target.value})} /></td>
              <td><input value={it.bottle} onChange={e=>updateRow(idx,{bottle:e.target.value})} /></td>
              <td><input value={it.color} onChange={e=>updateRow(idx,{color:e.target.value})} /></td>
              <td style={{width:100}}><input type="number" value={it.quantity} onChange={e=>updateRow(idx,{quantity: parseFloat(e.target.value || '0')})} /></td>
              <td style={{width:100}}><input type="number" value={it.price} onChange={e=>updateRow(idx,{price: parseFloat(e.target.value || '0')})} /></td>
              <td style={{width:110}}>{((it.sum||0)).toFixed(2)}</td>
              <td><input value={it.remark} onChange={e=>updateRow(idx,{remark:e.target.value})} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="summary">Загальна сума: {total.toFixed(2)}</div>
    </div>
  )
}
