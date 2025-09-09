import { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [registerMode, setRegisterMode] = useState(false);
  const [name, setName] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = registerMode ? "/api/register" : "/api/login";
    const body = registerMode
      ? { name, phone, password }
      : { phone, password };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("sellerName", data.name || name);
        onLogin();
      } else {
        setError(data.message || "Помилка");
      }
    } catch {
      setError("Помилка сервера");
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "50px auto", textAlign: "center" }}>
      <h1>Щоденник продавця</h1>
      <button onClick={() => setRegisterMode(!registerMode)}>
        {registerMode ? "Увійти" : "Зареєструватись"}
      </button>
      <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
        {registerMode && (
          <input
            type="text"
            placeholder="ФІО"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <br />
        <input
          type="text"
          placeholder="Номер телефону"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <br />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button type="submit">{registerMode ? "Зареєструватись" : "Увійти"}</button>
      </form>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
