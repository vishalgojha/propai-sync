package ai.androidassistant.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatListeningConfigTest {
  @Test
  fun sanitizeChatListeningPackages_normalizesKnownPresetsAndDropsInvalidEntries() {
    val result =
      sanitizeChatListeningPackages(
        listOf(
          " com.whatsapp ",
          "COM.WHATSAPP.W4B",
          "not a package",
          "org.telegram.messenger",
        ),
      )

    assertEquals(
      listOf("com.whatsapp", "com.whatsapp.w4b", "org.telegram.messenger"),
      result,
    )
  }

  @Test
  fun passiveChatListening_requiresPackageMatchWhenNoConversationFilter() {
    val result =
      isPassiveChatListeningEnabledForNotification(
        packageName = "com.whatsapp",
        title = "Mom",
        text = "Call me back",
        selectedPackages = listOf("com.whatsapp"),
        conversationFilters = emptyList(),
      )

    assertTrue(result)
  }

  @Test
  fun passiveChatListening_requiresConversationMatchWhenFiltersPresent() {
    val matched =
      isPassiveChatListeningEnabledForNotification(
        packageName = "com.whatsapp",
        title = "Design Team",
        text = "Ship it",
        selectedPackages = listOf("com.whatsapp"),
        conversationFilters = listOf("Design Team"),
      )
    val missed =
      isPassiveChatListeningEnabledForNotification(
        packageName = "com.whatsapp",
        title = "Family",
        text = "Ship it",
        selectedPackages = listOf("com.whatsapp"),
        conversationFilters = listOf("Design Team"),
      )

    assertTrue(matched)
    assertFalse(missed)
  }
}
