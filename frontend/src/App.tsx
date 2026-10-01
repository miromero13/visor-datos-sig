import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { ShapefileSourcePage } from "./pages/ShapefileSourcePage";

export function App() {
	return (
		<Routes>
			<Route path="/" element={<LandingPage />} />
			<Route path="/login" element={<LoginPage />} />
			<Route path="/sources" element={<ShapefileSourcePage />} />
			<Route path="*" element={<LandingPage />} />
		</Routes>
	);
}
