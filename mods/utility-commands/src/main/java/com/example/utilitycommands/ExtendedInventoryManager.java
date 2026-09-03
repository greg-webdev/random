package com.example.utilitycommands;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.Identifier;
import net.minecraft.world.SimpleContainer;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;

import java.io.Reader;
import java.io.Writer;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;

public class ExtendedInventoryManager {
	public static final int MIN_SIDE_COLUMNS = 0;
	public static final int MAX_SIDE_COLUMNS = 10;
	public static final int MAX_EXTRA_SLOTS = 80; // 4 rows x 20 extra columns (10 left + 10 right)

	public record StoredSlot(int slot, String itemId, int count) {}
	public record PlayerInvData(int sideColumns, List<StoredSlot> slots) {}

	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE_PATH = FabricLoader.getInstance().getConfigDir().resolve("utility_commands_extended_inv.json");
	private static final Map<UUID, PlayerInvData> DATA = new HashMap<>();
	private static final Map<UUID, SimpleContainer> ACTIVE_CONTAINERS = new HashMap<>();

	static {
		load();
	}

	public static synchronized int getSideColumns(UUID uuid) {
		PlayerInvData data = DATA.get(uuid);
		if (data != null && data.sideColumns >= MIN_SIDE_COLUMNS && data.sideColumns <= MAX_SIDE_COLUMNS) {
			return data.sideColumns;
		}
		return MIN_SIDE_COLUMNS;
	}

	public static synchronized void setSideColumns(UUID uuid, int sideColumns) {
		int clamped = Math.clamp(sideColumns, MIN_SIDE_COLUMNS, MAX_SIDE_COLUMNS);
		PlayerInvData old = DATA.get(uuid);
		List<StoredSlot> slots = old != null ? old.slots() : new ArrayList<>();
		DATA.put(uuid, new PlayerInvData(clamped, slots));
		save();
	}

	public static synchronized SimpleContainer getExtraStorage(UUID uuid) {
		if (ACTIVE_CONTAINERS.containsKey(uuid)) {
			return ACTIVE_CONTAINERS.get(uuid);
		}

		SimpleContainer container = new SimpleContainer(MAX_EXTRA_SLOTS);
		PlayerInvData data = DATA.get(uuid);
		if (data != null && data.slots() != null) {
			for (StoredSlot s : data.slots()) {
				if (s.slot() >= 0 && s.slot() < MAX_EXTRA_SLOTS && s.itemId() != null) {
					Item item = BuiltInRegistries.ITEM.getValue(Identifier.parse(s.itemId()));
					if (item != null && item != Items.AIR) {
						container.setItem(s.slot(), new ItemStack(item, s.count()));
					}
				}
			}
		}

		container.addListener(c -> saveExtraStorage(uuid, container));
		ACTIVE_CONTAINERS.put(uuid, container);
		return container;
	}

	public static synchronized void saveExtraStorage(UUID uuid, SimpleContainer container) {
		List<StoredSlot> slots = new ArrayList<>();
		for (int i = 0; i < container.getContainerSize(); i++) {
			ItemStack stack = container.getItem(i);
			if (!stack.isEmpty()) {
				Identifier key = BuiltInRegistries.ITEM.getKey(stack.getItem());
				slots.add(new StoredSlot(i, key.toString(), stack.getCount()));
			}
		}

		int sideCols = getSideColumns(uuid);
		DATA.put(uuid, new PlayerInvData(sideCols, slots));
		save();
	}

	private static synchronized void load() {
		if (!Files.exists(FILE_PATH)) return;
		try (Reader reader = Files.newBufferedReader(FILE_PATH)) {
			Type type = new TypeToken<Map<UUID, PlayerInvData>>() {}.getType();
			Map<UUID, PlayerInvData> loaded = GSON.fromJson(reader, type);
			if (loaded != null) {
				DATA.putAll(loaded);
			}
		} catch (Exception e) {
			UtilityCommandsMod.LOGGER.error("Failed to load extended inventory data from " + FILE_PATH, e);
		}
	}

	private static synchronized void save() {
		try {
			Files.createDirectories(FILE_PATH.getParent());
			try (Writer writer = Files.newBufferedWriter(FILE_PATH)) {
				GSON.toJson(DATA, writer);
			}
		} catch (Exception e) {
			UtilityCommandsMod.LOGGER.error("Failed to save extended inventory data to " + FILE_PATH, e);
		}
	}
}
