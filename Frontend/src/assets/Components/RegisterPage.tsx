import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const RegisterPage = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validierung
        if (username.length < 3) {
            setError("Username must be at least 3 characters");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("http://localhost:8080/api/users/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username,
                    password
                })
            });

            const data = await response.json();

            if (data.success) {
                // Automatisch einloggen nach Registrierung
                localStorage.setItem("userId", data.userId);
                localStorage.setItem("username", data.username);
                navigate("/home");
            } else {
                setError(data.message || "Registration failed");
            }
        } catch (err) {
            console.error("Registration error:", err);
            setError("Cannot connect to backend. Make sure it's running on http://localhost:8080");
        } finally {
            setLoading(false);
        }
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
                <h2>Register</h2>

                {error && (
                    <div style={{
                        background: "#f44336",
                        padding: 10,
                        borderRadius: 4,
                        marginBottom: 12,
                        fontSize: 14,
                        textAlign: "center"
                    }}>
                        {error}
                    </div>
                )}

                <div style={{ marginBottom: 12 }}>
                    <input
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="Username (min. 3 characters)"
                        style={{ width: "100%", padding: 8 }}
                        disabled={loading}
                    />
                </div>

                <div style={{ marginBottom: 12 }}>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Password (min. 6 characters)"
                        style={{ width: "100%", padding: 8 }}
                        disabled={loading}
                    />
                </div>

                <div style={{ marginBottom: 12 }}>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder="Confirm Password"
                        style={{ width: "100%", padding: 8 }}
                        disabled={loading}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    style={{
                        width: "100%",
                        padding: 10,
                        cursor: loading ? "not-allowed" : "pointer",
                        backgroundColor: "#4CAF50",
                        color: "white",
                        border: "none",
                        borderRadius: 4,
                        opacity: loading ? 0.7 : 1
                    }}
                >
                    {loading ? "Registering..." : "Register"}
                </button>

                <div style={{ marginTop: 15, textAlign: "center", fontSize: 14 }}>
                    Already have an account?{" "}
                    <Link to="/login" style={{ color: "#2196F3", textDecoration: "none" }}>
                        Login here
                    </Link>
                </div>
            </form>
        </div>
    );
};

export default RegisterPage;