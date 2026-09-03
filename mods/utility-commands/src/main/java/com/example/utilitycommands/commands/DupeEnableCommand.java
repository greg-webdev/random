package com.example.utilitycommands.commands;

import com.example.utilitycommands.DupeManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.BoolArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.permissions.Permissions;

public class DupeEnableCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("dupenable")
			.requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_GAMEMASTER))
			.executes(DupeEnableCommand::toggle)
			.then(Commands.argument("enabled", BoolArgumentType.bool())
				.executes(DupeEnableCommand::setExplicit))
		);
	}

	private static int toggle(CommandContext<CommandSourceStack> context) {
		boolean newState = DupeManager.toggleDupe();
		sendFeedback(context.getSource(), newState);
		return 1;
	}

	private static int setExplicit(CommandContext<CommandSourceStack> context) {
		boolean state = BoolArgumentType.getBool(context, "enabled");
		DupeManager.setDupeEnabled(state);
		sendFeedback(context.getSource(), state);
		return 1;
	}

	private static void sendFeedback(CommandSourceStack source, boolean enabled) {
		if (enabled) {
			source.sendSuccess(() ->
				Component.literal("§6[DupeManager] Hopper duplication is now §a§lENABLED§6! Any items put into hoppers will duplicate."), true);
		} else {
			source.sendSuccess(() ->
				Component.literal("§6[DupeManager] Hopper duplication is now §c§lDISABLED§6."), true);
		}
	}
}
