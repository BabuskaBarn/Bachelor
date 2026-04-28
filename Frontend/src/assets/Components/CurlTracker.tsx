// CurlTracker.ts - KORRIGIERTE VERSION mit elbowForwardErrors im Return Type
import type { Keypoint } from "@tensorflow-models/pose-detection";

export type ViewMode = "front" | "side";

export interface ArmFeedback {
    left: string[];
    right: string[];
    universal: string[];
}

export interface RepState {
    prev: { y: number; t: number } | null;
    state: "idle" | "raising" | "lowering";
    raiseStart: number | null;
    lowerStart: number | null;
    idleStart: number | null;
}

export interface RepRecord {
    arm: "left" | "right";
    repNumber: number;
    raiseTime: number;
    lowerTime: number;
    errors: string[];
    timestamp: number;
}

export interface SessionStats {
    leftReps: number;
    rightReps: number;
    totalReps: number;
    repRecords: RepRecord[];
    sessionStartTime: number | null;
    sessionEndTime: number | null;
    leftErrors: string[];
    rightErrors: string[];
    universalErrors: string[];
}

export const Min_Score = 0.25;

interface TimedMessage {
    message: string;
    timestamp: number;
}

export class CurlTracker {
    private repRef = {
        left: {
            prev: null as { y: number; t: number } | null,
            state: "idle" as const,
            raiseStart: null as number | null,
            lowerStart: null as number | null,
            idleStart: null as number | null,
            repCount: 0,
        },
        right: {
            prev: null as { y: number; t: number } | null,
            state: "idle" as const,
            raiseStart: null as number | null,
            lowerStart: null as number | null,
            idleStart: null as number | null,
            repCount: 0,
        },
    };

    private stablePointsRef: Record<string, Keypoint | null> = {
        left_shoulder: null,
        left_elbow: null,
        left_wrist: null,
        left_hip: null,
        right_shoulder: null,
        right_elbow: null,
        right_wrist: null,
        right_hip: null,
    };

    private timedFeedback: {
        left: TimedMessage[];
        right: TimedMessage[];
        universal: TimedMessage[];
    } = {
        left: [],
        right: [],
        universal: [],
    };

    private messageTimeoutMs = 150;

    private sessionActive: boolean = false;
    private sessionStats: SessionStats = {
        leftReps: 0,
        rightReps: 0,
        totalReps: 0,
        repRecords: [],
        sessionStartTime: null,
        sessionEndTime: null,
        leftErrors: [],
        rightErrors: [],
        universalErrors: [],
    };

    private sessionErrors: {
        left: Set<string>;
        right: Set<string>;
        universal: Set<string>;
    } = {
        left: new Set(),
        right: new Set(),
        universal: new Set(),
    };

    calculateAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
        const radians =
            Math.atan2(c.y - b.y, c.x - b.x) -
            Math.atan2(a.y - b.y, a.x - b.x);
        let angle = Math.abs((radians * 180) / Math.PI);
        if (angle > 180) angle = 360 - angle;
        return angle;
    }

    getStablePoint(point?: Keypoint): Keypoint | undefined {
        if (!point?.name) return point;

        const old = this.stablePointsRef[point.name];

        if ((point.score ?? 0) > 0.2) {
            if (old) {
                point = {
                    ...point,
                    x: old.x * 0.7 + point.x * 0.3,
                    y: old.y * 0.7 + point.y * 0.3,
                };
            }

            this.stablePointsRef[point.name] = point;
            return point;
        }

        return old ?? point;
    }

    updateRepForArm(
        rep: RepState,
        wrist: Keypoint,
        shoulder: Keypoint,
        hip: Keypoint,
        arm: "left" | "right"
    ): { finishedRep: boolean; raiseTime: number; lowerTime: number; errors: string[] } {
        const now = performance.now();
        let vy = 0;

        if (rep.prev) {
            const dy = wrist.y - rep.prev.y;
            const dt = (now - rep.prev.t) / 1000;
            if (dt > 0) vy = dy / dt;
        }

        rep.prev = { y: wrist.y, t: now };

        const inLower = wrist.y >= hip.y - 15;
        const inUpper = wrist.y <= shoulder.y + 20;
        const V = 40;

        let finishedRep = false;
        let raiseTime = 0;
        let lowerTime = 0;
        const errors: string[] = [];

        if (rep.idleStart == null && rep.state === "idle") {
            rep.idleStart = now;
        }

        if (rep.state === "idle" && vy < -V && inLower) {
            const idleTime = rep.idleStart ? (now - rep.idleStart) / 1000 : 0;

            if (idleTime < 0.15) {
                errors.push(`Idle phase too short (${idleTime.toFixed(2)}s)`);
                this.addSessionError(arm, `Idle phase too short (${idleTime.toFixed(2)}s)`);
            }

            rep.state = "raising";
            rep.raiseStart = now;
            rep.idleStart = null;
        }

        if (rep.state === "raising" && inUpper) {
            raiseTime = rep.raiseStart ? (now - rep.raiseStart) / 1000 : 0;
            rep.state = "idle";
            rep.lowerStart = null;
            rep.idleStart = now;
        }

        if (rep.state === "idle" && vy > V && inUpper) {
            const idleTime = rep.idleStart ? (now - rep.idleStart) / 1000 : 0;

            if (idleTime < 0.15) {
                errors.push(`Idle phase too short (${idleTime.toFixed(2)}s)`);
                this.addSessionError(arm, `Idle phase too short (${idleTime.toFixed(2)}s)`);
            }

            rep.state = "lowering";
            rep.lowerStart = now;
            rep.idleStart = null;
        }

        if (rep.state === "lowering" && inLower) {
            lowerTime = rep.lowerStart ? (now - rep.lowerStart) / 1000 : 0;
            raiseTime = rep.raiseStart ? (rep.lowerStart! - rep.raiseStart) / 1000 : 0;

            if (lowerTime < raiseTime * 1.75) {
                errors.push(`Lowering too fast (${lowerTime.toFixed(2)}s / ${raiseTime.toFixed(2)}s)`);
                this.addSessionError(arm, `Lowering too fast (${lowerTime.toFixed(2)}s / ${raiseTime.toFixed(2)}s)`);
            }

            rep.state = "idle";
            rep.idleStart = now;
            finishedRep = true;
        }

        return { finishedRep, raiseTime, lowerTime, errors };
    }

    private addSessionError(arm: "left" | "right", error: string): void {
        if (!this.sessionActive) return;

        if (arm === "left") {
            this.sessionErrors.left.add(error);
        } else {
            this.sessionErrors.right.add(error);
        }
    }

    addUniversalSessionError(error: string): void {
        if (!this.sessionActive) return;
        this.sessionErrors.universal.add(error);
    }

    private addTimedMessage(category: "left" | "right" | "universal", message: string): void {
        const now = performance.now();
        const timedArray = this.timedFeedback[category];

        const existingIndex = timedArray.findIndex(tm => tm.message === message);
        if (existingIndex !== -1) {
            timedArray[existingIndex].timestamp = now;
        } else {
            timedArray.push({ message, timestamp: now });
        }
    }

    private cleanupOldMessages(): void {
        const now = performance.now();

        for (const category of ["left", "right", "universal"] as const) {
            const filtered = this.timedFeedback[category].filter(
                tm => now - tm.timestamp < this.messageTimeoutMs
            );

            if (filtered.length !== this.timedFeedback[category].length) {
                this.timedFeedback[category] = filtered;
            }
        }
    }

    private getCurrentFeedback(): ArmFeedback {
        this.cleanupOldMessages();

        return {
            left: this.timedFeedback.left.map(tm => tm.message),
            right: this.timedFeedback.right.map(tm => tm.message),
            universal: this.timedFeedback.universal.map(tm => tm.message),
        };
    }

    private isWristAndElbowOverlapping(wrist: Keypoint, elbow: Keypoint, shoulder: Keypoint): boolean {
        const distance = Math.sqrt(
            Math.pow(wrist.x - elbow.x, 2) +
            Math.pow(wrist.y - elbow.y, 2)
        );

        const armLength = Math.sqrt(
            Math.pow(shoulder.x - elbow.x, 2) +
            Math.pow(shoulder.y - elbow.y, 2)
        );

        return distance < armLength * 0.15;
    }

    private pushMessages(
        category: "left" | "right" | "universal",
        rules: { condition: boolean; msg: string }[],
        fallback: string
    ): void {
        let hit = false;
        for (const rule of rules) {
            if (rule.condition) {
                this.addTimedMessage(category, rule.msg);
                if (this.sessionActive) {
                    if (category === "universal") {
                        this.sessionErrors.universal.add(rule.msg);
                    } else {
                        this.sessionErrors[category].add(rule.msg);
                    }
                }
                hit = true;
            }
        }
        if (!hit && fallback) {
            this.addTimedMessage(category, fallback);
        }
    }

    analyzeBackSwing(
        leftShoulder: Keypoint | undefined,
        rightShoulder: Keypoint | undefined,
        leftHip: Keypoint | undefined,
        rightHip: Keypoint | undefined
    ): { hasBackSwing: boolean; centerLine: { start: { x: number; y: number }; end: { x: number; y: number } } | null } {
        if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
            return { hasBackSwing: false, centerLine: null };
        }

        const shoulderCenter = {
            x: (leftShoulder.x + rightShoulder.x) / 2,
            y: (leftShoulder.y + rightShoulder.y) / 2,
        };

        const hipCenter = {
            x: (leftHip.x + rightHip.x) / 2,
            y: (leftHip.y + rightHip.y) / 2,
        };

        const torsoShift = Math.abs(shoulderCenter.x - hipCenter.x);
        const bodyWidth = Math.abs(leftShoulder.x - rightShoulder.x);
        const hasBackSwing = torsoShift > bodyWidth * 0.2;

        if (hasBackSwing && this.sessionActive) {
            this.sessionErrors.universal.add("Backswing detected - straighten your back");
        }

        return {
            hasBackSwing,
            centerLine: hasBackSwing ? {
                start: shoulderCenter,
                end: hipCenter,
            } : null,
        };
    }

    startSession(): void {
        this.sessionActive = true;
        this.sessionStats = {
            leftReps: 0,
            rightReps: 0,
            totalReps: 0,
            repRecords: [],
            sessionStartTime: Date.now(),
            sessionEndTime: null,
            leftErrors: [],
            rightErrors: [],
            universalErrors: [],
        };
        this.sessionErrors = {
            left: new Set(),
            right: new Set(),
            universal: new Set(),
        };

        this.repRef.left.repCount = 0;
        this.repRef.right.repCount = 0;
    }

    endSession(): SessionStats {
        this.sessionActive = false;
        this.sessionStats.sessionEndTime = Date.now();

        this.sessionStats.leftErrors = Array.from(this.sessionErrors.left);
        this.sessionStats.rightErrors = Array.from(this.sessionErrors.right);
        this.sessionStats.universalErrors = Array.from(this.sessionErrors.universal);
        this.sessionStats.leftReps = this.repRef.left.repCount;
        this.sessionStats.rightReps = this.repRef.right.repCount;
        this.sessionStats.totalReps = this.repRef.left.repCount + this.repRef.right.repCount;

        return { ...this.sessionStats };
    }

    isSessionActive(): boolean {
        return this.sessionActive;
    }

    getCurrentSessionStats(): SessionStats {
        return {
            ...this.sessionStats,
            leftReps: this.repRef.left.repCount,
            rightReps: this.repRef.right.repCount,
            totalReps: this.repRef.left.repCount + this.repRef.right.repCount,
        };
    }

    getDisplayRepCount(viewMode: ViewMode): { left: number; right: number; total: number } {
        return {
            left: this.repRef.left.repCount,
            right: this.repRef.right.repCount,
            total: this.repRef.left.repCount + this.repRef.right.repCount,
        };
    }

    // 🔴 WICHTIG: Hier ist der korrigierte Return Type mit elbowForwardErrors
    analyzePose(
        pose: { keypoints: Keypoint[] },
        viewMode: ViewMode,
        mirrored: boolean
    ): {
        feedback: ArmFeedback;
        angles: { left: number | null; right: number | null };
        backSwingData: { hasBackSwing: boolean; centerLine: { start: { x: number; y: number }; end: { x: number; y: number } } | null };
        elbowForwardErrors: { left: boolean; right: boolean };  // 🔴 FIXED: Hier war der Fehler!
    } {
        const leftShoulder = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "left_shoulder")
        );
        const leftElbow = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "left_elbow")
        );
        const leftWrist = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "left_wrist")
        );
        const leftHip = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "left_hip")
        );
        const rightShoulder = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "right_shoulder")
        );
        const rightElbow = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "right_elbow")
        );
        const rightWrist = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "right_wrist")
        );
        const rightHip = this.getStablePoint(
            pose.keypoints.find((k) => k.name === "right_hip")
        );

        let leftAngle: number | null = null;
        let rightAngle: number | null = null;
        let leftElbowForwardError = false;
        let rightElbowForwardError = false;

        let backSwingData = { hasBackSwing: false, centerLine: null as { start: { x: number; y: number }; end: { x: number; y: number } } | null };

        if (viewMode === "side") {
            backSwingData = this.analyzeBackSwing(leftShoulder, rightShoulder, leftHip, rightHip);

            if (backSwingData.hasBackSwing) {
                this.addTimedMessage("universal", "Straighten back - avoid swinging");
            }
        }

        const leftOk =
            (leftShoulder?.score ?? 0) > Min_Score * 0.8 &&
            (leftElbow?.score ?? 0) > Min_Score * 0.8 &&
            (leftWrist?.score ?? 0) > Min_Score * 0.8 &&
            (leftHip?.score ?? 0) > Min_Score * 0.8;

        const rightOk =
            (rightShoulder?.score ?? 0) > Min_Score * 0.8 &&
            (rightElbow?.score ?? 0) > Min_Score * 0.8 &&
            (rightWrist?.score ?? 0) > Min_Score * 0.8 &&
            (rightHip?.score ?? 0) > Min_Score * 0.8;

        if (leftOk && leftWrist && leftShoulder && leftHip) {
            const resLeft = this.updateRepForArm(
                this.repRef.left,
                leftWrist,
                leftShoulder,
                leftHip,
                "left"
            );

            if (resLeft.finishedRep && this.sessionActive) {
                this.repRef.left.repCount++;
                this.sessionStats.repRecords.push({
                    arm: "left",
                    repNumber: this.repRef.left.repCount,
                    raiseTime: resLeft.raiseTime,
                    lowerTime: resLeft.lowerTime,
                    errors: resLeft.errors,
                    timestamp: Date.now(),
                });
            }

            resLeft.errors.forEach((e) => {
                this.addTimedMessage("left", e);
                this.addTimedMessage("universal", `Left: ${e}`);
            });
        }

        if (rightOk && rightWrist && rightShoulder && rightHip) {
            const resRight = this.updateRepForArm(
                this.repRef.right,
                rightWrist,
                rightShoulder,
                rightHip,
                "right"
            );

            if (resRight.finishedRep && this.sessionActive) {
                this.repRef.right.repCount++;
                this.sessionStats.repRecords.push({
                    arm: "right",
                    repNumber: this.repRef.right.repCount,
                    raiseTime: resRight.raiseTime,
                    lowerTime: resRight.lowerTime,
                    errors: resRight.errors,
                    timestamp: Date.now(),
                });
            }

            resRight.errors.forEach((e) => {
                this.addTimedMessage("right", e);
                this.addTimedMessage("universal", `Right: ${e}`);
            });
        }

        let sideArm: "left" | "right" | null = null;

        if (viewMode === "side") {
            const leftScore =
                (leftShoulder?.score || 0) + (leftElbow?.score || 0) + (leftWrist?.score || 0);
            const rightScore =
                (rightShoulder?.score || 0) + (rightElbow?.score || 0) + (rightWrist?.score || 0);

            if (leftScore > rightScore && leftOk) sideArm = "left";
            else if (rightOk) sideArm = "right";
        }

        // LEFT ARM Analysis mit elbowForwardError
        if (leftOk && (viewMode === "front" || sideArm === "left")) {
            leftAngle = this.calculateAngle(leftShoulder!, leftElbow!, leftWrist!);

            const isOverlapping = this.isWristAndElbowOverlapping(leftWrist!, leftElbow!, leftShoulder!);

            if (!isOverlapping) {
                const leftWristTooFarUp = leftAngle < 25;

                if (viewMode === "side") {
                    const shoulderX = leftShoulder!.x;
                    const elbowX = leftElbow!.x;
                    const forwardDistance = Math.abs(elbowX - shoulderX);
                    leftElbowForwardError = forwardDistance > 50;
                    if (leftElbowForwardError) {
                        this.addTimedMessage("left", "Elbow too far forward");
                        if (this.sessionActive) {
                            this.sessionErrors.left.add("Elbow too far forward");
                        }
                    }
                }

                if (viewMode === "front") {
                    const bodyWidthLeft = Math.abs(leftShoulder!.x - leftHip!.x);
                    const elbowDistanceLeft = Math.abs(leftElbow!.x - leftShoulder!.x);
                    const elbowTooFarLeft = elbowDistanceLeft > bodyWidthLeft * 1.35;
                    const leftAngleTooWide = leftAngle > 175;

                    this.pushMessages(
                        "left",
                        [
                            { condition: leftWristTooFarUp, msg: "Wrist too far up" },
                            { condition: elbowTooFarLeft, msg: "Elbow too far out" },
                            { condition: leftAngleTooWide, msg: "Arm not straight enough" },
                        ],
                        ""
                    );
                } else if (viewMode === "side") {
                    this.pushMessages(
                        "left",
                        [
                            { condition: leftWristTooFarUp, msg: "Wrist too far up" },
                        ],
                        ""
                    );
                }
            }
        }

        // RIGHT ARM Analysis mit elbowForwardError
        if (rightOk && (viewMode === "front" || sideArm === "right")) {
            rightAngle = this.calculateAngle(rightShoulder!, rightElbow!, rightWrist!);

            const isOverlapping = this.isWristAndElbowOverlapping(rightWrist!, rightElbow!, rightShoulder!);

            if (!isOverlapping) {
                const rightWristTooFarUp = rightAngle < 25;

                if (viewMode === "side") {
                    const shoulderX = rightShoulder!.x;
                    const elbowX = rightElbow!.x;
                    const forwardDistance = Math.abs(elbowX - shoulderX);
                    rightElbowForwardError = forwardDistance > 50;
                    if (rightElbowForwardError) {
                        this.addTimedMessage("right", "Elbow too far forward");
                        if (this.sessionActive) {
                            this.sessionErrors.right.add("Elbow too far forward");
                        }
                    }
                }

                if (viewMode === "front") {
                    const bodyWidthRight = Math.abs(rightShoulder!.x - rightHip!.x);
                    const elbowDistanceRight = Math.abs(rightElbow!.x - rightShoulder!.x);
                    const elbowTooFarRight = elbowDistanceRight > bodyWidthRight * 1.35;
                    const rightAngleTooWide = rightAngle > 175;

                    this.pushMessages(
                        "right",
                        [
                            { condition: rightWristTooFarUp, msg: "Wrist too far up" },
                            { condition: elbowTooFarRight, msg: "Elbow too far out" },
                            { condition: rightAngleTooWide, msg: "Arm not straight enough" },
                        ],
                        ""
                    );
                } else if (viewMode === "side") {
                    this.pushMessages(
                        "right",
                        [
                            { condition: rightWristTooFarUp, msg: "Wrist too far up" },
                        ],
                        ""
                    );
                }
            }
        }

        const currentFeedback = this.getCurrentFeedback();


        return {
            feedback: currentFeedback,
            angles: { left: leftAngle, right: rightAngle },
            backSwingData,
            elbowForwardErrors: { left: leftElbowForwardError, right: rightElbowForwardError },
        };
    }

    resetRepStates(): void {
        this.repRef = {
            left: {
                prev: null,
                state: "idle",
                raiseStart: null,
                lowerStart: null,
                idleStart: null,
                repCount: 0,
            },
            right: {
                prev: null,
                state: "idle",
                raiseStart: null,
                lowerStart: null,
                idleStart: null,
                repCount: 0,
            },
        };

        this.timedFeedback = {
            left: [],
            right: [],
            universal: [],
        };

        this.sessionActive = false;
        this.sessionStats = {
            leftReps: 0,
            rightReps: 0,
            totalReps: 0,
            repRecords: [],
            sessionStartTime: null,
            sessionEndTime: null,
            leftErrors: [],
            rightErrors: [],
            universalErrors: [],
        };
        this.sessionErrors = {
            left: new Set(),
            right: new Set(),
            universal: new Set(),
        };
    }

    getFeedback(): ArmFeedback {
        return this.getCurrentFeedback();
    }

    getSideArm(
        leftShoulder: Keypoint | undefined,
        leftElbow: Keypoint | undefined,
        leftWrist: Keypoint | undefined,
        rightShoulder: Keypoint | undefined,
        rightElbow: Keypoint | undefined,
        rightWrist: Keypoint | undefined
    ): "left" | "right" | null {
        const leftScore =
            (leftShoulder?.score || 0) + (leftElbow?.score || 0) + (leftWrist?.score || 0);
        const rightScore =
            (rightShoulder?.score || 0) + (rightElbow?.score || 0) + (rightWrist?.score || 0);

        if (leftScore > rightScore) return "left";
        if (rightScore > leftScore) return "right";
        return null;
    }
}