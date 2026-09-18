package com.oneblockskyblock.item;

import com.oneblockskyblock.oneblock.OneBlockData;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.context.UseOnContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Blocks;

public class OneBlockItem extends Item {
	public OneBlockItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult useOn(UseOnContext context) {
		Level level = context.getLevel();
		if (!level.isClientSide() && level instanceof ServerLevel serverLevel) {
			BlockPos targetPos = context.getClickedPos().relative(context.getClickedFace());
			Player player = context.getPlayer();

			// Place bedrock below
			serverLevel.setBlock(targetPos.below(), Blocks.BEDROCK.defaultBlockState(), 3);
			// Place grass block
			serverLevel.setBlock(targetPos, Blocks.GRASS_BLOCK.defaultBlockState(), 3);

			OneBlockData data = OneBlockData.get(serverLevel);
			data.addCustomPosition(targetPos);
			data.save(serverLevel);

			if (player != null) {
				player.displayClientMessage(Component.literal("§a[OneBlock] Created OneBlock at: §e" + targetPos.toShortString() + "! Break it to start!"), false);
			}
			return InteractionResult.SUCCESS;
		}
		return InteractionResult.SUCCESS;
	}
}
