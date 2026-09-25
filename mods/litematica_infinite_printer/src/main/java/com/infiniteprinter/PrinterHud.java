package com.infiniteprinter;

import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.DeltaTracker;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font;
import net.minecraft.client.gui.GuiGraphics;

public class PrinterHud implements HudRenderCallback {

    @Override
    public void onHudRender(GuiGraphics guiGraphics, DeltaTracker deltaTracker) {
        PrinterConfig config = PrinterConfig.getInstance();
        if (!config.renderOverlay) {
            return;
        }

        Minecraft client = Minecraft.getInstance();
        if (client.options.hideGui || client.player == null) {
            return;
        }

        PrinterEngine engine = PrinterEngine.getInstance();
        Font font = client.font;

        int x = 10;
        int y = 10;

        if (!config.enabled) {
            // Minimal compact badge when idle
            int boxWidth = 145;
            int boxHeight = 18;
            guiGraphics.fill(x, y, x + boxWidth, y + boxHeight, 0xAA121620);
            guiGraphics.fill(x, y, x + 2, y + boxHeight, 0xFF888888);
            guiGraphics.drawString(font, "⚡ Printer: [OFF]", x + 8, y + 5, 0xFFAAAAAA, false);
            guiGraphics.drawString(font, "(CAPS LOCK)", x + 88, y + 5, 0xFF666666, false);
            return;
        }

        LagWatchdog watchdog = LagWatchdog.getInstance();
        boolean isLagPaused = watchdog.isLagPaused();

        // Active HUD Card
        int boxWidth = 220;
        int boxHeight = 64;

        // Background & glowing cyan accent (turns red on lag pause)
        guiGraphics.fill(x, y, x + boxWidth, y + boxHeight, 0xDD0D1117);
        guiGraphics.fill(x, y, x + boxWidth, y + 2, isLagPaused ? 0xFFFF3333 : 0xFF00E5FF);

        // Header
        guiGraphics.drawString(font, "⚡ LITEMATICA PRINTER", x + 8, y + 7, 0xFF00E5FF, true);
        if (isLagPaused) {
            String lagBadge = String.format("[LAG: %.1fs]", watchdog.getLagPauseRemainingSeconds());
            guiGraphics.drawString(font, lagBadge, x + 138, y + 7, 0xFFFF4444, true);
        } else {
            guiGraphics.drawString(font, "[ACTIVE]", x + 155, y + 7, 0xFF00FF66, true);
        }

        // Row 1: Break & Reach status
        String breakStatus = config.autoBreak ? "§aON" : "§cOFF";
        String reachStatus = config.infiniteReach ? "§b∞ INFINITE" : String.format("§e%.0fm", config.reachDistance);
        guiGraphics.drawString(font, "⛏ Auto-Break: " + breakStatus, x + 8, y + 20, 0xFFE0E0E0, false);
        guiGraphics.drawString(font, "🎯 Reach: " + reachStatus, x + 115, y + 20, 0xFFE0E0E0, false);

        // Row 2: Queue counts
        String mobQueueStr = engine.getRemainingToSpawn() > 0 ? String.format(" | §e%d §7mobs", engine.getRemainingToSpawn()) : "";
        String placeCountStr = engine.hasMoreBlocks() ? String.format("%d+", engine.getRemainingToPlace()) : String.valueOf(engine.getRemainingToPlace());
        String queueText = String.format("📦 Queue: §b%s §7place | §c%d §7break | §d%d §7adjust%s",
            placeCountStr, engine.getRemainingToBreak(), engine.getRemainingToAdjust(), mobQueueStr);
        guiGraphics.drawString(font, queueText, x + 8, y + 33, 0xFFE0E0E0, false);

        // Row 3: Speed & Total Placed/Broken/Adjusted/Spawned
        String mobTotalStr = engine.getTotalSpawned() > 0 ? String.format(" §7| Mobs: §e%d", engine.getTotalSpawned()) : "";
        String statsText = String.format("⚡ %d/t | Placed: §a%d §7| Broken: §6%d §7| Set: §d%d%s",
            config.blocksPerTick, engine.getTotalPlaced(), engine.getTotalBroken(), engine.getTotalAdjusted(), mobTotalStr);
        guiGraphics.drawString(font, statsText, x + 8, y + 47, 0xFFAAAAAA, false);

        // Lag Alert Banner below HUD when paused
        if (isLagPaused) {
            int alertY = y + boxHeight + 4;
            int alertHeight = 24;
            guiGraphics.fill(x, alertY, x + boxWidth, alertY + alertHeight, 0xEE330808);
            guiGraphics.fill(x, alertY, x + boxWidth, alertY + 2, 0xFFFF3333);
            guiGraphics.drawString(font, String.format("⚠ LAG DETECTED - PAUSED (%.1fs)", watchdog.getLagPauseRemainingSeconds()), x + 8, alertY + 5, 0xFFFF5555, true);
            guiGraphics.drawString(font, "§c" + watchdog.getLastLagReason(), x + 8, alertY + 14, 0xFFFFAAAA, false);
        }
    }
}
