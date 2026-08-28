package com.example.funstuff.item;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

public class RainbowCheeseItem extends Item {
	public RainbowCheeseItem(Properties properties) {
		super(properties);
	}

	@Override
	public ItemStack finishUsingItem(ItemStack stack, Level level, LivingEntity entity) {
		ItemStack result = super.finishUsingItem(stack, level, entity);

		if (!level.isClientSide()) {
			// Moon gravity and superpower buffs for 30 seconds
			entity.addEffect(new MobEffectInstance(MobEffects.JUMP_BOOST, 600, 2, false, true, true));
			entity.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 600, 0, false, true, true));
			entity.addEffect(new MobEffectInstance(MobEffects.SPEED, 600, 1, false, true, true));
			entity.addEffect(new MobEffectInstance(MobEffects.REGENERATION, 200, 1, false, true, true));

			if (level instanceof ServerLevel serverLevel) {
				serverLevel.sendParticles(ParticleTypes.HAPPY_VILLAGER, entity.getX(), entity.getY() + 1.0, entity.getZ(), 20, 0.4, 0.4, 0.4, 0.1);
				serverLevel.playSound(null, entity.getX(), entity.getY(), entity.getZ(), SoundEvents.PLAYER_BURP, SoundSource.PLAYERS, 1.0f, 1.2f);
				serverLevel.playSound(null, entity.getX(), entity.getY(), entity.getZ(), SoundEvents.AMETHYST_BLOCK_CHIME, SoundSource.PLAYERS, 1.2f, 1.5f);
			}
		}

		return result;
	}
}
