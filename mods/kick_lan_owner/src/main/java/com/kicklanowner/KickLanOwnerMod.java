package com.kicklanowner;

import com.kicklanowner.commands.KickOwnerCommand;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class KickLanOwnerMod implements ModInitializer {
	public static final String MOD_ID = "kick_lan_owner";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing Kick LAN Owner Mod!");

		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			KickOwnerCommand.register(dispatcher);

			dispatcher.register(net.minecraft.commands.Commands.literal("talk")
				.requires(source -> true)
				.executes(ctx -> {
					ctx.getSource().sendSuccess(() -> net.minecraft.network.chat.Component.literal("§6[Talk Studio] §e/talk opens the interactive Tellraw Studio GUI on clients with this mod installed!"), false);
					return 1;
				})
			);
		});

		LOGGER.info("Kick LAN Owner Mod initialized successfully.");
	}
}
