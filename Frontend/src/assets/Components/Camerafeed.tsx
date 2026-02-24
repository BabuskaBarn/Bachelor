import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

const Min_Score = 0.4; // Confidence-Threshold

const CameraFeed = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detector, setDetector] =
        useState<poseDetection.PoseDetector | null>(null);

    const mirrored = true;

    // Armwinkel berechnen (zwischen Schulter - Ellbogen - Hand)
    const calculateAngle = (a: Keypoint, b: Keypoint, c: Keypoint) => {
        const radians =
            Math.atan2(c.y - b.y, c.x - b.x) -
            Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs((radians * 180) / Math.PI);
        if (angle > 180) angle = 360 - angle;
        return angle;
    };

    // Pose Detector initialisieren
    useEffect(() => {
        let localDetector: poseDetection.PoseDetector | null = null;

        const initDetector = async () => {
            try {
                await tf.setBackend("webgl");
                await tf.ready();
                console.log("TF Backend:", tf.getBackend());

                const det = await poseDetection.createDetector(
                    poseDetection.SupportedModels.MoveNet,
                    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
                );

                localDetector = det;
                setDetector(det);

                console.log("Detector created");
            } catch (error) {
                console.error("Detection init error", error);
            }
        };

        initDetector();

        return () => {
            localDetector?.dispose();
        };
    }, []);

    // Pose Detection Loop
    useEffect(() => {
        if (!detector) return;

        let animationFrameId: number;

        const detect = async () => {
            if (
                webcamRef.current &&
                webcamRef.current.video &&
                webcamRef.current.video.readyState === 4 &&
                canvasRef.current
            ) {
                const video = webcamRef.current.video;
                const canvas = canvasRef.current;

                const mapX = (x: number) =>
                    mirrored ? canvas.width - x * scaleX : x * scaleX;

                const mapY = (y: number) => y * scaleY;

                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                // Skalierung zwischen Video und Canvas
                const scaleX = canvas.width / video.videoWidth;
                const scaleY = canvas.height / video.videoHeight;

                const poses = await detector.estimatePoses(video, {
                    maxPoses: 1,

                    // Spiegelung nur hier – nicht zusätzlich per CSS
                    flipHorizontal: false,
                });

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.font = "16px Arial";

                // Linien zwischen Schulter-Elbow-Hand
                const drawLine = (
                    p1: Keypoint,
                    p2: Keypoint,
                    color: string
                ) => {
                    ctx.beginPath();
                    ctx.moveTo(mapX(p1.x), mapY(p1.y));
                    ctx.lineTo(mapX(p2.x), mapY(p2.y));
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 12;
                    ctx.lineCap = "round";
                    ctx.lineJoin = "round";
                    ctx.stroke();
                };

                poses.forEach((pose) => {
                    // Keypoints
                    const leftShoulder = pose.keypoints.find(
                        (k) => k.name === "left_shoulder"
                    );
                    const leftElbow = pose.keypoints.find(
                        (k) => k.name === "left_elbow"
                    );
                    const leftWrist = pose.keypoints.find(
                        (k) => k.name === "left_wrist"
                    );
                    const leftHip = pose.keypoints.find(
                        (k) => k.name === "left_hip"
                    );

                    const rightShoulder = pose.keypoints.find(
                        (k) => k.name === "right_shoulder"
                    );
                    const rightElbow = pose.keypoints.find(
                        (k) => k.name === "right_elbow"
                    );
                    const rightWrist = pose.keypoints.find(
                        (k) => k.name === "right_wrist"
                    );
                    const rightHip = pose.keypoints.find(
                        (k) => k.name === "right_hip"
                    );

                    // ---------------- LEFT ARM ----------------
                    if (
                        leftShoulder?.score! > Min_Score &&
                        leftElbow?.score! > Min_Score &&
                        leftWrist?.score! > Min_Score &&
                        leftHip?.score! > Min_Score
                    ) {
                        const leftAngle = calculateAngle(
                            leftShoulder,
                            leftElbow,
                            leftWrist
                        );

                        const bodyWidthLeft = Math.abs(
                            leftShoulder.x - leftHip.x
                        );
                        const elbowDistanceLeft = Math.abs(
                            leftElbow.x - leftShoulder.x
                        );

                        // lockerer Schwellenwert
                        const elbowTooFarLeft =
                            elbowDistanceLeft > bodyWidthLeft * 1.25;

                        const isWrong =
                            leftAngle < 30 ||
                            leftAngle > 165 ||
                            elbowTooFarLeft;

                        const color = isWrong ? "red" : "lime";

                        // Angle text
                        ctx.fillStyle = color;
                        ctx.fillText(
                            `Left: ${Math.round(leftAngle)}°`,
                            mapX(leftElbow.x) + 5,
                            mapY(leftElbow.y) - 5
                        );

                        drawLine(leftShoulder, leftElbow, color);
                        drawLine(leftElbow, leftWrist, color);

                        if (isWrong) {
                            ctx.fillText(
                                elbowTooFarLeft
                                    ? "Elbow too far out"
                                    : "Check form",
                                    mapX(leftElbow.x),
                                mapY(leftElbow.y) + 20
                            );
                        }
                    }

                    // ---------------- RIGHT ARM ----------------
                    if (
                        rightShoulder?.score! > Min_Score &&
                        rightElbow?.score! > Min_Score &&
                        rightWrist?.score! > Min_Score &&
                        rightHip?.score! > Min_Score
                    ) {
                        const rightAngle = calculateAngle(
                            rightShoulder,
                            rightElbow,
                            rightWrist
                        );

                        const bodyWidthRight = Math.abs(
                            rightShoulder.x - rightHip.x
                        );
                        const elbowDistanceRight = Math.abs(
                            rightElbow.x - rightShoulder.x
                        );

                        // lockerer Schwellenwert
                        const elbowTooFarRight =
                            elbowDistanceRight > bodyWidthRight * 1.25;

                        const isWrong =
                            rightAngle < 30 ||
                            rightAngle > 165 ||
                            elbowTooFarRight;

                        const color = isWrong ? "red" : "lime";

                        ctx.fillStyle = color;
                        ctx.fillText(
                            `Right: ${Math.round(rightAngle)}°`,
                            mapX(rightElbow.x) + 5,
                            mapY(rightElbow.y) - 5
                        );

                        drawLine(rightShoulder, rightElbow, color);
                        drawLine(rightElbow, rightWrist, color);

                        if (isWrong) {
                            ctx.fillText(
                                elbowTooFarRight
                                    ? "Elbow too far out"
                                    : "Check form",
                                mapX(rightElbow.x),
                                mapY(rightElbow.y) + 20
                            );
                        }
                    }
                });
            }

            animationFrameId = requestAnimationFrame(detect);
        };

        detect();

        return () => cancelAnimationFrame(animationFrameId);
    }, [detector, mirrored]);

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#111", // optional dark background
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: 800,
                    height: 600,
                }}
            >
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored={mirrored}
                    width={800}
                    height={600}
                    videoConstraints={{ facingMode: "user" }}
                    style={{ position: "absolute", top: 0, left: 0 }}
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
        </div>
    );
};

export default CameraFeed;