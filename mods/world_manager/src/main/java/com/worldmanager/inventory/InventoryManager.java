package com.worldmanager.inventory;

import com.worldmanager.config.WorldConfig;
import com.worldmanager.world.WorldType;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.NbtAccounter;
import net.minecraft.nbt.NbtIo;
import net.minecraft.nbt.NbtOps;
import net.minecraft.nbt.Tag;
import net.minecraft.resources.RegistryOps;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.inventory.PlayerEnderChestContainer;
import net.minecraft.world.item.ItemStack;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;

public class InventoryManager {
	private static final Logger LOGGER = LoggerFactory.getLogger("WorldManager/Inventory");
	private static final Path INVENTORY_DIR = Path.of("world_manager_data", "inventories");

	public static void savePlayerInventory(ServerPlayer player, WorldType worldType) {
		if (!WorldConfig.get().isPerWorldInventory()) {
			return; // Shared inventory across all world types
		}

		try {
			if (!Files.exists(INVENTORY_DIR)) {
				Files.createDirectories(INVENTORY_DIR);
			}

			Path file = INVENTORY_DIR.resolve(player.getUUID() + "_" + worldType.getId() + ".nbt");
			CompoundTag root = new CompoundTag();
			RegistryOps<Tag> ops = RegistryOps.create(NbtOps.INSTANCE, player.registryAccess());

			// Save Main Inventory
			ListTag invList = new ListTag();
			for (int i = 0; i < player.getInventory().getContainerSize(); i++) {
				ItemStack stack = player.getInventory().getItem(i);
				if (!stack.isEmpty()) {
					CompoundTag slotTag = new CompoundTag();
					slotTag.putInt("Slot", i);
					Tag itemTag = ItemStack.CODEC.encodeStart(ops, stack).getOrThrow();
					slotTag.put("Item", itemTag);
					invList.add(slotTag);
				}
			}
			root.put("Inventory", invList);

			// Save Ender Chest
			PlayerEnderChestContainer enderChest = player.getEnderChestInventory();
			ListTag enderList = new ListTag();
			for (int i = 0; i < enderChest.getContainerSize(); i++) {
				ItemStack stack = enderChest.getItem(i);
				if (!stack.isEmpty()) {
					CompoundTag slotTag = new CompoundTag();
					slotTag.putInt("Slot", i);
					Tag itemTag = ItemStack.CODEC.encodeStart(ops, stack).getOrThrow();
					slotTag.put("Item", itemTag);
					enderList.add(slotTag);
				}
			}
			root.put("EnderChest", enderList);

			// Save Experience
			root.putInt("XpLevel", player.experienceLevel);
			root.putFloat("XpProgress", player.experienceProgress);
			root.putInt("TotalXp", player.totalExperience);

			// Save Vitals
			root.putFloat("Health", player.getHealth());
			root.putInt("FoodLevel", player.getFoodData().getFoodLevel());
			root.putFloat("Saturation", player.getFoodData().getSaturationLevel());

			NbtIo.writeCompressed(root, file);
			LOGGER.info("Saved inventory for player {} on world {}", player.getName().getString(), worldType.getId());
		} catch (Exception e) {
			LOGGER.error("Failed to save inventory for player {}: ", player.getName().getString(), e);
		}
	}

	public static void loadPlayerInventory(ServerPlayer player, WorldType targetWorldType) {
		if (!WorldConfig.get().isPerWorldInventory()) {
			return; // Shared inventory
		}

		Path file = INVENTORY_DIR.resolve(player.getUUID() + "_" + targetWorldType.getId() + ".nbt");

		// Always clear current inventory first to prevent duplication
		player.getInventory().clearContent();
		player.getEnderChestInventory().clearContent();
		player.setExperienceLevels(0);
		player.setExperiencePoints(0);

		if (!Files.exists(file)) {
			// First time in this world type -> start fresh
			LOGGER.info("Player {} starting with fresh inventory in world {}", player.getName().getString(), targetWorldType.getId());
			player.containerMenu.broadcastChanges();
			return;
		}

		try {
			CompoundTag root = NbtIo.readCompressed(file, NbtAccounter.unlimitedHeap());
			RegistryOps<Tag> ops = RegistryOps.create(NbtOps.INSTANCE, player.registryAccess());

			// Restore Main Inventory
			if (root.contains("Inventory")) {
				ListTag invList = root.getListOrEmpty("Inventory");
				for (int i = 0; i < invList.size(); i++) {
					CompoundTag slotTag = invList.getCompoundOrEmpty(i);
					if (slotTag != null) {
						int slot = slotTag.getIntOr("Slot", -1);
						Tag itemTag = slotTag.get("Item");
						if (slot >= 0 && slot < player.getInventory().getContainerSize() && itemTag != null) {
							ItemStack stack = ItemStack.CODEC.parse(ops, itemTag).result().orElse(ItemStack.EMPTY);
							player.getInventory().setItem(slot, stack);
						}
					}
				}
			}

			// Restore Ender Chest
			if (root.contains("EnderChest")) {
				ListTag enderList = root.getListOrEmpty("EnderChest");
				PlayerEnderChestContainer enderChest = player.getEnderChestInventory();
				for (int i = 0; i < enderList.size(); i++) {
					CompoundTag slotTag = enderList.getCompoundOrEmpty(i);
					if (slotTag != null) {
						int slot = slotTag.getIntOr("Slot", -1);
						Tag itemTag = slotTag.get("Item");
						if (slot >= 0 && slot < enderChest.getContainerSize() && itemTag != null) {
							ItemStack stack = ItemStack.CODEC.parse(ops, itemTag).result().orElse(ItemStack.EMPTY);
							enderChest.setItem(slot, stack);
						}
					}
				}
			}

			// Restore XP
			player.experienceLevel = root.getIntOr("XpLevel", 0);
			player.experienceProgress = root.getFloatOr("XpProgress", 0.0f);
			player.totalExperience = root.getIntOr("TotalXp", 0);

			// Restore Vitals
			if (root.contains("Health")) {
				float health = root.getFloatOr("Health", 20.0f);
				player.setHealth(Math.max(1.0f, health));
			}
			if (root.contains("FoodLevel")) {
				int food = root.getIntOr("FoodLevel", 20);
				float sat = root.getFloatOr("Saturation", 5.0f);
				player.getFoodData().setFoodLevel(food);
				player.getFoodData().setSaturation(sat);
			}

			player.containerMenu.broadcastChanges();
			LOGGER.info("Loaded inventory for player {} on world {}", player.getName().getString(), targetWorldType.getId());
		} catch (Exception e) {
			LOGGER.error("Failed to load inventory for player {}: ", player.getName().getString(), e);
		}
	}
}
