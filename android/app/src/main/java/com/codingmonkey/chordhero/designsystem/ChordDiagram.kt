package com.codingmonkey.chordhero.designsystem

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.matchParentSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.codingmonkey.chordhero.domain.ChordDefinition
import com.codingmonkey.chordhero.domain.PracticeRules

@Composable
fun ChordDiagram(
    chord: ChordDefinition,
    modifier: Modifier = Modifier,
    highlights: Map<Pair<Int, Int>, Color> = emptyMap(),
) {
    val lineColor = MaterialTheme.colorScheme.onSurface
    val dotColor = MaterialTheme.colorScheme.primary
    val baseFret = PracticeRules.baseFret(chord)
    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(1.15f)
            .semantics {
                contentDescription = buildString {
                    append("${chord.name} chord diagram. ")
                    chord.frets.forEachIndexed { index, fret ->
                        append("String ${index + 1} ${if (fret < 0) "muted" else if (fret == 0) "open" else "fret $fret"}. ")
                    }
                }
            },
    ) {
        Canvas(Modifier.matchParentSize().padding(26.dp)) {
            val left = size.width * .12f
            val top = size.height * .12f
            val width = size.width * .76f
            val height = size.height * .72f
            repeat(6) { string ->
                val x = left + string * width / 5
                drawLine(lineColor, Offset(x, top), Offset(x, top + height), strokeWidth = 2f)
            }
            repeat(6) { fret ->
                val y = top + fret * height / 5
                drawLine(lineColor, Offset(left, y), Offset(left + width, y), strokeWidth = if (fret == 0) 5f else 2f)
            }
            chord.barre?.let { barre ->
                val row = (barre.fret - baseFret).coerceIn(0, 4)
                val startX = left + barre.from * width / 5
                val endX = left + barre.to * width / 5
                val y = top + (row + .5f) * height / 5
                drawLine(dotColor, Offset(startX, y), Offset(endX, y), strokeWidth = 15f)
            }
            chord.frets.forEachIndexed { string, fret ->
                val x = left + string * width / 5
                val textPaint = android.graphics.Paint().apply {
                    color = lineColor.toArgb()
                    textSize = 28f
                    textAlign = android.graphics.Paint.Align.CENTER
                }
                when {
                    fret < 0 -> drawContext.canvas.nativeCanvas.drawText("×", x, top - 12f, textPaint)
                    fret == 0 -> drawCircle(lineColor, 7f, Offset(x, top - 18f), style = Stroke(3f))
                    else -> {
                        val row = (fret - baseFret).coerceIn(0, 4)
                        val center = Offset(x, top + (row + .5f) * height / 5)
                        drawCircle(highlights[string to fret] ?: dotColor, 12f, center)
                        chord.fingers.getOrNull(string)?.let { finger ->
                            val fingerPaint = android.graphics.Paint().apply {
                                color = Color.White.toArgb()
                                textSize = 18f
                                textAlign = android.graphics.Paint.Align.CENTER
                            }
                            drawContext.canvas.nativeCanvas.drawText(finger.toString(), center.x, center.y + 6f, fingerPaint)
                        }
                    }
                }
            }
            if (baseFret > 1) {
                val paint = android.graphics.Paint().apply {
                    color = lineColor.toArgb()
                    textSize = 22f
                }
                drawContext.canvas.nativeCanvas.drawText("${baseFret}fr", 0f, top + height / 10, paint)
            }
        }
        Text(chord.name, style = MaterialTheme.typography.titleLarge, modifier = Modifier.align(Alignment.TopCenter))
    }
}

private fun Color.toArgb(): Int =
    (alpha * 255).toInt().shl(24) or
        (red * 255).toInt().shl(16) or
        (green * 255).toInt().shl(8) or
        (blue * 255).toInt()
