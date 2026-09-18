package com.worldmanager.world;

import java.util.Optional;

public enum WorldType {
	SKYBLOCK_V1("skyblock_v1", "Skyblock v1"),
	SKYBLOCK_V2("skyblock_v2", "Skyblock v2"),
	ONEBLOCK("oneblock", "OneBlock"),
	FLAT("flat", "Superflat"),
	STANDARD("standard", "Standard Survival");

	private final String id;
	private final String displayName;

	WorldType(String id, String displayName) {
		this.id = id;
		this.displayName = displayName;
	}

	public String getId() {
		return id;
	}

	public String getDisplayName() {
		return displayName;
	}

	public static Optional<WorldType> fromString(String name) {
		if (name == null) return Optional.empty();
		String clean = name.trim().toLowerCase().replace("-", "_").replace(" ", "_");
		for (WorldType type : values()) {
			if (type.id.equalsIgnoreCase(clean) || type.name().equalsIgnoreCase(clean)) {
				return Optional.of(type);
			}
		}
		if (clean.equals("v1") || clean.equals("skyblock1")) {
			return Optional.of(SKYBLOCK_V1);
		}
		if (clean.equals("v2") || clean.equals("skyblock2")) {
			return Optional.of(SKYBLOCK_V2);
		}
		return Optional.empty();
	}
}
