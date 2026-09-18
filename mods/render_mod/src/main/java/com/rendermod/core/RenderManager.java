package com.rendermod.core;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.item.PrimedTnt;
import net.minecraft.world.level.storage.LevelResource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;

public class RenderManager {
	private static final Logger LOGGER = LoggerFactory.getLogger("render_mod/RenderManager");
	private static final RenderManager INSTANCE = new RenderManager();

	private volatile RenderSession currentSession = null;
	private int lastTntCount = 0;

	public static RenderManager getInstance() {
		return INSTANCE;
	}

	public synchronized boolean isRendering() {
		return currentSession != null && currentSession.isActive();
	}

	public synchronized RenderSession getCurrentSession() {
		return currentSession;
	}

	public synchronized boolean startRendering(MinecraftServer server, String renderName, ServerPlayer initiator) {
		if (isRendering()) {
			return false;
		}

		this.currentSession = new RenderSession(renderName);
		this.lastTntCount = 0;

		LOGGER.info("Starting 60 FPS Render Session '{}' (World: {})", currentSession.getDisplayName(), currentSession.getWorldFolderName());

		broadcastMessage(server, Component.literal("==================================================").withStyle(ChatFormatting.GOLD));
		broadcastMessage(server, Component.literal("● [RenderMod] 60 FPS RENDERING STARTED!").withStyle(ChatFormatting.RED, ChatFormatting.BOLD));
		broadcastMessage(server, Component.literal("Render Name: ").withStyle(ChatFormatting.GRAY)
			.append(Component.literal(currentSession.getDisplayName()).withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD)));
		broadcastMessage(server, Component.literal("Target World: ").withStyle(ChatFormatting.GRAY)
			.append(Component.literal(currentSession.getWorldFolderName()).withStyle(ChatFormatting.YELLOW)));
		broadcastMessage(server, Component.literal("Simulation pacing active. 100k TNT or massive explosions will be recorded at smooth 60 FPS!").withStyle(ChatFormatting.GREEN));
		broadcastMessage(server, Component.literal("Run ").withStyle(ChatFormatting.GRAY)
			.append(Component.literal("/render stop").withStyle(ChatFormatting.YELLOW, ChatFormatting.UNDERLINE))
			.append(Component.literal(" when finished to save world to Main Menu.").withStyle(ChatFormatting.GRAY)));
		broadcastMessage(server, Component.literal("==================================================").withStyle(ChatFormatting.GOLD));

		return true;
	}

	public synchronized boolean stopRendering(MinecraftServer server, ServerPlayer initiator) {
		if (!isRendering()) {
			return false;
		}

		RenderSession session = this.currentSession;
		session.finish();

		broadcastMessage(server, Component.literal("● [RenderMod] Stopping rendering & packaging world... Please wait.").withStyle(ChatFormatting.YELLOW, ChatFormatting.BOLD));

		// Export world snapshot to saves/
		boolean success = WorldExporter.exportSessionWorld(server, session);
		this.currentSession = null;
		this.lastTntCount = 0;

		broadcastMessage(server, Component.literal("==================================================").withStyle(ChatFormatting.GOLD));
		if (success) {
			broadcastMessage(server, Component.literal("✔ [RenderMod] RENDERING COMPLETED & SAVED!").withStyle(ChatFormatting.GREEN, ChatFormatting.BOLD));
			broadcastMessage(server, Component.literal("World Name: ").withStyle(ChatFormatting.GRAY)
				.append(Component.literal(session.getWorldFolderName()).withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD)));
			broadcastMessage(server, Component.literal(String.format("Stats: %d ticks (~%.1fs @ 60 FPS) | %d explosions recorded",
				session.getTicksElapsed(), session.getDurationSeconds(), session.getExplosionsRecorded())).withStyle(ChatFormatting.WHITE));

			MutableComponent hint = Component.literal("★ You can now access this world directly from the ")
				.withStyle(ChatFormatting.GREEN)
				.append(Component.literal("Main Menu (Singleplayer / Flashback Renders)").withStyle(ChatFormatting.YELLOW, ChatFormatting.BOLD))
				.append(Component.literal("!").withStyle(ChatFormatting.GREEN));
			broadcastMessage(server, hint);
		} else {
			broadcastMessage(server, Component.literal("✖ [RenderMod] Failed to export world snapshot. Check server logs.").withStyle(ChatFormatting.RED, ChatFormatting.BOLD));
		}
		broadcastMessage(server, Component.literal("==================================================").withStyle(ChatFormatting.GOLD));

		return success;
	}

	public void onServerTick(MinecraftServer server) {
		if (!isRendering()) {
			return;
		}

		RenderSession session = currentSession;
		if (session == null) return;

		session.incrementTicks();

		// Safely count active entities & TNT explosions without requiring mixins
		int currentTnt = 0;
		int totalEntities = 0;

		for (ServerLevel level : server.getAllLevels()) {
			for (Entity entity : level.getAllEntities()) {
				totalEntities++;
				if (entity instanceof PrimedTnt) {
					currentTnt++;
				}
			}
		}

		session.setEntitiesRecorded(totalEntities);

		if (lastTntCount > currentTnt) {
			session.addExplosions(lastTntCount - currentTnt);
		}
		lastTntCount = currentTnt;
	}

	public void recordExplosion(int count) {
		if (isRendering() && currentSession != null) {
			currentSession.addExplosions(count);
		}
	}

	public static Path getSavesDirectory(MinecraftServer server) {
		Path activeWorldDir = server.getWorldPath(LevelResource.ROOT);
		Path savesDir = activeWorldDir.getParent();
		return (savesDir != null) ? savesDir : activeWorldDir;
	}

	private static void broadcastMessage(MinecraftServer server, Component component) {
		for (ServerPlayer player : server.getPlayerList().getPlayers()) {
			player.sendSystemMessage(component);
		}
	}
}
