import { useNavigate } from "react-router-dom";

const HomePage = () => {
    const navigate = useNavigate();

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#111",
                color: "white",
            }}
        >
            <h1>Willkommen zur Pose Detection App</h1>
            <p>Hier kannst du deine Armcurls analysieren.</p>

            <button
                onClick={() => navigate("/curls")}
                style={{
                    marginTop: 20,
                    padding: "12px 24px",
                    fontSize: 18,
                    cursor: "pointer",
                    borderRadius: 8,
                    backgroundColor: "lime",
                    color: "#111",
                    fontWeight: "bold",
                    border: "none",
                }}
            >
                Curls starten
            </button>
        </div>
    );
};

export default HomePage;