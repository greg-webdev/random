package com.rendermod.core;

import com.google.gson.JsonObject;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class RenderSession {
	private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss");

	private final String id;
	private final String displayName;
	private final String worldFolderName;
	private final long startTimeMs;
	private final int targetFps;
	
	private int ticksElapsed;
	private int explosionsRecorded;
	private int entitiesRecorded;
	private boolean active;

	public RenderSession(String name) {
		String timestamp = LocalDateTime.now().format(FORMATTER);
		String safeName = (name == null || name.isBlank()) ? "render" : name.trim().replaceAll("[^a-zA-Z0-9_\\-]", "_");
		this.id = "render_" + timestamp + "_" + safeName;
		this.displayName = (name == null || name.isBlank()) ? "Render " + timestamp : name.trim();
		this.worldFolderName = "Render_" + timestamp + "_" + safeName;
		this.startTimeMs = System.currentTimeMillis();
		this.targetFps = 60;
		this.ticksElapsed = 0;
		this.explosionsRecorded = 0;
		this.entitiesRecorded = 0;
		this.active = true;
	}

	public String getId() {
		return id;
	}

	public String getDisplayName() {
		return displayName;
	}

	public String getWorldFolderName() {
		return worldFolderName;
	}

	public long getStartTimeMs() {
		return startTimeMs;
	}

	public int getTargetFps() {
		return targetFps;
	}

	public int getTicksElapsed() {
		return ticksElapsed;
	}

	public void incrementTicks() {
		this.ticksElapsed++;
	}

	public int getExplosionsRecorded() {
		return explosionsRecorded;
	}

	public void addExplosions(int count) {
		this.explosionsRecorded += count;
	}

	public int getEntitiesRecorded() {
		return entitiesRecorded;
	}

	public void setEntitiesRecorded(int count) {
		this.entitiesRecorded = count;
	}

	public boolean isActive() {
		return active;
	}

	public void finish() {
		this.active = false;
	}

	public double getDurationSeconds() {
		// Decoupled 60fps simulation duration: ticks elapsed / 20.0 or actual rendering time
		return ticksElapsed / 20.0;
	}

	public JsonObject toJson() {
		JsonObject json = new JsonObject();
		json.addProperty("id", id);
		json.addProperty("displayName", displayName);
		json.addProperty("worldFolderName", worldFolderName);
		json.addProperty("startTimeMs", startTimeMs);
		json.addProperty("targetFps", targetFps);
		json.addProperty("ticksElapsed", ticksElapsed);
		json.addProperty("durationSeconds", getDurationSeconds());
		json.addProperty("explosionsRecorded", explosionsRecorded);
		json.addProperty("entitiesRecorded", entitiesRecorded);
		json.addProperty("createdAt", LocalDateTime.now().toString());
		return json;
	}
}
