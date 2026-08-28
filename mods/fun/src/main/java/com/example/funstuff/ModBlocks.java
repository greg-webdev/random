package com.example.funstuff;

import com.example.funstuff.block.TrampolineBlock;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;

public class ModBlocks {
	public static final ResourceKey<Block> TRAMPOLINE_KEY = ResourceKey.create(
		Registries.BLOCK,
		Identifier.fromNamespaceAndPath(FunStuffMod.MOD_ID, "trampoline")
	);

	public static final Block TRAMPOLINE = Blocks.register(
		TRAMPOLINE_KEY,
		TrampolineBlock::new,
		BlockBehaviour.Properties.of()
			.sound(SoundType.SLIME_BLOCK)
			.strength(0.8f)
			.noOcclusion()
	);

	public static final ResourceKey<Item> TRAMPOLINE_ITEM_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(FunStuffMod.MOD_ID, "trampoline")
	);

	public static final BlockItem TRAMPOLINE_ITEM = Registry.register(
		BuiltInRegistries.ITEM,
		TRAMPOLINE_ITEM_KEY,
		new BlockItem(TRAMPOLINE, new Item.Properties().setId(TRAMPOLINE_ITEM_KEY).useBlockDescriptionPrefix())
	);

	public static void initialize() {
		FunStuffMod.LOGGER.info("Registered Fun Stuff Blocks!");
	}
}
