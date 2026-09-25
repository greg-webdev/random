package com.infiniteprinter;

import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import org.lwjgl.glfw.GLFW;

public class PrinterKeybinds {
    public static KeyMapping togglePrinterKey;
    public static KeyMapping toggleBreakKey;
    public static KeyMapping toggleReachKey;
    public static KeyMapping openGuiKey;

    public static void register() {
        KeyMapping.Category category = KeyMapping.Category.register(
            Identifier.fromNamespaceAndPath("litematica_infinite_printer", "main")
        );

        togglePrinterKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.litematica_infinite_printer.toggle",
            GLFW.GLFW_KEY_CAPS_LOCK,
            category
        ));

        toggleBreakKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.litematica_infinite_printer.toggle_break",
            GLFW.GLFW_KEY_B,
            category
        ));

        toggleReachKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.litematica_infinite_printer.toggle_reach",
            GLFW.GLFW_KEY_N,
            category
        ));

        openGuiKey = KeyBindingHelper.registerKeyBinding(new KeyMapping(
            "key.litematica_infinite_printer.open_gui",
            GLFW.GLFW_KEY_O,
            category
        ));
    }

    public static void handleInput(Minecraft client) {
        if (client.player == null) return;
        PrinterConfig config = PrinterConfig.getInstance();

        while (togglePrinterKey.consumeClick()) {
            config.enabled = !config.enabled;
            PrinterConfig.save();
            client.player.displayClientMessage(
                Component.literal(config.enabled ? "§a[Printer] §lENABLED" : "§c[Printer] §lDISABLED"),
                true
            );
        }

        while (toggleBreakKey.consumeClick()) {
            config.autoBreak = !config.autoBreak;
            PrinterConfig.save();
            client.player.displayClientMessage(
                Component.literal(config.autoBreak ? "§a[Printer] Auto-Break §lENABLED" : "§c[Printer] Auto-Break §lDISABLED"),
                true
            );
        }

        while (toggleReachKey.consumeClick()) {
            config.infiniteReach = !config.infiniteReach;
            PrinterConfig.save();
            client.player.displayClientMessage(
                Component.literal(config.infiniteReach ? "§b[Printer] Reach: §lINFINITE (∞)" : String.format("§e[Printer] Reach: §l%.0fm", config.reachDistance)),
                true
            );
        }

        while (openGuiKey.consumeClick()) {
            client.setScreen(new PrinterConfigScreen(null));
        }
    }
}
