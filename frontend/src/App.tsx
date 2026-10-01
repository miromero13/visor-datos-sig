import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";

export function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
				<Route path="*" element={<LandingPage />} />
			</Routes>
		</AuthProvider>
	);
}
