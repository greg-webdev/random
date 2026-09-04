package com.example.utilitycommands;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.network.chat.Component;

import java.io.Reader;
import java.io.Writer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;

public class ChatFilterManager {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Path FILE_PATH = FabricLoader.getInstance().getConfigDir().resolve("utility_commands_chatfilter.json");
	private static final Pattern GEG_PATTERN = Pattern.compile("(?i)g[\\s_\\-\\.,;:'\"\\*\\/\\\\|`~!?]*e[\\s_\\-\\.,;:'\"\\*\\/\\\\|`~!?]*g");

	private static boolean filterEnabled = true; // Enabled by default

	static {
		load();
	}

	public static synchronized boolean isFilterEnabled() {
		return filterEnabled;
	}

	public static synchronized void setFilterEnabled(boolean enabled) {
		filterEnabled = enabled;
		save();
	}

	public static boolean shouldHide(Component component) {
		if (!filterEnabled || component == null) {
			return false;
		}
		return containsGeg(component.getString());
	}

	public static boolean containsGeg(String text) {
		if (text == null || text.isEmpty()) {
			return false;
		}

		String lower = text.toLowerCase();
		// 1. Check direct substring "geg"
		if (lower.contains("geg")) {
			return true;
		}

		// 2. Check "g", "e", "g" in order separated by spaces, punctuation, or symbols
		return GEG_PATTERN.matcher(lower).find();
	}

	private static synchronized void load() {
		if (!Files.exists(FILE_PATH)) return;
		try (Reader reader = Files.newBufferedReader(FILE_PATH)) {
			ConfigData data = GSON.fromJson(reader, ConfigData.class);
			if (data != null) {
				filterEnabled = data.filterEnabled;
			}
		} catch (Exception e) {
			UtilityCommandsMod.LOGGER.error("Failed to load chat filter config from " + FILE_PATH, e);
		}
	}

	private static synchronized void save() {
		try {
			Files.createDirectories(FILE_PATH.getParent());
			try (Writer writer = Files.newBufferedWriter(FILE_PATH)) {
				GSON.toJson(new ConfigData(filterEnabled), writer);
			}
		} catch (Exception e) {
			UtilityCommandsMod.LOGGER.error("Failed to save chat filter config to " + FILE_PATH, e);
		}
	}

	private record ConfigData(boolean filterEnabled) {}
}
