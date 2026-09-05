package com.example.horizonlockcamera.ui

import android.content.Intent
import android.net.Uri
import android.view.Surface
import android.view.ViewGroup
import androidx.camera.view.PreviewView
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cameraswitch
import androidx.compose.material.icons.filled.FlashOff
import androidx.compose.material.icons.filled.FlashOn
import androidx.compose.material.icons.filled.GridOn
import androidx.compose.material.icons.filled.RestartAlt
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.example.horizonlockcamera.camera.CameraManager
import com.example.horizonlockcamera.camera.CaptureMode
import com.example.horizonlockcamera.sensor.AccelerometerHorizonManager
import kotlinx.coroutines.delay
import java.util.Locale
import kotlin.math.cos
import kotlin.math.sin

@Composable
fun HorizonCameraScreen(
    cameraManager: CameraManager,
    horizonManager: AccelerometerHorizonManager,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val horizonState by horizonManager.horizonState.collectAsState()
    val cameraState by cameraManager.cameraState.collectAsState()

    var showLevelHud by remember { mutableStateOf(true) }
    var previewViewRef by remember { mutableStateOf<PreviewView?>(null) }
    var userZoom by remember { mutableFloatStateOf(1.0f) }

    // Lifecycle registration for accelerometer
    DisposableEffect(lifecycleOwner) {
        horizonManager.start()
        onDispose {
            horizonManager.stop()
            cameraManager.stop()
        }
    }

    // Auto-dismiss status message after 3 seconds
    var statusText by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(cameraState.statusMessage) {
        cameraState.statusMessage?.let { msg ->
            statusText = msg
            delay(2800)
            statusText = null
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(Color.Black)
            .pointerInput(Unit) {
                detectTransformGestures { _, _, zoomChange, _ ->
                    userZoom = (userZoom * zoomChange).coerceIn(cameraState.minZoom, cameraState.maxZoom)
                    cameraManager.setZoom(userZoom)
                }
            }
    ) {
        // --- 1. Natural Free-Rotate Camera Viewport (Zero Stretch, Natural Ratio) ---
        val previewScale = if (cameraState.isUltraWide06Mode && cameraState.scale06To1x) (1.0f / cameraState.ultraWideSensorZoom) else 1.0f
        Box(
            modifier = Modifier
                .fillMaxSize()
                .clipToBounds()
        ) {
            AndroidView(
                modifier = Modifier
                    .fillMaxSize()
                    .graphicsLayer {
                        scaleX = previewScale
                        scaleY = previewScale
                    },
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                        previewViewRef = this
                        cameraManager.startCamera(lifecycleOwner, this)
                    }
                }
            )
        }

        // --- 2. Aviation-Style Artificial Horizon Level Guide HUD Overlay ---
        if (showLevelHud) {
            ArtificialHorizonHud(
                rollAngle = horizonState.smoothRoll,
                pitchAngle = horizonState.pitch,
                isLevel = horizonState.isLevel,
                isFrontCamera = cameraState.isFrontCamera,
                modifier = Modifier.fillMaxSize()
            )
        }

        // --- 3. Top Floating Glass Controls Bar ---
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Flash / Torch Toggle
            GlassIconButton(
                onClick = { cameraManager.toggleTorch() },
                active = cameraState.isTorchOn
            ) {
                Icon(
                    imageVector = if (cameraState.isTorchOn) Icons.Default.FlashOn else Icons.Default.FlashOff,
                    contentDescription = "Flash",
                    tint = if (cameraState.isTorchOn) Color(0xFFFFD54F) else Color.White
                )
            }

            // Horizon Lock Status Badge
            HorizonLockStatusBadge(
                isLevel = horizonState.isLevel,
                isUltraWide06Mode = cameraState.isUltraWide06Mode,
                cameraDescription = cameraState.activeCameraDescription
            )

            // Right side buttons: Zero Calibrate & HUD Toggle
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                GlassIconButton(
                    onClick = { horizonManager.setCalibrationZero() },
                    active = horizonState.calibrationOffset != 0f
                ) {
                    Icon(
                        imageVector = Icons.Default.RestartAlt,
                        contentDescription = "Zero Calibrate",
                        tint = if (horizonState.calibrationOffset != 0f) Color(0xFF00E676) else Color.White
                    )
                }

                GlassIconButton(
                    onClick = { showLevelHud = !showLevelHud },
                    active = showLevelHud
                ) {
                    Icon(
                        imageVector = Icons.Default.GridOn,
                        contentDescription = "Toggle HUD",
                        tint = if (showLevelHud) Color(0xFF00E5FF) else Color.Gray
                    )
                }
            }
        }

        // --- 4. Live Sensor Roll/Pitch Readout or Video Recording Timer ---
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(top = 68.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (cameraState.isRecordingVideo) {
                VideoRecordingTimerBadge(durationSeconds = cameraState.recordingDurationSeconds)
            }

            TelemetryBadge(
                roll = horizonState.smoothRoll,
                pitch = horizonState.pitch,
                isLevel = horizonState.isLevel
            )

            if (cameraState.telemetryInfo.isNotEmpty()) {
                Surface(
                    color = Color(0xBB0A0E1A),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(12.dp))
                ) {
                    Text(
                        text = cameraState.telemetryInfo,
                        color = Color(0xFF80D8FF),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Medium,
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 3.dp)
                    )
                }
            }
        }

        // --- 5. Status Banner (Photo / Video Saved) ---
        AnimatedVisibility(
            visible = statusText != null,
            enter = slideInVertically() + fadeIn(),
            exit = slideOutVertically() + fadeOut(),
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(top = 145.dp)
        ) {
            Surface(
                color = Color(0xDD00E676),
                shape = RoundedCornerShape(24.dp),
                shadowElevation = 8.dp
            ) {
                Text(
                    text = statusText ?: "",
                    color = Color.Black,
                    fontWeight = FontWeight.Bold,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }
        }

        // --- 6. Bottom Controls Deck ---
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .navigationBarsPadding()
                .padding(bottom = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Mode Switcher: PHOTO | VIDEO
            ModeSelector(
                currentMode = cameraState.captureMode,
                isRecording = cameraState.isRecordingVideo,
                onModeSelected = { mode ->
                    cameraManager.setCaptureMode(mode)
                }
            )

            Spacer(modifier = Modifier.height(10.dp))

            // Dynamic Lens Selector & 1x Scale Toggle
            if (!cameraState.isFrontCamera) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    // All Available Back Lenses (1.0x Main, 0.6x Ultra-Wide, Cam 2, etc.)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp)
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        cameraState.availableBackLenses.forEachIndexed { index, lens ->
                            val isSelected = cameraState.selectedLensIndex == index
                            Surface(
                                color = if (isSelected) Color(0xFF00E5FF).copy(alpha = 0.25f) else Color(0x881E1E2E),
                                shape = RoundedCornerShape(16.dp),
                                modifier = Modifier
                                    .padding(horizontal = 4.dp)
                                    .border(
                                        1.5.dp,
                                        if (isSelected) Color(0xFF00E5FF) else Color(0x44FFFFFF),
                                        RoundedCornerShape(16.dp)
                                    )
                                    .clickable {
                                        cameraManager.selectLensOption(index)
                                    }
                            ) {
                                Text(
                                    text = lens.title,
                                    color = if (isSelected) Color(0xFF00E5FF) else Color(0xCCFFFFFF),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                )
                            }
                        }
                    }

                    // Scale to 1x toggle (shown when in 0.6x Ultra-Wide mode)
                    if (cameraState.isUltraWide06Mode) {
                        Surface(
                            color = if (cameraState.scale06To1x) Color(0xFF00E676).copy(alpha = 0.25f) else Color(0x881E1E2E),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier
                                .border(
                                    1.dp,
                                    if (cameraState.scale06To1x) Color(0xFF00E676) else Color(0xFFFFD54F),
                                    RoundedCornerShape(14.dp)
                                )
                                .clickable { cameraManager.toggleScale06To1x() }
                        ) {
                            Text(
                                text = if (cameraState.scale06To1x) "SCALE 1x (NO LINES): ON" else "RAW 0.6x VIEW (UNSCALED)",
                                color = if (cameraState.scale06To1x) Color(0xFF00E676) else Color(0xFFFFD54F),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            } else {
                Surface(
                    color = Color(0x661E1E2E),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier.border(1.dp, Color(0x44FFFFFF), RoundedCornerShape(16.dp))
                ) {
                    Text(
                        text = "FRONT CAMERA",
                        color = Color(0xCCFFFFFF),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(12.dp))

            // Main Action Deck: Thumbnail, Shutter/Record Button, Switch Camera
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 28.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Recent Media Thumbnail
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0x55222222))
                        .border(2.dp, Color(0x88FFFFFF), RoundedCornerShape(14.dp))
                        .clickable {
                            cameraState.lastSavedUri?.let { uri ->
                                val mimeType = if (cameraState.captureMode == CaptureMode.VIDEO) "video/*" else "image/*"
                                val intent = Intent(Intent.ACTION_VIEW).apply {
                                    setDataAndType(uri, mimeType)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                context.startActivity(intent)
                            }
                        },
                    contentAlignment = Alignment.Center
                ) {
                    val thumb = cameraState.lastCapturedThumbnail
                    if (thumb != null) {
                        Image(
                            bitmap = thumb.asImageBitmap(),
                            contentDescription = "Last media",
                            modifier = Modifier.fillMaxSize()
                        )
                    } else {
                        Text(
                            text = if (cameraState.captureMode == CaptureMode.VIDEO) "VID" else "IMG",
                            color = Color.Gray,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }

                // Shutter / Record Button
                Box(contentAlignment = Alignment.Center) {
                    CameraCaptureButton(
                        mode = cameraState.captureMode,
                        isTakingPicture = cameraState.isTakingPicture,
                        isRecording = cameraState.isRecordingVideo,
                        isLevel = horizonState.isLevel,
                        onClick = {
                            if (cameraState.captureMode == CaptureMode.PHOTO) {
                                cameraManager.capturePhoto(
                                    onSuccess = {},
                                    onError = {}
                                )
                            } else {
                                if (cameraState.isRecordingVideo) {
                                    cameraManager.stopRecording()
                                } else {
                                    cameraManager.startRecording(
                                        onVideoSaved = {},
                                        onError = {}
                                    )
                                }
                            }
                        }
                    )
                }

                // If recording video, show snapshot shutter button to take photos during video!
                if (cameraState.isRecordingVideo) {
                    GlassIconButton(
                        size = 56,
                        onClick = {
                            previewViewRef?.bitmap?.let { bmp ->
                                cameraManager.captureSnapshotFromPreview(previewBitmap = bmp)
                            }
                        }
                    ) {
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Color.White)
                        )
                    }
                } else {
                    // Lens Flip Button (Back / Front)
                    GlassIconButton(
                        size = 56,
                        onClick = {
                            previewViewRef?.let { preview ->
                                cameraManager.switchCamera(lifecycleOwner, preview)
                            }
                        }
                    ) {
                        Icon(
                            imageVector = Icons.Default.Cameraswitch,
                            contentDescription = "Switch Camera",
                            tint = Color.White,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun HorizonLockStatusBadge(
    isLevel: Boolean,
    isUltraWide06Mode: Boolean = false,
    cameraDescription: String = ""
) {
    val glowColor = if (isLevel) Color(0xFF00E676) else Color(0xFF00E5FF)

    Surface(
        color = Color(0x990A0E1A),
        shape = RoundedCornerShape(24.dp),
        shadowElevation = 6.dp,
        modifier = Modifier.border(1.dp, glowColor.copy(alpha = 0.7f), RoundedCornerShape(24.dp))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 7.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(glowColor)
            )
            val title = when {
                isUltraWide06Mode && isLevel -> "0.6x ACTION • LEVEL"
                isUltraWide06Mode -> if (cameraDescription.isNotEmpty()) cameraDescription else "0.6x ACTION (1x FOV)"
                isLevel -> "HORIZON LOCKED • LEVEL"
                else -> "HORIZON LOCK ACTIVE"
            }
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp,
                letterSpacing = 0.5.sp
            )
        }
    }
}

@Composable
fun ModeSelector(
    currentMode: CaptureMode,
    isRecording: Boolean,
    onModeSelected: (CaptureMode) -> Unit
) {
    Row(
        modifier = Modifier
            .background(Color(0x661E1E2E), RoundedCornerShape(20.dp))
            .border(1.dp, Color(0x33FFFFFF), RoundedCornerShape(20.dp))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        CaptureMode.entries.forEach { mode ->
            val isSelected = currentMode == mode
            val bg = if (isSelected) Color(0xFF00E5FF) else Color.Transparent
            val textColor = if (isSelected) Color.Black else Color(0xFFB0BEC5)

            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(16.dp))
                    .background(bg)
                    .clickable(enabled = !isRecording) { onModeSelected(mode) }
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = mode.name,
                    color = textColor,
                    fontSize = 12.sp,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    letterSpacing = 0.5.sp
                )
            }
        }
    }
}

@Composable
fun VideoRecordingTimerBadge(durationSeconds: Int) {
    val minutes = durationSeconds / 60
    val seconds = durationSeconds % 60
    val timeFormatted = String.format(Locale.US, "%02d:%02d", minutes, seconds)

    val transition = rememberInfiniteTransition(label = "pulse")
    val alpha by transition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1.0f,
        animationSpec = infiniteRepeatable(
            animation = tween(600),
            repeatMode = RepeatMode.Reverse
        ),
        label = "blink"
    )

    Surface(
        color = Color(0xDDCC0000),
        shape = RoundedCornerShape(16.dp),
        shadowElevation = 6.dp
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = alpha))
            )
            Text(
                text = timeFormatted,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
fun CameraCaptureButton(
    mode: CaptureMode,
    isTakingPicture: Boolean,
    isRecording: Boolean,
    isLevel: Boolean,
    onClick: () -> Unit
) {
    val borderColor = if (isRecording) {
        Color(0xFFFF1744)
    } else if (isLevel) {
        Color(0xFF00E676)
    } else {
        Color.White
    }

    val transition = rememberInfiniteTransition(label = "pulseRecord")
    val pulseScale by transition.animateFloat(
        initialValue = 1.0f,
        targetValue = 1.08f,
        animationSpec = infiniteRepeatable(
            animation = tween(700),
            repeatMode = RepeatMode.Reverse
        ),
        label = "pulseScale"
    )

    val scaleModifier = if (isRecording) Modifier.scale(pulseScale) else Modifier

    Box(
        modifier = scaleModifier
            .size(84.dp)
            .border(4.dp, borderColor, CircleShape)
            .padding(6.dp)
            .clip(CircleShape)
            .background(Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (mode == CaptureMode.PHOTO) {
            if (isTakingPicture) {
                CircularProgressIndicator(
                    modifier = Modifier.size(34.dp),
                    color = Color.White,
                    strokeWidth = 3.dp
                )
            } else {
                Box(
                    modifier = Modifier
                        .size(62.dp)
                        .clip(CircleShape)
                        .background(Color.White)
                        .border(2.dp, Color(0x33000000), CircleShape)
                )
            }
        } else {
            // Video Mode
            if (isRecording) {
                // Stop recording square
                Box(
                    modifier = Modifier
                        .size(30.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Color(0xFFFF1744))
                )
            } else {
                // Red Record circle
                Box(
                    modifier = Modifier
                        .size(62.dp)
                        .clip(CircleShape)
                        .background(Color(0xFFFF1744))
                        .border(2.dp, Color(0x33000000), CircleShape)
                )
            }
        }
    }
}

@Composable
fun TelemetryBadge(
    roll: Float,
    pitch: Float,
    isLevel: Boolean
) {
    val glowColor = if (isLevel) Color(0xFF00E676) else Color(0xFF00E5FF)

    Surface(
        color = Color(0x880A0E1A),
        shape = RoundedCornerShape(18.dp),
        shadowElevation = 4.dp,
        modifier = Modifier.border(1.dp, glowColor.copy(alpha = 0.6f), RoundedCornerShape(18.dp))
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Box(
                    modifier = Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(glowColor)
                )
                Text(
                    text = String.format(Locale.US, "ROLL %+.1f°", roll),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 12.sp
                )
            }

            Text(
                text = String.format(Locale.US, "PITCH %+.1f°", pitch),
                color = Color(0xFFB0BEC5),
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp
            )

            if (isLevel) {
                Text(
                    text = "LEVEL",
                    color = Color(0xFF00E676),
                    fontWeight = FontWeight.ExtraBold,
                    fontSize = 11.sp
                )
            }
        }
    }
}

@Composable
fun ArtificialHorizonHud(
    rollAngle: Float,
    pitchAngle: Float,
    isLevel: Boolean,
    isFrontCamera: Boolean = false,
    modifier: Modifier = Modifier
) {
    val hudColor = if (isLevel) Color(0xFF00E676) else Color(0xCC00E5FF)
    val guideColor = if (isLevel) Color(0x8800E676) else Color(0x66FFFFFF)

    Canvas(modifier = modifier) {
        val centerX = size.width / 2f
        val centerY = size.height / 2f

        // Center reticle ring
        drawCircle(
            color = hudColor,
            radius = 16.dp.toPx(),
            center = Offset(centerX, centerY),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2.dp.toPx())
        )
        drawCircle(
            color = hudColor,
            radius = 3.dp.toPx(),
            center = Offset(centerX, centerY)
        )

        // Crosshair Wings (fixed camera reference frame)
        val wingLength = 36.dp.toPx()
        val gap = 24.dp.toPx()
        drawLine(
            color = Color.White.copy(alpha = 0.8f),
            start = Offset(centerX - gap - wingLength, centerY),
            end = Offset(centerX - gap, centerY),
            strokeWidth = 2.dp.toPx()
        )
        drawLine(
            color = Color.White.copy(alpha = 0.8f),
            start = Offset(centerX + gap, centerY),
            end = Offset(centerX + gap + wingLength, centerY),
            strokeWidth = 2.dp.toPx()
        )

        // Rotating Horizon Level Line (visualizes the true world horizon)
        // Negated for back camera so when phone tilts down to the right, the line tilts up to remain horizontal.
        // Inverted for front camera because front camera preview is mirrored horizontally.
        val effectiveRoll = if (isFrontCamera) rollAngle else -rollAngle
        val rad = Math.toRadians(effectiveRoll.toDouble())
        val cosA = cos(rad).toFloat()
        val sinA = sin(rad).toFloat()

        val lineSpan = size.width * 0.38f
        val startPoint = Offset(centerX - lineSpan * cosA, centerY - lineSpan * sinA)
        val endPoint = Offset(centerX + lineSpan * cosA, centerY + lineSpan * sinA)

        drawLine(
            color = hudColor,
            start = startPoint,
            end = endPoint,
            strokeWidth = if (isLevel) 3.5.dp.toPx() else 2.dp.toPx(),
            pathEffect = if (isLevel) null else PathEffect.dashPathEffect(floatArrayOf(15f, 10f), 0f)
        )

        // Pitch Ladder tick marks (+10 deg, -10 deg)
        val pitchOffset = (pitchAngle * 4.dp.toPx()).coerceIn(-80.dp.toPx(), 80.dp.toPx())
        val ladderY = centerY + pitchOffset
        val ladderHalfW = 20.dp.toPx()

        drawLine(
            color = guideColor,
            start = Offset(centerX - ladderHalfW, ladderY),
            end = Offset(centerX + ladderHalfW, ladderY),
            strokeWidth = 1.5.dp.toPx()
        )
    }
}

@Composable
fun GlassIconButton(
    size: Int = 46,
    active: Boolean = false,
    onClick: () -> Unit,
    content: @Composable () -> Unit
) {
    Surface(
        color = if (active) Color(0x990288D1) else Color(0x661E1E2E),
        shape = CircleShape,
        shadowElevation = 4.dp,
        modifier = Modifier
            .size(size.dp)
            .border(1.dp, Color(0x44FFFFFF), CircleShape)
            .clickable(onClick = onClick)
    ) {
        Box(contentAlignment = Alignment.Center) {
            content()
        }
    }
}
