package com.yourname.tntmod;

import com.mojang.brigadier.arguments.LongArgumentType;
import com.yourname.tntmod.item.CustomTntItem;
import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.fabricmc.fabric.api.itemgroup.v1.ItemGroupEvents;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class MainMod implements ModInitializer {
	public static final String MOD_ID = "tntmod";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	// Delay storage: Default is 0L (no delay)
	private static final Map<UUID, Long> PLAYER_DELAYS = new ConcurrentHashMap<>();
	private static volatile long defaultDelay = 0L;

	// Custom TNT Item Registration
	public static final ResourceKey<Item> CUSTOM_TNT_KEY = ResourceKey.create(
		Registries.ITEM,
		Identifier.fromNamespaceAndPath(MOD_ID, "custom_tnt")
	);

	public static final Item CUSTOM_TNT = Registry.register(
		BuiltInRegistries.ITEM,
		CUSTOM_TNT_KEY,
		new CustomTntItem(new Item.Properties().setId(CUSTOM_TNT_KEY).stacksTo(64))
	);

	// Creative Tab Registration
	public static final ResourceKey<CreativeModeTab> TNT_TAB_KEY = ResourceKey.create(
		Registries.CREATIVE_MODE_TAB,
		Identifier.fromNamespaceAndPath(MOD_ID, "tnt_tab")
	);

	public static final CreativeModeTab TNT_TAB = FabricItemGroup.builder()
		.icon(() -> new ItemStack(CUSTOM_TNT))
		.title(Component.literal("TNT Mod"))
		.displayItems((params, output) -> output.accept(CUSTOM_TNT))
		.build();

	@Override
	public void onInitialize() {
		LOGGER.info("Initializing TNT Mod with Custom TNT item and /tntdelay command!");

		// Register Creative Mode Tab
		Registry.register(BuiltInRegistries.CREATIVE_MODE_TAB, TNT_TAB_KEY, TNT_TAB);

		// Also add to vanilla Redstone tab
		ItemGroupEvents.modifyEntriesEvent(CreativeModeTabs.REDSTONE_BLOCKS).register(entries -> entries.accept(CUSTOM_TNT));

		// Register commands: /tntdelay and /customtnt
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) -> {
			// /tntdelay <0 - 99999999999>
			dispatcher.register(
				Commands.literal("tntdelay")
					.then(Commands.argument("delay", LongArgumentType.longArg(0, 99999999999L))
						.executes(context -> {
							long delay = LongArgumentType.getLong(context, "delay");
							CommandSourceStack source = context.getSource();

							if (source.getEntity() instanceof ServerPlayer player) {
								setDelay(player.getUUID(), delay);
								source.sendSuccess(() -> Component.literal("§a[TNT Mod] Custom TNT delay set to §e" + delay + " §aticks."), false);
							} else {
								setDefaultDelay(delay);
								source.sendSuccess(() -> Component.literal("§a[TNT Mod] Global TNT delay set to §e" + delay + " §aticks."), false);
							}
							return 1;
						})
					)
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						long delay = (source.getEntity() instanceof ServerPlayer player)
							? getDelay(player.getUUID())
							: getDefaultDelay();
						source.sendSuccess(() -> Component.literal("§a[TNT Mod] Current TNT delay: §e" + delay + " §aticks (use §e/tntdelay <0-99999999999>§a to change)."), false);
						return 1;
					})
			);

			// /customtnt shortcut to quickly obtain the item
			dispatcher.register(
				Commands.literal("customtnt")
					.executes(context -> {
						CommandSourceStack source = context.getSource();
						if (source.getEntity() instanceof ServerPlayer player) {
							ItemStack stack = new ItemStack(CUSTOM_TNT);
							if (!player.getInventory().add(stack)) {
								player.drop(stack, false);
							}
							source.sendSuccess(() -> Component.literal("§a[TNT Mod] Gave 1x Custom TNT!"), false);
							return 1;
						} else {
							source.sendFailure(Component.literal("Only players can execute /customtnt. Use /give <player> tntmod:custom_tnt"));
							return 0;
						}
					})
			);
		});
	}

	public static long getDelay(UUID playerUuid) {
		return PLAYER_DELAYS.getOrDefault(playerUuid, defaultDelay);
	}

	public static void setDelay(UUID playerUuid, long delay) {
		PLAYER_DELAYS.put(playerUuid, delay);
		defaultDelay = delay;
	}

	public static long getDefaultDelay() {
		return defaultDelay;
	}

	public static void setDefaultDelay(long delay) {
		defaultDelay = delay;
	}
}