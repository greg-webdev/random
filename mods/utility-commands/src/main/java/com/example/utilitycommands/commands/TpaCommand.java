package com.example.utilitycommands.commands;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.ChatFormatting;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.ClickEvent;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.HoverEvent;
import net.minecraft.server.level.ServerPlayer;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public class TpaCommand {
	public enum RequestType {
		TPA,
		TPA_HERE
	}

	public record TeleportRequest(UUID requesterId, UUID targetId, RequestType type, long timestamp) {
		public boolean isExpired() {
			return System.currentTimeMillis() - timestamp > 60_000L;
		}
	}

	// Key: Target's UUID
	private static final Map<UUID, TeleportRequest> PENDING_REQUESTS = new ConcurrentHashMap<>();

	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("tpa")
			.then(Commands.argument("target", EntityArgument.player())
				.executes(ctx -> sendRequest(ctx, RequestType.TPA)))
		);

		dispatcher.register(Commands.literal("tpahere")
			.then(Commands.argument("target", EntityArgument.player())
				.executes(ctx -> sendRequest(ctx, RequestType.TPA_HERE)))
		);

		dispatcher.register(Commands.literal("tpaccept")
			.executes(TpaCommand::acceptRequest)
		);

		dispatcher.register(Commands.literal("tpdeny")
			.executes(TpaCommand::denyRequest)
		);
	}

	private static int sendRequest(CommandContext<CommandSourceStack> context, RequestType type) throws CommandSyntaxException {
		ServerPlayer requester = context.getSource().getPlayerOrException();
		ServerPlayer target = EntityArgument.getPlayer(context, "target");

		if (requester.getUUID().equals(target.getUUID())) {
			context.getSource().sendFailure(Component.literal("You cannot send a teleport request to yourself!"));
			return 0;
		}

		PENDING_REQUESTS.put(target.getUUID(), new TeleportRequest(
			requester.getUUID(),
			target.getUUID(),
			type,
			System.currentTimeMillis()
		));

		String requesterName = requester.getScoreboardName();
		String targetName = target.getScoreboardName();

		if (type == RequestType.TPA) {
			context.getSource().sendSuccess(() ->
				Component.literal("§6Teleport request sent to §e" + targetName + "§6. (Expires in 60s)"), false);

			Component acceptButton = Component.literal("[ACCEPT]")
				.withStyle(style -> style
					.withColor(ChatFormatting.GREEN)
					.withBold(true)
					.withClickEvent(new ClickEvent.RunCommand("/tpaccept"))
					.withHoverEvent(new HoverEvent.ShowText(Component.literal("Click to accept teleport"))));

			Component denyButton = Component.literal("[DENY]")
				.withStyle(style -> style
					.withColor(ChatFormatting.RED)
					.withBold(true)
					.withClickEvent(new ClickEvent.RunCommand("/tpdeny"))
					.withHoverEvent(new HoverEvent.ShowText(Component.literal("Click to decline teleport"))));

			target.sendSystemMessage(Component.literal("§e" + requesterName + " §6has requested to teleport to you.\n")
				.append(acceptButton)
				.append(Component.literal("  §8|  "))
				.append(denyButton));
		} else {
			context.getSource().sendSuccess(() ->
				Component.literal("§6Teleport-here request sent to §e" + targetName + "§6. (Expires in 60s)"), false);

			Component acceptButton = Component.literal("[ACCEPT]")
				.withStyle(style -> style
					.withColor(ChatFormatting.GREEN)
					.withBold(true)
					.withClickEvent(new ClickEvent.RunCommand("/tpaccept"))
					.withHoverEvent(new HoverEvent.ShowText(Component.literal("Click to accept teleport-here"))));

			Component denyButton = Component.literal("[DENY]")
				.withStyle(style -> style
					.withColor(ChatFormatting.RED)
					.withBold(true)
					.withClickEvent(new ClickEvent.RunCommand("/tpdeny"))
					.withHoverEvent(new HoverEvent.ShowText(Component.literal("Click to decline teleport-here"))));

			target.sendSystemMessage(Component.literal("§e" + requesterName + " §6wants you to teleport to their location.\n")
				.append(acceptButton)
				.append(Component.literal("  §8|  "))
				.append(denyButton));
		}

		return 1;
	}

	private static int acceptRequest(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer target = context.getSource().getPlayerOrException();
		TeleportRequest req = PENDING_REQUESTS.remove(target.getUUID());

		if (req == null || req.isExpired()) {
			context.getSource().sendFailure(Component.literal("You have no active teleport requests pending."));
			return 0;
		}

		ServerPlayer requester = context.getSource().getServer().getPlayerList().getPlayer(req.requesterId());
		if (requester == null) {
			context.getSource().sendFailure(Component.literal("The requesting player is no longer online."));
			return 0;
		}

		if (req.type() == RequestType.TPA) {
			// Requester teleports to Target
			requester.teleportTo(target.level(), target.getX(), target.getY(), target.getZ(), Set.of(), target.getYRot(), target.getXRot(), false);
			requester.sendSystemMessage(Component.literal("§aTeleporting to §f" + target.getScoreboardName() + "§a..."));
			target.sendSystemMessage(Component.literal("§aTeleport request accepted. §f" + requester.getScoreboardName() + " §ahas arrived."));
		} else {
			// Target teleports to Requester
			target.teleportTo(requester.level(), requester.getX(), requester.getY(), requester.getZ(), Set.of(), requester.getYRot(), requester.getXRot(), false);
			target.sendSystemMessage(Component.literal("§aTeleporting to §f" + requester.getScoreboardName() + "§a..."));
			requester.sendSystemMessage(Component.literal("§a§f" + target.getScoreboardName() + " §aaccepted your teleport-here request!"));
		}

		return 1;
	}

	private static int denyRequest(CommandContext<CommandSourceStack> context) throws CommandSyntaxException {
		ServerPlayer target = context.getSource().getPlayerOrException();
		TeleportRequest req = PENDING_REQUESTS.remove(target.getUUID());

		if (req == null || req.isExpired()) {
			context.getSource().sendFailure(Component.literal("You have no active teleport requests pending."));
			return 0;
		}

		ServerPlayer requester = context.getSource().getServer().getPlayerList().getPlayer(req.requesterId());
		if (requester != null) {
			requester.sendSystemMessage(Component.literal("§c" + target.getScoreboardName() + " denied your teleport request."));
		}

		context.getSource().sendSuccess(() ->
			Component.literal("§cTeleport request denied."), false);

		return 1;
	}
}
