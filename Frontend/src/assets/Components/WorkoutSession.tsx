// WorkoutSession.tsx
import React, { useState, useRef, useEffect } from 'react';
import { CurlTracker } from './CurlTracker';
import { InMemoryVideoRecording } from './InMemeoryVideoRecording';

export const WorkoutSession: React.FC = () => {
    const [tracker] = useState(() => new CurlTracker());
    const [recording] = useState(() => new InMemoryVideoRecording());
    const [isActive, setIsActive] = useState(false);
    const [errorClips, setErrorClips] = useState<Array<{
        error: string;
        arm?: "left" | "right";
        videoUrl: string;
    }>>([]);
    const [selectedClip, setSelectedClip] = useState<string | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const fullRecordingRef = useRef<Blob | null>(null);

    const startSession = async () => {
        if (!videoRef.current) return;

        tracker.startSession();
        tracker.resetErrorTimestamps();
        await recording.startRecording(videoRef.current);
        setIsActive(true);
        setErrorClips([]);
    };

    const endSession = async () => {
        setIsActive(false);

        // Stop recording and get full video
        const fullVideo = await recording.stopRecording();
        fullRecordingRef.current = fullVideo;

        // Get error clips
        const sessionStart = tracker.getCurrentSessionStats().sessionStartTime!;
        const clips = tracker.getErrorClips(sessionStart);

        // Extract video clips for each error
        const clipsWithVideo = await Promise.all(
            clips.map(async (clip) => {
                try {
                    const clipBlob = await recording.extractClip(
                        fullVideo,
                        clip.startTime,
                        clip.endTime
                    );
                    const videoUrl = URL.createObjectURL(clipBlob);
                    return {
                        error: clip.error,
                        arm: clip.arm,
                        videoUrl
                    };
                } catch (error) {
                    console.error('Failed to extract clip:', error);
                    return null;
                }
            })
        );

        setErrorClips(clipsWithVideo.filter(c => c !== null));

        // End session and get stats
        const stats = tracker.endSession();
        console.log('Session stats:', stats);
    };

    // Cleanup object URLs when component unmounts
    useEffect(() => {
        return () => {
            errorClips.forEach(clip => URL.revokeObjectURL(clip.videoUrl));
            if (fullRecordingRef.current) {
                URL.revokeObjectURL(URL.createObjectURL(fullRecordingRef.current));
            }
        };
    }, [errorClips]);

    return (
        <div className="workout-session">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="camera-feed"
            />

            {!isActive && errorClips.length === 0 && (
                <button onClick={startSession}>Start Workout</button>
            )}

            {isActive && (
                <div>
                    <button onClick={endSession}>End Session</button>
                    <div className="live-feedback">
                        {/* Your existing feedback display */}
                    </div>
                </div>
            )}

            {errorClips.length > 0 && !isActive && (
                <div className="session-summary">
                    <h2>Session Complete! 🎉</h2>

                    <div className="stats">
                        <p>Total Reps: {tracker.getCurrentSessionStats().totalReps}</p>
                        <p>Left Arm: {tracker.getCurrentSessionStats().leftReps}</p>
                        <p>Right Arm: {tracker.getCurrentSessionStats().rightReps}</p>
                    </div>

                    {errorClips.length > 0 && (
                        <div className="error-videos">
                            <h3>Watch Your Form Errors:</h3>
                            <div className="videos-grid">
                                {errorClips.map((clip, idx) => (
                                    <div key={idx} className="video-card">
                                        <p className="error-name">{clip.error}</p>
                                        {clip.arm && <span className="arm-badge">{clip.arm}</span>}
                                        <video
                                            src={clip.videoUrl}
                                            controls
                                            className="error-video"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {fullRecordingRef.current && (
                        <div className="full-recording">
                            <h3>Full Session Recording:</h3>
                            <video
                                src={URL.createObjectURL(fullRecordingRef.current)}
                                controls
                                className="full-video"
                            />
                        </div>
                    )}

                    <button onClick={() => {
                        // Cleanup and reset
                        errorClips.forEach(clip => URL.revokeObjectURL(clip.videoUrl));
                        setErrorClips([]);
                        fullRecordingRef.current = null;
                        tracker.resetRepStates();
                        tracker.resetErrorTimestamps();
                    }}>
                        Start New Session
                    </button>
                </div>
            )}
        </div>
    );
};