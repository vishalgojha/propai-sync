package ai.androidassistant.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class AndroidAssistantProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", AndroidAssistantCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", AndroidAssistantCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", AndroidAssistantCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", AndroidAssistantCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", AndroidAssistantCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", AndroidAssistantCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", AndroidAssistantCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", AndroidAssistantCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", AndroidAssistantCapability.Canvas.rawValue)
    assertEquals("camera", AndroidAssistantCapability.Camera.rawValue)
    assertEquals("voiceWake", AndroidAssistantCapability.VoiceWake.rawValue)
    assertEquals("location", AndroidAssistantCapability.Location.rawValue)
    assertEquals("sms", AndroidAssistantCapability.Sms.rawValue)
    assertEquals("device", AndroidAssistantCapability.Device.rawValue)
    assertEquals("notifications", AndroidAssistantCapability.Notifications.rawValue)
    assertEquals("system", AndroidAssistantCapability.System.rawValue)
    assertEquals("photos", AndroidAssistantCapability.Photos.rawValue)
    assertEquals("contacts", AndroidAssistantCapability.Contacts.rawValue)
    assertEquals("calendar", AndroidAssistantCapability.Calendar.rawValue)
    assertEquals("motion", AndroidAssistantCapability.Motion.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", AndroidAssistantCameraCommand.List.rawValue)
    assertEquals("camera.snap", AndroidAssistantCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", AndroidAssistantCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", AndroidAssistantNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", AndroidAssistantNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", AndroidAssistantDeviceCommand.Status.rawValue)
    assertEquals("device.info", AndroidAssistantDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", AndroidAssistantDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", AndroidAssistantDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", AndroidAssistantSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", AndroidAssistantPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", AndroidAssistantContactsCommand.Search.rawValue)
    assertEquals("contacts.add", AndroidAssistantContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", AndroidAssistantCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", AndroidAssistantCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", AndroidAssistantMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", AndroidAssistantMotionCommand.Pedometer.rawValue)
  }
}

