import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./assets/Components/HomePage";
import CameraFeed from "./assets/Components/Camerafeed";
import LoginPage from "./assets/Components/LoginPage";
import RegisterPage from "./assets/Components/RegisterPage";
import ProgressPage from "./assets/Components/ProgressPage.tsx";
function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/curls" element={<CameraFeed />} />
                <Route path="/progress" element={<ProgressPage />} />
            </Routes>
        </Router>
    );
}

export default App;