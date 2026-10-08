import { Route, Routes } from "react-router-dom";
import { LandingPage } from "./Presentation/Pages/LandingPage";
import { LoginPage } from "./Presentation/Pages/LoginPage";
import { DashboardPage } from "./Presentation/Pages/DashboardPage";
import { ProfilePage } from "./Presentation/Pages/ProfilePage";
import { MigrationPage } from "./Presentation/Pages/MigrationPage";
import { MapPage } from "./Presentation/Pages/MapPage";
import { QueriesPage } from "./Presentation/Pages/QueriesPage";
import { UsersPage } from "./Presentation/Pages/UsersPage";
import { AuthProvider } from "./Presentation/Components/AuthProvider";
import { ProtectedRoute } from "./Presentation/Components/ProtectedRoute";

export function App() {
	return (
		<AuthProvider>
			<Routes>
				<Route path="/" element={<LandingPage />} />
				<Route path="/login" element={<LoginPage />} />
				<Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
				<Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
				<Route path="/migration" element={<ProtectedRoute><MigrationPage /></ProtectedRoute>} />
				<Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
				<Route path="/queries" element={<ProtectedRoute><QueriesPage /></ProtectedRoute>} />
				<Route path="/admin/users" element={<ProtectedRoute><UsersPage /></ProtectedRoute>} />
				<Route path="*" element={<LandingPage />} />
			</Routes>
		</AuthProvider>
	);
}
