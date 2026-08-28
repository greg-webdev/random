package com.example.funstuff.item;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

public class BouncyBootsItem extends Item {
	public BouncyBootsItem(Properties properties) {
		super(properties);
	}

	@Override
	public void inventoryTick(ItemStack stack, ServerLevel level, Entity entity, EquipmentSlot slot) {
		if (slot == EquipmentSlot.FEET && entity.onGround() && entity.isSprinting()) {
			if (level.random.nextFloat() < 0.3f) {
				level.sendParticles(
					ParticleTypes.ITEM_SLIME,
					entity.getX(),
					entity.getY() + 0.1,
					entity.getZ(),
					2,
					0.2,
					0.05,
					0.2,
					0.02
				);
			}
		}
	}
}
