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
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;

public class GrapplingSlingerItem extends Item {
	public GrapplingSlingerItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);
		Vec3 eyePos = player.getEyePosition();
		Vec3 look = player.getLookAngle();
		double reach = 45.0;
		Vec3 targetPos = eyePos.add(look.scale(reach));

		BlockHitResult hit = level.clip(new ClipContext(
			eyePos,
			targetPos,
			ClipContext.Block.COLLIDER,
			ClipContext.Fluid.NONE,
			player
		));

		if (hit.getType() == HitResult.Type.BLOCK) {
			Vec3 hitVec = hit.getLocation();
			Vec3 pullVec = hitVec.subtract(player.position());
			double dist = pullVec.length();

			if (dist > 1.5) {
				double force = Math.min(2.8, Math.max(1.3, dist * 0.12));
				Vec3 vel = pullVec.normalize().scale(force);
				player.setDeltaMovement(vel.x, vel.y + 0.35, vel.z);
				player.hurtMarked = true;
				player.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 80, 0, false, false, true));

				if (level instanceof ServerLevel serverLevel) {
					// Draw grappling line particles
					int steps = (int) Math.min(25, dist * 2);
					for (int i = 0; i <= steps; i++) {
						double progress = (double) i / steps;
						double px = eyePos.x + pullVec.x * progress;
						double py = eyePos.y + pullVec.y * progress;
						double pz = eyePos.z + pullVec.z * progress;
						serverLevel.sendParticles(ParticleTypes.ELECTRIC_SPARK, px, py, pz, 1, 0, 0, 0, 0);
					}
					serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.FISHING_BOBBER_RETRIEVE, SoundSource.PLAYERS, 1.2f, 1.4f);
					serverLevel.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.CROSSBOW_SHOOT, SoundSource.PLAYERS, 1.0f, 1.8f);
				}

				player.getCooldowns().addCooldown(stack, 12);
				return InteractionResult.SUCCESS;
			}
		}

		return InteractionResult.PASS;
	}

	@Override
	public InteractionResult interactLivingEntity(ItemStack stack, Player player, LivingEntity target, InteractionHand hand) {
		Vec3 diff = player.position().subtract(target.position());
		double dist = diff.length();
		if (dist > 1.0) {
			Vec3 pull = diff.normalize().scale(Math.min(2.2, dist * 0.25));
			target.setDeltaMovement(pull.x, 0.8, pull.z);
			target.hurtMarked = true;

			Level level = player.level();
			if (level instanceof ServerLevel serverLevel) {
				serverLevel.sendParticles(ParticleTypes.ELECTRIC_SPARK, target.getX(), target.getY() + 1.0, target.getZ(), 20, 0.4, 0.4, 0.4, 0.1);
				serverLevel.playSound(null, target.getX(), target.getY(), target.getZ(), SoundEvents.FISHING_BOBBER_RETRIEVE, SoundSource.PLAYERS, 1.2f, 1.2f);
				serverLevel.playSound(null, target.getX(), target.getY(), target.getZ(), SoundEvents.ARROW_HIT_PLAYER, SoundSource.PLAYERS, 1.0f, 1.5f);
			}

			player.getCooldowns().addCooldown(stack, 15);
			return InteractionResult.SUCCESS;
		}

		return InteractionResult.PASS;
	}
}
