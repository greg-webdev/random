package com.drillmod.inventory;

import com.drillmod.DrillMod;
import com.drillmod.network.DrillActionPayload;
import com.drillmod.network.DrillSyncPayload;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.Container;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.Slot;
import net.minecraft.world.item.ItemStack;

public class DrillMenu extends AbstractContainerMenu {
	public static final int DRILL_SLOTS_COUNT = 54;

	private final Inventory playerInventory;
	private final int drillSlot;
	private DrillStorage storage;
	private int page = 0;
	private final SimpleContainer drillDisplayContainer = new SimpleContainer(DRILL_SLOTS_COUNT);

	// Client constructor
	public DrillMenu(int syncId, Inventory playerInventory, DrillMenuData data) {
		this(syncId, playerInventory, data.drillSlot(), new DrillStorage(data.initialEntries()));
	}

	// Server constructor
	public DrillMenu(int syncId, Inventory playerInventory, int drillSlot, DrillStorage storage) {
		super(DrillMod.DRILL_MENU_TYPE, syncId);
		this.playerInventory = playerInventory;
		this.drillSlot = drillSlot;
		this.storage = storage != null ? storage : new DrillStorage();

		// 1. Add 54 Drill Storage Display Slots (6 rows x 9 cols)
		for (int row = 0; row < 6; row++) {
			for (int col = 0; col < 9; col++) {
				int index = col + row * 9;
				int x = 8 + col * 18;
				int y = 18 + row * 18;
				this.addSlot(new Slot(drillDisplayContainer, index, x, y) {
					@Override
					public boolean mayPlace(ItemStack stack) {
						return false;
					}

					@Override
					public boolean mayPickup(Player player) {
						return false;
					}
				});
			}
		}

		// 2. Add Player Inventory (3 rows x 9 cols)
		int playerInvY = 132;
		for (int row = 0; row < 3; row++) {
			for (int col = 0; col < 9; col++) {
				int slotIndex = col + (row + 1) * 9;
				int x = 8 + col * 18;
				int y = playerInvY + row * 18;
				this.addSlot(new Slot(playerInventory, slotIndex, x, y));
			}
		}

		// 3. Add Player Hotbar (1 row x 9 cols)
		int hotbarY = playerInvY + 3 * 18 + 4;
		for (int col = 0; col < 9; col++) {
			int x = 8 + col * 18;
			this.addSlot(new Slot(playerInventory, col, x, hotbarY));
		}

		refreshDisplay();
	}

	public DrillStorage getStorage() {
		return storage;
	}

	public void setStorage(DrillStorage storage) {
		this.storage = storage;
		refreshDisplay();
	}

	public void setEntries(java.util.List<DrillStorage.Entry> entries) {
		this.storage.setEntries(entries);
		refreshDisplay();
	}

	public int getPage() {
		return page;
	}

	public int getMaxPages() {
		return Math.max(1, (int) Math.ceil((double) storage.size() / DRILL_SLOTS_COUNT));
	}

	public void refreshDisplay() {
		storage.cleanup();
		for (int i = 0; i < DRILL_SLOTS_COUNT; i++) {
			int entryIdx = page * DRILL_SLOTS_COUNT + i;
			if (entryIdx < storage.size()) {
				DrillStorage.Entry entry = storage.getEntry(entryIdx);
				int iconCount = (int) Math.clamp(entry.getCount(), 1L, 64L);
				drillDisplayContainer.setItem(i, entry.getItem().copyWithCount(iconCount));
			} else {
				drillDisplayContainer.setItem(i, ItemStack.EMPTY);
			}
		}
	}

	public DrillStorage.Entry getEntryForSlot(int slotIndex) {
		int entryIdx = page * DRILL_SLOTS_COUNT + slotIndex;
		return storage.getEntry(entryIdx);
	}

	public void handleAction(int action, int param, ServerPlayer player) {
		switch (action) {
			case DrillActionPayload.ACTION_PAGE_PREV -> {
				if (page > 0) {
					page--;
					refreshDisplay();
				}
			}
			case DrillActionPayload.ACTION_PAGE_NEXT -> {
				if ((page + 1) * DRILL_SLOTS_COUNT < storage.size()) {
					page++;
					refreshDisplay();
				}
			}
			case DrillActionPayload.ACTION_DEPOSIT_ALL -> {
				storage.depositFromPlayer(player.getInventory());
				saveAndSync(player);
			}
			case DrillActionPayload.ACTION_DEPOSIT_CURSOR -> {
				ItemStack cursorStack = getCarried();
				if (!cursorStack.isEmpty() && !cursorStack.is(DrillMod.DRILL)) {
					storage.addItem(cursorStack);
					setCarried(ItemStack.EMPTY);
					saveAndSync(player);
				}
			}
			case DrillActionPayload.ACTION_DEPOSIT_SLOT -> {
				if (param >= 0 && param < 36) {
					ItemStack slotStack = player.getInventory().getItem(param);
					if (!slotStack.isEmpty() && !slotStack.is(DrillMod.DRILL)) {
						storage.addItem(slotStack);
						player.getInventory().setItem(param, ItemStack.EMPTY);
						saveAndSync(player);
					}
				}
			}
			case DrillActionPayload.ACTION_WITHDRAW_STACK -> {
				DrillStorage.Entry entry = getEntryForSlot(param);
				if (entry != null && entry.getCount() > 0) {
					int maxStack = entry.getItem().getMaxStackSize();
					long withdrawAmount = entry.withdraw(maxStack);
					if (withdrawAmount > 0) {
						ItemStack withdrawn = entry.getItem().copyWithCount((int) withdrawAmount);
						ItemStack currentCarried = getCarried();
						if (currentCarried.isEmpty()) {
							setCarried(withdrawn);
						} else if (ItemStack.isSameItemSameComponents(currentCarried, withdrawn)) {
							int toAdd = Math.min(withdrawn.getCount(), maxStack - currentCarried.getCount());
							currentCarried.grow(toAdd);
							if (withdrawn.getCount() > toAdd) {
								entry.addCount(withdrawn.getCount() - toAdd);
							}
						} else {
							if (!player.getInventory().add(withdrawn)) {
								player.drop(withdrawn, false);
							}
						}
						saveAndSync(player);
					}
				}
			}
			case DrillActionPayload.ACTION_WITHDRAW_ONE -> {
				DrillStorage.Entry entry = getEntryForSlot(param);
				if (entry != null && entry.getCount() > 0) {
					long withdrawAmount = entry.withdraw(1);
					if (withdrawAmount > 0) {
						ItemStack withdrawn = entry.getItem().copyWithCount(1);
						ItemStack currentCarried = getCarried();
						if (currentCarried.isEmpty()) {
							setCarried(withdrawn);
						} else if (ItemStack.isSameItemSameComponents(currentCarried, withdrawn) && currentCarried.getCount() < currentCarried.getMaxStackSize()) {
							currentCarried.grow(1);
						} else {
							if (!player.getInventory().add(withdrawn)) {
								player.drop(withdrawn, false);
							}
						}
						saveAndSync(player);
					}
				}
			}
			case DrillActionPayload.ACTION_WITHDRAW_MAX -> {
				DrillStorage.Entry entry = getEntryForSlot(param);
				if (entry != null && entry.getCount() > 0) {
					// Withdraw until inventory full or entry empty
					while (entry.getCount() > 0) {
						int stackSize = (int) Math.min(entry.getCount(), entry.getItem().getMaxStackSize());
						ItemStack toAdd = entry.getItem().copyWithCount(stackSize);
						if (player.getInventory().add(toAdd)) {
							entry.withdraw(stackSize - toAdd.getCount());
							if (!toAdd.isEmpty()) {
								break;
							}
						} else {
							break;
						}
					}
					saveAndSync(player);
				}
			}
			case DrillActionPayload.ACTION_BACKUP -> {
				SavedDrillManager.saveBackup(((ServerLevel) player.level()).getServer(), player.getUUID(), storage);
				player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§a[Drill Mod] Drill inventory successfully saved to backup!"));
			}
			case DrillActionPayload.ACTION_RESTORE -> {
				DrillStorage backup = SavedDrillManager.loadBackup(((ServerLevel) player.level()).getServer(), player.getUUID());
				if (backup != null && backup.size() > 0) {
					for (DrillStorage.Entry entry : backup.getEntries()) {
						this.storage.addRaw(entry.getItem(), entry.getCount());
					}
					saveAndSync(player);
					player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§a[Drill Mod] Successfully restored items from your saved drill backup!"));
				} else {
					player.sendSystemMessage(net.minecraft.network.chat.Component.literal("§c[Drill Mod] No saved drill backup found to restore!"));
				}
			}
		}
	}

	public void saveAndSync(ServerPlayer player) {
		// Save back to drill
		ItemStack drillStack = getDrillStack(player);
		if (!drillStack.isEmpty()) {
			DrillStorage.saveToStack(drillStack, storage, player.level().registryAccess());
			if (com.drillmod.item.DrillItem.hasSaveDrill(drillStack)) {
				SavedDrillManager.saveBackup(((ServerLevel) player.level()).getServer(), player.getUUID(), storage);
			}
		}
		refreshDisplay();
		ServerPlayNetworking.send(player, new DrillSyncPayload(storage.getEntries()));
		broadcastChanges();
	}

	private ItemStack getDrillStack(Player player) {
		if (drillSlot == 40) {
			return player.getOffhandItem();
		} else if (drillSlot >= 0 && drillSlot < player.getInventory().getContainerSize()) {
			return player.getInventory().getItem(drillSlot);
		}
		if (player.getMainHandItem().is(DrillMod.DRILL)) {
			return player.getMainHandItem();
		}
		return ItemStack.EMPTY;
	}

	@Override
	public boolean stillValid(Player player) {
		return player.isAlive();
	}

	@Override
	public ItemStack quickMoveStack(Player player, int index) {
		ItemStack result = ItemStack.EMPTY;
		Slot slot = this.slots.get(index);
		if (slot != null && slot.hasItem()) {
			ItemStack slotStack = slot.getItem();
			result = slotStack.copy();

			if (index >= DRILL_SLOTS_COUNT) {
				// Player clicked player inventory: Shift-click deposits into drill storage!
				if (!slotStack.is(DrillMod.DRILL)) {
					storage.addItem(slotStack);
					slot.setByPlayer(ItemStack.EMPTY);
					slot.setChanged();
					if (player instanceof ServerPlayer serverPlayer) {
						saveAndSync(serverPlayer);
					}
					return ItemStack.EMPTY;
				}
			}
		}
		return result;
	}
}
