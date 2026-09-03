package com.example.utilitycommands.commands;

import com.example.utilitycommands.HomeManager;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.portal.TeleportTransition;
import net.minecraft.world.level.storage.LevelData;

import java.util.Set;

public class HomeCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("home")
			.executes(HomeCommand::teleportHome)
			.then(Commands.literal("set")
				.executes(HomeCommand::setHome))
		);

		// Also register /sethome for convenience
		dispatcher.register(Commands.literal("sethome")
			.executes(HomeCommand::setHome)
		);
	}

	public static int setHome(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer player = context.getSource().getPlayerOrException();
		HomeManager.setHome(player);

		context.getSource().sendSuccess(() ->
			Component.literal(String.format(
				"§aHome location saved at §f%.1f, %.1f, %.1f§a! Use §e/home §ato return here anytime.",
				player.getX(), player.getY(), player.getZ()
			)), false);

		return 1;
	}

	private static int teleportHome(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer player = context.getSource().getPlayerOrException();

		// 1. If player has a custom set home, teleport there
		if (HomeManager.teleportToHome(player)) {
			context.getSource().sendSuccess(() ->
				Component.literal("§aTeleported to your home!"), false);
			return 1;
		}

		// 2. Otherwise fall back to bed/respawn anchor
		MinecraftServer server = context.getSource().getServer();
		TeleportTransition transition = player.findRespawnPositionAndUseSpawnBlock(false, TeleportTransition.DO_NOTHING);

		if (!transition.missingRespawnBlock()) {
			player.teleport(transition);
			context.getSource().sendSuccess(() ->
				Component.literal("§aTeleported to your bed/respawn point! §7(Tip: Use §e/home set §7to set a custom home)"), false);
			return 1;
		}

		// 3. Fallback to world spawn if bed/respawn anchor is missing or blocked
		ServerLevel overworld = server.overworld();
		LevelData.RespawnData spawnData = overworld.getRespawnData();
		BlockPos spawnPos = spawnData.pos();

		int targetY = spawnPos.getY();
		if (overworld.getBlockState(spawnPos).blocksMotion()) {
			targetY = overworld.getHeight(Heightmap.Types.MOTION_BLOCKING, spawnPos.getX(), spawnPos.getZ());
		}

		player.teleportTo(
			overworld,
			spawnPos.getX() + 0.5,
			targetY,
			spawnPos.getZ() + 0.5,
			Set.of(),
			spawnData.yaw(),
			0.0f,
			false
		);

		context.getSource().sendSuccess(() ->
			Component.literal("§aNo home set. Teleported to the world spawn point! §7(Tip: Use §e/home set §7to set a home)"), false);

		return 1;
	}
}
