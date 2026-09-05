package com.example.horizonlockcamera.sensor

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

enum class HorizonDamping(val label: String, val alpha: Float) {
    RESPONSIVE("Snappy", 0.30f),
    BALANCED("Balanced", 0.15f),
    CINEMATIC("Cinematic", 0.06f)
}

data class HorizonState(
    val rawRoll: Float = 0f,
    val smoothRoll: Float = 0f,
    val pitch: Float = 0f,
    val isLevel: Boolean = false,
    val scaleFactor: Float = 1.0f,
    val calibrationOffset: Float = 0f
)

class AccelerometerHorizonManager(context: Context) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val accelerometer: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)

    private val _horizonState = MutableStateFlow(HorizonState())
    val horizonState: StateFlow<HorizonState> = _horizonState.asStateFlow()

    private var currentFilteredRoll = 0f
    private var currentFilteredPitch = 0f
    private var calibrationOffset = 0f
    var damping: HorizonDamping = HorizonDamping.BALANCED

    // Low-pass filtered raw sensor axes
    private var gravX = 0f
    private var gravY = 0f
    private var gravZ = 0f
    private var isInitialized = false

    fun start() {
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
    }

    fun setCalibrationZero() {
        calibrationOffset = currentFilteredRoll
        updateState()
    }

    fun resetCalibration() {
        calibrationOffset = 0f
        updateState()
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.sensor.type != Sensor.TYPE_ACCELEROMETER) return

        val ax = event.values[0]
        val ay = event.values[1]
        val az = event.values[2]

        if (!isInitialized) {
            gravX = ax
            gravY = ay
            gravZ = az
            isInitialized = true
        } else {
            // First stage filter on acceleration vector to smooth out sudden vibrations
            val sensorAlpha = 0.2f
            gravX += sensorAlpha * (ax - gravX)
            gravY += sensorAlpha * (ay - gravY)
            gravZ += sensorAlpha * (az - gravZ)
        }

        // Calculate Roll angle: angle of the device relative to gravity in phone plane (X, Y)
        // In Android portrait orientation:
        // x is right, y is up, z points toward user
        // When upright: ax ≈ 0, ay ≈ 9.8 => atan2(0, 9.8) = 0°
        // When tilting phone right (clockwise): gravity vector tilts left relative to phone (-x)
        // atan2(-ax, ay) gives positive degrees for clockwise roll
        val rawRollRad = atan2(-gravX.toDouble(), gravY.toDouble())
        val targetRollDeg = Math.toDegrees(rawRollRad).toFloat()

        // Calculate Pitch angle (forward/backward tilt)
        val horizontalNorm = sqrt((gravX * gravX + gravY * gravY).toDouble())
        val pitchRad = atan2(gravZ.toDouble(), horizontalNorm)
        val targetPitchDeg = Math.toDegrees(pitchRad).toFloat()

        // Circular difference for roll angle to avoid -180 <-> +180 discontinuity spin
        var rollDiff = targetRollDeg - currentFilteredRoll
        while (rollDiff < -180f) rollDiff += 360f
        while (rollDiff > 180f) rollDiff -= 360f

        val alpha = damping.alpha
        currentFilteredRoll += alpha * rollDiff
        // Normalize between -180 and 180
        if (currentFilteredRoll > 180f) currentFilteredRoll -= 360f
        if (currentFilteredRoll < -180f) currentFilteredRoll += 360f

        currentFilteredPitch += alpha * (targetPitchDeg - currentFilteredPitch)

        updateState()
    }

    private fun updateState() {
        val effectiveRoll = currentFilteredRoll - calibrationOffset
        var normalizedEffectiveRoll = effectiveRoll
        while (normalizedEffectiveRoll < -180f) normalizedEffectiveRoll += 360f
        while (normalizedEffectiveRoll > 180f) normalizedEffectiveRoll -= 360f

        // Within +/- 1.0 degree is considered perfectly level
        val isLevel = abs(normalizedEffectiveRoll) <= 1.0f

        // Compute overscan scale factor to prevent black letterbox borders when the preview rotates
        // Bounding box scale needed for aspect ratio ~ 16:9 (1.78)
        val rad = Math.toRadians(abs(normalizedEffectiveRoll).toDouble())
        val aspect = 1.777f
        val cosVal = abs(cos(rad)).toFloat()
        val sinVal = abs(sin(rad)).toFloat()
        // Scaling formula so rotated rectangle still covers the viewport
        val calculatedScale = max(cosVal + sinVal * (1f / aspect), cosVal + sinVal * aspect)
        // Clamp scale factor between 1.0 and 1.2 to avoid excessive zooming
        val scaleFactor = min(max(calculatedScale, 1.0f), 1.2f)

        _horizonState.value = HorizonState(
            rawRoll = currentFilteredRoll,
            smoothRoll = normalizedEffectiveRoll,
            pitch = currentFilteredPitch,
            isLevel = isLevel,
            scaleFactor = scaleFactor,
            calibrationOffset = calibrationOffset
        )
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
}
