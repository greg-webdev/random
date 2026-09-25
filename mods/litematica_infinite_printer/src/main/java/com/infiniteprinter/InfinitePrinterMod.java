package com.infiniteprinter;

import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class InfinitePrinterMod implements ClientModInitializer {
    public static final String MOD_ID = "litematica_infinite_printer";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    @Override
    public void onInitializeClient() {
        LOGGER.info("Initializing Litematica Infinite Printer...");

        // Load persisted settings
        PrinterConfig.load();

        // Register Keybindings
        PrinterKeybinds.register();

        // Register In-Game Commands (/printer)
        PrinterCommand.register();

        // Register HUD Overlay
        HudRenderCallback.EVENT.register(new PrinterHud());

        // Filter setblock and summon command spam from chat
        net.fabricmc.fabric.api.client.message.v1.ClientReceiveMessageEvents.ALLOW_GAME.register((message, overlay) -> {
            if (PrinterConfig.getInstance().useCommands) {
                String text = message.getString();
                if (text.startsWith("Changed the block at")
                        || text.startsWith("Could not set the block")
                        || text.startsWith("Summoned new")
                        || text.startsWith("Unable to summon")
                        || text.startsWith("Could not summon")) {
                    return false;
                }
            }
            return true;
        });

        // Register Client Tick Loop
        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            PrinterKeybinds.handleInput(client);
            PrinterEngine.getInstance().onClientTick(client);
        });

        LOGGER.info("Litematica Infinite Printer successfully initialized!");
    }
}
