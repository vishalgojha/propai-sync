package ai.propai.app.node

import ai.propai.app.gateway.GatewaySession
import ai.propai.app.protocol.PropAiSyncCalendarCommand
import ai.propai.app.protocol.PropAiSyncCanvasA2UICommand
import ai.propai.app.protocol.PropAiSyncCanvasCommand
import ai.propai.app.protocol.PropAiSyncCameraCommand
import ai.propai.app.protocol.PropAiSyncContactsCommand
import ai.propai.app.protocol.PropAiSyncDeviceCommand
import ai.propai.app.protocol.PropAiSyncLocationCommand
import ai.propai.app.protocol.PropAiSyncMotionCommand
import ai.propai.app.protocol.PropAiSyncNotificationsCommand
import ai.propai.app.protocol.PropAiSyncPhotosCommand
import ai.propai.app.protocol.PropAiSyncSmsCommand
import ai.propai.app.protocol.PropAiSyncSystemCommand

class InvokeDispatcher(
  private val canvas: CanvasController,
  private val cameraHandler: CameraHandler,
  private val locationHandler: LocationHandler,
  private val deviceHandler: DeviceHandler,
  private val notificationsHandler: NotificationsHandler,
  private val systemHandler: SystemHandler,
  private val photosHandler: PhotosHandler,
  private val contactsHandler: ContactsHandler,
  private val calendarHandler: CalendarHandler,
  private val motionHandler: MotionHandler,
  private val smsHandler: SmsHandler,
  private val a2uiHandler: A2UIHandler,
  private val debugHandler: DebugHandler,
  private val isForeground: () -> Boolean,
  private val cameraEnabled: () -> Boolean,
  private val locationEnabled: () -> Boolean,
  private val smsAvailable: () -> Boolean,
  private val debugBuild: () -> Boolean,
  private val refreshNodeCanvasCapability: suspend () -> Boolean,
  private val onCanvasA2uiPush: () -> Unit,
  private val onCanvasA2uiReset: () -> Unit,
  private val motionActivityAvailable: () -> Boolean,
  private val motionPedometerAvailable: () -> Boolean,
) {
  suspend fun handleInvoke(command: String, paramsJson: String?): GatewaySession.InvokeResult {
    val spec =
      InvokeCommandRegistry.find(command)
        ?: return GatewaySession.InvokeResult.error(
          code = "INVALID_REQUEST",
          message = "INVALID_REQUEST: unknown command",
        )
    if (spec.requiresForeground && !isForeground()) {
      return GatewaySession.InvokeResult.error(
        code = "NODE_BACKGROUND_UNAVAILABLE",
        message = "NODE_BACKGROUND_UNAVAILABLE: canvas/camera/screen commands require foreground",
      )
    }
    availabilityError(spec.availability)?.let { return it }

    return when (command) {
      // Canvas commands
      PropAiSyncCanvasCommand.Present.rawValue -> {
        val url = CanvasController.parseNavigateUrl(paramsJson)
        canvas.navigate(url)
        GatewaySession.InvokeResult.ok(null)
      }
      PropAiSyncCanvasCommand.Hide.rawValue -> GatewaySession.InvokeResult.ok(null)
      PropAiSyncCanvasCommand.Navigate.rawValue -> {
        val url = CanvasController.parseNavigateUrl(paramsJson)
        canvas.navigate(url)
        GatewaySession.InvokeResult.ok(null)
      }
      PropAiSyncCanvasCommand.Eval.rawValue -> {
        val js =
          CanvasController.parseEvalJs(paramsJson)
            ?: return GatewaySession.InvokeResult.error(
              code = "INVALID_REQUEST",
              message = "INVALID_REQUEST: javaScript required",
            )
        withCanvasAvailable {
          val result = canvas.eval(js)
          GatewaySession.InvokeResult.ok("""{"result":${result.toJsonString()}}""")
        }
      }
      PropAiSyncCanvasCommand.Snapshot.rawValue -> {
        val snapshotParams = CanvasController.parseSnapshotParams(paramsJson)
        withCanvasAvailable {
          val base64 =
            canvas.snapshotBase64(
              format = snapshotParams.format,
              quality = snapshotParams.quality,
              maxWidth = snapshotParams.maxWidth,
            )
          GatewaySession.InvokeResult.ok("""{"format":"${snapshotParams.format.rawValue}","base64":"$base64"}""")
        }
      }

      // A2UI commands
      PropAiSyncCanvasA2UICommand.Reset.rawValue ->
        withReadyA2ui {
          withCanvasAvailable {
            val res = canvas.eval(A2UIHandler.a2uiResetJS)
            onCanvasA2uiReset()
            GatewaySession.InvokeResult.ok(res)
          }
        }
      PropAiSyncCanvasA2UICommand.Push.rawValue, PropAiSyncCanvasA2UICommand.PushJSONL.rawValue -> {
        val messages =
          try {
            a2uiHandler.decodeA2uiMessages(command, paramsJson)
          } catch (err: Throwable) {
            return GatewaySession.InvokeResult.error(
              code = "INVALID_REQUEST",
              message = err.message ?: "invalid A2UI payload"
            )
          }
        withReadyA2ui {
          withCanvasAvailable {
            val js = A2UIHandler.a2uiApplyMessagesJS(messages)
            val res = canvas.eval(js)
            onCanvasA2uiPush()
            GatewaySession.InvokeResult.ok(res)
          }
        }
      }

      // Camera commands
      PropAiSyncCameraCommand.List.rawValue -> cameraHandler.handleList(paramsJson)
      PropAiSyncCameraCommand.Snap.rawValue -> cameraHandler.handleSnap(paramsJson)
      PropAiSyncCameraCommand.Clip.rawValue -> cameraHandler.handleClip(paramsJson)

      // Location command
      PropAiSyncLocationCommand.Get.rawValue -> locationHandler.handleLocationGet(paramsJson)

      // Device commands
      PropAiSyncDeviceCommand.Status.rawValue -> deviceHandler.handleDeviceStatus(paramsJson)
      PropAiSyncDeviceCommand.Info.rawValue -> deviceHandler.handleDeviceInfo(paramsJson)
      PropAiSyncDeviceCommand.Permissions.rawValue -> deviceHandler.handleDevicePermissions(paramsJson)
      PropAiSyncDeviceCommand.Health.rawValue -> deviceHandler.handleDeviceHealth(paramsJson)

      // Notifications command
      PropAiSyncNotificationsCommand.List.rawValue -> notificationsHandler.handleNotificationsList(paramsJson)
      PropAiSyncNotificationsCommand.Actions.rawValue -> notificationsHandler.handleNotificationsActions(paramsJson)

      // System command
      PropAiSyncSystemCommand.Notify.rawValue -> systemHandler.handleSystemNotify(paramsJson)

      // Photos command
      PropAiSyncPhotosCommand.Latest.rawValue -> photosHandler.handlePhotosLatest(
        paramsJson,
      )

      // Contacts command
      PropAiSyncContactsCommand.Search.rawValue -> contactsHandler.handleContactsSearch(paramsJson)
      PropAiSyncContactsCommand.Add.rawValue -> contactsHandler.handleContactsAdd(paramsJson)

      // Calendar command
      PropAiSyncCalendarCommand.Events.rawValue -> calendarHandler.handleCalendarEvents(paramsJson)
      PropAiSyncCalendarCommand.Add.rawValue -> calendarHandler.handleCalendarAdd(paramsJson)

      // Motion command
      PropAiSyncMotionCommand.Activity.rawValue -> motionHandler.handleMotionActivity(paramsJson)
      PropAiSyncMotionCommand.Pedometer.rawValue -> motionHandler.handleMotionPedometer(paramsJson)

      // SMS command
      PropAiSyncSmsCommand.Send.rawValue -> smsHandler.handleSmsSend(paramsJson)

      // Debug commands
      "debug.ed25519" -> debugHandler.handleEd25519()
      "debug.logs" -> debugHandler.handleLogs()
      else -> GatewaySession.InvokeResult.error(code = "INVALID_REQUEST", message = "INVALID_REQUEST: unknown command")
    }
  }

  private suspend fun withReadyA2ui(
    block: suspend () -> GatewaySession.InvokeResult,
  ): GatewaySession.InvokeResult {
    var a2uiUrl = a2uiHandler.resolveA2uiHostUrl()
      ?: return GatewaySession.InvokeResult.error(
        code = "A2UI_HOST_NOT_CONFIGURED",
        message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
      )
    val readyOnFirstCheck = a2uiHandler.ensureA2uiReady(a2uiUrl)
    if (!readyOnFirstCheck) {
      if (!refreshNodeCanvasCapability()) {
        return GatewaySession.InvokeResult.error(
          code = "A2UI_HOST_UNAVAILABLE",
          message = "A2UI_HOST_UNAVAILABLE: A2UI host not reachable",
        )
      }
      a2uiUrl = a2uiHandler.resolveA2uiHostUrl()
        ?: return GatewaySession.InvokeResult.error(
          code = "A2UI_HOST_NOT_CONFIGURED",
          message = "A2UI_HOST_NOT_CONFIGURED: gateway did not advertise canvas host",
        )
      if (!a2uiHandler.ensureA2uiReady(a2uiUrl)) {
        return GatewaySession.InvokeResult.error(
          code = "A2UI_HOST_UNAVAILABLE",
          message = "A2UI_HOST_UNAVAILABLE: A2UI host not reachable",
        )
      }
    }
    return block()
  }

  private suspend fun withCanvasAvailable(
    block: suspend () -> GatewaySession.InvokeResult,
  ): GatewaySession.InvokeResult {
    return try {
      block()
    } catch (_: Throwable) {
      GatewaySession.InvokeResult.error(
        code = "NODE_BACKGROUND_UNAVAILABLE",
        message = "NODE_BACKGROUND_UNAVAILABLE: canvas unavailable",
      )
    }
  }

  private fun availabilityError(availability: InvokeCommandAvailability): GatewaySession.InvokeResult? {
    return when (availability) {
      InvokeCommandAvailability.Always -> null
      InvokeCommandAvailability.CameraEnabled ->
        if (cameraEnabled()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "CAMERA_DISABLED",
            message = "CAMERA_DISABLED: enable Camera in Settings",
          )
        }
      InvokeCommandAvailability.LocationEnabled ->
        if (locationEnabled()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "LOCATION_DISABLED",
            message = "LOCATION_DISABLED: enable Location in Settings",
          )
        }
      InvokeCommandAvailability.MotionActivityAvailable ->
        if (motionActivityAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "MOTION_UNAVAILABLE",
            message = "MOTION_UNAVAILABLE: accelerometer not available",
          )
        }
      InvokeCommandAvailability.MotionPedometerAvailable ->
        if (motionPedometerAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "PEDOMETER_UNAVAILABLE",
            message = "PEDOMETER_UNAVAILABLE: step counter not available",
          )
        }
      InvokeCommandAvailability.SmsAvailable ->
        if (smsAvailable()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "SMS_UNAVAILABLE",
            message = "SMS_UNAVAILABLE: SMS not available on this device",
          )
        }
      InvokeCommandAvailability.DebugBuild ->
        if (debugBuild()) {
          null
        } else {
          GatewaySession.InvokeResult.error(
            code = "INVALID_REQUEST",
            message = "INVALID_REQUEST: unknown command",
          )
        }
    }
  }
}



