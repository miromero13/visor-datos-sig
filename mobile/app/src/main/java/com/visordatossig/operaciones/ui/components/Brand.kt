package com.visordatossig.operaciones.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.visordatossig.operaciones.ui.theme.BrandBlue
import com.visordatossig.operaciones.ui.theme.BrandNavy
import com.visordatossig.operaciones.ui.theme.Sky300
import com.visordatossig.operaciones.ui.theme.Slate900

enum class BrandSize { Md, Lg }

/**
 * Espejo exacto de `frontend/src/Presentation/Components/Brand.tsx`
 */
@Composable
fun Brand(
    modifier: Modifier = Modifier,
    light: Boolean = false,
    size: BrandSize = BrandSize.Md
) {
    val isLg = size == BrandSize.Lg
    val outerBoxSize = if (isLg) 30.dp else 26.dp
    val outerCorner = if (isLg) 8.dp else 7.dp
    val innerBoxSize = if (isLg) 14.dp else 12.dp

    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Box(
            modifier = Modifier
                .size(outerBoxSize)
                .rotate(-7f)
                .background(
                    color = if (light) Color.White else BrandNavy,
                    shape = RoundedCornerShape(outerCorner)
                ),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(innerBoxSize)
                    .rotate(7f)
                    .border(
                        width = 2.dp,
                        color = if (light) Slate900 else Sky300,
                        shape = RoundedCornerShape(3.dp)
                    )
            )
        }

        Text(
            text = buildAnnotatedString {
                withStyle(
                    SpanStyle(
                        color = if (light) Color.White else BrandNavy,
                        fontWeight = FontWeight.Bold
                    )
                ) {
                    append("VisorDatos")
                }
                withStyle(
                    SpanStyle(
                        color = BrandBlue,
                        fontWeight = FontWeight.Bold
                    )
                ) {
                    append("SIG")
                }
            },
            fontSize = if (isLg) 18.sp else 15.sp,
            letterSpacing = (-0.5).sp
        )
    }
}
