import { useNavigate } from "react-router-dom";
import { useState } from "react";

const HomePage = () => {
    const navigate = useNavigate();
    const [exercise, setExercise] = useState("");

    const handleSelect = (e) => {
        const value = e.target.value;
        setExercise(value);

        if (value === "curls") {
            navigate("/curls");
        }
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                width: "100vw",
                backgroundColor: "#111",
                color: "white",
                margin: 0,
                padding: 0,
                position: "relative",
            }}
        >
            {/* Progress Button (updated) */}
            <button
                onClick={() => navigate("/progress")}
                style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    padding: "12px 40px", // wider
                    fontSize: "16px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    backgroundColor: "#ccc", // grey
                    color: "black", // black text
                    fontWeight: "bold",
                    border: "none",
                    zIndex: 10,
                }}
            >
                Progress
            </button>

            {/* New Header + Dropdown */}
            <h1 style={{ marginBottom: "20px" }}>Exercises</h1>

            <select
                value={exercise}
                onChange={handleSelect}
                style={{
                    padding: "12px 20px",
                    fontSize: "16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                }}
            >
                <option value="">Select Exercise</option>
                <option value="curls">Curls</option>
            </select>
        </div>
    );
};

export default HomePage;