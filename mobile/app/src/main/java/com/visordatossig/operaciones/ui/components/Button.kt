package com.visordatossig.operaciones.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.ui.theme.Blue600
import com.visordatossig.operaciones.ui.theme.Red600
import com.visordatossig.operaciones.ui.theme.Slate100
import com.visordatossig.operaciones.ui.theme.Slate200
import com.visordatossig.operaciones.ui.theme.Slate800
import com.visordatossig.operaciones.ui.theme.Slate900

enum class ButtonVariant {
    Default,
    PrimaryBlue,
    Destructive,
    Outline,
    Secondary,
    Ghost,
    Link
}

enum class ButtonSize {
    Default,
    Xs,
    Sm,
    Lg,
    Icon
}

/**
 * Espejo exacto de `frontend/src/Presentation/Components/ui/button.tsx`
 */
@Composable
fun Button(
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: ButtonVariant = ButtonVariant.Default,
    size: ButtonSize = ButtonSize.Default,
    enabled: Boolean = true,
    loading: Boolean = false,
    text: String? = null,
    content: (@Composable RowScope.() -> Unit)? = null
) {
    val containerColor = when (variant) {
        ButtonVariant.Default -> Slate900
        ButtonVariant.PrimaryBlue -> Blue600
        ButtonVariant.Destructive -> Red600
        ButtonVariant.Outline -> Color.White
        ButtonVariant.Secondary -> Slate100
        ButtonVariant.Ghost, ButtonVariant.Link -> Color.Transparent
    }

    val contentColor = when (variant) {
        ButtonVariant.Default, ButtonVariant.PrimaryBlue, ButtonVariant.Destructive -> Color.White
        ButtonVariant.Outline, ButtonVariant.Secondary, ButtonVariant.Ghost -> Slate800
        ButtonVariant.Link -> Blue600
    }

    val border = when (variant) {
        ButtonVariant.Outline -> BorderStroke(1.dp, Slate200)
        else -> null
    }

    val minHeight = when (size) {
        ButtonSize.Xs -> 28.dp
        ButtonSize.Sm -> 34.dp
        ButtonSize.Default -> 40.dp
        ButtonSize.Lg -> 46.dp
        ButtonSize.Icon -> 40.dp
    }

    val padding = when (size) {
        ButtonSize.Xs -> PaddingValues(horizontal = 10.dp, vertical = 4.dp)
        ButtonSize.Sm -> PaddingValues(horizontal = 12.dp, vertical = 6.dp)
        ButtonSize.Default -> PaddingValues(horizontal = 16.dp, vertical = 8.dp)
        ButtonSize.Lg -> PaddingValues(horizontal = 20.dp, vertical = 12.dp)
        ButtonSize.Icon -> PaddingValues(0.dp)
    }

    androidx.compose.material3.Button(
        onClick = onClick,
        enabled = enabled && !loading,
        modifier = modifier.defaultMinSize(minHeight = minHeight),
        shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = containerColor,
            contentColor = contentColor,
            disabledContainerColor = containerColor.copy(alpha = 0.5f),
            disabledContentColor = contentColor.copy(alpha = 0.7f)
        ),
        border = border,
        contentPadding = padding,
        elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(16.dp),
                    strokeWidth = 2.dp,
                    color = contentColor
                )
            }
            if (text != null) {
                Text(
                    text = text,
                    fontSize = if (size == ButtonSize.Xs) 12.sp else 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
            content?.invoke(this)
        }
    }
}
