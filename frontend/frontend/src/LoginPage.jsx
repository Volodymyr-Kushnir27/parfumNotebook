import { useState, useEffect } from "react";
import "./LoginPage.css";

export default function LoginPage({ onLogin }) {
  const [registerMode, setRegisterMode] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const validateEmail = (email) => /\S+@\S+\.\S+/.test(email);

  useEffect(() => {
    if (timer <= 0) return;
    const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [timer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (resetMode) {
      if (!codeSent) {
        if (!email || !validateEmail(email)) return setError("Введіть коректний email");
        try {
          const res = await fetch("http://localhost:4000/api/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          const data = await res.json();
          if (res.ok) {
            setMessage("Код для скидання пароля надіслано на email");
            setCodeSent(true);
            setTimer(600);
          } else setError(data.message || "Помилка");
        } catch {
          setError("Помилка сервера");
        }
        return;
      }

      if (timer <= 0) {
        setError("Термін дії коду закінчився. Запросіть код знову.");
        setCodeSent(false);
        setResetCode("");
        setNewPassword("");
        return;
      }

      if (!resetCode || !newPassword) return setError("Введіть код та новий пароль");

      try {
        const res = await fetch("http://localhost:4000/api/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code: resetCode, newPassword }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage("Пароль успішно змінено. Тепер увійдіть.");
          setResetMode(false);
          setCodeSent(false);
          setResetCode("");
          setNewPassword("");
        } else setError(data.message || "Помилка");
      } catch {
        setError("Помилка сервера");
      }
      return;
    }

    if (registerMode) {
      if (!name) return setError("Введіть ФІО");
      if (!email || !validateEmail(email)) return setError("Введіть коректний email");
      if (!password || password !== password2) return setError("Паролі не співпадають");
    } else {
      if (!email || !password) return setError("Введіть email та пароль");
    }

    try {
      const payload = registerMode ? { name, email, password } : { email, password };
      const res = await fetch(
        registerMode ? "http://localhost:4000/api/register" : "http://localhost:4000/api/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("sellerName", data.name || name);
        onLogin();
      } else setError(data.message || "Помилка");
    } catch {
      setError("Помилка сервера");
    }
  };

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="login-container">
      <h1>Щоденник продавця</h1>

      {!resetMode && (
        <button onClick={() => setRegisterMode(!registerMode)}>
          {registerMode ? "Увійти" : "Зареєструватись"}
        </button>
      )}

      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        {registerMode && !resetMode && (
          <input
            type="text"
            placeholder="ФІО"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {!resetMode && (
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}

        {registerMode && !resetMode && (
          <input
            type="password"
            placeholder="Повторіть пароль"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
          />
        )}

        {resetMode && codeSent && (
          <>
            <input
              type="text"
              placeholder="Код з email"
              value={resetCode}
              onChange={(e) => setResetCode(e.target.value)}
            />
            <input
              type="password"
              placeholder="Новий пароль"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <p className="timer">Час дії коду: {formatTime(timer)}</p>
          </>
        )}

        <button type="submit">
          {resetMode
            ? codeSent
              ? "Скинути пароль"
              : "Відправити код"
            : registerMode
            ? "Зареєструватись"
            : "Увійти"}
        </button>
      </form>

      {!registerMode && !resetMode && (
        <p style={{ marginTop: 10 }}>
          <button className="link-btn" onClick={() => setResetMode(true)}>
            Забули пароль?
          </button>
        </p>
      )}

      {resetMode && (
        <p style={{ marginTop: 10 }}>
          <button className="link-btn" onClick={() => { setResetMode(false); setCodeSent(false); }}>
            Повернутись до входу
          </button>
        </p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}
    </div>
  );
}
