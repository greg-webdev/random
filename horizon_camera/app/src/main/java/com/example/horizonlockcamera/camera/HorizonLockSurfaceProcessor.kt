package com.example.horizonlockcamera.camera

import android.graphics.SurfaceTexture
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.Matrix
import android.os.Handler
import android.os.HandlerThread
import android.util.Log
import android.view.Surface
import androidx.camera.core.CameraEffect
import androidx.camera.core.ProcessingException
import androidx.camera.core.SurfaceOutput
import androidx.camera.core.SurfaceProcessor
import androidx.camera.core.SurfaceRequest
import androidx.core.util.Consumer
import com.example.horizonlockcamera.sensor.AccelerometerHorizonManager
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import java.util.concurrent.Executor

class HorizonLockEffect(
    targets: Int,
    executor: Executor,
    val processor: HorizonLockSurfaceProcessor
) : CameraEffect(
    targets,
    executor,
    processor,
    Consumer<Throwable> { error ->
        Log.e("HorizonLockEffect", "Camera effect error", error)
    }
)

class HorizonLockSurfaceProcessor(
    private val horizonManager: AccelerometerHorizonManager
) : SurfaceProcessor, SurfaceTexture.OnFrameAvailableListener {

    private val tag = "HorizonLockGL"

    private val glThread = HandlerThread("HorizonGlThread").apply { start() }
    private val glHandler = Handler(glThread.looper)
    val glExecutor = Executor { command -> glHandler.post(command) }

    var isHorizonLockEnabled: Boolean = true
    var isFrontCamera: Boolean = false
    var isUltraWide06Mode: Boolean = false
    var ultraWideSensorZoom: Float = 0.6f
    var scale06To1x: Boolean = true

    private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglConfig: EGLConfig? = null
    private var pbufferSurface: EGLSurface = EGL14.EGL_NO_SURFACE

    private var program = 0
    private var aPositionLoc = 0
    private var aTextureCoordLoc = 0
    private var uTransformMatrixLoc = 0
    private var sTextureLoc = 0

    private var textureId = 0
    private var inputSurfaceTexture: SurfaceTexture? = null
    private var inputSurface: Surface? = null

    private class OutputTarget(
        val surfaceOutput: SurfaceOutput,
        val eglSurface: EGLSurface,
        val width: Int,
        val height: Int
    )

    private val outputTargets = mutableMapOf<SurfaceOutput, OutputTarget>()

    private val vertexBuffer: FloatBuffer
    private val texCoordBuffer: FloatBuffer

    init {
        val vertices = floatArrayOf(
            -1.0f, -1.0f,
             1.0f, -1.0f,
            -1.0f,  1.0f,
             1.0f,  1.0f
        )
        val texCoords = floatArrayOf(
            0.0f, 0.0f,
            1.0f, 0.0f,
            0.0f, 1.0f,
            1.0f, 1.0f
        )

        vertexBuffer = ByteBuffer.allocateDirect(vertices.size * 4)
            .order(ByteOrder.nativeOrder()).asFloatBuffer().put(vertices).apply { position(0) }

        texCoordBuffer = ByteBuffer.allocateDirect(texCoords.size * 4)
            .order(ByteOrder.nativeOrder()).asFloatBuffer().put(texCoords).apply { position(0) }

        glHandler.post {
            initGL()
        }
    }

    private fun initGL() {
        eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
        val version = IntArray(2)
        EGL14.eglInitialize(eglDisplay, version, 0, version, 1)

        val configAttribs = intArrayOf(
            EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
            EGL14.EGL_RED_SIZE, 8,
            EGL14.EGL_GREEN_SIZE, 8,
            EGL14.EGL_BLUE_SIZE, 8,
            EGL14.EGL_ALPHA_SIZE, 8,
            EGL14.EGL_DEPTH_SIZE, 0,
            EGL14.EGL_STENCIL_SIZE, 0,
            EGLExt.EGL_RECORDABLE_ANDROID, 1,
            EGL14.EGL_NONE
        )
        val configs = arrayOfNulls<EGLConfig>(1)
        val numConfigs = IntArray(1)
        EGL14.eglChooseConfig(eglDisplay, configAttribs, 0, configs, 0, 1, numConfigs, 0)
        eglConfig = configs[0]

        val contextAttribs = intArrayOf(
            EGL14.EGL_CONTEXT_CLIENT_VERSION, 2,
            EGL14.EGL_NONE
        )
        eglContext = EGL14.eglCreateContext(eglDisplay, eglConfig, EGL14.EGL_NO_CONTEXT, contextAttribs, 0)

        val pbufferAttribs = intArrayOf(
            EGL14.EGL_WIDTH, 1,
            EGL14.EGL_HEIGHT, 1,
            EGL14.EGL_NONE
        )
        pbufferSurface = EGL14.eglCreatePbufferSurface(eglDisplay, eglConfig, pbufferAttribs, 0)
        EGL14.eglMakeCurrent(eglDisplay, pbufferSurface, pbufferSurface, eglContext)

        initShaders()
        initTexture()
    }

    private fun initShaders() {
        val vertexShaderSource = """
            attribute vec4 aPosition;
            attribute vec4 aTextureCoord;
            uniform mat4 uTransformMatrix;
            varying vec2 vTextureCoord;
            void main() {
                gl_Position = aPosition;
                vTextureCoord = (uTransformMatrix * aTextureCoord).xy;
            }
        """.trimIndent()

        val fragmentShaderSource = """
            #extension GL_OES_EGL_image_external : require
            precision mediump float;
            varying vec2 vTextureCoord;
            uniform samplerExternalOES sTexture;
            void main() {
                gl_FragColor = texture2D(sTexture, vTextureCoord);
            }
        """.trimIndent()

        val vShader = compileShader(GLES20.GL_VERTEX_SHADER, vertexShaderSource)
        val fShader = compileShader(GLES20.GL_FRAGMENT_SHADER, fragmentShaderSource)

        program = GLES20.glCreateProgram().also { prog ->
            GLES20.glAttachShader(prog, vShader)
            GLES20.glAttachShader(prog, fShader)
            GLES20.glLinkProgram(prog)
        }

        aPositionLoc = GLES20.glGetAttribLocation(program, "aPosition")
        aTextureCoordLoc = GLES20.glGetAttribLocation(program, "aTextureCoord")
        uTransformMatrixLoc = GLES20.glGetUniformLocation(program, "uTransformMatrix")
        sTextureLoc = GLES20.glGetUniformLocation(program, "sTexture")
    }

    private fun initTexture() {
        val texs = IntArray(1)
        GLES20.glGenTextures(1, texs, 0)
        textureId = texs[0]

        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
    }

    private fun compileShader(type: Int, shaderCode: String): Int {
        val shader = GLES20.glCreateShader(type)
        GLES20.glShaderSource(shader, shaderCode)
        GLES20.glCompileShader(shader)
        val status = IntArray(1)
        GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
        if (status[0] == 0) {
            val log = GLES20.glGetShaderInfoLog(shader)
            GLES20.glDeleteShader(shader)
            throw RuntimeException("Error compiling shader: $log")
        }
        return shader
    }

    override fun onInputSurface(surfaceRequest: SurfaceRequest) {
        glHandler.post {
            EGL14.eglMakeCurrent(eglDisplay, pbufferSurface, pbufferSurface, eglContext)
            inputSurfaceTexture?.release()
            inputSurface?.release()

            val st = SurfaceTexture(textureId).apply {
                setDefaultBufferSize(surfaceRequest.resolution.width, surfaceRequest.resolution.height)
                setOnFrameAvailableListener(this@HorizonLockSurfaceProcessor, glHandler)
            }
            inputSurfaceTexture = st
            val surf = Surface(st)
            inputSurface = surf

            surfaceRequest.provideSurface(surf, glExecutor) { result ->
                glHandler.post {
                    surf.release()
                    st.release()
                    if (inputSurface === surf) inputSurface = null
                    if (inputSurfaceTexture === st) inputSurfaceTexture = null
                }
            }
        }
    }

    override fun onOutputSurface(surfaceOutput: SurfaceOutput) {
        glHandler.post {
            try {
                EGL14.eglMakeCurrent(eglDisplay, pbufferSurface, pbufferSurface, eglContext)
                val surface = surfaceOutput.getSurface(glExecutor) {
                    glHandler.post {
                        val removed = outputTargets.remove(surfaceOutput)
                        if (removed != null) {
                            EGL14.eglDestroySurface(eglDisplay, removed.eglSurface)
                        }
                        surfaceOutput.close()
                    }
                }

                val windowAttribs = intArrayOf(EGL14.EGL_NONE)
                val eglWindowSurface = EGL14.eglCreateWindowSurface(eglDisplay, eglConfig, surface, windowAttribs, 0)
                if (eglWindowSurface == null || eglWindowSurface == EGL14.EGL_NO_SURFACE) {
                    Log.e(tag, "Failed to create EGL window surface for output")
                    return@post
                }

                outputTargets[surfaceOutput] = OutputTarget(
                    surfaceOutput = surfaceOutput,
                    eglSurface = eglWindowSurface,
                    width = surfaceOutput.size.width,
                    height = surfaceOutput.size.height
                )
            } catch (e: Exception) {
                Log.e(tag, "Error setting up output surface", e)
            }
        }
    }

    override fun onFrameAvailable(surfaceTexture: SurfaceTexture?) {
        val st = surfaceTexture ?: return

        EGL14.eglMakeCurrent(eglDisplay, pbufferSurface, pbufferSurface, eglContext)
        try {
            st.updateTexImage()
        } catch (e: Exception) {
            Log.w(tag, "Failed to updateTexImage", e)
            return
        }

        val timestamp = st.timestamp

        // Read base camera texture matrix
        val stMatrix = FloatArray(16)
        st.getTransformMatrix(stMatrix)

        // Read current smoothed accelerometer roll angle
        val rollDegrees = horizonManager.horizonState.value.smoothRoll
        val scaleFactor = horizonManager.horizonState.value.scaleFactor

        // Render to all active output surfaces (the VideoCapture recorder)
        val targets = outputTargets.values.toList()
        for (target in targets) {
            EGL14.eglMakeCurrent(eglDisplay, target.eglSurface, target.eglSurface, eglContext)
            GLES20.glViewport(0, 0, target.width, target.height)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT)

            // Let CameraX provide the baseline transform matrix for this specific output surface
            val surfaceMatrix = FloatArray(16)
            target.surfaceOutput.updateTransformMatrix(surfaceMatrix, stMatrix)

            // Compute Isotropic Aspect-Corrected Horizon Counter-Rotation Matrix
            // Scaling by (aspect, 1.0) into isotropic space before rotation and (1/aspect, 1.0) afterwards
            // guarantees pure rigid Euclidean rotation with ZERO stretching or distortion!
            val aspect = target.width.toFloat() / target.height.toFloat()
            val hMatrix = FloatArray(16)
            Matrix.setIdentityM(hMatrix, 0)

            if (isHorizonLockEnabled) {
                // Front-facing camera is mirrored horizontally, so roll direction must be negated
                val effectiveRoll = if (isFrontCamera) -rollDegrees else rollDegrees

                // In 0.6x mode with scale06To1x enabled, scaling sampling coordinates crops/scales it to 1.0x.
                // If scale06To1x is false, the full 0.6x ultra-wide view is retained.
                val zoomScale = if (isUltraWide06Mode && scale06To1x) ultraWideSensorZoom else (1.0f / scaleFactor)

                Matrix.translateM(hMatrix, 0, 0.5f, 0.5f, 0.0f)
                Matrix.scaleM(hMatrix, 0, 1.0f / aspect, 1.0f, 1.0f)
                Matrix.scaleM(hMatrix, 0, zoomScale, zoomScale, 1.0f)
                Matrix.rotateM(hMatrix, 0, effectiveRoll, 0.0f, 0.0f, 1.0f)
                Matrix.scaleM(hMatrix, 0, aspect, 1.0f, 1.0f)
                Matrix.translateM(hMatrix, 0, -0.5f, -0.5f, 0.0f)
            }

            val uTransformMatrix = FloatArray(16)
            if (isHorizonLockEnabled) {
                Matrix.multiplyMM(uTransformMatrix, 0, surfaceMatrix, 0, hMatrix, 0)
            } else {
                System.arraycopy(surfaceMatrix, 0, uTransformMatrix, 0, 16)
            }

            GLES20.glUseProgram(program)
            GLES20.glUniformMatrix4fv(uTransformMatrixLoc, 1, false, uTransformMatrix, 0)

            GLES20.glEnableVertexAttribArray(aPositionLoc)
            GLES20.glVertexAttribPointer(aPositionLoc, 2, GLES20.GL_FLOAT, false, 0, vertexBuffer)

            GLES20.glEnableVertexAttribArray(aTextureCoordLoc)
            GLES20.glVertexAttribPointer(aTextureCoordLoc, 2, GLES20.GL_FLOAT, false, 0, texCoordBuffer)

            GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
            GLES20.glUniform1i(sTextureLoc, 0)

            GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)

            GLES20.glDisableVertexAttribArray(aPositionLoc)
            GLES20.glDisableVertexAttribArray(aTextureCoordLoc)

            EGLExt.eglPresentationTimeANDROID(eglDisplay, target.eglSurface, timestamp)
            EGL14.eglSwapBuffers(eglDisplay, target.eglSurface)
        }
    }

    fun release() {
        glHandler.post {
            for (target in outputTargets.values) {
                EGL14.eglDestroySurface(eglDisplay, target.eglSurface)
            }
            outputTargets.clear()

            inputSurface?.release()
            inputSurfaceTexture?.release()

            if (program != 0) {
                GLES20.glDeleteProgram(program)
                program = 0
            }
            if (textureId != 0) {
                GLES20.glDeleteTextures(1, intArrayOf(textureId), 0)
                textureId = 0
            }
            if (pbufferSurface != EGL14.EGL_NO_SURFACE) {
                EGL14.eglDestroySurface(eglDisplay, pbufferSurface)
                pbufferSurface = EGL14.EGL_NO_SURFACE
            }
            if (eglContext != EGL14.EGL_NO_CONTEXT) {
                EGL14.eglDestroyContext(eglDisplay, eglContext)
                eglContext = EGL14.EGL_NO_CONTEXT
            }
            if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
                EGL14.eglTerminate(eglDisplay)
                eglDisplay = EGL14.EGL_NO_DISPLAY
            }
            glThread.quitSafely()
        }
    }
}
