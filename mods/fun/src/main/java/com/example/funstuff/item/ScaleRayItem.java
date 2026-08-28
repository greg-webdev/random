package com.example.funstuff.item;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.ai.attributes.AttributeInstance;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;

public class ScaleRayItem extends Item {
	public ScaleRayItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult interactLivingEntity(ItemStack stack, Player player, LivingEntity target, InteractionHand hand) {
		Level level = player.level();
		if (level.isClientSide()) {
			return InteractionResult.SUCCESS;
		}

		AttributeInstance scaleAttr = target.getAttribute(Attributes.SCALE);
		if (scaleAttr != null) {
			double currentScale = scaleAttr.getBaseValue();
			double newScale;

			if (player.isShiftKeyDown()) {
				// Enlarge into titan
				newScale = (currentScale >= 2.0) ? 1.0 : 2.5;
			} else {
				// Shrink into pocket size
				newScale = (currentScale <= 0.5) ? 1.0 : 0.25;
			}

			scaleAttr.setBaseValue(newScale);

			if (level instanceof ServerLevel serverLevel) {
				double x = target.getX();
				double y = target.getY() + target.getEyeHeight() / 2.0;
				double z = target.getZ();

				if (newScale > 1.0) {
					// Giant particles & deep rumble
					serverLevel.sendParticles(ParticleTypes.EXPLOSION, x, y, z, 3, 0.5, 0.5, 0.5, 0.1);
					serverLevel.playSound(null, x, y, z, SoundEvents.GENERIC_EXPLODE.value(), SoundSource.PLAYERS, 1.0f, 0.6f);
					serverLevel.playSound(null, x, y, z, SoundEvents.BEACON_ACTIVATE, SoundSource.PLAYERS, 1.2f, 0.7f);
				} else if (newScale < 1.0) {
					// Tiny squeak & poof
					serverLevel.sendParticles(ParticleTypes.POOF, x, y, z, 20, 0.3, 0.3, 0.3, 0.05);
					serverLevel.playSound(null, x, y, z, SoundEvents.BAT_TAKEOFF, SoundSource.PLAYERS, 1.5f, 1.8f);
					serverLevel.playSound(null, x, y, z, SoundEvents.CHICKEN_EGG, SoundSource.PLAYERS, 1.2f, 1.9f);
				} else {
					// Normal
					serverLevel.sendParticles(ParticleTypes.HAPPY_VILLAGER, x, y, z, 15, 0.4, 0.4, 0.4, 0.1);
					serverLevel.playSound(null, x, y, z, SoundEvents.EXPERIENCE_ORB_PICKUP, SoundSource.PLAYERS, 1.2f, 1.2f);
				}
			}

			player.getCooldowns().addCooldown(stack, 10);
			return InteractionResult.SUCCESS;
		}

		return InteractionResult.PASS;
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		if (player.isShiftKeyDown()) {
			// Apply scale toggle to player!
			AttributeInstance scaleAttr = player.getAttribute(Attributes.SCALE);
			if (scaleAttr != null) {
				double current = scaleAttr.getBaseValue();
				double next = (current == 1.0) ? 0.3 : (current < 1.0 ? 2.2 : 1.0);
				scaleAttr.setBaseValue(next);

				if (level instanceof ServerLevel serverLevel) {
					serverLevel.sendParticles(ParticleTypes.PORTAL, player.getX(), player.getY() + 0.5, player.getZ(), 25, 0.3, 0.3, 0.3, 0.1);
					serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.ENCHANTMENT_TABLE_USE, SoundSource.PLAYERS, 1.2f, 1.4f);
				}

				player.getCooldowns().addCooldown(stack, 10);
				return InteractionResult.SUCCESS;
			}
		}

		return InteractionResult.PASS;
	}
}
