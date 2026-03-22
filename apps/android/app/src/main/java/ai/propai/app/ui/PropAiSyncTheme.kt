package ai.propai.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

@Composable
fun PropAiSyncTheme(content: @Composable () -> Unit) {
  val isDark = isSystemInDarkTheme()
  val darkScheme =
    darkColorScheme(
      primary = mobileAccent,
      onPrimary = Color(0xFF00150B),
      primaryContainer = mobileAccentSoft,
      onPrimaryContainer = mobileText,
      secondary = Color(0xFF64D390),
      onSecondary = Color(0xFF00150B),
      secondaryContainer = Color(0xFF14301F),
      onSecondaryContainer = mobileText,
      background = Color(0xFF000000),
      onBackground = mobileText,
      surface = mobileSurface,
      onSurface = mobileText,
      surfaceVariant = Color(0xFF151515),
      onSurfaceVariant = mobileTextSecondary,
      outline = mobileBorder,
      error = mobileDanger,
      onError = Color(0xFF1B0000),
    )
  val lightScheme =
    lightColorScheme(
      primary = mobileAccent,
      onPrimary = Color(0xFF00150B),
      primaryContainer = mobileAccentSoft,
      onPrimaryContainer = mobileText,
      secondary = Color(0xFF64D390),
      onSecondary = Color(0xFF00150B),
      secondaryContainer = Color(0xFF14301F),
      onSecondaryContainer = mobileText,
      background = Color(0xFF000000),
      onBackground = mobileText,
      surface = mobileSurface,
      onSurface = mobileText,
      surfaceVariant = Color(0xFF151515),
      onSurfaceVariant = mobileTextSecondary,
      outline = mobileBorder,
      error = mobileDanger,
      onError = Color(0xFF1B0000),
    )

  MaterialTheme(colorScheme = if (isDark) darkScheme else lightScheme, content = content)
}

@Composable
fun overlayContainerColor(): Color {
  val scheme = MaterialTheme.colorScheme
  val isDark = isSystemInDarkTheme()
  val base = if (isDark) scheme.surfaceContainerLow else scheme.surfaceContainerHigh
  // Light mode: background stays dark (canvas), so clamp overlays away from pure-white glare.
  return if (isDark) base else base.copy(alpha = 0.88f)
}

@Composable
fun overlayIconColor(): Color {
  return MaterialTheme.colorScheme.onSurfaceVariant
}



