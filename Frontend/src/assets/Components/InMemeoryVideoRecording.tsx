
export class InMemoryVideoRecording {
    private mediaRecorder: MediaRecorder | null = null;
    private recordedChunks: Blob[] = [];
    private sessionStartTime: number = 0;

    async startRecording(videoElement: HTMLVideoElement): Promise<void> {
        this.sessionStartTime = Date.now();
        this.recordedChunks = [];

        const stream = videoElement.srcObject as MediaStream;
        if (!stream) throw new Error('No video stream available');

        const mimeType = this.getSupportedMimeType();
        this.mediaRecorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 2500000
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.recordedChunks.push(event.data);
            }
        };

        this.mediaRecorder.start(1000);
    }

    async stopRecording(): Promise<Blob> {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve(new Blob());
                return;
            }

            this.mediaRecorder.onstop = () => {
                const fullBlob = new Blob(this.recordedChunks, {
                    type: this.getSupportedMimeType()
                });
                resolve(fullBlob);
            };

            this.mediaRecorder.stop();
            this.mediaRecorder = null;
        });
    }

    async extractClip(fullVideoBlob: Blob, startTime: number, endTime: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            const url = URL.createObjectURL(fullVideoBlob);
            video.src = url;

            video.onloadedmetadata = async () => {
                const startSec = startTime / 1000;
                const durationSec = (endTime - startTime) / 1000;

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext('2d');

                video.currentTime = startSec;

                video.onseeked = async () => {
                    const stream = canvas.captureStream(30);
                    const recorder = new MediaRecorder(stream, {
                        mimeType: this.getSupportedMimeType()
                    });

                    const chunks: Blob[] = [];
                    recorder.ondataavailable = (e) => {
                        if (e.data.size > 0) chunks.push(e.data);
                    };

                    recorder.start();

                    const drawFrame = () => {
                        if (!video.paused && !video.ended) {
                            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                            requestAnimationFrame(drawFrame);
                        }
                    };

                    video.play();
                    drawFrame();

                    setTimeout(() => {
                        recorder.stop();
                        video.pause();

                        recorder.onstop = () => {
                            const clipBlob = new Blob(chunks, { type: this.getSupportedMimeType() });
                            URL.revokeObjectURL(url);
                            resolve(clipBlob);
                        };
                    }, durationSec * 1000);
                };
            };

            video.onerror = reject;
        });
    }

    private getSupportedMimeType(): string {
        const types = ['video/webm', 'video/mp4'];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'video/webm';
    }
}