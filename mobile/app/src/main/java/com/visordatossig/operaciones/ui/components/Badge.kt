package com.visordatossig.operaciones.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.ui.theme.Amber100
import com.visordatossig.operaciones.ui.theme.Amber50
import com.visordatossig.operaciones.ui.theme.Amber700
import com.visordatossig.operaciones.ui.theme.Blue100
import com.visordatossig.operaciones.ui.theme.Blue50
import com.visordatossig.operaciones.ui.theme.Blue700
import com.visordatossig.operaciones.ui.theme.Emerald100
import com.visordatossig.operaciones.ui.theme.Emerald50
import com.visordatossig.operaciones.ui.theme.Emerald700
import com.visordatossig.operaciones.ui.theme.Orange100
import com.visordatossig.operaciones.ui.theme.Orange50
import com.visordatossig.operaciones.ui.theme.Orange700
import com.visordatossig.operaciones.ui.theme.Red200
import com.visordatossig.operaciones.ui.theme.Red50
import com.visordatossig.operaciones.ui.theme.Red700
import com.visordatossig.operaciones.ui.theme.Slate100
import com.visordatossig.operaciones.ui.theme.Slate200
import com.visordatossig.operaciones.ui.theme.Slate700

enum class BadgeVariant {
    Neutral,
    Blue,
    Success,
    Warning,
    Amber,
    Destructive
}

@Composable
fun Badge(
    text: String,
    modifier: Modifier = Modifier,
    variant: BadgeVariant = BadgeVariant.Neutral
) {
    val (bg, border, fg) = when (variant) {
        BadgeVariant.Neutral -> Triple(Slate100, Slate200, Slate700)
        BadgeVariant.Blue -> Triple(Blue50, Blue100, Blue700)
        BadgeVariant.Success -> Triple(Emerald50, Emerald100, Emerald700)
        BadgeVariant.Warning -> Triple(Orange50, Orange100, Orange700)
        BadgeVariant.Amber -> Triple(Amber50, Amber100, Amber700)
        BadgeVariant.Destructive -> Triple(Red50, Red200, Red700)
    }

    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(999.dp),
        color = bg,
        border = BorderStroke(1.dp, border)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = fg
        )
    }
}
