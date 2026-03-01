import { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import * as poseDetection from "@tensorflow-models/pose-detection";
import type { Keypoint } from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";
import * as tf from "@tensorflow/tfjs";
import {forceHalfFloat} from "@tensorflow/tfjs";

type ViewMode = "front" | "side";
const Min_Score = 0.4; // Confidence-Threshold

const CameraFeed = () => {
    const webcamRef = useRef<Webcam>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [detector, setDetector] =
        useState<poseDetection.PoseDetector | null>(null);

    const [viewMode, setViewMode] = useState<ViewMode>("front")
    const mirrored = true;

    const [armFeedback, setArmFeedback] = useState<{
      left:string[];
      right:string[];
      body:string[];
    }>({
        left:[],
        right:[],
        body:[]
    });

    const mergeUnique = (oldArr: string[], newArr: string[])=> {
        const set = new Set(oldArr);
        newArr.forEach(m=>set.add(m))
        return Array.from(set);
    }

    const pushMessages=(
        list:string[],
        rules:{ok:boolean, msg:string}[],
        fallback: string
    )=>{
        let hit = false;
        for(const r of rules){
            if(r.ok){
                list.push(r.msg);
                hit=true
            }
        }
        if(!hit)list.push(fallback)
    }




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
                    {modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING}
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

                const scaleX = canvas.width / video.videoWidth;
                const scaleY = canvas.height / video.videoHeight;


                const mapX = (x: number) =>
                    mirrored ? canvas.width - x * scaleX : x * scaleX;

                const mapY = (y: number) => y * scaleY;

                const ctx = canvas.getContext("2d");
                if (!ctx) return;

                // Skalierung zwischen Video und Canvas

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

                const leftMessages: string[]= [];
                const rightMessages: string[]=[];
                const bodyMessages: string[]=[];

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

                    //universal errors
                    let backSwing=false;

                    if(viewMode == "side" &&
                        leftShoulder && rightShoulder &&
                        leftHip && rightHip){
                        const shoulderCenterX=
                            (leftShoulder.x+rightShoulder.x)/2;

                        const hipCenterX=
                            (leftHip.x + rightShoulder.x)/2;

                        const torsoShift = Math.abs(shoulderCenterX-hipCenterX);

                        const bodyWidth =
                            Math.abs(leftShoulder.x-rightShoulder.x);

                        backSwing= torsoShift> bodyWidth *0.25;
                    }


                    //Arm visibility

                    const leftOk =
                        leftShoulder?.score! > Min_Score &&
                        leftElbow?.score! > Min_Score &&
                        leftWrist?.score! > Min_Score &&
                        leftHip?.score! > Min_Score;
                    const rightOk =
                        rightShoulder?.score! > Min_Score &&
                        rightElbow?.score! > Min_Score &&
                        rightWrist?.score! > Min_Score &&
                        rightHip?.score! > Min_Score;

                    //automatic detection of right arm during side mode
                    let sideArm: "left" | "right" | null = null;

                    if (viewMode == "side") {

                        const leftScore =
                            (leftShoulder?.score || 0) +
                            (leftElbow?.score || 0) +
                            (leftWrist?.score || 0);

                        const rightScore =
                            (rightShoulder?.score || 0) +
                            (rightElbow?.score || 0) +
                            (rightWrist?.score || 0);

                        if (leftScore > rightScore && leftOk) sideArm = "left";
                        else if (rightOk) sideArm = "right";
                    }


                    // LEFT ARM
                    if (
                        leftOk &&
                        (viewMode == "front" || sideArm == "left")
                    ) {
                        const leftAngle = calculateAngle(
                            leftShoulder!,
                            leftElbow!,
                            leftWrist!
                        );

                        const bodyWidthLeft = Math.abs(
                            leftShoulder!.x - leftHip!.x
                        );
                        const elbowDistanceLeft = Math.abs(
                            leftElbow!.x - leftShoulder!.x
                        );

                        // lockerer Schwellenwert
                        const elbowTooFarLeft =
                            elbowDistanceLeft > bodyWidthLeft * 1.25;

                        const leftWristTooFarUp =
                            leftAngle<30;

                        let leftElbowTooFarForward = false
                        if(viewMode== "side"){

                            const shoulderX =leftShoulder!.x;
                            const elbowX= leftElbow!.x;
                            const forwardDistance = Math.abs(elbowX-shoulderX);

                            leftElbowTooFarForward= forwardDistance > 40;
                        }

                        const isWrong =
                            leftWristTooFarUp ||
                            leftAngle > 170 ||
                            elbowTooFarLeft ||
                            leftElbowTooFarForward;

                        const color = isWrong ? "red" : "lime";

                        // Angle text
                        ctx.fillStyle = color;
                        ctx.fillText(
                            `Left: ${Math.round(leftAngle)}°`,
                            mapX(leftElbow.x) + 5,
                            mapY(leftElbow.y) - 5
                        );

                        drawLine(leftShoulder!, leftElbow!, color);
                        drawLine(leftElbow!, leftWrist!, color);

                        if(isWrong && viewMode== "front"){
                            pushMessages(leftMessages,[
                                {ok: leftWristTooFarUp, msg: "Wrist too far up"},
                                {ok: elbowTooFarLeft, msg: "Elbow too far out"}
                            ],"Check form");}

                        if (isWrong && viewMode== "side") {
                            pushMessages(leftMessages,
                                [{ok: leftElbowTooFarForward, msg:"Elbow too far forward"},

                            ], "check form");

                            pushMessages(bodyMessages,
                                [{ok: backSwing, msg:"Straighten back"}
                                ], "");

                        }

                    //  RIGHT ARM
                    if (
                        rightOk &&
                        (viewMode == "front" || sideArm == "right")
                    ) {
                        const rightAngle = calculateAngle(
                            rightShoulder!,
                            rightElbow!,
                            rightWrist!
                        );

                        const bodyWidthRight = Math.abs(
                            rightShoulder!.x - rightHip!.x
                        );
                        const elbowDistanceRight = Math.abs(
                            rightElbow!.x - rightShoulder!.x
                        );

                        // lockerer Schwellenwert
                        const elbowTooFarRight =
                            elbowDistanceRight > bodyWidthRight * 1.25;

                        const rightWristTooFarUp =
                            rightAngle<30;

                        let rightElbowTooFarForward = false
                            if(viewMode== "side"){

                                const shoulderX =rightShoulder!.x;
                                const elbowX= rightElbow!.x;
                                const forwardDistance = Math.abs(elbowX-shoulderX);

                                rightElbowTooFarForward= forwardDistance > 40;
                            }



                        const isWrong =
                            rightWristTooFarUp ||
                            rightAngle > 170 ||
                            elbowTooFarRight ||
                            rightElbowTooFarForward;

                        const color = isWrong ? "red" : "lime";

                        ctx.fillStyle = color;
                        ctx.fillText(
                            `Right: ${Math.round(rightAngle)}°`,
                            mapX(rightElbow!.x) + 5,
                            mapY(rightElbow!.y) - 5
                        );

                        drawLine(rightShoulder!, rightElbow!, color);
                        drawLine(rightElbow!, rightWrist!, color);

                        if(isWrong && viewMode== "front"){
                            pushMessages(rightMessages,[
                                {ok: rightWristTooFarUp, msg: "Wrist too far up"},
                                {ok: elbowTooFarRight, msg: "Elbow too far out"}
                            ],"Check form");}

                        if (isWrong && viewMode== "side") {
                            pushMessages(rightMessages,
                                [{ok: rightElbowTooFarForward, msg:"Elbow too far forward"},
                            ], "check form");

                            pushMessages(bodyMessages,
                                [{ok: backSwing, msg:"Straighten back"}
                                ], "");

                        }

                    if (viewMode == "side" && sideArm) {
                        ctx.fillStyle = "yellow";
                        ctx.fillText(
                            `Tracking: ${sideArm} arm`,
                            20,
                            25
                        )
                    }

                };}

                setArmFeedback(prev=>({
                    left:mergeUnique(prev.left, leftMessages),
                    right:mergeUnique(prev.right, rightMessages),
                    body: mergeUnique(prev.body, bodyMessages)
                }))
                })
            }

            animationFrameId = requestAnimationFrame(detect);
        };

        detect();

        return () => cancelAnimationFrame(animationFrameId);
    }, [detector, mirrored , viewMode]);


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
                onClick={() =>
                    setViewMode(m => (m === "front" ? "side" : "front"))
                }
                style={{
                    marginBottom: 12,
                    padding: "8px 16px",
                    fontSize: 16,
                    cursor: "pointer"
                }}
            >
                Mode wechseln
            </button>

            {/* ====== ROW: left panel | camera | right panel ====== */}
            <div
                style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center"
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
                        overflowY: "auto"
                    }}
                >
                    <b>Left arm</b>

                    {armFeedback.left.length === 0 && (
                        <div style={{ color: "lime", marginTop: 8 }}>
                            ✔ No errors
                        </div>
                    )}

                    {armFeedback.left.map((m, i) => (
                        <div key={i} style={{ marginTop: 6, color: "orange" }}>
                            • {m}
                        </div>
                    ))}
                </div>

                {/*CAMERA */}
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
                        overflowY: "auto"
                    }}
                >
                    <b>Right arm</b>

                    {armFeedback.right.length === 0 && (
                        <div style={{ color: "lime", marginTop: 8 }}>
                            ✔ No errors
                        </div>
                    )}

                    {armFeedback.right.map((m, i) => (
                        <div key={i} style={{ marginTop: 6, color: "orange" }}>
                            • {m}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
export default CameraFeed;



//Velocity
//rep logik

//Tomorrow velocity rep logik homepage
//Dienstag login screen verbindung mit backend
//mittwoch fein tuning + schreib arbeit 2000 wörter
//Donnerstag backend logik und ui
//freitag backend logik + Ui
//Samstag/Sonntag schreiben 4000 wörter
