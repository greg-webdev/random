package com.example.funstuff.block;

import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;

public class TrampolineBlock extends Block {
	public TrampolineBlock(Properties properties) {
		super(properties);
	}

	@Override
	public void fallOn(Level level, BlockState state, BlockPos pos, Entity entity, double fallDistance) {
		if (entity.isSuppressingBounce()) {
			super.fallOn(level, state, pos, entity, fallDistance);
		} else {
			// Negate fall damage completely on the trampoline
			entity.causeFallDamage(fallDistance, 0.0f, level.damageSources().fall());
		}
	}

	@Override
	public void updateEntityMovementAfterFallOn(BlockGetter level, Entity entity) {
		if (entity.isSuppressingBounce()) {
			super.updateEntityMovementAfterFallOn(level, entity);
		} else {
			this.bounceEntity(entity);
		}
	}

	private void bounceEntity(Entity entity) {
		Vec3 delta = entity.getDeltaMovement();
		if (delta.y < 0.0) {
			double bounce = Math.min(2.5, Math.abs(delta.y) * 1.5 + 0.6);
			entity.setDeltaMovement(delta.x, bounce, delta.z);
			entity.hurtMarked = true;

			if (entity.level() instanceof ServerLevel serverLevel) {
				serverLevel.sendParticles(ParticleTypes.CLOUD, entity.getX(), entity.getY(), entity.getZ(), 12, 0.3, 0.1, 0.3, 0.05);
				serverLevel.playSound(null, entity.getX(), entity.getY(), entity.getZ(), SoundEvents.SLIME_JUMP, SoundSource.BLOCKS, 1.0f, 1.2f);
			}
		}
	}

	@Override
	public void stepOn(Level level, BlockPos pos, BlockState state, Entity entity) {
		double d = Math.abs(entity.getDeltaMovement().y);
		if (d < 0.1 && !entity.isSteppingCarefully()) {
			entity.setDeltaMovement(entity.getDeltaMovement().multiply(1.0, 0.0, 1.0).add(0.0, 1.1, 0.0));
			entity.hurtMarked = true;
			if (level instanceof ServerLevel serverLevel) {
				serverLevel.playSound(null, pos, SoundEvents.SLIME_JUMP, SoundSource.BLOCKS, 0.8f, 1.4f);
			}
		}
		super.stepOn(level, pos, state, entity);
	}
}
