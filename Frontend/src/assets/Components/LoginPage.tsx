import { useState } from "react";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();

        await fetch("http://localhost:8080/api/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        navigate("/home");
    };

    return (
        <div style={{
            height: "100vh",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#111",
            color: "white"
        }}>
            <form
                onSubmit={submit}
                style={{
                    background: "#222",
                    padding: 30,
                    borderRadius: 8,
                    width: 320
                }}
            >
                <h2>Login</h2>

                <div style={{ marginBottom: 12 }}>
                    <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Username"
                        style={{ width: "100%", padding: 8 }}
                    />
                </div>

                <div style={{ marginBottom: 12 }}>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password"
                        style={{ width: "100%", padding: 8 }}
                    />
                </div>

                <button
                    type="submit"
                    style={{
                        width: "100%",
                        padding: 10,
                        cursor: "pointer"
                    }}
                >
                    Login
                </button>
            </form>
        </div>
    );
};

export default LoginPage;