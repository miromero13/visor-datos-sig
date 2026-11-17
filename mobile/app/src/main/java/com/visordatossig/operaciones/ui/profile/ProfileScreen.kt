package com.visordatossig.operaciones.ui.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.ui.components.Alert
import com.visordatossig.operaciones.ui.components.AlertVariant
import com.visordatossig.operaciones.ui.components.Badge
import com.visordatossig.operaciones.ui.components.BadgeVariant
import com.visordatossig.operaciones.ui.components.Button
import com.visordatossig.operaciones.ui.components.ButtonSize
import com.visordatossig.operaciones.ui.components.ButtonVariant
import com.visordatossig.operaciones.ui.components.Card
import com.visordatossig.operaciones.ui.components.Input
import com.visordatossig.operaciones.ui.theme.Blue50
import com.visordatossig.operaciones.ui.theme.Blue600
import com.visordatossig.operaciones.ui.theme.Slate100
import com.visordatossig.operaciones.ui.theme.Slate200
import com.visordatossig.operaciones.ui.theme.Slate50
import com.visordatossig.operaciones.ui.theme.Slate500
import com.visordatossig.operaciones.ui.theme.Slate900

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,
    onNavigateBack: () -> Unit,
    onLoggedOut: () -> Unit
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    var showCurrentPassword by remember { mutableStateOf(false) }
    var showNewPassword by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White)
    ) {
        // Barra superior con botón volver y título
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White)
                .padding(horizontal = 8.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onNavigateBack) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                    contentDescription = "Volver",
                    tint = Slate900
                )
            }
            Text(
                text = "Mi Perfil",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = Slate900,
                modifier = Modifier.padding(start = 4.dp)
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Tarjeta con datos del usuario
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                contentPadding = PaddingValues(16.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    val initial = state.name.trim().firstOrNull()?.uppercase() ?: "U"
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(Blue50)
                            .border(1.5.dp, Blue600, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = initial,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold,
                            color = Blue600
                        )
                    }

                    Column(
                        modifier = Modifier.weight(1f),
                        verticalArrangement = Arrangement.spacedBy(2.dp)
                    ) {
                        Text(
                            text = state.name,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Slate900
                        )
                        Text(
                            text = "@${state.login}",
                            fontSize = 13.sp,
                            color = Slate500
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Badge(
                            text = state.role.ifBlank { "Operador" },
                            variant = BadgeVariant.Blue
                        )
                    }
                }
            }

            // Tarjeta para cambiar contraseña (igual que en la web)
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                contentPadding = PaddingValues(16.dp),
                verticalSpacing = 12.dp
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        text = "Cambiar contraseña",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = Slate900
                    )
                    Text(
                        text = "Elegí una contraseña nueva de al menos 8 caracteres.",
                        fontSize = 12.sp,
                        color = Slate500
                    )
                }

                Input(
                    value = state.currentPassword,
                    onValueChange = viewModel::onCurrentPasswordChange,
                    label = "Contraseña actual",
                    placeholder = "••••••••",
                    visualTransformation = if (showCurrentPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    leadingIcon = Icons.Outlined.Lock,
                    trailingContent = {
                        IconButton(onClick = { showCurrentPassword = !showCurrentPassword }) {
                            Icon(
                                imageVector = if (showCurrentPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = null,
                                tint = Slate500
                            )
                        }
                    }
                )

                Input(
                    value = state.newPassword,
                    onValueChange = viewModel::onNewPasswordChange,
                    label = "Nueva contraseña",
                    placeholder = "••••••••",
                    visualTransformation = if (showNewPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    leadingIcon = Icons.Outlined.Lock,
                    trailingContent = {
                        IconButton(onClick = { showNewPassword = !showNewPassword }) {
                            Icon(
                                imageVector = if (showNewPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                                contentDescription = null,
                                tint = Slate500
                            )
                        }
                    }
                )

                Input(
                    value = state.repeatPassword,
                    onValueChange = viewModel::onRepeatPasswordChange,
                    label = "Repetir nueva contraseña",
                    placeholder = "••••••••",
                    visualTransformation = if (showNewPassword) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    leadingIcon = Icons.Outlined.Lock
                )

                if (state.errorMessage != null) {
                    Alert(
                        title = "Error",
                        message = state.errorMessage ?: "",
                        variant = AlertVariant.Destructive
                    )
                }

                if (state.successMessage != null) {
                    Alert(
                        title = "Listo",
                        message = state.successMessage ?: "",
                        variant = AlertVariant.Default
                    )
                }

                Button(
                    text = if (state.isSubmitting) "Guardando…" else "Guardar contraseña",
                    onClick = viewModel::changePassword,
                    modifier = Modifier.fillMaxWidth(),
                    variant = ButtonVariant.PrimaryBlue,
                    size = ButtonSize.Lg,
                    loading = state.isSubmitting,
                    enabled = !state.isSubmitting
                )
            }

            // Botón para cerrar sesión con color rojizo destructivo
            Button(
                text = "Cerrar sesión",
                onClick = { viewModel.logout(context, onLoggedOut) },
                modifier = Modifier.fillMaxWidth(),
                variant = ButtonVariant.Destructive,
                size = ButtonSize.Lg
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Outlined.Logout,
                    contentDescription = null,
                    modifier = Modifier.size(17.dp)
                )
            }
        }
    }
}
