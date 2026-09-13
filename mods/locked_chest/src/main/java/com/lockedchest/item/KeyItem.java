package com.lockedchest.item;

import net.minecraft.core.component.DataComponents;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.CustomData;
import net.minecraft.world.item.component.TooltipDisplay;

import java.util.UUID;
import java.util.function.Consumer;

public class KeyItem extends Item {
	public KeyItem(Properties properties) {
		super(properties);
	}

	public static String getKeyId(ItemStack stack) {
		if (stack.isEmpty()) return "";
		CustomData data = stack.getOrDefault(DataComponents.CUSTOM_DATA, CustomData.EMPTY);
		CompoundTag tag = data.copyTag();
		return tag.getStringOr("key_id", "");
	}

	public static String getOrCreateKeyId(ItemStack stack) {
		if (stack.isEmpty()) return "";
		String existing = getKeyId(stack);
		if (!existing.isEmpty()) {
			return existing;
		}
		String newId = generateKeyId();
		CustomData.update(DataComponents.CUSTOM_DATA, stack, tag -> {
			tag.putString("key_id", newId);
		});
		return newId;
	}

	public static void setKeyId(ItemStack stack, String keyId) {
		if (stack.isEmpty()) return;
		CustomData.update(DataComponents.CUSTOM_DATA, stack, tag -> {
			tag.putString("key_id", keyId);
		});
	}

	private static String generateKeyId() {
		return UUID.randomUUID().toString().substring(0, 6).toUpperCase();
	}

	@Override
	public void inventoryTick(ItemStack stack, ServerLevel level, Entity entity, EquipmentSlot slot) {
		if (!level.isClientSide()) {
			String id = getKeyId(stack);
			if (id.isEmpty()) {
				getOrCreateKeyId(stack);
			}
		}
	}

	@Override
	public void appendHoverText(ItemStack stack, Item.TooltipContext context, TooltipDisplay display, Consumer<Component> tooltipAdder, TooltipFlag flag) {
		super.appendHoverText(stack, context, display, tooltipAdder, flag);
		String keyId = getKeyId(stack);
		if (!keyId.isEmpty()) {
			tooltipAdder.accept(Component.literal("§7Key Code: §e#" + keyId));
			tooltipAdder.accept(Component.literal("§8Right-click an unbound chest to pair"));
			tooltipAdder.accept(Component.literal("§8Can unlock all chests with matching code"));
		} else {
			tooltipAdder.accept(Component.literal("§7Unbound Key"));
			tooltipAdder.accept(Component.literal("§8Right-click an unbound locked chest to pair"));
		}
	}
}
