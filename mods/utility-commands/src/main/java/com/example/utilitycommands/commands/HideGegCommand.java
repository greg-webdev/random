package com.example.utilitycommands.commands;

import com.example.utilitycommands.ChatFilterManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.BoolArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;

public class HideGegCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("hidegeg")
			.executes(HideGegCommand::toggle)
			.then(Commands.argument("enabled", BoolArgumentType.bool())
				.executes(HideGegCommand::setExplicit))
		);

		dispatcher.register(Commands.literal("filtergeg")
			.executes(HideGegCommand::toggle)
			.then(Commands.argument("enabled", BoolArgumentType.bool())
				.executes(HideGegCommand::setExplicit))
		);

		dispatcher.register(Commands.literal("gegfilter")
			.executes(HideGegCommand::toggle)
			.then(Commands.argument("enabled", BoolArgumentType.bool())
				.executes(HideGegCommand::setExplicit))
		);
	}

	private static int toggle(CommandContext<CommandSourceStack> context) {
		boolean newState = !ChatFilterManager.isFilterEnabled();
		ChatFilterManager.setFilterEnabled(newState);
		reportState(context.getSource(), newState);
		return 1;
	}

	private static int setExplicit(CommandContext<CommandSourceStack> context) {
		boolean state = BoolArgumentType.getBool(context, "enabled");
		ChatFilterManager.setFilterEnabled(state);
		reportState(context.getSource(), state);
		return 1;
	}

	private static void reportState(CommandSourceStack source, boolean enabled) {
		source.sendSuccess(() ->
			Component.literal(String.format(
				"§e[ChatFilter] §f'geg' filter is now %s§f.",
				enabled ? "§aENABLED §7(hiding messages with 'g,e,g')" : "§cDISABLED §7(showing all messages)"
			)), false);
	}
}
