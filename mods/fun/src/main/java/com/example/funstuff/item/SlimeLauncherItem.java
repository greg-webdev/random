package com.example.funstuff.item;

import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;

public class SlimeLauncherItem extends Item {
	public SlimeLauncherItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		Vec3 look = player.getLookAngle();
		double forwardSpeed = 2.2;
		double upwardSpeed = Math.max(0.7, look.y * 1.8 + 0.5);

		player.setDeltaMovement(look.x * forwardSpeed, upwardSpeed, look.z * forwardSpeed);
		player.hurtMarked = true;

		// Provide temporary slow-falling buff so player launches and glides safely
		player.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 100, 0, false, false, true));

		if (level instanceof ServerLevel serverLevel) {
			serverLevel.sendParticles(ParticleTypes.ITEM_SLIME, player.getX(), player.getY() + 0.5, player.getZ(), 25, 0.4, 0.4, 0.4, 0.1);
			serverLevel.sendParticles(ParticleTypes.CLOUD, player.getX(), player.getY() + 0.2, player.getZ(), 12, 0.3, 0.1, 0.3, 0.05);
			serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.SLIME_JUMP, SoundSource.PLAYERS, 1.2f, 1.0f);
			serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.FIREWORK_ROCKET_SHOOT, SoundSource.PLAYERS, 0.8f, 1.2f);
		}

		player.getCooldowns().addCooldown(stack, 12);
		return InteractionResult.SUCCESS;
	}

	@Override
	public InteractionResult interactLivingEntity(ItemStack stack, Player player, LivingEntity target, InteractionHand hand) {
		target.setDeltaMovement(0.0, 1.8, 0.0);
		target.hurtMarked = true;

		Level level = player.level();
		if (level instanceof ServerLevel serverLevel) {
			serverLevel.sendParticles(ParticleTypes.ITEM_SLIME, target.getX(), target.getY() + 0.5, target.getZ(), 30, 0.5, 0.5, 0.5, 0.15);
			serverLevel.sendParticles(ParticleTypes.EXPLOSION, target.getX(), target.getY() + 0.5, target.getZ(), 1, 0, 0, 0, 0);
			serverLevel.playSound(null, target.getX(), target.getY(), target.getZ(), SoundEvents.SLIME_SQUISH, SoundSource.PLAYERS, 1.5f, 0.8f);
			serverLevel.playSound(null, target.getX(), target.getY(), target.getZ(), SoundEvents.FIREWORK_ROCKET_BLAST, SoundSource.PLAYERS, 1.0f, 1.2f);
		}

		player.getCooldowns().addCooldown(stack, 15);
		return InteractionResult.SUCCESS;
	}
}
