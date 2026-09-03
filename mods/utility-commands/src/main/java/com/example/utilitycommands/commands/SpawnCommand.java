package com.example.utilitycommands.commands;

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
import net.minecraft.world.level.storage.LevelData;

import java.util.Set;

public class SpawnCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("spawn")
			.executes(SpawnCommand::execute)
		);
	}

	private static int execute(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer player = context.getSource().getPlayerOrException();
		MinecraftServer server = context.getSource().getServer();
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
			spawnData.pitch(),
			false
		);

		context.getSource().sendSuccess(() ->
			Component.literal("§aTeleported to the world spawn point!"), false);

		return 1;
	}
}
