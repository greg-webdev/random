package com.lockedchest.item;

import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.TooltipDisplay;

import java.util.function.Consumer;

public class MasterKeyItem extends Item {
	public MasterKeyItem(Properties properties) {
		super(properties);
	}

	@Override
	public boolean isFoil(ItemStack stack) {
		return true;
	}

	@Override
	public void appendHoverText(ItemStack stack, Item.TooltipContext context, TooltipDisplay display, Consumer<Component> tooltipAdder, TooltipFlag flag) {
		super.appendHoverText(stack, context, display, tooltipAdder, flag);
		tooltipAdder.accept(Component.literal("§6★ Universal Master Key"));
		tooltipAdder.accept(Component.literal("§7Can open §eANY §7locked chest"));
		tooltipAdder.accept(Component.literal("§8Shift + Right-Click chest to reset its lock"));
	}
}
