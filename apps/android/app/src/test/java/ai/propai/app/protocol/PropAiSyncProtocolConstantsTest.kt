package ai.propai.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class PropAiSyncProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", PropAiSyncCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", PropAiSyncCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", PropAiSyncCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", PropAiSyncCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", PropAiSyncCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", PropAiSyncCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", PropAiSyncCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", PropAiSyncCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", PropAiSyncCapability.Canvas.rawValue)
    assertEquals("camera", PropAiSyncCapability.Camera.rawValue)
    assertEquals("voiceWake", PropAiSyncCapability.VoiceWake.rawValue)
    assertEquals("location", PropAiSyncCapability.Location.rawValue)
    assertEquals("sms", PropAiSyncCapability.Sms.rawValue)
    assertEquals("device", PropAiSyncCapability.Device.rawValue)
    assertEquals("notifications", PropAiSyncCapability.Notifications.rawValue)
    assertEquals("system", PropAiSyncCapability.System.rawValue)
    assertEquals("photos", PropAiSyncCapability.Photos.rawValue)
    assertEquals("contacts", PropAiSyncCapability.Contacts.rawValue)
    assertEquals("calendar", PropAiSyncCapability.Calendar.rawValue)
    assertEquals("motion", PropAiSyncCapability.Motion.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", PropAiSyncCameraCommand.List.rawValue)
    assertEquals("camera.snap", PropAiSyncCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", PropAiSyncCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", PropAiSyncNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", PropAiSyncNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", PropAiSyncDeviceCommand.Status.rawValue)
    assertEquals("device.info", PropAiSyncDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", PropAiSyncDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", PropAiSyncDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", PropAiSyncSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", PropAiSyncPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", PropAiSyncContactsCommand.Search.rawValue)
    assertEquals("contacts.add", PropAiSyncContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", PropAiSyncCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", PropAiSyncCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", PropAiSyncMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", PropAiSyncMotionCommand.Pedometer.rawValue)
  }
}



