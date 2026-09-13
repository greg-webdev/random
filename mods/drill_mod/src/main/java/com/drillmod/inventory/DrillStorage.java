package com.drillmod.inventory;

import com.drillmod.DrillMod;
import com.mojang.serialization.DynamicOps;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.nbt.ListTag;
import net.minecraft.nbt.NbtOps;
import net.minecraft.nbt.Tag;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.component.CustomData;

import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.List;

public class DrillStorage {
	public static class Entry {
		private final ItemStack item;
		private long count;

		public Entry(ItemStack item, long count) {
			this.item = item.copyWithCount(1);
			this.count = Math.max(0L, count);
		}

		public ItemStack getItem() {
			return item;
		}

		public long getCount() {
			return count;
		}

		public void setCount(long count) {
			this.count = Math.max(0L, count);
		}

		public void addCount(long delta) {
			if (delta <= 0) return;
			try {
				this.count = Math.addExact(this.count, delta);
			} catch (ArithmeticException e) {
				this.count = Long.MAX_VALUE;
			}
		}

		public long withdraw(long requested) {
			if (requested <= 0 || this.count <= 0) return 0;
			long actual = Math.min(this.count, requested);
			this.count -= actual;
			return actual;
		}
	}

	private final List<Entry> entries = new ArrayList<>();

	public DrillStorage() {}

	public DrillStorage(List<Entry> initialEntries) {
		if (initialEntries != null) {
			this.entries.addAll(initialEntries);
		}
	}

	public void setEntries(List<Entry> newEntries) {
		this.entries.clear();
		if (newEntries != null) {
			this.entries.addAll(newEntries);
		}
	}

	public List<Entry> getEntries() {
		return entries;
	}

	public int size() {
		return entries.size();
	}

	public Entry getEntry(int index) {
		if (index >= 0 && index < entries.size()) {
			return entries.get(index);
		}
		return null;
	}

	public void addItem(ItemStack stack) {
		if (stack.isEmpty() || stack.is(DrillMod.DRILL)) {
			return;
		}

		for (Entry entry : entries) {
			if (ItemStack.isSameItemSameComponents(entry.getItem(), stack)) {
				entry.addCount(stack.getCount());
				return;
			}
		}

		entries.add(new Entry(stack, stack.getCount()));
	}

	public void addRaw(ItemStack itemTemplate, long amount) {
		if (itemTemplate.isEmpty() || amount <= 0 || itemTemplate.is(DrillMod.DRILL)) {
			return;
		}

		for (Entry entry : entries) {
			if (ItemStack.isSameItemSameComponents(entry.getItem(), itemTemplate)) {
				entry.addCount(amount);
				return;
			}
		}

		entries.add(new Entry(itemTemplate, amount));
	}

	public void cleanup() {
		entries.removeIf(e -> e.getCount() <= 0);
	}

	public void depositFromPlayer(Inventory inventory) {
		for (int i = 0; i < 36; i++) {
			ItemStack stack = inventory.getItem(i);
			if (!stack.isEmpty() && !stack.is(DrillMod.DRILL)) {
				addItem(stack);
				inventory.setItem(i, ItemStack.EMPTY);
			}
		}
		inventory.setChanged();
	}

	public long getTotalItems() {
		long total = 0;
		for (Entry entry : entries) {
			try {
				total = Math.addExact(total, entry.getCount());
			} catch (ArithmeticException e) {
				total = Long.MAX_VALUE;
				break;
			}
		}
		return total;
	}

	public static String formatCount(long count) {
		if (count <= 0) return "0";
		if (count < 1000L) {
			return String.valueOf(count); // 1, 10, 100, 999
		}
		if (count < 1_000_000L) {
			return (count / 1000L) + "K"; // 1K, 10K, 100K
		}
		if (count < 1_000_000_000L) {
			return (count / 1_000_000L) + "M"; // 1M, 10M, 100M
		}
		if (count < 1_000_000_000_000L) {
			return (count / 1_000_000_000L) + "B"; // 1B, 10B, 100B
		}
		if (count < 1_000_000_000_000_000L) {
			return (count / 1_000_000_000_000L) + "T"; // 1T, 10T, 100T
		}
		return (count / 1_000_000_000_000_000L) + "Q";
	}

	public static String formatExact(long count) {
		return NumberFormat.getInstance().format(count);
	}

	public CompoundTag toNbt(HolderLookup.Provider registries) {
		cleanup();
		CompoundTag tag = new CompoundTag();
		ListTag list = new ListTag();
		DynamicOps<Tag> ops = (registries != null) 
			? registries.createSerializationContext(NbtOps.INSTANCE) 
			: NbtOps.INSTANCE;

		for (Entry entry : entries) {
			if (entry.getCount() <= 0) continue;
			CompoundTag itemTag = new CompoundTag();
			Tag encodedItem = ItemStack.CODEC.encodeStart(ops, entry.getItem()).result().orElse(new CompoundTag());
			itemTag.put("item", encodedItem);
			itemTag.putLong("count", entry.getCount());
			list.add(itemTag);
		}

		tag.put("DrillItems", list);
		return tag;
	}

	public CompoundTag toNbt() {
		return toNbt(null);
	}

	public static DrillStorage fromNbt(CompoundTag tag, HolderLookup.Provider registries) {
		DrillStorage storage = new DrillStorage();
		if (tag == null) {
			return storage;
		}

		DynamicOps<Tag> ops = (registries != null) 
			? registries.createSerializationContext(NbtOps.INSTANCE) 
			: NbtOps.INSTANCE;

		ListTag list = tag.getListOrEmpty("DrillItems");
		for (int i = 0; i < list.size(); i++) {
			CompoundTag itemTag = list.getCompoundOrEmpty(i);
			Tag encoded = itemTag.get("item");
			if (encoded != null) {
				ItemStack item = ItemStack.CODEC.parse(ops, encoded).result().orElse(ItemStack.EMPTY);
				long count = itemTag.getLongOr("count", 0L);
				if (!item.isEmpty() && count > 0) {
					storage.entries.add(new Entry(item, count));
				}
			}
		}

		return storage;
	}

	public static DrillStorage fromNbt(CompoundTag tag) {
		return fromNbt(tag, null);
	}

	public static DrillStorage loadFromStack(ItemStack stack, HolderLookup.Provider registries) {
		if (stack.isEmpty()) return new DrillStorage();
		CustomData data = stack.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY);
		CompoundTag root = data.copyTag();
		if (root.contains("DrillStorage")) {
			return fromNbt(root.getCompoundOrEmpty("DrillStorage"), registries);
		}
		return new DrillStorage();
	}

	public static DrillStorage loadFromStack(ItemStack stack) {
		return loadFromStack(stack, null);
	}

	public static void saveToStack(ItemStack stack, DrillStorage storage, HolderLookup.Provider registries) {
		if (stack.isEmpty()) return;
		CustomData.update(DataComponents.CUSTOM_DATA, stack, root -> {
			root.put("DrillStorage", storage.toNbt(registries));
		});
	}

	public static void saveToStack(ItemStack stack, DrillStorage storage) {
		saveToStack(stack, storage, null);
	}
}
