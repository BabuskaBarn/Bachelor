import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface SessionSummary {
    id: number;
    date: string;
    reps: number;
    leftReps: number;
    rightReps: number;
    errors: number;
    duration: number;
}

interface ComparisonData {
    repsDifference?: number;
    errorsDifference?: number;
    message?: string;
    latest?: {
        date: string;
        reps: number;
        leftReps: number;
        rightReps: number;
        errors: number;
        duration: number;
    };
    previous?: {
        date: string;
        reps: number;
        leftReps: number;
        rightReps: number;
        errors: number;
        duration: number;
    };
}

const ProgressPage = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [comparison, setComparison] = useState<ComparisonData | null>(null);
    const [loading, setLoading] = useState(true);
    const userId = localStorage.getItem("userId");

    useEffect(() => {
        if (!userId) {
            navigate("/login");
            return;
        }
        fetchData();
    }, [userId]);

    const fetchData = async () => {
        try {
            const sessionsRes = await fetch(`http://localhost:8080/api/sessions/user/${userId}`);
            const sessionsData = await sessionsRes.json();

            const feedbackRes = await fetch(`http://localhost:8080/api/sessions/user/${userId}/feedback`);
            const feedbackData = await feedbackRes.json();

            if (sessionsData.success) {
                const formattedSessions = sessionsData.sessions.map((s: any) => ({
                    id: s.id,
                    date: new Date(s.createdAt).toLocaleDateString(),
                    reps: s.totalReps,
                    leftReps: s.leftReps,
                    rightReps: s.rightReps,
                    errors: s.errors ?
                        (s.errors.left?.length || 0) + (s.errors.right?.length || 0) + (s.errors.universal?.length || 0) : 0,
                    duration: s.duration
                }));
                setSessions(formattedSessions.reverse());
            }

            if (feedbackData.success && feedbackData.hasComparison) {
                setComparison({
                    repsDifference: feedbackData.comparison?.repsDifference,
                    errorsDifference: feedbackData.comparison?.errorsDifference,
                    message: feedbackData.comparison?.message,
                    latest: feedbackData.comparison?.latest,
                    previous: feedbackData.comparison?.previous
                });
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    const maxReps = Math.max(...sessions.map(s => s.reps), 10);
    const maxErrors = Math.max(...sessions.map(s => s.errors), 5);
    const maxDuration = Math.max(...sessions.map(s => s.duration), 10);

    if (loading) {
        return (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", width: "100vw", backgroundColor: "#111", color: "white" }}>
                Loading your progress...
            </div>
        );
    }

    return (
        <div style={{ padding: "20px", backgroundColor: "#111", height: "100vh", width: "100vw", color: "white", overflowY: "auto" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h1>Training Progress</h1>
                <button
                    onClick={() => navigate("/home")}
                    style={{ padding: "10px 20px", backgroundColor: "#333", border: "none", borderRadius: "8px", color: "white", cursor: "pointer" }}
                >
                    Back to Home
                </button>
            </div>

            {/* Feedback Message */}
            {comparison?.message && (
                <div style={{
                    backgroundColor: comparison.repsDifference && comparison.repsDifference > 0 ? "#1a3a1a" : "#3a1a1a",
                    padding: "20px",
                    borderRadius: "10px",
                    marginBottom: "25px",
                    textAlign: "center"
                }}>
                    <h2 style={{ color: comparison.repsDifference && comparison.repsDifference > 0 ? "#4CAF50" : "#ff9800" }}>
                        {comparison.message}
                    </h2>
                    <div style={{ display: "flex", justifyContent: "center", gap: "30px", marginTop: "10px" }}>
                        <span>Reps: {comparison.repsDifference && comparison.repsDifference > 0 ? "+" : ""}{comparison.repsDifference}</span>
                        <span>Errors: {comparison.errorsDifference && comparison.errorsDifference < 0 ? "-" : "+"}{Math.abs(comparison.errorsDifference || 0)}</span>
                    </div>
                </div>
            )}

            {sessions.length === 0 && (
                <div style={{ backgroundColor: "#1a1a2e", padding: "40px", borderRadius: "10px", textAlign: "center" }}>
                    <h2>No workouts yet!</h2>
                    <p>Complete your first session to see your progress here.</p>
                    <button
                        onClick={() => navigate("/curls")}
                        style={{ marginTop: "20px", padding: "10px 20px", backgroundColor: "#4CAF50", border: "none", borderRadius: "5px", color: "white", cursor: "pointer" }}
                    >
                        Start First Workout
                    </button>
                </div>
            )}

            {sessions.length > 0 && (
                <>
                    {/* Graph 1: Reps Progress */}
                    <div style={{ backgroundColor: "#1a1a2e", padding: "20px", borderRadius: "10px", marginBottom: "25px" }}>
                        <h3>Reps Progress Over Time</h3>
                        <p style={{ fontSize: "12px", color: "#888", marginBottom: "15px" }}>Higher is better</p>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "250px", marginTop: "20px" }}>
                            {sessions.map((session) => (
                                <div key={session.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                                    <div style={{
                                        width: "100%",
                                        backgroundColor: "#4CAF50",
                                        height: `${(session.reps / maxReps) * 100}%`,
                                        minHeight: "5px",
                                        borderRadius: "4px 4px 0 0",
                                        transition: "height 0.5s ease"
                                    }} />
                                    <div style={{ fontSize: "10px", marginTop: "5px", textAlign: "center" }}>
                                        {session.date.split(",")[0]}
                                    </div>
                                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#4CAF50" }}>
                                        {session.reps}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Graph 2: Errors Progress */}
                    <div style={{ backgroundColor: "#1a1a2e", padding: "20px", borderRadius: "10px", marginBottom: "25px" }}>
                        <h3>Errors Progress Over Time</h3>
                        <p style={{ fontSize: "12px", color: "#888", marginBottom: "15px" }}>Lower is better</p>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "250px", marginTop: "20px" }}>
                            {sessions.map((session) => (
                                <div key={session.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                                    <div style={{
                                        width: "100%",
                                        backgroundColor: session.errors > 0 ? "#ff9800" : "#4CAF50",
                                        height: `${(session.errors / maxErrors) * 100}%`,
                                        minHeight: "5px",
                                        borderRadius: "4px 4px 0 0",
                                        transition: "height 0.5s ease"
                                    }} />
                                    <div style={{ fontSize: "10px", marginTop: "5px", textAlign: "center" }}>
                                        {session.date.split(",")[0]}
                                    </div>
                                    <div style={{ fontSize: "11px", fontWeight: "bold", color: session.errors > 0 ? "#ff9800" : "#4CAF50" }}>
                                        {session.errors}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Graph 3: Duration Progress */}
                    <div style={{ backgroundColor: "#1a1a2e", padding: "20px", borderRadius: "10px", marginBottom: "25px" }}>
                        <h3>Duration Progress Over Time</h3>
                        <p style={{ fontSize: "12px", color: "#888", marginBottom: "15px" }}></p>
                        <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", height: "250px", marginTop: "20px" }}>
                            {sessions.map((session) => (
                                <div key={session.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }}>
                                    <div style={{
                                        width: "100%",
                                        backgroundColor: "#2196F3",
                                        height: `${(session.duration / maxDuration) * 100}%`,
                                        minHeight: "5px",
                                        borderRadius: "4px 4px 0 0",
                                        transition: "height 0.5s ease"
                                    }} />
                                    <div style={{ fontSize: "10px", marginTop: "5px", textAlign: "center" }}>
                                        {session.date.split(",")[0]}
                                    </div>
                                    <div style={{ fontSize: "11px", fontWeight: "bold", color: "#2196F3" }}>
                                        {session.duration?.toFixed(0)}s
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Graph 4: Left vs Right Reps (Latest Session) */}
                    <div style={{ backgroundColor: "#1a1a2e", padding: "20px", borderRadius: "10px", marginBottom: "25px" }}>
                        <h3>Left vs Right Arm (Latest Session)</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
                            <div>
                                <div style={{ textAlign: "center", marginBottom: "10px", color: "#888" }}>Left Arm</div>
                                <div style={{ backgroundColor: "#333", borderRadius: "10px", overflow: "hidden", height: "40px" }}>
                                    <div style={{
                                        width: `${(sessions[sessions.length - 1]?.leftReps / Math.max(sessions[sessions.length - 1]?.leftReps, sessions[sessions.length - 1]?.rightReps, 1)) * 100}%`,
                                        backgroundColor: "#2196F3",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        paddingRight: "10px",
                                        transition: "width 0.5s ease"
                                    }}>
                                        {sessions[sessions.length - 1]?.leftReps} reps
                                    </div>
                                </div>
                            </div>
                            <div>
                                <div style={{ textAlign: "center", marginBottom: "10px", color: "#888" }}>Right Arm</div>
                                <div style={{ backgroundColor: "#333", borderRadius: "10px", overflow: "hidden", height: "40px" }}>
                                    <div style={{
                                        width: `${(sessions[sessions.length - 1]?.rightReps / Math.max(sessions[sessions.length - 1]?.leftReps, sessions[sessions.length - 1]?.rightReps, 1)) * 100}%`,
                                        backgroundColor: "#ff9800",
                                        height: "100%",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "flex-end",
                                        paddingRight: "10px",
                                        transition: "width 0.5s ease"
                                    }}>
                                        {sessions[sessions.length - 1]?.rightReps} reps
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Graph 5: Last vs Previous Session */}
                    {comparison?.latest && comparison?.previous && (
                        <div style={{ backgroundColor: "#1a1a2e", padding: "20px", borderRadius: "10px", marginBottom: "25px" }}>
                            <h3>Last vs Previous Session</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginTop: "20px" }}>
                                <div style={{ backgroundColor: "#2a2a2e", padding: "15px", borderRadius: "8px" }}>
                                    <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: "10px", color: "#888" }}>Previous</div>
                                    <div style={{ fontSize: "12px", color: "#aaa" }}>{comparison.previous.date}</div>
                                    <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4CAF50" }}>{comparison.previous.reps} reps</div>
                                    <div style={{ fontSize: "14px", color: "#ff9800" }}>{comparison.previous.errors} errors</div>
                                    <div style={{ fontSize: "12px", color: "#888" }}>{comparison.previous.leftReps}L | {comparison.previous.rightReps}R</div>
                                </div>
                                <div style={{ backgroundColor: "#1a3a1a", padding: "15px", borderRadius: "8px", border: "1px solid #4CAF50" }}>
                                    <div style={{ textAlign: "center", fontWeight: "bold", marginBottom: "10px", color: "#4CAF50" }}>Latest</div>
                                    <div style={{ fontSize: "12px", color: "#aaa" }}>{comparison.latest.date}</div>
                                    <div style={{ fontSize: "18px", fontWeight: "bold", color: "#4CAF50" }}>{comparison.latest.reps} reps</div>
                                    <div style={{ fontSize: "14px", color: "#ff9800" }}>{comparison.latest.errors} errors</div>
                                    <div style={{ fontSize: "12px", color: "#888" }}>{comparison.latest.leftReps}L | {comparison.latest.rightReps}R</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", justifyContent: "center", gap: "20px", marginTop: "15px", fontSize: "14px" }}>
                                <span style={{ color: (comparison.repsDifference || 0) > 0 ? "#4CAF50" : "#ff9800" }}>
                                    Reps: {(comparison.repsDifference || 0) > 0 ? "+" : ""}{comparison.repsDifference}
                                </span>
                                <span style={{ color: (comparison.errorsDifference || 0) < 0 ? "#4CAF50" : "#ff9800" }}>
                                    Errors: {(comparison.errorsDifference || 0) < 0 ? "-" : "+"}{Math.abs(comparison.errorsDifference || 0)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Session History Table */}
                    <div style={{ backgroundColor: "#1a1a2e", padding: "20px", borderRadius: "10px", marginBottom: "25px" }}>
                        <h3>Session History</h3>
                        <div style={{ overflowX: "auto", marginTop: "15px" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                <tr style={{ borderBottom: "2px solid #333" }}>
                                    <th style={{ padding: "12px", textAlign: "left" }}>Date</th>
                                    <th style={{ padding: "12px", textAlign: "center" }}>Reps</th>
                                    <th style={{ padding: "12px", textAlign: "center" }}>L/R</th>
                                    <th style={{ padding: "12px", textAlign: "center" }}>Errors</th>
                                    <th style={{ padding: "12px", textAlign: "center" }}>Duration</th>
                                </tr>
                                </thead>
                                <tbody>
                                {sessions.slice().reverse().map((session, index) => (
                                    <tr key={session.id} style={{ borderBottom: "1px solid #333", backgroundColor: index === 0 ? "#1a3a1a" : "transparent" }}>
                                        <td style={{ padding: "10px" }}>{session.date}</td>
                                        <td style={{ padding: "10px", textAlign: "center", fontWeight: "bold", color: "#4CAF50" }}>{session.reps}</td>
                                        <td style={{ padding: "10px", textAlign: "center" }}>{session.leftReps} / {session.rightReps}</td>
                                        <td style={{ padding: "10px", textAlign: "center", color: session.errors > 0 ? "#ff9800" : "#4CAF50" }}>{session.errors}</td>
                                        <td style={{ padding: "10px", textAlign: "center" }}>{session.duration?.toFixed(0)}s</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "15px", marginTop: "25px", justifyContent: "center" }}>
                <button
                    onClick={() => navigate("/curls")}
                    style={{ padding: "12px 24px", backgroundColor: "#4CAF50", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "16px" }}
                >
                    Start New Workout
                </button>
                <button
                    onClick={() => fetchData()}
                    style={{ padding: "12px 24px", backgroundColor: "#2196F3", border: "none", borderRadius: "8px", color: "white", cursor: "pointer", fontSize: "16px" }}
                >
                    Refresh Data
                </button>
            </div>
        </div>
    );
};

export default ProgressPage;