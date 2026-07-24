package com.codingmonkey.chordhero.designsystem

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
    primary = Color(0xFF8A3D18),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFDCC9),
    secondary = Color(0xFF3E5F90),
    tertiary = Color(0xFF6D5E0F),
    background = Color(0xFFFFF8F4),
    surface = Color(0xFFFFF8F4),
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFFFB68F),
    primaryContainer = Color(0xFF6B2B08),
    secondary = Color(0xFFA8C8FC),
    tertiary = Color(0xFFDAC66D),
    background = Color(0xFF17120F),
    surface = Color(0xFF17120F),
)

@Composable
fun ChordHeroTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
        content = content,
    )
}
