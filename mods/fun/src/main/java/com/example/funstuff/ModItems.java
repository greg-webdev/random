package com.example.funstuff;

import com.example.funstuff.item.BouncyBootsItem;
import com.example.funstuff.item.DiscoBombItem;
import com.example.funstuff.item.GrapplingSlingerItem;
import com.example.funstuff.item.PartyPopperItem;
import com.example.funstuff.item.PocketBlackHoleItem;
import com.example.funstuff.item.PolymorphWandItem;
import com.example.funstuff.item.RainbowBlasterItem;
import com.example.funstuff.item.RainbowCheeseItem;
import com.example.funstuff.item.ScaleRayItem;
import com.example.funstuff.item.SlimeLauncherItem;
import com.example.funstuff.item.ThunderHammerItem;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.food.FoodProperties;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.item.equipment.ArmorMaterials;
import net.minecraft.world.item.equipment.ArmorType;

import java.util.function.Function;

public class ModItems {
	public static final ResourceKey<Item> SLIME_LAUNCHER_KEY = key("slime_launcher");
	public static final Item SLIME_LAUNCHER = register(
		SLIME_LAUNCHER_KEY,
		SlimeLauncherItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.RARE).durability(250)
	);

	public static final ResourceKey<Item> BOUNCY_BOOTS_KEY = key("bouncy_boots");
	public static final Item BOUNCY_BOOTS = register(
		BOUNCY_BOOTS_KEY,
		BouncyBootsItem::new,
		new Item.Properties()
			.humanoidArmor(ArmorMaterials.GOLD, ArmorType.BOOTS)
			.durability(ArmorType.BOOTS.getDurability(18))
			.rarity(Rarity.EPIC)
	);

	public static final ResourceKey<Item> PARTY_POPPER_KEY = key("party_popper");
	public static final Item PARTY_POPPER = register(
		PARTY_POPPER_KEY,
		PartyPopperItem::new,
		new Item.Properties().stacksTo(16).rarity(Rarity.UNCOMMON)
	);

	public static final ResourceKey<Item> POCKET_BLACK_HOLE_KEY = key("pocket_black_hole");
	public static final Item POCKET_BLACK_HOLE = register(
		POCKET_BLACK_HOLE_KEY,
		PocketBlackHoleItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.EPIC).durability(500)
	);

	public static final ResourceKey<Item> POLYMORPH_WAND_KEY = key("polymorph_wand");
	public static final Item POLYMORPH_WAND = register(
		POLYMORPH_WAND_KEY,
		PolymorphWandItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.RARE).durability(100)
	);

	public static final ResourceKey<Item> RAINBOW_CHEESE_KEY = key("rainbow_cheese");
	public static final Item RAINBOW_CHEESE = register(
		RAINBOW_CHEESE_KEY,
		RainbowCheeseItem::new,
		new Item.Properties()
			.food(new FoodProperties(6, 1.2f, true))
			.stacksTo(64)
			.rarity(Rarity.UNCOMMON)
	);

	public static final ResourceKey<Item> GRAPPLING_SLINGER_KEY = key("grappling_slinger");
	public static final Item GRAPPLING_SLINGER = register(
		GRAPPLING_SLINGER_KEY,
		GrapplingSlingerItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.RARE).durability(300)
	);

	public static final ResourceKey<Item> DISCO_BOMB_KEY = key("disco_bomb");
	public static final Item DISCO_BOMB = register(
		DISCO_BOMB_KEY,
		DiscoBombItem::new,
		new Item.Properties().stacksTo(16).rarity(Rarity.RARE)
	);

	public static final ResourceKey<Item> SCALE_RAY_KEY = key("scale_ray");
	public static final Item SCALE_RAY = register(
		SCALE_RAY_KEY,
		ScaleRayItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.EPIC).durability(150)
	);

	public static final ResourceKey<Item> THUNDER_HAMMER_KEY = key("thunder_hammer");
	public static final Item THUNDER_HAMMER = register(
		THUNDER_HAMMER_KEY,
		ThunderHammerItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.EPIC).durability(400)
	);

	public static final ResourceKey<Item> RAINBOW_BLASTER_KEY = key("rainbow_blaster");
	public static final Item RAINBOW_BLASTER = register(
		RAINBOW_BLASTER_KEY,
		RainbowBlasterItem::new,
		new Item.Properties().stacksTo(1).rarity(Rarity.EPIC).durability(600)
	);

	private static ResourceKey<Item> key(String name) {
		return ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(FunStuffMod.MOD_ID, name));
	}

	private static <T extends Item> T register(ResourceKey<Item> key, Function<Item.Properties, T> factory, Item.Properties properties) {
		properties.setId(key);
		T item = factory.apply(properties);
		return Registry.register(BuiltInRegistries.ITEM, key, item);
	}

	public static void initialize() {
		FunStuffMod.LOGGER.info("Registered Fun Stuff Items!");
	}
}
