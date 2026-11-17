package com.visordatossig.operaciones.ui.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.visordatossig.operaciones.core.datastore.SessionPreferences
import com.visordatossig.operaciones.data.repository.OperacionesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val login: String = "",
    val password: String = "",
    val serverUrl: String = SessionPreferences.DEFAULT_BASE_URL,
    val showServerConfig: Boolean = false,
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repository: OperacionesRepository,
    private val sessionPreferences: SessionPreferences
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val snapshot = sessionPreferences.getSessionSnapshot()
            _uiState.update { it.copy(serverUrl = snapshot.serverBaseUrl) }
        }
        viewModelScope.launch {
            sessionPreferences.sessionExpiredEvent.collect { expired ->
                if (expired) {
                    sessionPreferences.consumeSessionExpiredNotice()
                    _uiState.update {
                        it.copy(errorMessage = "Tu sesión ha expirado. Por favor, ingresá nuevamente.")
                    }
                }
            }
        }
    }

    fun onLoginChange(value: String) {
        _uiState.update { it.copy(login = value, errorMessage = null) }
    }

    fun onPasswordChange(value: String) {
        _uiState.update { it.copy(password = value, errorMessage = null) }
    }

    fun onServerUrlChange(value: String) {
        _uiState.update { it.copy(serverUrl = value, errorMessage = null) }
    }

    fun toggleServerConfig() {
        _uiState.update { it.copy(showServerConfig = !it.showServerConfig) }
    }

    fun submitLogin(onSuccess: () -> Unit) {
        val current = _uiState.value
        if (current.login.isBlank() || current.password.isBlank()) {
            _uiState.update { it.copy(errorMessage = "Ingresá tu usuario y contraseña para continuar.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            val result = repository.login(
                login = current.login,
                password = current.password,
                serverUrl = current.serverUrl
            )
            result.fold(
                onSuccess = {
                    _uiState.update { it.copy(isSubmitting = false) }
                    onSuccess()
                },
                onFailure = { err ->
                    _uiState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = err.message ?: "No fue posible iniciar sesión. Verificá las credenciales o la URL del servidor."
                        )
                    }
                }
            )
        }
    }
}
