package ai.propai.app.node

import ai.propai.app.protocol.propaiCalendarCommand
import ai.propai.app.protocol.propaiCameraCommand
import ai.propai.app.protocol.propaiCapability
import ai.propai.app.protocol.propaiContactsCommand
import ai.propai.app.protocol.propaiDeviceCommand
import ai.propai.app.protocol.propaiLocationCommand
import ai.propai.app.protocol.propaiMotionCommand
import ai.propai.app.protocol.propaiNotificationsCommand
import ai.propai.app.protocol.propaiPhotosCommand
import ai.propai.app.protocol.propaiSmsCommand
import ai.propai.app.protocol.propaiSystemCommand
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      PropAiSyncCapability.Canvas.rawValue,
      PropAiSyncCapability.Device.rawValue,
      PropAiSyncCapability.Notifications.rawValue,
      PropAiSyncCapability.System.rawValue,
      PropAiSyncCapability.Photos.rawValue,
      PropAiSyncCapability.Contacts.rawValue,
      PropAiSyncCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      PropAiSyncCapability.Camera.rawValue,
      PropAiSyncCapability.Location.rawValue,
      PropAiSyncCapability.Sms.rawValue,
      PropAiSyncCapability.VoiceWake.rawValue,
      PropAiSyncCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      PropAiSyncDeviceCommand.Status.rawValue,
      PropAiSyncDeviceCommand.Info.rawValue,
      PropAiSyncDeviceCommand.Permissions.rawValue,
      PropAiSyncDeviceCommand.Health.rawValue,
      PropAiSyncNotificationsCommand.List.rawValue,
      PropAiSyncNotificationsCommand.Actions.rawValue,
      PropAiSyncSystemCommand.Notify.rawValue,
      PropAiSyncPhotosCommand.Latest.rawValue,
      PropAiSyncContactsCommand.Search.rawValue,
      PropAiSyncContactsCommand.Add.rawValue,
      PropAiSyncCalendarCommand.Events.rawValue,
      PropAiSyncCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      PropAiSyncCameraCommand.Snap.rawValue,
      PropAiSyncCameraCommand.Clip.rawValue,
      PropAiSyncCameraCommand.List.rawValue,
      PropAiSyncLocationCommand.Get.rawValue,
      PropAiSyncMotionCommand.Activity.rawValue,
      PropAiSyncMotionCommand.Pedometer.rawValue,
      PropAiSyncSmsCommand.Send.rawValue,
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

    assertTrue(commands.contains(PropAiSyncMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(PropAiSyncMotionCommand.Pedometer.rawValue))
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



