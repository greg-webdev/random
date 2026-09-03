package com.example.utilitycommands.inventory;

import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.Container;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

public class PlayerInvWrapper implements Container {
	public static final int SIZE = 54;
	private final ServerPlayer target;

	public PlayerInvWrapper(ServerPlayer target) {
		this.target = target;
	}

	public ServerPlayer getTarget() {
		return target;
	}

	public boolean isDecorativeSlot(int slot) {
		// Row 4 separator slots
		if (slot == 36 || slot == 41 || slot == 43 || slot == 44) {
			return true;
		}
		// Row 5 info / decorative slots
		return slot >= 45 && slot <= 53;
	}

	@Override
	public int getContainerSize() {
		return SIZE;
	}

	@Override
	public boolean isEmpty() {
		return target.getInventory().isEmpty();
	}

	@Override
	public ItemStack getItem(int slot) {
		Inventory inv = target.getInventory();

		// Rows 0-2: Main Inventory (slots 9-35)
		if (slot >= 0 && slot <= 26) {
			return inv.getItem(slot + 9);
		}
		// Row 3: Hotbar (slots 0-8)
		if (slot >= 27 && slot <= 35) {
			return inv.getItem(slot - 27);
		}
		// Row 4: Armor & Offhand
		if (slot == 37) return target.getItemBySlot(EquipmentSlot.HEAD);
		if (slot == 38) return target.getItemBySlot(EquipmentSlot.CHEST);
		if (slot == 39) return target.getItemBySlot(EquipmentSlot.LEGS);
		if (slot == 40) return target.getItemBySlot(EquipmentSlot.FEET);
		if (slot == 42) return target.getItemBySlot(EquipmentSlot.OFFHAND);

		// Decorative / Info items
		if (slot == 45) {
			ItemStack health = new ItemStack(Items.GLISTERING_MELON_SLICE);
			health.set(DataComponents.CUSTOM_NAME, Component.literal("§c❤ Health: " + (int) target.getHealth() + " / " + (int) target.getMaxHealth()));
			return health;
		}
		if (slot == 46) {
			ItemStack food = new ItemStack(Items.COOKED_BEEF);
			food.set(DataComponents.CUSTOM_NAME, Component.literal("§6🍗 Food: " + target.getFoodData().getFoodLevel() + " / 20"));
			return food;
		}
		if (slot == 47) {
			ItemStack xp = new ItemStack(Items.EXPERIENCE_BOTTLE);
			xp.set(DataComponents.CUSTOM_NAME, Component.literal("§a✨ XP Level: " + target.experienceLevel + " (Total: " + target.totalExperience + ")"));
			return xp;
		}
		if (slot == 48) {
			ItemStack mode = new ItemStack(Items.COMPASS);
			mode.set(DataComponents.CUSTOM_NAME, Component.literal("§b🎮 Game Mode: §f" + target.gameMode.getGameModeForPlayer().getName()));
			return mode;
		}
		if (slot == 49) {
			ItemStack loc = new ItemStack(Items.RECOVERY_COMPASS);
			loc.set(DataComponents.CUSTOM_NAME, Component.literal("§e📍 Pos: " + target.getBlockX() + ", " + target.getBlockY() + ", " + target.getBlockZ()));
			return loc;
		}

		// Separator panes
		ItemStack pane = new ItemStack(Items.GRAY_STAINED_GLASS_PANE);
		pane.set(DataComponents.CUSTOM_NAME, Component.literal("§8—"));
		return pane;
	}

	@Override
	public ItemStack removeItem(int slot, int amount) {
		if (isDecorativeSlot(slot)) {
			return ItemStack.EMPTY;
		}
		Inventory inv = target.getInventory();

		if (slot >= 0 && slot <= 26) {
			return inv.removeItem(slot + 9, amount);
		} else if (slot >= 27 && slot <= 35) {
			return inv.removeItem(slot - 27, amount);
		} else {
			EquipmentSlot eqSlot = getEquipmentSlotForIndex(slot);
			if (eqSlot != null) {
				ItemStack current = target.getItemBySlot(eqSlot);
				if (current.isEmpty()) {
					return ItemStack.EMPTY;
				}
				ItemStack split = current.split(amount);
				if (current.isEmpty()) {
					target.setItemSlot(eqSlot, ItemStack.EMPTY);
				}
				setChanged();
				return split;
			}
		}
		return ItemStack.EMPTY;
	}

	@Override
	public ItemStack removeItemNoUpdate(int slot) {
		if (isDecorativeSlot(slot)) {
			return ItemStack.EMPTY;
		}
		Inventory inv = target.getInventory();

		if (slot >= 0 && slot <= 26) {
			return inv.removeItemNoUpdate(slot + 9);
		} else if (slot >= 27 && slot <= 35) {
			return inv.removeItemNoUpdate(slot - 27);
		} else {
			EquipmentSlot eqSlot = getEquipmentSlotForIndex(slot);
			if (eqSlot != null) {
				ItemStack current = target.getItemBySlot(eqSlot);
				if (!current.isEmpty()) {
					target.setItemSlot(eqSlot, ItemStack.EMPTY);
				}
				return current;
			}
		}
		return ItemStack.EMPTY;
	}

	@Override
	public void setItem(int slot, ItemStack stack) {
		if (isDecorativeSlot(slot)) {
			return;
		}
		Inventory inv = target.getInventory();

		if (slot >= 0 && slot <= 26) {
			inv.setItem(slot + 9, stack);
		} else if (slot >= 27 && slot <= 35) {
			inv.setItem(slot - 27, stack);
		} else {
			EquipmentSlot eqSlot = getEquipmentSlotForIndex(slot);
			if (eqSlot != null) {
				target.setItemSlot(eqSlot, stack);
			}
		}

		setChanged();
	}

	private EquipmentSlot getEquipmentSlotForIndex(int slot) {
		if (slot == 37) return EquipmentSlot.HEAD;
		if (slot == 38) return EquipmentSlot.CHEST;
		if (slot == 39) return EquipmentSlot.LEGS;
		if (slot == 40) return EquipmentSlot.FEET;
		if (slot == 42) return EquipmentSlot.OFFHAND;
		return null;
	}

	@Override
	public void setChanged() {
		target.getInventory().setChanged();
	}

	@Override
	public boolean stillValid(Player player) {
		return target.isAlive() && !target.hasDisconnected();
	}

	@Override
	public void clearContent() {
		target.getInventory().clearContent();
		setChanged();
	}
}
