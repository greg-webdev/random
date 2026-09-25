/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  net.minecraft.core.BlockPos
 *  net.minecraft.core.Position
 *  net.minecraft.core.particles.ColorParticleOption
 *  net.minecraft.core.particles.ParticleOptions
 *  net.minecraft.core.particles.ParticleType
 *  net.minecraft.core.particles.ParticleTypes
 *  net.minecraft.server.level.ServerLevel
 *  net.minecraft.sounds.SoundEvents
 *  net.minecraft.sounds.SoundSource
 *  net.minecraft.world.InteractionHand
 *  net.minecraft.world.InteractionResult
 *  net.minecraft.world.entity.LivingEntity
 *  net.minecraft.world.entity.player.Player
 *  net.minecraft.world.item.Item
 *  net.minecraft.world.item.Item$Properties
 *  net.minecraft.world.item.ItemStack
 *  net.minecraft.world.item.ItemUseAnimation
 *  net.minecraft.world.level.Level
 *  net.minecraft.world.level.block.state.BlockState
 *  net.minecraft.world.phys.AABB
 *  net.minecraft.world.phys.Vec3
 */
package com.laserweapons.item;

import java.util.HashSet;
import java.util.List;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Position;
import net.minecraft.core.particles.ColorParticleOption;
import net.minecraft.core.particles.ParticleOptions;
import net.minecraft.core.particles.ParticleType;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

public class HandheldLaserItem
extends Item {
    public HandheldLaserItem(Item.Properties properties) {
        super(properties);
    }

    public int getUseDuration(ItemStack stack, LivingEntity entity) {
        return 72000;
    }

    public ItemUseAnimation getUseAnimation(ItemStack stack) {
        return ItemUseAnimation.BOW;
    }

    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        player.startUsingItem(hand);
        level.playSound(null, player.getX(), player.getY(), player.getZ(), SoundEvents.CONDUIT_ACTIVATE, SoundSource.PLAYERS, 1.2f, 1.3f);
        return InteractionResult.CONSUME;
    }

    public boolean releaseUsing(ItemStack stack, Level level, LivingEntity livingEntity, int timeCharged) {
        level.playSound(null, livingEntity.getX(), livingEntity.getY(), livingEntity.getZ(), SoundEvents.CONDUIT_DEACTIVATE, SoundSource.PLAYERS, 0.8f, 1.4f);
        return super.releaseUsing(stack, level, livingEntity, timeCharged);
    }

    public void onUseTick(Level level, LivingEntity livingEntity, ItemStack stack, int remainingUseDuration) {
        int ticksUsed = this.getUseDuration(stack, livingEntity) - remainingUseDuration;
        if (ticksUsed % 4 == 0) {
            level.playSound(null, livingEntity.getX(), livingEntity.getY(), livingEntity.getZ(), SoundEvents.CONDUIT_ATTACK_TARGET, SoundSource.PLAYERS, 0.7f, 1.7f);
        }
        if (level.isClientSide()) {
            return;
        }
        ServerLevel serverLevel = (ServerLevel)level;
        Vec3 eyePos = livingEntity.getEyePosition();
        Vec3 look = livingEntity.getLookAngle();
        double maxDistance = 64.0;
        double step = 0.35;
        Vec3 muzzle = eyePos.add(look.scale(0.85));
        serverLevel.sendParticles((ParticleOptions)ColorParticleOption.create((ParticleType)ParticleTypes.FLASH, (int)58879), muzzle.x, muzzle.y, muzzle.z, 1, 0.0, 0.0, 0.0, 0.0);
        serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, muzzle.x, muzzle.y, muzzle.z, 2, 0.02, 0.02, 0.02, 0.05);
        HashSet<LivingEntity> hitEntities = new HashSet<LivingEntity>();
        for (double d = 0.8; d <= maxDistance; d += step) {
            BlockPos bPos;
            BlockState state;
            Vec3 currentPos = eyePos.add(look.scale(d));
            serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
            if ((int)(d / step) % 3 == 0) {
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.END_ROD, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.005);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.GLOW, currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
            }
            if (!(state = level.getBlockState(bPos = BlockPos.containing((Position)currentPos))).isAir() && state.canOcclude()) {
                serverLevel.sendParticles((ParticleOptions)ColorParticleOption.create((ParticleType)ParticleTypes.FLASH, (int)58879), currentPos.x, currentPos.y, currentPos.z, 1, 0.0, 0.0, 0.0, 0.0);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, currentPos.x, currentPos.y, currentPos.z, 6, 0.1, 0.1, 0.1, 0.08);
                break;
            }
            AABB box = new AABB(currentPos.x - 0.4, currentPos.y - 0.4, currentPos.z - 0.4, currentPos.x + 0.4, currentPos.y + 0.4, currentPos.z + 0.4);
            List<LivingEntity> targets = level.getEntitiesOfClass(LivingEntity.class, box, e -> e != livingEntity && e.isAlive() && !hitEntities.contains(e));
            for (LivingEntity target : targets) {
                hitEntities.add(target);
                target.invulnerableTime = 0;
                if (livingEntity instanceof Player) {
                    Player player = (Player)livingEntity;
                    target.hurtServer(serverLevel, player.damageSources().playerAttack(player), 3.5f);
                } else {
                    target.hurtServer(serverLevel, livingEntity.damageSources().mobAttack(livingEntity), 3.5f);
                }
                target.setRemainingFireTicks(40);
                serverLevel.sendParticles((ParticleOptions)ColorParticleOption.create((ParticleType)ParticleTypes.FLASH, (int)58879), target.getX(), target.getY() + (double)(target.getBbHeight() / 2.0f), target.getZ(), 1, 0.0, 0.0, 0.0, 0.0);
                serverLevel.sendParticles((ParticleOptions)ParticleTypes.ELECTRIC_SPARK, target.getX(), target.getY() + (double)(target.getBbHeight() / 2.0f), target.getZ(), 4, 0.1, 0.1, 0.1, 0.05);
            }
        }
    }
}

