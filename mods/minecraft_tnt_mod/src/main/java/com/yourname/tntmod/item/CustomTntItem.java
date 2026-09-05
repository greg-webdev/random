package com.yourname.tntmod.item;

import com.yourname.tntmod.MainMod;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.server.permissions.PermissionSet;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;

public class CustomTntItem extends Item {
	public CustomTntItem(Item.Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		return trigger(level, player, hand);
	}

	@Override
	public InteractionResult useOn(UseOnContext context) {
		return trigger(context.getLevel(), context.getPlayer(), context.getHand());
	}

	/**
	 * Instant trigger with NO cooldown / delay on using the item.
	 * Summons primed TNT with the delay configured via /tntdelay <number>.
	 */
	private InteractionResult trigger(Level level, Player player, InteractionHand hand) {
		if (player == null) {
			return InteractionResult.PASS;
		}

		if (!level.isClientSide() && level instanceof ServerLevel serverLevel && player instanceof ServerPlayer serverPlayer) {
			long delay = MainMod.getDelay(serverPlayer.getUUID());
			// Clamp to Integer.MAX_VALUE to ensure safe entity fuse integer parsing
			long fuseTicks = Math.min(delay, (long) Integer.MAX_VALUE);

			String command = "summon tnt ~ ~ ~ {fuse:" + fuseTicks + ",explosion_power:0}";

			try {
				CommandSourceStack source = serverPlayer.createCommandSourceStack()
					.withSuppressedOutput()
					.withPermission(PermissionSet.ALL_PERMISSIONS);

				serverLevel.getServer().getCommands().performPrefixedCommand(source, command);
				MainMod.LOGGER.info("Custom TNT triggered by {} (delay: {}): {}", serverPlayer.getScoreboardName(), delay, command);
			} catch (Exception e) {
				MainMod.LOGGER.error("Failed to execute command: {}", command, e);
			}
		}

		return InteractionResult.SUCCESS;
	}
}
