package com.kicklanowner.commands;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

public class KickOwnerCommand {

	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		registerCommand(dispatcher, "kickowner");
		registerCommand(dispatcher, "kickhost");
		registerCommand(dispatcher, "kicklanowner");
	}

	private static void registerCommand(CommandDispatcher<CommandSourceStack> dispatcher, String commandName) {
		LiteralArgumentBuilder<CommandSourceStack> builder = Commands.literal(commandName)
			.requires(source -> true) // Allows any player (guests or ops) on LAN to execute
			.executes(ctx -> executeKick(ctx, Component.literal("Kicked from LAN game")))
			.then(Commands.literal("info")
				.executes(KickOwnerCommand::executeInfo))
			.then(Commands.argument("reason", StringArgumentType.greedyString())
				.executes(ctx -> {
					String reasonStr = StringArgumentType.getString(ctx, "reason");
					return executeKick(ctx, Component.literal(reasonStr));
				}));

		dispatcher.register(builder);
	}

	public static ServerPlayer findLanOwner(MinecraftServer server) {
		for (ServerPlayer player : server.getPlayerList().getPlayers()) {
			if (server.isSingleplayerOwner(player.nameAndId())) {
				return player;
			}
		}
		return null;
	}

	private static int executeInfo(CommandContext<CommandSourceStack> context) {
		CommandSourceStack source = context.getSource();
		MinecraftServer server = source.getServer();

		ServerPlayer owner = findLanOwner(server);
		if (owner != null) {
			source.sendSuccess(() -> Component.literal("§6[KickLanOwner] Current LAN game owner: §e" + owner.getScoreboardName() + " §7(UUID: " + owner.getUUID() + ")"), false);
		} else {
			if (server.isDedicatedServer()) {
				source.sendFailure(Component.literal("§c[KickLanOwner] This is a dedicated server. There is no LAN game owner."));
			} else {
				source.sendFailure(Component.literal("§c[KickLanOwner] Could not find the LAN game owner in the player list."));
			}
		}
		return 1;
	}

	private static int executeKick(CommandContext<CommandSourceStack> context, Component reason) {
		CommandSourceStack source = context.getSource();
		MinecraftServer server = source.getServer();

		ServerPlayer owner = findLanOwner(server);
		if (owner == null) {
			if (server.isDedicatedServer()) {
				source.sendFailure(Component.literal("§c[KickLanOwner] Cannot kick LAN owner: this server is a dedicated server with no LAN owner."));
			} else {
				source.sendFailure(Component.literal("§c[KickLanOwner] Cannot kick LAN owner: owner player was not found online."));
			}
			return 0;
		}

		String ownerName = owner.getScoreboardName();
		String senderName = source.getTextName();

		// Disconnect the LAN host from the game
		owner.connection.disconnect(reason);

		source.sendSuccess(() -> Component.literal("§a[KickLanOwner] Successfully kicked LAN game owner §e" + ownerName + "§a! Reason: §f" + reason.getString()), true);

		// Broadcast notice to remaining players
		server.getPlayerList().broadcastSystemMessage(
			Component.literal("§c[KickLanOwner] LAN owner §e" + ownerName + " §cwas kicked from the game by §e" + senderName + "§c."),
			false
		);

		return 1;
	}
}
