import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

const CameraFeed = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);

    // Armwinkel berechnen (zwischen Schulter - Ellbogen - Hand)
    const calculateAngle = (a: any, b: any, c: any) => {
        const radians =
            Math.atan2(c.y - b.y, c.x - b.x) -
            Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs(radians * (180 / Math.PI));
        if (angle > 180) angle = 360 - angle;
        return angle;
    };

    // Pose Detector initialisieren
    useEffect(() => {
        const initDetector = async () => {
            const detector = await poseDetection.createDetector(
                poseDetection.SupportedModels.MoveNet,
                { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
            );
            setDetector(detector);
        };
        initDetector();
    }, []);

    // Pose Detection Loop
    useEffect(() => {
        if (!detector) return;

        let animationFrameId: number;

        const detect = async () => {
            if (
                webcamRef.current &&
                webcamRef.current.video &&
                webcamRef.current.video.readyState === 4
            ) {
                const video = webcamRef.current.video;
                const poses = await detector.estimatePoses(video);

                // Canvas zeichnen
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        poses.forEach((pose) => {
                            // Keypoints
                            const leftShoulder = pose.keypoints.find(k => k.name === "left_shoulder");
                            const leftElbow = pose.keypoints.find(k => k.name === "left_elbow");
                            const leftWrist = pose.keypoints.find(k => k.name === "left_wrist");

                            const rightShoulder = pose.keypoints.find(k => k.name === "right_shoulder");
                            const rightElbow = pose.keypoints.find(k => k.name === "right_elbow");
                            const rightWrist = pose.keypoints.find(k => k.name === "right_wrist");

                            // Armwinkel
                            if (leftShoulder && leftElbow && leftWrist) {
                                const leftAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
                                ctx.fillStyle = "red";
                                ctx.fillText(`Left: ${Math.round(leftAngle)}°`, leftElbow.x + 5, leftElbow.y - 5);

                                if (leftAngle < 30 || leftAngle > 160) {
                                    ctx.fillStyle = "red";
                                    ctx.fillText("Check Form!", leftElbow.x, leftElbow.y + 20);
                                }
                            }

                            if (rightShoulder && rightElbow && rightWrist) {
                                const rightAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);
                                ctx.fillStyle = "blue";
                                ctx.fillText(`Right: ${Math.round(rightAngle)}°`, rightElbow.x + 5, rightElbow.y - 5);

                                if (rightAngle < 30 || rightAngle > 160) {
                                    ctx.fillStyle = "red";
                                    ctx.fillText("Check Form!", rightElbow.x, rightElbow.y + 20);
                                }
                            }

                            // Optional: Linien zwischen Schulter-Elbow-Hand
                            const drawLine = (p1: any, p2: any) => {
                                ctx.beginPath();
                                ctx.moveTo(p1.x, p1.y);
                                ctx.lineTo(p2.x, p2.y);
                                ctx.strokeStyle = "green";
                                ctx.lineWidth = 3;
                                ctx.stroke();
                            };

                            if (leftShoulder && leftElbow) drawLine(leftShoulder, leftElbow);
                            if (leftElbow && leftWrist) drawLine(leftElbow, leftWrist);
                            if (rightShoulder && rightElbow) drawLine(rightShoulder, rightElbow);
                            if (rightElbow && rightWrist) drawLine(rightElbow, rightWrist);
                        });
                    }
                }
            }
            animationFrameId = requestAnimationFrame(detect);
        };

        detect();

        return () => cancelAnimationFrame(animationFrameId);
    }, [detector]);

    return (
        <div style={{ position: "relative", width: 640, height: 480 }}>
            <Webcam
                ref={webcamRef}
                audio={false}
                mirrored
                width={640}
                height={480}
                videoConstraints={{ facingMode: "user" }}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                style={{ position: "absolute", top: 0, left: 0 }}
            />
        </div>
    );
};

export default CameraFeed;


//fix pose