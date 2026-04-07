import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import HomePage from "./assets/Components/HomePage";
import CameraFeed from "./assets/Components/Camerafeed";
import LoginPage from "./assets/Components/LoginPage";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/curls" element={<CameraFeed />} />
            </Routes>
        </Router>
    );
}

export default App;