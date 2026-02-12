import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import CameraFeed from "./assets/Components/Camerafeed.tsx";

function App() {
    return (
        <div>
            <h1>Pose Detection – Test</h1>
            <CameraFeed />
        </div>
    );
}

export default App
