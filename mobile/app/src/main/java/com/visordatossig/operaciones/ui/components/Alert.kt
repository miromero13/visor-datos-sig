package com.visordatossig.operaciones.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.ui.theme.Red200
import com.visordatossig.operaciones.ui.theme.Red50
import com.visordatossig.operaciones.ui.theme.Red800
import com.visordatossig.operaciones.ui.theme.Slate200
import com.visordatossig.operaciones.ui.theme.Slate700
import com.visordatossig.operaciones.ui.theme.Slate900

enum class AlertVariant {
    Default,
    Destructive
}

/**
 * Espejo exacto de `frontend/src/Presentation/Components/ui/alert.tsx`
 */
@Composable
fun Alert(
    message: String,
    modifier: Modifier = Modifier,
    title: String? = null,
    variant: AlertVariant = AlertVariant.Default,
    icon: ImageVector? = null
) {
    val bgColor = if (variant == AlertVariant.Destructive) Red50 else Color.White
    val borderColor = if (variant == AlertVariant.Destructive) Red200 else Slate200
    val textColor = if (variant == AlertVariant.Destructive) Red800 else Slate900
    val subTextColor = if (variant == AlertVariant.Destructive) Red800 else Slate700

    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        color = bgColor,
        border = BorderStroke(1.dp, borderColor)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 11.dp),
            verticalAlignment = Alignment.Top,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = textColor,
                    modifier = Modifier.size(18.dp)
                )
            }
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                if (!title.isNullOrBlank()) {
                    Text(
                        text = title,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = textColor
                    )
                }
                Text(
                    text = message,
                    fontSize = 13.sp,
                    color = subTextColor
                )
            }
        }
    }
}
