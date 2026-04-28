// CameraFeed.tsx - MIT ALLEN ÄNDERUNGEN HIGHLIGHTED
import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";
//  SessionStats importiert
import { CurlTracker, type ViewMode, type ArmFeedback, type SessionStats } from "./CurlTracker";

//  Backend API Service
const BACKEND_API_URL = "http://localhost:8080/api/sessions";

// Funktion zum Senden der Session-Daten ans Backend
async function sendSessionToBackend(stats: SessionStats, userId: string): Promise<boolean> {
    try {
        const response = await fetch(BACKEND_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: userId,
                timestamp: new Date().toISOString(),
                sessionData: {
                    leftReps: stats.leftReps,
                    rightReps: stats.rightReps,
                    totalReps: stats.totalReps,
                    startTime: stats.sessionStartTime,
                    endTime: stats.sessionEndTime,
                    duration: stats.sessionEndTime && stats.sessionStartTime
                        ? (stats.sessionEndTime - stats.sessionStartTime) / 1000
                        : null,
                    repRecords: stats.repRecords.map(record => ({
                        ...record,
                        raiseTime: record.raiseTime,
                        lowerTime: record.lowerTime,
                        timestamp: new Date(record.timestamp).toISOString(),
                    })),
                    errors: {
                        left: stats.leftErrors,
                        right: stats.rightErrors,
                        universal: stats.universalErrors
                    }
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Session saved to backend:', result);
        return true;
    } catch (error) {
        console.error('Error sending session to backend:', error);
        return false;
    }
}

const CameraFeed = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("front");
    const [armFeedback, setArmFeedback] = useState<ArmFeedback>({
        left: [],
        right: [],
        universal: [],
    });
    const [angles, setAngles] = useState<{ left: number | null; right: number | null }>({
        left: null,
        right: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [webcamReady, setWebcamReady] = useState(false);

    //  Session Stats States
    const [sessionStats, setSessionStats] = useState<SessionStats | null>(null);
    const [showStats, setShowStats] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [sendSuccess, setSendSuccess] = useState<boolean | null>(null);

    //  Elbow Forward Errors State
    const [elbowForwardErrors, setElbowForwardErrors] = useState<{ left: boolean; right: boolean }>({
        left: false,
        right: false,
    });

    const mirrored = true;
    const curlTracker = useRef(new CurlTracker()).current;

    // Pose Detector initialisieren (UNVERÄNDERT)
    useEffect(() => {
        let localDetector: poseDetection.PoseDetector | null = null;
        let mounted = true;

        const initDetector = async () => {
            try {
                setError(null);
                setIsLoading(true);

                await tf.ready();
                await tf.setBackend("webgl");

                const backend = tf.getBackend();
                console.log("TF Backend:", backend);

                const det = await poseDetection.createDetector(
                    poseDetection.SupportedModels.MoveNet,
                    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER }
                );

                if (mounted) {
                    localDetector = det;
                    setDetector(det);
                    console.log("Detector created successfully");
                }
            } catch (err) {
                console.error("Detection init error", err);
                if (mounted) {
                    setError(`Failed to initialize pose detector: ${err instanceof Error ? err.message : String(err)}`);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        initDetector();

        return () => {
            mounted = false;
            if (localDetector) {
                localDetector.dispose();
            }
        };
    }, []);

    // Reset when view mode changes (: mit session check)
    useEffect(() => {
        if (curlTracker && !curlTracker.isSessionActive()) {
            curlTracker.resetRepStates();
        }
    }, [viewMode, curlTracker]);

    //  Session Handler
    const handleStartSession = () => {
        curlTracker.startSession();
        setSessionStats(null);
        setShowStats(false);
        setSendSuccess(null);
    };

    //  End Session mit Backend-Send
    const handleEndSession = async () => {
        const stats = curlTracker.endSession();
        setSessionStats(stats);
        setShowStats(true);

        setIsSending(true);
        const userId = localStorage.getItem("userId") || "anonymous-user";
        const success = await sendSessionToBackend(stats, userId);
        setIsSending(false);
        setSendSuccess(success);

        if (success) {
            console.log("Session data successfully saved to backend!");
        } else {
            console.warn("Failed to save session data to backend");
        }
    };

    const handleWebcamReady = () => {
        console.log("Webcam is ready");
        setWebcamReady(true);
    };

    // Pose Detection Loop
    useEffect(() => {
        if (!detector || !webcamReady) return;

        let animationFrameId: number;
        let isDetecting = true;

        const detect = async () => {
            if (!isDetecting) return;

            try {
                if (
                    webcamRef.current &&
                    webcamRef.current.video &&
                    webcamRef.current.video.readyState === 4 &&
                    canvasRef.current
                ) {
                    const video = webcamRef.current.video;
                    const canvas = canvasRef.current;

                    if (video.videoWidth === 0 || video.videoHeight === 0) {
                        animationFrameId = requestAnimationFrame(detect);
                        return;
                    }

                    const scaleX = canvas.width / video.videoWidth;
                    const scaleY = canvas.height / video.videoHeight;

                    const mapX = (x: number) =>
                        mirrored ? canvas.width - x * scaleX : x * scaleX;
                    const mapY = (y: number) => y * scaleY;

                    const ctx = canvas.getContext("2d");
                    if (!ctx) return;

                    const poses = await detector.estimatePoses(video, {
                        maxPoses: 1,
                        flipHorizontal: false,
                    });

                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.font = "16px Arial";

                    const drawLine = (p1: Keypoint, p2: Keypoint, color: string) => {
                        ctx.beginPath();
                        ctx.moveTo(mapX(p1.x), mapY(p1.y));
                        ctx.lineTo(mapX(p2.x), mapY(p2.y));
                        ctx.strokeStyle = color;
                        ctx.lineWidth = 12;
                        ctx.lineCap = "round";
                        ctx.lineJoin = "round";
                        ctx.stroke();
                    };

                    if (poses.length > 0 && poses[0].keypoints) {
                        const result = curlTracker.analyzePose(poses[0], viewMode, mirrored);
                        setArmFeedback(result.feedback);
                        setAngles(result.angles);

                        // elbowForwardErrors setzen
                        setElbowForwardErrors(result.elbowForwardErrors);

                        //Backswing Linie (nur bei Backswing, mit Label)
                        if (viewMode === "side" && result.backSwingData.centerLine) {
                            const { start, end } = result.backSwingData.centerLine;
                            ctx.beginPath();
                            ctx.moveTo(mapX(start.x), mapY(start.y));
                            ctx.lineTo(mapX(end.x), mapY(end.y));
                            ctx.strokeStyle = "orange";
                            ctx.lineWidth = 8;
                            ctx.setLineDash([10, 10]);
                            ctx.stroke();
                            ctx.setLineDash([]);

                            ctx.fillStyle = "orange";
                            ctx.font = "14px Arial";
                            ctx.fillText("⚠ Backswing", mapX((start.x + end.x) / 2), mapY((start.y + end.y) / 2) - 10);
                        }

                        const pose = poses[0];
                        const leftShoulder = pose.keypoints.find((k) => k.name === "left_shoulder");
                        const leftElbow = pose.keypoints.find((k) => k.name === "left_elbow");
                        const leftWrist = pose.keypoints.find((k) => k.name === "left_wrist");
                        const rightShoulder = pose.keypoints.find((k) => k.name === "right_shoulder");
                        const rightElbow = pose.keypoints.find((k) => k.name === "right_elbow");
                        const rightWrist = pose.keypoints.find((k) => k.name === "right_wrist");

                        let sideArm: "left" | "right" | null = null;
                        if (viewMode === "side") {
                            sideArm = curlTracker.getSideArm(
                                leftShoulder,
                                leftElbow,
                                leftWrist,
                                rightShoulder,
                                rightElbow,
                                rightWrist
                            );
                        }

                        //  Draw left arm mit elbowForwardError
                        const leftOk =
                            leftShoulder &&
                            leftElbow &&
                            leftWrist &&
                            (viewMode === "front" || sideArm === "left");

                        if (leftOk) {
                            const leftAngle = result.angles.left;
                            // elbowForwardError macht Linie rot
                            const hasElbowError = viewMode === "side" && result.elbowForwardErrors.left;
                            const isWrong = (leftAngle !== null && leftAngle < 30) || (leftAngle !== null && leftAngle > 170) || hasElbowError;
                            const color = isWrong ? "red" : "lime";

                            if (leftAngle !== null) {
                                ctx.fillStyle = color;
                                ctx.fillText(
                                    `Left: ${Math.round(leftAngle)}°`,
                                    mapX(leftElbow!.x) + 5,
                                    mapY(leftElbow!.y) - 5
                                );
                            }

                            drawLine(leftShoulder!, leftElbow!, color);
                            drawLine(leftElbow!, leftWrist!, color);
                        }

                        //  Draw right arm mit elbowForwardError
                        const rightOk =
                            rightShoulder &&
                            rightElbow &&
                            rightWrist &&
                            (viewMode === "front" || sideArm === "right");

                        if (rightOk) {
                            const rightAngle = result.angles.right;
                            // elbowForwardError macht Linie rot
                            const hasElbowError = viewMode === "side" && result.elbowForwardErrors.right;
                            const isWrong = (rightAngle !== null && rightAngle < 30) || (rightAngle !== null && rightAngle > 170) || hasElbowError;
                            const color = isWrong ? "red" : "lime";

                            if (rightAngle !== null) {
                                ctx.fillStyle = color;
                                ctx.fillText(
                                    `Right: ${Math.round(rightAngle)}°`,
                                    mapX(rightElbow!.x) + 5,
                                    mapY(rightElbow!.y) - 5
                                );
                            }

                            drawLine(rightShoulder!, rightElbow!, color);
                            drawLine(rightElbow!, rightWrist!, color);
                        }

                        if (viewMode === "side" && sideArm) {
                            ctx.fillStyle = "yellow";
                            ctx.font = "16px Arial";
                            ctx.fillText(`Tracking: ${sideArm} arm`, 20, 25);
                        }

                        // Display rep counts during session
                        if (curlTracker.isSessionActive()) {
                            const repCounts = curlTracker.getDisplayRepCount(viewMode);
                            ctx.fillStyle = "white";
                            ctx.font = "bold 20px Arial";

                            if (viewMode === "side" && sideArm) {
                                const activeReps = sideArm === "left" ? repCounts.left : repCounts.right;
                                ctx.fillText(`Reps (${sideArm}): ${activeReps}`, 20, 60);
                            } else {
                                ctx.fillText(`Left: ${repCounts.left}  Right: ${repCounts.right}  Total: ${repCounts.total}`, 20, 60);
                            }
                        }
                    } else {
                        ctx.fillStyle = "white";
                        ctx.font = "20px Arial";
                        ctx.fillText("No pose detected", 20, 50);
                    }
                }
            } catch (err) {
                console.error("Detection error:", err);
            }

            animationFrameId = requestAnimationFrame(detect);
        };

        detect();

        return () => {
            isDetecting = false;
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [detector, mirrored, viewMode, curlTracker, webcamReady]);

    if (error) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#111",
                color: "white",
                flexDirection: "column"
            }}>
                <h2>Error loading camera feed</h2>
                <p>{error}</p>
                <button onClick={() => window.location.reload()} style={{ marginTop: 20, padding: "8px 16px" }}>
                    Reload Page
                </button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#111",
                color: "white"
            }}>
                <div>
                    <h2>Loading pose detection model...</h2>
                    <p>Please wait while we initialize the camera and AI model.</p>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#111",
            }}
        >
            <div style={{ color: "white", marginBottom: 10 }}>
                Aktueller Modus: <b>{viewMode === "front" ? "Front" : "Side"}</b>
            </div>

            <button
                onClick={() => setViewMode((m) => (m === "front" ? "side" : "front"))}
                style={{
                    marginBottom: 12,
                    padding: "8px 16px",
                    fontSize: 16,
                    cursor: "pointer",
                }}
            >
                Mode wechseln
            </button>

            {/* Session Control Buttons */}
            <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
                {!curlTracker.isSessionActive() ? (
                    <button
                        onClick={handleStartSession}
                        style={{
                            padding: "10px 20px",
                            fontSize: 16,
                            cursor: "pointer",
                            backgroundColor: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "5px"
                        }}
                    >
                        Start Session
                    </button>
                ) : (
                    <button
                        onClick={handleEndSession}
                        style={{
                            padding: "10px 20px",
                            fontSize: 16,
                            cursor: "pointer",
                            backgroundColor: "#f44336",
                            color: "white",
                            border: "none",
                            borderRadius: "5px"
                        }}
                    >
                        End Session
                    </button>
                )}
            </div>

            {/*  Session Status Anzeige */}
            {curlTracker.isSessionActive() && (
                <div style={{ color: "#4CAF50", marginBottom: 10, fontWeight: "bold" }}>
                     SESSION ACTIVE - Tracking started
                </div>
            )}

            {/* Sending Status */}
            {isSending && (
                <div style={{ color: "yellow", marginBottom: 10 }}>
                    Sending session data to backend...
                </div>
            )}

            {sendSuccess === true && (
                <div style={{ color: "#4CAF50", marginBottom: 10 }}>
                    ✓ Session data successfully saved!
                </div>
            )}

            {sendSuccess === false && (
                <div style={{ color: "#f44336", marginBottom: 10 }}>
                    ✗ Failed to save session data. Check console for details.
                </div>
            )}

            {/* Session Stats Modal */}
            {showStats && sessionStats && (
                <div style={{
                    position: "fixed",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    backgroundColor: "#333",
                    color: "white",
                    padding: "20px",
                    borderRadius: "10px",
                    zIndex: 1000,
                    maxWidth: "500px",
                    maxHeight: "80vh",
                    overflowY: "auto"
                }}>
                    <h3>Session Statistics</h3>
                    <p><strong>Left Reps:</strong> {sessionStats.leftReps}</p>
                    <p><strong>Right Reps:</strong> {sessionStats.rightReps}</p>
                    <p><strong>Total Reps:</strong> {sessionStats.totalReps}</p>
                    <p><strong>Duration:</strong> {sessionStats.sessionStartTime && sessionStats.sessionEndTime
                        ? ((sessionStats.sessionEndTime - sessionStats.sessionStartTime) / 1000).toFixed(1) + "s"
                        : "N/A"}</p>

                    <h4>Left Arm Errors:</h4>
                    {sessionStats.leftErrors.length === 0 ? <p>✓ No errors</p> :
                        sessionStats.leftErrors.map((e, i) => <p key={i}>• {e}</p>)}

                    <h4>Right Arm Errors:</h4>
                    {sessionStats.rightErrors.length === 0 ? <p>✓ No errors</p> :
                        sessionStats.rightErrors.map((e, i) => <p key={i}>• {e}</p>)}

                    <h4>Universal Errors:</h4>
                    {sessionStats.universalErrors.length === 0 ? <p>✓ No errors</p> :
                        sessionStats.universalErrors.map((e, i) => <p key={i}>• {e}</p>)}

                    <button
                        onClick={() => setShowStats(false)}
                        style={{ marginTop: "10px", padding: "8px 16px", cursor: "pointer" }}
                    >
                        Close
                    </button>
                </div>
            )}

            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                }}
            >
                {/* LEFT PANEL - UNVERÄNDERT */}
                <div
                    style={{
                        width: 260,
                        height: 600,
                        marginRight: 12,
                        padding: 10,
                        background: "#222",
                        color: "white",
                        borderRadius: 8,
                        overflowY: "auto",
                    }}
                >
                    <b>Left arm</b>

                    {armFeedback.left.length === 0 && (
                        <div style={{ color: "lime", marginTop: 8 }}>✓ No errors</div>
                    )}

                    {armFeedback.left.map((m, i) => (
                        <div key={i} style={{ marginTop: 6, color: "orange" }}>
                            • {m}
                        </div>
                    ))}
                </div>

                {/* CAMERA - UNVERÄNDERT */}
                <div
                    style={{
                        position: "relative",
                        width: 800,
                        height: 600,
                        backgroundColor: "#000",
                        borderRadius: 8,
                        overflow: "hidden",
                    }}
                >
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        mirrored={mirrored}
                        width={800}
                        height={600}
                        videoConstraints={{ facingMode: "user" }}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            objectFit: "cover"
                        }}
                        onUserMedia={() => handleWebcamReady()}
                        onUserMediaError={(err) => {
                            console.error("Webcam error:", err);
                            if ("message" in err) {
                                setError(`Webcam access denied or not available: ${err.message}`);
                            }
                        }}
                    />

                    <canvas
                        ref={canvasRef}
                        width={800}
                        height={600}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                        }}
                    />
                </div>

                {/* RIGHT PANEL - UNVERÄNDERT */}
                <div
                    style={{
                        width: 260,
                        height: 600,
                        marginLeft: 12,
                        padding: 10,
                        background: "#222",
                        color: "white",
                        borderRadius: 8,
                        overflowY: "auto",
                    }}
                >
                    <b>Right arm</b>

                    {armFeedback.right.length === 0 && (
                        <div style={{ color: "lime", marginTop: 8 }}>✓ No errors</div>
                    )}

                    {armFeedback.right.map((m, i) => (
                        <div key={i} style={{ marginTop: 6, color: "orange" }}>
                            • {m}
                        </div>
                    ))}
                </div>
            </div>

            {armFeedback.universal.length > 0 && (
                <div
                    style={{
                        marginTop: 16,
                        padding: 10,
                        background: "#332200",
                        color: "orange",
                        borderRadius: 8,
                        width: "calc(800px + 2*272px)",
                        textAlign: "center"
                    }}
                >
                    {armFeedback.universal.map((m, i) => (
                        <div key={i}>⚠️ {m}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CameraFeed;