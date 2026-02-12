import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";

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

            try {
                await tf.setBackend("webgl");
                await tf.ready();
                console.log("TF Backend:",tf.getBackend());

                const detector = await poseDetection.createDetector(
                    poseDetection.SupportedModels.MoveNet,
                    { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
                );
                console.log("Detector created")
                setDetector(detector);
            } catch (error) {
                console.error("Detection init error", error)
            }

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
                console.log("Poses:", poses);

                // Canvas zeichnen
                const canvas = canvasRef.current;
                if (canvas) {
                    const ctx = canvas.getContext("2d");
                    if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                        // Linien zwischen Schulter-Elbow-Hand
                        const drawLine = (p1: any, p2: any, color:string) => {
                            ctx.beginPath();
                            ctx.moveTo(p1.x, p1.y);
                            ctx.lineTo(p2.x, p2.y);
                            ctx.strokeStyle = color;
                            ctx.lineWidth = 12;
                            ctx.lineCap = "round";
                            ctx.lineJoin = "round";
                            ctx.stroke();
                        };

                        poses.forEach((pose) => {
                            // Keypoints
                            const leftShoulder = pose.keypoints.find(k => k.name === "left_shoulder");
                            const leftElbow = pose.keypoints.find(k => k.name === "left_elbow");
                            const leftWrist = pose.keypoints.find(k => k.name === "left_wrist");

                            const rightShoulder = pose.keypoints.find(k => k.name === "right_shoulder");
                            const rightElbow = pose.keypoints.find(k => k.name === "right_elbow");
                            const rightWrist = pose.keypoints.find(k => k.name === "right_wrist");

                            // Armwinkel

                            //Left arm
                            if (leftShoulder && leftElbow && leftWrist) {
                                const leftAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);

                                const isWrong=leftAngle< 30 || leftAngle > 160;
                                const color = isWrong ? "red" : "lime";

                                //Angle text

                                ctx.fillStyle = color;
                                ctx.fillText(`Left: ${Math.round(leftAngle)}°`, leftElbow.x + 5, leftElbow.y - 5);

                                // Drawing Lines in correct color

                                drawLine(leftShoulder, leftElbow, color);
                                drawLine(leftElbow, leftWrist, color)

                                if (isWrong){
                                    ctx.fillText("Check Form", leftElbow.x, leftElbow.y +20);
                                }
                            }
                                //Right arm
                            if (rightShoulder && rightElbow && rightWrist) {
                                const rightAngle = calculateAngle(rightShoulder, rightElbow, rightWrist);

                                const isWrong=rightAngle< 30 || rightAngle > 160 ;
                                const color= isWrong ? "red" : "lime";

                                ctx.fillStyle = color;
                                ctx.fillText(`Right: ${Math.round(rightAngle)}°`, rightElbow.x + 5, rightElbow.y - 5);

                                drawLine(rightShoulder, rightElbow, color);
                                drawLine(rightElbow,rightWrist, color);

                                if (isWrong){
                                    ctx.fillText("Check Form!", rightElbow.x, rightElbow.y + 20);
                                }
                                }







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
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                backgroundColor: "#111" // optional dark background
            }}
        >
            <div
                style={{
                    position: "relative",
                    width: 800,
                    height: 600
                }}
            >
                <Webcam
                    ref={webcamRef}
                    audio={false}
                    mirrored
                    width={800}
                    height={600}
                    videoConstraints={{ facingMode: "user" }}
                    style={{ position: "absolute", top: 0, left: 0 }}
                />
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    style={{ position: "absolute", top: 0, left: 0 }}
                />
            </div>
        </div>
    );


};

export default CameraFeed;


