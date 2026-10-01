import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ProfilePage } from "./pages/ProfilePage";
import { MigrationPage } from "./pages/MigrationPage";
import { AuthProvider } from "./components/AuthProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";

export function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
				<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
				<Route path="/migration" element={<ProtectedRoute><MigrationPage /></ProtectedRoute>} />
				<Route path="*" element={<LandingPage />} />
			</Routes>
		</AuthProvider>
	);
}
