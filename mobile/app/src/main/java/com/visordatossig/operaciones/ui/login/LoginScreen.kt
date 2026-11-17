package com.visordatossig.operaciones.ui.login

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.ui.components.Alert
import com.visordatossig.operaciones.ui.components.AlertVariant
import com.visordatossig.operaciones.ui.components.Brand
import com.visordatossig.operaciones.ui.components.BrandSize
import com.visordatossig.operaciones.ui.components.Button
import com.visordatossig.operaciones.ui.components.ButtonSize
import com.visordatossig.operaciones.ui.components.ButtonVariant
import com.visordatossig.operaciones.ui.components.Card
import com.visordatossig.operaciones.ui.components.Input
import com.visordatossig.operaciones.ui.theme.Blue600
import com.visordatossig.operaciones.ui.theme.Slate100
import com.visordatossig.operaciones.ui.theme.Slate400
import com.visordatossig.operaciones.ui.theme.Slate50
import com.visordatossig.operaciones.ui.theme.Slate500
import com.visordatossig.operaciones.ui.theme.Slate600
import com.visordatossig.operaciones.ui.theme.Slate900

@Composable
fun LoginScreen(
    viewModel: LoginViewModel,
    onLoginSuccess: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    var showPassword by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(true) }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
            .padding(horizontal = 20.dp, vertical = 24.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Logo institucional centrado
            Brand(size = BrandSize.Lg)

            // Tarjeta formulario idéntica a la vista web (LoginPage.tsx panel derecho)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(18.dp),
                contentPadding = PaddingValues(24.dp),
                verticalSpacing = 16.dp
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(
                        text = "Bienvenida",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Blue600,
                        letterSpacing = 0.5.sp
                    )
                    Text(
                        text = "Ingresá a tu espacio",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900,
                        letterSpacing = (-0.5).sp
                    )
                    Text(
                        text = "Usá tus credenciales institucionales para continuar.",
                        fontSize = 13.sp,
                        color = Slate500
                    )
                }

                Spacer(modifier = Modifier.height(2.dp))

                Input(
                    value = state.login,
                    onValueChange = viewModel::onLoginChange,
                    label = "Usuario",
                    placeholder = "Nombre de usuario",
                    leadingIcon = Icons.Outlined.Person
                )

                Input(
                    value = state.password,
                    onValueChange = viewModel::onPasswordChange,
                    label = "Contraseña",
                    placeholder = "Ingresá tu contraseña",
                    visualTransformation = if (showPassword) {
                        VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    leadingIcon = Icons.Outlined.Lock,
                    trailingContent = {
                        IconButton(onClick = { showPassword = !showPassword }) {
                            Icon(
                                imageVector = if (showPassword) {
                                    Icons.Outlined.VisibilityOff
                                } else {
                                    Icons.Outlined.Visibility
                                },
                                contentDescription = "Mostrar contraseña",
                                tint = Slate500
                            )
                        }
                    }
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Checkbox(
                        checked = rememberMe,
                        onCheckedChange = { rememberMe = it },
                        colors = CheckboxDefaults.colors(
                            checkedColor = Blue600,
                            checkmarkColor = Slate50
                        )
                    )
                    Text(
                        text = "Mantener sesión iniciada",
                        fontSize = 13.sp,
                        color = Slate600
                    )
                }

                if (state.errorMessage != null) {
                    Alert(
                        title = "Error de autenticación",
                        message = state.errorMessage ?: "",
                        variant = AlertVariant.Destructive
                    )
                }

                Button(
                    text = if (state.isSubmitting) "Ingresando…" else "Ingresar al sistema →",
                    onClick = { viewModel.submitLogin(onLoginSuccess) },
                    modifier = Modifier.fillMaxWidth(),
                    variant = ButtonVariant.PrimaryBlue,
                    size = ButtonSize.Lg,
                    loading = state.isSubmitting,
                    enabled = !state.isSubmitting
                )

                HorizontalDivider(
                    color = Slate100,
                    thickness = 1.dp,
                    modifier = Modifier.padding(top = 8.dp)
                )

                Text(
                    text = "¿No podés ingresar? Contactá al administrador del sistema.",
                    fontSize = 11.sp,
                    color = Slate500,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            Text(
                text = "© 2026 · Sistema de Información Geográfica",
                fontSize = 11.sp,
                color = Slate400,
                textAlign = TextAlign.Center
            )
        }
    }
}
