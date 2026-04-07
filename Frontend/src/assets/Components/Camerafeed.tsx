// CameraFeed.tsx
import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";
import { CurlTracker, type ViewMode, type ArmFeedback } from "./CurlTracker";
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

    const mirrored = true;
    const curlTracker = useRef(new CurlTracker()).current; // ← FIXED: curlTracker (nicht curlTrakcer)

    // Pose Detector initialisieren
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

    // Reset rep states when view mode changes
    useEffect(() => {
        if (curlTracker) {
            curlTracker.resetRepStates(); // ← FIXED: curlTracker
        }
    }, [viewMode, curlTracker]);

    // Webcam Ready Handler
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
                        const result = curlTracker.analyzePose(poses[0], viewMode, mirrored); // ← FIXED: curlTracker
                        setArmFeedback(result.feedback);
                        setAngles(result.angles);

                        const pose = poses[0];
                        const leftShoulder = pose.keypoints.find((k) => k.name === "left_shoulder");
                        const leftElbow = pose.keypoints.find((k) => k.name === "left_elbow");
                        const leftWrist = pose.keypoints.find((k) => k.name === "left_wrist");
                        const rightShoulder = pose.keypoints.find((k) => k.name === "right_shoulder");
                        const rightElbow = pose.keypoints.find((k) => k.name === "right_elbow");
                        const rightWrist = pose.keypoints.find((k) => k.name === "right_wrist");

                        let sideArm: "left" | "right" | null = null;
                        if (viewMode === "side") {
                            sideArm = curlTracker.getSideArm( // ← FIXED: curlTracker
                                leftShoulder,
                                leftElbow,
                                leftWrist,
                                rightShoulder,
                                rightElbow,
                                rightWrist
                            );
                        }

                        // Draw left arm
                        const leftOk =
                            leftShoulder &&
                            leftElbow &&
                            leftWrist &&
                            (viewMode === "front" || sideArm === "left");

                        if (leftOk) {
                            const leftAngle = result.angles.left;
                            const isWrong = (leftAngle !== null && leftAngle < 30) || (leftAngle !== null && leftAngle > 170);
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

                        // Draw right arm
                        const rightOk =
                            rightShoulder &&
                            rightElbow &&
                            rightWrist &&
                            (viewMode === "front" || sideArm === "right");

                        if (rightOk) {
                            const rightAngle = result.angles.right;
                            const isWrong = (rightAngle !== null && rightAngle < 30) || (rightAngle !== null && rightAngle > 170);
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
                            ctx.fillText(`Tracking: ${sideArm} arm`, 20, 25);
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

    // ... Rest des JSX bleibt gleich
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

            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                }}
            >
                {/* LEFT PANEL */}
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

                {/* CAMERA */}
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
                            setError(`Webcam access denied or not available: ${err.message}`);
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

                {/* RIGHT PANEL */}
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