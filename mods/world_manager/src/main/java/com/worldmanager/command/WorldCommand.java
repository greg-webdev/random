package com.worldmanager.command;

import com.mojang.brigadier.CommandDispatcher;
import com.worldmanager.config.WorldConfig;
import com.worldmanager.oneblock.OneBlockManager;
import com.worldmanager.world.WorldTransitionManager;
import com.worldmanager.world.WorldType;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.permissions.Permissions;

public class WorldCommand {

	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(
			Commands.literal("world")
				.then(Commands.literal("set")
					.requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_GAMEMASTER))
					.then(Commands.literal("skyblock")
						.then(Commands.literal("v1")
							.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.SKYBLOCK_V1)))
						.then(Commands.literal("v2")
							.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.SKYBLOCK_V2)))
						.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.SKYBLOCK_V1))
					)
					.then(Commands.literal("skyblock_v1")
						.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.SKYBLOCK_V1)))
					.then(Commands.literal("skyblock_v2")
						.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.SKYBLOCK_V2)))
					.then(Commands.literal("oneblock")
						.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.ONEBLOCK)))
					.then(Commands.literal("flat")
						.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.FLAT)))
					.then(Commands.literal("standard")
						.executes(ctx -> executeSetWorld(ctx.getSource(), WorldType.STANDARD)))
				)
				.then(Commands.literal("inv")
					.requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_GAMEMASTER))
					.then(Commands.literal("single")
						.executes(ctx -> {
							WorldConfig.get().setInventoryMode("single");
							ctx.getSource().sendSuccess(() -> Component.literal(
								"§a[WorldManager] Inventory mode set to §eSINGLE §7(Inventories are saved separately per world type)."), true);
							return 1;
						}))
					.then(Commands.literal("all")
						.executes(ctx -> {
							WorldConfig.get().setInventoryMode("all");
							ctx.getSource().sendSuccess(() -> Component.literal(
								"§a[WorldManager] Inventory mode set to §eALL §7(Inventories are shared across all world types)."), true);
							return 1;
						}))
				)
				.then(Commands.literal("oneblock")
					.then(Commands.literal("reset")
						.requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_GAMEMASTER))
						.executes(ctx -> {
							ServerLevel level = ctx.getSource().getLevel();
							OneBlockManager.resetOneBlock(level);
							ctx.getSource().sendSuccess(() -> Component.literal(
								"§a[WorldManager] OneBlock reset to starting block!"), true);
							return 1;
						}))
				)
				.then(Commands.literal("changes")
					.requires(source -> source.permissions().hasPermission(Permissions.COMMANDS_GAMEMASTER))
					.then(Commands.literal("info")
						.executes(ctx -> {
							int count = com.worldmanager.changes.ChunkChangesManager.getSavedChunksCount();
							ctx.getSource().sendSuccess(() -> Component.literal(
								"§6§l[WorldManager Changes]\n" +
								"§eSaved Chunks: §b" + count + " §7files in §e" + com.worldmanager.changes.ChunkChangesManager.getChangesDir().toString() + "\n" +
								"§7Use §b/world changes restore §7to apply saved chunks back to the world."
							), false);
							return 1;
						}))
					.then(Commands.literal("restore")
						.executes(ctx -> {
							ServerLevel level = ctx.getSource().getLevel();
							ctx.getSource().sendSuccess(() -> Component.literal("§e[WorldManager] Restoring chunk changes from files..."), true);
							int restored = com.worldmanager.changes.ChunkChangesManager.restoreAll(level);
							ctx.getSource().sendSuccess(() -> Component.literal(
								"§a[WorldManager] Successfully restored §b" + restored + " §achunks from .changes files!"), true);
							return restored;
						}))
					.executes(ctx -> {
						int count = com.worldmanager.changes.ChunkChangesManager.getSavedChunksCount();
						ctx.getSource().sendSuccess(() -> Component.literal(
							"§6§l[WorldManager Changes]\n" +
							"§eSaved Chunks: §b" + count + " §7files\n" +
							"§e/world changes info §7- View saved chunk changes details\n" +
							"§e/world changes restore §7- Restore all saved chunks into the world"
						), false);
						return 1;
					})
				)
				.then(Commands.literal("info")
					.executes(ctx -> {
						CommandSourceStack src = ctx.getSource();
						WorldType current = WorldConfig.get().getCurrentWorldType();
						String mode = WorldConfig.get().getInventoryMode().toUpperCase();
						int mined = WorldConfig.get().getOneblockMinedCount();
						int changes = com.worldmanager.changes.ChunkChangesManager.getSavedChunksCount();
						src.sendSuccess(() -> Component.literal(
							"§6§l[WorldManager Info]\n" +
							"§eCurrent World: §b" + current.getDisplayName() + "\n" +
							"§eInventory Mode: §a" + mode + " §7(" + (mode.equals("SINGLE") ? "isolated per world type" : "shared") + ")\n" +
							"§eOneBlock Mined: §f" + mined + "\n" +
							"§eSaved Chunk Changes: §f" + changes
						), false);
						return 1;
					}))
				.executes(ctx -> {
					CommandSourceStack src = ctx.getSource();
					src.sendSuccess(() -> Component.literal(
						"§6§l[WorldManager Commands]\n" +
						"§e/world set <skyblock v1|skyblock v2|oneblock|flat|standard> §7- Switch world and reload terrain\n" +
						"§e/world inv <single|all> §7- Toggle isolated per-world or shared inventory\n" +
						"§e/world oneblock reset §7- Resets the regenerating block\n" +
						"§e/world changes <info|restore> §7- Manage saved .changes chunk files\n" +
						"§e/world info §7- View active world and inventory configuration"
					), false);
					return 1;
				})
		);
	}

	private static int executeSetWorld(CommandSourceStack source, WorldType targetType) {
		if (WorldTransitionManager.isTransitioning()) {
			source.sendFailure(Component.literal("§c[WorldManager] A world transition is already in progress!"));
			return 0;
		}

		source.sendSuccess(() -> Component.literal("§a[WorldManager] Initiating world transition to §b" + targetType.getDisplayName() + "..."), true);
		boolean started = WorldTransitionManager.startTransition(source.getServer(), targetType);
		return started ? 1 : 0;
	}
}
