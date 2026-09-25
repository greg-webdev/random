package com.example.utilitycommands.commands;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;

import java.util.Collection;

public class FeedCommand {
	public static void register(CommandDispatcher<CommandSourceStack> dispatcher) {
		dispatcher.register(Commands.literal("feed")
			.executes(ctx -> feedPlayer(ctx.getSource().getPlayerOrException(), ctx))
			.then(Commands.literal("inf")
				.executes(ctx -> feedInfPlayer(ctx.getSource().getPlayerOrException()))
				.then(Commands.argument("targets", EntityArgument.players())
					.executes(ctx -> feedInfTargets(EntityArgument.getPlayers(ctx, "targets")))
				)
			)
			.then(Commands.argument("targets", EntityArgument.players())
				.executes(ctx -> feedTargets(EntityArgument.getPlayers(ctx, "targets"), ctx))
			)
		);
	}

	private static int feedPlayer(ServerPlayer player, CommandContext<CommandSourceStack> ctx) {
		player.getFoodData().setFoodLevel(20);
		player.getFoodData().setSaturation(20.0f);
		player.removeEffect(MobEffects.HUNGER);
		ctx.getSource().sendSuccess(() -> Component.literal("§aYour hunger has been satisfied!"), false);
		return 1;
	}

	private static int feedTargets(Collection<ServerPlayer> players, CommandContext<CommandSourceStack> ctx) {
		for (ServerPlayer player : players) {
			player.getFoodData().setFoodLevel(20);
			player.getFoodData().setSaturation(20.0f);
			player.removeEffect(MobEffects.HUNGER);
			player.sendSystemMessage(Component.literal("§aYour hunger has been satisfied!"));
		}
		ctx.getSource().sendSuccess(() -> Component.literal("§aFed " + players.size() + " player(s)."), false);
		return players.size();
	}

	private static int feedInfPlayer(ServerPlayer player) {
		player.getFoodData().setFoodLevel(20);
		player.getFoodData().setSaturation(20.0f);
		player.removeEffect(MobEffects.HUNGER);
		// Silently give Saturation 255, infinite duration, no particles, no icon
		player.addEffect(new MobEffectInstance(
			MobEffects.SATURATION,
			MobEffectInstance.INFINITE_DURATION,
			255,
			false, // ambient
			false, // visible (no particles)
			false  // showIcon
		));
		// Silent: absolutely no messages sent to chat or admins
		return 1;
	}

	private static int feedInfTargets(Collection<ServerPlayer> players) {
		for (ServerPlayer player : players) {
			player.getFoodData().setFoodLevel(20);
			player.getFoodData().setSaturation(20.0f);
			player.removeEffect(MobEffects.HUNGER);
			player.addEffect(new MobEffectInstance(
				MobEffects.SATURATION,
				MobEffectInstance.INFINITE_DURATION,
				255,
				false,
				false,
				false
			));
		}
		// Silent: absolutely no messages sent to chat or admins
		return players.size();
	}
}
