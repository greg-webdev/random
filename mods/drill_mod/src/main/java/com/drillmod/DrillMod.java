package com.drillmod;

import com.drillmod.inventory.DrillMenu;
import com.drillmod.inventory.DrillMenuData;
import com.drillmod.inventory.DrillStorage;
import com.drillmod.item.DrillItem;
import com.drillmod.network.DrillActionPayload;
import com.drillmod.network.DrillSyncPayload;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.fabricmc.fabric.api.loot.v3.LootTableEvents;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.fabricmc.fabric.api.screenhandler.v1.ExtendedScreenHandlerFactory;
import net.fabricmc.fabric.api.screenhandler.v1.ExtendedScreenHandlerType;
import net.minecraft.commands.Commands;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.enchantment.Enchantment;
import net.minecraft.world.item.enchantment.EnchantmentHelper;
import net.minecraft.world.item.enchantment.EnchantmentInstance;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DrillMod implements ModInitializer {
	public static final String MOD_ID = "drill_mod";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	static {
		if (System.getProperty("voxy.geometryBufferSizeOverrideMB") == null) {
			System.setProperty("voxy.geometryBufferSizeOverrideMB", "1024");
		}
	}

	// Drill Item Registration
	public static final ResourceKey<Item> DRILL_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(MOD_ID, "drill")
	);

	public static final Item DRILL = Registry.register(
		BuiltInRegistries.ITEM,
		DRILL_KEY,
		new DrillItem(new Item.Properties().setId(DRILL_KEY).stacksTo(1).durability(2048))
	);

	// Drill Menu Registration
	public static final MenuType<DrillMenu> DRILL_MENU_TYPE = Registry.register(
		BuiltInRegistries.MENU,
		Identifier.fromNamespaceAndPath(MOD_ID, "drill_menu"),
		new ExtendedScreenHandlerType<>(DrillMenu::new, DrillMenuData.STREAM_CODEC)
	);

	// Smelt Enchantment Key
	public static final ResourceKey<Enchantment> SMELT_KEY = ResourceKey.create(
		Registries.ENCHANTMENT,
		Identifier.fromNamespaceAndPath(MOD_ID, "smelt")
	);

	// Range Enchantment Key
	public static final ResourceKey<Enchantment> RANGE_KEY = ResourceKey.create(
		Registries.ENCHANTMENT,
		Identifier.fromNamespaceAndPath(MOD_ID, "range")
	);

	// Save Drill Enchantment Key
	public static final ResourceKey<Enchantment> SAVEDRILL_KEY = ResourceKey.create(
		Registries.ENCHANTMENT,
		Identifier.fromNamespaceAndPath(MOD_ID, "savedrill")
	);

	// Indestructible Enchantment Key
	public static final ResourceKey<Enchantment> INDESTRUCTIBLE_KEY = ResourceKey.create(
		Registries.ENCHANTMENT,
		Identifier.fromNamespaceAndPath(MOD_ID, "indestructible")
	);

	// Creative Tab Registration
	public static final ResourceKey<CreativeModeTab> DRILL_TAB_KEY = ResourceKey.create(
		Registries.CREATIVE_MODE_TAB,
		Identifier.fromNamespaceAndPath(MOD_ID, "drill_tab")
	);

	public static final CreativeModeTab DRILL_TAB = FabricItemGroup.builder()
		.icon(() -> new ItemStack(DRILL))
		.title(Component.literal("Drill Mod"))
		.displayItems((params, output) -> output.accept(DRILL))
		.build();

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing Drill Mod for Minecraft 1.21.11!");

		// 1. Creative tabs
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, DRILL_TAB_KEY, DRILL_TAB);
		ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.TOOLS_AND_UTILITIES).register(entries -> entries.accept(DRILL));

		// 2. Network Payloads
		PayloadTypeRegistry.playS2C().register(DrillSyncPayload.TYPE, DrillSyncPayload.STREAM_CODEC);
		PayloadTypeRegistry.playC2S().register(DrillActionPayload.TYPE, DrillActionPayload.STREAM_CODEC);

		// 3. Network Receivers
		ServerPlayNetworking.registerGlobalReceiver(DrillActionPayload.TYPE, (payload, context) -> {
			context.server().execute(() -> {
				ServerPlayer player = context.player();
				if (player.containerMenu instanceof DrillMenu menu) {
					menu.handleAction(payload.action(), payload.param(), player);
				}
			});
		});

		// 4. Command Registrations
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			dispatcher.register(
				Commands.literal("drill_inv")
					.executes(ctx -> {
						if (ctx.getSource().getEntity() instanceof ServerPlayer player) {
							openDrillMenu(player);
							return 1;
						}
						return 0;
					})
			);

			dispatcher.register(
				Commands.literal("drill")
					.then(Commands.literal("inv")
						.executes(ctx -> {
							if (ctx.getSource().getEntity() instanceof ServerPlayer player) {
								openDrillMenu(player);
								return 1;
							}
							return 0;
						})
					)
					.then(Commands.literal("restore")
						.executes(ctx -> {
							if (ctx.getSource().getEntity() instanceof ServerPlayer player) {
								restorePlayerDrill(player);
								return 1;
							}
							return 0;
						})
					)
					.then(Commands.literal("load")
						.executes(ctx -> {
							if (ctx.getSource().getEntity() instanceof ServerPlayer player) {
								restorePlayerDrill(player);
								return 1;
							}
							return 0;
						})
					)
					.then(Commands.literal("backup")
						.executes(ctx -> {
							if (ctx.getSource().getEntity() instanceof ServerPlayer player) {
								backupPlayerDrill(player);
								return 1;
							}
							return 0;
						})
					)
					.executes(ctx -> {
						if (ctx.getSource().getEntity() instanceof ServerPlayer player) {
							openDrillMenu(player);
							return 1;
						}
						return 0;
					})
			);
		});

		// 5. Structure Chest Loot Table Spawning
		LootTableEvents.MODIFY_DROPS.register((key, context, drops) -> {
			key.unwrapKey().ifPresent(tableKey -> {
				String path = tableKey.identifier().getPath();
				if (path.startsWith("chests/")) {
					// 35% chance to spawn an Enchanted Book with 'smelt' (level 1-9)
					if (context.getRandom().nextFloat() < 0.35f) {
						int level = context.getRandom().nextInt(9) + 1; // 1 to 9
						context.getLevel().registryAccess().lookup(Registries.ENCHANTMENT)
							.flatMap(reg -> reg.get(SMELT_KEY))
							.ifPresent(holder -> {
								ItemStack book = EnchantmentHelper.createBook(new EnchantmentInstance(holder, level));
								drops.add(book);
							});
					}

					// 25% chance to spawn an Enchanted Book with 'range' (level 1-3)
					if (context.getRandom().nextFloat() < 0.25f) {
						int rangeLevel = context.getRandom().nextInt(3) + 1; // 1 to 3
						context.getLevel().registryAccess().lookup(Registries.ENCHANTMENT)
							.flatMap(reg -> reg.get(RANGE_KEY))
							.ifPresent(holder -> {
								ItemStack book = EnchantmentHelper.createBook(new EnchantmentInstance(holder, rangeLevel));
								drops.add(book);
							});
					}

					// 20% chance to spawn an Enchanted Book with 'savedrill'
					if (context.getRandom().nextFloat() < 0.20f) {
						context.getLevel().registryAccess().lookup(Registries.ENCHANTMENT)
							.flatMap(reg -> reg.get(SAVEDRILL_KEY))
							.ifPresent(holder -> {
								ItemStack book = EnchantmentHelper.createBook(new EnchantmentInstance(holder, 1));
								drops.add(book);
							});
					}

					// 5% rare chance to spawn an Enchanted Book with 'indestructible'
					if (context.getRandom().nextFloat() < 0.05f) {
						context.getLevel().registryAccess().lookup(Registries.ENCHANTMENT)
							.flatMap(reg -> reg.get(INDESTRUCTIBLE_KEY))
							.ifPresent(holder -> {
								ItemStack book = EnchantmentHelper.createBook(new EnchantmentInstance(holder, 1));
								drops.add(book);
							});
					}

					// 6% chance to find a Drill in structure chests
					if (context.getRandom().nextFloat() < 0.06f) {
						drops.add(new ItemStack(DRILL));
					}
				}
			});
		});

		// 6. Tick drillers for Night Vision timer removal
		ServerTickEvents.END_SERVER_TICK.register(DrillItem::tickDrillers);

		LOGGER.info("Drill Mod initialized successfully!");
	}

	public static void openDrillMenu(ServerPlayer player) {
		ItemStack drillStack = ItemStack.EMPTY;
		int drillSlot = -1;

		if (player.getMainHandItem().is(DRILL)) {
			drillStack = player.getMainHandItem();
			drillSlot = player.getInventory().getSelectedSlot();
		} else if (player.getOffhandItem().is(DRILL)) {
			drillStack = player.getOffhandItem();
			drillSlot = 40;
		} else {
			for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
				if (player.getInventory().getItem(i).is(DRILL)) {
					drillStack = player.getInventory().getItem(i);
					drillSlot = i;
					break;
				}
			}
		}

		if (drillStack.isEmpty()) {
			player.sendSystemMessage(Component.literal("§c[Drill Mod] You must have a Drill in your hand or inventory!"));
			return;
		}

		final int finalSlot = drillSlot;
		final DrillStorage storage = DrillStorage.loadFromStack(drillStack, player.level().registryAccess());

		player.openMenu(new ExtendedScreenHandlerFactory<DrillMenuData>() {
			@Override
			public DrillMenuData getScreenOpeningData(ServerPlayer p) {
				return new DrillMenuData(finalSlot, storage.getEntries());
			}

			@Override
			public Component getDisplayName() {
				return Component.literal("⚡ DRILL INVENTORY ⚡");
			}

			@Override
			public AbstractContainerMenu createMenu(int syncId, Inventory playerInventory, Player p) {
				return new DrillMenu(syncId, playerInventory, finalSlot, storage);
			}
		});
	}

	public static void restorePlayerDrill(ServerPlayer player) {
		ItemStack drillStack = findDrill(player);
		if (drillStack.isEmpty()) {
			player.sendSystemMessage(Component.literal("§c[Drill Mod] You must have a Drill in your hand or inventory to restore into!"));
			return;
		}

		DrillStorage backup = com.drillmod.inventory.SavedDrillManager.loadBackup(((ServerLevel) player.level()).getServer(), player.getUUID());
		if (backup != null && backup.size() > 0) {
			DrillStorage currentStorage = DrillStorage.loadFromStack(drillStack, player.level().registryAccess());
			for (DrillStorage.Entry entry : backup.getEntries()) {
				currentStorage.addRaw(entry.getItem(), entry.getCount());
			}
			DrillStorage.saveToStack(drillStack, currentStorage, player.level().registryAccess());
			player.sendSystemMessage(Component.literal("§a[Drill Mod] Successfully restored §e" + backup.getTotalItems() + " §aitems from your saved drill backup into this drill!"));
		} else {
			player.sendSystemMessage(Component.literal("§c[Drill Mod] No saved drill backup found for your account!"));
		}
	}

	public static void backupPlayerDrill(ServerPlayer player) {
		ItemStack drillStack = findDrill(player);
		if (drillStack.isEmpty()) {
			player.sendSystemMessage(Component.literal("§c[Drill Mod] You must have a Drill to backup!"));
			return;
		}

		DrillStorage storage = DrillStorage.loadFromStack(drillStack, player.level().registryAccess());
		com.drillmod.inventory.SavedDrillManager.saveBackup(((ServerLevel) player.level()).getServer(), player.getUUID(), storage);
		player.sendSystemMessage(Component.literal("§a[Drill Mod] Drill inventory successfully saved to backup!"));
	}

	public static ItemStack findDrill(ServerPlayer player) {
		if (player.getMainHandItem().is(DRILL)) return player.getMainHandItem();
		if (player.getOffhandItem().is(DRILL)) return player.getOffhandItem();
		for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
			ItemStack item = player.getInventory().getItem(i);
			if (item.is(DRILL)) return item;
		}
		return ItemStack.EMPTY;
	}
}
