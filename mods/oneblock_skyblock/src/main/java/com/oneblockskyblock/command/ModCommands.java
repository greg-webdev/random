package com.oneblockskyblock.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.oneblockskyblock.oneblock.OneBlockData;
import com.oneblockskyblock.oneblock.OneBlockManager;
import com.oneblockskyblock.skyblock.SkyblockGenerator;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.level.block.Blocks;

public class ModCommands {

	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		// /oneblock ...
		dispatcher.register(
			Commands.literal("oneblock")
				.then(Commands.literal("info")
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						ServerLevel level = source.getLevel();
						OneBlockData data = OneBlockData.get(level);
						OneBlockManager.PhaseInfo info = OneBlockManager.getPhaseInfo(data.getCurrentPhase());
						source.sendSuccess(() -> Component.literal(
							"§6[OneBlock Info]\n" +
							"§aTotal Mined: §e" + data.getTotalMined() + "\n" +
							"§aCurrent Phase: §b" + info.id() + " - " + info.name() + "\n" +
							"§aPosition: §e" + data.getOneBlockPos().toShortString()
						), false);
						return 1;
					})
				)
				.then(Commands.literal("set")
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						ServerLevel level = source.getLevel();
						if (source.getEntity() instanceof ServerPlayer player) {
							BlockPos targetPos = player.blockPosition().below();
							level.setBlock(targetPos.below(), Blocks.BEDROCK.defaultBlockState(), 3);
							level.setBlock(targetPos, Blocks.GRASS_BLOCK.defaultBlockState(), 3);

							OneBlockData data = OneBlockData.get(level);
							data.setOneBlockPos(targetPos);
							data.save(level);

							source.sendSuccess(() -> Component.literal("§a[OneBlock] Set main OneBlock at: §e" + targetPos.toShortString()), false);
							return 1;
						} else {
							source.sendFailure(Component.literal("Only players can execute /oneblock set"));
							return 0;
						}
					})
				)
				.then(Commands.literal("phase")
					.then(Commands.argument("phaseNumber", IntegerArgumentType.integer(1, 8))
						.executes(context -> {
							int phase = IntegerArgumentType.getInteger(context, "phaseNumber");
							CommandSourceStack source = context.getSource();
							ServerLevel level = source.getLevel();
							OneBlockData data = OneBlockData.get(level);
							data.setCurrentPhase(phase);
							OneBlockManager.PhaseInfo info = OneBlockManager.getPhaseInfo(phase);
							data.setTotalMined(info.minMined());
							data.save(level);
							source.sendSuccess(() -> Component.literal("§a[OneBlock] Changed to Phase " + phase + ": §b" + info.name()), false);
							return 1;
						})
					)
				)
				.then(Commands.literal("reset")
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						ServerLevel level = source.getLevel();
						OneBlockData data = OneBlockData.get(level);
						data.setCurrentPhase(1);
						data.setTotalMined(0);
						OneBlockManager.initSpawn(level);
						data.save(level);
						source.sendSuccess(() -> Component.literal("§a[OneBlock] Successfully reset OneBlock to Phase 1!"), false);
						return 1;
					})
				)
				.executes(context -> {
					CommandSourceStack source = context.getSource();
					ServerLevel level = source.getLevel();
					OneBlockData data = OneBlockData.get(level);
					OneBlockManager.PhaseInfo info = OneBlockManager.getPhaseInfo(data.getCurrentPhase());
					source.sendSuccess(() -> Component.literal("§e[OneBlock] Phase: §b" + info.name() + " §7| §aMined: §e" + data.getTotalMined() + " §7(Use /oneblock info, reset, set, or phase <1-8>)"), false);
					return 1;
				})
		);

		// /skyblock ...
		dispatcher.register(
			Commands.literal("skyblock")
				.then(Commands.literal("reset")
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						ServerLevel level = source.getLevel();
						SkyblockGenerator.generateIsland(level, new BlockPos(0, 64, 0), true);
						if (source.getEntity() instanceof ServerPlayer player) {
							player.teleportTo(0.5, 65.0, 0.5);
						}
						source.sendSuccess(() -> Component.literal("§a[Skyblock] Island regenerated successfully at spawn!"), false);
						return 1;
					})
				)
				.then(Commands.literal("tp")
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						if (source.getEntity() instanceof ServerPlayer player) {
							player.teleportTo(0.5, 65.0, 0.5);
							source.sendSuccess(() -> Component.literal("§a[Skyblock] Teleported to Skyblock island!"), false);
							return 1;
						}
						return 0;
					})
				)
				.executes(context -> {
					CommandSourceStack source = context.getSource();
					source.sendSuccess(() -> Component.literal("§e[Skyblock] Use §b/skyblock reset §eto regenerate the island or §b/skyblock tp §eto teleport."), false);
					return 1;
				})
		);
	}
}
