package com.laserweapons;

import com.laserweapons.block.LaserEmitterBlock;
import com.laserweapons.block.entity.LaserEmitterBlockEntity;
import com.laserweapons.entity.LaserRocketEntity;
import com.laserweapons.item.HandheldLaserItem;
import com.laserweapons.item.InstakillGunItem;
import com.laserweapons.item.LaserRocketLauncherItem;
import com.laserweapons.item.MinigunItem;
import com.laserweapons.sound.ModSounds;
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
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
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
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class LaserWeaponsMod implements ModInitializer {
    public static final String MOD_ID = "laser_weapons";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public static final ResourceKey<Item> INSTAKILL_GUN_KEY = ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, "instakill_gun"));
    public static final ResourceKey<Item> HANDHELD_LASER_KEY = ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, "handheld_laser"));
    public static final ResourceKey<Item> MINIGUN_KEY = ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, "minigun"));
    public static final ResourceKey<Item> LASER_ROCKET_LAUNCHER_KEY = ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, "laser_rocket_launcher"));
    public static final ResourceKey<Block> LASER_EMITTER_BLOCK_KEY = ResourceKey.create(Registries.BLOCK, Identifier.fromNamespaceAndPath(MOD_ID, "laser_emitter"));
    public static final ResourceKey<Item> LASER_EMITTER_ITEM_KEY = ResourceKey.create(Registries.ITEM, Identifier.fromNamespaceAndPath(MOD_ID, "laser_emitter"));
    public static final ResourceKey<EntityType<?>> LASER_ROCKET_KEY = ResourceKey.create(Registries.ENTITY_TYPE, Identifier.fromNamespaceAndPath(MOD_ID, "laser_rocket"));
    public static final ResourceKey<BlockEntityType<?>> LASER_EMITTER_BE_KEY = ResourceKey.create(Registries.BLOCK_ENTITY_TYPE, Identifier.fromNamespaceAndPath(MOD_ID, "laser_emitter"));
    public static final ResourceKey<CreativeModeTab> LASER_TAB_KEY = ResourceKey.create(Registries.CREATIVE_MODE_TAB, Identifier.fromNamespaceAndPath(MOD_ID, "laser_weapons_tab"));

    public static final Item INSTAKILL_GUN = Registry.register(BuiltInRegistries.ITEM, INSTAKILL_GUN_KEY, new InstakillGunItem(new Item.Properties().setId(INSTAKILL_GUN_KEY).stacksTo(1).rarity(Rarity.EPIC).fireResistant()));
    public static final Item HANDHELD_LASER = Registry.register(BuiltInRegistries.ITEM, HANDHELD_LASER_KEY, new HandheldLaserItem(new Item.Properties().setId(HANDHELD_LASER_KEY).stacksTo(1).rarity(Rarity.RARE).fireResistant()));
    public static final Item MINIGUN = Registry.register(BuiltInRegistries.ITEM, MINIGUN_KEY, new MinigunItem(new Item.Properties().setId(MINIGUN_KEY).stacksTo(1).rarity(Rarity.EPIC).fireResistant()));
    public static final Item LASER_ROCKET_LAUNCHER = Registry.register(BuiltInRegistries.ITEM, LASER_ROCKET_LAUNCHER_KEY, new LaserRocketLauncherItem(new Item.Properties().setId(LASER_ROCKET_LAUNCHER_KEY).stacksTo(1).rarity(Rarity.RARE).fireResistant()));
    public static final Block LASER_EMITTER_BLOCK = Registry.register(BuiltInRegistries.BLOCK, LASER_EMITTER_BLOCK_KEY, new LaserEmitterBlock(BlockBehaviour.Properties.of().setId(LASER_EMITTER_BLOCK_KEY).strength(4.0f, 6.0f).sound(SoundType.METAL).noOcclusion()));
    public static final Item LASER_EMITTER_ITEM = Registry.register(BuiltInRegistries.ITEM, LASER_EMITTER_ITEM_KEY, new BlockItem(LASER_EMITTER_BLOCK, new Item.Properties().setId(LASER_EMITTER_ITEM_KEY).useBlockDescriptionPrefix()));
    public static final BlockEntityType<LaserEmitterBlockEntity> LASER_EMITTER_BLOCK_ENTITY = Registry.register(BuiltInRegistries.BLOCK_ENTITY_TYPE, LASER_EMITTER_BE_KEY, FabricBlockEntityTypeBuilder.create(LaserEmitterBlockEntity::new, LASER_EMITTER_BLOCK).build());
    public static final EntityType<LaserRocketEntity> LASER_ROCKET_ENTITY = Registry.register(BuiltInRegistries.ENTITY_TYPE, LASER_ROCKET_KEY, EntityType.Builder.<LaserRocketEntity>of(LaserRocketEntity::new, MobCategory.MISC).sized(0.5f, 0.5f).clientTrackingRange(4).updateInterval(10).build(LASER_ROCKET_KEY));

    public static final CreativeModeTab LASER_TAB = FabricItemGroup.builder().icon(() -> new ItemStack(INSTAKILL_GUN)).title(Component.translatable("itemGroup.laser_weapons")).displayItems((itemDisplayParameters, output) -> {
        output.accept(INSTAKILL_GUN);
        output.accept(HANDHELD_LASER);
        output.accept(MINIGUN);
        output.accept(LASER_ROCKET_LAUNCHER);
        output.accept(LASER_EMITTER_ITEM);
    }).build();

    @Override
    public void onInitialize() {
        LOGGER.info("Initializing Laser Weapons Mod for Minecraft 1.21.11!");
        ModSounds.initialize();
        Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, LASER_TAB_KEY, LASER_TAB);
        ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.COMBAT).register(entries -> {
            entries.accept(INSTAKILL_GUN);
            entries.accept(HANDHELD_LASER);
            entries.accept(MINIGUN);
            entries.accept(LASER_ROCKET_LAUNCHER);
        });
        ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.REDSTONE_BLOCKS).register(entries -> entries.accept(LASER_EMITTER_ITEM));
        LOGGER.info("Laser Weapons Mod registered successfully!");
    }
}
