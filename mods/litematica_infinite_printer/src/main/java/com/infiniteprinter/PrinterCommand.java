package com.infiniteprinter;

import com.mojang.brigadier.arguments.BoolArgumentType;
import com.mojang.brigadier.arguments.DoubleArgumentType;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandManager;
import net.fabricmc.fabric.api.client.command.v2.ClientCommandRegistrationCallback;
import net.fabricmc.fabric.api.client.command.v2.FabricClientCommandSource;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;

public class PrinterCommand {

    public static void register() {
        ClientCommandRegistrationCallback.EVENT.register((dispatcher, registryAccess) -> {
            dispatcher.register(
                ClientCommandManager.literal("printer")
                    .then(ClientCommandManager.literal("toggle")
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.enabled = !config.enabled;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Printer is now " + (config.enabled ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("autobreak")
                        .then(ClientCommandManager.argument("enabled", BoolArgumentType.bool())
                            .executes(context -> {
                                boolean val = BoolArgumentType.getBool(context, "enabled");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.autoBreak = val;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Auto-Break set to " + (val ? "§aENABLED" : "§cDISABLED"));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.autoBreak = !config.autoBreak;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Auto-Break is now " + (config.autoBreak ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("blockstate")
                        .then(ClientCommandManager.argument("enabled", BoolArgumentType.bool())
                            .executes(context -> {
                                boolean val = BoolArgumentType.getBool(context, "enabled");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.autoAdjustBlockState = val;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Auto BlockState adjustment set to " + (val ? "§aENABLED" : "§cDISABLED"));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.autoAdjustBlockState = !config.autoAdjustBlockState;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Auto BlockState adjustment is now " + (config.autoAdjustBlockState ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("commands")
                        .then(ClientCommandManager.argument("enabled", BoolArgumentType.bool())
                            .executes(context -> {
                                boolean val = BoolArgumentType.getBool(context, "enabled");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.useCommands = val;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Command placement (/setblock) set to " + (val ? "§aENABLED" : "§cDISABLED"));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.useCommands = !config.useCommands;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Command placement (/setblock) is now " + (config.useCommands ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("mobs")
                        .then(ClientCommandManager.argument("enabled", BoolArgumentType.bool())
                            .executes(context -> {
                                boolean val = BoolArgumentType.getBool(context, "enabled");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.autoSpawnMobs = val;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Auto-Spawn Mobs set to " + (val ? "§aENABLED" : "§cDISABLED"));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.autoSpawnMobs = !config.autoSpawnMobs;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Auto-Spawn Mobs is now " + (config.autoSpawnMobs ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("watchdog")
                        .then(ClientCommandManager.argument("enabled", BoolArgumentType.bool())
                            .executes(context -> {
                                boolean val = BoolArgumentType.getBool(context, "enabled");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.lagWatchdog = val;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Lag Watchdog (2s pause on lag) set to " + (val ? "§aENABLED" : "§cDISABLED"));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.lagWatchdog = !config.lagWatchdog;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Lag Watchdog (2s pause on lag) is now " + (config.lagWatchdog ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("redstone")
                        .then(ClientCommandManager.argument("enabled", BoolArgumentType.bool())
                            .executes(context -> {
                                boolean val = BoolArgumentType.getBool(context, "enabled");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.redstoneSafeOrder = val;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Redstone Mode (Storages first, Redstone last) set to " + (val ? "§aENABLED" : "§cDISABLED"));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.redstoneSafeOrder = !config.redstoneSafeOrder;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), "Redstone Mode (Storages first, Redstone last) is now " + (config.redstoneSafeOrder ? "§aENABLED" : "§cDISABLED"));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("reach")
                        .then(ClientCommandManager.literal("infinite")
                            .executes(context -> {
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.infiniteReach = true;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Reach set to §bINFINITE (∞)");
                                return 1;
                            })
                        )
                        .then(ClientCommandManager.argument("blocks", DoubleArgumentType.doubleArg(3.0, 512.0))
                            .executes(context -> {
                                double blocks = DoubleArgumentType.getDouble(context, "blocks");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.infiniteReach = false;
                                config.reachDistance = blocks;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), String.format("Reach set to §e%.1fm", blocks));
                                return 1;
                            })
                        )
                        .executes(context -> {
                            PrinterConfig config = PrinterConfig.getInstance();
                            config.infiniteReach = !config.infiniteReach;
                            PrinterConfig.save();
                            sendFeedback(context.getSource(), config.infiniteReach ? "Reach set to §bINFINITE (∞)" : String.format("Reach set to §e%.1fm", config.reachDistance));
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("speed")
                        .then(ClientCommandManager.argument("blocks_per_tick", IntegerArgumentType.integer(1, 64))
                            .executes(context -> {
                                int speed = IntegerArgumentType.getInteger(context, "blocks_per_tick");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.blocksPerTick = speed;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Placement speed set to §e" + speed + " blocks/tick");
                                return 1;
                            })
                        )
                    )
                    .then(ClientCommandManager.literal("breakspeed")
                        .then(ClientCommandManager.argument("breaks_per_tick", IntegerArgumentType.integer(1, 32))
                            .executes(context -> {
                                int speed = IntegerArgumentType.getInteger(context, "breaks_per_tick");
                                PrinterConfig config = PrinterConfig.getInstance();
                                config.breaksPerTick = speed;
                                PrinterConfig.save();
                                sendFeedback(context.getSource(), "Break speed set to §e" + speed + " blocks/tick");
                                return 1;
                            })
                        )
                    )
                    .then(ClientCommandManager.literal("gui")
                        .executes(context -> {
                            Minecraft.getInstance().execute(() -> {
                                Minecraft.getInstance().setScreen(new PrinterConfigScreen(null));
                            });
                            return 1;
                        })
                    )
                    .then(ClientCommandManager.literal("reset")
                        .executes(context -> {
                            PrinterEngine.getInstance().resetStats();
                            sendFeedback(context.getSource(), "Printer statistics reset.");
                            return 1;
                        })
                    )
                    .executes(context -> {
                        showStatus(context.getSource());
                        return 1;
                    })
            );
        });
    }

    private static void sendFeedback(FabricClientCommandSource source, String text) {
        source.sendFeedback(Component.literal("§7[§bPrinter§7] " + text));
    }

    private static void showStatus(FabricClientCommandSource source) {
        PrinterConfig config = PrinterConfig.getInstance();
        PrinterEngine engine = PrinterEngine.getInstance();

        source.sendFeedback(Component.literal("========================================").withStyle(ChatFormatting.DARK_AQUA));
        source.sendFeedback(Component.literal("⚡ LITEMATICA INFINITE PRINTER").withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD));
        source.sendFeedback(Component.literal(" Status: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.enabled ? "ENABLED" : "DISABLED").withStyle(config.enabled ? ChatFormatting.GREEN : ChatFormatting.RED, ChatFormatting.BOLD)));
        source.sendFeedback(Component.literal(" Auto-Break: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.autoBreak ? "ON" : "OFF").withStyle(config.autoBreak ? ChatFormatting.GREEN : ChatFormatting.RED)));
        source.sendFeedback(Component.literal(" Command Mode (/setblock): ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.useCommands ? "ON" : "OFF").withStyle(config.useCommands ? ChatFormatting.GREEN : ChatFormatting.RED)));
        source.sendFeedback(Component.literal(" Auto-Spawn Mobs: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.autoSpawnMobs ? "ON" : "OFF").withStyle(config.autoSpawnMobs ? ChatFormatting.GREEN : ChatFormatting.RED)));
        source.sendFeedback(Component.literal(" Redstone Safe Mode: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.redstoneSafeOrder ? "ON (Storages First)" : "OFF").withStyle(config.redstoneSafeOrder ? ChatFormatting.GREEN : ChatFormatting.RED)));
        source.sendFeedback(Component.literal(" Lag Watchdog (2s): ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.lagWatchdog ? (LagWatchdog.getInstance().isLagPaused() ? "PAUSED (LAG)" : "ARMED") : "OFF")
                .withStyle(config.lagWatchdog ? (LagWatchdog.getInstance().isLagPaused() ? ChatFormatting.GOLD : ChatFormatting.GREEN) : ChatFormatting.RED)));
        source.sendFeedback(Component.literal(" Reach Mode: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.infiniteReach ? "INFINITE (∞)" : String.format("%.1fm", config.reachDistance)).withStyle(config.infiniteReach ? ChatFormatting.AQUA : ChatFormatting.YELLOW)));
        source.sendFeedback(Component.literal(" Speeds: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(config.blocksPerTick + " place/tick, " + config.breaksPerTick + " break/tick").withStyle(ChatFormatting.WHITE)));
        String mobQStr = engine.getRemainingToSpawn() > 0 ? (", " + engine.getRemainingToSpawn() + " mobs") : "";
        source.sendFeedback(Component.literal(" Queue: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(engine.getRemainingToPlace() + " to place, " + engine.getRemainingToBreak() + " to break" + mobQStr).withStyle(ChatFormatting.YELLOW)));
        String mobTotStr = engine.getTotalSpawned() > 0 ? (", " + engine.getTotalSpawned() + " spawned") : "";
        source.sendFeedback(Component.literal(" Total: ").withStyle(ChatFormatting.GRAY)
            .append(Component.literal(engine.getTotalPlaced() + " placed, " + engine.getTotalBroken() + " broken" + mobTotStr).withStyle(ChatFormatting.GREEN)));
        source.sendFeedback(Component.literal(" Hotkeys: CAPS LOCK (Toggle) | B (Auto-Break) | N (Reach) | O (GUI)").withStyle(ChatFormatting.DARK_GRAY));
        source.sendFeedback(Component.literal("========================================").withStyle(ChatFormatting.DARK_AQUA));
    }
}
