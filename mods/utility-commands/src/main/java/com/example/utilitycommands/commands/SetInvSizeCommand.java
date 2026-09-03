package com.example.utilitycommands.commands;

import com.example.utilitycommands.ExtendedInventoryManager;
import com.example.utilitycommands.inventory.ExtendedInventoryMenu;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.fabricmc.fabric.api.screenhandler.v1.ExtendedScreenHandlerFactory;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;

public class SetInvSizeCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("setinvsize")
			.executes(SetInvSizeCommand::openCurrent)
			.then(Commands.argument("number", IntegerArgumentType.integer(ExtendedInventoryManager.MIN_SIDE_COLUMNS, ExtendedInventoryManager.MAX_SIDE_COLUMNS))
				.executes(SetInvSizeCommand::setSizeAndOpen))
		);
	}

	private static int openCurrent(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer player = context.getSource().getPlayerOrException();
		int sideCols = ExtendedInventoryManager.getSideColumns(player.getUUID());
		int totalCols = sideCols * 2 + 9;

		openMenu(player, sideCols);

		context.getSource().sendSuccess(() ->
			Component.literal(String.format(
				"§aCurrent inventory size: §e%d columns on each side §8(total %d columns)§a. Use §e/setinvsize <0-10> §ato change.",
				sideCols, totalCols
			)), false);

		return 1;
	}

	private static int setSizeAndOpen(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer player = context.getSource().getPlayerOrException();
		int sideCols = IntegerArgumentType.getInteger(context, "number");
		int totalCols = sideCols * 2 + 9;

		ExtendedInventoryManager.setSideColumns(player.getUUID(), sideCols);
		openMenu(player, sideCols);

		context.getSource().sendSuccess(() ->
			Component.literal(String.format(
				"§aInventory size set to §e%d columns on each side §8(total %d columns)§a!",
				sideCols, totalCols
			)), false);

		return 1;
	}

	private static void openMenu(ServerPlayer player, int sideColumns) {
		SimpleContainer extra = ExtendedInventoryManager.getExtraStorage(player.getUUID());
		int totalCols = sideColumns * 2 + 9;

		player.openMenu(new ExtendedScreenHandlerFactory<Integer>() {
			@Override
			public Integer getScreenOpeningData(ServerPlayer p) {
				return sideColumns;
			}

			@Override
			public Component getDisplayName() {
				return Component.literal("Inventory (" + sideColumns + " on each side - " + totalCols + " total)");
			}

			@Override
			public AbstractContainerMenu createMenu(int syncId, Inventory playerInventory, Player p) {
				return new ExtendedInventoryMenu(syncId, playerInventory, sideColumns, extra);
			}
		});
	}
}
