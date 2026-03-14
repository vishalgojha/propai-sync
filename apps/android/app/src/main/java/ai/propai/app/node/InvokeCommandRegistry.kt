package ai.propai.app.node

import ai.propai.app.protocol.propaiCalendarCommand
import ai.propai.app.protocol.propaiCanvasA2UICommand
import ai.propai.app.protocol.propaiCanvasCommand
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

data class NodeRuntimeFlags(
  val cameraEnabled: Boolean,
  val locationEnabled: Boolean,
  val smsAvailable: Boolean,
  val voiceWakeEnabled: Boolean,
  val motionActivityAvailable: Boolean,
  val motionPedometerAvailable: Boolean,
  val debugBuild: Boolean,
)

enum class InvokeCommandAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  MotionActivityAvailable,
  MotionPedometerAvailable,
  DebugBuild,
}

enum class NodeCapabilityAvailability {
  Always,
  CameraEnabled,
  LocationEnabled,
  SmsAvailable,
  VoiceWakeEnabled,
  MotionAvailable,
}

data class NodeCapabilitySpec(
  val name: String,
  val availability: NodeCapabilityAvailability = NodeCapabilityAvailability.Always,
)

data class InvokeCommandSpec(
  val name: String,
  val requiresForeground: Boolean = false,
  val availability: InvokeCommandAvailability = InvokeCommandAvailability.Always,
)

object InvokeCommandRegistry {
  val capabilityManifest: List<NodeCapabilitySpec> =
    listOf(
      NodeCapabilitySpec(name = PropAiSyncCapability.Canvas.rawValue),
      NodeCapabilitySpec(name = PropAiSyncCapability.Device.rawValue),
      NodeCapabilitySpec(name = PropAiSyncCapability.Notifications.rawValue),
      NodeCapabilitySpec(name = PropAiSyncCapability.System.rawValue),
      NodeCapabilitySpec(
        name = PropAiSyncCapability.Camera.rawValue,
        availability = NodeCapabilityAvailability.CameraEnabled,
      ),
      NodeCapabilitySpec(
        name = PropAiSyncCapability.Sms.rawValue,
        availability = NodeCapabilityAvailability.SmsAvailable,
      ),
      NodeCapabilitySpec(
        name = PropAiSyncCapability.VoiceWake.rawValue,
        availability = NodeCapabilityAvailability.VoiceWakeEnabled,
      ),
      NodeCapabilitySpec(
        name = PropAiSyncCapability.Location.rawValue,
        availability = NodeCapabilityAvailability.LocationEnabled,
      ),
      NodeCapabilitySpec(name = PropAiSyncCapability.Photos.rawValue),
      NodeCapabilitySpec(name = PropAiSyncCapability.Contacts.rawValue),
      NodeCapabilitySpec(name = PropAiSyncCapability.Calendar.rawValue),
      NodeCapabilitySpec(
        name = PropAiSyncCapability.Motion.rawValue,
        availability = NodeCapabilityAvailability.MotionAvailable,
      ),
    )

  val all: List<InvokeCommandSpec> =
    listOf(
      InvokeCommandSpec(
        name = PropAiSyncCanvasCommand.Present.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasCommand.Hide.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasCommand.Navigate.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasCommand.Eval.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasCommand.Snapshot.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasA2UICommand.Push.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasA2UICommand.PushJSONL.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCanvasA2UICommand.Reset.rawValue,
        requiresForeground = true,
      ),
      InvokeCommandSpec(
        name = PropAiSyncSystemCommand.Notify.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCameraCommand.List.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCameraCommand.Snap.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCameraCommand.Clip.rawValue,
        requiresForeground = true,
        availability = InvokeCommandAvailability.CameraEnabled,
      ),
      InvokeCommandSpec(
        name = PropAiSyncLocationCommand.Get.rawValue,
        availability = InvokeCommandAvailability.LocationEnabled,
      ),
      InvokeCommandSpec(
        name = PropAiSyncDeviceCommand.Status.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncDeviceCommand.Info.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncDeviceCommand.Permissions.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncDeviceCommand.Health.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncNotificationsCommand.List.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncNotificationsCommand.Actions.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncPhotosCommand.Latest.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncContactsCommand.Search.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncContactsCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCalendarCommand.Events.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncCalendarCommand.Add.rawValue,
      ),
      InvokeCommandSpec(
        name = PropAiSyncMotionCommand.Activity.rawValue,
        availability = InvokeCommandAvailability.MotionActivityAvailable,
      ),
      InvokeCommandSpec(
        name = PropAiSyncMotionCommand.Pedometer.rawValue,
        availability = InvokeCommandAvailability.MotionPedometerAvailable,
      ),
      InvokeCommandSpec(
        name = PropAiSyncSmsCommand.Send.rawValue,
        availability = InvokeCommandAvailability.SmsAvailable,
      ),
      InvokeCommandSpec(
        name = "debug.logs",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
      InvokeCommandSpec(
        name = "debug.ed25519",
        availability = InvokeCommandAvailability.DebugBuild,
      ),
    )

  private val byNameInternal: Map<String, InvokeCommandSpec> = all.associateBy { it.name }

  fun find(command: String): InvokeCommandSpec? = byNameInternal[command]

  fun advertisedCapabilities(flags: NodeRuntimeFlags): List<String> {
    return capabilityManifest
      .filter { spec ->
        when (spec.availability) {
          NodeCapabilityAvailability.Always -> true
          NodeCapabilityAvailability.CameraEnabled -> flags.cameraEnabled
          NodeCapabilityAvailability.LocationEnabled -> flags.locationEnabled
          NodeCapabilityAvailability.SmsAvailable -> flags.smsAvailable
          NodeCapabilityAvailability.VoiceWakeEnabled -> flags.voiceWakeEnabled
          NodeCapabilityAvailability.MotionAvailable -> flags.motionActivityAvailable || flags.motionPedometerAvailable
        }
      }
      .map { it.name }
  }

  fun advertisedCommands(flags: NodeRuntimeFlags): List<String> {
    return all
      .filter { spec ->
        when (spec.availability) {
          InvokeCommandAvailability.Always -> true
          InvokeCommandAvailability.CameraEnabled -> flags.cameraEnabled
          InvokeCommandAvailability.LocationEnabled -> flags.locationEnabled
          InvokeCommandAvailability.SmsAvailable -> flags.smsAvailable
          InvokeCommandAvailability.MotionActivityAvailable -> flags.motionActivityAvailable
          InvokeCommandAvailability.MotionPedometerAvailable -> flags.motionPedometerAvailable
          InvokeCommandAvailability.DebugBuild -> flags.debugBuild
        }
      }
      .map { it.name }
  }
}



