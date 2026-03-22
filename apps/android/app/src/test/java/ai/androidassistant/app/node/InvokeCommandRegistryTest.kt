package ai.androidassistant.app.node

import ai.androidassistant.app.protocol.AndroidAssistantCalendarCommand
import ai.androidassistant.app.protocol.AndroidAssistantCameraCommand
import ai.androidassistant.app.protocol.AndroidAssistantCapability
import ai.androidassistant.app.protocol.AndroidAssistantContactsCommand
import ai.androidassistant.app.protocol.AndroidAssistantDeviceCommand
import ai.androidassistant.app.protocol.AndroidAssistantLocationCommand
import ai.androidassistant.app.protocol.AndroidAssistantMotionCommand
import ai.androidassistant.app.protocol.AndroidAssistantNotificationsCommand
import ai.androidassistant.app.protocol.AndroidAssistantPhotosCommand
import ai.androidassistant.app.protocol.AndroidAssistantSmsCommand
import ai.androidassistant.app.protocol.AndroidAssistantSystemCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      AndroidAssistantCapability.Canvas.rawValue,
      AndroidAssistantCapability.Device.rawValue,
      AndroidAssistantCapability.Notifications.rawValue,
      AndroidAssistantCapability.System.rawValue,
      AndroidAssistantCapability.Photos.rawValue,
      AndroidAssistantCapability.Contacts.rawValue,
      AndroidAssistantCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      AndroidAssistantCapability.Camera.rawValue,
      AndroidAssistantCapability.Location.rawValue,
      AndroidAssistantCapability.Sms.rawValue,
      AndroidAssistantCapability.VoiceWake.rawValue,
      AndroidAssistantCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      AndroidAssistantDeviceCommand.Status.rawValue,
      AndroidAssistantDeviceCommand.Info.rawValue,
      AndroidAssistantDeviceCommand.Permissions.rawValue,
      AndroidAssistantDeviceCommand.Health.rawValue,
      AndroidAssistantNotificationsCommand.List.rawValue,
      AndroidAssistantNotificationsCommand.Actions.rawValue,
      AndroidAssistantSystemCommand.Notify.rawValue,
      AndroidAssistantPhotosCommand.Latest.rawValue,
      AndroidAssistantContactsCommand.Search.rawValue,
      AndroidAssistantContactsCommand.Add.rawValue,
      AndroidAssistantCalendarCommand.Events.rawValue,
      AndroidAssistantCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      AndroidAssistantCameraCommand.Snap.rawValue,
      AndroidAssistantCameraCommand.Clip.rawValue,
      AndroidAssistantCameraCommand.List.rawValue,
      AndroidAssistantLocationCommand.Get.rawValue,
      AndroidAssistantMotionCommand.Activity.rawValue,
      AndroidAssistantMotionCommand.Pedometer.rawValue,
      AndroidAssistantSmsCommand.Send.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          smsAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          smsAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          smsAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(AndroidAssistantMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(AndroidAssistantMotionCommand.Pedometer.rawValue))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    smsAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      smsAvailable = smsAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(actual: List<String>, expected: Set<String>) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(actual: List<String>, forbidden: Set<String>) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}

