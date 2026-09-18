package com.worldmanager.oneblock;

import com.worldmanager.config.WorldConfig;
import com.worldmanager.world.WorldType;
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

import java.util.List;
import java.util.Random;

public class OneBlockManager {
	public static final BlockPos ONEBLOCK_POS = new BlockPos(0, 64, 0);
	public static final BlockPos BEDROCK_POS = new BlockPos(0, 63, 0);

	private static final Random RANDOM = new Random();

	public static void initSpawn(ServerLevel level) {
		// Bedrock foundation so players and drops never plunge into the void
		level.setBlock(BEDROCK_POS, Blocks.BEDROCK.defaultBlockState(), 3);
		level.setBlock(ONEBLOCK_POS, Blocks.GRASS_BLOCK.defaultBlockState(), 3);
	}

	public static void resetOneBlock(ServerLevel level) {
		WorldConfig.get().setOneblockMinedCount(0);
		initSpawn(level);
	}

	public static void onBlockBreak(ServerLevel level, ServerPlayer player, BlockPos pos) {
		if (WorldConfig.get().getCurrentWorldType() != WorldType.ONEBLOCK) {
			return;
		}

		if (!pos.equals(ONEBLOCK_POS)) {
			return;
		}

		// Ensure bedrock safety beneath
		if (level.getBlockState(BEDROCK_POS).isAir()) {
			level.setBlock(BEDROCK_POS, Blocks.BEDROCK.defaultBlockState(), 3);
		}

		WorldConfig.get().incrementOneblockMined();
		int mined = WorldConfig.get().getOneblockMinedCount();

		// Milestone checks (Chest or Mob spawn)
		if (checkMilestones(level, player, mined)) {
			// Milestone placed chest or mob
		} else {
			// Normal block generation based on going deeper
			Block nextBlock = pickBlockForDepth(mined);
			level.setBlock(ONEBLOCK_POS, nextBlock.defaultBlockState(), 3);

			// Particles & audio chime
			level.sendParticles(ParticleTypes.HAPPY_VILLAGER,
				ONEBLOCK_POS.getX() + 0.5, ONEBLOCK_POS.getY() + 1.1, ONEBLOCK_POS.getZ() + 0.5,
				5, 0.2, 0.2, 0.2, 0.05);
			level.playSound(null, ONEBLOCK_POS, SoundEvents.NOTE_BLOCK_PLING.value(), SoundSource.BLOCKS, 0.9f, 1.2f);
		}

		// Action Bar Update
		String depthName = getDepthName(mined);
		player.sendSystemMessage(Component.literal(
			"§e[OneBlock] §7Mined: §a" + mined + " §8| §bDepth: §f" + depthName
		), true);
	}

	private static String getDepthName(int mined) {
		if (mined < 25) return "§aSurface & Woods";
		if (mined < 70) return "§7Shallow Underground";
		if (mined < 150) return "§fIron & Minerals";
		if (mined < 250) return "§6Deepslate & Gold";
		if (mined < 420) return "§bDiamonds & Deep Dark";
		if (mined < 700) return "§cThe Nether Dimension";
		return "§dThe End & Infinite Realm";
	}

	private static Block pickBlockForDepth(int mined) {
		List<Block> pool;
		if (mined < 25) {
			pool = List.of(
				Blocks.OAK_LOG, Blocks.BIRCH_LOG, Blocks.OAK_LEAVES, Blocks.DIRT,
				Blocks.GRASS_BLOCK, Blocks.COARSE_DIRT, Blocks.CLAY, Blocks.PUMPKIN, Blocks.MELON
			);
		} else if (mined < 70) {
			pool = List.of(
				Blocks.STONE, Blocks.COBBLESTONE, Blocks.COAL_ORE, Blocks.OAK_LOG,
				Blocks.GRAVEL, Blocks.ANDESITE, Blocks.DIORITE, Blocks.DIRT
			);
		} else if (mined < 150) {
			pool = List.of(
				Blocks.STONE, Blocks.IRON_ORE, Blocks.COPPER_ORE, Blocks.COAL_ORE,
				Blocks.GRANITE, Blocks.TUFF, Blocks.DEEPSLATE, Blocks.COBBLESTONE
			);
		} else if (mined < 250) {
			pool = List.of(
				Blocks.DEEPSLATE, Blocks.DEEPSLATE_IRON_ORE, Blocks.DEEPSLATE_GOLD_ORE,
				Blocks.DEEPSLATE_REDSTONE_ORE, Blocks.DEEPSLATE_LAPIS_ORE, Blocks.GOLD_ORE,
				Blocks.RAW_IRON_BLOCK, Blocks.TUFF
			);
		} else if (mined < 420) {
			pool = List.of(
				Blocks.DEEPSLATE, Blocks.DEEPSLATE_DIAMOND_ORE, Blocks.DEEPSLATE_EMERALD_ORE,
				Blocks.DEEPSLATE_GOLD_ORE, Blocks.OBSIDIAN, Blocks.AMETHYST_BLOCK, Blocks.REDSTONE_BLOCK
			);
		} else if (mined < 700) {
			pool = List.of(
				Blocks.NETHERRACK, Blocks.BASALT, Blocks.BLACKSTONE, Blocks.NETHER_QUARTZ_ORE,
				Blocks.NETHER_GOLD_ORE, Blocks.SOUL_SAND, Blocks.SOUL_SOIL, Blocks.GLOWSTONE,
				Blocks.MAGMA_BLOCK, Blocks.CRIMSON_STEM, Blocks.WARPED_STEM
			);
		} else {
			pool = List.of(
				Blocks.END_STONE, Blocks.PURPUR_BLOCK, Blocks.OBSIDIAN, Blocks.DIAMOND_BLOCK,
				Blocks.EMERALD_BLOCK, Blocks.CRYING_OBSIDIAN, Blocks.ANCIENT_DEBRIS,
				Blocks.SCULK, Blocks.SEA_LANTERN, Blocks.GOLD_BLOCK, Blocks.IRON_BLOCK
			);
		}
		return pool.get(RANDOM.nextInt(pool.size()));
	}

	private static boolean checkMilestones(ServerLevel level, ServerPlayer player, int mined) {
		// Bonus Chest milestones
		if (mined == 20 || mined == 50 || mined == 90 || mined == 140 || mined == 200 ||
			mined == 280 || mined == 380 || mined == 500 || mined == 650 || mined == 850 ||
			(mined > 850 && mined % 150 == 0)) {
			placeMilestoneChest(level, player, mined);
			return true;
		}

		// Milestone mob spawns
		EntityType<?> mob = getMilestoneMob(mined);
		if (mob != null) {
			spawnMilestoneMob(level, player, mob, mined);
			return true;
		}

		return false;
	}

	private static EntityType<?> getMilestoneMob(int mined) {
		return switch (mined) {
			case 15 -> EntityType.CHICKEN;
			case 40 -> EntityType.COW;
			case 75 -> EntityType.SHEEP;
			case 120 -> EntityType.PIG;
			case 180 -> EntityType.FOX;
			case 260 -> EntityType.VILLAGER;
			case 350 -> EntityType.FROG;
			case 460 -> EntityType.MOOSHROOM;
			default -> null;
		};
	}

	private static void spawnMilestoneMob(ServerLevel level, ServerPlayer player, EntityType<?> type, int mined) {
		Block baseBlock = pickBlockForDepth(mined);
		level.setBlock(ONEBLOCK_POS, baseBlock.defaultBlockState(), 3);

		Entity entity = type.create(level, EntitySpawnReason.EVENT);
		if (entity != null) {
			entity.setPos(ONEBLOCK_POS.getX() + 0.5, ONEBLOCK_POS.getY() + 1.0, ONEBLOCK_POS.getZ() + 0.5);
			level.addFreshEntity(entity);
			level.sendParticles(ParticleTypes.POOF,
				ONEBLOCK_POS.getX() + 0.5, ONEBLOCK_POS.getY() + 1.2, ONEBLOCK_POS.getZ() + 0.5,
				10, 0.2, 0.2, 0.2, 0.05);
			level.playSound(null, ONEBLOCK_POS, SoundEvents.CHICKEN_EGG, SoundSource.NEUTRAL, 1.0f, 1.0f);
			player.sendSystemMessage(Component.literal("§d★ A " + type.getDescription().getString() + " appeared!"), false);
		}
	}

	private static void placeMilestoneChest(ServerLevel level, ServerPlayer player, int mined) {
		level.setBlock(ONEBLOCK_POS, Blocks.CHEST.defaultBlockState(), 3);
		BlockEntity be = level.getBlockEntity(ONEBLOCK_POS);
		if (be instanceof ChestBlockEntity chest) {
			fillMilestoneChest(chest, mined);
		}
		level.sendParticles(ParticleTypes.TOTEM_OF_UNDYING,
			ONEBLOCK_POS.getX() + 0.5, ONEBLOCK_POS.getY() + 1.0, ONEBLOCK_POS.getZ() + 0.5,
			15, 0.3, 0.3, 0.3, 0.1);
		level.playSound(null, ONEBLOCK_POS, SoundEvents.PLAYER_LEVELUP, SoundSource.BLOCKS, 1.0f, 1.2f);
		player.sendSystemMessage(Component.literal("§6§l★ BONUS SUPPLIES CHEST! ★"), false);
	}

	private static void fillMilestoneChest(ChestBlockEntity chest, int mined) {
		if (mined <= 50) {
			chest.setItem(0, new ItemStack(Items.OAK_SAPLING, 4));
			chest.setItem(1, new ItemStack(Items.WHEAT_SEEDS, 8));
			chest.setItem(2, new ItemStack(Items.WATER_BUCKET, 1));
			chest.setItem(3, new ItemStack(Items.BREAD, 8));
			chest.setItem(4, new ItemStack(Items.BONE_MEAL, 8));
		} else if (mined <= 150) {
			chest.setItem(0, new ItemStack(Items.IRON_INGOT, 8));
			chest.setItem(1, new ItemStack(Items.COAL, 16));
			chest.setItem(2, new ItemStack(Items.TORCH, 24));
			chest.setItem(3, new ItemStack(Items.LAVA_BUCKET, 1));
			chest.setItem(4, new ItemStack(Items.IRON_PICKAXE, 1));
		} else if (mined <= 300) {
			chest.setItem(0, new ItemStack(Items.GOLD_INGOT, 8));
			chest.setItem(1, new ItemStack(Items.REDSTONE, 16));
			chest.setItem(2, new ItemStack(Items.LAPIS_LAZULI, 16));
			chest.setItem(3, new ItemStack(Items.COOKED_BEEF, 8));
			chest.setItem(4, new ItemStack(Items.BOW, 1));
			chest.setItem(5, new ItemStack(Items.ARROW, 32));
		} else if (mined <= 550) {
			// Nether readiness items (enough obsidian for Nether Portal!)
			chest.setItem(0, new ItemStack(Items.OBSIDIAN, 10));
			chest.setItem(1, new ItemStack(Items.FLINT_AND_STEEL, 1));
			chest.setItem(2, new ItemStack(Items.BLAZE_ROD, 4));
			chest.setItem(3, new ItemStack(Items.NETHER_WART, 6));
			chest.setItem(4, new ItemStack(Items.DIAMOND, 3));
		} else {
			// End dimension & endgame items
			chest.setItem(0, new ItemStack(Items.ENDER_PEARL, 8));
			chest.setItem(1, new ItemStack(Items.ENDER_EYE, 4));
			chest.setItem(2, new ItemStack(Items.ENCHANTED_GOLDEN_APPLE, 1));
			chest.setItem(3, new ItemStack(Items.SHULKER_SHELL, 2));
			chest.setItem(4, new ItemStack(Items.DIAMOND_BLOCK, 1));
		}
	}
}
