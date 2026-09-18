package com.oneblockskyblock;

import com.oneblockskyblock.command.ModCommands;
import com.oneblockskyblock.item.OneBlockItem;
import com.oneblockskyblock.oneblock.OneBlockData;
import com.oneblockskyblock.oneblock.OneBlockManager;
import com.oneblockskyblock.skyblock.SkyblockGenerator;
import com.oneblockskyblock.worldgen.OneBlockStartFeature;
import com.oneblockskyblock.worldgen.SkyblockIslandFeature;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerWorldEvents;
import net.fabricmc.fabric.api.event.player.PlayerBlockBreakEvents;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.levelgen.feature.Feature;
import net.minecraft.world.level.levelgen.feature.configurations.NoneFeatureConfiguration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Optional;

public class OneBlockSkyblockMod implements ModInitializer {
	public static final String MOD_ID = "oneblock_skyblock";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	// Custom Features
	public static final Feature<NoneFeatureConfiguration> ONEBLOCK_FEATURE = Registry.register(
		BuiltInRegistries.FEATURE,
		Identifier.fromNamespaceAndPath(MOD_ID, "oneblock_platform"),
		new OneBlockStartFeature(NoneFeatureConfiguration.CODEC)
	);

	public static final Feature<NoneFeatureConfiguration> SKYBLOCK_FEATURE = Registry.register(
		BuiltInRegistries.FEATURE,
		Identifier.fromNamespaceAndPath(MOD_ID, "skyblock_island"),
		new SkyblockIslandFeature(NoneFeatureConfiguration.CODEC)
	);

	// OneBlock Spawner Item
	public static final ResourceKey<Item> ONE_BLOCK_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(MOD_ID, "one_block")
	);

	public static final Item ONE_BLOCK_ITEM = Registry.register(
		BuiltInRegistries.ITEM,
		ONE_BLOCK_KEY,
		new OneBlockItem(new Item.Properties().setId(ONE_BLOCK_KEY).stacksTo(64))
	);

	// Creative Tab
	public static final ResourceKey<CreativeModeTab> TAB_KEY = ResourceKey.create(
		Registries.CREATIVE_MODE_TAB,
		Identifier.fromNamespaceAndPath(MOD_ID, "tab")
	);

	public static final CreativeModeTab TAB = FabricItemGroup.builder()
		.icon(() -> new ItemStack(ONE_BLOCK_ITEM))
		.title(Component.translatable("itemGroup.oneblock_skyblock.tab"))
		.displayItems((params, output) -> output.accept(ONE_BLOCK_ITEM))
		.build();

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing OneBlock & Skyblock Mod for Minecraft 1.21.11!");

		// Register Creative Tab
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, TAB_KEY, TAB);
		ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.TOOLS_AND_UTILITIES).register(entries -> entries.accept(ONE_BLOCK_ITEM));

		// Register Commands
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			ModCommands.register(dispatcher);
		});

		// Block Break Listener (OneBlock infinite regeneration)
		PlayerBlockBreakEvents.AFTER.register((world, player, pos, state, blockEntity) -> {
			if (world instanceof ServerLevel serverLevel && player instanceof ServerPlayer serverPlayer) {
				OneBlockManager.onBlockBreak(serverLevel, serverPlayer, pos, state);
			}
		});

		// Server World Load Listener (Safety check and setup on world creation/load)
		ServerWorldEvents.LOAD.register((server, world) -> {
			if (world.dimension() == Level.OVERWORLD) {
				OneBlockData data = OneBlockData.get(world);
				BlockPos spawnPos = new BlockPos(0, 64, 0);
				Holder<Biome> biomeHolder = world.getBiome(spawnPos);
				Optional<ResourceKey<Biome>> key = biomeHolder.unwrapKey();

				if (key.isPresent()) {
					Identifier biomeId = key.get().identifier();
					if (biomeId.getNamespace().equals(MOD_ID)) {
						if (biomeId.getPath().equals("oneblock_void")) {
							data.setOneBlockWorld(true);
							data.setInitialized(true);
							OneBlockManager.initSpawn(world);
							LOGGER.info("Initialized OneBlock world at (0, 64, 0)!");
						} else if (biomeId.getPath().equals("skyblock_void")) {
							data.setSkyblockWorld(true);
							data.setInitialized(true);
							SkyblockGenerator.generateIsland(world, spawnPos, true);
							LOGGER.info("Initialized Skyblock island at (0, 64, 0)!");
						}
					}
				}
				data.save(world);
			}
		});

		// Player Join Listener (Welcome notification)
		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			ServerPlayer player = handler.getPlayer();
			ServerLevel world = player.level();
			OneBlockData data = OneBlockData.get(world);

			if (data.isOneBlockWorld()) {
				player.sendSystemMessage(Component.literal("§6§l========================================"), false);
				player.sendSystemMessage(Component.literal("§e§lWelcome to ONEBLOCK!"), false);
				player.sendSystemMessage(Component.literal("§aMine the block beneath your feet to progress through 8 phases!"), false);
				player.sendSystemMessage(Component.literal("§7Use §b/oneblock info §7to check stats, or §b/oneblock reset§7."), false);
				player.sendSystemMessage(Component.literal("§6§l========================================"), false);
			} else if (data.isSkyblockWorld()) {
				player.sendSystemMessage(Component.literal("§6§l========================================"), false);
				player.sendSystemMessage(Component.literal("§e§lWelcome to SKYBLOCK!"), false);
				player.sendSystemMessage(Component.literal("§aSurvive with limited resources in the void!"), false);
				player.sendSystemMessage(Component.literal("§7Use §b/skyblock reset §7to re-generate or §b/skyblock tp§7."), false);
				player.sendSystemMessage(Component.literal("§6§l========================================"), false);
			}
		});
	}
}
