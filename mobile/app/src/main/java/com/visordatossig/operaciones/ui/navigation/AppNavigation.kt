package com.visordatossig.operaciones.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.visordatossig.operaciones.core.datastore.SessionPreferences
import com.visordatossig.operaciones.ui.login.LoginScreen
import com.visordatossig.operaciones.ui.login.LoginViewModel
import com.visordatossig.operaciones.ui.profile.ProfileScreen
import com.visordatossig.operaciones.ui.profile.ProfileViewModel
import com.visordatossig.operaciones.ui.taskdetail.TaskDetailScreen
import com.visordatossig.operaciones.ui.taskdetail.TaskDetailViewModel
import com.visordatossig.operaciones.ui.tasklist.TaskListScreen
import com.visordatossig.operaciones.ui.tasklist.TaskListViewModel

object Routes {
    const val LOGIN = "login"
    const val TASK_LIST = "tasks"
    const val TASK_DETAIL = "tasks/{idDetalle}"
    const val PROFILE = "profile"

    fun taskDetail(idDetalle: Int) = "tasks/$idDetalle"
}

@Composable
fun AppNavigation(sessionPreferences: SessionPreferences) {
    val navController = rememberNavController()
    val session by sessionPreferences.sessionFlow.collectAsState(initial = null)

    // Redirección automática inmediata al Login si la sesión se cierra o el token expira
    LaunchedEffect(session?.accessToken) {
        val token = session?.accessToken
        if (token != null && token.isBlank()) {
            val currentRoute = navController.currentBackStackEntry?.destination?.route
            if (currentRoute != null && currentRoute != Routes.LOGIN) {
                navController.navigate(Routes.LOGIN) {
                    popUpTo(0) { inclusive = true }
                }
            }
        }
    }

    val startDestination = if (!session?.accessToken.isNullOrBlank()) {
        Routes.TASK_LIST
    } else {
        Routes.LOGIN
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Routes.LOGIN) {
            val viewModel: LoginViewModel = hiltViewModel()
            LoginScreen(
                viewModel = viewModel,
                onLoginSuccess = {
                    navController.navigate(Routes.TASK_LIST) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.TASK_LIST) {
            val viewModel: TaskListViewModel = hiltViewModel()
            TaskListScreen(
                viewModel = viewModel,
                onSelectTask = { idDetalle ->
                    navController.navigate(Routes.taskDetail(idDetalle))
                },
                onNavigateToProfile = {
                    navController.navigate(Routes.PROFILE)
                }
            )
        }

        composable(Routes.PROFILE) {
            val viewModel: ProfileViewModel = hiltViewModel()
            ProfileScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() },
                onLoggedOut = {
                    navController.navigate(Routes.LOGIN) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = Routes.TASK_DETAIL,
            arguments = listOf(navArgument("idDetalle") { type = NavType.IntType })
        ) {
            val viewModel: TaskDetailViewModel = hiltViewModel()
            TaskDetailScreen(
                viewModel = viewModel,
                onNavigateBack = { navController.popBackStack() }
            )
        }
    }
}
