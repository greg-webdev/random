package com.oneblockskyblock.oneblock;

import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.ChestBlockEntity;
import net.minecraft.world.level.block.state.BlockState;

import java.util.*;

public class OneBlockManager {

	public record PhaseInfo(int id, String name, int minMined, int maxMined, List<Block> blocks) {}

	private static final List<PhaseInfo> PHASES = new ArrayList<>();

	static {
		// Phase 1: Plains & Forest (0 - 99)
		PHASES.add(new PhaseInfo(1, "Plains & Forest", 0, 99, List.of(
			Blocks.GRASS_BLOCK, Blocks.DIRT, Blocks.OAK_LOG, Blocks.BIRCH_LOG,
			Blocks.OAK_LEAVES, Blocks.BIRCH_LEAVES, Blocks.COARSE_DIRT, Blocks.CLAY,
			Blocks.PUMPKIN, Blocks.MELON
		)));

		// Phase 2: Underground Caves (100 - 249)
		PHASES.add(new PhaseInfo(2, "Underground Caves", 100, 249, List.of(
			Blocks.STONE, Blocks.COBBLESTONE, Blocks.COAL_ORE, Blocks.IRON_ORE,
			Blocks.COPPER_ORE, Blocks.ANDESITE, Blocks.DIORITE, Blocks.GRANITE,
			Blocks.GRAVEL, Blocks.TUFF, Blocks.DEEPSLATE
		)));

		// Phase 3: Snowy Tundra (250 - 449)
		PHASES.add(new PhaseInfo(3, "Snowy Tundra", 250, 449, List.of(
			Blocks.SNOW_BLOCK, Blocks.ICE, Blocks.PACKED_ICE, Blocks.SPRUCE_LOG,
			Blocks.SPRUCE_LEAVES, Blocks.CLAY, Blocks.DRIPSTONE_BLOCK
		)));

		// Phase 4: Desert & Badlands (450 - 699)
		PHASES.add(new PhaseInfo(4, "Desert & Badlands", 450, 699, List.of(
			Blocks.SAND, Blocks.RED_SAND, Blocks.TERRACOTTA, Blocks.YELLOW_TERRACOTTA,
			Blocks.RED_TERRACOTTA, Blocks.SANDSTONE, Blocks.SMOOTH_SANDSTONE, Blocks.GOLD_ORE
		)));

		// Phase 5: Swamp & Jungle (700 - 999)
		PHASES.add(new PhaseInfo(5, "Swamp & Jungle", 700, 999, List.of(
			Blocks.MUD, Blocks.PACKED_MUD, Blocks.MUD_BRICKS, Blocks.MANGROVE_LOG,
			Blocks.JUNGLE_LOG, Blocks.JUNGLE_LEAVES, Blocks.BAMBOO_BLOCK, Blocks.MOSS_BLOCK,
			Blocks.SLIME_BLOCK
		)));

		// Phase 6: Ocean & Deep Dark (1000 - 1399)
		PHASES.add(new PhaseInfo(6, "Ocean & Deep Dark", 1000, 1399, List.of(
			Blocks.PRISMARINE, Blocks.PRISMARINE_BRICKS, Blocks.DARK_PRISMARINE,
			Blocks.SEA_LANTERN, Blocks.SPONGE, Blocks.DEEPSLATE_REDSTONE_ORE,
			Blocks.DEEPSLATE_LAPIS_ORE, Blocks.DEEPSLATE_DIAMOND_ORE, Blocks.SCULK
		)));

		// Phase 7: The Nether (1400 - 1899)
		PHASES.add(new PhaseInfo(7, "The Nether", 1400, 1899, List.of(
			Blocks.NETHERRACK, Blocks.CRIMSON_STEM, Blocks.WARPED_STEM, Blocks.CRIMSON_NYLIUM,
			Blocks.WARPED_NYLIUM, Blocks.BASALT, Blocks.BLACKSTONE, Blocks.NETHER_QUARTZ_ORE,
			Blocks.NETHER_GOLD_ORE, Blocks.SOUL_SAND, Blocks.SOUL_SOIL, Blocks.GLOWSTONE,
			Blocks.MAGMA_BLOCK, Blocks.CRYING_OBSIDIAN, Blocks.ANCIENT_DEBRIS
		)));

		// Phase 8: The End & Infinite Realm (1900+)
		PHASES.add(new PhaseInfo(8, "The End & Infinite", 1900, Integer.MAX_VALUE, List.of(
			Blocks.END_STONE, Blocks.PURPUR_BLOCK, Blocks.OBSIDIAN, Blocks.END_STONE_BRICKS,
			Blocks.DIAMOND_BLOCK, Blocks.EMERALD_BLOCK, Blocks.AMETHYST_BLOCK, Blocks.GOLD_BLOCK,
			Blocks.IRON_BLOCK
		)));
	}

	private static final Random RANDOM = new Random();

	public static PhaseInfo getPhaseInfo(int phaseId) {
		for (PhaseInfo info : PHASES) {
			if (info.id() == phaseId) return info;
		}
		return PHASES.get(PHASES.size() - 1);
	}

	public static PhaseInfo getPhaseForCount(int minedCount) {
		for (PhaseInfo info : PHASES) {
			if (minedCount >= info.minMined() && minedCount <= info.maxMined()) {
				return info;
			}
		}
		return PHASES.get(PHASES.size() - 1);
	}

	public static boolean isOneBlock(ServerLevel level, BlockPos pos) {
		OneBlockData data = OneBlockData.get(level);
		if (pos.equals(data.getOneBlockPos())) return true;
		return data.isCustomPosition(pos);
	}

	public static void initSpawn(ServerLevel level) {
		OneBlockData data = OneBlockData.get(level);
		BlockPos center = data.getOneBlockPos();

		// Bedrock below so falling blocks / player never drop into void
		level.setBlock(center.below(), Blocks.BEDROCK.defaultBlockState(), 3);
		level.setBlock(center, Blocks.GRASS_BLOCK.defaultBlockState(), 3);

		level.setRespawnData(net.minecraft.world.level.storage.LevelData.RespawnData.of(level.dimension(), center.above(), 0.0f, 0.0f));
		data.save(level);
	}

	public static void onBlockBreak(ServerLevel level, ServerPlayer player, BlockPos pos, BlockState brokenState) {
		if (!isOneBlock(level, pos)) return;

		OneBlockData data = OneBlockData.get(level);
		data.incrementMined();
		int mined = data.getTotalMined();

		// Determine current phase
		PhaseInfo oldPhase = getPhaseInfo(data.getCurrentPhase());
		PhaseInfo currentPhase = getPhaseForCount(mined);

		if (currentPhase.id() > oldPhase.id()) {
			data.setCurrentPhase(currentPhase.id());
			player.sendSystemMessage(Component.literal("§6§l========================================"), false);
			player.sendSystemMessage(Component.literal("§e§l★ PHASE COMPLETED! ★"), false);
			player.sendSystemMessage(Component.literal("§aNow entering: §b" + currentPhase.name()), false);
			player.sendSystemMessage(Component.literal("§6§l========================================"), false);
			level.playSound(null, pos, SoundEvents.PLAYER_LEVELUP, SoundSource.BLOCKS, 1.0f, 1.0f);
		}

		data.save(level);

		// Bedrock foundation check
		if (level.getBlockState(pos.below()).isAir()) {
			level.setBlock(pos.below(), Blocks.BEDROCK.defaultBlockState(), 3);
		}

		// Handle Milestone Events (Chests and Mobs)
		if (checkMilestones(level, player, pos, mined, currentPhase)) {
			// Milestone handled block placement
		} else {
			// Normal block generation
			Block nextBlock = pickBlock(currentPhase);
			level.setBlock(pos, nextBlock.defaultBlockState(), 3);

			// Particles & sound feedback
			level.sendParticles(ParticleTypes.HAPPY_VILLAGER, pos.getX() + 0.5, pos.getY() + 1.1, pos.getZ() + 0.5, 5, 0.2, 0.2, 0.2, 0.05);
			level.playSound(null, pos, SoundEvents.NOTE_BLOCK_PLING.value(), SoundSource.BLOCKS, 0.8f, 1.2f);
		}

		// Action Bar Update
		int remaining = currentPhase.maxMined() == Integer.MAX_VALUE ? 0 : Math.max(0, currentPhase.maxMined() - mined + 1);
		Component actionBarMsg;
		if (remaining > 0) {
			actionBarMsg = Component.literal(
				"§e[OneBlock] §bPhase " + currentPhase.id() + ": " + currentPhase.name() +
				" §7| §aMined: §e" + mined + " §7| §6Next: §c" + remaining
			);
		} else {
			actionBarMsg = Component.literal(
				"§e[OneBlock] §bPhase " + currentPhase.id() + ": " + currentPhase.name() +
				" §7| §aMined: §e" + mined + " §7| §6MAX PHASE"
			);
		}
		player.sendSystemMessage(actionBarMsg, true);
	}

	private static Block pickBlock(PhaseInfo phase) {
		List<Block> list = phase.blocks();
		return list.get(RANDOM.nextInt(list.size()));
	}

	private static boolean checkMilestones(ServerLevel level, ServerPlayer player, BlockPos pos, int mined, PhaseInfo phase) {
		// Milestone Bonus Chests
		if (mined == 50 || mined == 175 || mined == 350 || mined == 580 || mined == 840 || mined == 1200 || mined == 1650 || (mined >= 1900 && mined % 200 == 0)) {
			placeBonusChest(level, player, pos, phase.id());
			return true;
		}

		// Milestone Mobs
		EntityType<?> mobType = getMilestoneMob(mined);
		if (mobType != null) {
			spawnMilestoneMob(level, player, pos, mobType, phase);
			return true;
		}

		return false;
	}

	private static EntityType<?> getMilestoneMob(int mined) {
		return switch (mined) {
			case 25 -> EntityType.CHICKEN;
			case 75 -> EntityType.COW;
			case 130 -> EntityType.ZOMBIE;
			case 210 -> EntityType.SKELETON;
			case 290 -> EntityType.FOX;
			case 400 -> EntityType.STRAY;
			case 500 -> EntityType.CAMEL;
			case 640 -> EntityType.HUSK;
			case 760 -> EntityType.FROG;
			case 920 -> EntityType.WITCH;
			case 1080 -> EntityType.DROWNED;
			case 1320 -> EntityType.GUARDIAN;
			case 1500 -> EntityType.PIGLIN;
			case 1780 -> EntityType.BLAZE;
			default -> {
				if (mined > 1900 && mined % 150 == 0) {
					yield (mined % 300 == 0) ? EntityType.ENDERMAN : EntityType.ENDERMITE;
				}
				yield null;
			}
		};
	}

	private static void spawnMilestoneMob(ServerLevel level, ServerPlayer player, BlockPos pos, EntityType<?> type, PhaseInfo phase) {
		// Place base block
		Block baseBlock = pickBlock(phase);
		level.setBlock(pos, baseBlock.defaultBlockState(), 3);

		Entity entity = type.create(level, EntitySpawnReason.EVENT);
		if (entity != null) {
			entity.setPos(pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5);
			level.addFreshEntity(entity);
			level.sendParticles(ParticleTypes.POOF, pos.getX() + 0.5, pos.getY() + 1.2, pos.getZ() + 0.5, 10, 0.2, 0.2, 0.2, 0.05);
			level.playSound(null, pos, SoundEvents.CHICKEN_EGG, SoundSource.NEUTRAL, 1.0f, 1.0f);
			player.sendSystemMessage(Component.literal("§d★ A " + type.getDescription().getString() + " appeared!"), false);
		}
	}

	private static void placeBonusChest(ServerLevel level, ServerPlayer player, BlockPos pos, int phaseId) {
		level.setBlock(pos, Blocks.CHEST.defaultBlockState(), 3);
		BlockEntity be = level.getBlockEntity(pos);
		if (be instanceof ChestBlockEntity chest) {
			populateChest(chest, phaseId);
		}
		level.sendParticles(ParticleTypes.TOTEM_OF_UNDYING, pos.getX() + 0.5, pos.getY() + 1.0, pos.getZ() + 0.5, 15, 0.3, 0.3, 0.3, 0.1);
		level.playSound(null, pos, SoundEvents.PLAYER_LEVELUP, SoundSource.BLOCKS, 1.0f, 1.2f);
		player.sendSystemMessage(Component.literal("§6§l★ BONUS CHEST UNLOCKED! ★"), false);
	}

	private static void populateChest(ChestBlockEntity chest, int phaseId) {
		switch (phaseId) {
			case 1 -> {
				chest.setItem(0, new ItemStack(Items.OAK_SAPLING, 4));
				chest.setItem(1, new ItemStack(Items.WHEAT_SEEDS, 8));
				chest.setItem(2, new ItemStack(Items.WATER_BUCKET, 1));
				chest.setItem(3, new ItemStack(Items.BONE_MEAL, 8));
				chest.setItem(4, new ItemStack(Items.APPLE, 5));
			}
			case 2 -> {
				chest.setItem(0, new ItemStack(Items.IRON_INGOT, 5));
				chest.setItem(1, new ItemStack(Items.COAL, 12));
				chest.setItem(2, new ItemStack(Items.TORCH, 16));
				chest.setItem(3, new ItemStack(Items.IRON_PICKAXE, 1));
				chest.setItem(4, new ItemStack(Items.BREAD, 6));
			}
			case 3 -> {
				chest.setItem(0, new ItemStack(Items.SPRUCE_SAPLING, 4));
				chest.setItem(1, new ItemStack(Items.SWEET_BERRIES, 12));
				chest.setItem(2, new ItemStack(Items.LEATHER_BOOTS, 1));
				chest.setItem(3, new ItemStack(Items.POWDER_SNOW_BUCKET, 1));
			}
			case 4 -> {
				chest.setItem(0, new ItemStack(Items.CACTUS, 3));
				chest.setItem(1, new ItemStack(Items.GOLD_INGOT, 8));
				chest.setItem(2, new ItemStack(Items.SADDLE, 1));
				chest.setItem(3, new ItemStack(Items.TNT, 3));
			}
			case 5 -> {
				chest.setItem(0, new ItemStack(Items.BAMBOO, 8));
				chest.setItem(1, new ItemStack(Items.JUNGLE_SAPLING, 4));
				chest.setItem(2, new ItemStack(Items.COCOA_BEANS, 6));
				chest.setItem(3, new ItemStack(Items.SLIME_BALL, 4));
				chest.setItem(4, new ItemStack(Items.LEAD, 2));
			}
			case 6 -> {
				chest.setItem(0, new ItemStack(Items.DIAMOND, 3));
				chest.setItem(1, new ItemStack(Items.LAPIS_LAZULI, 16));
				chest.setItem(2, new ItemStack(Items.SPONGE, 2));
				chest.setItem(3, new ItemStack(Items.HEART_OF_THE_SEA, 1));
			}
			case 7 -> {
				chest.setItem(0, new ItemStack(Items.NETHER_WART, 6));
				chest.setItem(1, new ItemStack(Items.BLAZE_POWDER, 6));
				chest.setItem(2, new ItemStack(Items.NETHERITE_SCRAP, 1));
				chest.setItem(3, new ItemStack(Items.FIRE_CHARGE, 4));
			}
			default -> {
				chest.setItem(0, new ItemStack(Items.SHULKER_SHELL, 2));
				chest.setItem(1, new ItemStack(Items.ENDER_PEARL, 6));
				chest.setItem(2, new ItemStack(Items.ENCHANTED_GOLDEN_APPLE, 1));
				chest.setItem(3, new ItemStack(Items.DIAMOND, 6));
			}
		}
	}
}
