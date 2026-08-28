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
import net.minecraft.world.entity.item.ItemEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.AABB;

import java.util.List;

public class PartyPopperItem extends Item {
	public PartyPopperItem(Properties properties) {
		super(properties);
	}

	@Override
	public InteractionResult use(Level level, Player player, InteractionHand hand) {
		ItemStack stack = player.getItemInHand(hand);

		if (level instanceof ServerLevel serverLevel) {
			double px = player.getX();
			double py = player.getY() + 1.2;
			double pz = player.getZ();

			// Massive shower of colorful particles
			serverLevel.sendParticles(ParticleTypes.FIREWORK, px, py, pz, 40, 1.2, 1.2, 1.2, 0.2);
			serverLevel.sendParticles(ParticleTypes.NOTE, px, py, pz, 20, 1.0, 1.0, 1.0, 0.5);
			serverLevel.sendParticles(ParticleTypes.HEART, px, py, pz, 10, 0.8, 0.8, 0.8, 0.1);
			serverLevel.sendParticles(ParticleTypes.HAPPY_VILLAGER, px, py, pz, 25, 1.0, 1.0, 1.0, 0.2);

			// Party fanfare sounds
			serverLevel.playSound(null, px, py, pz, SoundEvents.FIREWORK_ROCKET_LAUNCH, SoundSource.PLAYERS, 1.2f, 1.1f);
			serverLevel.playSound(null, px, py, pz, SoundEvents.FIREWORK_ROCKET_BLAST, SoundSource.PLAYERS, 1.2f, 1.2f);
			serverLevel.playSound(null, px, py, pz, SoundEvents.NOTE_BLOCK_CHIME, SoundSource.PLAYERS, 1.5f, 1.4f);

			// Give nearby entities the "Party Mode" buff
			AABB partyArea = player.getBoundingBox().inflate(12.0);
			List<LivingEntity> nearby = level.getEntitiesOfClass(LivingEntity.class, partyArea);
			for (LivingEntity entity : nearby) {
				entity.addEffect(new MobEffectInstance(MobEffects.GLOWING, 200, 0, false, false, true));
				entity.addEffect(new MobEffectInstance(MobEffects.LEVITATION, 60, 0, false, false, true));
				entity.addEffect(new MobEffectInstance(MobEffects.SPEED, 160, 1, false, false, true));
			}

			// Drop a celebratory treat!
			ItemStack treat = (level.random.nextBoolean()) ? new ItemStack(Items.COOKIE, 2) : new ItemStack(Items.CAKE, 1);
			ItemEntity treatEntity = new ItemEntity(level, px, py, pz, treat);
			treatEntity.setDeltaMovement(0, 0.3, 0);
			serverLevel.addFreshEntity(treatEntity);
		}

		if (!player.getAbilities().instabuild) {
			stack.shrink(1);
		}

		player.getCooldowns().addCooldown(stack, 10);
		return InteractionResult.SUCCESS;
	}
}
