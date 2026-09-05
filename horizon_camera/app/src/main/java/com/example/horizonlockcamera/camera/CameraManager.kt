package com.example.horizonlockcamera.camera

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CaptureRequest
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Log
import android.view.Surface
import androidx.annotation.OptIn
import androidx.camera.camera2.interop.Camera2CameraControl
import androidx.camera.camera2.interop.Camera2CameraInfo
import androidx.camera.camera2.interop.CaptureRequestOptions
import androidx.camera.camera2.interop.ExperimentalCamera2Interop
import androidx.camera.core.Camera
import androidx.camera.core.CameraEffect
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.lifecycle.ProcessCameraProvider
import com.example.horizonlockcamera.sensor.AccelerometerHorizonManager
import androidx.camera.video.FallbackStrategy
import androidx.camera.video.MediaStoreOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Locale

enum class CaptureMode {
    PHOTO,
    VIDEO
}

data class LensOption(
    val id: String,
    val title: String,
    val isZoomBased: Boolean = false,
    val targetZoom: Float = 1.0f,
    val isPhysicalId: Boolean = false,
    val physicalId: String = ""
)

data class CameraState(
    val captureMode: CaptureMode = CaptureMode.PHOTO,
    val isFrontCamera: Boolean = false,
    val isTorchOn: Boolean = false,
    val isUltraWide06Mode: Boolean = false,
    val scale06To1x: Boolean = true,
    val ultraWideSensorZoom: Float = 0.6f,
    val activeCameraDescription: String = "1.0x Main",
    val telemetryInfo: String = "",
    val availableBackLenses: List<LensOption> = listOf(
        LensOption("0_1x", "1.0x MAIN", isZoomBased = true, targetZoom = 1.0f),
        LensOption("0_06x", "0.6x ULTRA-WIDE", isZoomBased = true, targetZoom = 0.6f)
    ),
    val selectedLensIndex: Int = 0,
    val zoomRatio: Float = 1.0f,
    val minZoom: Float = 1.0f,
    val maxZoom: Float = 5.0f,
    val isTakingPicture: Boolean = false,
    val isRecordingVideo: Boolean = false,
    val recordingDurationSeconds: Int = 0,
    val currentRotation: Int = Surface.ROTATION_0,
    val lastCapturedThumbnail: Bitmap? = null,
    val lastSavedUri: Uri? = null,
    val statusMessage: String? = null
)

class CameraManager(
    private val context: Context,
    private val horizonManager: AccelerometerHorizonManager
) {

    private val tag = "CameraManager"
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var activeRecording: Recording? = null
    private var preview: Preview? = null
    private var horizonProcessor: HorizonLockSurfaceProcessor? = null

    private var currentLifecycleOwner: LifecycleOwner? = null
    private var currentPreviewView: PreviewView? = null

    private val _cameraState = MutableStateFlow(CameraState())
    val cameraState: StateFlow<CameraState> = _cameraState.asStateFlow()

    private var currentLensFacing = CameraSelector.LENS_FACING_BACK
    private val currentTargetRotation = Surface.ROTATION_0
    private val boundRotation = Surface.ROTATION_0

    fun startCamera(
        lifecycleOwner: LifecycleOwner,
        previewView: PreviewView,
        onReady: () -> Unit = {}
    ) {
        currentLifecycleOwner = lifecycleOwner
        currentPreviewView = previewView
        _cameraState.value = _cameraState.value.copy(currentRotation = Surface.ROTATION_0)

        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                val provider = cameraProviderFuture.get()
                cameraProvider = provider
                detectCameras(provider)
                bindCamera(lifecycleOwner, previewView)
                onReady()
            } catch (exc: Exception) {
                Log.e(tag, "Failed to initialize CameraX provider", exc)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    fun stop() {
        horizonProcessor?.release()
        horizonProcessor = null
    }

    fun setCaptureMode(mode: CaptureMode) {
        if (_cameraState.value.captureMode == mode) return
        if (_cameraState.value.isRecordingVideo) {
            stopRecording()
        }
        _cameraState.value = _cameraState.value.copy(captureMode = mode)
        val lifecycleOwner = currentLifecycleOwner ?: return
        val previewView = currentPreviewView ?: return
        bindCamera(lifecycleOwner, previewView)
    }

    @OptIn(ExperimentalCamera2Interop::class)
    private fun detectCameras(provider: ProcessCameraProvider) {
        val lenses = mutableListOf<LensOption>()
        lenses.add(LensOption("0_1x", "1.0x MAIN", isZoomBased = true, targetZoom = 1.0f))
        lenses.add(LensOption("0_06x", "0.6x ULTRA-WIDE", isZoomBased = true, targetZoom = 0.6f))

        try {
            val c2Manager = context.getSystemService(Context.CAMERA_SERVICE) as? android.hardware.camera2.CameraManager
            if (c2Manager != null) {
                for (id in c2Manager.cameraIdList) {
                    try {
                        val chars = c2Manager.getCameraCharacteristics(id)
                        val facing = chars.get(CameraCharacteristics.LENS_FACING)
                        if (facing == CameraCharacteristics.LENS_FACING_BACK && id != "0") {
                            val focals = chars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                            val minFocal = focals?.minOrNull() ?: 0f
                            lenses.add(LensOption(id, "CAM $id (${String.format(Locale.US, "%.1f", minFocal)}mm)"))
                            Log.i(tag, "Discovered Back Camera $id: ${minFocal}mm")
                        }

                        if (id == "0" && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            val physicalIds = chars.physicalCameraIds
                            for (pId in physicalIds) {
                                try {
                                    val pChars = c2Manager.getCameraCharacteristics(pId)
                                    val pFocals = pChars.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
                                    val pMinFocal = pFocals?.minOrNull() ?: 0f
                                    lenses.add(LensOption("phys_$pId", "PHYS $pId (${String.format(Locale.US, "%.1f", pMinFocal)}mm)", isPhysicalId = true, physicalId = pId))
                                    Log.i(tag, "Discovered Physical Camera $pId under Cam 0: ${pMinFocal}mm")
                                } catch (e: Exception) {
                                    Log.w(tag, "Error reading physical camera $pId", e)
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Log.w(tag, "Error inspecting camera $id", e)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(tag, "detectCameras failed", e)
        }

        _cameraState.value = _cameraState.value.copy(availableBackLenses = lenses)
    }

    @OptIn(ExperimentalCamera2Interop::class)
    private fun buildCameraSelector(provider: ProcessCameraProvider): CameraSelector {
        if (currentLensFacing == CameraSelector.LENS_FACING_FRONT) {
            return CameraSelector.DEFAULT_FRONT_CAMERA
        }

        val lenses = _cameraState.value.availableBackLenses
        val selected = lenses.getOrNull(_cameraState.value.selectedLensIndex)

        if (selected != null) {
            if (selected.isPhysicalId) {
                Log.i(tag, "Binding Physical Camera ID: ${selected.physicalId}")
                return CameraSelector.Builder()
                    .requireLensFacing(CameraSelector.LENS_FACING_BACK)
                    .setPhysicalCameraId(selected.physicalId)
                    .build()
            } else if (!selected.isZoomBased && selected.id.isNotEmpty()) {
                Log.i(tag, "Binding Standalone Camera ID: ${selected.id}")
                return CameraSelector.Builder()
                    .addCameraFilter { cameraInfos ->
                        val matched = cameraInfos.filter {
                            try {
                                Camera2CameraInfo.from(it).cameraId == selected.id
                            } catch (e: Exception) {
                                false
                            }
                        }
                        if (matched.isNotEmpty()) matched else cameraInfos
                    }
                    .build()
            }
        }

        return CameraSelector.DEFAULT_BACK_CAMERA
    }

    private fun bindCamera(lifecycleOwner: LifecycleOwner, previewView: PreviewView) {
        val provider = cameraProvider ?: return

        preview = Preview.Builder()
            .setTargetRotation(boundRotation)
            .build().also {
                it.surfaceProvider = previewView.surfaceProvider
            }

        val cameraSelector = buildCameraSelector(provider)

        try {
            provider.unbindAll()

            if (_cameraState.value.captureMode == CaptureMode.PHOTO) {
                horizonProcessor?.release()
                horizonProcessor = null

                imageCapture = ImageCapture.Builder()
                    .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                    .setTargetRotation(currentTargetRotation)
                    .build()

                camera = provider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    preview,
                    imageCapture
                )
            } else {
                val qualitySelector = QualitySelector.from(
                    Quality.HIGHEST,
                    FallbackStrategy.higherQualityOrLowerThan(Quality.SD)
                )
                val recorder = Recorder.Builder()
                    .setQualitySelector(qualitySelector)
                    .build()

                videoCapture = VideoCapture.Builder(recorder)
                    .setTargetRotation(currentTargetRotation)
                    .build()

                val isFront = currentLensFacing == CameraSelector.LENS_FACING_FRONT
                val processor = HorizonLockSurfaceProcessor(horizonManager).apply {
                    isFrontCamera = isFront
                    isUltraWide06Mode = _cameraState.value.isUltraWide06Mode
                    ultraWideSensorZoom = _cameraState.value.ultraWideSensorZoom
                }
                horizonProcessor?.release()
                horizonProcessor = processor

                val effect = HorizonLockEffect(
                    CameraEffect.VIDEO_CAPTURE,
                    processor.glExecutor,
                    processor
                )

                val useCaseGroup = UseCaseGroup.Builder()
                    .addUseCase(preview!!)
                    .addUseCase(videoCapture!!)
                    .addEffect(effect)
                    .build()

                camera = provider.bindToLifecycle(
                    lifecycleOwner,
                    cameraSelector,
                    useCaseGroup
                )
            }

            camera?.cameraInfo?.zoomState?.observe(lifecycleOwner) { zoom ->
                _cameraState.value = _cameraState.value.copy(
                    zoomRatio = zoom.zoomRatio,
                    minZoom = zoom.minZoomRatio,
                    maxZoom = zoom.maxZoomRatio
                )
            }

            val selected = _cameraState.value.availableBackLenses.getOrNull(_cameraState.value.selectedLensIndex)
            if (selected != null && selected.isZoomBased) {
                applyZoomRatio(selected.targetZoom)
                CoroutineScope(Dispatchers.Main).launch {
                    delay(150)
                    applyZoomRatio(selected.targetZoom)
                }
            }

            // Gather telemetry info
            val c2Manager = context.getSystemService(Context.CAMERA_SERVICE) as? android.hardware.camera2.CameraManager
            val chars0 = try { c2Manager?.getCameraCharacteristics("0") } catch (e: Exception) { null }
            val zoomRange = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                chars0?.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
            } else null
            val focals = chars0?.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)
            val focalStr = focals?.joinToString("/") { String.format(Locale.US, "%.1f", it) } ?: "?"

            val activeTitle = if (currentLensFacing == CameraSelector.LENS_FACING_FRONT) "FRONT" else (selected?.title ?: "1.0x MAIN")
            val info = "Active: $activeTitle | Focals: ${focalStr}mm | C2 ZoomRange: [${zoomRange?.lower ?: "?"} - ${zoomRange?.upper ?: "?"}]"

            _cameraState.value = _cameraState.value.copy(
                isFrontCamera = currentLensFacing == CameraSelector.LENS_FACING_FRONT,
                isTorchOn = false,
                activeCameraDescription = activeTitle,
                telemetryInfo = info
            )
        } catch (exc: Exception) {
            Log.e(tag, "Use case binding failed, attempting fallback to default", exc)
            if (_cameraState.value.isUltraWide06Mode) {
                try {
                    provider.unbindAll()
                    val fallbackSelector = CameraSelector.DEFAULT_BACK_CAMERA
                    if (_cameraState.value.captureMode == CaptureMode.PHOTO) {
                        camera = provider.bindToLifecycle(lifecycleOwner, fallbackSelector, preview, imageCapture)
                    } else {
                        val useCaseGroup = UseCaseGroup.Builder()
                            .addUseCase(preview!!)
                            .addUseCase(videoCapture!!)
                            .also { horizonProcessor?.let { p -> it.addEffect(HorizonLockEffect(CameraEffect.VIDEO_CAPTURE, p.glExecutor, p)) } }
                            .build()
                        camera = provider.bindToLifecycle(lifecycleOwner, fallbackSelector, useCaseGroup)
                    }
                    applyZoomRatio(0.6f)
                } catch (fallbackExc: Exception) {
                    Log.e(tag, "Fallback binding also failed", fallbackExc)
                }
            }
        }
    }

    @OptIn(ExperimentalCamera2Interop::class)
    fun applyZoomRatio(ratio: Float) {
        val cam = camera ?: return
        try {
            cam.cameraControl.setZoomRatio(ratio)
            Log.i(tag, "CameraX setZoomRatio($ratio) called")
        } catch (e: Exception) {
            Log.w(tag, "CameraX setZoomRatio($ratio) failed: ${e.message}")
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val c2Control = Camera2CameraControl.from(cam.cameraControl)
                val options = CaptureRequestOptions.Builder()
                    .setCaptureRequestOption(CaptureRequest.CONTROL_ZOOM_RATIO, ratio)
                    .build()
                c2Control.setCaptureRequestOptions(options)
                Log.i(tag, "Applied Camera2 CONTROL_ZOOM_RATIO = $ratio via Camera2CameraControl")
            } catch (e: Exception) {
                Log.w(tag, "Camera2 setCaptureRequestOptions CONTROL_ZOOM_RATIO failed", e)
            }
        }
    }

    fun selectLensOption(index: Int) {
        val lenses = _cameraState.value.availableBackLenses
        if (index !in lenses.indices) return
        val lens = lenses[index]

        if (_cameraState.value.isRecordingVideo) {
            stopRecording()
        }

        val is06 = lens.id == "0_06x" || (lens.isZoomBased && lens.targetZoom < 0.9f) || lens.title.contains("0.6") || lens.title.contains("ULTRA")

        _cameraState.value = _cameraState.value.copy(
            selectedLensIndex = index,
            isUltraWide06Mode = is06,
            ultraWideSensorZoom = if (lens.isZoomBased && lens.targetZoom < 0.9f) lens.targetZoom else 0.6f,
            activeCameraDescription = lens.title,
            statusMessage = "Selected ${lens.title}"
        )
        horizonProcessor?.isUltraWide06Mode = is06
        horizonProcessor?.ultraWideSensorZoom = _cameraState.value.ultraWideSensorZoom

        val lifecycleOwner = currentLifecycleOwner ?: return
        val previewView = currentPreviewView ?: return

        bindCamera(lifecycleOwner, previewView)

        if (lens.isZoomBased) {
            applyZoomRatio(lens.targetZoom)
            CoroutineScope(Dispatchers.Main).launch {
                delay(150)
                applyZoomRatio(lens.targetZoom)
            }
        }
    }

    fun toggleScale06To1x() {
        val newScale = !_cameraState.value.scale06To1x
        _cameraState.value = _cameraState.value.copy(
            scale06To1x = newScale,
            statusMessage = if (newScale) "Scaled to 1x (No Lines)" else "Raw 0.6x Wide Angle"
        )
        horizonProcessor?.scale06To1x = newScale
    }

    fun switchCamera(lifecycleOwner: LifecycleOwner, previewView: PreviewView) {
        if (_cameraState.value.isRecordingVideo) {
            stopRecording()
        }
        currentLensFacing = if (currentLensFacing == CameraSelector.LENS_FACING_BACK) {
            CameraSelector.LENS_FACING_FRONT
        } else {
            CameraSelector.LENS_FACING_BACK
        }
        bindCamera(lifecycleOwner, previewView)
    }

    fun toggleTorch() {
        val cam = camera ?: return
        if (cam.cameraInfo.hasFlashUnit()) {
            val newTorch = !_cameraState.value.isTorchOn
            cam.cameraControl.enableTorch(newTorch)
            _cameraState.value = _cameraState.value.copy(isTorchOn = newTorch)
        }
    }

    fun setZoom(ratio: Float) {
        applyZoomRatio(ratio)
    }

    fun setUltraWide06Mode(enabled: Boolean) {
        val lenses = _cameraState.value.availableBackLenses
        val targetIndex = if (enabled) {
            val idx = lenses.indexOfFirst { it.id == "0_06x" || it.title.contains("0.6") || it.targetZoom < 0.9f }
            if (idx >= 0) idx else 1.coerceAtMost(lenses.lastIndex)
        } else {
            0
        }
        selectLensOption(targetIndex)
    }

    fun capturePhoto(
        onSuccess: (Uri) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        val capture = imageCapture ?: run {
            onError("Camera capture not ready")
            return
        }

        try {
            capture.targetRotation = boundRotation
        } catch (e: Exception) {
            Log.w(tag, "Failed to set targetRotation on ImageCapture", e)
        }

        _cameraState.value = _cameraState.value.copy(isTakingPicture = true)

        val tempFile = File.createTempFile("temp_capture_", ".jpg", context.cacheDir)
        val outputOptions = ImageCapture.OutputFileOptions.Builder(tempFile).build()

        capture.takePicture(
            outputOptions,
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageSavedCallback {
                override fun onImageSaved(outputFileResults: ImageCapture.OutputFileResults) {
                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val savedUri = processAndSaveImage(tempFile)

                            withContext(Dispatchers.Main) {
                                _cameraState.value = _cameraState.value.copy(
                                    isTakingPicture = false,
                                    lastSavedUri = savedUri,
                                    statusMessage = "Photo Saved (Upright)!"
                                )
                                onSuccess(savedUri)
                            }
                        } catch (e: Exception) {
                            Log.e(tag, "Error processing captured photo", e)
                            withContext(Dispatchers.Main) {
                                _cameraState.value = _cameraState.value.copy(isTakingPicture = false)
                                onError("Failed to process photo: ${e.localizedMessage}")
                            }
                        } finally {
                            tempFile.delete()
                        }
                    }
                }

                override fun onError(exception: ImageCaptureException) {
                    _cameraState.value = _cameraState.value.copy(isTakingPicture = false)
                    onError("Capture error: ${exception.message}")
                }
            }
        )
    }

    fun captureSnapshotFromPreview(
        previewBitmap: Bitmap,
        onSuccess: (Uri) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        _cameraState.value = _cameraState.value.copy(isTakingPicture = true)
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val savedUri = saveBitmapToGallery(previewBitmap, "SNAP_")
                withContext(Dispatchers.Main) {
                    _cameraState.value = _cameraState.value.copy(
                        isTakingPicture = false,
                        lastSavedUri = savedUri,
                        statusMessage = "Snapshot Saved!"
                    )
                    onSuccess(savedUri)
                }
            } catch (e: Exception) {
                Log.e(tag, "Snapshot capture error", e)
                withContext(Dispatchers.Main) {
                    _cameraState.value = _cameraState.value.copy(isTakingPicture = false)
                    onError("Snapshot failed: ${e.localizedMessage}")
                }
            }
        }
    }

    fun startRecording(
        onVideoSaved: (Uri) -> Unit = {},
        onError: (String) -> Unit = {}
    ) {
        val capture = videoCapture ?: run {
            onError("Video capture is not ready")
            return
        }

        try {
            capture.targetRotation = currentTargetRotation
        } catch (e: Exception) {
            Log.w(tag, "Could not set targetRotation on video capture", e)
        }

        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val displayName = "VIDEO_${timeStamp}.mp4"

        val contentValues = ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/HorizonLockCamera")
            }
        }

        val mediaStoreOutput = MediaStoreOutputOptions.Builder(
            context.contentResolver,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        ).setContentValues(contentValues).build()

        var pendingRecording = capture.output.prepareRecording(context, mediaStoreOutput)

        val hasAudio = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
        if (hasAudio) {
            try {
                pendingRecording = pendingRecording.withAudioEnabled()
            } catch (e: SecurityException) {
                Log.w(tag, "Audio permission not granted for recording", e)
            }
        }

        activeRecording = pendingRecording.start(ContextCompat.getMainExecutor(context)) { recordEvent ->
            when (recordEvent) {
                is VideoRecordEvent.Start -> {
                    _cameraState.value = _cameraState.value.copy(
                        isRecordingVideo = true,
                        recordingDurationSeconds = 0
                    )
                }
                is VideoRecordEvent.Status -> {
                    val durationNanos = recordEvent.recordingStats.recordedDurationNanos
                    val seconds = (durationNanos / 1_000_000_000L).toInt()
                    _cameraState.value = _cameraState.value.copy(
                        recordingDurationSeconds = seconds
                    )
                }
                is VideoRecordEvent.Finalize -> {
                    _cameraState.value = _cameraState.value.copy(
                        isRecordingVideo = false,
                        recordingDurationSeconds = 0
                    )
                    if (!recordEvent.hasError()) {
                        val uri = recordEvent.outputResults.outputUri
                        _cameraState.value = _cameraState.value.copy(
                            lastSavedUri = uri,
                            statusMessage = "Video Saved (Upright)!"
                        )
                        generateVideoThumbnail(uri)
                        onVideoSaved(uri)
                    } else {
                        Log.e(tag, "Video recording error: ${recordEvent.error}")
                        onError("Video error: ${recordEvent.error}")
                    }
                }
            }
        }
    }

    fun stopRecording() {
        activeRecording?.stop()
        activeRecording = null
    }

    private fun generateVideoThumbnail(uri: Uri) {
        CoroutineScope(Dispatchers.IO).launch {
            val retriever = MediaMetadataRetriever()
            try {
                retriever.setDataSource(context, uri)
                val frame = retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                if (frame != null) {
                    val thumbSize = 128
                    val thumbnail = Bitmap.createScaledBitmap(frame, thumbSize, thumbSize, true)
                    withContext(Dispatchers.Main) {
                        _cameraState.value = _cameraState.value.copy(lastCapturedThumbnail = thumbnail)
                    }
                }
            } catch (e: Exception) {
                Log.w(tag, "Failed to retrieve video thumbnail", e)
            } finally {
                retriever.release()
            }
        }
    }

    private suspend fun processAndSaveImage(file: File): Uri = withContext(Dispatchers.IO) {
        val originalBitmap = BitmapFactory.decodeFile(file.absolutePath)
            ?: throw IllegalStateException("Failed to decode captured image")

        val exif = ExifInterface(file.absolutePath)
        val exifDegrees = when (exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> 0f
        }

        val smoothRoll = horizonManager.horizonState.value.smoothRoll
        val isFront = currentLensFacing == CameraSelector.LENS_FACING_FRONT
        val effectiveRoll = if (isFront) -smoothRoll else smoothRoll
        val totalRotation = exifDegrees - effectiveRoll

        val isUltraWide = _cameraState.value.isUltraWide06Mode && _cameraState.value.scale06To1x
        val sensorZoom = _cameraState.value.ultraWideSensorZoom

        val processedBitmap = if (isUltraWide) {
            rotateAndScaleBitmap(originalBitmap, totalRotation, 1.0f / sensorZoom)
        } else if (kotlin.math.abs(totalRotation) > 0.5f) {
            rotateBitmapOnly(originalBitmap, totalRotation)
        } else {
            originalBitmap
        }

        val savedUri = saveBitmapToGallery(processedBitmap, "PHOTO_")

        if (processedBitmap != originalBitmap) {
            processedBitmap.recycle()
        }
        originalBitmap.recycle()

        savedUri
    }

    private suspend fun saveBitmapToGallery(bitmap: Bitmap, prefix: String): Uri = withContext(Dispatchers.IO) {
        val thumbSize = 128
        val thumbnail = Bitmap.createScaledBitmap(
            bitmap,
            thumbSize,
            (thumbSize * (bitmap.height.toFloat() / bitmap.width.toFloat())).toInt().coerceAtLeast(1),
            true
        )

        withContext(Dispatchers.Main) {
            _cameraState.value = _cameraState.value.copy(lastCapturedThumbnail = thumbnail)
        }

        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(System.currentTimeMillis())
        val displayName = "${prefix}${timeStamp}.jpg"

        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/HorizonLockCamera")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }

        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
            ?: throw IllegalStateException("Failed to create MediaStore entry")

        resolver.openOutputStream(uri)?.use { stream: OutputStream ->
            bitmap.compress(Bitmap.CompressFormat.JPEG, 95, stream)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Images.Media.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        }

        uri
    }

    private fun rotateBitmapOnly(source: Bitmap, angle: Float): Bitmap {
        val matrix = Matrix().apply { postRotate(angle) }
        return Bitmap.createBitmap(source, 0, 0, source.width, source.height, matrix, true)
    }

    private fun rotateAndScaleBitmap(source: Bitmap, angle: Float, scale: Float): Bitmap {
        val result = Bitmap.createBitmap(source.width, source.height, source.config ?: Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(result)
        val matrix = Matrix().apply {
            postTranslate(-source.width / 2f, -source.height / 2f)
            postRotate(angle)
            postScale(scale, scale)
            postTranslate(source.width / 2f, source.height / 2f)
        }
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(source, matrix, paint)
        return result
    }
}
