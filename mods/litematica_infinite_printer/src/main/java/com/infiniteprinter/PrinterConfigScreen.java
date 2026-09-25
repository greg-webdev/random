package com.infiniteprinter;

import net.minecraft.ChatFormatting;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

public class PrinterConfigScreen extends Screen {
    private final Screen parent;

    public PrinterConfigScreen(Screen parent) {
        super(Component.literal("Litematica Infinite Printer Settings"));
        this.parent = parent;
    }

    @Override
    protected void init() {
        PrinterConfig config = PrinterConfig.getInstance();
        int btnWidth = 175;
        int btnHeight = 20;
        int col1X = this.width / 2 - btnWidth - 8;
        int col2X = this.width / 2 + 8;
        int startY = 36;
        int rowSpacing = 23;

        // Row 1: Printer Enabled & Auto-Break
        this.addRenderableWidget(Button.builder(
            getPrinterButtonText(config),
            btn -> {
                config.enabled = !config.enabled;
                PrinterConfig.save();
                btn.setMessage(getPrinterButtonText(config));
            }
        ).bounds(col1X, startY, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getAutoBreakButtonText(config),
            btn -> {
                config.autoBreak = !config.autoBreak;
                PrinterConfig.save();
                btn.setMessage(getAutoBreakButtonText(config));
            }
        ).bounds(col2X, startY, btnWidth, btnHeight).build());

        // Row 2: Infinite Reach & Reach Distance
        this.addRenderableWidget(Button.builder(
            getReachModeButtonText(config),
            btn -> {
                config.infiniteReach = !config.infiniteReach;
                PrinterConfig.save();
                btn.setMessage(getReachModeButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getReachDistButtonText(config),
            btn -> {
                double[] steps = {16.0, 32.0, 64.0, 128.0, 256.0};
                int nextIdx = 0;
                for (int i = 0; i < steps.length; i++) {
                    if (Math.abs(config.reachDistance - steps[i]) < 0.1) {
                        nextIdx = (i + 1) % steps.length;
                        break;
                    }
                }
                config.reachDistance = steps[nextIdx];
                PrinterConfig.save();
                btn.setMessage(getReachDistButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing, btnWidth, btnHeight).build());

        // Row 3: Place Speed & Break Speed
        this.addRenderableWidget(Button.builder(
            getPlaceSpeedButtonText(config),
            btn -> {
                int[] speeds = {1, 2, 4, 8, 16, 32, 64};
                int nextIdx = 0;
                for (int i = 0; i < speeds.length; i++) {
                    if (config.blocksPerTick == speeds[i]) {
                        nextIdx = (i + 1) % speeds.length;
                        break;
                    }
                }
                config.blocksPerTick = speeds[nextIdx];
                PrinterConfig.save();
                btn.setMessage(getPlaceSpeedButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 2, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getBreakSpeedButtonText(config),
            btn -> {
                int[] speeds = {1, 2, 4, 8, 16};
                int nextIdx = 0;
                for (int i = 0; i < speeds.length; i++) {
                    if (config.breaksPerTick == speeds[i]) {
                        nextIdx = (i + 1) % speeds.length;
                        break;
                    }
                }
                config.breaksPerTick = speeds[nextIdx];
                PrinterConfig.save();
                btn.setMessage(getBreakSpeedButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 2, btnWidth, btnHeight).build());

        // Row 4: Bottom-To-Top & Redstone Safe Order
        this.addRenderableWidget(Button.builder(
            getBottomToTopButtonText(config),
            btn -> {
                config.bottomToTop = !config.bottomToTop;
                PrinterConfig.save();
                btn.setMessage(getBottomToTopButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 3, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getRedstoneSafeButtonText(config),
            btn -> {
                config.redstoneSafeOrder = !config.redstoneSafeOrder;
                PrinterConfig.save();
                btn.setMessage(getRedstoneSafeButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 3, btnWidth, btnHeight).build());

        // Row 5: Layer Range & Suppress Updates
        this.addRenderableWidget(Button.builder(
            getLayerRangeButtonText(config),
            btn -> {
                config.respectLayerRange = !config.respectLayerRange;
                PrinterConfig.save();
                btn.setMessage(getLayerRangeButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 4, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getSuppressUpdatesButtonText(config),
            btn -> {
                config.suppressRedstoneUpdates = !config.suppressRedstoneUpdates;
                PrinterConfig.save();
                btn.setMessage(getSuppressUpdatesButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 4, btnWidth, btnHeight).build());

        // Row 6: Auto-Switch Tool & Auto-Switch Item
        this.addRenderableWidget(Button.builder(
            getAutoSwitchToolButtonText(config),
            btn -> {
                config.autoSwitchTool = !config.autoSwitchTool;
                PrinterConfig.save();
                btn.setMessage(getAutoSwitchToolButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 5, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getAutoSwitchItemButtonText(config),
            btn -> {
                config.autoSwitchItem = !config.autoSwitchItem;
                PrinterConfig.save();
                btn.setMessage(getAutoSwitchItemButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 5, btnWidth, btnHeight).build());

        // Row 7: Auto-Adjust BlockState & HUD Overlay
        this.addRenderableWidget(Button.builder(
            getAutoAdjustButtonText(config),
            btn -> {
                config.autoAdjustBlockState = !config.autoAdjustBlockState;
                PrinterConfig.save();
                btn.setMessage(getAutoAdjustButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 6, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getHudOverlayButtonText(config),
            btn -> {
                config.renderOverlay = !config.renderOverlay;
                PrinterConfig.save();
                btn.setMessage(getHudOverlayButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 6, btnWidth, btnHeight).build());

        // Row 8: Commands (/setblock) & Clear Air
        this.addRenderableWidget(Button.builder(
            getCommandModeButtonText(config),
            btn -> {
                config.useCommands = !config.useCommands;
                PrinterConfig.save();
                btn.setMessage(getCommandModeButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 7, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getBreakAirButtonText(config),
            btn -> {
                config.breakAirBlocks = !config.breakAirBlocks;
                PrinterConfig.save();
                btn.setMessage(getBreakAirButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 7, btnWidth, btnHeight).build());

        // Row 9: Auto-Spawn Mobs & Lag Watchdog
        this.addRenderableWidget(Button.builder(
            getAutoSpawnMobsButtonText(config),
            btn -> {
                config.autoSpawnMobs = !config.autoSpawnMobs;
                PrinterConfig.save();
                btn.setMessage(getAutoSpawnMobsButtonText(config));
            }
        ).bounds(col1X, startY + rowSpacing * 8, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            getLagWatchdogButtonText(config),
            btn -> {
                config.lagWatchdog = !config.lagWatchdog;
                PrinterConfig.save();
                btn.setMessage(getLagWatchdogButtonText(config));
            }
        ).bounds(col2X, startY + rowSpacing * 8, btnWidth, btnHeight).build());

        // Row 10: Reset Counters & Done
        this.addRenderableWidget(Button.builder(
            Component.literal("Reset Counters").withStyle(ChatFormatting.YELLOW),
            btn -> {
                PrinterEngine.getInstance().resetStats();
                btn.setMessage(Component.literal("✔ Cleared!").withStyle(ChatFormatting.GREEN));
            }
        ).bounds(col1X, startY + rowSpacing * 9, btnWidth, btnHeight).build());

        this.addRenderableWidget(Button.builder(
            Component.literal("Done").withStyle(ChatFormatting.WHITE),
            btn -> {
                PrinterConfig.save();
                if (this.minecraft != null) {
                    this.minecraft.setScreen(this.parent);
                }
            }
        ).bounds(col2X, startY + rowSpacing * 9, btnWidth, btnHeight).build());
    }

    private Component getLagWatchdogButtonText(PrinterConfig config) {
        return Component.literal("Lag Watchdog (2s): ").append(
            Component.literal(config.lagWatchdog ? "ENABLED" : "DISABLED")
                .withStyle(config.lagWatchdog ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getAutoSpawnMobsButtonText(PrinterConfig config) {
        return Component.literal("Spawn Mobs: ").append(
            Component.literal(config.autoSpawnMobs ? "ENABLED" : "DISABLED")
                .withStyle(config.autoSpawnMobs ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getCommandModeButtonText(PrinterConfig config) {
        return Component.literal("Command Mode: ").append(
            Component.literal(config.useCommands ? "ON (/setblock)" : "OFF (Packets)")
                .withStyle(config.useCommands ? ChatFormatting.GREEN : ChatFormatting.GOLD)
        );
    }

    private Component getBreakAirButtonText(PrinterConfig config) {
        return Component.literal("Clear Air: ").append(
            Component.literal(config.breakAirBlocks ? "BREAK ALL" : "OBSTACLES ONLY")
                .withStyle(config.breakAirBlocks ? ChatFormatting.RED : ChatFormatting.GREEN)
        );
    }

    private Component getPrinterButtonText(PrinterConfig config) {
        return Component.literal("Printer: ").append(
            Component.literal(config.enabled ? "ENABLED" : "DISABLED")
                .withStyle(config.enabled ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getAutoBreakButtonText(PrinterConfig config) {
        return Component.literal("Auto-Break: ").append(
            Component.literal(config.autoBreak ? "ENABLED" : "DISABLED")
                .withStyle(config.autoBreak ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getReachModeButtonText(PrinterConfig config) {
        return Component.literal("Reach: ").append(
            Component.literal(config.infiniteReach ? "INFINITE (∞)" : "LIMITED")
                .withStyle(config.infiniteReach ? ChatFormatting.AQUA : ChatFormatting.GOLD)
        );
    }

    private Component getReachDistButtonText(PrinterConfig config) {
        return Component.literal(String.format("Reach Dist: %.0fm", config.reachDistance))
            .withStyle(config.infiniteReach ? ChatFormatting.DARK_GRAY : ChatFormatting.WHITE);
    }

    private Component getPlaceSpeedButtonText(PrinterConfig config) {
        return Component.literal("Place Speed: " + config.blocksPerTick + " /tick");
    }

    private Component getBreakSpeedButtonText(PrinterConfig config) {
        return Component.literal("Break Speed: " + config.breaksPerTick + " /tick");
    }

    private Component getBottomToTopButtonText(PrinterConfig config) {
        return Component.literal("Order: ").append(
            Component.literal(config.bottomToTop ? "Bottom-To-Top" : "Nearest First")
                .withStyle(ChatFormatting.WHITE)
        );
    }

    private Component getRedstoneSafeButtonText(PrinterConfig config) {
        return Component.literal("Redstone Safe: ").append(
            Component.literal(config.redstoneSafeOrder ? "STORAGES 1ST" : "OFF")
                .withStyle(config.redstoneSafeOrder ? ChatFormatting.GREEN : ChatFormatting.GRAY)
        );
    }

    private Component getLayerRangeButtonText(PrinterConfig config) {
        return Component.literal("Layer Range: ").append(
            Component.literal(config.respectLayerRange ? "RESPECT" : "IGNORE")
                .withStyle(config.respectLayerRange ? ChatFormatting.GREEN : ChatFormatting.GOLD)
        );
    }

    private Component getSuppressUpdatesButtonText(PrinterConfig config) {
        return Component.literal("Suppress Updates: ").append(
            Component.literal(config.suppressRedstoneUpdates ? "ON" : "OFF")
                .withStyle(config.suppressRedstoneUpdates ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getAutoSwitchToolButtonText(PrinterConfig config) {
        return Component.literal("Auto Tool: ").append(
            Component.literal(config.autoSwitchTool ? "ON" : "OFF")
                .withStyle(config.autoSwitchTool ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getAutoSwitchItemButtonText(PrinterConfig config) {
        return Component.literal("Auto Item Pick: ").append(
            Component.literal(config.autoSwitchItem ? "ON" : "OFF")
                .withStyle(config.autoSwitchItem ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getAutoAdjustButtonText(PrinterConfig config) {
        return Component.literal("Auto BlockState: ").append(
            Component.literal(config.autoAdjustBlockState ? "ON" : "OFF")
                .withStyle(config.autoAdjustBlockState ? ChatFormatting.GREEN : ChatFormatting.RED)
        );
    }

    private Component getHudOverlayButtonText(PrinterConfig config) {
        return Component.literal("HUD Overlay: ").append(
            Component.literal(config.renderOverlay ? "SHOWN" : "HIDDEN")
                .withStyle(config.renderOverlay ? ChatFormatting.GREEN : ChatFormatting.GRAY)
        );
    }

    @Override
    public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
        super.render(guiGraphics, mouseX, mouseY, partialTick);

        guiGraphics.drawCenteredString(this.font, "⚡ Litematica Infinite Printer Configuration", this.width / 2, 10, 0xFF00E5FF);
        guiGraphics.drawCenteredString(this.font, "Redstone Update Suppression & Anti-Spam Staged Building", this.width / 2, 22, 0xFFAAAAAA);
    }

    @Override
    public void onClose() {
        PrinterConfig.save();
        super.onClose();
    }
}
