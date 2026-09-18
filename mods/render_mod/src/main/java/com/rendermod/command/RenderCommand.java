package com.rendermod.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.rendermod.core.RenderManager;
import com.rendermod.core.RenderSession;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.network.chat.MutableComponent;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

public class RenderCommand {

	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(
			Commands.literal("render")
				.then(Commands.literal("start")
					.then(Commands.argument("name", StringArgumentType.greedyString())
						.executes(context -> {
							String name = StringArgumentType.getString(context, "name");
							return executeStart(context.getSource(), name);
						})
					)
					.executes(context -> executeStart(context.getSource(), "tnt_explosion"))
				)
				.then(Commands.literal("stop")
					.executes(context -> executeStop(context.getSource()))
				)
				.then(Commands.literal("status")
					.executes(context -> executeStatus(context.getSource()))
				)
				.then(Commands.literal("list")
					.executes(context -> executeList(context.getSource()))
				)
				.then(Commands.literal("help")
					.executes(context -> executeHelp(context.getSource()))
				)
				.executes(context -> executeStatus(context.getSource()))
		);
	}

	private static int executeStart(CommandSourceStack source, String name) {
		MinecraftServer server = source.getServer();
		ServerPlayer player = source.getPlayer();

		RenderManager manager = RenderManager.getInstance();
		if (manager.isRendering()) {
			source.sendFailure(Component.literal("A render is already in progress! Use /render stop to finish it first."));
			return 0;
		}

		boolean started = manager.startRendering(server, name, player);
		if (!started) {
			source.sendFailure(Component.literal("Could not start render session."));
			return 0;
		}

		return 1;
	}

	private static int executeStop(CommandSourceStack source) {
		MinecraftServer server = source.getServer();
		ServerPlayer player = source.getPlayer();

		RenderManager manager = RenderManager.getInstance();
		if (!manager.isRendering()) {
			source.sendFailure(Component.literal("No render is currently running. Use /render start <name> to begin."));
			return 0;
		}

		boolean stopped = manager.stopRendering(server, player);
		return stopped ? 1 : 0;
	}

	private static int executeStatus(CommandSourceStack source) {
		RenderManager manager = RenderManager.getInstance();
		if (manager.isRendering()) {
			RenderSession session = manager.getCurrentSession();
			source.sendSuccess(() -> Component.literal("========================================").withStyle(ChatFormatting.GOLD), false);
			source.sendSuccess(() -> Component.literal("● RENDERING IN PROGRESS [60 FPS]").withStyle(ChatFormatting.RED, ChatFormatting.BOLD), false);
			source.sendSuccess(() -> Component.literal("Name: ").withStyle(ChatFormatting.GRAY)
				.append(Component.literal(session.getDisplayName()).withStyle(ChatFormatting.AQUA)), false);
			source.sendSuccess(() -> Component.literal("Ticks Elapsed: ").withStyle(ChatFormatting.GRAY)
				.append(Component.literal(String.valueOf(session.getTicksElapsed())).withStyle(ChatFormatting.YELLOW)), false);
			source.sendSuccess(() -> Component.literal(String.format("Recorded Duration: %.1fs (Decoupled 60 FPS)", session.getDurationSeconds())).withStyle(ChatFormatting.WHITE), false);
			source.sendSuccess(() -> Component.literal("Explosions Tracked: ").withStyle(ChatFormatting.GRAY)
				.append(Component.literal(String.valueOf(session.getExplosionsRecorded())).withStyle(ChatFormatting.GREEN)), false);
			source.sendSuccess(() -> Component.literal("Type /render stop to finish and save world.").withStyle(ChatFormatting.YELLOW), false);
			source.sendSuccess(() -> Component.literal("========================================").withStyle(ChatFormatting.GOLD), false);
		} else {
			source.sendSuccess(() -> Component.literal("● Render System: ").withStyle(ChatFormatting.GRAY)
				.append(Component.literal("IDLE").withStyle(ChatFormatting.GREEN, ChatFormatting.BOLD))
				.append(Component.literal(" (Normal Minecraft Mode)").withStyle(ChatFormatting.GRAY)), false);
			source.sendSuccess(() -> Component.literal("Use /render start [name] to record extreme simulation (e.g. 100k TNT) at 60 FPS!").withStyle(ChatFormatting.AQUA), false);
		}
		return 1;
	}

	private static int executeList(CommandSourceStack source) {
		MinecraftServer server = source.getServer();
		Path savesDir = RenderManager.getSavesDirectory(server);

		source.sendSuccess(() -> Component.literal("========================================").withStyle(ChatFormatting.GOLD), false);
		source.sendSuccess(() -> Component.literal("★ Saved Rendered Worlds (Main Menu Access)").withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD), false);

		if (!Files.exists(savesDir)) {
			source.sendSuccess(() -> Component.literal("No saves directory found.").withStyle(ChatFormatting.GRAY), false);
			return 1;
		}

		File[] folders = savesDir.toFile().listFiles(File::isDirectory);
		int count = 0;
		if (folders != null) {
			for (File f : folders) {
				if (f.getName().startsWith("Render_") || new File(f, "render_info.json").exists()) {
					count++;
					final String folderName = f.getName();
					MutableComponent entry = Component.literal(" - ").withStyle(ChatFormatting.DARK_GRAY)
						.append(Component.literal(folderName).withStyle(ChatFormatting.YELLOW))
						.append(Component.literal(" [Main Menu World]").withStyle(ChatFormatting.GREEN));
					source.sendSuccess(() -> entry, false);
				}
			}
		}

		if (count == 0) {
			source.sendSuccess(() -> Component.literal("No renders saved yet. Run /render start to record one!").withStyle(ChatFormatting.GRAY), false);
		} else {
			final int finalCount = count;
			source.sendSuccess(() -> Component.literal(String.format("Found %d rendered world(s). You can load them from Singleplayer or Flashback Renders menu!", finalCount)).withStyle(ChatFormatting.GREEN), false);
		}

		source.sendSuccess(() -> Component.literal("========================================").withStyle(ChatFormatting.GOLD), false);
		return 1;
	}

	private static int executeHelp(CommandSourceStack source) {
		source.sendSuccess(() -> Component.literal("========================================").withStyle(ChatFormatting.GOLD), false);
		source.sendSuccess(() -> Component.literal("60 FPS World Render & Recorder Commands:").withStyle(ChatFormatting.AQUA, ChatFormatting.BOLD), false);
		source.sendSuccess(() -> Component.literal(" /render start [name] ").withStyle(ChatFormatting.YELLOW).append(Component.literal("- Starts 60 FPS simulation recording").withStyle(ChatFormatting.GRAY)), false);
		source.sendSuccess(() -> Component.literal(" /render stop ").withStyle(ChatFormatting.YELLOW).append(Component.literal("- Stops render and saves playable world to Main Menu").withStyle(ChatFormatting.GRAY)), false);
		source.sendSuccess(() -> Component.literal(" /render status ").withStyle(ChatFormatting.YELLOW).append(Component.literal("- Shows active render statistics").withStyle(ChatFormatting.GRAY)), false);
		source.sendSuccess(() -> Component.literal(" /render list ").withStyle(ChatFormatting.YELLOW).append(Component.literal("- Lists all saved render worlds").withStyle(ChatFormatting.GRAY)), false);
		source.sendSuccess(() -> Component.literal("========================================").withStyle(ChatFormatting.GOLD), false);
		return 1;
	}
}
