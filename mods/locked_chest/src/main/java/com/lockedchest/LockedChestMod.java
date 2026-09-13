package com.lockedchest;

import com.lockedchest.block.LockedChestBlock;
import com.lockedchest.block.entity.LockedChestBlockEntity;
import com.lockedchest.item.KeyItem;
import com.lockedchest.item.MasterKeyItem;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.fabricmc.fabric.api.object.builder.v1.block.entity.FabricBlockEntityTypeBuilder;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.material.MapColor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LockedChestMod implements ModInitializer {
	public static final String MOD_ID = "locked_chest";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	// Block & BlockItem Keys
	public static final ResourceKey<Block> LOCKED_CHEST_BLOCK_KEY = ResourceKey.create(
		Registries.BLOCK,
		Identifier.fromNamespaceAndPath(MOD_ID, "locked_chest")
	);

	public static final ResourceKey<Item> LOCKED_CHEST_ITEM_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(MOD_ID, "locked_chest")
	);

	// Item Keys
	public static final ResourceKey<Item> KEY_ITEM_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(MOD_ID, "key")
	);

	public static final ResourceKey<Item> MASTER_KEY_ITEM_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(MOD_ID, "master_key")
	);

	// Block Entity Key
	public static final ResourceKey<BlockEntityType<?>> LOCKED_CHEST_BE_KEY = ResourceKey.create(
		Registries.BLOCK_ENTITY_TYPE,
		Identifier.fromNamespaceAndPath(MOD_ID, "locked_chest")
	);

	// Creative Tab Key
	public static final ResourceKey<CreativeModeTab> TAB_KEY = ResourceKey.create(
		Registries.CREATIVE_MODE_TAB,
		Identifier.fromNamespaceAndPath(MOD_ID, "locked_chest_tab")
	);

	// Block Registration
	public static final LockedChestBlock LOCKED_CHEST = Registry.register(
		BuiltInRegistries.BLOCK,
		LOCKED_CHEST_BLOCK_KEY,
		new LockedChestBlock(
			BlockBehaviour.Properties.of()
				.setId(LOCKED_CHEST_BLOCK_KEY)
				.mapColor(MapColor.METAL)
				.strength(5.0F, 1200.0F)
				.sound(SoundType.METAL)
				.noOcclusion()
		)
	);

	// Items Registration
	public static final BlockItem LOCKED_CHEST_ITEM = Registry.register(
		BuiltInRegistries.ITEM,
		LOCKED_CHEST_ITEM_KEY,
		new BlockItem(
			LOCKED_CHEST,
			new Item.Properties()
				.setId(LOCKED_CHEST_ITEM_KEY)
				.useBlockDescriptionPrefix()
		)
	);

	public static final KeyItem KEY = Registry.register(
		BuiltInRegistries.ITEM,
		KEY_ITEM_KEY,
		new KeyItem(
			new Item.Properties()
				.setId(KEY_ITEM_KEY)
				.stacksTo(1)
		)
	);

	// Master Key is registered so it can be crafted in the crafting table,
	// but is NOT added to any Creative Tabs so it is completely unobtainable unless crafted!
	public static final MasterKeyItem MASTER_KEY = Registry.register(
		BuiltInRegistries.ITEM,
		MASTER_KEY_ITEM_KEY,
		new MasterKeyItem(
			new Item.Properties()
				.setId(MASTER_KEY_ITEM_KEY)
				.stacksTo(1)
				.rarity(Rarity.EPIC)
		)
	);

	// Block Entity Registration
	public static final BlockEntityType<LockedChestBlockEntity> LOCKED_CHEST_BLOCK_ENTITY = Registry.register(
		BuiltInRegistries.BLOCK_ENTITY_TYPE,
		LOCKED_CHEST_BE_KEY,
		FabricBlockEntityTypeBuilder.create(LockedChestBlockEntity::new, LOCKED_CHEST).build()
	);

	// Creative Tab: only contains Locked Chest and regular Key. Master Key is excluded!
	public static final CreativeModeTab TAB = FabricItemGroup.builder()
		.icon(() -> new ItemStack(LOCKED_CHEST_ITEM))
		.title(Component.literal("Locked Chests"))
		.displayItems((params, output) -> {
			output.accept(LOCKED_CHEST_ITEM);
			output.accept(KEY);
		})
		.build();

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing Locked Chest Mod for Minecraft 1.21.11!");

		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, TAB_KEY, TAB);

		ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.FUNCTIONAL_BLOCKS).register(entries -> {
			entries.accept(LOCKED_CHEST_ITEM);
		});

		ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.TOOLS_AND_UTILITIES).register(entries -> {
			entries.accept(KEY);
		});
	}
}
