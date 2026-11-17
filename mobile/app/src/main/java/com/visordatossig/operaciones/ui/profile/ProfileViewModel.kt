package com.visordatossig.operaciones.ui.profile

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.visordatossig.operaciones.core.datastore.SessionPreferences
import com.visordatossig.operaciones.data.repository.OperacionesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ProfileUiState(
    val name: String = "",
    val login: String = "",
    val role: String = "",
    val currentPassword: String = "",
    val newPassword: String = "",
    val repeatPassword: String = "",
    val isSubmitting: Boolean = false,
    val successMessage: String? = null,
    val errorMessage: String? = null
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: OperacionesRepository,
    private val sessionPreferences: SessionPreferences
) : ViewModel() {

    private val formState = MutableStateFlow(FormFields())

    private data class FormFields(
        val currentPassword: String = "",
        val newPassword: String = "",
        val repeatPassword: String = "",
        val isSubmitting: Boolean = false,
        val successMessage: String? = null,
        val errorMessage: String? = null
    )

    val uiState: StateFlow<ProfileUiState> = combine(
        sessionPreferences.sessionFlow,
        formState
    ) { session, form ->
        ProfileUiState(
            name = session.name.ifBlank { session.login },
            login = session.login,
            role = session.role,
            currentPassword = form.currentPassword,
            newPassword = form.newPassword,
            repeatPassword = form.repeatPassword,
            isSubmitting = form.isSubmitting,
            successMessage = form.successMessage,
            errorMessage = form.errorMessage
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = ProfileUiState()
    )

    fun onCurrentPasswordChange(value: String) {
        formState.update { it.copy(currentPassword = value, errorMessage = null, successMessage = null) }
    }

    fun onNewPasswordChange(value: String) {
        formState.update { it.copy(newPassword = value, errorMessage = null, successMessage = null) }
    }

    fun onRepeatPasswordChange(value: String) {
        formState.update { it.copy(repeatPassword = value, errorMessage = null, successMessage = null) }
    }

    fun changePassword() {
        val form = formState.value
        if (form.currentPassword.isBlank()) {
            formState.update { it.copy(errorMessage = "Ingresá tu contraseña actual.") }
            return
        }
        if (form.newPassword.length < 8) {
            formState.update { it.copy(errorMessage = "La nueva contraseña debe tener al menos 8 caracteres.") }
            return
        }
        if (form.newPassword != form.repeatPassword) {
            formState.update { it.copy(errorMessage = "Las contraseñas nuevas no coinciden.") }
            return
        }

        viewModelScope.launch {
            formState.update { it.copy(isSubmitting = true, errorMessage = null, successMessage = null) }
            val result = repository.changePassword(form.currentPassword, form.newPassword)
            result.fold(
                onSuccess = {
                    formState.update {
                        it.copy(
                            isSubmitting = false,
                            currentPassword = "",
                            newPassword = "",
                            repeatPassword = "",
                            successMessage = "Tu contraseña se cambió correctamente.",
                            errorMessage = null
                        )
                    }
                },
                onFailure = { err ->
                    formState.update {
                        it.copy(
                            isSubmitting = false,
                            errorMessage = err.message ?: "No se pudo cambiar la contraseña."
                        )
                    }
                }
            )
        }
    }

    fun logout(context: Context, onLoggedOut: () -> Unit) {
        viewModelScope.launch {
            repository.logout()
            onLoggedOut()
        }
    }
}
