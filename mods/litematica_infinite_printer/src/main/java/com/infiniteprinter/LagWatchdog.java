package com.infiniteprinter;

import net.minecraft.client.Minecraft;
import net.minecraft.server.MinecraftServer;

public class LagWatchdog {
    private static final LagWatchdog INSTANCE = new LagWatchdog();

    private long lastTickRealTime = 0;
    private int lagPauseRemainingTicks = 0;
    private int gracePeriodTicks = 0; // Grace period after pause before re-triggering
    private int consecutiveSlowTicks = 0; // Require sustained lag before pausing
    private String lastLagReason = "";
    private long totalLagPauses = 0;

    public static LagWatchdog getInstance() {
        return INSTANCE;
    }

    /**
     * Checks all lag vectors (client freeze, low FPS, server tick overload).
     * If genuine lag is detected, pauses the printer for the configured duration (default: 40 ticks = 2 seconds).
     *
     * @return true if printing should be paused due to lag
     */
    public boolean checkAndPause(Minecraft client, PrinterConfig config) {
        if (!config.lagWatchdog) {
            return false;
        }

        long now = System.currentTimeMillis();

        // 1. If currently paused, decrement and maintain pause
        if (lagPauseRemainingTicks > 0) {
            lagPauseRemainingTicks--;
            lastTickRealTime = now;
            if (lagPauseRemainingTicks == 0) {
                // When pause expires, give 20 ticks (1.0s) grace period so it doesn't instantly re-pause
                gracePeriodTicks = 20;
                consecutiveSlowTicks = 0;
            }
            return true;
        }

        if (gracePeriodTicks > 0) {
            gracePeriodTicks--;
            lastTickRealTime = now;
            return false;
        }

        if (lastTickRealTime == 0) {
            lastTickRealTime = now;
            return false;
        }

        long deltaMs = now - lastTickRealTime;
        lastTickRealTime = now;

        // 2. Real Freeze Detection: tick took > maxTickDeltaMs (default 250ms = quarter second stall)
        if (deltaMs > config.maxTickDeltaMs) {
            triggerPause(config, String.format("Client Freeze: %dms", deltaMs));
            return true;
        }

        // 3. Low FPS Detection: only trigger if FPS is near zero (< 5 FPS)
        int currentFps = client.getFps();
        if (currentFps > 0 && currentFps < config.minFpsThreshold) {
            consecutiveSlowTicks++;
            if (consecutiveSlowTicks >= 3) {
                triggerPause(config, String.format("Severe FPS Drop: %d fps", currentFps));
                return true;
            }
            return false;
        }

        // 4. Integrated Server Tick Lag (Singleplayer)
        MinecraftServer server = client.getSingleplayerServer();
        if (server != null) {
            float avgTickTimeMs = server.getAverageTickTimeNanos() / 1_000_000.0f;
            // 50ms = 20 TPS. If tick time > 50ms, server is falling behind.
            // Require sustained overload (> 52ms for 3 consecutive checks) or extreme spike (> 85ms)
            if (avgTickTimeMs > 85.0f) {
                triggerPause(config, String.format("Critical Server Lag: %.0fms", avgTickTimeMs));
                return true;
            } else if (avgTickTimeMs > config.maxServerTickTimeMs) {
                consecutiveSlowTicks++;
                if (consecutiveSlowTicks >= 3) {
                    triggerPause(config, String.format("Server Overload: %.0fms (TPS < 20)", avgTickTimeMs));
                    return true;
                }
                return false;
            }
        }

        consecutiveSlowTicks = 0;
        return false;
    }

    private void triggerPause(PrinterConfig config, String reason) {
        this.lagPauseRemainingTicks = config.lagPauseTicks; // 40 ticks = 2.0s
        this.lastLagReason = reason;
        this.consecutiveSlowTicks = 0;
        this.totalLagPauses++;
        InfinitePrinterMod.LOGGER.warn("[Printer Lag Watchdog] Lag detected ({}). Pausing printer for {} ticks ({}s).",
            reason, config.lagPauseTicks, String.format("%.1f", config.lagPauseTicks / 20.0f));
    }

    public boolean isLagPaused() {
        return lagPauseRemainingTicks > 0;
    }

    public int getLagPauseRemainingTicks() {
        return lagPauseRemainingTicks;
    }

    public float getLagPauseRemainingSeconds() {
        return lagPauseRemainingTicks / 20.0f;
    }

    public String getLastLagReason() {
        return lastLagReason;
    }

    public long getTotalLagPauses() {
        return totalLagPauses;
    }

    public void reset() {
        lagPauseRemainingTicks = 0;
        gracePeriodTicks = 0;
        consecutiveSlowTicks = 0;
        lastLagReason = "";
        lastTickRealTime = 0;
    }
}
