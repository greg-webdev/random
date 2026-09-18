package com.rendermod;

import com.rendermod.command.RenderCommand;
import com.rendermod.core.RenderManager;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RenderMod implements ModInitializer {
	public static final String MOD_ID = "render_mod";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing 60 FPS Render & World Recorder Mod for Minecraft 1.21.11!");

		// Register /render command
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			RenderCommand.register(dispatcher);
		});

		// Server tick listener for rendering simulation
		ServerTickEvents.END_SERVER_TICK.register(RenderManager.getInstance()::onServerTick);
	}
}
