package com.example.utilitycommands.commands;

import com.example.utilitycommands.inventory.PlayerInvWrapper;
import com.example.utilitycommands.inventory.SeeInvMenu;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.Permissions;
import net.minecraft.world.SimpleMenuProvider;

public class SeeInvCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("seeinv")
			.requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_GAMEMASTER))
			.then(Commands.argument("player", EntityArgument.player())
				.executes(SeeInvCommand::execute))
		);
	}

	private static int execute(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer viewer = context.getSource().getPlayerOrException();
		ServerPlayer target = EntityArgument.getPlayer(context, "player");

		PlayerInvWrapper wrapper = new PlayerInvWrapper(target);

		viewer.openMenu(new SimpleMenuProvider(
			(syncId, playerInventory, player) -> new SeeInvMenu(syncId, playerInventory, wrapper),
			Component.literal(target.getScoreboardName() + "'s Inventory")
		));

		context.getSource().sendSuccess(() ->
			Component.literal("§aViewing inventory of §f" + target.getScoreboardName()), false);

		return 1;
	}
}
