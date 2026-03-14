package ai.propai.app.ui

import androidx.compose.runtime.Composable
import ai.propai.app.MainViewModel
import ai.propai.app.ui.chat.ChatSheetContent

@Composable
fun ChatSheet(viewModel: MainViewModel) {
  ChatSheetContent(viewModel = viewModel)
}


